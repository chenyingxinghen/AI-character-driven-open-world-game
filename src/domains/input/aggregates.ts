/**
 * 输入域聚合
 * 组合多个相关的服务和实体，提供统一的业务接口
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
import { InputSession, InputClassifier, ComplexScenarioProcessor } from './entities';
import { 
  InputClassification, 
  ComplexScenarioAnalysis,
  ChoiceDetectionResult,
  PreprocessedInput,
  ContextHistory,
  ContextualInfo,
  ExtractedEntity,
  EntityType,
  IntentType,
  EmotionalTone,
  UrgencyLevel
} from './valueObjects';
import { 
  InputPreprocessingService,
  EntityExtractionService,
  IntentClassificationService,
  ComplexScenarioAnalysisService,
  ChoiceDetectionService
} from './services';
import { UnifiedInputClassificationService } from '../../services/input/UnifiedInputClassificationService';
import { GameContextService } from '../../services/game/GameContextService';

/**
 * 输入管理器
 * 输入域的主要聚合根，协调所有输入相关的业务逻辑
 */
export class InputManager {
  private sessions: Map<string, InputSession> = new Map();
  private classifier: InputClassifier;
  private complexProcessor: ComplexScenarioProcessor;
  
  private preprocessingService: InputPreprocessingService;
  private entityExtractionService: EntityExtractionService;
  private intentClassificationService: IntentClassificationService;
  private unifiedInputClassificationService: UnifiedInputClassificationService;
  private complexAnalysisService: ComplexScenarioAnalysisService;
  private choiceDetectionService: ChoiceDetectionService;
  
  constructor(
    private llmService: LLMService,
    private logger: Logger,
    private gameContextService?: GameContextService
  ) {
    this.classifier = new InputClassifier('main_classifier', 'Enhanced Classifier', '1.0.0');
    this.complexProcessor = new ComplexScenarioProcessor('main_processor', 10);
    
    this.preprocessingService = new InputPreprocessingService(logger);
    this.entityExtractionService = new EntityExtractionService(llmService, logger);
    this.intentClassificationService = new IntentClassificationService(llmService, logger, gameContextService);
    this.unifiedInputClassificationService = new UnifiedInputClassificationService(llmService, gameContextService!, logger);
    this.complexAnalysisService = new ComplexScenarioAnalysisService(llmService, logger);
    this.choiceDetectionService = new ChoiceDetectionService(logger);
  }

