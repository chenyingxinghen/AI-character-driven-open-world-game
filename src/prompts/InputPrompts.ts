import { PromptTemplate } from './types';

/**
 * 输入分类相关的提示词模板
 */

export interface ClassificationContext {
  input: string;
  currentLocation: string;
  nearbyCharacters: string[];
  nearbyCharacterDetails?: string[];
  availableLocations: string[];
  recentConversation: string[];
  recentStoryEvents?: string[];
}

export const InputPrompts = {
  /**
   * 生成输入分类的 Prompt
   */
  classification: {
    name: 'input.classification',
    description: '分析玩家输入并分类意图',
    schema: {
      type: "object",
      properties: {
        type: { type: "string" },
        intent: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 100 },
        targetCharacter: { type: "string" },
        targetLocation: { type: "string" },
        isDirectSpeech: { type: "boolean" },
        isActionDescription: { type: "boolean" },
        isSystemQuery: { type: "boolean" },
        isCompoundAction: { type: "boolean" },
        extractedAction: { type: "string" },
        extractedSpeech: { type: "string" },
        urgency: { type: "string" },
        emotionalTone: { type: "string" },
        contextualHints: { type: "array", items: { type: "string" } }
      },
      required: ["type", "intent", "confidence", "isCompoundAction"]
    },
    template: (context: ClassificationContext): string => `Analyze the following player input in an AI-driven open world game.
Input: "${context.input}"
Current Location: ${context.currentLocation}

Recent Conversation (Speaker: Content):
${context.recentConversation.length > 0 ? context.recentConversation.slice(-1).join('\n') : 'No recent conversation.'}

Task: Determine the user's intent, type of input, and extract relevant entities.


Output MUST be a valid JSON object:
{
  "type": "speech|action|question|system_query|compound_action",
  "intent": "dialogue|movement|character_interaction|unknown",
  "confidence": 0-100,
  "targetCharacter": "The identified character name or 'none'",
  "targetLocation": "The identified location name or 'none'",
  "extractedAction": "summary of action if any",
  "extractedSpeech": "extracted dialogue text if any",
  "urgency": "low|medium|high|urgent",
  "emotionalTone": "positive|negative|neutral|excited|angry|sad|fearful|confused",
  "contextualHints": ["hint1", "hint2"]
}
`  } as PromptTemplate<ClassificationContext>,

  /**
   * 生成复合动作分析的 Prompt
   */
  compoundActionAnalysis: {
    name: 'input.compound_action_analysis',
    description: '分解复合动作输入',
    template: (context: { input: string, currentLocation: string, nearbyCharacters: string[] }): string => `分析玩家的复合动作输入："${context.input}"
当前位置：${context.currentLocation}
附近角色：${context.nearbyCharacters.join(', ')}

请将此输入分解为一系列子动作（subActions）。
每个子动作应包含：
- type: movement | observation | dialogue | interaction
- intent: 动作的具体意图
- description: 动作的详细描述
- target: 动作的目标（如果有）

请以 JSON 格式返回：
{
  "isCompound": true,
  "actionSequence": "sequential",
  "subActions": [
    {
      "type": "interaction",
      "intent": "dialogue",
      "description": "与某人交谈",
      "target": "某人"
    }
  ]
}
直接返回 JSON。`
  } as PromptTemplate<{ input: string, currentLocation: string, nearbyCharacters: string[] }>,

  /**
   * 生成复合动作分析的 Prompt (格式化文本版)
   */
  compoundActionForm: {
    name: 'input.compound_action_form',
    description: '分解复合动作输入 (格式化文本版)',
    template: (context: { input: string, template: string, sequences: string }): string => `
你是一个游戏动作分析系统。请分析以下玩家输入是否包含复合动作（多个动作的组合）。

玩家输入: "${context.input}"

请分析并严格按照以下格式输出：

${context.template}

字段说明：
- IS_COMPOUND: 是否为复合动作，布尔值: true | false
- ACTION_SEQUENCE: 执行顺序类型，可选: ${context.sequences}
- SUB_ACTIONS: 子动作列表，用 | 符号分隔，每个子动作为描述字符串

注意：请严格按照上述格式输出，不要添加额外的解释或说明。
    `
  } as PromptTemplate<{ input: string, template: string, sequences: string }>
};
