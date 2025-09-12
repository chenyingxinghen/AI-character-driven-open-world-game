/**
 * 统一的格式化文本响应格式
 * 用于替代需要LLM返回JSON格式数据的场景
 */

/**
 * 格式化文本响应类型
 */
export enum ResponseType {
  INPUT_CLASSIFICATION = 'INPUT_CLASSIFICATION',
  CHARACTER_DIALOGUE = 'CHARACTER_DIALOGUE',
  DIRECTOR_DECISION = 'DIRECTOR_DECISION',
  COMPOUND_ACTION_ANALYSIS = 'COMPOUND_ACTION_ANALYSIS',
  INTENT_CLASSIFICATION = 'INTENT_CLASSIFICATION',
  STORY_EVALUATION = 'STORY_EVALUATION'
}

/**
 * 格式化文本分隔符
 */
export const FIELD_SEPARATORS = {
  SECTION_START: '===',
  SECTION_END: '===',
  FIELD_SEPARATOR: '---',
  LIST_ITEM: '- ',
  KEY_VALUE: ': '
} as const;

/**
 * 输入分类格式化响应模板
 */
export const INPUT_CLASSIFICATION_TEMPLATE = `
=== INPUT_CLASSIFICATION ===
TYPE: {type}
INTENT: {intent}
CONFIDENCE: {confidence}
TARGET_CHARACTER: {targetCharacter}
IS_DIRECT_SPEECH: {isDirectSpeech}
IS_ACTION_DESCRIPTION: {isActionDescription}
IS_SYSTEM_QUERY: {isSystemQuery}
IS_COMPOUND_ACTION: {isCompoundAction}
EXTRACTED_ACTION: {extractedAction}
EXTRACTED_SPEECH: {extractedSpeech}
URGENCY: {urgency}
EMOTIONAL_TONE: {emotionalTone}
CONTEXTUAL_HINTS: {contextualHints}
=== END_CLASSIFICATION ===
`.trim();

/**
 * 角色对话格式化响应模板
 */
export const CHARACTER_DIALOGUE_TEMPLATE = `
=== CHARACTER_DIALOGUE ===
DIALOGUE: {dialogue}
ACTION: {action}
EMOTIONAL_STATE_MOOD: {emotionalStateMood}
EMOTIONAL_STATE_INTENSITY: {emotionalStateIntensity}
CONFIDENCE: {confidence}
=== END_DIALOGUE ===
`.trim();

/**
 * 导演决策格式化响应模板
 */
export const DIRECTOR_DECISION_TEMPLATE = `
=== DIRECTOR_DECISION ===
ACTION: {action}
REASONING: {reasoning}
CONFIDENCE: {confidence}
PARAMETERS: {parameters}
=== END_DECISION ===
`.trim();

/**
 * 复合动作分析格式化响应模板
 */
export const COMPOUND_ACTION_TEMPLATE = `
=== COMPOUND_ACTION_ANALYSIS ===
IS_COMPOUND: {isCompound}
ACTION_SEQUENCE: {actionSequence}
SUB_ACTIONS: {subActions}
=== END_COMPOUND_ACTION ===
`.trim();

/**
 * 意图分类格式化响应模板
 */
export const INTENT_CLASSIFICATION_TEMPLATE = `
=== INTENT_CLASSIFICATION ===
INTENT: {intent}
CONFIDENCE: {confidence}
EMOTIONAL_TONE: {emotionalTone}
URGENCY: {urgency}
ENTITIES: {entities}
=== END_INTENT ===
`.trim();

/**
 * 格式化文本生成器
 */
export class FormattedTextGenerator {
  /**
   * 生成输入分类提示词
   */
  static generateInputClassificationPrompt(
    input: string,
    context: {
      sessionId: string;
      currentLocation: string;
      nearbyCharacters: string[];
      recentConversation: string[];
    }
  ): string {
    return `
你是一个游戏输入分类系统。请分析以下玩家输入并提供详细的分类结果。

玩家输入: "${input}"

上下文信息:
- 会话ID: ${context.sessionId}
- 当前位置: ${context.currentLocation}
- 附近角色: ${context.nearbyCharacters.join(', ')}
- 最近对话: ${context.recentConversation.slice(-3).join(' | ')}

请严格按照以下格式返回分类结果：

=== INPUT_CLASSIFICATION ===
TYPE: [speech|action|question|system_query|compound_action 中的一个]
INTENT: [dialogue|movement|observation|inquiry|greeting|confirmation|system_help|story_background|story_recap|compound 中的一个]
CONFIDENCE: [0-100的数字]
TARGET_CHARACTER: [如果有特定目标角色则填写，否则填写none]
IS_DIRECT_SPEECH: [true或false]
IS_ACTION_DESCRIPTION: [true或false]
IS_SYSTEM_QUERY: [true或false]
IS_COMPOUND_ACTION: [true或false]
EXTRACTED_ACTION: [如果识别出具体动作则填写，否则填写none]
EXTRACTED_SPEECH: [如果识别出具体对话则填写，否则填写none]
URGENCY: [low|medium|high 中的一个]
EMOTIONAL_TONE: [neutral|positive|negative|excited|concerned 中的一个]
CONTEXTUAL_HINTS: [上下文提示1, 上下文提示2, ...]
=== END_CLASSIFICATION ===

注意：请严格按照上述格式输出，不要添加额外的解释或说明。
    `.trim();
  }

