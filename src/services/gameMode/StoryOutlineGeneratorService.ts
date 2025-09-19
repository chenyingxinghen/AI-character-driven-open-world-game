/**
 * 剧情大纲生成服务
 * 基于世界背景故事生成完整的剧情大纲，为导演系统提供引导参考
 */

import { Logger } from '../Logger';
import { LLMService } from '../llm/LLMService';
import { WorldLoreService, WorldLore } from '../world/WorldLoreService';
import { DatabaseService } from '../database/DatabaseService';
import { FormattedTextExtractorService } from '../llm/FormattedTextExtractorService';
import { v4 as uuidv4 } from 'uuid';

// 剧情大纲接口
export interface StoryOutline {
  id: string;
  sessionId: string;
  title: string;
  genre: string;
  summary: string;
  acts: StoryAct[];
  characters: StoryCharacter[];
  locations: StoryLocation[];
  themes: string[];
  estimatedDuration: number; // 分钟
  plotPoints: PlotPoint[];
  directorGuidance: DirectorGuidancePoint[];
}

export interface StoryAct {
  id: string;
  actNumber: number;
  title: string;
  summary: string;
  keyEvents: string[];
  expectedOutcomes: string[];
  estimatedDuration: number;
}

export interface StoryCharacter {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  background: string;
  motivations: string[];
  relationships: { [characterId: string]: string };
  appearanceActs: number[];
}

export interface StoryLocation {
  id: string;
  name: string;
  type: string;
  significance: 'major' | 'minor' | 'background';
  description: string;
  usedInActs: number[];
}

export interface PlotPoint {
  id: string;
  actId: string;
  sequence: number;
  title: string;
  description: string;
  type: 'introduction' | 'conflict' | 'climax' | 'resolution' | 'transition';
  expectedPlayerActions: string[];
  possibleOutcomes: string[];
  directorNotes: string;
}

export interface DirectorGuidancePoint {
  id: string;
  plotPointId: string;
  guidance: string;
  interventionTriggers: string[];
  suggestedApproaches: string[];
  backupPlans: string[];
}

export interface StoryOutlineGenerationParams {
  sessionId: string;
  worldLore: WorldLore[];
  playerPreferences?: {
    preferredGenre?: string;
    targetDuration?: number; // 分钟
    complexity?: 'simple' | 'moderate' | 'complex';
    focusElements?: string[]; // 如：['character_development', 'exploration', 'mystery']
  };
  gameMode?: 'script' | 'guided_free'; // script模式需要更严格的大纲，guided_free更灵活
}

export interface StoryOutlineResult {
  outline: StoryOutline;
  coreElements: {
    mainConflict: string;
    keyTurningPoints: string[];
    characterArcs: string[];
    worldBuilding: string[];
  };
  directorIntegration: {
    guidancePoints: DirectorGuidancePoint[];
    interventionStrategy: string;
    adaptationNotes: string[];
  };
  validationReport: {
    coherenceScore: number;
    worldConsistency: number;
    playerEngagement: number;
    adaptabilityScore: number;
    issues: string[];
    recommendations: string[];
  };
}

export class StoryOutlineGeneratorService {
  private textExtractor: FormattedTextExtractorService;

  constructor(
    private llmService: LLMService,
    private worldLoreService: WorldLoreService,
    private databaseService: DatabaseService,
    private logger: Logger
  ) {
    this.textExtractor = new FormattedTextExtractorService(logger);
  }

  /**
   * 生成剧情大纲
   */
  async generateStoryOutline(params: StoryOutlineGenerationParams): Promise<StoryOutlineResult> {
    this.logger.info('Starting story outline generation', {
      sessionId: params.sessionId,
      component: 'StoryOutlineGeneratorService'
    });

    try {
      // 1. 分析世界背景，提取核心元素
      const worldAnalysis = await this.analyzeWorldLore(params.worldLore);
      
      // 2. 生成主要故事框架
      const storyFramework = await this.generateStoryFramework(worldAnalysis, params);
      
      // 3. 创建详细的剧情点
      const plotPoints = await this.generatePlotPoints(storyFramework, params);
      
      // 4. 生成导演指导信息
      const directorGuidance = await this.generateDirectorGuidance(plotPoints, worldAnalysis);
      
      // 5. 构建完整的剧情大纲
      const storyOutline = await this.constructStoryOutline(
        storyFramework, 
        plotPoints, 
        directorGuidance, 
        params
      );
      
      // 6. 验证和评估
      const validationReport = await this.validateStoryOutline(storyOutline, params);
      
      // 7. 准备结果
      const result: StoryOutlineResult = {
        outline: storyOutline,
        coreElements: {
          mainConflict: storyFramework.mainConflict,
          keyTurningPoints: storyFramework.turningPoints,
          characterArcs: storyFramework.characterArcs,
          worldBuilding: worldAnalysis.keyElements
        },
        directorIntegration: {
          guidancePoints: directorGuidance,
          interventionStrategy: this.generateInterventionStrategy(params.gameMode || 'script'),
          adaptationNotes: this.generateAdaptationNotes(storyOutline)
        },
        validationReport
      };

      // 8. 保存到数据库
      await this.saveStoryOutline(result);

      this.logger.info('Story outline generated successfully', {
        sessionId: params.sessionId,
        outlineId: storyOutline.id,
        component: 'StoryOutlineGeneratorService'
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to generate story outline', error as Error, {
        sessionId: params.sessionId,
        component: 'StoryOutlineGeneratorService'
      });
      throw error;
    }
  }

