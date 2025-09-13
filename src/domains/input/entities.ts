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
 * 输入会话实体（增强版）
 * 管理单个会话中的输入历史和上下文，包含智能上下文管理
 */
export class InputSession {
  private conversationHistory: ConversationTurn[] = [];
  private topicHistory: string[] = [];
  private turnCounter: number = 0;
  private contextualMemory: Map<string, any> = new Map();
  private intentFlow: Array<{ intent: string; timestamp: Date; confidence: number }> = [];
  private emotionalJourney: Array<{ emotion: string; intensity: number; timestamp: Date }> = [];
  private complexityTrend: number[] = [];
  
  constructor(
    public readonly sessionId: string,
    public readonly playerId: string,
    public readonly startTime: Date = new Date(),
    public readonly sessionMetadata: {
      playerLevel?: number;
      gameMode?: string;
      preferredStyle?: string;
    } = {}
  ) {}

  /**
   * 添加对话轮次（增强版）
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

    // 更新智能上下文跟踪
    this.updateContextualTracking(classification);

    return turn;
  }

  /**
   * 更新上下文跟踪
   */
  private updateContextualTracking(classification: InputClassification): void {
    // 更新意图流
    this.intentFlow.push({
      intent: classification.intent,
      timestamp: new Date(),
      confidence: classification.confidence
    });
    if (this.intentFlow.length > 20) {
      this.intentFlow = this.intentFlow.slice(-10);
    }

    // 更新情绪旅程
    this.emotionalJourney.push({
      emotion: classification.emotionalTone,
      intensity: this.mapEmotionToIntensity(classification.emotionalTone),
      timestamp: new Date()
    });
    if (this.emotionalJourney.length > 15) {
      this.emotionalJourney = this.emotionalJourney.slice(-10);
    }

    // 更新复杂度趋势
    this.complexityTrend.push(classification.complexity);
    if (this.complexityTrend.length > 10) {
      this.complexityTrend.shift();
    }

    // 更新话题历史
    if (classification.intent !== 'unknown') {
      this.topicHistory.push(classification.intent);
      if (this.topicHistory.length > 20) {
        this.topicHistory = this.topicHistory.slice(-10);
      }
    }

    // 保存上下文记忆
    this.updateContextualMemory(classification);
  }

  /**
   * 更新上下文记忆
   */
  private updateContextualMemory(classification: InputClassification): void {
    // 记录重要对话元素
    if (classification.entities && classification.entities.length > 0) {
      for (const entity of classification.entities) {
        const key = `entity_${entity.type}_${entity.value}`;
        const existing = this.contextualMemory.get(key) || { count: 0, lastMentioned: new Date(0) };
        this.contextualMemory.set(key, {
          count: existing.count + 1,
          lastMentioned: new Date(),
          type: entity.type,
          value: entity.value
        });
      }
    }

    // 记录情绪状态变化
    const emotionKey = `emotion_${classification.emotionalTone}`;
    const emotionData = this.contextualMemory.get(emotionKey) || { count: 0, intensity: 0 };
    this.contextualMemory.set(emotionKey, {
      count: emotionData.count + 1,
      intensity: this.mapEmotionToIntensity(classification.emotionalTone),
      lastOccurrence: new Date()
    });
  }

  /**
   * 将情绪映射为强度值
   */
  private mapEmotionToIntensity(emotion: string): number {
    const intensityMap: Record<string, number> = {
      'excited': 80,
      'positive': 60,
      'neutral': 40,
      'concerned': 65,
      'negative': 70
    };
    return intensityMap[emotion] || 40;
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
    this.intentFlow = this.intentFlow.slice(-5);
    this.emotionalJourney = this.emotionalJourney.slice(-5);
    this.complexityTrend = this.complexityTrend.slice(-5);
    
    // 清理过时的上下文记忆
    this.cleanupContextualMemory();
  }

