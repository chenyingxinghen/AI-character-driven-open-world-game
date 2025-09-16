/**
 * 游戏导演引擎
 * 专门负责剧本模式中的智能导演功能，监控玩家行为并进行适当干预
 */

import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';
import {
  InterventionType,
  InterventionIntensity,
  InterventionDecision,
  DeviationRecord,
  InterventionRecord,
  PlotPoint
} from '../domains/gameMode/valueObjects';
import { StoryProgress, DirectorController } from '../domains/gameMode/entities';
import { InterventionDecisionService, DeviationAnalysisService } from '../domains/gameMode/services';

/**
 * 导演引擎接口
 */
export interface IDirectorEngine {
  initialize(storyProgress: StoryProgress, directorController: DirectorController): Promise<void>;
  evaluatePlayerAction(action: string, context: DirectorContext): Promise<DirectorEvaluation>;
  applyIntervention(decision: InterventionDecision, context: DirectorContext): Promise<InterventionResult>;
  updateStoryState(updates: StoryStateUpdate): void;
  getPerformanceMetrics(): DirectorMetrics;
}

/**
 * 导演上下文
 */
export interface DirectorContext {
  readonly sessionId: string;
  readonly playerId: string;
  readonly currentLocation: string;
  readonly recentActions: string[];
  readonly timeElapsed: number;
  readonly currentPlotPoint?: PlotPoint;
  readonly gameVariables: Record<string, any>;
  readonly characterStates: Record<string, any>;
}

/**
 * 导演评估结果
 */
export interface DirectorEvaluation {
  readonly deviationScore: number;
  readonly shouldIntervene: boolean;
  readonly recommendedIntervention?: InterventionDecision;
  readonly storyRisk: 'low' | 'medium' | 'high' | 'critical';
  readonly analysisNotes: string[];
}

/**
 * 干预结果
 */
export interface InterventionResult {
  readonly success: boolean;
  readonly appliedInterventions: string[];
  readonly responseModifications: string[];
  readonly followUpActions: string[];
  readonly effectiveness: number;
  readonly sideEffects: string[];
}

/**
 * 故事状态更新
 */
export interface StoryStateUpdate {
  readonly completedPlotPoints?: string[];
  readonly newStoryVariables?: Record<string, any>;
  readonly characterUpdates?: Record<string, any>;
  readonly environmentChanges?: Record<string, any>;
}

/**
 * 导演性能指标
 */
export interface DirectorMetrics {
  totalInterventions: number;
  successfulInterventions: number;
  averageDeviationReduction: number;
  playerSatisfaction: number;
  storyCoherence: number;
  interventionEfficiency: number;
}

/**
 * 游戏导演引擎实现
 */
export class GameModeDirectorEngine implements IDirectorEngine {
  private storyProgress: StoryProgress | null = null;
  private directorController: DirectorController | null = null;
  private interventionService: InterventionDecisionService;
  private deviationService: DeviationAnalysisService;
  
  private performanceMetrics: DirectorMetrics = {
    totalInterventions: 0,
    successfulInterventions: 0,
    averageDeviationReduction: 0,
    playerSatisfaction: 75,
    storyCoherence: 80,
    interventionEfficiency: 70
  };

  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {
    this.interventionService = new InterventionDecisionService(logger);
    this.deviationService = new DeviationAnalysisService(logger);
  }

  /**
   * 初始化导演引擎
   */
  async initialize(storyProgress: StoryProgress, directorController: DirectorController): Promise<void> {
    this.logger.info('Initializing Director Engine', {
      storyId: storyProgress.storyOutline.id,
      interventionLevel: directorController.interventionLevel,
      component: 'GameDirectorEngine'
    });

    this.storyProgress = storyProgress;
    this.directorController = directorController;

    // 重置性能指标
    this.performanceMetrics = {
      totalInterventions: 0,
      successfulInterventions: 0,
      averageDeviationReduction: 0,
      playerSatisfaction: 75,
      storyCoherence: 80,
      interventionEfficiency: 70
    };

    this.logger.info('Director Engine initialized successfully');
  }