  /**
   * 分析世界背景
   */
  private async analyzeWorldLore(worldLore: WorldLore[]): Promise<{
    keyElements: string[];
    themes: string[];
    conflicts: string[];
    characters: string[];
    locations: string[];
    tone: string;
  }> {
    const combinedLore = worldLore.map(lore => 
      `[${lore.loreType}] ${lore.title}: ${lore.content}`
    ).join('\n\n');

    const analysisPrompt = `
分析以下世界背景故事，提取关键要素用于剧情大纲生成：

${combinedLore}

请分析并提取关键信息，按以下格式返回：

=== WORLD_ANALYSIS ===
KEY_ELEMENTS: 元素1, 元素2, 元素3
THEMES: 主题1, 主题2, 主题3
CONFLICTS: 冲突1, 冲突2, 冲突3
CHARACTERS: 角色/势力1, 角色/势力2, 角色/势力3
LOCATIONS: 地点1, 地点2, 地点3
TONE: 整体基调描述
=== END_ANALYSIS ===

要求：
- 每个类别提取3-5个最重要的元素
- 使用逗号分隔列表项
- 基调描述要简洁准确
- 严格按照格式输出
`;

    try {
      const response = await this.llmService.generateText(analysisPrompt, {
        temperature: 0.3,
        maxTokens: 800
      });

      return this.extractWorldAnalysis(response || '');
    } catch (error) {
      this.logger.warn('Failed to analyze world lore, using defaults', error as Error);
      return {
        keyElements: ['magic', 'adventure', 'discovery'],
        themes: ['exploration', 'growth', 'friendship'],
        conflicts: ['external threat', 'personal challenge'],
        characters: ['local_guide', 'wise_mentor'],
        locations: ['starting_town', 'mysterious_forest'],
        tone: 'adventure'
      };
    }
  }

  /**
   * 提取世界分析结果
   */
  private extractWorldAnalysis(formattedText: string): {
    keyElements: string[];
    themes: string[];
    conflicts: string[];
    characters: string[];
    locations: string[];
    tone: string;
  } {
    try {
      // 使用自定义解析方法，而不是直接访问私有方法
      const section = this.extractSectionBetweenMarkers(
        formattedText, 
        '=== WORLD_ANALYSIS ===', 
        '=== END_ANALYSIS ==='
      );
      
      if (!section) {
        throw new Error('World analysis section not found');
      }

      const lines = section.split('\n').filter(line => line.trim());
      const fields: Record<string, string> = {};
      
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          fields[key] = value;
        }
      }

