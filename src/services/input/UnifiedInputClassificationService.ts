/**
 * 统一输入分类服务
 * 整合所有输入分类功能，避免服务重复实现
 * 集成GameContextService，避免硬编码上下文
 */

import { LLMService } from '../llm/LLMService';
import { FormattedTextGenerator } from '../llm/FormattedTextResponse';
import { FormattedTextExtractorService, InputClassificationResult } from '../llm/FormattedTextExtractorService';
import { GameContextService } from '../game/GameContextService';
import { Logger } from '../Logger';
import { PatternRecognitionUtil, ErrorHandlerUtil, CacheUtil } from '../../utils/CommonUtils';
import { IntentType, UrgencyLevel, EmotionalTone } from '../../domains/input/valueObjects';

export interface InputClassification {
  type: 'speech' | 'action' | 'question' | 'system_query' | 'compound_action';
  intent: IntentType;
  confidence: number; // 0-100
  targetCharacter?: string;
  isDirectSpeech: boolean;
  isActionDescription: boolean;
  isSystemQuery: boolean;
  isCompoundAction: boolean;
  extractedAction?: string;
  extractedSpeech?: string;
  contextualHints: string[];
  urgency: UrgencyLevel;
  emotionalTone: EmotionalTone;
  // 复合动作支持
  subActions?: SubAction[];
  primaryAction?: SubAction;
  actionSequence?: 'sequential' | 'simultaneous';
}

export interface SubAction {
  type: 'movement' | 'observation' | 'dialogue' | 'interaction';
  intent: 'movement' | 'observation' | 'inquiry' | 'dialogue' | 'greeting' | 'confirmation';
  description: string;
  target?: string;
  location?: string;
  priority: number; // 1-10, higher means more important
  executionOrder: number; // 执行顺序
  contextualHints: string[];
}

export interface ActionState {
  actionType: 'movement' | 'interaction' | 'observation' | 'dialogue';
  actionTarget?: string;
  actionLocation?: string;
  actionDescription: string;
  isCompleted: boolean;
  expectedOutcome: string;
  followUpRequired: boolean;
}

export interface ClassificationResult {
  intent: string;
  confidence: number;
  payload?: any;
  classification?: InputClassification;
}

export interface EnhancedInputClassification extends InputClassification {
  contextualRelevance: number;
  suggestedFollowUp?: string[];
  memoryTriggers?: string[];
  semanticComplexity?: {
    complexityScore: number;
    linguisticFeatures: string[];
    processingRecommendation: 'simple' | 'standard' | 'complex';
  };
}

export class UnifiedInputClassificationService {
  private extractor: FormattedTextExtractorService;
  private logger: Logger;

  constructor(
    private llmService: LLMService,
    private gameContextService: GameContextService,
    logger?: Logger
  ) {
    this.logger = logger || console as any;
    this.extractor = new FormattedTextExtractorService(this.logger);
  }

  /**
   * 主要输入分类方法 - 使用动态游戏上下文
   */
  async classifyInput(
    input: string,
    sessionId: string,
    playerId: string
  ): Promise<InputClassification> {
    try {
      // 获取动态游戏上下文（避免硬编码）
      const gameContext = await this.gameContextService.getInputClassificationContext(sessionId, playerId);
      
      this.logger.debug('Using dynamic game context for input classification', {
        sessionId,
        playerId,
        currentLocation: gameContext.currentLocation,
        nearbyCharactersCount: gameContext.nearbyCharacters.length,
        component: 'UnifiedInputClassificationService'
      });

      return await this.performClassificationWithContext(input, gameContext);
    } catch (error) {
      this.logger.error('Failed to get game context, using fallback classification', error as Error);
      
      // 备用分类（不依赖GameContextService）
      return await this.performFallbackClassification(input);
    }
  }