  /**
   * 获取增强的上下文信息
   */
  getEnhancedContextInfo(): {
    conversationFlow: ConversationTurn[];
    intentPattern: string[];
    emotionalState: { current: string; trend: string };
    complexityEvolution: { current: number; trend: string };
    memorableEntities: Array<{ type: string; value: string; relevance: number }>;
    sessionCharacteristics: {
      averageComplexity: number;
      dominantEmotion: string;
      engagementLevel: number;
      sessionDuration: number;
    };
  } {
    const recentTurns = this.conversationHistory.slice(-5);
    const intentPattern = this.intentFlow.slice(-5).map(i => i.intent);
    
    // 分析情绪趋势
    const recentEmotions = this.emotionalJourney.slice(-3);
    const currentEmotion = recentEmotions[recentEmotions.length - 1]?.emotion || 'neutral';
    const emotionalTrend = this.analyzeEmotionalTrend(recentEmotions);
    
    // 分析复杂度趋势
    const currentComplexity = this.complexityTrend[this.complexityTrend.length - 1] || 0;
    const complexityTrend = this.analyzeComplexityTrend();
    
    // 获取值得记忆的实体
    const memorableEntities = this.getMemorableEntities();
    
    // 计算会话特征
    const sessionCharacteristics = this.calculateSessionCharacteristics();
    
    return {
      conversationFlow: recentTurns,
      intentPattern,
      emotionalState: {
        current: currentEmotion,
        trend: emotionalTrend
      },
      complexityEvolution: {
        current: currentComplexity,
        trend: complexityTrend
      },
      memorableEntities,
      sessionCharacteristics
    };
  }

  /**
   * 预测下一次输入的可能意图
   */
  predictNextIntent(): {
    likelyIntents: Array<{ intent: string; probability: number; reasoning: string }>;
    suggestedPrompts: string[];
  } {
    const recentIntents = this.intentFlow.slice(-3).map(i => i.intent);
    const intentPatterns = this.analyzeIntentPatterns(recentIntents);
    
    // 基于模式预测
    const predictions = this.generateIntentPredictions(intentPatterns);
    const prompts = this.generateSuggestedPrompts(predictions);
    
    return {
      likelyIntents: predictions,
      suggestedPrompts: prompts
    };
  }

  /**
   * 获取上下文相关性分数
   */
  calculateContextualRelevance(newInput: string): number {
    let relevance = 0.5; // 基础相关性
    
    // 检查与最近对话的相关性
    const recentInputs = this.getRecentInputs(3);
    const inputWords = newInput.toLowerCase().split(/\s+/);
    
    for (const recentInput of recentInputs) {
      const recentWords = recentInput.toLowerCase().split(/\s+/);
      const commonWords = inputWords.filter(word => recentWords.includes(word) && word.length > 2);
      relevance += Math.min(0.2, commonWords.length * 0.05);
    }
    
    // 检查与记忆实体的相关性
    for (const [key, data] of this.contextualMemory.entries()) {
      if (key.startsWith('entity_') && data.value) {
        if (newInput.toLowerCase().includes(data.value.toLowerCase())) {
          relevance += Math.min(0.3, data.count * 0.1);
        }
      }
    }
    
    return Math.min(1.0, relevance);
  }

  // ========== 私有辅助方法 ==========

  private cleanupContextualMemory(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前
    
    for (const [key, data] of this.contextualMemory.entries()) {
      if (data.lastMentioned && data.lastMentioned < cutoffTime && data.count < 3) {
        this.contextualMemory.delete(key);
      }
    }
  }

