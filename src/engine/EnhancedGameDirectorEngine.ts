/**
 * 增强游戏导演引擎
 * 支持基于剧情大纲的引导和干预
 */

import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';
import { DatabaseService } from '../services/database/DatabaseService';
import { StoryOutline, PlotPoint, DirectorGuidancePoint } from '../services/gameMode/StoryOutlineGeneratorService';
import { OperationsManager } from '../domains/operations/aggregates';

export interface DirectorDecision {
  action: string;
  reasoning: string;
  confidence: number;
  parameters: Record<string, any>;
  interventionType?: 'guidance' | 'redirection' | 'enhancement' | 'none';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

export interface StoryEvaluation {
  tensionLevel: number;
  paceRating: number;
  conflictPresent: boolean;
  suggestedActions: string[];
  deviationFromScript: number;
  lastSignificantEvent?: Date;
  plotPointProgress: number; // 当前剧情点的完成度
  playerEngagement: number; // 玩家参与度
  storyCoherence: number; // 故事连贯性
}

export interface PlayerBehaviorAnalysis {
  recentActions: string[];
  actionPattern: 'exploring' | 'conversing' | 'progressing' | 'stuck' | 'deviating';
  engagementLevel: 'high' | 'medium' | 'low';
  preferredInteractionStyle: 'dialogue' | 'action' | 'exploration' | 'mixed';
  currentFocus: string;
  timeSinceLastAction: number; // 毫秒
}

export interface DirectorContext {
  sessionId: string;
  currentStoryOutline?: StoryOutline;
  currentPlotPoint?: PlotPoint;
  playerBehavior: PlayerBehaviorAnalysis;
  worldState: Record<string, any>;
  gameMode: 'free' | 'script' | 'guided_free';
  interventionHistory: DirectorInterventionRecord[];
}

export interface DirectorInterventionRecord {
  id: string;
  timestamp: Date;
  type: string;
  trigger: string;
  action: string;
  effectiveness: number;
  playerReaction: string;
}

export interface GuidanceStrategy {
  approach: 'subtle' | 'direct' | 'environmental' | 'character_driven';
  intensity: 'light' | 'moderate' | 'strong';
  timing: 'immediate' | 'delayed' | 'contextual';
  fallbackOptions: string[];
}

export class EnhancedGameDirectorEngine {
  private operationsManager: OperationsManager;
  private interventionCooldowns: Map<string, number> = new Map();
  private lastEvaluation?: StoryEvaluation;

  constructor(
    private llmService: LLMService,
    private databaseService: DatabaseService,
    private logger: Logger
  ) {
    this.operationsManager = new OperationsManager(logger);
  }

  /**
   * 评估当前故事进展并决定是否需要导演干预
   */
  async evaluateStoryProgressionWithOutline(context: DirectorContext): Promise<{
    evaluation: StoryEvaluation;
    decision: DirectorDecision;
    guidance?: GuidanceStrategy;
  }> {
    try {
      const startTime = Date.now();
      
      // 1. 分析当前故事状况
      const evaluation = await this.analyzeCurrentStoryState(context);
      
      // 2. 评估玩家行为
      const behaviorAnalysis = await this.analyzePlayerBehavior(context.playerBehavior, context);
      
      // 3. 检查是否需要干预
      const interventionNeed = this.assessInterventionNeed(evaluation, behaviorAnalysis, context);
      
      // 4. 生成导演决策
      const decision = await this.generateDirectorDecision(evaluation, interventionNeed, context);
      
      // 5. 制定引导策略（如果需要）
      const guidance = interventionNeed.shouldIntervene ? 
        await this.createGuidanceStrategy(decision, context) : undefined;

      // 记录性能指标
      this.operationsManager.recordPerformance({
        operation: 'story_evaluation_with_outline',
        executionTime: Date.now() - startTime,
        memoryUsage: typeof process !== 'undefined' ? (process as any).memoryUsage().heapUsed : 0,
        cpuUsage: 0,
        timestamp: new Date(),
        success: true
      });

      this.lastEvaluation = evaluation;

      return { evaluation, decision, guidance };
    } catch (error) {
      this.logger.error('Error evaluating story progression with outline:', error as Error);
      
      // 记录错误
      this.operationsManager.recordError({
        id: `error-${Date.now()}`,
        type: 'enhanced_director_evaluation_error',
        message: (error as Error).message,
        stackTrace: (error as Error).stack,
        context: { operation: 'evaluateStoryProgressionWithOutline', sessionId: context.sessionId },
        severity: 'medium',
        timestamp: new Date(),
        resolved: false
      });

      // 返回保守的评估和决策
      return {
        evaluation: this.createFallbackEvaluation(),
        decision: this.createFallbackDecision(),
        guidance: undefined
      };
    }
  }

