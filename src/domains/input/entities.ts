/**
 * 输入域实体
 * 这些是有身份的业务对象，包含输入域的核心业务逻辑
 */

import { 
  InputClassification, 
  ContextHistory, 
  ConversationTurn,
  PreprocessedInput,
  ComplexScenarioAnalysis,
  ChoiceDetectionResult 
} from './valueObjects';

/**
 * 输入会话实体
 * 管理单个会话中的输入历史和上下文
 */
export class InputSession {
  private conversationHistory: ConversationTurn[] = [];
  private topicHistory: string[] = [];
  private turnCounter: number = 0;

  constructor(
    public readonly sessionId: string,
    public readonly playerId: string,
    public readonly startTime: Date = new Date()
  ) {}

  /**
   * 添加对话轮次
   */
  addConversationTurn(
    playerInput: string,
    classification: InputClassification,
    systemResponse: string
  ): ConversationTurn {
    this.turnCounter++;
    
    const turn: ConversationTurn = {
      id: `turn_${this.sessionId}_${this.turnCounter}`,
      playerInput,
      classification,
      systemResponse,
      timestamp: new Date(),
      turnNumber: this.turnCounter
    };

    this.conversationHistory.push(turn);
    
    // 保持历史记录在合理大小
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-25);
    }

    // 更新话题历史
    if (classification.intent !== 'unknown') {
      this.topicHistory.push(classification.intent);
      if (this.topicHistory.length > 20) {
        this.topicHistory = this.topicHistory.slice(-10);
      }
    }

    return turn;
  }

  /**
   * 获取上下文历史
   */
  getContextHistory(recentCount: number = 5): ContextHistory {
    const recentTurns = this.conversationHistory.slice(-recentCount);
    
    return {
      recentInputs: recentTurns.map(turn => turn.playerInput),
      recentClassifications: recentTurns.map(turn => turn.classification),
      conversationFlow: recentTurns,
      topicProgression: this.topicHistory.slice(-10)
    };
  }

  /**
   * 获取最近的输入
   */
  getRecentInputs(count: number = 3): string[] {
    return this.conversationHistory
      .slice(-count)
      .map(turn => turn.playerInput);
  }

  /**
   * 获取最近的分类结果
   */
  getRecentClassifications(count: number = 3): InputClassification[] {
    return this.conversationHistory
      .slice(-count)
      .map(turn => turn.classification);
  }

  /**
   * 分析对话模式
   */
  analyzeConversationPatterns(): {
    dominantIntents: string[];
    averageComplexity: number;
    emotionalProgression: string[];
    engagementLevel: number;
  } {
    if (this.conversationHistory.length === 0) {
      return {
        dominantIntents: [],
        averageComplexity: 0,
        emotionalProgression: [],
        engagementLevel: 0
      };
    }

    // 分析主要意图
    const intentCounts: Record<string, number> = {};
    let totalComplexity = 0;
    const emotions: string[] = [];

    for (const turn of this.conversationHistory) {
      const intent = turn.classification.intent;
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
      totalComplexity += turn.classification.complexity;
      emotions.push(turn.classification.emotionalTone);
    }

    const dominantIntents = Object.entries(intentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([intent]) => intent);

    const averageComplexity = totalComplexity / this.conversationHistory.length;
    
    // 计算参与度（基于输入长度和频率）
    const avgInputLength = this.conversationHistory.reduce(
      (sum, turn) => sum + turn.playerInput.length, 0
    ) / this.conversationHistory.length;
    const engagementLevel = Math.min(100, (avgInputLength / 10) + (this.turnCounter / 2));

    return {
      dominantIntents,
      averageComplexity,
      emotionalProgression: emotions.slice(-10),
      engagementLevel
    };
  }

  /**
   * 清理会话历史
   */
  cleanup(): void {
    // 保留最近的重要对话
    this.conversationHistory = this.conversationHistory.slice(-10);
    this.topicHistory = this.topicHistory.slice(-10);
  }
}

/**
 * 输入分类器实体
 * 执行输入分类的核心逻辑
 */
