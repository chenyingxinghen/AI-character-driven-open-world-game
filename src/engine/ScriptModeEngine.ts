/**
 * 剧本模式引擎
 * 负责处理剧本模式下的游戏逻辑，与导演引擎配合实现故事引导
 */

import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';
import { WorldManager } from '../domains/world/aggregates';
import { CharacterManager } from '../domains/character/aggregates';
import { GameModeDirectorEngine, IDirectorEngine, DirectorContext } from './GameModeDirectorEngine';
import {
  ScriptModeConfig,
  StoryOutline,
  PlotPoint,
  StoryAct,
  InterventionDecision
} from '../domains/gameMode/valueObjects';
import { StoryProgress, DirectorController } from '../domains/gameMode/entities';

/**
 * 剧本模式上下文
 */
export interface ScriptModeContext {
  readonly sessionId: string;
  readonly playerId: string;
  readonly currentLocation: string;
  readonly storyOutline: StoryOutline;
  readonly currentAct: number;
  readonly currentPlotPoint: PlotPoint | null;
  readonly completionPercentage: number;
  readonly deviationTolerance: number;
  readonly recentActions: string[];
  readonly storyVariables: Record<string, any>;
}

/**
 * 剧本模式响应
 */
export interface ScriptModeResponse {
  readonly responseText: string;
  readonly storyProgression: StoryProgressionInfo;
  readonly interventionApplied: boolean;
  readonly interventionDetails?: InterventionDecision;
  readonly plotPointUpdates: PlotPointUpdate[];
  readonly narrativeGuidance: string[];
}

/**
 * 故事进展信息
 */
export interface StoryProgressionInfo {
  readonly currentAct: number;
  readonly currentPlotPoint: PlotPoint | null;
  readonly completionPercentage: number;
  readonly nextMilestone: string;
  readonly estimatedTimeToCompletion: number;
}

/**
 * 剧情点更新
 */
export interface PlotPointUpdate {
  readonly plotPointId: string;
  readonly status: 'started' | 'progressed' | 'completed' | 'skipped';
  readonly progress: number;
  readonly notes: string;
}

/**
 * 剧本模式引擎接口
 */
export interface IScriptModeEngine {
  initialize(config: ScriptModeConfig, storyOutline: StoryOutline): Promise<void>;
  processAction(action: string, context: ScriptModeContext): Promise<ScriptModeResponse>;
  evaluateStoryProgress(context: ScriptModeContext): StoryProgressionInfo;
  suggestNextActions(context: ScriptModeContext): string[];
  handlePlotPointCompletion(plotPointId: string, context: ScriptModeContext): Promise<void>;
  getStoryGuidance(context: ScriptModeContext): string[];
}

/**
 * 剧本模式引擎实现
 */
export class ScriptModeEngine implements IScriptModeEngine {
  private config: ScriptModeConfig | null = null;
  private storyOutline: StoryOutline | null = null;
  private storyProgress: StoryProgress | null = null;
  private directorController: DirectorController | null = null;
  private directorEngine: IDirectorEngine;
  
  private actionTracker: Map<string, number> = new Map();
  private plotPointProgress: Map<string, number> = new Map();

  constructor(
    private llmService: LLMService,
    private worldManager: WorldManager,
    private characterManager: CharacterManager,
    private logger: Logger
  ) {
    this.directorEngine = new GameModeDirectorEngine(llmService, logger);
  }

  /**
   * 初始化剧本模式引擎
   */
  async initialize(config: ScriptModeConfig, storyOutline: StoryOutline): Promise<void> {
    this.logger.info('Initializing Script Mode Engine', {
      storyId: storyOutline.id,
      storyTitle: storyOutline.title,
      interventionLevel: config.directorInterventionLevel,
      component: 'ScriptModeEngine'
    });

    this.config = config;
    this.storyOutline = storyOutline;

    // 创建故事进展追踪器
    this.storyProgress = new StoryProgress(
      `progress_${Date.now()}`,
      'current_session',
      storyOutline
    );

    // 创建导演控制器
    this.directorController = new DirectorController(
      `director_${Date.now()}`,
      'current_session',
      config.directorInterventionLevel,
      config.storyDeviationTolerance
    );

    // 初始化导演引擎
    await this.directorEngine.initialize(this.storyProgress, this.directorController);

    // 初始化剧情点进度跟踪
    this.initializePlotPointTracking();

    this.logger.info('Script Mode Engine initialized successfully');
  }