  /**
   * 基于剧情大纲生成引导建议
   */
  async generateStoryGuidance(
    currentPlotPoint: PlotPoint,
    playerAction: string,
    context: DirectorContext
  ): Promise<{
    guidance: string;
    interventionTriggers: string[];
    adaptationSuggestions: string[];
  }> {
    const guidancePrompt = `
基于当前剧情点为玩家行为提供导演指导：

当前剧情点：${currentPlotPoint.title}
剧情描述：${currentPlotPoint.description}
预期玩家行为：${currentPlotPoint.expectedPlayerActions.join(', ')}
实际玩家行为：${playerAction}

玩家行为模式：${context.playerBehavior.actionPattern}
游戏模式：${context.gameMode}

请生成：
1. 具体的引导建议（如何微妙地引导玩家）
2. 需要干预的触发条件
3. 如果玩家继续偏离的适应建议

保持引导的自然性和沉浸感。

返回JSON格式：
{
  "guidance": "具体引导建议",
  "interventionTriggers": ["触发条件1", "触发条件2"],
  "adaptationSuggestions": ["适应建议1", "适应建议2"]
}
`;

    try {
      const response = await this.llmService.generateText(guidancePrompt, {
        temperature: 0.6,
        maxTokens: 600
      });

      const guidanceData = JSON.parse(response || '{}');
      
      return {
        guidance: guidanceData.guidance || '继续观察玩家行为，准备适时引导',
        interventionTriggers: guidanceData.interventionTriggers || ['明显偏离主线', '长时间无进展'],
        adaptationSuggestions: guidanceData.adaptationSuggestions || ['提供环境线索', '引入新角色']
      };
    } catch (error) {
      this.logger.warn('Failed to generate story guidance, using fallback', error as Error);
      return {
        guidance: '根据玩家行为灵活调整引导策略',
        interventionTriggers: ['严重偏离剧情', '玩家困惑表现'],
        adaptationSuggestions: ['提供更直接的线索', '调整剧情节奏']
      };
    }
  }

  /**
   * 执行导演干预
   */
  async executeDirectorIntervention(
    decision: DirectorDecision,
    guidance: GuidanceStrategy,
    context: DirectorContext
  ): Promise<{
    success: boolean;
    interventionContent: string;
    expectedOutcome: string;
    followUpActions: string[];
  }> {
    try {
      this.logger.info('Executing director intervention', {
        sessionId: context.sessionId,
        interventionType: decision.interventionType,
        approach: guidance.approach,
        component: 'EnhancedGameDirectorEngine'
      });

      // 生成干预内容
      const interventionContent = await this.generateInterventionContent(decision, guidance, context);
      
      // 记录干预
      await this.recordIntervention(decision, guidance, context, interventionContent);
      
      // 设置冷却期
      this.setInterventionCooldown(decision.interventionType || 'guidance', context.sessionId);
      
      return {
        success: true,
        interventionContent,
        expectedOutcome: this.predictInterventionOutcome(decision, guidance, context),
        followUpActions: this.generateFollowUpActions(decision, guidance, context)
      };
    } catch (error) {
      this.logger.error('Failed to execute director intervention', error as Error);
      return {
        success: false,
        interventionContent: '系统正在观察情况，稍后提供指导',
        expectedOutcome: '维持当前状态',
        followUpActions: ['继续监控']
      };
    }
  }

