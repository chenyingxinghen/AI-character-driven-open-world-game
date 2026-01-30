/**
 * 增强初始场景生成服务
 * 基于世界背景和剧情大纲生成初始场景和角色
 */

import { Logger } from '../Logger';
import { LLMService } from '../llm/LLMService';
import { WorldLoreService, WorldLore } from '../world/WorldLoreService';
import { DatabaseService } from '../database/DatabaseService';
import { StoryOutlineGeneratorService, StoryOutline } from './StoryOutlineGeneratorService';
import { v4 as uuidv4 } from 'uuid';
import { JsonUtils } from '../../utils/JsonUtils';
import { promptManager } from '../../prompts';

// 扩展的角色配置接口
export interface EnhancedCharacterProfile {
  id: string;
  name: string;
  role: 'guide' | 'mentor' | 'companion' | 'informant' | 'challenger' | 'mysterious';
  background: string;
  appearance: string;
  personality: {
    traits: Record<string, number>;
    values: Record<string, number>;
    goals: string[];
    fears: string[];
    motivations: string[];
    speechStyle: string;
  };
  storyRelevance: {
    plotConnections: string[];
    futureImportance: 'high' | 'medium' | 'low';
    potentialDevelopment: string[];
  };
  gameplayFunctions: {
    providesGuidance: boolean;
    offersQuests: boolean;
    teachesSkills: boolean;
    revealsLore: boolean;
    triggersEvents: boolean;
  };
}

// 增强的位置信息
export interface EnhancedLocationInfo {
  id: string;
  name: string;
  type: 'town' | 'village' | 'wilderness' | 'ruin' | 'landmark' | 'mystical';
  description: string;
  atmosphere: string;
  keyFeatures: string[];
  storySignificance: string;
  connectedLocations: string[];
  availableActions: string[];
  hiddenElements: string[];
}

// 增强的场景包
export interface EnhancedInitialScenePackage {
  sessionId: string;
  startingLocation: EnhancedLocationInfo;
  nearbyCharacters: EnhancedCharacterProfile[];
  immersiveDescription: string;
  storyContext: {
    currentPlotPoint: string;
    availableStoryPaths: string[];
    playerObjectives: string[];
    worldState: Record<string, any>;
  };
  playerGuidance: {
    welcomeMessage: string;
    suggestedActions: string[];
    worldContext: string;
    objectivesHint: string;
    explorationHints: string[];
  };
  environmentDetails: {
    timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';
    weather: string;
    ambientSounds: string[];
    visualElements: string[];
    atmosphericElements: string[];
  };
  directorNotes: {
    keyMoments: string[];
    interventionTriggers: string[];
    adaptationStrategies: string[];
  };
}

export interface EnhancedSceneGenerationParams {
  sessionId: string;
  worldLore: WorldLore[];
  storyOutline?: StoryOutline;
  playerPreferences?: {
    startingLocationPreference?: string;
    characterInteractionLevel?: 'low' | 'medium' | 'high';
    atmospherePreference?: string;
    difficultyLevel?: 'easy' | 'normal' | 'hard';
    storyPacing?: 'slow' | 'medium' | 'fast';
  };
  gameMode?: 'free' | 'script' | 'guided_free';
}

export class EnhancedInitialSceneService {
  constructor(
    private llmService: LLMService,
    private worldLoreService: WorldLoreService,
    private databaseService: DatabaseService,
    private storyOutlineGeneratorService: StoryOutlineGeneratorService,
    private logger: Logger
  ) { }