  /**
   * 处理玩家行动
   */
  async processAction(action: string, context: ScriptModeContext): Promise<ScriptModeResponse> {
    if (!this.config || !this.storyOutline || !this.storyProgress || !this.directorController) {
      throw new Error('Script Mode Engine not properly initialized');
    }

    this.logger.debug('Processing script mode action', {
      action,
      currentAct: context.currentAct,
      currentPlotPoint: context.currentPlotPoint?.id,
      component: 'ScriptModeEngine'
    });

    // 更新行动追踪
    this.updateActionTracking(action);

    // 构建导演上下文
    const directorContext: DirectorContext = {
      sessionId: context.sessionId,
      playerId: context.playerId,
      currentLocation: context.currentLocation,
      recentActions: context.recentActions,
      timeElapsed: 0, // 简化实现
      currentPlotPoint: context.currentPlotPoint || undefined,
      gameVariables: context.storyVariables,
      characterStates: {}
    };

    // 评估玩家行动
    const evaluation = await this.directorEngine.evaluatePlayerAction(action, directorContext);

    // 生成基础响应
    let responseText = await this.generateNarrativeResponse(action, context, evaluation);

    // 处理干预（如果需要）
    let interventionApplied = false;
    let interventionDetails: InterventionDecision | undefined;

    if (evaluation.shouldIntervene && evaluation.recommendedIntervention) {
      const interventionResult = await this.directorEngine.applyIntervention(
        evaluation.recommendedIntervention,
        directorContext
      );

      if (interventionResult.success) {
        interventionApplied = true;
        interventionDetails = evaluation.recommendedIntervention;
        
        // 修改响应以包含干预效果
        responseText = this.applyInterventionToResponse(
          responseText,
          interventionResult.responseModifications
        );
      }
    }

    // 检查剧情点进展
    const plotPointUpdates = await this.checkPlotPointProgress(action, context);

    // 更新故事进展
    const storyProgression = this.evaluateStoryProgress(context);

    // 生成叙事指导
    const narrativeGuidance = await this.generateNarrativeGuidance(context, evaluation);

    return {
      responseText,
      storyProgression,
      interventionApplied,
      interventionDetails,
      plotPointUpdates,
      narrativeGuidance
    };
  }

  /**
   * 评估故事进展
   */
  evaluateStoryProgress(context: ScriptModeContext): StoryProgressionInfo {
    if (!this.storyProgress) {
      throw new Error('Story progress not initialized');
    }

    const currentAct = this.storyProgress.getCurrentAct();
    const currentPlotPoint = this.storyProgress.getCurrentPlotPoint();
    const completionPercentage = this.storyProgress.getCompletionPercentage();
    
    const nextMilestone = this.getNextMilestone(currentAct, currentPlotPoint);
    const estimatedTimeToCompletion = this.estimateTimeToCompletion(completionPercentage);

    return {
      currentAct,
      currentPlotPoint,
      completionPercentage,
      nextMilestone,
      estimatedTimeToCompletion
    };
  }

  /**
   * 建议下一步行动
   */
  suggestNextActions(context: ScriptModeContext): string[] {
    const suggestions: string[] = [];

    if (context.currentPlotPoint) {
      const plotPoint = context.currentPlotPoint;
      
      // 基于剧情点的预期结果生成建议
      for (const outcome of plotPoint.expectedOutcomes.slice(0, 3)) {
        suggestions.push(this.convertOutcomeToAction(outcome));
      }

      // 基于剧情点描述生成建议
      const contextualSuggestions = this.generateContextualSuggestions(plotPoint, context);
      suggestions.push(...contextualSuggestions.slice(0, 2));
    } else {
      // 没有当前剧情点时的通用建议
      suggestions.push('探索周围环境');
      suggestions.push('与附近的角色交谈');
      suggestions.push('查看物品栏');
    }

    return suggestions.slice(0, 5);
  }

  /**
   * 处理剧情点完成
   */
  async handlePlotPointCompletion(plotPointId: string, context: ScriptModeContext): Promise<void> {
    if (!this.storyProgress) return;

    this.logger.info('Handling plot point completion', {
      plotPointId,
      component: 'ScriptModeEngine'
    });

    // 标记剧情点为完成
    const success = this.storyProgress.completePlotPoint(plotPointId);
    
    if (success) {
      // 更新进度跟踪
      this.plotPointProgress.set(plotPointId, 100);

      // 检查是否完成了整个章节
      await this.checkActCompletion(context);

      // 生成完成事件
      await this.generateCompletionEvent(plotPointId, context);
    }
  }

  /**
   * 获取故事指导
   */
  getStoryGuidance(context: ScriptModeContext): string[] {
    const guidance: string[] = [];

    if (context.currentPlotPoint) {
      const progress = this.plotPointProgress.get(context.currentPlotPoint.id) || 0;
      
      if (progress < 25) {
        guidance.push('你刚刚开始这个故事情节，仔细观察周围的线索');
      } else if (progress < 75) {
        guidance.push('你正在推进这个故事情节，继续当前的探索方向');
      } else {
        guidance.push('你即将完成这个故事情节，专注于达成目标');
      }
    }

    // 基于偏离度给出指导
    const deviation = this.storyProgress?.calculateOverallDeviation() || 0;
    if (deviation > 50) {
      guidance.push('考虑回到主要故事线，关注核心目标');
    }

    return guidance;
  }