  /**
   * 兼容旧接口的分类方法
   */
  async classifyInputLegacy(
    input: string,
    context: {
      sessionId: string;
      recentConversation: string[];
      currentLocation: string;
      nearbyCharacters: string[];
      pendingActions: ActionState[];
    }
  ): Promise<InputClassification> {
    const gameContext = {
      sessionId: context.sessionId,
      currentLocation: context.currentLocation,
      nearbyCharacters: context.nearbyCharacters,
      recentConversation: context.recentConversation,
      availableLocations: []
    };

    return await this.performClassificationWithContext(input, gameContext);
  }

  /**
   * 使用上下文进行分类
   */
  private async performClassificationWithContext(
    input: string,
    gameContext: {
      sessionId: string;
      currentLocation: string;
      nearbyCharacters: string[];
      recentConversation: string[];
      availableLocations?: string[];
    }
  ): Promise<InputClassification> {
    try {
      // 首先尝试使用LLM进行分类
      const llmResult = await this.performLLMClassification(input, gameContext);
      
      // 如果LLM分类成功且置信度足够高，直接返回结果
      if (llmResult && llmResult.confidence >= 70) {
        // 如果检测为复合动作，进行进一步分析
        if (llmResult.isCompoundAction) {
          const compoundResult = await this.analyzeCompoundAction(input, gameContext);
          return {
            ...llmResult,
            subActions: compoundResult.subActions,
            primaryAction: compoundResult.subActions.length > 0 ? compoundResult.subActions[0] : undefined,
            actionSequence: compoundResult.actionSequence
          };
        }
        
        return llmResult;
      }
      
      // LLM分类失败或置信度低，使用基础分类作为备选
      this.logger.warn('LLM classification failed or low confidence, falling back to basic classification');
      return this.performBasicClassification(input);
    } catch (error) {
      this.logger.error('Input classification failed:', error as Error);
      
      // 如果所有分类方法都失败，返回默认分类
      return this.getDefaultClassification(input);
    }
  }

  /**
   * 使用LLM进行分类（增强版，集成GameContextService）
   */
  private async performLLMClassification(
    input: string,
    gameContext: {
      sessionId: string;
      currentLocation: string;
      nearbyCharacters: string[];
      recentConversation: string[];
    }
  ): Promise<InputClassification | null> {
    const cacheKey = `llm_classification_${input.substring(0, 50)}`;
    
    // 尝试从缓存获取结果
    const cachedResult = CacheUtil.get<InputClassification>('llm_classification', cacheKey);
    if (cachedResult) {
      this.logger.info('Using cached LLM classification result');
      return cachedResult;
    }

    const result = await ErrorHandlerUtil.safeExecute(
      async () => {
        // 生成格式化文本提示词（使用动态上下文）
        const prompt = FormattedTextGenerator.generateInputClassificationPrompt(input, {
          sessionId: gameContext.sessionId,
          currentLocation: gameContext.currentLocation,
          nearbyCharacters: gameContext.nearbyCharacters,
          recentConversation: gameContext.recentConversation
        });

        // 调用LLM生成响应
        const response = await this.llmService.generateText(prompt, {
          maxTokens: 400,
          temperature: 0.3
        });
        
        // 使用格式化文本提取器解析响应
        const extractResult = this.extractor.extractInputClassification(response);
        
        // 转换为InputClassification格式
        const classification: InputClassification = {
          type: extractResult.type,
          intent: extractResult.intent,
          confidence: extractResult.confidence,
          targetCharacter: extractResult.targetCharacter,
          isDirectSpeech: extractResult.isDirectSpeech,
          isActionDescription: extractResult.isActionDescription,
          isSystemQuery: extractResult.isSystemQuery,
          isCompoundAction: extractResult.isCompoundAction,
          extractedAction: extractResult.extractedAction,
          extractedSpeech: extractResult.extractedSpeech,
          contextualHints: extractResult.contextualHints,
          urgency: extractResult.urgency,
          emotionalTone: extractResult.emotionalTone
        };

        // 缓存结果
        CacheUtil.set('llm_classification', cacheKey, classification, 300000); // 5分钟缓存
        
        return classification;
      },
      this.logger,
      'LLM Input Classification'
    );

    return result.success ? result.data! : null;
  }

