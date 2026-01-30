/**
 * 统一的格式化文本响应格式
 * 用于替代需要LLM返回JSON格式数据的场景
 */

// 导入相关枚举类型
import { IntentType, EmotionalTone, UrgencyLevel, InputType, EntityType } from '../../domains/input/valueObjects';
import { promptManager } from '../../prompts';

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



import { FormattedResponseTemplates } from '../../prompts/SystemPrompts';

// 定义角色情绪状态枚举
const CHARACTER_MOODS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'excited', 'calm', 'surprised', 'confused'] as const;

// 定义导演动作类型枚举
const DIRECTOR_ACTIONS = ['CONTINUE', 'ADVANCE_PLOT', 'INTRODUCE_CONFLICT', 'escalate_tension', 'character_response', 'guidance', 'environmental_event', 'plot_advancement'] as const;

// 定义动作执行顺序类型枚举
const ACTION_SEQUENCES = ['sequential', 'simultaneous'] as const;

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
    return promptManager.generate('system.input_classification', {
      input,
      sessionId: context.sessionId,
      currentLocation: context.currentLocation,
      nearbyCharacters: context.nearbyCharacters,
      recentConversation: context.recentConversation.slice(-3),
      inputTypes: Object.values(InputType).join(' | '),
      intentTypes: Object.values(IntentType).join(' | '),
      urgencyLevels: Object.values(UrgencyLevel).join(' | '),
      emotionalTones: Object.values(EmotionalTone).join(' | ')
    });
  }

  /**
   * 生成角色对话提示词
   */
  static generateCharacterDialoguePrompt(
    character: any,
    context: any,
    prompt: string
  ): string {
    return promptManager.generate('system.character_dialogue', {
      characterName: character.name,
      personality: JSON.stringify(character.personality),
      emotionalState: JSON.stringify(character.emotionalState),
      context: JSON.stringify(context),
      userInput: prompt,
      moods: CHARACTER_MOODS.join(' | ')
    });
  }

  /**
   * 生成导演决策提示词
   */
  static generateDirectorDecisionPrompt(
    context: any,
    evaluation: any
  ): string {
    return promptManager.generate('system.director_decision', {
      context: JSON.stringify(context),
      evaluation: JSON.stringify(evaluation),
      actions: DIRECTOR_ACTIONS.join(' | ')
    });
  }

  /**
   * 生成复合动作分析提示词
   */
  static generateCompoundActionPrompt(input: string): string {
    return promptManager.generate('input.compound_action_form', {
      input,
      template: FormattedResponseTemplates.COMPOUND_ACTION,
      sequences: ACTION_SEQUENCES.join(' | ')
    });
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
    return promptManager.generate('system.location_creation', {
      locationName,
      currentLocation: context.currentLocation,
      gameStyle: context.gameStyle
    });
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