  /**
   * 评估玩家行动
   */
  async evaluatePlayerAction(action: string, context: DirectorContext): Promise<DirectorEvaluation> {
    if (!this.storyProgress || !this.directorController) {
      throw new Error('Director Engine not properly initialized');
    }

    this.logger.debug('Evaluating player action', {
      action,
      sessionId: context.sessionId,
      component: 'GameDirectorEngine'
    });

    const currentPlotPoint = this.storyProgress.getCurrentPlotPoint();
    const expectedAction = this.getExpectedAction(currentPlotPoint, context);

    // 计算偏离度
    const deviationScore = this.deviationService.calculateDeviation(
      action,
      expectedAction,
      currentPlotPoint,
      {
        recentActions: context.recentActions,
        completedPlotPoints: this.storyProgress.getCompletedPlotPoints(),
        storyVariables: new Map(Object.entries(context.gameVariables))
      }
    );

    // 评估故事风险
    const storyRisk = this.assessStoryRisk(deviationScore, context);

    // 确定是否需要干预
    const shouldIntervene = this.directorController.shouldIntervene(
      deviationScore,
      this.storyProgress.getInterventionHistory(5)
    );

    let recommendedIntervention: InterventionDecision | undefined;
    if (shouldIntervene) {
      recommendedIntervention = this.interventionService.evaluateInterventionNeed(
        deviationScore,
        this.directorController,
        this.storyProgress,
        {
          playerAction: action,
          currentPlotPoint: currentPlotPoint || undefined,
          recentActions: context.recentActions
        }
      );
    }

    const analysisNotes = this.generateAnalysisNotes(
      action,
      deviationScore,
      storyRisk,
      context
    );

    return {
      deviationScore,
      shouldIntervene,
      recommendedIntervention,
      storyRisk,
      analysisNotes
    };
  }

