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
import { JsonUtils } from '../../utils/JsonUtils';
import { promptManager } from '../../prompts';

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
  private plotPointCache: Map<string, PlotPoint[]> = new Map(); // sessionId -> active plot points

  constructor(
    private llmService: LLMService,
    private worldLoreService: WorldLoreService,
    private databaseService: DatabaseService,
    private logger: Logger
  ) {
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

      // 8. 更新缓存
      this.plotPointCache.set(params.sessionId, storyOutline.plotPoints);

      // 9. 保存到数据库
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

    const analysisPrompt = promptManager.generate('story.analyze_world_lore', {
      combinedLore
    });

    try {
      const response = await this.llmService.generateText(analysisPrompt, {
        temperature: 0.3,
        maxTokens: 800,
        jsonMode: true
      });

      return JsonUtils.extractJson<any>(response || '{}');
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
    const frameworkPrompt = promptManager.generate('story.generate_framework', {
      gameMode: params.gameMode || 'script',
      preferredGenre: params.playerPreferences?.preferredGenre || '冒险',
      targetDuration: params.playerPreferences?.targetDuration || 90,
      keyElements: worldAnalysis.keyElements,
      tone: worldAnalysis.tone
    });

    try {
      const response = await this.llmService.generateText(frameworkPrompt, {
        temperature: 0.7,
        maxTokens: 1500,
        jsonMode: true
      });

      const data = JsonUtils.extractJson<any>(response || '{}');

      // 为 acts 补齐必要信息（如 ID 和预估时长）
      const acts = (data.acts || []).map((act: any, index: number) => ({
        ...act,
        id: uuidv4(),
        actNumber: index + 1,
        estimatedDuration: Math.floor((params.playerPreferences?.targetDuration || 90) / (data.acts?.length || 3))
      }));

      return {
        mainConflict: data.mainConflict || '探索未知的挑战',
        turningPoints: data.turningPoints || [],
        characterArcs: data.characterArcs || [],
        acts
      };
    } catch (error) {
      this.logger.warn('Failed to generate story framework, using fallback', error as Error);
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
    const actsInfo = framework.acts.map((act: StoryAct, index: number) =>
      `ACT ${index + 1}: ${act.title} - ${act.summary}\nKEY EVENTS: ${act.keyEvents.join(', ')}`
    ).join('\n\n');

    const prompt = promptManager.generate('story.generate_plot_points', {
      actsInfo
    });
    const template = promptManager.getTemplate('story.generate_plot_points');
    const systemPrompt = template?.systemPrompt;

    try {
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.6,
        maxTokens: 4000,
        jsonMode: true,
        systemPrompt
      });

      const data = JsonUtils.extractJson<any>(response || '{}');
      const allPoints: PlotPoint[] = [];

      for (const actGroup of (data.allPlotPoints || [])) {
        const actIndex = actGroup.actNumber - 1;
        const act = framework.acts[actIndex];
        if (!act) continue;

        const points = (actGroup.points || []).map((pp: any, index: number) => ({
          ...pp,
          id: uuidv4(),
          actId: act.id,
          sequence: index + 1
        }));
        allPoints.push(...points);
      }

      // 兜底逻辑：如果某些Act缺失，单独补齐（极少发生）
      if (allPoints.length === 0) {
        throw new Error("No plot points generated in batch mode");
      }

      return allPoints;
    } catch (error) {
      this.logger.warn(`Batch plot point generation failed, using individual fallback`, error as Error);
      // 回滚到原始的逐个生成逻辑（作为鲁棒性兜底）
      const fallbackPoints: PlotPoint[] = [];
      for (let i = 0; i < framework.acts.length; i++) {
        const actPoints = await this.generateActPlotPoints(framework.acts[i], i + 1, params);
        fallbackPoints.push(...actPoints);
      }
      return fallbackPoints;
    }
  }

  /**
   * 为单个章节生成剧情点 (作为批量失败后的兜底)
   */
  private async generateActPlotPoints(
    act: StoryAct,
    actNumber: number,
    params: StoryOutlineGenerationParams
  ): Promise<PlotPoint[]> {
    const plotPointPrompt = promptManager.generate('story.generate_act_plot_points', {
      title: act.title,
      summary: act.summary,
      keyEvents: act.keyEvents
    });

    try {
      const response = await this.llmService.generateText(plotPointPrompt, {
        temperature: 0.6,
        maxTokens: 1500,
        jsonMode: true
      });

      const data = JsonUtils.extractJson<any>(response || '{}');
      return (data.plotPoints || []).map((pp: any, index: number) => ({
        ...pp,
        id: uuidv4(),
        actId: act.id,
        sequence: index + 1
      }));
    } catch (error) {
      return this.generateFallbackPlotPoints(act, actNumber);
    }
  }

  /**
   * 生成导演指导 (批量模式)
   */
  private async generateDirectorGuidance(
    plotPoints: PlotPoint[],
    worldAnalysis: any
  ): Promise<DirectorGuidancePoint[]> {
    const pointsInfo = plotPoints.map(p =>
      `[${p.id}] "${p.title}": ${p.description} (Type: ${p.type})`
    ).join('\n');

    const prompt = promptManager.generate('story.generate_director_guidance', {
      worldAnalysis: JSON.stringify(worldAnalysis).substring(0, 1000),
      pointsInfo
    });
    const template = promptManager.getTemplate('story.generate_director_guidance');
    const systemPrompt = template?.systemPrompt;

    try {
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.4,
        maxTokens: 4000,
        jsonMode: true,
        systemPrompt
      });

      const data = JsonUtils.extractJson<any>(response || '{}');
      return (data.guidanceList || []).map((item: any) => ({
        ...item,
        id: uuidv4()
      }));
    } catch (error) {
      this.logger.error('Batch director guidance failed, using individual fallback:', error as Error);
      const guidance: DirectorGuidancePoint[] = [];
      for (const plotPoint of plotPoints) {
        guidance.push(await this.generatePlotPointGuidance(plotPoint, worldAnalysis));
      }
      return guidance;
    }
  }

  /**
   * 为单个剧情点生成指导 (作为批量失败后的兜底)
   */
  private async generatePlotPointGuidance(
    plotPoint: PlotPoint,
    worldAnalysis: any
  ): Promise<DirectorGuidancePoint> {
    const guidancePrompt = promptManager.generate('story.generate_plot_point_guidance_individual', { title: plotPoint.title });
    try {
      const response = await this.llmService.generateText(guidancePrompt, { jsonMode: true });
      const data = JsonUtils.extractJson<any>(response || '{}');
      return {
        id: uuidv4(),
        plotPointId: plotPoint.id,
        guidance: data.guidance || '保持叙事连贯',
        interventionTriggers: data.interventionTriggers || [],
        suggestedApproaches: data.suggestedApproaches || [],
        backupPlans: data.backupPlans || []
      };
    } catch (error) {
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
      id: uuidv4(),
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
    const validationPrompt = promptManager.generate('story.validate_outline', {
      title: outline.title,
      genre: outline.genre,
      actsCount: outline.acts.length,
      pointsCount: outline.plotPoints.length
    });

    try {
      const response = await this.llmService.generateText(validationPrompt, {
        temperature: 0.3,
        maxTokens: 1000,
        jsonMode: true
      });

      return JsonUtils.extractJson<any>(response || '{}');
    } catch (error) {
      this.logger.warn('Failed to validate story outline, using basic validation', error as Error);
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
   * 匹配剧情点 (由管道层调用)
   */
  async matchPlotPoint(sessionId: string, currentContext: any): Promise<PlotPoint | null> {
    const activePoints = this.plotPointCache.get(sessionId);
    if (!activePoints || activePoints.length === 0) return null;

    // 这里通常会调用 LLM 来判断当前上下文是否命中了某个剧情点
    this.logger.debug(`Matching context against ${activePoints.length} plot points`);

    // 实际生产中应使用 LLM 做语义匹配，这里暂回首个点作为占位
    return activePoints[0];
  }

  /**
   * 清理缓存
   */
  cleanupCache(sessionId: string): void {
    this.plotPointCache.delete(sessionId);
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
      id: uuidv4(),
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
        id: uuidv4(),
        actNumber: 1,
        title: '开始',
        summary: '引入世界和角色，建立初始目标',
        keyEvents: ['角色介绍', '世界探索', '初始任务'],
        expectedOutcomes: ['熟悉环境', '建立关系', '明确目标'],
        estimatedDuration: Math.floor(totalDuration * 0.3)
      },
      {
        id: uuidv4(),
        actNumber: 2,
        title: '发展',
        summary: '深入探索，遇到挑战和冲突',
        keyEvents: ['主要挑战', '角色发展', '关键选择'],
        expectedOutcomes: ['技能提升', '故事推进', '关系深化'],
        estimatedDuration: Math.floor(totalDuration * 0.4)
      },
      {
        id: uuidv4(),
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
      id: uuidv4(),
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
        id: uuidv4(),
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
        id: uuidv4(),
        name: '主角',
        role: 'protagonist',
        background: '一个勇敢的冒险者',
        motivations: ['探索世界', '完成任务', '保护他人'],
        relationships: {},
        appearanceActs: [1, 2, 3]
      },
      {
        id: uuidv4(),
        name: '向导',
        role: 'supporting',
        background: '经验丰富的向导',
        motivations: ['帮助主角', '保护家园'],
        relationships: {},
        appearanceActs: [1, 2]
      },
      {
        id: uuidv4(),
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
        id: uuidv4(),
        name: '起始之地',
        type: '城镇',
        significance: 'major',
        description: '冒险开始的地方',
        usedInActs: [1]
      },
      {
        id: uuidv4(),
        name: '神秘森林',
        type: '自然环境',
        significance: 'major',
        description: '充满危险和机遇的森林',
        usedInActs: [2]
      },
      {
        id: uuidv4(),
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