  /**
   * 初始化剧情点跟踪
   */
  private initializePlotPointTracking(): void {
    if (!this.storyOutline) return;

    for (const act of this.storyOutline.acts) {
      for (const plotPoint of act.plotPoints) {
        this.plotPointProgress.set(plotPoint.id, 0);
      }
    }
  }

  /**
   * 更新行动追踪
   */
  private updateActionTracking(action: string): void {
    const actionType = this.categorizeAction(action);
    const currentCount = this.actionTracker.get(actionType) || 0;
    this.actionTracker.set(actionType, currentCount + 1);
  }

  /**
   * 生成叙事响应
   */
  private async generateNarrativeResponse(
    action: string,
    context: ScriptModeContext,
    evaluation: any
  ): Promise<string> {
    const responsePrompt = this.buildNarrativePrompt(action, context, evaluation);

    try {
      const response = await this.llmService.generateText(responsePrompt, {
        temperature: 0.6, // 较低的温度以保持故事一致性
        maxTokens: 300
      });

      return response || this.getFallbackNarrativeResponse(action, context);
    } catch (error) {
      this.logger.error('Failed to generate narrative response', error as Error);
      return this.getFallbackNarrativeResponse(action, context);
    }
  }

  /**
   * 检查剧情点进展
   */
  private async checkPlotPointProgress(
    action: string,
    context: ScriptModeContext
  ): Promise<PlotPointUpdate[]> {
    const updates: PlotPointUpdate[] = [];

    if (!context.currentPlotPoint) return updates;

    const plotPointId = context.currentPlotPoint.id;
    const currentProgress = this.plotPointProgress.get(plotPointId) || 0;

    // 分析行动对剧情点的贡献
    const progressContribution = this.calculateProgressContribution(action, context.currentPlotPoint);
    const newProgress = Math.min(100, currentProgress + progressContribution);

    if (progressContribution > 0) {
      this.plotPointProgress.set(plotPointId, newProgress);
      
      let status: PlotPointUpdate['status'] = 'progressed';
      if (newProgress >= 100) {
        status = 'completed';
        await this.handlePlotPointCompletion(plotPointId, context);
      } else if (currentProgress === 0) {
        status = 'started';
      }

      updates.push({
        plotPointId,
        status,
        progress: newProgress,
        notes: `行动 "${action}" 推进了剧情 ${progressContribution}%`
      });
    }

    return updates;
  }

  /**
   * 生成叙事指导
   */
  private async generateNarrativeGuidance(
    context: ScriptModeContext,
    evaluation: any
  ): Promise<string[]> {
    const guidance: string[] = [];

    // 基于偏离程度生成指导
    if (evaluation.deviationScore > 70) {
      guidance.push('考虑专注于主要目标');
    } else if (evaluation.deviationScore > 40) {
      guidance.push('你可以探索更多与主线相关的内容');
    }

    // 基于故事风险生成指导
    if (evaluation.storyRisk === 'high' || evaluation.storyRisk === 'critical') {
      guidance.push('重要的故事时刻即将到来，请仔细考虑你的选择');
    }

    return guidance;
  }

  /**
   * 应用干预到响应
   */
  private applyInterventionToResponse(
    baseResponse: string,
    interventionModifications: string[]
  ): string {
    let modifiedResponse = baseResponse;

    for (const modification of interventionModifications) {
      modifiedResponse += `\n\n${modification}`;
    }

    return modifiedResponse;
  }

  /**
   * 获取下一个里程碑
   */
  private getNextMilestone(currentAct: number, currentPlotPoint: PlotPoint | null): string {
    if (!this.storyOutline) return '故事继续';

    if (currentPlotPoint) {
      return `完成：${currentPlotPoint.title}`;
    }

    if (currentAct <= this.storyOutline.acts.length) {
      const act = this.storyOutline.acts[currentAct - 1];
      return `进入：${act.title}`;
    }

    return '故事结局';
  }

  /**
   * 估算完成时间
   */
  private estimateTimeToCompletion(completionPercentage: number): number {
    if (!this.storyOutline) return 0;

    const totalEstimatedTime = this.storyOutline.estimatedDuration;
    const remainingPercentage = 100 - completionPercentage;
    
    return Math.round((totalEstimatedTime * remainingPercentage) / 100);
  }

