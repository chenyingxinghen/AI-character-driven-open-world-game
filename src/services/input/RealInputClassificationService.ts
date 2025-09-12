import { LLMService } from '../llm/LLMService';
import { FormattedTextGenerator } from '../llm/FormattedTextResponse';
import { FormattedTextExtractorService, InputClassificationResult } from '../llm/FormattedTextExtractorService';
import { Logger } from '../Logger';

export interface InputClassification {
  type: 'speech' | 'action' | 'question' | 'system_query' | 'compound_action';
  intent: 'dialogue' | 'movement' | 'observation' | 'inquiry' | 'greeting' | 'confirmation' | 'system_help' | 'story_background' | 'story_recap' | 'compound';
  confidence: number; // 0-100
  targetCharacter?: string;
  isDirectSpeech: boolean;
  isActionDescription: boolean;
  isSystemQuery: boolean;
  isCompoundAction: boolean;
  extractedAction?: string;
  extractedSpeech?: string;
  contextualHints: string[];
  urgency: 'low' | 'medium' | 'high';
  emotionalTone: 'neutral' | 'positive' | 'negative' | 'excited' | 'concerned';
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

export class RealInputClassificationService {
  private extractor: FormattedTextExtractorService;
  private logger: Logger;

  constructor(private llm: LLMService, logger?: Logger) {
    this.logger = logger || console as any;
    this.extractor = new FormattedTextExtractorService(this.logger);
  }

  /**
   * 分类玩家输入
   */
  async classifyInput(
    input: string,
    context: {
      sessionId: string;
      recentConversation: string[];
      currentLocation: string;
      nearbyCharacters: string[];
      pendingActions: ActionState[];
    }
  ): Promise<InputClassification> {
    try {
      // 生成格式化文本提示词
      const prompt = FormattedTextGenerator.generateInputClassificationPrompt(input, {
        sessionId: context.sessionId,
        currentLocation: context.currentLocation,
        nearbyCharacters: context.nearbyCharacters,
        recentConversation: context.recentConversation
      });

      // 调用LLM生成响应
      const response = await this.llm.generateText(prompt, {
        maxTokens: 400,
        temperature: 0.3
      });
      
      // 使用格式化文本提取器解析响应
      const result = this.extractor.extractInputClassification(response);
      
      // 转换为InputClassification格式
      return {
        type: result.type,
        intent: result.intent,
        confidence: result.confidence,
        targetCharacter: result.targetCharacter,
        isDirectSpeech: result.isDirectSpeech,
        isActionDescription: result.isActionDescription,
        isSystemQuery: result.isSystemQuery,
        isCompoundAction: result.isCompoundAction,
        extractedAction: result.extractedAction,
        extractedSpeech: result.extractedSpeech,
        contextualHints: result.contextualHints,
        urgency: result.urgency,
        emotionalTone: result.emotionalTone
      };
    } catch (error) {
      this.logger.error('Input classification failed:', error as Error);
      
      // 如果LLM分类失败，使用基础分类
      return this.performBasicClassification(input);
    }
  }

  /**
   * 基础分类（当LLM不可用时的备选方案）
   */
  private performBasicClassification(input: string): InputClassification {
    const trimmedInput = input.trim().toLowerCase();
    
    // 检查问候语
    const greetingPatterns = [
      /(hello|hi|hey|你好|您好|早上好|下午好|晚上好)/i,
      /(good morning|good afternoon|good evening)/i
    ];
    
    const isGreeting = greetingPatterns.some(pattern => pattern.test(trimmedInput));
    if (isGreeting) {
      return {
        type: 'speech',
        intent: 'greeting',
        confidence: 90,
        isDirectSpeech: true,
        isActionDescription: false,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: ['greeting'],
        urgency: 'low',
        emotionalTone: 'positive'
      };
    }
    
    // 检查问题模式
    const questionPatterns = [
      /[?？]$/, // 以问号结尾
      /^(what|when|where|who|why|how|which|what\'s|whose|is|are|can|could|would|should|do|does|did|will|shall|may|might|must|have|has|had|was|were|有没有|什么|何时|哪里|谁|为什么|如何|怎么样|是否|能|可以|应该|会|要|想|需要)/i
    ];
    
    const isQuestion = questionPatterns.some(pattern => pattern.test(trimmedInput));
    if (isQuestion) {
      return {
        type: 'question',
        intent: 'inquiry',
        confidence: 85,
        isDirectSpeech: true,
        isActionDescription: false,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: ['question'],
        urgency: 'medium',
        emotionalTone: 'neutral'
      };
    }
    
    // 检查动作模式
    const actionPatterns = [
      /(go|move|walk|run|travel|前往|走|移动|跑|旅行)/i,
      /(look|observe|check|examine|inspect|看|观察|检查|审视)/i,
      /(take|grab|pick up|get|拿|取|捡|获取)/i,
      /(open|close|unlock|lock|打开|关闭|解锁|上锁)/i
    ];
    
    const isAction = actionPatterns.some(pattern => pattern.test(trimmedInput));
    if (isAction) {
      return {
        type: 'action',
        intent: 'movement',
        confidence: 80,
        isDirectSpeech: false,
        isActionDescription: true,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: ['action'],
        urgency: 'medium',
        emotionalTone: 'neutral'
      };
    }
    
    // 默认为对话
    return {
      type: 'speech',
      intent: 'dialogue',
      confidence: 75,
      isDirectSpeech: true,
      isActionDescription: false,
      isSystemQuery: false,
      isCompoundAction: false,
      contextualHints: ['dialogue'],
      urgency: 'medium',
      emotionalTone: 'neutral'
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
      const response = await this.llm.generateText(prompt, {
        maxTokens: 400,
        temperature: 0.4
      });
      
      // 使用格式化文本提取器解析响应
      const result = this.extractor.extractCompoundAction(response);
      
      // 转换子动作格式
      const subActions: SubAction[] = result.subActions.map((action, index) => ({
        type: 'interaction' as any,
        intent: 'dialogue' as any,
        description: action,
        priority: 5,
        executionOrder: index + 1,
        contextualHints: []
      }));
      
      return {
        isCompound: result.isCompound,
        subActions: subActions,
        actionSequence: result.actionSequence
      };
    } catch (error) {
      this.logger.error('Compound action analysis failed:', error as Error);
      
      // 如果分析失败，返回默认值
      return {
        isCompound: false,
        subActions: [],
        actionSequence: 'sequential'
      };
    }
  }
}