  /**
   * 应用干预
   */
  async applyIntervention(
    decision: InterventionDecision,
    context: DirectorContext
  ): Promise<InterventionResult> {
    if (!this.storyProgress || !this.directorController) {
      throw new Error('Director Engine not properly initialized');
    }

    this.logger.info('Applying intervention', {
      type: decision.interventionType,
      intensity: decision.intensity,
      sessionId: context.sessionId,
      component: 'GameDirectorEngine'
    });

    const appliedInterventions: string[] = [];
    const responseModifications: string[] = [];
    const followUpActions: string[] = [];
    const sideEffects: string[] = [];

    try {
      // 根据干预类型执行具体干预
      switch (decision.interventionType) {
        case InterventionType.EVENT_GENERATION:
          await this.applyEventGeneration(decision, context, appliedInterventions, responseModifications);
          break;
        case InterventionType.DIALOGUE_GUIDANCE:
          await this.applyDialogueGuidance(decision, context, appliedInterventions, responseModifications);
          break;
        case InterventionType.INFORMATION_INTERFERENCE:
          await this.applyInformationInterference(decision, context, appliedInterventions, responseModifications);
          break;
        case InterventionType.ENVIRONMENT_CONTROL:
          await this.applyEnvironmentControl(decision, context, appliedInterventions, responseModifications);
          break;
      }

      // 记录干预
      const interventionRecord: InterventionRecord = {
        id: `intervention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        interventionType: decision.interventionType,
        intensity: decision.intensity,
        trigger: decision.reasoning,
        outcome: 'successful',
        effectiveness: decision.estimatedEffectiveness,
        playerReaction: 'pending', // 需要后续观察
        notes: appliedInterventions.join('; ')
      };

      this.storyProgress.recordIntervention(interventionRecord);
      this.directorController.recordIntervention();

      // 设置冷却时间
      this.directorController.setInterventionCooldown(
        decision.interventionType,
        this.calculateCooldownDuration(decision.intensity)
      );

      // 更新性能指标
      this.updatePerformanceMetrics(true, decision.estimatedEffectiveness);

      return {
        success: true,
        appliedInterventions,
        responseModifications,
        followUpActions,
        effectiveness: decision.estimatedEffectiveness,
        sideEffects
      };
    } catch (error) {
      this.logger.error('Failed to apply intervention', error as Error, {
        decision,
        context,
        component: 'GameDirectorEngine'
      });

      this.updatePerformanceMetrics(false, 0);

      return {
        success: false,
        appliedInterventions: [],
        responseModifications: ['干预应用失败，使用默认响应'],
        followUpActions: [],
        effectiveness: 0,
        sideEffects: ['系统干预失败']
      };
    }
  }

  /**
   * 更新故事状态
   */
  updateStoryState(updates: StoryStateUpdate): void {
    if (!this.storyProgress) return;

    this.logger.debug('Updating story state', {
      updates,
      component: 'GameDirectorEngine'
    });

    // 更新完成的剧情点
    if (updates.completedPlotPoints) {
      for (const plotPointId of updates.completedPlotPoints) {
        this.storyProgress.completePlotPoint(plotPointId);
      }
    }

    // 更新故事变量
    if (updates.newStoryVariables) {
      for (const [key, value] of Object.entries(updates.newStoryVariables)) {
        this.storyProgress.setStoryVariable(key, value);
      }
    }

    this.logger.debug('Story state updated successfully');
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): DirectorMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * 获取预期行动
   */
  private getExpectedAction(plotPoint: PlotPoint | null, context: DirectorContext): string {
    if (!plotPoint) {
      return 'continue exploring';
    }

    // 基于当前剧情点和上下文生成预期行动
    if (plotPoint.expectedOutcomes.length > 0) {
      return plotPoint.expectedOutcomes[0];
    }

    // 根据剧情点描述生成预期行动
    return this.generateExpectedActionFromDescription(plotPoint.description);
  }

  /**
   * 评估故事风险
   */
  private assessStoryRisk(
    deviationScore: number,
    context: DirectorContext
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (deviationScore < 25) return 'low';
    if (deviationScore < 50) return 'medium';
    if (deviationScore < 75) return 'high';
    return 'critical';
  }

  /**
   * 生成分析笔记
   */
  private generateAnalysisNotes(
    action: string,
    deviationScore: number,
    storyRisk: string,
    context: DirectorContext
  ): string[] {
    const notes: string[] = [];

    notes.push(`偏离度评分: ${deviationScore.toFixed(1)}`);
    notes.push(`故事风险等级: ${storyRisk}`);
    
    if (deviationScore > 50) {
      notes.push('玩家行为显著偏离预期故事路径');
    }

    if (context.recentActions.length > 3) {
      notes.push('玩家表现出一致的行为模式');
    }

    if (context.currentPlotPoint) {
      notes.push(`当前剧情点: ${context.currentPlotPoint.title}`);
    }

    return notes;
  }

  /**
   * 应用事件生成干预
   */
  private async applyEventGeneration(
    decision: InterventionDecision,
    context: DirectorContext,
    appliedInterventions: string[],
    responseModifications: string[]
  ): Promise<void> {
    const eventPrompt = this.buildEventGenerationPrompt(decision, context);
    
    try {
      const generatedEvent = await this.llmService.generateText(eventPrompt, {
        temperature: 0.7,
        maxTokens: 200
      });

      if (generatedEvent) {
        appliedInterventions.push('event_generation');
        responseModifications.push(`突发事件: ${generatedEvent}`);
      }
    } catch (error) {
      this.logger.error('Failed to generate intervention event', error as Error);
      responseModifications.push('周围环境发生了一些变化...');
    }
  }

  /**
   * 应用对话引导干预
   */
  private async applyDialogueGuidance(
    decision: InterventionDecision,
    context: DirectorContext,
    appliedInterventions: string[],
    responseModifications: string[]
  ): Promise<void> {
    const dialoguePrompt = this.buildDialogueGuidancePrompt(decision, context);
    
    try {
      const guidanceDialogue = await this.llmService.generateText(dialoguePrompt, {
        temperature: 0.6,
        maxTokens: 150
      });

      if (guidanceDialogue) {
        appliedInterventions.push('dialogue_guidance');
        responseModifications.push(`引导对话: ${guidanceDialogue}`);
      }
    } catch (error) {
      this.logger.error('Failed to generate guidance dialogue', error as Error);
      responseModifications.push('附近的某人似乎想要告诉你什么...');
    }
  }

  /**
   * 应用信息干扰干预
   */
  private async applyInformationInterference(
    decision: InterventionDecision,
    context: DirectorContext,
    appliedInterventions: string[],
    responseModifications: string[]
  ): Promise<void> {
    appliedInterventions.push('information_interference');
    
    switch (decision.intensity) {
      case InterventionIntensity.SUBTLE:
        responseModifications.push('你隐约感觉到一些重要的细节...');
        break;
      case InterventionIntensity.MODERATE:
        responseModifications.push('某些信息突然变得清晰起来...');
        break;
      case InterventionIntensity.STRONG:
        responseModifications.push('你突然想起了一个重要的线索...');
        break;
      case InterventionIntensity.FORCED:
        responseModifications.push('一个关键信息强烈地冲击着你的意识...');
        break;
    }
  }

  /**
   * 应用环境控制干预
   */
  private async applyEnvironmentControl(
    decision: InterventionDecision,
    context: DirectorContext,
    appliedInterventions: string[],
    responseModifications: string[]
  ): Promise<void> {
    appliedInterventions.push('environment_control');
    
    const environmentChanges = [
      '天空中的云层开始聚集，预示着变化的到来',
      '远处传来了神秘的声音',
      '环境中的光线发生了微妙的变化',
      '一条之前没有注意到的路径出现在视野中',
      '周围的氛围变得更加紧张'
    ];

    const selectedChange = environmentChanges[Math.floor(Math.random() * environmentChanges.length)];
    responseModifications.push(`环境变化: ${selectedChange}`);
  }

  /**
   * 构建事件生成提示
   */
  private buildEventGenerationPrompt(decision: InterventionDecision, context: DirectorContext): string {
    return `
基于以下信息生成一个适当的游戏事件来引导故事发展：

当前情境: ${context.currentLocation}
玩家最近行动: ${context.recentActions.slice(-3).join(', ')}
干预原因: ${decision.reasoning}
期望结果: 引导玩家回到主要故事线

请生成一个简短但有效的事件描述（不超过100字）：
`;
  }

  /**
   * 构建对话引导提示
   */
  private buildDialogueGuidancePrompt(decision: InterventionDecision, context: DirectorContext): string {
    return `
生成一段引导性对话来帮助玩家理解故事方向：

当前情境: ${context.currentLocation}
干预强度: ${decision.intensity}
目标: 温和地引导玩家关注主要故事线

请生成一段简短的NPC对话（不超过80字）：
`;
  }

  /**
   * 从描述生成预期行动
   */
  private generateExpectedActionFromDescription(description: string): string {
    // 简化的实现，实际应该使用更复杂的NLP技术
    if (description.includes('寻找') || description.includes('发现')) {
      return 'search and investigate';
    }
    if (description.includes('对话') || description.includes('交谈')) {
      return 'engage in conversation';
    }
    if (description.includes('前往') || description.includes('移动')) {
      return 'move to location';
    }
    return 'continue story progression';
  }

  /**
   * 计算冷却时间
   */
  private calculateCooldownDuration(intensity: InterventionIntensity): number {
    switch (intensity) {
      case InterventionIntensity.SUBTLE:
        return 60000; // 1分钟
      case InterventionIntensity.MODERATE:
        return 120000; // 2分钟
      case InterventionIntensity.STRONG:
        return 300000; // 5分钟
      case InterventionIntensity.FORCED:
        return 600000; // 10分钟
      default:
        return 60000;
    }
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(success: boolean, effectiveness: number): void {
    this.performanceMetrics.totalInterventions++;
    
    if (success) {
      this.performanceMetrics.successfulInterventions++;
    }

    // 更新平均偏离度减少（简化计算）
    const currentReduction = this.performanceMetrics.averageDeviationReduction;
    this.performanceMetrics.averageDeviationReduction = 
      (currentReduction + effectiveness) / 2;

    // 更新干预效率
    this.performanceMetrics.interventionEfficiency = 
      (this.performanceMetrics.successfulInterventions / this.performanceMetrics.totalInterventions) * 100;
  }
}