  /**
   * 将结果转换为行动
   */
  private convertOutcomeToAction(outcome: string): string {
    // 简化的转换逻辑
    const actionMappings: Record<string, string> = {
      'examine': '仔细检查',
      'investigate': '深入调查',
      'discover': '尝试发现',
      'talk': '进行对话',
      'explore': '探索周围'
    };

    for (const [key, value] of Object.entries(actionMappings)) {
      if (outcome.toLowerCase().includes(key)) {
        return value;
      }
    }

    return `尝试 ${outcome}`;
  }

  /**
   * 生成情境建议
   */
  private generateContextualSuggestions(plotPoint: PlotPoint, context: ScriptModeContext): string[] {
    const suggestions: string[] = [];

    // 基于剧情点描述生成建议
    if (plotPoint.description.includes('寻找')) {
      suggestions.push('仔细搜索这个区域');
    }
    
    if (plotPoint.description.includes('对话')) {
      suggestions.push('与关键角色交谈');
    }

    if (plotPoint.description.includes('解决')) {
      suggestions.push('分析当前的问题');
    }

    return suggestions;
  }

  /**
   * 检查章节完成
   */
  private async checkActCompletion(context: ScriptModeContext): Promise<void> {
    if (!this.storyOutline || !this.storyProgress) return;

    const currentAct = this.storyProgress.getCurrentAct();
    if (currentAct <= this.storyOutline.acts.length) {
      const act = this.storyOutline.acts[currentAct - 1];
      const actPlotPoints = act.plotPoints;
      const completedPoints = this.storyProgress.getCompletedPlotPoints();
      
      const actCompleted = actPlotPoints.every(point => 
        completedPoints.includes(point.id)
      );

      if (actCompleted) {
        this.logger.info('Act completed', {
          actId: act.id,
          actTitle: act.title,
          component: 'ScriptModeEngine'
        });

        // 可以在这里触发章节完成事件
        await this.generateActCompletionEvent(act, context);
      }
    }
  }

  /**
   * 生成完成事件
   */
  private async generateCompletionEvent(plotPointId: string, context: ScriptModeContext): Promise<void> {
    this.logger.info('Generating completion event', {
      plotPointId,
      component: 'ScriptModeEngine'
    });

    // 这里可以生成特殊的完成事件或奖励
  }

  /**
   * 生成章节完成事件
   */
  private async generateActCompletionEvent(act: any, context: ScriptModeContext): Promise<void> {
    this.logger.info('Generating act completion event', {
      actId: act.id,
      component: 'ScriptModeEngine'
    });

    // 这里可以生成章节完成的特殊事件
  }

  /**
   * 分类行动
   */
  private categorizeAction(action: string): string {
    const actionLower = action.toLowerCase();
    
    if (actionLower.includes('说') || actionLower.includes('对话')) return 'dialogue';
    if (actionLower.includes('看') || actionLower.includes('检查')) return 'examination';
    if (actionLower.includes('走') || actionLower.includes('移动')) return 'movement';
    if (actionLower.includes('拿') || actionLower.includes('使用')) return 'interaction';
    if (actionLower.includes('攻击') || actionLower.includes('战斗')) return 'combat';
    
    return 'other';
  }

  /**
   * 计算进展贡献
   */
  private calculateProgressContribution(action: string, plotPoint: PlotPoint): number {
    // 简化的贡献计算
    let contribution = 0;

    // 检查行动是否匹配预期结果
    const actionLower = action.toLowerCase();
    for (const outcome of plotPoint.expectedOutcomes) {
      if (actionLower.includes(outcome.toLowerCase())) {
        contribution += 20; // 匹配预期结果给予较高贡献
      }
    }

    // 基于行动类型给予基础贡献
    if (contribution === 0) {
      contribution = 5; // 任何行动都有基础贡献
    }

    return Math.min(25, contribution); // 单次行动最多贡献25%
  }

  /**
   * 构建叙事提示
   */
  private buildNarrativePrompt(action: string, context: ScriptModeContext, evaluation: any): string {
    return `
作为叙事AI，基于以下信息生成故事响应：

故事: ${context.storyOutline.title}
当前章节: ${context.currentAct} - ${context.storyOutline.acts[context.currentAct - 1]?.title}
当前剧情点: ${context.currentPlotPoint?.title || '自由探索'}
完成度: ${context.completionPercentage.toFixed(1)}%

玩家行动: ${action}
当前位置: ${context.currentLocation}
偏离度: ${evaluation.deviationScore}

请生成一个符合故事风格和当前剧情的响应，保持叙事连贯性：
`;
  }

  /**
   * 获取备用叙事响应
   */
  private getFallbackNarrativeResponse(action: string, context: ScriptModeContext): string {
    const responses = [
      `你的行动推进了${context.storyOutline.title}的故事...`,
      '故事在你的选择中继续展开...',
      '你的决定为故事带来了新的转折...',
      '故事的下一章在你面前展现...'
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }
}