  /**
   * 分析当前故事状态
   */
  private async analyzeCurrentStoryState(context: DirectorContext): Promise<StoryEvaluation> {
    let plotPointProgress = 50; // 默认值
    let storyCoherence = 80;
    
    // 如果有剧情大纲，进行更详细的分析
    if (context.currentStoryOutline && context.currentPlotPoint) {
      const storyAnalysisPrompt = `
分析当前故事状态：

故事标题：${context.currentStoryOutline.title}
当前剧情点：${context.currentPlotPoint.title}
剧情描述：${context.currentPlotPoint.description}
预期结果：${context.currentPlotPoint.possibleOutcomes.join(', ')}

玩家最近行为：${context.playerBehavior.recentActions.join(', ')}
行为模式：${context.playerBehavior.actionPattern}

请评估（0-100）：
1. 当前剧情点完成度
2. 故事连贯性
3. 紧张度水平
4. 节奏评分
5. 玩家参与度

返回JSON格式的评分。
`;

      try {
        const response = await this.llmService.generateText(storyAnalysisPrompt, {
          temperature: 0.3,
          maxTokens: 400
        });

        const analysis = JSON.parse(response || '{}');
        plotPointProgress = analysis.plotPointProgress || 50;
        storyCoherence = analysis.storyCoherence || 80;
      } catch (error) {
        this.logger.warn('Failed to analyze story state with LLM, using defaults', error as Error);
      }
    }

    return {
      tensionLevel: this.calculateTensionLevel(context),
      paceRating: this.calculatePaceRating(context),
      conflictPresent: this.detectConflict(context),
      suggestedActions: this.generateSuggestedActions(context),
      deviationFromScript: this.calculateDeviation(context),
      plotPointProgress,
      playerEngagement: this.calculatePlayerEngagement(context),
      storyCoherence
    };
  }

  /**
   * 分析玩家行为
   */
  private async analyzePlayerBehavior(
    behavior: PlayerBehaviorAnalysis, 
    context: DirectorContext
  ): Promise<{
    isEngaged: boolean;
    needsGuidance: boolean;
    preferredApproach: string;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const isEngaged = behavior.engagementLevel !== 'low' && behavior.timeSinceLastAction < 120000; // 2分钟
    const needsGuidance = behavior.actionPattern === 'stuck' || behavior.actionPattern === 'deviating';
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (behavior.actionPattern === 'deviating') riskLevel = 'high';
    else if (behavior.actionPattern === 'stuck') riskLevel = 'medium';

    return {
      isEngaged,
      needsGuidance,
      preferredApproach: behavior.preferredInteractionStyle,
      riskLevel
    };
  }

  /**
   * 评估干预需求
   */
  private assessInterventionNeed(
    evaluation: StoryEvaluation,
    behaviorAnalysis: any,
    context: DirectorContext
  ): { shouldIntervene: boolean; urgency: string; reason: string } {
    let shouldIntervene = false;
    let urgency = 'low';
    let reason = '';

    // 检查各种干预触发条件
    if (evaluation.deviationFromScript > 70) {
      shouldIntervene = true;
      urgency = 'high';
      reason = '严重偏离剧情';
    } else if (behaviorAnalysis.riskLevel === 'high') {
      shouldIntervene = true;
      urgency = 'medium';
      reason = '玩家行为风险较高';
    } else if (evaluation.plotPointProgress < 20 && behaviorAnalysis.needsGuidance) {
      shouldIntervene = true;
      urgency = 'medium';
      reason = '剧情进展缓慢且玩家需要指导';
    } else if (!behaviorAnalysis.isEngaged) {
      shouldIntervene = true;
      urgency = 'low';
      reason = '玩家参与度下降';
    }

    // 检查冷却期
    const lastIntervention = this.getLastInterventionTime(context.sessionId);
    if (lastIntervention && Date.now() - lastIntervention < 300000) { // 5分钟冷却
      shouldIntervene = false;
      reason = '干预冷却期中';
    }

    return { shouldIntervene, urgency, reason };
  }

