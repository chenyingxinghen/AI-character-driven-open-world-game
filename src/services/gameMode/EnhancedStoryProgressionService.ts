/**
 * 故事进展服务
 * 扩展现有的StoryProgressionService，增加游戏模式特定功能
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
import { StoryProgressionService as BaseStoryProgressionService } from '../game/StoryProgressionService';
import {
  StoryOutline,
  PlotPoint,
  StoryAct,
  DeviationRecord,
  InterventionRecord
} from '../../domains/gameMode/valueObjects';
import { StoryProgress } from '../../domains/gameMode/entities';

/**
 * 故事节奏分析结果
 */
export interface StoryPacingAnalysis {
  readonly currentPacing: 'slow' | 'normal' | 'fast' | 'rushed';
  readonly recommendedAdjustments: string[];
  readonly estimatedTimeToCompletion: number;
  readonly pacingScore: number; // 0-100
  readonly bottlenecks: string[];
}

/**
 * 剧情点完成分析
 */
export interface PlotPointCompletionAnalysis {
  readonly plotPointId: string;
  readonly completionSignals: string[];
  readonly completionConfidence: number; // 0-100
  readonly missingElements: string[];
  readonly nextSteps: string[];
}

/**
 * 故事质量评估
 */
export interface StoryQualityAssessment {
  readonly narrativeCoherence: number; // 0-100
  readonly characterDevelopment: number; // 0-100
  readonly plotProgression: number; // 0-100
  readonly playerEngagement: number; // 0-100
  readonly overallQuality: number; // 0-100
  readonly improvement_suggestions: string[];
}

/**
 * 增强的故事进展服务
 */
export class EnhancedStoryProgressionService extends BaseStoryProgressionService {
  private pacingHistory: StoryPacingAnalysis[] = [];
  private qualityAssessments: StoryQualityAssessment[] = [];
  private llmService: LLMService;
  private logger: Logger;

  constructor(
    llmService: LLMService,
    logger: Logger
  ) {
    super();
    this.llmService = llmService;
    this.logger = logger;
  }

  /**
   * 分析故事节奏
   */
  async analyzeStoryPacing(
    storyProgress: StoryProgress,
    recentActions: string[],
    timeSpent: number
  ): Promise<StoryPacingAnalysis> {
    this.logger.debug('Analyzing story pacing', {
      currentAct: storyProgress.getCurrentAct(),
      completion: storyProgress.getCompletionPercentage(),
      component: 'EnhancedStoryProgressionService'
    });

    const pacingPrompt = this.buildPacingAnalysisPrompt(
      storyProgress,
      recentActions,
      timeSpent
    );

    try {
      const pacingData = await this.llmService.generateStructuredResponse(
        pacingPrompt,
        this.getPacingAnalysisSchema(),
        {
          temperature: 0.3,
          maxTokens: 400
        }
      );

      const analysis = this.parsePacingAnalysis(pacingData, storyProgress, timeSpent);
      this.recordPacingAnalysis(analysis);
      
      return analysis;
    } catch (error) {
      this.logger.error('Failed to analyze story pacing', error as Error);
      return this.getDefaultPacingAnalysis(storyProgress, timeSpent);
    }
  }

  /**
   * 检测剧情点完成
   */
  async detectPlotPointCompletion(
    plotPoint: PlotPoint,
    playerActions: string[],
    gameState: any
  ): Promise<PlotPointCompletionAnalysis> {
    const completionPrompt = this.buildCompletionDetectionPrompt(
      plotPoint,
      playerActions,
      gameState
    );

    try {
      const completionData = await this.llmService.generateStructuredResponse(
        completionPrompt,
        this.getCompletionAnalysisSchema(),
        {
          temperature: 0.2,
          maxTokens: 300
        }
      );

      return this.parseCompletionAnalysis(completionData, plotPoint);
    } catch (error) {
      this.logger.error('Failed to detect plot point completion', error as Error);
      return this.getDefaultCompletionAnalysis(plotPoint);
    }
  }

