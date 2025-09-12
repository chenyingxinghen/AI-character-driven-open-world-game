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

export class RealInputClassificationService {
  constructor(private llm: LLMService) {}

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
    // 构建提示词
    const prompt = `
      你是一个游戏输入分类系统。请分析以下玩家输入并提供详细的分类结果。
      
      玩家输入: "${input}"
      
      上下文信息:
      - 会话ID: ${context.sessionId}
      - 当前位置: ${context.currentLocation}
      - 附近角色: ${context.nearbyCharacters.join(', ')}
      - 最近对话: ${context.recentConversation.slice(-3).join(' | ')}
      
      请以JSON格式返回分类结果:
      {
        "type": "speech|action|question|system_query|compound_action",
        "intent": "dialogue|movement|observation|inquiry|greeting|confirmation|system_help|story_background|story_recap|compound",
        "confidence": 0-100的数字,
        "targetCharacter": "如果有特定目标角色则填写",
        "isDirectSpeech": boolean,
        "isActionDescription": boolean,
        "isSystemQuery": boolean,
        "isCompoundAction": boolean,
        "extractedAction": "如果识别出具体动作则填写",
        "extractedSpeech": "如果识别出具体对话则填写",
        "contextualHints": ["上下文提示1", "上下文提示2"],
        "urgency": "low|medium|high",
        "emotionalTone": "neutral|positive|negative|excited|concerned"
      }
    `;

    try {
      const response = await this.llm.generateText(prompt, {
        maxTokens: 300,
        temperature: 0.3
      });
      
      // 解析LLM响应
      const parsedResponse = JSON.parse(response);
      
      // 验证必要字段
      if (!parsedResponse.type || !parsedResponse.intent || parsedResponse.confidence === undefined) {
        throw new Error('Invalid classification response format');
      }
      
      // 返回分类结果
      return {
        type: parsedResponse.type,
        intent: parsedResponse.intent,
        confidence: Math.min(100, Math.max(0, parsedResponse.confidence)),
        targetCharacter: parsedResponse.targetCharacter,
        isDirectSpeech: parsedResponse.isDirectSpeech || false,
        isActionDescription: parsedResponse.isActionDescription || false,
        isSystemQuery: parsedResponse.isSystemQuery || false,
        isCompoundAction: parsedResponse.isCompoundAction || false,
        extractedAction: parsedResponse.extractedAction,
        extractedSpeech: parsedResponse.extractedSpeech,
        contextualHints: parsedResponse.contextualHints || [],
        urgency: parsedResponse.urgency || 'medium',
        emotionalTone: parsedResponse.emotionalTone || 'neutral'
      };
    } catch (error) {
      console.error('Input classification failed:', error);
      
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
    // 构建提示词
    const prompt = `
      你是一个游戏动作分析系统。请分析以下玩家输入是否包含复合动作（多个动作的组合）。
      
      玩家输入: "${input}"
      
      请以JSON格式返回分析结果:
      {
        "isCompound": boolean,
        "subActions": [
          {
            "type": "movement|observation|dialogue|interaction",
            "intent": "movement|observation|inquiry|dialogue|greeting|confirmation",
            "description": "动作描述",
            "target": "目标对象（如果有）",
            "location": "位置（如果有）",
            "priority": 1-10的数字,
            "executionOrder": 执行顺序数字,
            "contextualHints": ["上下文提示1", "上下文提示2"]
          }
        ],
        "actionSequence": "sequential|simultaneous"
      }
    `;

    try {
      const response = await this.llm.generateText(prompt, {
        maxTokens: 400,
        temperature: 0.4
      });
      
      // 解析LLM响应
      const parsedResponse = JSON.parse(response);
      
      return {
        isCompound: parsedResponse.isCompound || false,
        subActions: parsedResponse.subActions || [],
        actionSequence: parsedResponse.actionSequence || 'sequential'
      };
    } catch (error) {
      console.error('Compound action analysis failed:', error);
      
      // 如果分析失败，返回默认值
      return {
        isCompound: false,
        subActions: [],
        actionSequence: 'sequential'
      };
    }
  }
}