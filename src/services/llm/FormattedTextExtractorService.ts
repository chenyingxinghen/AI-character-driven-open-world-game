/**
 * 统一的格式化文本提取器服务
 * 用于将LLM返回的格式化文本转换为结构化数据
 */

import { 
  ResponseType, 
  FIELD_SEPARATORS, 
  ERROR_RESPONSES,
  FormattedTextResponse 
} from './FormattedTextResponse';
import { Logger } from '../Logger';

/**
 * 输入分类结果接口
 */
export interface InputClassificationResult {
  type: 'speech' | 'action' | 'question' | 'system_query' | 'compound_action';
  intent: 'dialogue' | 'movement' | 'observation' | 'inquiry' | 'greeting' | 'confirmation' | 'system_help' | 'story_background' | 'story_recap' | 'compound';
  confidence: number;
  targetCharacter?: string;
  targetLocation?: string;
  isDirectSpeech: boolean;
  isActionDescription: boolean;
  isSystemQuery: boolean;
  isCompoundAction: boolean;
  extractedAction?: string;
  extractedSpeech?: string;
  urgency: 'low' | 'medium' | 'high';
  emotionalTone: 'neutral' | 'positive' | 'negative' | 'excited' | 'concerned';
  entities?: Array<{ type: string; value: string }>;
  contextualHints: string[];
}

/**
 * 角色对话结果接口
 */
export interface CharacterDialogueResult {
  dialogue: string;
  action?: string;
  emotionalState: {
    mood: string;
    intensity: number;
  };
  confidence: number;
}

/**
 * 导演决策结果接口
 */
export interface DirectorDecisionResult {
  action: string;
  reasoning: string;
  confidence: number;
  parameters: Record<string, any>;
}

/**
 * 复合动作分析结果接口
 */
export interface CompoundActionResult {
  isCompound: boolean;
  actionSequence: 'sequential' | 'simultaneous';
  subActions: string[];
}

/**
 * 意图分类结果接口
 */
export interface IntentClassificationResult {
  intent: string;
  confidence: number;
  emotionalTone: string;
  urgency: string;
  entities: Array<{ type: string; value: string }>;
}

/**
 * 格式化文本提取器服务
 */
export class FormattedTextExtractorService {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * 提取输入分类结果
   */
  extractInputClassification(formattedText: string): InputClassificationResult {
    try {
      const section = this.extractSection(formattedText, 'INPUT_CLASSIFICATION', 'END_CLASSIFICATION');
      const fields = this.parseFields(section);

      const result: InputClassificationResult = {
        type: this.validateAndGetField(fields, 'TYPE', ['speech', 'action', 'question', 'system_query', 'compound_action']) as any,
        intent: this.validateAndGetField(fields, 'INTENT', ['dialogue', 'movement', 'observation', 'inquiry', 'greeting', 'confirmation', 'system_help', 'story_background', 'story_recap', 'compound']) as any,
        confidence: this.parseNumber(fields.CONFIDENCE, 0, 100),
        targetCharacter: this.getOptionalField(fields, 'TARGET_CHARACTER'),
        targetLocation: this.getOptionalField(fields, 'TARGET_LOCATION'),
        isDirectSpeech: this.parseBoolean(fields.IS_DIRECT_SPEECH),
        isActionDescription: this.parseBoolean(fields.IS_ACTION_DESCRIPTION),
        isSystemQuery: this.parseBoolean(fields.IS_SYSTEM_QUERY),
        isCompoundAction: this.parseBoolean(fields.IS_COMPOUND_ACTION),
        extractedAction: this.getOptionalField(fields, 'EXTRACTED_ACTION'),
        extractedSpeech: this.getOptionalField(fields, 'EXTRACTED_SPEECH'),
        urgency: this.validateAndGetField(fields, 'URGENCY', ['low', 'medium', 'high']) as any,
        emotionalTone: this.validateAndGetField(fields, 'EMOTIONAL_TONE', ['neutral', 'positive', 'negative', 'excited', 'concerned']) as any,
        entities: this.parseEntities(fields.ENTITIES),
        contextualHints: this.parseList(fields.CONTEXTUAL_HINTS)
      };

      this.logger.info('Successfully extracted input classification result');
      return result;
    } catch (error) {
      this.logger.error('Failed to extract input classification result:', error as Error);
      return this.getDefaultInputClassification();
    }
  }