  /**
   * 评估故事质量
   */
  async assessStoryQuality(
    storyProgress: StoryProgress,
    playerFeedback: string[],
    deviationHistory: DeviationRecord[],
    interventionHistory: InterventionRecord[]
  ): Promise<StoryQualityAssessment> {
    const qualityPrompt = this.buildQualityAssessmentPrompt(
      storyProgress,
      playerFeedback,
      deviationHistory,
      interventionHistory
    );

    try {
      const qualityData = await this.llmService.generateStructuredResponse(
        qualityPrompt,
        this.getQualityAssessmentSchema(),
        {
          temperature: 0.4,
          maxTokens: 500
        }
      );

      const assessment = this.parseQualityAssessment(qualityData);
      this.recordQualityAssessment(assessment);
      
      return assessment;
    } catch (error) {
      this.logger.error('Failed to assess story quality', error as Error);
      return this.getDefaultQualityAssessment();
    }
  }

  /**
   * 生成故事总结
   */
  async generateStorySummary(
    storyProgress: StoryProgress,
    keyEvents: string[]
  ): Promise<string> {
    const summaryPrompt = this.buildSummaryPrompt(storyProgress, keyEvents);

    try {
      const summary = await this.llmService.generateText(summaryPrompt, {
        temperature: 0.6,
        maxTokens: 300
      });

      return summary || '故事进展顺利，玩家体验了丰富的冒险。';
    } catch (error) {
      this.logger.error('Failed to generate story summary', error as Error);
      return '故事发展中包含了许多有趣的转折和挑战。';
    }
  }

  /**
   * 预测故事结局
   */
  async predictStoryEnding(
    storyProgress: StoryProgress,
    playerChoices: string[]
  ): Promise<{
    possibleEndings: string[];
    mostLikely: string;
    confidence: number;
  }> {
    const predictionPrompt = this.buildEndingPredictionPrompt(storyProgress, playerChoices);

    try {
      const predictionData = await this.llmService.generateStructuredResponse(
        predictionPrompt,
        this.getEndingPredictionSchema(),
        {
          temperature: 0.5,
          maxTokens: 400
        }
      );

      return {
        possibleEndings: predictionData.possibleEndings || ['开放式结局'],
        mostLikely: predictionData.mostLikely || '英雄式结局',
        confidence: predictionData.confidence || 60
      };
    } catch (error) {
      this.logger.error('Failed to predict story ending', error as Error);
      return {
        possibleEndings: ['开放式结局', '英雄式结局'],
        mostLikely: '英雄式结局',
        confidence: 50
      };
    }
  }

  /**
   * 获取节奏历史
   */
  getPacingHistory(limit: number = 10): StoryPacingAnalysis[] {
    return [...this.pacingHistory].slice(-limit);
  }

  /**
   * 获取质量评估历史
   */
  getQualityAssessmentHistory(limit: number = 5): StoryQualityAssessment[] {
    return [...this.qualityAssessments].slice(-limit);
  }

  /**
   * 生成改进建议
   */
  async generateImprovementSuggestions(
    storyProgress: StoryProgress,
    qualityAssessment: StoryQualityAssessment
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // 基于质量评估生成建议
    if (qualityAssessment.narrativeCoherence < 60) {
      suggestions.push('加强故事情节的连贯性，确保各个章节之间的逻辑关系');
    }

    if (qualityAssessment.characterDevelopment < 60) {
      suggestions.push('深化角色发展，增加角色间的互动和成长');
    }

    if (qualityAssessment.plotProgression < 60) {
      suggestions.push('优化剧情推进速度，平衡高潮和缓解部分');
    }

    if (qualityAssessment.playerEngagement < 60) {
      suggestions.push('增加玩家选择的重要性和后果的明确性');
    }

    // 基于完成度生成建议
    const completion = storyProgress.getCompletionPercentage();
    if (completion < 30) {
      suggestions.push('专注于推进主线剧情，避免过多支线干扰');
    } else if (completion > 80) {
      suggestions.push('准备故事收尾，确保所有重要线索得到解决');
    }

    return suggestions;
  }

  /**
   * 构建节奏分析提示
   */
  private buildPacingAnalysisPrompt(
    storyProgress: StoryProgress,
    recentActions: string[],
    timeSpent: number
  ): string {
    const outline = storyProgress.storyOutline;
    const currentAct = storyProgress.getCurrentAct();
    const completion = storyProgress.getCompletionPercentage();

    return `
分析故事节奏：

故事信息:
- 标题: ${outline.title}
- 当前章节: ${currentAct}/${outline.acts.length}
- 完成度: ${completion.toFixed(1)}%
- 已用时间: ${timeSpent}分钟
- 预计总时长: ${outline.estimatedDuration}分钟

最近行动:
${recentActions.slice(-5).map((action, i) => `${i + 1}. ${action}`).join('\n')}

请分析当前故事节奏，包括：
1. 节奏评估（慢/正常/快/急促）
2. 节奏调整建议
3. 预计剩余时间
4. 可能的瓶颈问题
`;
  }