  /**
   * 生成增强的初始场景包
   */
  async generateEnhancedInitialScene(params: EnhancedSceneGenerationParams): Promise<EnhancedInitialScenePackage> {
    this.logger.info('Generating enhanced initial scene', {
      sessionId: params.sessionId,
      gameMode: params.gameMode,
      component: 'EnhancedInitialSceneService'
    });

    try {
      // 1. 如果没有剧情大纲且不是自由模式，则生成剧情大纲
      let storyOutline = params.storyOutline;
      if (!storyOutline && params.gameMode !== 'free') {
        this.logger.info('Generating story outline for guided gameplay');

        const outlineResult = await this.storyOutlineGeneratorService.generateStoryOutline({
          sessionId: params.sessionId,
          worldLore: params.worldLore,
          playerPreferences: {
            preferredGenre: 'adventure',
            targetDuration: 90,
            complexity: 'moderate'
          },
          gameMode: params.gameMode === 'script' ? 'script' : 'guided_free'
        });

        storyOutline = outlineResult.outline;
      }

      // 2. 生成场景组件
      const sceneAnalysis = await this.analyzeOptimalSceneSetup(params, storyOutline);
      const startingLocation = await this.generateEnhancedLocation(sceneAnalysis, params);
      const nearbyCharacters = await this.generateStoryAwareCharacters(startingLocation, storyOutline, params);
      const immersiveDescription = await this.generateDeepImmersiveDescription(startingLocation, nearbyCharacters, storyOutline, params);

      // 3. 创建上下文和指导
      const storyContext = this.createStoryContext(storyOutline, params);
      const playerGuidance = this.generateEnhancedPlayerGuidance(startingLocation, storyContext, params);
      const environmentDetails = this.generateRichEnvironmentDetails(startingLocation, storyOutline, params);
      const directorNotes = this.generateDirectorNotes(storyOutline, startingLocation, nearbyCharacters);

      const scenePackage: EnhancedInitialScenePackage = {
        sessionId: params.sessionId,
        startingLocation,
        nearbyCharacters,
        immersiveDescription,
        storyContext,
        playerGuidance,
        environmentDetails,
        directorNotes
      };

      // 4. 保存到数据库
      await this.saveInitialScenePackage(scenePackage, storyOutline);

      this.logger.info('Enhanced initial scene generated successfully', {
        sessionId: params.sessionId,
        locationName: startingLocation.name,
        characterCount: nearbyCharacters.length
      });

      return scenePackage;
    } catch (error) {
      this.logger.error('Failed to generate enhanced initial scene', error as Error);
      return this.generateFallbackScene(params);
    }
  }

  // 分析最佳场景设置
  private async analyzeOptimalSceneSetup(params: EnhancedSceneGenerationParams, storyOutline?: StoryOutline) {
    const worldContent = params.worldLore.map(lore => `[${lore.loreType}] ${lore.content}`).join('\n\n');
    const storyContent = storyOutline ? `故事大纲：${storyOutline.summary}` : '自由探索模式';
    const inspiration = params.worldLore.find(l => l.inspiration)?.inspiration || '未指定灵感';

    const analysisPrompt = promptManager.generate('scene.analyze_optimal_setup', {
      worldContent,
      inspiration,
      storyContent,
      gameMode: params.gameMode || 'guided_free',
      playerPreferences: JSON.stringify(params.playerPreferences || {})
    });

    try {
      const response = await this.llmService.generateText(analysisPrompt, {
        temperature: 0.4,
        maxTokens: 600,
        jsonMode: true
      });
      const analysis = JsonUtils.extractJson<any>(response || '{}');
      return {
        recommendedLocationTheme: analysis.recommendedLocationTheme || '友好起始点',
        targetAtmosphere: analysis.targetAtmosphere || '充满好奇与探索感',
        keyStoryElements: analysis.keyStoryElements || ['发现', '探索'],
        characterRoles: analysis.characterRoles || ['guide'],
        playerStartingObjective: analysis.playerStartingObjective || '探索周围环境并寻找线索'
      };
    } catch (error) {
      this.logger.warn('Failed to analyze optimal scene setup, using fallback', error as Error);
      return {
        recommendedLocationTheme: '友好小镇',
        targetAtmosphere: '温馨友好',
        keyStoryElements: ['探索', '学习'],
        characterRoles: ['guide'],
        playerStartingObjective: '开始冒险'
      };
    }
  }

