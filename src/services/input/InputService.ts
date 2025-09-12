import { LLMService } from '../llm/LLMService';

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

export class InputService {
  constructor(private llm: LLMService) {}

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
      const llmResult = await this.llm.generateText(`Classify this input: ${input}`);
      return {
        ...basicClassification,
        intent: basicClassification.intent,
        confidence: Math.max(basicClassification.confidence, 50)
      };
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
        intent: 'inquiry',
        confidence: 85,
        isDirectSpeech: true,
        isActionDescription: false,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: [],
        urgency: 'medium',
        emotionalTone: 'neutral'
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
        intent: 'movement',
        confidence: 80,
        isDirectSpeech: false,
        isActionDescription: true,
        isSystemQuery: false,
        isCompoundAction: false,
        contextualHints: [],
        urgency: 'medium',
        emotionalTone: 'neutral'
      };
    }
    
    // Default to speech
    return {
      type: 'speech',
      intent: 'dialogue',
      confidence: 75,
      isDirectSpeech: true,
      isActionDescription: false,
      isSystemQuery: false,
      isCompoundAction: false,
      contextualHints: [],
      urgency: 'medium',
      emotionalTone: 'neutral'
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