  /**
   * 构建完成检测提示
   */
  private buildCompletionDetectionPrompt(
    plotPoint: PlotPoint,
    playerActions: string[],
    gameState: any
  ): string {
    return `
检测剧情点完成状态：

剧情点信息:
- 标题: ${plotPoint.title}
- 描述: ${plotPoint.description}
- 预期结果: ${plotPoint.expectedOutcomes.join(', ')}

玩家行动:
${playerActions.map((action, i) => `${i + 1}. ${action}`).join('\n')}

游戏状态:
${JSON.stringify(gameState, null, 2)}

请分析：
1. 剧情点是否已完成
2. 完成的信号和证据
3. 缺失的关键元素
4. 下一步建议
`;
  }

  /**
   * 构建质量评估提示
   */
  private buildQualityAssessmentPrompt(
    storyProgress: StoryProgress,
    playerFeedback: string[],
    deviationHistory: DeviationRecord[],
    interventionHistory: InterventionRecord[]
  ): string {
    return `
评估故事质量：

故事进展:
- 完成度: ${storyProgress.getCompletionPercentage().toFixed(1)}%
- 当前章节: ${storyProgress.getCurrentAct()}
- 已完成剧情点: ${storyProgress.getCompletedPlotPoints().length}

玩家反馈:
${playerFeedback.map(feedback => `- ${feedback}`).join('\n')}

偏离记录: ${deviationHistory.length}次
干预记录: ${interventionHistory.length}次

请评估故事质量的各个方面（0-100分）：
1. 叙事连贯性
2. 角色发展
3. 情节推进
4. 玩家参与度
5. 整体质量

并提供具体的改进建议。
`;
  }

  /**
   * 构建总结提示
   */
  private buildSummaryPrompt(storyProgress: StoryProgress, keyEvents: string[]): string {
    return `
生成故事总结：

故事: ${storyProgress.storyOutline.title}
当前进度: ${storyProgress.getCompletionPercentage().toFixed(1)}%

关键事件:
${keyEvents.map(event => `- ${event}`).join('\n')}

请生成一个简洁的故事总结，概括主要情节发展和角色经历。
`;
  }

  /**
   * 构建结局预测提示
   */
  private buildEndingPredictionPrompt(
    storyProgress: StoryProgress,
    playerChoices: string[]
  ): string {
    return `
预测故事结局：

故事信息:
- 标题: ${storyProgress.storyOutline.title}
- 类型: ${storyProgress.storyOutline.genre}
- 进度: ${storyProgress.getCompletionPercentage().toFixed(1)}%

玩家关键选择:
${playerChoices.map(choice => `- ${choice}`).join('\n')}

请预测可能的故事结局，包括：
1. 3-5个可能的结局
2. 最可能的结局
3. 预测置信度
`;
  }