  // 生成增强位置
  private async generateEnhancedLocation(sceneAnalysis: any, params: EnhancedSceneGenerationParams): Promise<EnhancedLocationInfo> {
    const worldContent = params.worldLore.slice(0, 3).map(lore => lore.content).join('\n');

    try {
      const locationPrompt = promptManager.generate('scene.generate_enhanced_location', {
        worldContent,
        recommendedLocationTheme: sceneAnalysis.recommendedLocationTheme,
        targetAtmosphere: sceneAnalysis.targetAtmosphere,
        keyStoryElements: sceneAnalysis.keyStoryElements.join(', ')
      });

      const response = await this.llmService.generateText(locationPrompt, {
        temperature: 0.7,
        maxTokens: 800,
        jsonMode: true
      });
      const locationData = JsonUtils.extractJson<any>(response || '{}');

      const locationId = uuidv4();

      const location: EnhancedLocationInfo = {
        id: locationId,
        name: locationData.name || '起始之地',
        type: locationData.type || 'town',
        description: locationData.description || '一个等待探索的神秘地点。',
        atmosphere: locationData.atmosphere || sceneAnalysis.targetAtmosphere,
        keyFeatures: locationData.keyFeatures || [],
        storySignificance: locationData.storySignificance || '冒险的终点与起点',
        connectedLocations: locationData.connectedLocations || [],
        availableActions: locationData.availableActions || [],
        hiddenElements: locationData.hiddenElements || []
      };

      // 实时持久化到数据库 locations 表
      await this.databaseService.createLocation({
        id: location.id,
        session_id: params.sessionId,
        name: location.name,
        description: location.description,
        location_type: location.type,
        region_id: 'initial_region',
        position_x: 0,
        position_y: 0,
        location_data: {
          atmosphere: location.atmosphere,
          keyFeatures: location.keyFeatures,
          storySignificance: location.storySignificance,
          availableActions: location.availableActions,
          hiddenElements: location.hiddenElements
        }
      });

      return location;
    } catch (error) {
      this.logger.error('Failed to generate enhanced location, using fallback', error as Error);
      const fallback = this.getFallbackLocation();
      // 仍然尝试保存 fallback
      await this.databaseService.createLocation({
        id: fallback.id,
        session_id: params.sessionId,
        name: fallback.name,
        description: fallback.description,
        location_type: fallback.type,
        region_id: 'fallback_region',
        position_x: 0,
        position_y: 0,
        location_data: {}
      });
      return fallback;
    }
  }