      return {
        keyElements: this.parseCommaSeparatedList(fields.KEY_ELEMENTS || ''),
        themes: this.parseCommaSeparatedList(fields.THEMES || ''),
        conflicts: this.parseCommaSeparatedList(fields.CONFLICTS || ''),
        characters: this.parseCommaSeparatedList(fields.CHARACTERS || ''),
        locations: this.parseCommaSeparatedList(fields.LOCATIONS || ''),
        tone: fields.TONE || 'adventure'
      };
    } catch (error) {
      this.logger.warn('Failed to extract world analysis, using defaults', error as Error);
      return {
        keyElements: ['magic', 'adventure', 'discovery'],
        themes: ['exploration', 'growth', 'friendship'],
        conflicts: ['external threat', 'personal challenge'],
        characters: ['local_guide', 'wise_mentor'],
        locations: ['starting_town', 'mysterious_forest'],
        tone: 'adventure'
      };
    }
  }

  /**
   * 在标记之间提取文本段
   */
  private extractSectionBetweenMarkers(text: string, startMarker: string, endMarker: string): string | null {
    const startIndex = text.indexOf(startMarker);
    if (startIndex === -1) return null;
    
    const contentStart = startIndex + startMarker.length;
    const endIndex = text.indexOf(endMarker, contentStart);
    if (endIndex === -1) return null;
    
    return text.substring(contentStart, endIndex).trim();
  }

  /**
   * 解析逗号分隔的列表
   */
  private parseCommaSeparatedList(text: string): string[] {
    if (!text || !text.trim()) return [];
    
    return text
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  /**
   * 生成故事框架
   */
  private async generateStoryFramework(
    worldAnalysis: any, 
    params: StoryOutlineGenerationParams
  ): Promise<{
    mainConflict: string;
    turningPoints: string[];
    characterArcs: string[];
    acts: StoryAct[];
  }> {
    const frameworkPrompt = `
基于世界分析结果，创建一个适合${params.gameMode === 'script' ? '剧本模式' : '引导自由模式'}的故事框架：

世界关键元素：${worldAnalysis.keyElements.join(', ')}
主要主题：${worldAnalysis.themes.join(', ')}
潜在冲突：${worldAnalysis.conflicts.join(', ')}
整体基调：${worldAnalysis.tone}

玩家偏好：
- 类型偏好：${params.playerPreferences?.preferredGenre || '冒险'}
- 目标时长：${params.playerPreferences?.targetDuration || 90}分钟
- 复杂度：${params.playerPreferences?.complexity || 'moderate'}

创建包含3-4个章节的故事框架，按以下格式返回：

=== STORY_FRAMEWORK ===
MAIN_CONFLICT: 主要冲突描述
TURNING_POINTS: 转折点1, 转折点2, 转折点3, 转折点4
CHARACTER_ARCS: 角色弧线1, 角色弧线2, 角色弧线3
ACT_COUNT: 3
ACT_1_TITLE: 第一章标题
ACT_1_SUMMARY: 第一章概要
ACT_1_EVENTS: 事件1, 事件2, 事件3
ACT_1_OUTCOMES: 结果1, 结果2
ACT_2_TITLE: 第二章标题
ACT_2_SUMMARY: 第二章概要
ACT_2_EVENTS: 事件1, 事件2, 事件3
ACT_2_OUTCOMES: 结果1, 结果2
ACT_3_TITLE: 第三章标题
ACT_3_SUMMARY: 第三章概要
ACT_3_EVENTS: 事件1, 事件2, 事件3
ACT_3_OUTCOMES: 结果1, 结果2
=== END_FRAMEWORK ===

要求：
- 每个章节有明确的目标和挑战
- 为玩家提供有意义的选择
- 推进整体叙事
- 适合${params.gameMode === 'script' ? '结构化引导' : '灵活引导'}
- 使用逗号分隔列表项
`;

    try {
      const response = await this.llmService.generateText(frameworkPrompt, {
        temperature: 0.7,
        maxTokens: 1200
      });

      return this.extractStoryFramework(response || '', params);
    } catch (error) {
      this.logger.warn('Failed to generate story framework, using fallback', error as Error);
      return this.generateFallbackFramework(params);
    }
  }

  /**
   * 提取故事框架结果
   */
  private extractStoryFramework(
    formattedText: string, 
    params: StoryOutlineGenerationParams
  ): {
    mainConflict: string;
    turningPoints: string[];
    characterArcs: string[];
    acts: StoryAct[];
  } {
    try {
      const section = this.extractSectionBetweenMarkers(
        formattedText,
        '=== STORY_FRAMEWORK ===',
        '=== END_FRAMEWORK ==='
      );
      
      if (!section) {
        throw new Error('Story framework section not found');
      }

      const lines = section.split('\n').filter(line => line.trim());
      const fields: Record<string, string> = {};
      
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          fields[key] = value;
        }
      }

      // 解析章节信息
      const actCount = parseInt(fields.ACT_COUNT || '3');
      const acts: StoryAct[] = [];
      
      for (let i = 1; i <= actCount; i++) {
        const act: StoryAct = {
          id: `act_${i}_${uuidv4()}`,
          actNumber: i,
          title: fields[`ACT_${i}_TITLE`] || `第${i}章`,
          summary: fields[`ACT_${i}_SUMMARY`] || `第${i}章概要`,
          keyEvents: this.parseCommaSeparatedList(fields[`ACT_${i}_EVENTS`] || ''),
          expectedOutcomes: this.parseCommaSeparatedList(fields[`ACT_${i}_OUTCOMES`] || ''),
          estimatedDuration: Math.floor((params.playerPreferences?.targetDuration || 90) / actCount)
        };
        acts.push(act);
      }

      return {
        mainConflict: fields.MAIN_CONFLICT || '探索未知的挑战',
        turningPoints: this.parseCommaSeparatedList(fields.TURNING_POINTS || ''),
        characterArcs: this.parseCommaSeparatedList(fields.CHARACTER_ARCS || ''),
        acts
      };
    } catch (error) {
      this.logger.warn('Failed to extract story framework, using fallback', error as Error);
      return this.generateFallbackFramework(params);
    }
  }

  /**
   * 生成详细剧情点
   */
  private async generatePlotPoints(
    framework: any, 
    params: StoryOutlineGenerationParams
  ): Promise<PlotPoint[]> {
    const plotPoints: PlotPoint[] = [];

    for (let actIndex = 0; actIndex < framework.acts.length; actIndex++) {
      const act = framework.acts[actIndex];
      const actPlotPoints = await this.generateActPlotPoints(act, actIndex + 1, params);
      plotPoints.push(...actPlotPoints);
    }

    return plotPoints;
  }

  /**
   * 为单个章节生成剧情点
   */
  private async generateActPlotPoints(
    act: StoryAct, 
    actNumber: number, 
    params: StoryOutlineGenerationParams
  ): Promise<PlotPoint[]> {
    const plotPointPrompt = `
为第${actNumber}章"${act.title}"生成详细的剧情点：

章节概要：${act.summary}
关键事件：${act.keyEvents.join(', ')}
预期结果：${act.expectedOutcomes.join(', ')}
章节时长：${act.estimatedDuration}分钟
游戏模式：${params.gameMode === 'script' ? '剧本模式' : '引导自由模式'}

请生成4-6个剧情点，确保：
1. 每个剧情点都有明确的目标和挑战
2. 提供多样化的玩家行动选项
3. 包含可能的结果分支
4. 适合${params.gameMode === 'script' ? '结构化引导' : '灵活引导'}

按以下格式返回：

=== ACT_PLOT_POINTS ===
PLOT_COUNT: 剧情点数量
PLOT_1_TITLE: 剧情点1标题
PLOT_1_DESC: 剧情点1详细描述
PLOT_1_TYPE: introduction|conflict|climax|resolution|transition
PLOT_1_ACTIONS: 预期行动1, 预期行动2, 预期行动3
PLOT_1_OUTCOMES: 可能结果1, 可能结果2, 可能结果3
PLOT_1_NOTES: 导演指导注释
PLOT_2_TITLE: 剧情点2标题
PLOT_2_DESC: 剧情点2详细描述
PLOT_2_TYPE: introduction|conflict|climax|resolution|transition
PLOT_2_ACTIONS: 预期行动1, 预期行动2, 预期行动3
PLOT_2_OUTCOMES: 可能结果1, 可能结果2, 可能结果3
PLOT_2_NOTES: 导演指导注释
[继续其他剧情点...]
=== END_PLOT_POINTS ===

要求：
- 使用逗号分隔列表项
- 确保剧情点之间的逻辑连贯性
- 为玩家提供有意义的选择
- 严格按照格式输出
`;

    try {
      const response = await this.llmService.generateText(plotPointPrompt, {
        temperature: 0.6,
        maxTokens: 1500
      });

      return this.extractActPlotPoints(response || '', act, actNumber);
    } catch (error) {
      this.logger.warn(`Failed to generate plot points for act ${actNumber}, using fallback`, error as Error);
      return this.generateFallbackPlotPoints(act, actNumber);
    }
  }

  /**
   * 生成导演指导
   */
  private async generateDirectorGuidance(
    plotPoints: PlotPoint[], 
    worldAnalysis: any
  ): Promise<DirectorGuidancePoint[]> {
    const guidance: DirectorGuidancePoint[] = [];

    for (const plotPoint of plotPoints) {
      const guidancePoint = await this.generatePlotPointGuidance(plotPoint, worldAnalysis);
      guidance.push(guidancePoint);
    }

    return guidance;
  }

  /**
   * 为单个剧情点生成指导
   */
  private async generatePlotPointGuidance(
    plotPoint: PlotPoint, 
    worldAnalysis: any
  ): Promise<DirectorGuidancePoint> {
    const guidancePrompt = `
为剧情点"${plotPoint.title}"生成导演指导：

剧情描述：${plotPoint.description}
剧情类型：${plotPoint.type}
预期玩家行动：${plotPoint.expectedPlayerActions.join(', ')}
可能结果：${plotPoint.possibleOutcomes.join(', ')}
导演注释：${plotPoint.directorNotes}

世界背景考虑：
- 整体基调：${worldAnalysis.tone}
- 主要主题：${worldAnalysis.themes.join(', ')}
- 潜在冲突：${worldAnalysis.conflicts.join(', ')}

请提供详细的导演指导信息，按以下格式返回：

=== DIRECTOR_GUIDANCE ===
CORE_GUIDANCE: 核心指导原则的详细描述
INTERVENTION_TRIGGERS: 触发条件1, 触发条件2, 触发条件3
SUGGESTED_APPROACHES: 引导方法1, 引导方法2, 引导方法3
BACKUP_PLANS: 备用计划1, 备用计划2, 备用计划3
ADAPTATION_NOTES: 适应性调整的具体建议
TIMING_CONSIDERATIONS: 时机把控的重要提醒
=== END_GUIDANCE ===

要求：
- 核心指导要具体可操作
- 干预触发条件要明确具体
- 引导方法要多样化且实用
- 备用计划要切实可行
- 使用逗号分隔列表项
- 严格按照格式输出
`;

    try {
      const response = await this.llmService.generateText(guidancePrompt, {
        temperature: 0.4,
        maxTokens: 800
      });

      return this.extractDirectorGuidance(response || '', plotPoint);
    } catch (error) {
      this.logger.warn(`Failed to generate guidance for plot point ${plotPoint.id}`, error as Error);
      return this.generateFallbackGuidance(plotPoint);
    }
  }

  /**
   * 构建完整剧情大纲
   */
  private async constructStoryOutline(
    framework: any,
    plotPoints: PlotPoint[],
    directorGuidance: DirectorGuidancePoint[],
    params: StoryOutlineGenerationParams
  ): Promise<StoryOutline> {
    // 直接使用框架中的数据，如果缺少则使用默认值
    const title = framework.title || `${framework.mainConflict}的冒险`;
    const summary = framework.summary || `在这个故事中，玩家将面对${framework.mainConflict}，经历多个重要转折点，最终实现成长和目标。`;
    
    return {
      id: `story_outline_${uuidv4()}`,
      sessionId: params.sessionId,
      title,
      genre: params.playerPreferences?.preferredGenre || 'adventure',
      summary,
      acts: framework.acts,
      characters: framework.characters || this.generateFallbackCharacters(framework),
      locations: framework.locations || this.generateFallbackLocations(framework),
      themes: framework.themes || [],
      estimatedDuration: params.playerPreferences?.targetDuration || 90,
      plotPoints,
      directorGuidance
    };
  }

  /**
   * 验证剧情大纲
   */
  private async validateStoryOutline(
    outline: StoryOutline, 
    params: StoryOutlineGenerationParams
  ): Promise<StoryOutlineResult['validationReport']> {
    const validationPrompt = `
对以下剧情大纲进行全面验证评估：

故事标题：${outline.title}
故事类型：${outline.genre}
总时长：${outline.estimatedDuration}分钟
章节数量：${outline.acts.length}
剧情点数量：${outline.plotPoints.length}
角色数量：${outline.characters.length}
地点数量：${outline.locations.length}
主要主题：${outline.themes.join(', ')}

章节概览：
${outline.acts.map((act, index) => `第${index + 1}章: ${act.title} - ${act.summary} (${act.estimatedDuration}分钟)`).join('\n')}

游戏模式：${params.gameMode === 'script' ? '剧本模式' : '引导自由模式'}
玩家偏好：${JSON.stringify(params.playerPreferences || {})}

请从以下维度进行评估（0-100分）：
1. 故事连贯性 - 情节是否逻辑清晰、前后一致
2. 世界一致性 - 是否与世界背景设定保持一致
3. 玩家参与度 - 是否提供足够的选择和互动机会
4. 适应性 - 是否能灵活应对玩家的不同选择

按以下格式返回评估结果：

=== VALIDATION_REPORT ===
COHERENCE_SCORE: 连贯性分数 (0-100)
WORLD_CONSISTENCY: 世界一致性分数 (0-100)
PLAYER_ENGAGEMENT: 玩家参与度分数 (0-100)
ADAPTABILITY_SCORE: 适应性分数 (0-100)
ISSUES: 问题1, 问题2, 问题3 (如果存在)
RECOMMENDANIONS: 建议1, 建议2, 建议3
OVERALL_ASSESSMENT: 总体评估描述
=== END_VALIDATION ===

要求：
- 客观评估每个维度
- 指出具体问题和改进建议
- 分数要有依据
- 使用逗号分隔列表项
- 严格按照格式输出
`;

    try {
      const response = await this.llmService.generateText(validationPrompt, {
        temperature: 0.3,
        maxTokens: 600
      });

      return this.extractValidationReport(response || '', outline, params);
    } catch (error) {
      this.logger.warn('Failed to validate story outline, using basic validation', error as Error);
      return this.generateBasicValidationReport(outline, params);
    }
  }

  /**
   * 提取验证报告
   */
  private extractValidationReport(
    formattedText: string,
    outline: StoryOutline,
    params: StoryOutlineGenerationParams
  ): StoryOutlineResult['validationReport'] {
    try {
      const section = this.extractSectionBetweenMarkers(
        formattedText,
        '=== VALIDATION_REPORT ===',
        '=== END_VALIDATION ==='
      );
      
      if (!section) {
        throw new Error('Validation report section not found');
      }

      // 使用已存在的方法解析字段
      const lines = section.split('\n').filter(line => line.trim());
      const fields: Record<string, string> = {};
      
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          fields[key] = value;
        }
      }
      
      const coherenceScore = parseInt(fields['COHERENCE_SCORE']) || 70;
      const worldConsistency = parseInt(fields['WORLD_CONSISTENCY']) || 75;
      const playerEngagement = parseInt(fields['PLAYER_ENGAGEMENT']) || 80;
      const adaptabilityScore = parseInt(fields['ADAPTABILITY_SCORE']) || 75;
      
      const issues = this.parseCommaSeparatedList(fields['ISSUES'] || '');
      const recommendations = this.parseCommaSeparatedList(fields['RECOMMENDATIONS'] || '');
      
      return {
        coherenceScore: Math.max(0, Math.min(100, coherenceScore)),
        worldConsistency: Math.max(0, Math.min(100, worldConsistency)),
        playerEngagement: Math.max(0, Math.min(100, playerEngagement)),
        adaptabilityScore: Math.max(0, Math.min(100, adaptabilityScore)),
        issues: issues.length > 0 ? issues : [],
        recommendations: recommendations.length > 0 ? recommendations : []
      };
    } catch (error) {
      this.logger.warn('Failed to extract validation report', error as Error);
      return this.generateBasicValidationReport(outline, params);
    }
  }

  /**
   * 生成基础验证报告
   */
  private generateBasicValidationReport(
    outline: StoryOutline,
    params: StoryOutlineGenerationParams
  ): StoryOutlineResult['validationReport'] {
    let coherenceScore = 70;
    let worldConsistency = 75;
    let playerEngagement = 70;
    let adaptabilityScore = 70;
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 基于实际内容计算分数
    if (outline.acts.length >= 3) {
      coherenceScore += 10;
    } else {
      issues.push('章节数量偏少，可能影响故事发展');
      recommendations.push('考虑增加更多章节以丰富故事内容');
    }
    
    if (outline.plotPoints.length >= outline.acts.length * 3) {
      playerEngagement += 10;
    } else {
      issues.push('剧情点密度偏低');
      recommendations.push('为每个章节增加更多剧情点');
    }
    
    if (outline.characters.length >= 3) {
      worldConsistency += 10;
    } else {
      issues.push('角色数量偏少');
      recommendations.push('增加更多有趣的角色以丰富故事');
    }
    
    if (outline.directorGuidance.length > 0) {
      adaptabilityScore += 15;
    } else {
      issues.push('缺乏导演指导');
      recommendations.push('为关键剧情点添加导演指导');
    }
    
    if (outline.themes.length > 0) {
      coherenceScore += 5;
      worldConsistency += 5;
    }
    
    return {
      coherenceScore: Math.min(100, coherenceScore),
      worldConsistency: Math.min(100, worldConsistency),
      playerEngagement: Math.min(100, playerEngagement),
      adaptabilityScore: Math.min(100, adaptabilityScore),
      issues,
      recommendations
    };
  }

  /**
   * 保存剧情大纲到数据库
   */
  private async saveStoryOutline(result: StoryOutlineResult): Promise<void> {
    try {
      await this.databaseService.query(`
        INSERT INTO story_outlines_generated (
          id, session_id, world_lore_ids, story_outline, core_elements, 
          context_mapping, validation_report, generation_params, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        result.outline.id,
        result.outline.sessionId,
        [], // world_lore_ids - 可以后续添加
        JSON.stringify(result.outline),
        JSON.stringify(result.coreElements),
        JSON.stringify(result.directorIntegration),
        JSON.stringify(result.validationReport),
        JSON.stringify({}), // generation_params
        new Date()
      ]);
    } catch (error) {
      this.logger.warn('Failed to save story outline to database', error as Error);
      // 不抛出错误，因为核心功能仍然有效
    }
  }

  // 辅助方法
  private processActs(acts: any[], params: StoryOutlineGenerationParams): StoryAct[] {
    if (!acts || acts.length === 0) {
      return this.generateDefaultActs(params);
    }

    return acts.map((act: any, index: number) => ({
      id: `act_${index + 1}_${uuidv4()}`,
      actNumber: index + 1,
      title: act.title || `第${index + 1}章`,
      summary: act.summary || '',
      keyEvents: act.keyEvents || [],
      expectedOutcomes: act.expectedOutcomes || [],
      estimatedDuration: act.estimatedDuration || Math.floor((params.playerPreferences?.targetDuration || 90) / acts.length)
    }));
  }

  private generateDefaultActs(params: StoryOutlineGenerationParams): StoryAct[] {
    const totalDuration = params.playerPreferences?.targetDuration || 90;
    return [
      {
        id: `act_1_${uuidv4()}`,
        actNumber: 1,
        title: '开始',
        summary: '引入世界和角色，建立初始目标',
        keyEvents: ['角色介绍', '世界探索', '初始任务'],
        expectedOutcomes: ['熟悉环境', '建立关系', '明确目标'],
        estimatedDuration: Math.floor(totalDuration * 0.3)
      },
      {
        id: `act_2_${uuidv4()}`,
        actNumber: 2,
        title: '发展',
        summary: '深入探索，遇到挑战和冲突',
        keyEvents: ['主要挑战', '角色发展', '关键选择'],
        expectedOutcomes: ['技能提升', '故事推进', '关系深化'],
        estimatedDuration: Math.floor(totalDuration * 0.4)
      },
      {
        id: `act_3_${uuidv4()}`,
        actNumber: 3,
        title: '高潮与结局',
        summary: '面对最终挑战，达成结局',
        keyEvents: ['最终对抗', '重要决定', '故事结局'],
        expectedOutcomes: ['完成目标', '角色成长', '满意结局'],
        estimatedDuration: Math.floor(totalDuration * 0.3)
      }
    ];
  }

  private generateFallbackFramework(params: StoryOutlineGenerationParams): any {
    return {
      mainConflict: '探索新世界中的未知挑战',
      turningPoints: ['初入世界', '遇到困难', '获得帮助', '解决问题'],
      characterArcs: ['适应环境', '建立友谊', '个人成长'],
      acts: this.generateDefaultActs(params)
    };
  }

  /**
   * 从格式化文本中提取章节的剧情点
   */
  private extractActPlotPoints(
    formattedText: string,
    act: StoryAct,
    actNumber: number
  ): PlotPoint[] {
    try {
      const section = this.extractSectionBetweenMarkers(
        formattedText,
        '=== ACT_PLOT_POINTS ===',
        '=== END_PLOT_POINTS ==='
      );
      
      if (!section) {
        throw new Error('Act plot points section not found');
      }

      const lines = section.split('\n').filter(line => line.trim());
      const fields: Record<string, string> = {};
      
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          fields[key] = value;
        }
      }

      const plotCount = parseInt(fields.PLOT_COUNT || '4');
      const plotPoints: PlotPoint[] = [];
      
      for (let i = 1; i <= plotCount; i++) {
        const plotPoint: PlotPoint = {
          id: `plot_${actNumber}_${i}_${uuidv4()}`,
          actId: act.id,
          sequence: i,
          title: fields[`PLOT_${i}_TITLE`] || `${act.title} - 剧情点${i}`,
          description: fields[`PLOT_${i}_DESC`] || `第${i}个剧情点`,
          type: this.validatePlotPointType(fields[`PLOT_${i}_TYPE`]) || this.determinePlotPointType(i - 1, plotCount),
          expectedPlayerActions: this.parseCommaSeparatedList(fields[`PLOT_${i}_ACTIONS`] || ''),
          possibleOutcomes: this.parseCommaSeparatedList(fields[`PLOT_${i}_OUTCOMES`] || ''),
          directorNotes: fields[`PLOT_${i}_NOTES`] || '引导玩家完成目标'
        };
        plotPoints.push(plotPoint);
      }

      return plotPoints;
    } catch (error) {
      this.logger.warn(`Failed to extract plot points for act ${actNumber}, using fallback`, error as Error);
      return this.generateFallbackPlotPoints(act, actNumber);
    }
  }

  /**
   * 验证剧情点类型
   */
  private validatePlotPointType(type: string): PlotPoint['type'] | null {
    const validTypes: PlotPoint['type'][] = ['introduction', 'conflict', 'climax', 'resolution', 'transition'];
    return validTypes.includes(type as PlotPoint['type']) ? type as PlotPoint['type'] : null;
  }

  /**
   * 从格式化文本中提取导演指导
   */
  private extractDirectorGuidance(
    formattedText: string,
    plotPoint: PlotPoint
  ): DirectorGuidancePoint {
    try {
      const section = this.extractSectionBetweenMarkers(
        formattedText,
        '=== DIRECTOR_GUIDANCE ===',
        '=== END_GUIDANCE ==='
      );
      
      if (!section) {
        throw new Error('Director guidance section not found');
      }

      const lines = section.split('\n').filter(line => line.trim());
      const fields: Record<string, string> = {};
      
      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          fields[key] = value;
        }
      }

      return {
        id: `guidance_${plotPoint.id}`,
        plotPointId: plotPoint.id,
        guidance: fields.CORE_GUIDANCE || '根据情况灵活引导',
        interventionTriggers: this.parseCommaSeparatedList(fields.INTERVENTION_TRIGGERS || ''),
        suggestedApproaches: this.parseCommaSeparatedList(fields.SUGGESTED_APPROACHES || ''),
        backupPlans: this.parseCommaSeparatedList(fields.BACKUP_PLANS || '')
      };
    } catch (error) {
      this.logger.warn(`Failed to extract guidance for plot point ${plotPoint.id}`, error as Error);
      return this.generateFallbackGuidance(plotPoint);
    }
  }

  /**
   * 生成回退的导演指导
   */
  private generateFallbackGuidance(plotPoint: PlotPoint): DirectorGuidancePoint {
    const typeBasedGuidance = {
      'introduction': {
        guidance: '帮助玩家熟悉环境和角色，提供清晰的目标指向',
        triggers: ['玩家困惑', '长时间无行动', '误解目标'],
        approaches: ['环境描述', '角色介绍对话', '明确任务提示'],
        backups: ['提供向导角色', '简化初始目标', '增加环境线索']
      },
      'conflict': {
        guidance: '引导玩家面对挑战，提供多样化的解决方案',
        triggers: ['回避冲突', '选择困难', '策略错误'],
        approaches: ['展示后果', '提供选择提示', '角色建议'],
        backups: ['降低难度', '提供帮助', '开放新路径']
      },
      'climax': {
        guidance: '确保关键时刻的紧张感和玩家参与度',
        triggers: ['缺乏紧迫感', '选择犹豫', '偏离重点'],
        approaches: ['时间压力', '情感渲染', '关键信息'],
        backups: ['简化选择', '延长时间', '提供关键提示']
      },
      'resolution': {
        guidance: '帮助玩家完成目标，提供满足感和成就感',
        triggers: ['目标不明确', '缺乏成就感', '结局突兀'],
        approaches: ['成果展示', '角色反馈', '影响说明'],
        backups: ['补充结局', '增加奖励', '角色庆祝']
      },
      'transition': {
        guidance: '平滑过渡到下一阶段，保持故事连贯性',
        triggers: ['逻辑断层', '兴趣下降', '方向不明'],
        approaches: ['桥梁事件', '预告下文', '回顾总结'],
        backups: ['跳过细节', '直接转场', '角色说明']
      }
    };

    const guidance = typeBasedGuidance[plotPoint.type] || typeBasedGuidance['transition'];
    
    return {
      id: `guidance_${plotPoint.id}`,
      plotPointId: plotPoint.id,
      guidance: guidance.guidance,
      interventionTriggers: guidance.triggers,
      suggestedApproaches: guidance.approaches,
      backupPlans: guidance.backups
    };
  }

  /**
   * 生成回退的剧情点
   */
  private generateFallbackPlotPoints(act: StoryAct, actNumber: number): PlotPoint[] {
    return [
      {
        id: `plot_${actNumber}_1_${uuidv4()}`,
        actId: act.id,
        sequence: 1,
        title: `${act.title} - 开始`,
        description: `${act.title}的起始情节`,
        type: 'introduction',
        expectedPlayerActions: ['探索', '交谈', '观察'],
        possibleOutcomes: ['了解情况', '获得信息', '建立关系'],
        directorNotes: '引导玩家熟悉当前情境'
      }
    ];
  }

  private determinePlotPointType(index: number, total: number): PlotPoint['type'] {
    if (index === 0) return 'introduction';
    if (index === total - 1) return 'resolution';
    if (index === Math.floor(total * 0.7)) return 'climax';
    if (index < total * 0.3) return 'conflict';
    return 'transition';
  }

  private generateInterventionStrategy(gameMode: string): string {
    if (gameMode === 'script') {
      return '结构化引导：当玩家偏离预设路径时，使用环境暗示和角色对话进行引导';
    } else {
      return '灵活引导：保持故事方向的同时，允许玩家探索和创造性解决问题';
    }
  }

  private generateAdaptationNotes(outline: StoryOutline): string[] {
    return [
      '根据玩家选择调整后续剧情点',
      '保持核心主题不变的前提下允许路径变化',
      '记录玩家行为模式以优化引导策略',
      '准备备用情节分支以应对意外情况'
    ];
  }

  /**
   * 生成回退的角色列表
   */
  private generateFallbackCharacters(framework: any): StoryCharacter[] {
    return [
      {
        id: `character_1_${uuidv4()}`,
        name: '主角',
        role: 'protagonist',
        background: '一个勇敢的冒险者',
        motivations: ['探索世界', '完成任务', '保护他人'],
        relationships: {},
        appearanceActs: [1, 2, 3]
      },
      {
        id: `character_2_${uuidv4()}`,
        name: '向导',
        role: 'supporting',
        background: '经验丰富的向导',
        motivations: ['帮助主角', '保护家园'],
        relationships: {},
        appearanceActs: [1, 2]
      },
      {
        id: `character_3_${uuidv4()}`,
        name: '对手',
        role: 'antagonist',
        background: '神秘的反派角色',
        motivations: ['阻止主角', '实现个人目标'],
        relationships: {},
        appearanceActs: [2, 3]
      }
    ];
  }

  /**
   * 生成回退的地点列表
   */
  private generateFallbackLocations(framework: any): StoryLocation[] {
    return [
      {
        id: `location_1_${uuidv4()}`,
        name: '起始之地',
        type: '城镇',
        significance: 'major',
        description: '冒险开始的地方',
        usedInActs: [1]
      },
      {
        id: `location_2_${uuidv4()}`,
        name: '神秘森林',
        type: '自然环境',
        significance: 'major',
        description: '充满危险和机遇的森林',
        usedInActs: [2]
      },
      {
        id: `location_3_${uuidv4()}`,
        name: '最终目标',
        type: '特殊地点',
        significance: 'major',
        description: '故事的高潮发生地',
        usedInActs: [3]
      }
    ];
  }

  // 评分计算方法（简化版）
  private calculateCoherenceScore(outline: StoryOutline): number {
    let score = 70; // 基础分
    if (outline.acts.length >= 3) score += 10;
    if (outline.plotPoints.length >= outline.acts.length * 3) score += 10;
    if (outline.themes.length > 0) score += 10;
    return Math.min(100, score);
  }

  private calculateWorldConsistency(outline: StoryOutline, worldLore: WorldLore[]): number {
    // 简化的一致性检查
    return 85; // 默认高一致性
  }

  private calculateEngagementScore(outline: StoryOutline): number {
    let score = 70;
    if (outline.plotPoints.some(p => p.type === 'climax')) score += 15;
    if (outline.characters.length > 2) score += 10;
    if (outline.locations.length > 2) score += 5;
    return Math.min(100, score);
  }

  private calculateAdaptabilityScore(outline: StoryOutline): number {
    let score = 60;
    const hasMultipleOutcomes = outline.plotPoints.some(p => p.possibleOutcomes.length > 1);
    if (hasMultipleOutcomes) score += 20;
    if (outline.directorGuidance.some(g => g.backupPlans.length > 0)) score += 20;
    return Math.min(100, score);
  }
}