  /**
   * 备用分类方法（不依赖GameContextService）
   */
  private async performFallbackClassification(input: string): Promise<InputClassification> {
    return this.performBasicClassification(input);
  }

  /**
   * 获取默认分类结果
   */
  private getDefaultClassification(input: string): InputClassification {
    return {
      type: 'speech',
      intent: IntentType.DIALOGUE,
      confidence: 50,
      isDirectSpeech: true,
      isActionDescription: false,
      isSystemQuery: false,
      isCompoundAction: false,
      contextualHints: ['default', 'fallback'],
      urgency: UrgencyLevel.MEDIUM,
      emotionalTone: EmotionalTone.NEUTRAL
    };
  }

  // 其他方法将在下一个文件中继续...
  
  /**
   * 基础分类（当LLM不可用时的备选方案）
   */
  private performBasicClassification(input: string): InputClassification {
    const trimmedInput = input.trim().toLowerCase();
    
    // 检查问题模式
    const questionPatterns = [
      /[?？]$/, // 以问号结尾
      /^(what|when|where|who|why|how|什么|何时|哪里|谁|为什么|如何|怎么样)/i
    ];
    
    const isQuestion = questionPatterns.some(pattern => pattern.test(trimmedInput));
    if (isQuestion) {
      return {
        type: 'question',
        intent: IntentType.INFORMATION_QUERY,
        confidence: 85,
        isDirectSpeech: true,
        isActionDescription: false,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: ['question'],
        urgency: UrgencyLevel.MEDIUM,
        emotionalTone: EmotionalTone.NEUTRAL
      };
    }
    
    // 检查动作模式
    const actionPatterns = [
      /(走|去|前往|移动|看|观察|检查|说|告诉|问)/i
    ];
    
    const isAction = actionPatterns.some(pattern => pattern.test(trimmedInput));
    if (isAction) {
      return {
        type: 'action',
        intent: IntentType.MOVEMENT,
        confidence: 80,
        isDirectSpeech: false,
        isActionDescription: true,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: ['action'],
        urgency: UrgencyLevel.MEDIUM,
        emotionalTone: EmotionalTone.NEUTRAL
      };
    }
    
    // 默认为对话
    return {
      type: 'speech',
      intent: IntentType.DIALOGUE,
      confidence: 75,
      isDirectSpeech: true,
      isActionDescription: false,
      isSystemQuery: false,
      isCompoundAction: false,
      contextualHints: ['dialogue'],
      urgency: UrgencyLevel.MEDIUM,
      emotionalTone: EmotionalTone.NEUTRAL
    };
  }

  /**
   * 分析复合动作
   */
  async analyzeCompoundAction(input: string, context: any): Promise<{
    isCompound: boolean;
    subActions: SubAction[];
    actionSequence: 'sequential' | 'simultaneous';
  }> {
    try {
      // 生成格式化文本提示词
      const prompt = FormattedTextGenerator.generateCompoundActionPrompt(input);

      // 调用LLM生成响应
      const response = await this.llmService.generateText(prompt, {
        maxTokens: 400,
        temperature: 0.4
      });
      
      // 使用格式化文本提取器解析响应
      const result = this.extractor.extractCompoundAction(response);
      
      // 智能转换子动作格式
      const subActions: SubAction[] = result.subActions.map((action, index) => {
        return {
          type: 'interaction',
          intent: 'dialogue',
          description: action,
          priority: 5,
          executionOrder: index + 1,
          contextualHints: ['compound_action']
        };
      });
      
      return {
        isCompound: result.isCompound,
        subActions: subActions,
        actionSequence: result.actionSequence
      };
    } catch (error) {
      this.logger.error('Compound action analysis failed:', error as Error);
      
      return {
        isCompound: false,
        subActions: [],
        actionSequence: 'sequential'
      };
    }
  }

