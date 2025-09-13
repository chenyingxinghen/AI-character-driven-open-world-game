/**
 * 输入域值对象
 * 这些是不可变的值对象，代表输入域中的核心概念
 */

/**
 * 输入分类结果值对象
 */
export interface InputClassification {
  readonly intent: IntentType;
  readonly confidence: number;
  readonly emotionalTone: EmotionalTone;
  readonly urgency: UrgencyLevel;
  readonly complexity: number;
  readonly entities: readonly ExtractedEntity[];
  readonly contextualInfo: ContextualInfo;
}

/**
 * 提取的实体值对象
 */
export interface ExtractedEntity {
  readonly type: 'character' | 'location' | 'object' | 'action' | 'time';
  readonly value: string;
  readonly confidence: number;
  readonly position: {
    readonly start: number;
    readonly end: number;
  };
}

/**
 * 上下文信息值对象
 */
export interface ContextualInfo {
  readonly mentionedCharacters: readonly string[];
  readonly mentionedLocations: readonly string[];
  readonly actionSequence: readonly string[];
  readonly timeReferences: readonly string[];
  readonly emotionalIndicators: readonly string[];
  readonly complexityFactors: readonly string[];
}

/**
 * 意图类型枚举
 */
export enum IntentType {
  DIALOGUE = 'dialogue',
  MOVEMENT = 'movement',
  EXPLORATION = 'exploration',
  CHARACTER_INTERACTION = 'character_interaction',
  LOCATION_QUERY = 'location_query',
  INVENTORY_ACTION = 'inventory_action',
  COMBAT = 'combat',
  INFORMATION_QUERY = 'information_query',
  COMPLEX_SCENARIO = 'complex_scenario',
  UNKNOWN = 'unknown'
}

/**
 * 情绪基调枚举
 */
export enum EmotionalTone {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  EXCITED = 'excited',
  ANGRY = 'angry',
  SAD = 'sad',
  FEARFUL = 'fearful',
  CONFUSED = 'confused'
}

/**
 * 紧急程度枚举
 */
export enum UrgencyLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * 复杂场景分析结果值对象
 */
export interface ComplexScenarioAnalysis {
  readonly isComplex: boolean;
  readonly complexityScore: number;
  readonly scenarioType: string;
  readonly requiredDomains: readonly string[];
  readonly subIntents: readonly InputClassification[];
  readonly executionOrder: readonly string[];
  readonly estimatedProcessingTime: number;
}

/**
 * 输入预处理结果值对象
 */
export interface PreprocessedInput {
  readonly originalInput: string;
  readonly normalizedInput: string;
  readonly sanitizedInput: string;
  readonly detectedLanguage: string;
  readonly inputLength: number;
  readonly hasSpecialCharacters: boolean;
  readonly preprocessingNotes: readonly string[];
}

/**
 * 上下文历史值对象
 */
export interface ContextHistory {
  readonly recentInputs: readonly string[];
  readonly recentClassifications: readonly InputClassification[];
  readonly conversationFlow: readonly ConversationTurn[];
  readonly topicProgression: readonly string[];
}

/**
 * 对话轮次值对象
 */
export interface ConversationTurn {
  readonly id: string;
  readonly playerInput: string;
  readonly classification: InputClassification;
  readonly systemResponse: string;
  readonly timestamp: Date;
  readonly turnNumber: number;
}

/**
 * 选择检测结果值对象
 */
export interface ChoiceDetectionResult {
  readonly hasChoices: boolean;
  readonly choicePoints: readonly ChoicePoint[];
  readonly defaultAction?: string;
  readonly timeLimit?: number;
}

/**
 * 选择点值对象
 */
export interface ChoicePoint {
  readonly id: string;
  readonly description: string;
  readonly options: readonly ChoiceOption[];
  readonly consequences: readonly ChoiceConsequence[];
  readonly difficulty: number;
}

/**
 * 选择选项值对象
 */
export interface ChoiceOption {
  readonly id: string;
  readonly text: string;
  readonly description: string;
  readonly requirements?: readonly string[];
  readonly riskLevel: number;
  readonly probability: number;
}

/**
 * 选择后果值对象
 */
export interface ChoiceConsequence {
  readonly optionId: string;
  readonly impact: string;
  readonly affectedDomains: readonly string[];
  readonly severity: number;
}