  private analyzeEmotionalTrend(emotions: Array<{ emotion: string; intensity: number; timestamp: Date }>): string {
    if (emotions.length < 2) return 'stable';
    
    const intensities = emotions.map(e => e.intensity);
    const firstHalf = intensities.slice(0, Math.ceil(intensities.length / 2));
    const secondHalf = intensities.slice(Math.ceil(intensities.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, i) => sum + i, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, i) => sum + i, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 10) return 'improving';
    if (secondAvg < firstAvg - 10) return 'declining';
    return 'stable';
  }

  private analyzeComplexityTrend(): string {
    if (this.complexityTrend.length < 3) return 'stable';
    
    const recent = this.complexityTrend.slice(-3);
    const trend = recent[recent.length - 1] - recent[0];
    
    if (trend > 2) return 'increasing';
    if (trend < -2) return 'decreasing';
    return 'stable';
  }

  private getMemorableEntities(): Array<{ type: string; value: string; relevance: number }> {
    const entities = [];
    
    for (const [key, data] of this.contextualMemory.entries()) {
      if (key.startsWith('entity_') && data.count >= 2) {
        const relevance = Math.min(100, data.count * 20 + (data.lastMentioned ? 10 : 0));
        entities.push({
          type: data.type,
          value: data.value,
          relevance
        });
      }
    }
    
    return entities.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
  }

  private calculateSessionCharacteristics(): {
    averageComplexity: number;
    dominantEmotion: string;
    engagementLevel: number;
    sessionDuration: number;
  } {
    const avgComplexity = this.complexityTrend.length > 0 ? 
      this.complexityTrend.reduce((sum, c) => sum + c, 0) / this.complexityTrend.length : 0;
    
    // 找出主导情绪
    const emotionCounts: Record<string, number> = {};
    for (const emotion of this.emotionalJourney) {
      emotionCounts[emotion.emotion] = (emotionCounts[emotion.emotion] || 0) + 1;
    }
    const dominantEmotion = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral';
    
    // 计算参与度
    const avgInputLength = this.conversationHistory.reduce(
      (sum, turn) => sum + turn.playerInput.length, 0
    ) / Math.max(1, this.conversationHistory.length);
    const engagementLevel = Math.min(100, (avgInputLength / 10) + (this.turnCounter / 2));
    
    // 会话持续时间（分钟）
    const sessionDuration = (Date.now() - this.startTime.getTime()) / (1000 * 60);
    
    return {
      averageComplexity: avgComplexity,
      dominantEmotion,
      engagementLevel,
      sessionDuration
    };
  }

  private analyzeIntentPatterns(recentIntents: string[]): Record<string, number> {
    const patterns: Record<string, number> = {};
    
    // 分析意图转换模式
    for (let i = 1; i < recentIntents.length; i++) {
      const transition = `${recentIntents[i - 1]} -> ${recentIntents[i]}`;
      patterns[transition] = (patterns[transition] || 0) + 1;
    }
    
    return patterns;
  }

  private generateIntentPredictions(patterns: Record<string, number>): Array<{ intent: string; probability: number; reasoning: string }> {
    const lastIntent = this.intentFlow[this.intentFlow.length - 1]?.intent;
    if (!lastIntent) {
      return [
        { intent: 'dialogue', probability: 0.4, reasoning: '常见的开始意图' },
        { intent: 'exploration', probability: 0.3, reasoning: '探索是普遍行为' }
      ];
    }
    
    // 基于历史模式预测
    const predictions = [];
    const transitionKey = `${lastIntent} ->`;
    
    for (const [pattern, count] of Object.entries(patterns)) {
      if (pattern.startsWith(transitionKey)) {
        const nextIntent = pattern.split(' -> ')[1];
        predictions.push({
          intent: nextIntent,
          probability: Math.min(0.8, count * 0.3),
          reasoning: `基于历史模式，${lastIntent}后通常会${nextIntent}`
        });
      }
    }
    
    return predictions.slice(0, 3);
  }

  private generateSuggestedPrompts(predictions: Array<{ intent: string; probability: number; reasoning: string }>): string[] {
    const prompts = [];
    
    for (const prediction of predictions) {
      switch (prediction.intent) {
        case 'dialogue':
          prompts.push('与附近的角色交谈', '询问相关信息');
          break;
        case 'exploration':
          prompts.push('探索附近区域', '查看环境细节');
          break;
        case 'action':
          prompts.push('执行具体动作', '与环境互动');
          break;
      }
    }
    
    return prompts.slice(0, 3);
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