  /**
   * 提供增强的输入分类，包含上下文感知
   */
  async classifyInputWithContext(
    input: string,
    sessionId: string,
    playerId: string,
    options?: {
      includeSemanticAnalysis?: boolean;
      includeMemoryTriggers?: boolean;
      includeSuggestions?: boolean;
    }
  ): Promise<EnhancedInputClassification> {
    // 基础分类
    const basicClassification = await this.classifyInput(input, sessionId, playerId);
    
    // 获取完整游戏上下文用于增强分析
    const gameContext = await this.gameContextService.getGameContext(sessionId, playerId);
    
    // 分析上下文相关性
    const contextualRelevance = this.calculateContextualRelevance(
      input, 
      gameContext.recentConversation.map(c => c.content),
      [] // 如果需要pendingActions，需要从gameContext中获取
    );
    
    let result: EnhancedInputClassification = {
      ...basicClassification,
      contextualRelevance
    };

    // 可选的增强分析
    if (options?.includeSuggestions) {
      result.suggestedFollowUp = this.generateSuggestedFollowUp(basicClassification, gameContext);
    }
    
    if (options?.includeMemoryTriggers) {
      result.memoryTriggers = this.detectMemoryTriggers(
        input, 
        gameContext.recentConversation.map(c => c.content)
      );
    }
    
    if (options?.includeSemanticAnalysis) {
      result.semanticComplexity = this.analyzeSemanticComplexity(input);
    }
    
    return result;
  }

  // ===== 私有辅助方法 =====

  private calculateContextualRelevance(
    input: string,
    recentConversation: string[],
    pendingActions: ActionState[]
  ): number {
    let relevance = 0.5; // 基础相关性
    
    // 检查与最近对话的相关性
    const inputWords = input.toLowerCase().split(/\s+/);
    const recentWords = recentConversation.slice(-3)
      .join(' ').toLowerCase().split(/\s+/);
    
    const commonWords = inputWords.filter(word => 
      recentWords.includes(word) && word.length > 2
    );
    
    relevance += Math.min(0.3, commonWords.length * 0.1);
    
    return Math.min(1.0, relevance);
  }

  private generateSuggestedFollowUp(
    classification: InputClassification,
    context: any
  ): string[] {
    const suggestions: string[] = [];
    
    switch (classification.type) {
      case 'action':
        if (classification.intent === 'movement') {
          suggestions.push('检查新环境', '与附近的角色交谈');
        }
        break;
      case 'speech':
        suggestions.push('继续对话', '问更多问题');
        break;
    }
    
    return suggestions;
  }

  private detectMemoryTriggers(
    input: string,
    playerHistory: string[]
  ): string[] {
    const triggers: string[] = [];
    
    // 检查关键词触发器
    const emotionalTriggers = ['记得', '以前', '上次', 'remember', 'before', 'last time'];
    if (emotionalTriggers.some(trigger => input.toLowerCase().includes(trigger))) {
      triggers.push('memory_recall');
    }
    
    return triggers;
  }

  private analyzeSemanticComplexity(input: string): {
    complexityScore: number;
    linguisticFeatures: string[];
    processingRecommendation: 'simple' | 'standard' | 'complex';
  } {
    const text = input.toLowerCase();
    let complexityScore = 0;
    const linguisticFeatures: string[] = [];
    
    // 检查句子长度
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 15) {
      complexityScore += 20;
      linguisticFeatures.push('long_sentence');
    }
    
    // 确定处理建议
    let processingRecommendation: 'simple' | 'standard' | 'complex';
    if (complexityScore <= 20) {
      processingRecommendation = 'simple';
    } else if (complexityScore <= 50) {
      processingRecommendation = 'standard';
    } else {
      processingRecommendation = 'complex';
    }
    
    return {
      complexityScore: Math.min(100, complexityScore),
      linguisticFeatures,
      processingRecommendation
    };
  }
}