  // 生成角色
  private async generateStoryAwareCharacters(location: EnhancedLocationInfo, storyOutline?: StoryOutline, params?: EnhancedSceneGenerationParams): Promise<EnhancedCharacterProfile[]> {
    const characterCount = 2;
    try {
      const charactersPrompt = promptManager.generate('scene.generate_story_aware_characters', {
        locationName: location.name,
        locationDescription: location.description,
        atmosphere: location.atmosphere,
        storyOutline: storyOutline ? storyOutline.summary : '自由探索模式',
        characterCount
      });

      const response = await this.llmService.generateText(charactersPrompt, {
        temperature: 0.8,
        maxTokens: 1200,
        jsonMode: true
      });

      let charactersData = JsonUtils.extractJson<any>(response || '[]');

      // 增强鲁棒性：处理 LLM 可能返回对象而非数组的情况
      if (charactersData && !Array.isArray(charactersData)) {
        if (Array.isArray(charactersData.characters)) {
          charactersData = charactersData.characters;
        } else if (Array.isArray(charactersData.npcs)) {
          charactersData = charactersData.npcs;
        } else if (typeof charactersData === 'object' && Object.keys(charactersData).length > 0) {
          // 如果返回的是单个对象，则包装为数组
          charactersData = [charactersData];
        } else {
          charactersData = [];
        }
      }

      const characters: EnhancedCharacterProfile[] = (charactersData || []).map((charData: any, index: number) => ({
        id: uuidv4(),
        name: charData.name || `角色${index + 1}`,
        role: charData.role || ('guide' as const),
        background: charData.background || '当地居民',
        appearance: charData.appearance || '普通市民',
        personality: charData.personality || {
          traits: { friendly: 0.8 },
          values: { safety: 0.8 },
          goals: [],
          fears: [],
          motivations: [],
          speechStyle: '普通'
        },
        storyRelevance: charData.storyRelevance || {
          plotConnections: [],
          futureImportance: 'medium' as const,
          potentialDevelopment: []
        },
        gameplayFunctions: charData.gameplayFunctions || {
          providesGuidance: true,
          offersQuests: false,
          teachesSkills: false,
          revealsLore: true,
          triggersEvents: false
        }
      }));

      // 持久化到数据库 characters 表
      for (const char of characters) {
        await this.databaseService.createCharacter({
          id: char.id,
          session_id: params?.sessionId || 'unknown',
          name: char.name,
          personality: char.personality,
          background: char.background,
          appearance: char.appearance,
          current_location: location.id,
          emotional_state: { mood: 'neutral', arousal: 0.5, valence: 0.5 },
          is_active: true,
          character_data: {
            role: char.role,
            storyRelevance: char.storyRelevance,
            gameplayFunctions: char.gameplayFunctions
          }
        });
      }

      return characters;
    } catch (error) {
      this.logger.error('Failed to generate story aware characters, using fallback', error as Error);
      return this.generateFallbackCharacters(characterCount, location);
    }
  }

  private isValidCharacterName(name: string): boolean {
    if (!name || name.toLowerCase() === 'none' || name.toLowerCase() === 'unknown') return false;

    const pronouns = [
      '她', '他', '它', '他们', '她们', '它们', '你', '我', '我们', '你们',
      'she', 'her', 'he', 'him', 'it', 'they', 'them', 'you', 'i', 'me', 'we', 'us'
    ];

    const cleanName = name.trim().toLowerCase();
    if (pronouns.includes(cleanName)) return false;

    if (name.length === 1 && pronouns.includes(name)) return false;

    return true;
  }

  /**
   * 为特定位置生成一个与故事相关的角色并保存到数据库
   */
  async generateAndSaveCharacter(
    sessionId: string,
    locationId: string,
    roleHint?: string,
    characterParams?: any
  ): Promise<EnhancedCharacterProfile> {
    this.logger.info(`Generating single mid-game character for session ${sessionId}`, { role: roleHint });

    try {
      const prompt = promptManager.generate('scene.generate_mid_game_character', {
        locationId,
        roleHint,
        characterParams: JSON.stringify(characterParams)
      });

      const response = await this.llmService.generateText(prompt, {
        temperature: 0.8,
        maxTokens: 800,
        jsonMode: true
      });

      const charData = JsonUtils.extractJson<any>(response || '{}');
      const finalName = charData.name || characterParams?.name || '神秘人';

      if (!this.isValidCharacterName(finalName)) {
        this.logger.warn(`Generated invalid character name: "${finalName}", skipping creation.`);
        throw new Error(`Invalid character name generated: ${finalName}`);
      }

      const char: EnhancedCharacterProfile = {
        id: uuidv4(),
        name: finalName,
        role: charData.role || characterParams?.role || 'mysterious',
        background: charData.background || '突然出现在这里的神秘人物',
        appearance: charData.appearance || characterParams?.appearance || '笼罩在迷雾中',
        personality: charData.personality || {
          traits: { mysterious: 0.8 },
          values: { safety: 0.5 },
          goals: [],
          fears: [],
          motivations: [],
          speechStyle: '简洁'
        },
        storyRelevance: charData.storyRelevance || {
          plotConnections: [],
          futureImportance: 'medium',
          potentialDevelopment: []
        },
        gameplayFunctions: charData.gameplayFunctions || {
          providesGuidance: true,
          offersQuests: false,
          teachesSkills: false,
          revealsLore: true,
          triggersEvents: false
        }
      };

      // 持久化到数据库
      await this.databaseService.createCharacter({
        id: char.id,
        session_id: sessionId,
        name: char.name,
        personality: char.personality,
        background: char.background,
        appearance: char.appearance,
        current_location: locationId,
        emotional_state: { mood: 'neutral', arousal: 0.5, valence: 0.5 },
        is_active: true,
        character_data: {
          role: char.role,
          storyRelevance: char.storyRelevance,
          gameplayFunctions: char.gameplayFunctions,
          introducedByIntervention: true
        }
      });

      return char;
    } catch (error) {
      this.logger.error('Failed to generate mid-game character', error as Error);
      throw error;
    }
  }