  /**
   * 生成角色对话提示词
   */
  static generateCharacterDialoguePrompt(
    character: any,
    context: any,
    prompt: string
  ): string {
    return `
你是游戏角色 ${character.name}，拥有以下特性：
- 个性特征: ${JSON.stringify(character.personality)}
- 当前情绪状态: ${JSON.stringify(character.emotionalState)}
- 游戏上下文: ${JSON.stringify(context)}

玩家说: "${prompt}"

请以该角色的身份回应，严格按照以下格式输出：

=== CHARACTER_DIALOGUE ===
DIALOGUE: [角色的回应对话]
ACTION: [角色的动作描述，如果没有填写none]
EMOTIONAL_STATE_MOOD: [当前情绪：neutral|happy|sad|angry|excited|confused|concerned等]
EMOTIONAL_STATE_INTENSITY: [情绪强度：0-100的数字]
CONFIDENCE: [回应的置信度：0.0-1.0的小数]
=== END_DIALOGUE ===

注意：请严格按照上述格式输出，不要添加额外的解释或说明。
    `.trim();
  }

  /**
   * 生成导演决策提示词
   */
  static generateDirectorDecisionPrompt(
    context: any,
    evaluation: any
  ): string {
    return `
你是游戏导演，负责做出叙事决策。

当前上下文: ${JSON.stringify(context)}
评估结果: ${JSON.stringify(evaluation)}

请分析当前情况并做出决策，严格按照以下格式输出：

=== DIRECTOR_DECISION ===
ACTION: [CONTINUE|ADVANCE_PLOT|INTRODUCE_CONFLICT|CHANGE_SCENE|ADD_CHARACTER|TRIGGER_EVENT等决策类型]
REASONING: [决策理由的简要说明]
CONFIDENCE: [决策的置信度：0.0-1.0的小数]
PARAMETERS: [额外参数的键值对，格式为key1=value1,key2=value2，如果没有填写none]
=== END_DECISION ===

注意：请严格按照上述格式输出，不要添加额外的解释或说明。
    `.trim();
  }

  /**
   * 生成复合动作分析提示词
   */
  static generateCompoundActionPrompt(input: string): string {
    return `
你是一个游戏动作分析系统。请分析以下玩家输入是否包含复合动作（多个动作的组合）。

玩家输入: "${input}"

请分析并严格按照以下格式输出：

=== COMPOUND_ACTION_ANALYSIS ===
IS_COMPOUND: [true或false]
ACTION_SEQUENCE: [sequential|simultaneous]
SUB_ACTIONS: [如果是复合动作，列出子动作：action1|action2|action3，否则填写none]
=== END_COMPOUND_ACTION ===

注意：请严格按照上述格式输出，不要添加额外的解释或说明。
    `.trim();
  }

  /**
   * 生成意图分类提示词
   */
  static generateIntentClassificationPrompt(
    input: string,
    context?: any
  ): string {
    return `
分析用户输入的意图：

用户输入: "${input}"
${context ? `上下文: ${JSON.stringify(context)}` : ''}

请分析并严格按照以下格式输出：

=== INTENT_CLASSIFICATION ===
INTENT: [DIALOGUE|MOVEMENT|LOCATION_QUERY|CHARACTER_INTERACTION|UNKNOWN等意图类型]
CONFIDENCE: [0.0-1.0的小数]
EMOTIONAL_TONE: [NEUTRAL|POSITIVE|NEGATIVE|EXCITED|CONCERNED等情绪色调]
URGENCY: [LOW|MEDIUM|HIGH]
ENTITIES: [提取的实体，格式为type:value,type:value，如character:张三,location:图书馆，如果没有填写none]
=== END_INTENT ===

注意：请严格按照上述格式输出，不要添加额外的解释或说明。
    `.trim();
  }
}

/**
 * 预定义的错误响应
 */
export const ERROR_RESPONSES = {
  PARSING_FAILED: '解析格式化文本失败',
  INVALID_FORMAT: '无效的格式化文本格式',
  MISSING_REQUIRED_FIELDS: '缺少必需字段',
  CONFIDENCE_OUT_OF_RANGE: '置信度超出有效范围',
  UNKNOWN_TYPE: '未知的响应类型'
} as const;

/**
 * 格式化文本响应接口
 */
export interface FormattedTextResponse {
  type: ResponseType;
  content: string;
  success: boolean;
  error?: string;
}