export class InputClassifier {
  private classificationHistory: Map<string, InputClassification[]> = new Map();

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly version: string
  ) {}

  /**
   * 记录分类结果
   */
  recordClassification(sessionId: string, classification: InputClassification): void {
    if (!this.classificationHistory.has(sessionId)) {
      this.classificationHistory.set(sessionId, []);
    }

    const history = this.classificationHistory.get(sessionId)!;
    history.push(classification);

    // 保持历史记录在合理大小
    if (history.length > 100) {
      this.classificationHistory.set(sessionId, history.slice(-50));
    }
  }

  /**
   * 获取分类历史
   */
  getClassificationHistory(sessionId: string): InputClassification[] {
    return this.classificationHistory.get(sessionId) || [];
  }

  /**
   * 分析分类器性能
   */
  analyzePerformance(): {
    totalClassifications: number;
    averageConfidence: number;
    intentDistribution: Record<string, number>;
    complexityDistribution: Record<string, number>;
  } {
    let totalClassifications = 0;
    let totalConfidence = 0;
    const intentCounts: Record<string, number> = {};
    const complexityRanges: Record<string, number> = {
      low: 0,      // 1-3
      medium: 0,   // 4-6
      high: 0      // 7-10
    };

    for (const sessionHistory of this.classificationHistory.values()) {
      for (const classification of sessionHistory) {
        totalClassifications++;
        totalConfidence += classification.confidence;
        
        const intent = classification.intent;
        intentCounts[intent] = (intentCounts[intent] || 0) + 1;

        if (classification.complexity <= 3) {
          complexityRanges.low++;
        } else if (classification.complexity <= 6) {
          complexityRanges.medium++;
        } else {
          complexityRanges.high++;
        }
      }
    }

    return {
      totalClassifications,
      averageConfidence: totalClassifications > 0 ? totalConfidence / totalClassifications : 0,
      intentDistribution: intentCounts,
      complexityDistribution: complexityRanges
    };
  }

  /**
   * 清理分类历史
   */
  cleanupHistory(sessionId?: string): void {
    if (sessionId) {
      const history = this.classificationHistory.get(sessionId);
      if (history) {
        this.classificationHistory.set(sessionId, history.slice(-20));
      }
    } else {
      // 清理所有会话的历史
      for (const [id, history] of this.classificationHistory.entries()) {
        this.classificationHistory.set(id, history.slice(-20));
      }
    }
  }
}

/**
 * 复杂场景处理器实体
 * 处理复杂场景的分析和分解
 */
export class ComplexScenarioProcessor {
  private processedScenarios: ComplexScenarioAnalysis[] = [];

  constructor(
    public readonly id: string,
    public readonly maxComplexity: number = 10
  ) {}

  /**
   * 记录处理的场景
   */
  recordProcessedScenario(analysis: ComplexScenarioAnalysis): void {
    this.processedScenarios.push(analysis);
    
    // 保持历史记录在合理大小
    if (this.processedScenarios.length > 100) {
      this.processedScenarios = this.processedScenarios.slice(-50);
    }
  }

  /**
   * 获取处理历史
   */
  getProcessingHistory(): ComplexScenarioAnalysis[] {
    return [...this.processedScenarios];
  }

  /**
   * 分析处理器性能
   */
  analyzeProcessorPerformance(): {
    totalScenarios: number;
    averageComplexity: number;
    scenarioTypeDistribution: Record<string, number>;
    averageProcessingTime: number;
    domainUsageStats: Record<string, number>;
  } {
    if (this.processedScenarios.length === 0) {
      return {
        totalScenarios: 0,
        averageComplexity: 0,
        scenarioTypeDistribution: {},
        averageProcessingTime: 0,
        domainUsageStats: {}
      };
    }

    let totalComplexity = 0;
    let totalProcessingTime = 0;
    const scenarioTypes: Record<string, number> = {};
    const domainUsage: Record<string, number> = {};

    for (const scenario of this.processedScenarios) {
      totalComplexity += scenario.complexityScore;
      totalProcessingTime += scenario.estimatedProcessingTime;
      
      scenarioTypes[scenario.scenarioType] = (scenarioTypes[scenario.scenarioType] || 0) + 1;
      
      for (const domain of scenario.requiredDomains) {
        domainUsage[domain] = (domainUsage[domain] || 0) + 1;
      }
    }

    return {
      totalScenarios: this.processedScenarios.length,
      averageComplexity: totalComplexity / this.processedScenarios.length,
      scenarioTypeDistribution: scenarioTypes,
      averageProcessingTime: totalProcessingTime / this.processedScenarios.length,
      domainUsageStats: domainUsage
    };
  }

  /**
   * 清理处理历史
   */
  cleanupHistory(): void {
    this.processedScenarios = this.processedScenarios.slice(-30);
  }
}