  /**
   * 提取角色对话结果
   */
  extractCharacterDialogue(formattedText: string): CharacterDialogueResult {
    try {
      const section = this.extractSection(formattedText, 'CHARACTER_DIALOGUE', 'END_DIALOGUE');
      const fields = this.parseFields(section);

      const result: CharacterDialogueResult = {
        dialogue: this.getRequiredField(fields, 'DIALOGUE'),
        action: this.getOptionalField(fields, 'ACTION'),
        emotionalState: {
          mood: this.getRequiredField(fields, 'EMOTIONAL_STATE_MOOD'),
          intensity: this.parseNumber(fields.EMOTIONAL_STATE_INTENSITY, 0, 100)
        },
        confidence: this.parseNumber(fields.CONFIDENCE, 0.0, 1.0)
      };

      this.logger.info('Successfully extracted character dialogue result');
      return result;
    } catch (error) {
      this.logger.error('Failed to extract character dialogue result:', error as Error);
      return this.getDefaultCharacterDialogue();
    }
  }

  /**
   * 提取导演决策结果
   */
  extractDirectorDecision(formattedText: string): DirectorDecisionResult {
    try {
      const section = this.extractSection(formattedText, 'DIRECTOR_DECISION', 'END_DECISION');
      const fields = this.parseFields(section);

      const result: DirectorDecisionResult = {
        action: this.getRequiredField(fields, 'ACTION'),
        reasoning: this.getRequiredField(fields, 'REASONING'),
        confidence: this.parseNumber(fields.CONFIDENCE, 0.0, 1.0),
        parameters: this.parseParameters(fields.PARAMETERS)
      };

      this.logger.info('Successfully extracted director decision result');
      return result;
    } catch (error) {
      this.logger.error('Failed to extract director decision result:', error as Error);
      return this.getDefaultDirectorDecision();
    }
  }

  /**
   * 提取复合动作分析结果
   */
  extractCompoundAction(formattedText: string): CompoundActionResult {
    try {
      const section = this.extractSection(formattedText, 'COMPOUND_ACTION_ANALYSIS', 'END_COMPOUND_ACTION');
      const fields = this.parseFields(section);

      const result: CompoundActionResult = {
        isCompound: this.parseBoolean(fields.IS_COMPOUND),
        actionSequence: this.validateAndGetField(fields, 'ACTION_SEQUENCE', ['sequential', 'simultaneous']) as any,
        subActions: this.parseList(fields.SUB_ACTIONS, '|')
      };

      this.logger.info('Successfully extracted compound action result');
      return result;
    } catch (error) {
      this.logger.error('Failed to extract compound action result:', error as Error);
      return this.getDefaultCompoundAction();
    }
  }

  /**
   * 提取意图分类结果
   */
  extractIntentClassification(formattedText: string): IntentClassificationResult {
    try {
      const section = this.extractSection(formattedText, 'INTENT_CLASSIFICATION', 'END_INTENT');
      const fields = this.parseFields(section);

      const result: IntentClassificationResult = {
        intent: this.getRequiredField(fields, 'INTENT'),
        confidence: this.parseNumber(fields.CONFIDENCE, 0.0, 1.0),
        emotionalTone: this.getRequiredField(fields, 'EMOTIONAL_TONE'),
        urgency: this.getRequiredField(fields, 'URGENCY'),
        entities: this.parseEntities(fields.ENTITIES)
      };

      this.logger.info('Successfully extracted intent classification result');
      return result;
    } catch (error) {
      this.logger.error('Failed to extract intent classification result:', error as Error);
      return this.getDefaultIntentClassification();
    }
  }

  /**
   * 提取指定的段落
   */
  private extractSection(text: string, startMarker: string, endMarker: string): string {
    const startPattern = new RegExp(`===\\s*${startMarker}\\s*===`, 'i');
    const endPattern = new RegExp(`===\\s*${endMarker}\\s*===`, 'i');

    const startMatch = text.match(startPattern);
    const endMatch = text.match(endPattern);

    if (!startMatch || !endMatch) {
      throw new Error(`Could not find section markers: ${startMarker} - ${endMarker}`);
    }

    const startIndex = startMatch.index! + startMatch[0].length;
    const endIndex = endMatch.index!;

    if (startIndex >= endIndex) {
      throw new Error(`Invalid section boundaries: ${startMarker} - ${endMarker}`);
    }

    return text.substring(startIndex, endIndex).trim();
  }