  // 生成描述
  private async generateDeepImmersiveDescription(location: EnhancedLocationInfo, characters: EnhancedCharacterProfile[], storyOutline?: StoryOutline, params?: EnhancedSceneGenerationParams): Promise<string> {
    try {
      const descriptionPrompt = promptManager.generate('scene.generate_immersive_description', {
        locationName: location.name,
        characters: characters.map(c => c.name).join('、')
      });
      const response = await this.llmService.generateText(descriptionPrompt, { temperature: 0.8, maxTokens: 400 });
      return response || this.getFallbackDescription(location, characters);
    } catch (error) {
      return this.getFallbackDescription(location, characters);
    }
  }

  // 创建故事上下文
  private createStoryContext(storyOutline?: StoryOutline, params?: EnhancedSceneGenerationParams): EnhancedInitialScenePackage['storyContext'] {
    if (!storyOutline) {
      return {
        currentPlotPoint: 'free_exploration',
        availableStoryPaths: ['自由探索'],
        playerObjectives: ['熟悉环境'],
        worldState: { explorationMode: true }
      };
    }

    return {
      currentPlotPoint: 'story_beginning',
      availableStoryPaths: ['开始冒险'],
      playerObjectives: ['探索', '交流'],
      worldState: {
        currentAct: 1,
        storyTitle: storyOutline.title
      }
    };
  }

  // 生成玩家指导
  private generateEnhancedPlayerGuidance(location: EnhancedLocationInfo, storyContext: any, params?: EnhancedSceneGenerationParams): EnhancedInitialScenePackage['playerGuidance'] {
    return {
      welcomeMessage: `欢迎来到${location.name}！`,
      suggestedActions: ['与角色交谈', '探索环境', '查看细节'],
      worldContext: '这是一个充满可能性的世界',
      objectivesHint: '通过探索了解这个世界',
      explorationHints: ['观察环境', '与人互动', '寻找线索']
    };
  }

  // 生成环境细节
  private generateRichEnvironmentDetails(location: EnhancedLocationInfo, storyOutline?: StoryOutline, params?: EnhancedSceneGenerationParams): EnhancedInitialScenePackage['environmentDetails'] {
    return {
      timeOfDay: 'morning',
      weather: '晴朗',
      ambientSounds: ['鸟鸣', '人声'],
      visualElements: ['阳光', '建筑'],
      atmosphericElements: ['温暖', '友好']
    };
  }

  // 生成导演笔记
  private generateDirectorNotes(storyOutline?: StoryOutline, location?: EnhancedLocationInfo, characters?: EnhancedCharacterProfile[]): EnhancedInitialScenePackage['directorNotes'] {
    return {
      keyMoments: ['首次对话', '环境探索'],
      interventionTriggers: ['玩家困惑', '长时间无动作'],
      adaptationStrategies: ['提供提示', '引导互动']
    };
  }

