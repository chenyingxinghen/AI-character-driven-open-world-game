/**
 * 统一输入分类服务
 * 整合所有输入分类功能，避免服务重复实现
 * 集成GameContextService，避免硬编码上下文
 */

import { LLMService, LLMProvider } from '../llm/LLMService';
import { FormattedTextGenerator } from '../llm/FormattedTextResponse';
import { FormattedTextExtractorService, InputClassificationResult } from '../llm/FormattedTextExtractorService';
import { GameContextService } from '../game/GameContextService';
import { Logger } from '../Logger';
import { PatternRecognitionUtil, ErrorHandlerUtil, CacheUtil } from '../../utils/CommonUtils';
import { IntentType, UrgencyLevel, EmotionalTone, InputType, InputClassification as DomainInputClassification } from '../../domains/input/valueObjects';
import { JsonUtils } from '../../utils/JsonUtils';
import { promptManager } from '../../prompts';
import { v4 as uuidv4 } from 'uuid';

export interface InputClassification extends Omit<DomainInputClassification, 'complexity' | 'contextualHints'> {
  // 复合动作支持
  subActions?: SubAction[];
  primaryAction?: SubAction;
  actionSequence?: 'sequential' | 'simultaneous';
  contextualHints: string[];
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
  private logger: Logger;

