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
  ) {}

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
    const storyContent = storyOutline ? `故事：${storyOutline.summary}` : '自由探索模式';

    const analysisPrompt = `基于世界背景分析最佳开场场景：
${worldContent}
${storyContent}
游戏模式：${params.gameMode}

返回JSON：
{
  "recommendedLocationTheme": "主题",
  "targetAtmosphere": "氛围",
  "keyStoryElements": ["元素1", "元素2"],
  "characterRoles": ["guide", "mentor"],
  "playerStartingObjective": "目标"
}`;

    try {
      const response = await this.llmService.generateText(analysisPrompt, { temperature: 0.4, maxTokens: 600 });
      const analysis = JSON.parse(response || '{}');
      return {
        recommendedLocationTheme: analysis.recommendedLocationTheme || '友好小镇',
        targetAtmosphere: analysis.targetAtmosphere || '温馨友好',
        keyStoryElements: analysis.keyStoryElements || ['探索', '学习'],
        characterRoles: analysis.characterRoles || ['guide', 'mentor'],
        playerStartingObjective: analysis.playerStartingObjective || '开始冒险'
      };
    } catch (error) {
      return {
        recommendedLocationTheme: '友好小镇',
        targetAtmosphere: '温馨友好',
        keyStoryElements: ['探索', '学习'],
        characterRoles: ['guide', 'mentor'],
        playerStartingObjective: '开始冒险'
      };
    }
  }

  // 生成增强位置
  private async generateEnhancedLocation(sceneAnalysis: any, params: EnhancedSceneGenerationParams): Promise<EnhancedLocationInfo> {
    try {
      const locationPrompt = `创建起始位置：
主题：${sceneAnalysis.recommendedLocationTheme}
氛围：${sceneAnalysis.targetAtmosphere}
返回详细位置JSON信息`;

      const response = await this.llmService.generateText(locationPrompt, { temperature: 0.7, maxTokens: 800 });
      const locationData = JSON.parse(response || '{}');
      
      return {
        id: `enhanced_location_${uuidv4()}`,
        name: locationData.name || '新手村广场',
        type: 'town',
        description: locationData.description || '友好的起始地点',
        atmosphere: sceneAnalysis.targetAtmosphere,
        keyFeatures: locationData.keyFeatures || ['中央广场', '友善居民'],
        storySignificance: locationData.storySignificance || '冒险起点',
        connectedLocations: locationData.connectedLocations || ['森林', '市场'],
        availableActions: locationData.availableActions || ['交谈', '探索'],
        hiddenElements: locationData.hiddenElements || ['古老标记']
      };
    } catch (error) {
      return this.getFallbackLocation();
    }
  }

  // 生成角色
  private async generateStoryAwareCharacters(location: EnhancedLocationInfo, storyOutline?: StoryOutline, params?: EnhancedSceneGenerationParams): Promise<EnhancedCharacterProfile[]> {
    const characterCount = 2; // 简化
    try {
      const charactersPrompt = `为${location.name}创建${characterCount}个角色，返回JSON数组`;
      const response = await this.llmService.generateText(charactersPrompt, { temperature: 0.8, maxTokens: 1000 });
      const charactersData = JSON.parse(response || '[]');
      
      return charactersData.map((charData: any, index: number) => ({
        id: `enhanced_char_${index}_${uuidv4()}`,
        name: charData.name || `角色${index + 1}`,
        role: 'guide' as const,
        background: charData.background || '当地居民',
        appearance: charData.appearance || '友善外观',
        personality: {
          traits: { friendly: 0.8, helpful: 0.7 },
          values: { community: 0.8 },
          goals: ['帮助新来者'],
          fears: ['冲突'],
          motivations: ['助人'],
          speechStyle: '友好'
        },
        storyRelevance: {
          plotConnections: [],
          futureImportance: 'medium' as const,
          potentialDevelopment: []
        },
        gameplayFunctions: {
          providesGuidance: true,
          offersQuests: false,
          teachesSkills: false,
          revealsLore: true,
          triggersEvents: false
        }
      }));
    } catch (error) {
      return this.generateFallbackCharacters(characterCount, location);
    }
  }

  // 生成描述
  private async generateDeepImmersiveDescription(location: EnhancedLocationInfo, characters: EnhancedCharacterProfile[], storyOutline?: StoryOutline, params?: EnhancedSceneGenerationParams): Promise<string> {
    try {
      const descriptionPrompt = `为${location.name}创建沉浸式开场描述，包含${characters.map(c => c.name).join('、')}`;
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
      id: `fallback_location_${uuidv4()}`,
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
      id: `fallback_char_${uuidv4()}`,
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
        adaptationStrategies: ['提供操作提示', '高亮可交互元素']
      }
    };
  }
}