  /**
   * 创建或获取输入会话
   */
  getOrCreateSession(sessionId: string, playerId: string): InputSession {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new InputSession(sessionId, playerId));
    }
    return this.sessions.get(sessionId)!;
  }

  /**
   * 完整的输入分析流程
   */
  async analyzeInput(
    sessionId: string,
    playerId: string,
    rawInput: string,
    context?: {
      knownCharacters?: string[];
      knownLocations?: string[];
      currentLocation?: string;
      recentEvents?: any[];
    }
  ): Promise<{
    preprocessed: PreprocessedInput;
    classification: InputClassification;
    complexAnalysis?: ComplexScenarioAnalysis;
    choiceDetection: ChoiceDetectionResult;
    sessionAnalysis: any;
  }> {
    this.logger.info(`Analyzing input for session ${sessionId}: "${rawInput}"`);

    // 1. 获取会话
    const session = this.getOrCreateSession(sessionId, playerId);
    
    // 2. 预处理输入
    const preprocessed = this.preprocessingService.preprocessInput(rawInput);
    
    // 3. 提取实体
    const entities = await this.entityExtractionService.extractEntities(
      preprocessed.sanitizedInput,
      {
        knownCharacters: context?.knownCharacters,
        knownLocations: context?.knownLocations
      }
    );

    // 4. 获取上下文历史
    const contextHistory = session.getContextHistory(5);

    // 5. 使用统一输入分类服务进行主要分类
    const inputClassificationResult = await this.unifiedInputClassificationService.classifyInputLegacy(
      preprocessed.sanitizedInput,
      {
        sessionId,
        recentConversation: contextHistory.conversationFlow.map(cf => cf.playerInput),
        currentLocation: context?.currentLocation || 'unknown',
        nearbyCharacters: context?.knownCharacters || [],
        pendingActions: context?.recentEvents || []
      }
    );

    // 6. 如果输入分类置信度较低，使用意图识别作为补充
    let intentResult = {
      intent: inputClassificationResult.intent,
      confidence: inputClassificationResult.confidence / 100, // 转换为0-1范围
      emotionalTone: inputClassificationResult.emotionalTone,
      urgency: inputClassificationResult.urgency
    };

    if (inputClassificationResult.confidence < 70) {
      this.logger.debug('Input classification confidence low, using intent classification as fallback');
      const fallbackIntentResult = await this.intentClassificationService.classifyIntent(
        preprocessed.sanitizedInput,
        entities,
        contextHistory,
        sessionId,
        playerId
      );
      
      // 如果意图识别置信度更高，使用其结果
      if (fallbackIntentResult.confidence > intentResult.confidence) {
        intentResult = {
          intent: this.mapIntentTypeToValidString(fallbackIntentResult.intent),
          confidence: fallbackIntentResult.confidence,
          emotionalTone: this.mapEmotionalToneToValidString(fallbackIntentResult.emotionalTone),
          urgency: this.mapUrgencyLevelToValidString(fallbackIntentResult.urgency)
        };
        this.logger.debug('Using intent classification result as it has higher confidence');
      }
    }

    // 7. 构建完整分类结果（修复接口匹配）
    const classification: InputClassification = {
      type: inputClassificationResult.type,
      intent: inputClassificationResult.intent,
      confidence: Math.round(inputClassificationResult.confidence), // 确保为整数
      emotionalTone: inputClassificationResult.emotionalTone,
      urgency: inputClassificationResult.urgency,
      complexity: this.calculateComplexity(preprocessed, inputClassificationResult),
      targetCharacter: inputClassificationResult.targetCharacter,
      targetLocation: inputClassificationResult.targetLocation,
      extractedAction: inputClassificationResult.extractedAction,
      extractedSpeech: inputClassificationResult.extractedSpeech,
      isDirectSpeech: inputClassificationResult.isDirectSpeech,
      isActionDescription: inputClassificationResult.isActionDescription,
      isSystemQuery: inputClassificationResult.isSystemQuery,
      isCompoundAction: inputClassificationResult.isCompoundAction,
      contextualHints: inputClassificationResult.contextualHints
    };

    this.logger.debug('Input classification result:', {
      intent: classification.intent,
      confidence: classification.confidence,
      emotionalTone: classification.emotionalTone,
      urgency: classification.urgency,
      targetCharacter: classification.targetCharacter,
      targetLocation: classification.targetLocation
    });

    // 8. 复杂场景分析
    let complexAnalysis: ComplexScenarioAnalysis | undefined;
    if (classification.complexity >= 7) {
      complexAnalysis = await this.complexAnalysisService.analyzeComplexScenario(
        preprocessed.sanitizedInput,
        classification
      );
      
      if (complexAnalysis.isComplex) {
        this.complexProcessor.recordProcessedScenario(complexAnalysis);
      }
    }

    // 9. 选择检测
    const choiceDetection = this.choiceDetectionService.detectChoices(
      preprocessed.sanitizedInput,
      classification
    );

    // 10. 记录分类结果
    this.classifier.recordClassification(sessionId, classification);

    // 11. 分析会话模式
    const sessionAnalysis = session.analyzeConversationPatterns();

    return {
      preprocessed,
      classification,
      complexAnalysis,
      choiceDetection,
      sessionAnalysis
    };
  }

  /**
   * 处理用户响应（例如选择结果）
   */
  async processUserResponse(
    sessionId: string,
    userResponse: string,
    systemResponse: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return;
    }

    // 分析用户响应
    const responseAnalysis = await this.analyzeInput(sessionId, session.playerId, userResponse);

    // 添加对话轮次
    session.addConversationTurn(
      userResponse,
      responseAnalysis.classification,
      systemResponse
    );
  }

  /**
   * 获取会话上下文
   */
  getSessionContext(sessionId: string): {
    session: InputSession | null;
    contextHistory: ContextHistory | null;
    conversationPatterns: any;
  } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        session: null,
        contextHistory: null,
        conversationPatterns: null
      };
    }

    const contextHistory = session.getContextHistory(10);
    const conversationPatterns = session.analyzeConversationPatterns();

    return {
      session,
      contextHistory,
      conversationPatterns
    };
  }

  /**
   * 获取分类器性能分析
   */
  getClassifierPerformance(): any {
    return this.classifier.analyzePerformance();
  }

  /**
   * 获取复杂场景处理器性能分析
   */
  getComplexProcessorPerformance(): any {
    return this.complexProcessor.analyzeProcessorPerformance();
  }

  /**
   * 清理会话数据
   */
  cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cleanup();
      this.classifier.cleanupHistory(sessionId);
    }
  }

  /**
   * 清理所有过期会话
   */
  cleanupExpiredSessions(maxAgeHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.startTime < cutoffTime) {
        this.cleanupSession(sessionId);
        this.sessions.delete(sessionId);
        this.logger.info(`Cleaned up expired session: ${sessionId}`);
      }
    }

    // 清理分类器历史
    this.classifier.cleanupHistory();
    this.complexProcessor.cleanupHistory();
  }

  /**
   * 获取输入趋势分析
   */
  getInputTrendsAnalysis(): {
    totalSessions: number;
    activeSessions: number;
    intentDistribution: Record<string, number>;
    complexityTrends: Record<string, number>;
    emotionalTrends: Record<string, number>;
  } {
    const totalSessions = this.sessions.size;
    const currentTime = new Date();
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);
    
    let activeSessions = 0;
    const intentCounts: Record<string, number> = {};
    const complexityCounts: Record<string, number> = { low: 0, medium: 0, high: 0 };
    const emotionCounts: Record<string, number> = {};

    for (const session of this.sessions.values()) {
      const recentClassifications = session.getRecentClassifications(10);
      
      // 检查活跃会话
      if (recentClassifications.length > 0) {
        const lastActivity = session.getContextHistory(1).conversationFlow[0]?.timestamp;
        if (lastActivity && lastActivity > oneHourAgo) {
          activeSessions++;
        }
      }

      // 统计意图分布
      for (const classification of recentClassifications) {
        intentCounts[classification.intent] = (intentCounts[classification.intent] || 0) + 1;
        
        // 复杂度分布
        if (classification.complexity <= 3) {
          complexityCounts.low++;
        } else if (classification.complexity <= 6) {
          complexityCounts.medium++;
        } else {
          complexityCounts.high++;
        }

        // 情绪分布
        emotionCounts[classification.emotionalTone] = (emotionCounts[classification.emotionalTone] || 0) + 1;
      }
    }

    return {
      totalSessions,
      activeSessions,
      intentDistribution: intentCounts,
      complexityTrends: complexityCounts,
      emotionalTrends: emotionCounts
    };
  }

  /**
   * 计算输入复杂度
   */
  private calculateComplexity(preprocessed: any, classificationResult: any): number {
    let complexity = 1;
    
    // 基于输入长度
    if (preprocessed.sanitizedInput.length > 50) complexity += 1;
    if (preprocessed.sanitizedInput.length > 100) complexity += 2;
    
    // 基于分类置信度（低置信度可能表示复杂输入）
    if (classificationResult.confidence < 70) complexity += 1;
    
    // 基于是否包含复合动作
    if (classificationResult.isCompoundAction) complexity += 2;
    
    // 基于包含的动作词数量
    const actionWords = ['去', '走', '说', '看', '拿', '使用', 'go', 'walk', 'say', 'look', 'take', 'use'];
    const actionCount = actionWords.filter(word => 
      preprocessed.sanitizedInput.toLowerCase().includes(word)
    ).length;
    complexity += actionCount;
    
    return Math.min(complexity, 10);
  }

  /**
   * 构建上下文信息
   */
  private buildContextualInfo(
    entities: ExtractedEntity[],
    context?: any
  ): ContextualInfo {
    const mentionedCharacters = entities
      .filter(e => e.type === EntityType.CHARACTER)
      .map(e => e.value);

    const mentionedLocations = entities
      .filter(e => e.type === EntityType.LOCATION)
      .map(e => e.value);

    const actionSequence = entities
      .filter(e => e.type === EntityType.ACTION)
      .map(e => e.value);

    const contextualHints: string[] = [
      ...entities.map(e => `${e.type}:${e.value}`),
      ...(context?.currentLocation ? ['has_location'] : []),
      ...(context?.knownCharacters?.length > 0 ? ['has_characters'] : [])
    ];

    return {
      mentionedCharacters,
      mentionedLocations,
      actionSequence,
      contextualHints
    };
  }

  /**
   * 将意图类型枚举转换为有效的字符串
   */
  private mapIntentTypeToValidString(intentType: IntentType): IntentType {
    return intentType;
  }

  /**
   * 将情绪基调枚举转换为有效的字符串
   */
  private mapEmotionalToneToValidString(emotionalTone: EmotionalTone): EmotionalTone {
    return emotionalTone;
  }

  /**
   * 将紧急程度枚举转换为有效的字符串
   */
  private mapUrgencyLevelToValidString(urgencyLevel: UrgencyLevel): UrgencyLevel {
    return urgencyLevel;
  }
}