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
 * 统一的输入分类格式化响应模板
 * 合并了原来的INPUT_CLASSIFICATION和INTENT_CLASSIFICATION
 */
export const INPUT_CLASSIFICATION_TEMPLATE = `
=== INPUT_CLASSIFICATION ===
TYPE: {type}
INTENT: {intent}
CONFIDENCE: {confidence}
TARGET_CHARACTER: {targetCharacter}
TARGET_LOCATION: {targetLocation}
IS_DIRECT_SPEECH: {isDirectSpeech}
IS_ACTION_DESCRIPTION: {isActionDescription}
IS_SYSTEM_QUERY: {isSystemQuery}
IS_COMPOUND_ACTION: {isCompoundAction}
EXTRACTED_ACTION: {extractedAction}
EXTRACTED_SPEECH: {extractedSpeech}
URGENCY: {urgency}
EMOTIONAL_TONE: {emotionalTone}
ENTITIES: {entities}
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

${INPUT_CLASSIFICATION_TEMPLATE}

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

${CHARACTER_DIALOGUE_TEMPLATE}

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

${DIRECTOR_DECISION_TEMPLATE}

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

${COMPOUND_ACTION_TEMPLATE}

注意：请严格按照上述格式输出，不要添加额外的解释或说明。
    `.trim();
  }

  /**
   * 生成位置创建提示词（当目标位置不存在时动态生成）
   */
  static generateLocationCreationPrompt(
    locationName: string,
    context: {
      currentLocation: string;
      gameStyle: string;
    }
  ): string {
    return `
你是一个游戏世界设计师。玩家想要前往"${locationName}"，但这个位置在游戏世界中不存在。请为这个位置创建一个合理的描述。

上下文：
- 当前位置: ${context.currentLocation}
- 游戏风格: ${context.gameStyle}

请返回一个简洁但生动的位置描述（不超过50个字）：
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