  /**
   * 生成导演决策
   */
  private async generateDirectorDecision(
    evaluation: StoryEvaluation,
    interventionNeed: any,
    context: DirectorContext
  ): Promise<DirectorDecision> {
    if (!interventionNeed.shouldIntervene) {
      return {
        action: 'continue_observation',
        reasoning: '当前状况良好，继续观察',
        confidence: 90,
        parameters: {},
        interventionType: 'none',
        urgency: 'low'
      };
    }

    // 基于评估结果决定干预类型
    let action = 'provide_guidance';
    let interventionType: DirectorDecision['interventionType'] = 'guidance';

    if (evaluation.deviationFromScript > 80) {
      action = 'redirect_story';
      interventionType = 'redirection';
    } else if (evaluation.playerEngagement < 40) {
      action = 'enhance_engagement';
      interventionType = 'enhancement';
    }

    return {
      action,
      reasoning: `基于${interventionNeed.reason}，建议采取${interventionType}措施`,
      confidence: Math.min(95, 60 + evaluation.storyCoherence / 2),
      parameters: {
        targetArea: this.identifyTargetArea(evaluation, context),
        intensity: this.calculateInterventionIntensity(evaluation),
        approach: context.playerBehavior.preferredInteractionStyle
      },
      interventionType,
      urgency: interventionNeed.urgency
    };
  }

  /**
   * 创建引导策略
   */
  private async createGuidanceStrategy(
    decision: DirectorDecision,
    context: DirectorContext
  ): Promise<GuidanceStrategy> {
    const intensity = decision.urgency === 'high' ? 'strong' : 
                     decision.urgency === 'medium' ? 'moderate' : 'light';

    let approach: GuidanceStrategy['approach'] = 'subtle';
    if (context.playerBehavior.preferredInteractionStyle === 'dialogue') {
      approach = 'character_driven';
    } else if (context.playerBehavior.actionPattern === 'exploring') {
      approach = 'environmental';
    } else if (intensity === 'strong') {
      approach = 'direct';
    }

    return {
      approach,
      intensity,
      timing: decision.urgency === 'high' ? 'immediate' : 'contextual',
      fallbackOptions: this.generateFallbackOptions(decision, context)
    };
  }

  // 辅助方法
  private calculateTensionLevel(context: DirectorContext): number {
    let tension = 40; // 基础值
    if (context.currentPlotPoint?.type === 'climax') tension += 30;
    if (context.playerBehavior.actionPattern === 'stuck') tension += 20;
    return Math.min(100, tension);
  }

  private calculatePaceRating(context: DirectorContext): number {
    const recentActionCount = context.playerBehavior.recentActions.length;
    return Math.min(100, recentActionCount * 20);
  }

  private detectConflict(context: DirectorContext): boolean {
    return context.worldState.activeConflicts?.length > 0 || false;
  }

  private generateSuggestedActions(context: DirectorContext): string[] {
    const actions = ['continue_story'];
    if (context.currentPlotPoint) {
      actions.push(...context.currentPlotPoint.expectedPlayerActions);
    }
    return actions;
  }

  private calculateDeviation(context: DirectorContext): number {
    if (!context.currentPlotPoint) return 0;
    
    const expectedActions = context.currentPlotPoint.expectedPlayerActions;
    const recentActions = context.playerBehavior.recentActions;
    
    const matchCount = recentActions.filter(action => 
      expectedActions.some(expected => action.toLowerCase().includes(expected.toLowerCase()))
    ).length;
    
    const deviationScore = Math.max(0, 100 - (matchCount / Math.max(1, expectedActions.length)) * 100);
    return deviationScore;
  }