  /**
   * 获取节奏分析数据结构
   */
  private getPacingAnalysisSchema(): any {
    return {
      type: 'object',
      properties: {
        currentPacing: { 
          type: 'string', 
          enum: ['slow', 'normal', 'fast', 'rushed'] 
        },
        recommendedAdjustments: {
          type: 'array',
          items: { type: 'string' }
        },
        estimatedTimeToCompletion: { type: 'number' },
        bottlenecks: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['currentPacing', 'estimatedTimeToCompletion']
    };
  }

  /**
   * 获取完成分析数据结构
   */
  private getCompletionAnalysisSchema(): any {
    return {
      type: 'object',
      properties: {
        completionSignals: {
          type: 'array',
          items: { type: 'string' }
        },
        completionConfidence: { type: 'number' },
        missingElements: {
          type: 'array',
          items: { type: 'string' }
        },
        nextSteps: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['completionConfidence']
    };
  }

  /**
   * 获取质量评估数据结构
   */
  private getQualityAssessmentSchema(): any {
    return {
      type: 'object',
      properties: {
        narrativeCoherence: { type: 'number' },
        characterDevelopment: { type: 'number' },
        plotProgression: { type: 'number' },
        playerEngagement: { type: 'number' },
        improvement_suggestions: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['narrativeCoherence', 'characterDevelopment', 'plotProgression', 'playerEngagement']
    };
  }

  /**
   * 获取结局预测数据结构
   */
  private getEndingPredictionSchema(): any {
    return {
      type: 'object',
      properties: {
        possibleEndings: {
          type: 'array',
          items: { type: 'string' }
        },
        mostLikely: { type: 'string' },
        confidence: { type: 'number' }
      },
      required: ['possibleEndings', 'mostLikely']
    };
  }

  /**
   * 解析节奏分析
   */
  private parsePacingAnalysis(
    pacingData: any,
    storyProgress: StoryProgress,
    timeSpent: number
  ): StoryPacingAnalysis {
    const expectedTime = storyProgress.storyOutline.estimatedDuration;
    const completion = storyProgress.getCompletionPercentage();
    const timeRatio = timeSpent / (expectedTime * completion / 100);
    
    let pacingScore = 100;
    if (timeRatio > 1.3) pacingScore -= 30; // 太慢
    if (timeRatio < 0.7) pacingScore -= 20; // 太快

    return {
      currentPacing: pacingData.currentPacing || 'normal',
      recommendedAdjustments: pacingData.recommendedAdjustments || [],
      estimatedTimeToCompletion: pacingData.estimatedTimeToCompletion || 
        (expectedTime - timeSpent),
      pacingScore: Math.max(0, pacingScore),
      bottlenecks: pacingData.bottlenecks || []
    };
  }

  /**
   * 解析完成分析
   */
  private parseCompletionAnalysis(
    completionData: any,
    plotPoint: PlotPoint
  ): PlotPointCompletionAnalysis {
    return {
      plotPointId: plotPoint.id,
      completionSignals: completionData.completionSignals || [],
      completionConfidence: completionData.completionConfidence || 0,
      missingElements: completionData.missingElements || [],
      nextSteps: completionData.nextSteps || []
    };
  }

  /**
   * 解析质量评估
   */
  private parseQualityAssessment(qualityData: any): StoryQualityAssessment {
    const scores = {
      narrativeCoherence: qualityData.narrativeCoherence || 50,
      characterDevelopment: qualityData.characterDevelopment || 50,
      plotProgression: qualityData.plotProgression || 50,
      playerEngagement: qualityData.playerEngagement || 50
    };

    const overallQuality = Object.values(scores).reduce((sum, score) => sum + score, 0) / 4;

    return {
      ...scores,
      overallQuality,
      improvement_suggestions: qualityData.improvement_suggestions || []
    };
  }

  /**
   * 记录节奏分析
   */
  private recordPacingAnalysis(analysis: StoryPacingAnalysis): void {
    this.pacingHistory.push(analysis);
    if (this.pacingHistory.length > 20) {
      this.pacingHistory = this.pacingHistory.slice(-20);
    }
  }

  /**
   * 记录质量评估
   */
  private recordQualityAssessment(assessment: StoryQualityAssessment): void {
    this.qualityAssessments.push(assessment);
    if (this.qualityAssessments.length > 10) {
      this.qualityAssessments = this.qualityAssessments.slice(-10);
    }
  }

  /**
   * 获取默认节奏分析
   */
  private getDefaultPacingAnalysis(
    storyProgress: StoryProgress,
    timeSpent: number
  ): StoryPacingAnalysis {
    const expectedTime = storyProgress.storyOutline.estimatedDuration;
    const completion = storyProgress.getCompletionPercentage();
    
    return {
      currentPacing: 'normal',
      recommendedAdjustments: ['保持当前节奏'],
      estimatedTimeToCompletion: expectedTime - timeSpent,
      pacingScore: 70,
      bottlenecks: []
    };
  }

  /**
   * 获取默认完成分析
   */
  private getDefaultCompletionAnalysis(plotPoint: PlotPoint): PlotPointCompletionAnalysis {
    return {
      plotPointId: plotPoint.id,
      completionSignals: [],
      completionConfidence: 50,
      missingElements: ['需要更多行动确认完成'],
      nextSteps: ['继续推进剧情']
    };
  }

  /**
   * 获取默认质量评估
   */
  private getDefaultQualityAssessment(): StoryQualityAssessment {
    return {
      narrativeCoherence: 70,
      characterDevelopment: 65,
      plotProgression: 70,
      playerEngagement: 68,
      overallQuality: 68,
      improvement_suggestions: ['继续保持当前故事发展']
    };
  }
}