  // 保存场景包
  private async saveInitialScenePackage(scenePackage: EnhancedInitialScenePackage, storyOutline?: StoryOutline): Promise<void> {
    try {
      await this.databaseService.query(`
        INSERT INTO initial_scene_packages (
          id, session_id, story_outline_id, starting_location, nearby_characters,
          immersive_description, player_guidance, environment_details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        uuidv4(),
        scenePackage.sessionId,
        storyOutline?.id || null,
        JSON.stringify(scenePackage.startingLocation),
        JSON.stringify(scenePackage.nearbyCharacters),
        scenePackage.immersiveDescription,
        JSON.stringify(scenePackage.playerGuidance),
        JSON.stringify(scenePackage.environmentDetails),
        new Date()
      ]);
    } catch (error) {
      this.logger.warn('Failed to save initial scene package to database', error as Error);
    }
  }

  // 备用方法
  private getFallbackLocation(): EnhancedLocationInfo {
    return {
      id: uuidv4(),
      name: '新手村广场',
      type: 'town',
      description: '一个友好的小镇广场，适合新手开始冒险',
      atmosphere: '温馨友好',
      keyFeatures: ['中央喷泉', '友善居民', '商店'],
      storySignificance: '冒险的起点',
      connectedLocations: ['森林', '市场'],
      availableActions: ['与居民交谈', '探索商店', '观察环境'],
      hiddenElements: ['古老铭文']
    };
  }

  private generateFallbackCharacters(count: number, location: EnhancedLocationInfo): EnhancedCharacterProfile[] {
    return [{
      id: uuidv4(),
      name: '村长艾伦',
      role: 'guide',
      background: '友善的村长，乐于帮助新来者',
      appearance: '中年男性，穿着朴素',
      personality: {
        traits: { friendly: 0.9, helpful: 0.8, wise: 0.7 },
        values: { community: 0.9, knowledge: 0.7 },
        goals: ['帮助新来者', '维护村庄和谐'],
        fears: ['冲突', '灾难'],
        motivations: ['责任感', '关爱他人'],
        speechStyle: '温和而智慧'
      },
      storyRelevance: {
        plotConnections: [],
        futureImportance: 'medium',
        potentialDevelopment: ['提供重要信息', '介绍其他角色']
      },
      gameplayFunctions: {
        providesGuidance: true,
        offersQuests: false,
        teachesSkills: false,
        revealsLore: true,
        triggersEvents: false
      }
    }];
  }

  private getFallbackDescription(location: EnhancedLocationInfo, characters: EnhancedCharacterProfile[]): string {
    return `你来到了${location.name}，${location.description}。你看到${characters.map(c => c.name).join('和')}在这里，他们看起来很友善。这里充满了探索的可能性，你可以开始你的冒险了。`;
  }

  private generateFallbackScene(params: EnhancedSceneGenerationParams): EnhancedInitialScenePackage {
    const location = this.getFallbackLocation();
    const characters = this.generateFallbackCharacters(1, location);

    return {
      sessionId: params.sessionId,
      startingLocation: location,
      nearbyCharacters: characters,
      immersiveDescription: this.getFallbackDescription(location, characters),
      storyContext: {
        currentPlotPoint: 'tutorial_start',
        availableStoryPaths: ['学习基础'],
        playerObjectives: ['熟悉操作'],
        worldState: { tutorialMode: true }
      },
      playerGuidance: {
        welcomeMessage: '欢迎开始你的冒险！',
        suggestedActions: ['与村长交谈', '探索村庄'],
        worldContext: '这是一个适合新手的友好环境',
        objectivesHint: '先熟悉基本操作和环境',
        explorationHints: ['点击角色进行对话', '观察环境获取信息']
      },
      environmentDetails: {
        timeOfDay: 'morning',
        weather: '晴朗',
        ambientSounds: ['鸟鸣', '微风', '远处谈话声'],
        visualElements: ['温暖阳光', '石板路', '花园'],
        atmosphericElements: ['和平', '安全', '希望']
      },
      directorNotes: {
        keyMoments: ['首次对话', '基础探索'],
        interventionTriggers: ['超过2分钟无操作', '多次点击无效区域'],
        adaptationStrategies: ['提供提示', '高亮可交互元素']
      }
    };
  }
}