  private calculatePlayerEngagement(context: DirectorContext): number {
    let engagement = 60; // 基础值
    
    if (context.playerBehavior.engagementLevel === 'high') engagement += 30;
    else if (context.playerBehavior.engagementLevel === 'low') engagement -= 30;
    
    if (context.playerBehavior.timeSinceLastAction < 30000) engagement += 10; // 最近有活动
    else if (context.playerBehavior.timeSinceLastAction > 180000) engagement -= 20; // 超过3分钟无活动
    
    return Math.max(0, Math.min(100, engagement));
  }

  private createFallbackEvaluation(): StoryEvaluation {
    return {
      tensionLevel: 50,
      paceRating: 50,
      conflictPresent: false,
      suggestedActions: ['continue'],
      deviationFromScript: 20,
      plotPointProgress: 50,
      playerEngagement: 60,
      storyCoherence: 70
    };
  }

  private createFallbackDecision(): DirectorDecision {
    return {
      action: 'continue_observation',
      reasoning: '系统评估中，继续观察',
      confidence: 50,
      parameters: {},
      interventionType: 'none',
      urgency: 'low'
    };
  }

  private async generateInterventionContent(
    decision: DirectorDecision,
    guidance: GuidanceStrategy,
    context: DirectorContext
  ): Promise<string> {
    // 简化的干预内容生成
    switch (decision.interventionType) {
      case 'guidance':
        return '系统检测到你可能需要一些指导...';
      case 'redirection':
        return '也许是时候重新考虑你的选择了...';
      case 'enhancement':
        return '周围似乎有更有趣的事情等待探索...';
      default:
        return '继续你的冒险吧！';
    }
  }

  private async recordIntervention(
    decision: DirectorDecision,
    guidance: GuidanceStrategy,
    context: DirectorContext,
    content: string
  ): Promise<void> {
    try {
      await this.databaseService.query(`
        INSERT INTO director_guidance_records (
          id, session_id, guidance_type, guidance_content, applied_at
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        `guidance_${Date.now()}`,
        context.sessionId,
        decision.interventionType || 'guidance',
        content,
        new Date()
      ]);
    } catch (error) {
      this.logger.warn('Failed to record intervention in database', error as Error);
    }
  }

  private setInterventionCooldown(type: string, sessionId: string): void {
    const key = `${sessionId}_${type}`;
    this.interventionCooldowns.set(key, Date.now());
  }

  private getLastInterventionTime(sessionId: string): number | null {
    const times = Array.from(this.interventionCooldowns.entries())
      .filter(([key]) => key.startsWith(sessionId))
      .map(([, time]) => time);
    
    return times.length > 0 ? Math.max(...times) : null;
  }

  private identifyTargetArea(evaluation: StoryEvaluation, context: DirectorContext): string {
    if (evaluation.deviationFromScript > 60) return 'story_direction';
    if (evaluation.playerEngagement < 50) return 'engagement';
    if (evaluation.plotPointProgress < 30) return 'progression';
    return 'general_guidance';
  }

  private calculateInterventionIntensity(evaluation: StoryEvaluation): string {
    if (evaluation.deviationFromScript > 80 || evaluation.playerEngagement < 30) return 'high';
    if (evaluation.deviationFromScript > 50 || evaluation.playerEngagement < 60) return 'medium';
    return 'low';
  }

  private generateFallbackOptions(decision: DirectorDecision, context: DirectorContext): string[] {
    return [
      'environmental_hint',
      'character_dialogue',
      'system_message',
      'continue_observation'
    ];
  }

  private predictInterventionOutcome(decision: DirectorDecision, guidance: GuidanceStrategy, context: DirectorContext): string {
    return `预期通过${guidance.approach}方式的${guidance.intensity}干预来${decision.action}`;
  }

  private generateFollowUpActions(decision: DirectorDecision, guidance: GuidanceStrategy, context: DirectorContext): string[] {
    return [
      'monitor_player_response',
      'assess_effectiveness',
      'prepare_backup_intervention'
    ];
  }
}