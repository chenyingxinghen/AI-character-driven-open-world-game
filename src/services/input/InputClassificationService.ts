import { LLMService } from '../llm/LLMService';
import { FormattedTextGenerator } from '../llm/FormattedTextResponse';
import { FormattedTextExtractorService } from '../llm/FormattedTextExtractorService';
import { Logger } from '../Logger';
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

export class InputClassificationService {
  private extractor: FormattedTextExtractorService;
  private logger: Logger;

  constructor(private llm: LLMService, logger?: Logger) {
    this.logger = logger || console as any;
    this.extractor = new FormattedTextExtractorService(this.logger);
  }

  async classify(input: string): Promise<ClassificationResult> {
    const res = await this.llm.generateText(`Classify this input: ${input}`);
    return {
      intent: 'unknown',
      confidence: 0,
      payload: { text: res }
    };
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
    // For the refactored version, we'll use a simplified approach
    // In a full implementation, this would be more complex
    
    const basicClassification = this.performBasicClassification(input);
    
    // If basic classification confidence is low, use LLM for deeper analysis
    if (basicClassification.confidence < 70) {
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
          confidence: Math.max(result.confidence, 50),
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
        this.logger.error('LLM classification failed:', error as Error);
        return {
          ...basicClassification,
          confidence: Math.max(basicClassification.confidence, 50)
        };
      }
    }
    
    return basicClassification;
  }

  /**
   * 基础分类
   */
  private performBasicClassification(input: string): InputClassification {
    const trimmedInput = input.trim().toLowerCase();
    
    // Check for question patterns
    const questionPatterns = [
      /^.*[?？]$/, // Ends with question mark
      /^(what|when|where|who|why|how|什么|何时|哪里|谁|为什么|如何|怎么样).*[?？]?$/,
      /^(can|could|would|should|is|are|do|does|will|shall|能不能|可以|应该|是|会|能).*(吗|么|嘛)[?？]?$/,
    ];
    
    const isQuestion = questionPatterns.some(pattern => 
      new RegExp(pattern).test(trimmedInput)
    );
    
    if (isQuestion) {
      return {
        type: 'question',
        intent: IntentType.INFORMATION_QUERY,
        confidence: 85,
        isDirectSpeech: true,
        isActionDescription: false,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: [],
        urgency: UrgencyLevel.MEDIUM,
        emotionalTone: EmotionalTone.NEUTRAL
      };
    }
    
    // Check for action patterns
    const actionPatterns = [
      /.*走.*|.*移动.*|.*去.*|.*前往.*/,
      /.*看.*|.*观察.*|.*检查.*/,
      /.*说.*|.*告诉.*|.*问.*/
    ];
    
    const isAction = actionPatterns.some(pattern => 
      new RegExp(pattern).test(trimmedInput)
    );
    
    if (isAction) {
      return {
        type: 'action',
        intent: IntentType.MOVEMENT,
        confidence: 80,
        isDirectSpeech: false,
        isActionDescription: true,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: [],
        urgency: UrgencyLevel.MEDIUM,
        emotionalTone: EmotionalTone.NEUTRAL
      };
    }
    
    // Default to speech
    return {
      type: 'speech',
      intent: IntentType.DIALOGUE,
      confidence: 75,
      isDirectSpeech: true,
      isActionDescription: false,
      isSystemQuery: false,
      isCompoundAction: false,
      contextualHints: [],
      urgency: UrgencyLevel.MEDIUM,
      emotionalTone: EmotionalTone.NEUTRAL
    };
  }

  /**
   * 分析复合动作
   */
  private analyzeCompoundAction(input: string): {
    isCompound: boolean;
    subActions: SubAction[];
    actionSequence: 'sequential' | 'simultaneous';
  } {
    // Simplified implementation for refactored version
    return {
      isCompound: false,
      subActions: [],
      actionSequence: 'sequential'
    };
  }
}