  constructor(
    private llmService: LLMService,
    private gameContextService: GameContextService,
    logger?: Logger
  ) {
    this.logger = logger || (console as any);
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
      nearbyCharacterDetails?: string[];
      recentConversation: string[];
      availableLocations?: string[];
      recentStoryEvents?: string[];
    }
  ): Promise<InputClassification> {
    try {
      // 首先尝试使用LLM进行分类
      const llmResult = await this.performLLMClassification(input, gameContext);

      this.logger.debug('LLM Classification Result', {
        input,
        intent: llmResult?.intent,
        confidence: llmResult?.confidence,
        type: llmResult?.type,
        component: 'UnifiedInputClassificationService'
      });

      // 如果LLM分类成功且置信度足够高，直接返回结果
      if (llmResult && llmResult.confidence >= 70) {
        // 如果检测为复合动作，进行进一步分析
        if (llmResult.isCompoundAction) {
          const compoundResult = await this.analyzeCompoundAction(input, gameContext);
          return {
            ...llmResult,
            // subActions: compoundResult.subActions, // 复合动作暂时移除
            primaryAction: compoundResult.subActions.length > 0 ? compoundResult.subActions[0] : undefined,
            actionSequence: compoundResult.actionSequence
          };
        }

        return llmResult;
      }

      // LLM分类失败或置信度低，使用基础分类作为备选
      if (llmResult) {
        const confidenceDisplay = typeof llmResult.confidence === 'object'
          ? JSON.stringify(llmResult.confidence)
          : llmResult.confidence;

        this.logger.warn(`LLM classification confidence too low (${confidenceDisplay} < 70), falling back`, {
          input,
          intent: llmResult.intent
        });
      } else {
        this.logger.warn('LLM classification failed (returned null), falling back to basic classification');
      }
      return this.performBasicClassification(input, gameContext);
    } catch (error) {
      this.logger.error('Input classification failed:', error as Error);

      // 如果所有分类方法都失败，返回默认分类
      return this.getDefaultClassification(input);
    }
  }

  // CLASSIFICATION_SCHEMA 已迁移至 InputPrompts.ts 并通过 promptManager 获取

  /**
   * 使用LLM进行分类（增强版，集成 JSON Schema）
   */
  private async performLLMClassification(
    input: string,
    gameContext: {
      sessionId: string;
      currentLocation: string;
      nearbyCharacters: string[];
      nearbyCharacterDetails?: string[];
      recentConversation: string[];
      availableLocations?: string[];
      recentStoryEvents?: string[];
    }
  ): Promise<InputClassification | null> {
    const cacheKey = `llm_classification_v2_${input.substring(0, 50)}`;

    const cachedResult = CacheUtil.get<InputClassification>('llm_classification', cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const result = await ErrorHandlerUtil.safeExecute(
      async () => {
        const prompt = promptManager.generate('input.classification', {
          input,
          currentLocation: gameContext.currentLocation,
          nearbyCharacters: gameContext.nearbyCharacters,
          nearbyCharacterDetails: gameContext.nearbyCharacterDetails,
          availableLocations: gameContext.availableLocations || [],
          recentConversation: gameContext.recentConversation,
          recentStoryEvents: gameContext.recentStoryEvents
        });

        // 使用 LLM 服务的结构化输出功能
        const promptTemplate = promptManager.getTemplate('input.classification');
        let classification = await this.llmService.generateStructuredResponse(
          prompt,
          promptTemplate?.schema || {},
          { temperature: 0.1 }
        ) as any;

        this.logger.debug('Raw LLM Response', { classification });
        if (classification && classification.type === 'object' && classification.properties) {
          // 检查 properties 里的内容是数据还是 schema 定义
          const props = classification.properties;
          const firstKey = Object.keys(props)[0];
          const firstProp = firstKey ? props[firstKey] : null;

          // 简单的判断逻辑：
          // 如果字段值是基本类型(string, number, boolean)，那肯定是数据
          // 如果字段值是对象，且没有 type 字段或者 type 字段不是 schema 类型保留字，那可能是嵌套数据
          const isSchemaDefinition = (val: any) => {
            if (!val || typeof val !== 'object') return false;
            return typeof val.type === 'string' &&
              ['string', 'number', 'integer', 'object', 'array', 'boolean', 'null'].includes(val.type);
          };

          if (firstProp !== null && !isSchemaDefinition(firstProp)) {
            this.logger.debug('LLM returned data wrapped in properties, extracting...');
            classification = classification.properties;
          } else {
            this.logger.warn('LLM returned schema structure instead of data', { firstProp });
            // 如果这确实是一个 schema，我们无法从中获取数据，应视为无效
            return null;
          }
        }

        // 规范化结果 (处理 confidence 是对象或 schema 的情况)
        if (classification) {
          // 检查 type 是否为对象，如果是，可能包含嵌套的字段
          if (typeof classification.type === 'object' && classification.type !== null) {
            const typeObj = classification.type;

            // 提取嵌套在 type 对象内的字段到顶层
            if (typeObj.type && typeof typeObj.type === 'string') {
              classification.type = typeObj.type;
            }
            if (typeObj.intent && typeof typeObj.intent === 'string') {
              classification.intent = typeObj.intent;
            }
            if (typeObj.confidence !== undefined) {
              classification.confidence = typeObj.confidence;
            }
            if (typeObj.isDirectSpeech !== undefined) {
              classification.isDirectSpeech = typeObj.isDirectSpeech;
            }

            this.logger.debug('Extracted nested fields from type object', {
              originalType: typeObj,
              extractedType: classification.type,
              extractedIntent: classification.intent,
              extractedConfidence: classification.confidence
            });
          }

          // 检查 intent 是否为对象 (如果是，说明是 schema 定义而不是值)
          if (typeof classification.intent === 'object') {
            this.logger.warn('LLM returned schema object for intent, considering invalid');
            return null;
          }

          // 如果 confidence 是对象，尝试从中提取数值
          if (typeof classification.confidence === 'object' && classification.confidence !== null) {
            const c = classification.confidence;
            if (typeof c.value === 'number') classification.confidence = c.value;
            else if (typeof c.score === 'number') classification.confidence = c.score;
            else if (typeof c.default === 'number') classification.confidence = c.default;
            else if (c.type === 'number' || c.type === 'integer') {
              // LLM 返回了 schema 定义中的 confidence: { type: 'number' }
              this.logger.warn('LLM returned schema for confidence field, considering invalid');
              return null;
            }
          }

          // 规范化数值范围 (如果是 0-1 范围，转换为 0-100)
          if (typeof classification.confidence === 'number') {
            if (classification.confidence <= 1 && classification.confidence > 0) {
              classification.confidence = Math.round(classification.confidence * 100);
            }
          } else {
            // 如果仍然不是数字，设为 0 以触发 fallback
            classification.confidence = 0;
          }
        }

        CacheUtil.set('llm_classification', cacheKey, classification, 300000);
        return classification as InputClassification;
      },
      this.logger,
      'LLM Input Classification Structured'
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
      type: InputType.SPEECH,
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
  private performBasicClassification(input: string, context?: any): InputClassification {
    const trimmedInput = input.trim().toLowerCase();

    // 尝试寻找目标地点
    let targetLocation = 'none';
    if (context?.availableLocations) {
      for (const loc of context.availableLocations) {
        if (trimmedInput.includes(loc.toLowerCase())) {
          targetLocation = loc;
          break;
        }
      }
    }

    // 尝试寻找目标角色
    let targetCharacter = 'none';
    if (context?.nearbyCharacters) {
      // 如果只有一个角色，且是对话意图，默认为该角色
      if (context.nearbyCharacters.length === 1) {
        targetCharacter = context.nearbyCharacters[0];
      } else {
        // 尝试匹配名字
        for (const char of context.nearbyCharacters) {
          if (trimmedInput.includes(char.toLowerCase())) {
            targetCharacter = char;
            break;
          }
        }
      }
    }



    // 检查动作模式
    const actionPatterns = [
      /(走|去|前往|移动|回|回到|返回|返回到|move|go|walk|run|return|back)/i
    ];

    const isMovement = actionPatterns.some(pattern => pattern.test(trimmedInput));
    if (isMovement) {
      this.logger.debug('Basic classification identified movement', { input: trimmedInput });
      return {
        type: InputType.ACTION,
        intent: IntentType.MOVEMENT,
        confidence: 80,
        targetLocation: targetLocation,
        targetCharacter: 'none',
        isDirectSpeech: false,
        isActionDescription: true,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: ['movement'],
        urgency: UrgencyLevel.MEDIUM,
        emotionalTone: EmotionalTone.NEUTRAL
      };
    }

    // 检查环境/位置查询
    const environmentPatterns = [
      /(哪里|什么地方|环境|周围|附近|位置|观察|看到|看下|看看|where am i|what's here|look around|examine|observe)/i
    ];

    if (environmentPatterns.some(pattern => pattern.test(trimmedInput))) {
      return {
        type: InputType.QUESTION,
        intent: IntentType.LOCATION_QUERY,
        confidence: 80,
        isDirectSpeech: true,
        isActionDescription: false,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: ['environment'],
        urgency: UrgencyLevel.MEDIUM,
        emotionalTone: EmotionalTone.NEUTRAL
      };
    }

    // 检查指引请求
    const guidancePatterns = [
      /(该做什么|干什么|做什么|指引|提示|迷路|建议|what should i do|what to do|guide|hint|stuck|help me progress)/i
    ];

    if (guidancePatterns.some(pattern => pattern.test(trimmedInput))) {
      return {
        type: InputType.QUESTION,
        intent: IntentType.GUIDANCE_REQUEST,
        confidence: 85,
        isDirectSpeech: true,
        isActionDescription: false,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: ['guidance'],
        urgency: UrgencyLevel.MEDIUM,
        emotionalTone: EmotionalTone.NEUTRAL
      };
    }

    // 检查系统帮助
    const systemHelpPatterns = [
      /(帮助|怎么玩|规则|指令|菜单|设置|help|how to play|commands|rules|mechanics)/i
    ];

    if (systemHelpPatterns.some(pattern => pattern.test(trimmedInput))) {
      return {
        type: InputType.SYSTEM_QUERY,
        intent: IntentType.SYSTEM_HELP,
        confidence: 90,
        isDirectSpeech: false,
        isActionDescription: false,
        isSystemQuery: true,
        isCompoundAction: false,
        contextualHints: ['system'],
        urgency: UrgencyLevel.MEDIUM,
        emotionalTone: EmotionalTone.NEUTRAL
      };
    }

    const genericActionPatterns = [
      /(做|执行|说|告诉|问|take|use|say|tell|ask)/i
    ];

    const isAction = genericActionPatterns.some(pattern => pattern.test(trimmedInput));
    if (isAction) {
      return {
        type: InputType.ACTION,
        intent: IntentType.DIALOGUE, // Default to dialogue if saying/telling
        confidence: 70,
        isDirectSpeech: true,
        isActionDescription: true,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: ['action'],
        urgency: UrgencyLevel.MEDIUM,
        emotionalTone: EmotionalTone.NEUTRAL
      };
    }

    // 检查问题模式 (作为备选，如果前面更具体的模式没匹配)
    const questionPatterns = [
      /[?？]$/, // 以问号结尾
      /^(what|when|where|who|why|how|什么|何时|哪里|谁|为什么|如何|怎么样)/i
    ];

    const isQuestion = questionPatterns.some(pattern => pattern.test(trimmedInput));
    if (isQuestion) {
      return {
        type: InputType.QUESTION,
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

    // 默认为对话
    return {
      type: InputType.SPEECH,
      intent: IntentType.DIALOGUE,
      confidence: 75,
      targetCharacter: targetCharacter,
      targetLocation: 'none',
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
  private async analyzeCompoundAction(
    input: string,
    gameContext: any
  ): Promise<{
    isCompound: boolean;
    subActions: SubAction[];
    actionSequence: 'sequential' | 'simultaneous';
  }> {
    try {
      const prompt = promptManager.generate('input.compound_action_analysis', {
        input,
        currentLocation: gameContext.currentLocation,
        nearbyCharacters: gameContext.nearbyCharacters
      });

      const response = await this.llmService.generateText(prompt, {
        temperature: 0.1,
        maxTokens: 1000,
        jsonMode: true
      });

      const result = JsonUtils.extractJson<any>(response || '{}');

      // 智能转换子动作格式
      const subActions: SubAction[] = (result.subActions || []).map((action: any, index: number) => {
        return {
          type: action.type || 'interaction',
          intent: action.intent || 'dialogue',
          description: action.description || '',
          target: action.target,
          priority: 5,
          executionOrder: index + 1,
          contextualHints: ['compound_action']
        };
      });

      return {
        isCompound: result.isCompound ?? (subActions.length > 1),
        subActions: subActions,
        actionSequence: result.actionSequence || 'sequential'
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