  /**
   * 解析字段
   */
  private parseFields(section: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        fields[key] = value;
      }
    }

    return fields;
  }

  /**
   * 获取必需字段
   */
  private getRequiredField(fields: Record<string, string>, fieldName: string): string {
    const value = fields[fieldName];
    if (!value || value === 'none' || value === '') {
      throw new Error(`Required field '${fieldName}' is missing or empty`);
    }
    return value;
  }

  /**
   * 获取可选字段
   */
  private getOptionalField(fields: Record<string, string>, fieldName: string): string | undefined {
    const value = fields[fieldName];
    if (!value || value === 'none' || value === '') {
      return undefined;
    }
    return value;
  }

  /**
   * 验证并获取字段值
   */
  private validateAndGetField(fields: Record<string, string>, fieldName: string, allowedValues: string[]): string {
    const value = this.getRequiredField(fields, fieldName);
    if (!allowedValues.includes(value)) {
      throw new Error(`Invalid value '${value}' for field '${fieldName}'. Allowed values: ${allowedValues.join(', ')}`);
    }
    return value;
  }

  /**
   * 解析数字
   */
  private parseNumber(value: string, min: number, max: number): number {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`);
    }
    if (num < min || num > max) {
      throw new Error(`Number ${num} is out of range [${min}, ${max}]`);
    }
    return num;
  }

  /**
   * 解析布尔值
   */
  private parseBoolean(value: string): boolean {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    throw new Error(`Invalid boolean value: ${value}`);
  }

  /**
   * 解析列表
   */
  private parseList(value: string, separator: string = ','): string[] {
    if (!value || value === 'none' || value === '') {
      return [];
    }
    return value.split(separator).map(item => item.trim()).filter(item => item.length > 0);
  }

  /**
   * 解析参数
   */
  private parseParameters(value: string): Record<string, any> {
    if (!value || value === 'none' || value === '') {
      return {};
    }

    const params: Record<string, any> = {};
    const pairs = value.split(',');

    for (const pair of pairs) {
      const equalIndex = pair.indexOf('=');
      if (equalIndex > 0) {
        const key = pair.substring(0, equalIndex).trim();
        const val = pair.substring(equalIndex + 1).trim();
        params[key] = val;
      }
    }

    return params;
  }

  /**
   * 解析实体
   */
  private parseEntities(value: string): Array<{ type: string; value: string }> {
    if (!value || value === 'none' || value === '') {
      return [];
    }

    const entities: Array<{ type: string; value: string }> = [];
    const pairs = value.split(',');

    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex > 0) {
        const type = pair.substring(0, colonIndex).trim();
        const val = pair.substring(colonIndex + 1).trim();
        entities.push({ type, value: val });
      }
    }

    return entities;
  }

  /**
   * 获取默认输入分类结果
   */
  private getDefaultInputClassification(): InputClassificationResult {
    return {
      type: 'speech',
      intent: 'dialogue',
      confidence: 50,
      isDirectSpeech: true,
      isActionDescription: false,
      isSystemQuery: false,
      isCompoundAction: false,
      urgency: 'medium',
      emotionalTone: 'neutral',
      contextualHints: []
    };
  }

  /**
   * 获取默认角色对话结果
   */
  private getDefaultCharacterDialogue(): CharacterDialogueResult {
    return {
      dialogue: "I'm not sure how to respond to that.",
      emotionalState: {
        mood: 'neutral',
        intensity: 50
      },
      confidence: 0.5
    };
  }

  /**
   * 获取默认导演决策结果
   */
  private getDefaultDirectorDecision(): DirectorDecisionResult {
    return {
      action: 'CONTINUE',
      reasoning: 'Default continue action',
      confidence: 0.5,
      parameters: {}
    };
  }

  /**
   * 获取默认复合动作结果
   */
  private getDefaultCompoundAction(): CompoundActionResult {
    return {
      isCompound: false,
      actionSequence: 'sequential',
      subActions: []
    };
  }

  /**
   * 获取默认意图分类结果
   */
  private getDefaultIntentClassification(): IntentClassificationResult {
    return {
      intent: 'UNKNOWN',
      confidence: 0.5,
      emotionalTone: 'NEUTRAL',
      urgency: 'MEDIUM',
      entities: []
    };
  }
}