/**
 * 游戏模式域值对象
 * 这些是不可变的值对象，代表游戏模式域中的核心概念
 */

/**
 * 游戏模式类型枚举
 */
export enum GameModeType {
  FREE = 'free',
  SCRIPT = 'script'
}

/**
 * 导演干预类型枚举
 */
export enum InterventionType {
  EVENT_GENERATION = 'event_generation',
  DIALOGUE_GUIDANCE = 'dialogue_guidance',
  INFORMATION_INTERFERENCE = 'information_interference',
  ENVIRONMENT_CONTROL = 'environment_control'
}

/**
 * 干预强度级别枚举
 */
export enum InterventionIntensity {
  NONE = 'none',
  SUBTLE = 'subtle',
  MODERATE = 'moderate',
  STRONG = 'strong',
  FORCED = 'forced'
}

/**
 * 故事类型枚举
 */
export enum StoryGenre {
  FANTASY = 'fantasy',
  SCIENCE_FICTION = 'science_fiction',
  MYSTERY = 'mystery',
  HISTORICAL = 'historical',
  MODERN = 'modern',
  ADVENTURE = 'adventure'
}

/**
 * 玩家偏好设置值对象
 */
export interface PlayerPreferences {
  readonly preferredGenre: StoryGenre;
  readonly difficultyLevel: number; // 0-100
  readonly narrativeStyle: 'descriptive' | 'dialogue_heavy' | 'action_oriented';
  readonly interactionFrequency: 'high' | 'medium' | 'low';
  readonly allowMatureContent: boolean;
  readonly languagePreference: string;
}

/**
 * 模式配置值对象
 */
export interface ModeConfig {
  readonly mode: GameModeType;
  readonly sessionId: string;
  readonly worldSeed: string;
  readonly playerPreferences: PlayerPreferences;
  readonly modeSpecificConfig: FreeModeConfig | ScriptModeConfig;
}

/**
 * 自由模式配置值对象
 */
export interface FreeModeConfig {
  readonly worldGenerationType: 'random' | 'guided' | 'custom';
  readonly characterCreationEnabled: boolean;
  readonly locationAccessLevel: 'unrestricted' | 'guided' | 'limited';
  readonly eventRandomness: number; // 0-100
  readonly creativeFreedom: number; // 0-100
}

/**
 * 剧本模式配置值对象
 */
export interface ScriptModeConfig {
  readonly storyOutlineId: string;
  readonly directorInterventionLevel: number; // 0-100
  readonly storyDeviationTolerance: number; // 0-100
  readonly targetStoryLength: number; // 预期故事时长（分钟）
  readonly keyPlotPoints: readonly PlotPoint[];
  readonly allowPlayerDeviations: boolean;
}

/**
 * 剧情节点值对象
 */
export interface PlotPoint {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly requiredConditions: readonly string[];
  readonly expectedOutcomes: readonly string[];
  readonly priority: number; // 1-10
  readonly estimatedTime: number; // 分钟
  readonly isOptional: boolean;
}

/**
 * 故事章节值对象
 */
export interface StoryAct {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly plotPoints: readonly PlotPoint[];
  readonly targetDuration: number; // 分钟
  readonly themes: readonly string[];
}

/**
 * 剧本角色值对象
 */
export interface StoryCharacter {
  readonly id: string;
  readonly name: string;
  readonly role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  readonly description: string;
  readonly motivations: readonly string[];
  readonly relationships: readonly CharacterRelationshipDefinition[];
  readonly appearances: readonly AppearanceSchedule[];
}

/**
 * 剧本地点值对象
 */
export interface StoryLocation {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly significance: 'critical' | 'important' | 'optional';
  readonly connectedLocations: readonly string[];
  readonly availableEvents: readonly string[];
}

/**
 * 角色关系定义值对象
 */
export interface CharacterRelationshipDefinition {
  readonly targetCharacterId: string;
  readonly relationshipType: string;
  readonly intensity: number; // 0-100
  readonly description: string;
}

/**
 * 出场计划值对象
 */
export interface AppearanceSchedule {
  readonly actId: string;
  readonly plotPointId?: string;
  readonly locationId: string;
  readonly timing: 'beginning' | 'middle' | 'end' | 'triggered';
  readonly conditions: readonly string[];
}

/**
 * 剧情大纲值对象
 */
export interface StoryOutline {
  readonly id: string;
  readonly title: string;
  readonly genre: StoryGenre;
  readonly summary: string;
  readonly acts: readonly StoryAct[];
  readonly characters: readonly StoryCharacter[];
  readonly locations: readonly StoryLocation[];
  readonly themes: readonly string[];
  readonly estimatedDuration: number; // 分钟
  readonly tags: readonly string[];
}

/**
 * 干预决策结果值对象
 */
export interface InterventionDecision {
  readonly shouldIntervene: boolean;
  readonly interventionType: InterventionType;
  readonly intensity: InterventionIntensity;
  readonly reasoning: string;
  readonly targetElements: readonly string[];
  readonly estimatedEffectiveness: number; // 0-100
  readonly fallbackOptions: readonly InterventionOption[];
}

/**
 * 干预选项值对象
 */
export interface InterventionOption {
  readonly type: InterventionType;
  readonly intensity: InterventionIntensity;
  readonly description: string;
  readonly cost: number; // 资源消耗
  readonly riskLevel: number; // 0-100
  readonly expectedOutcome: string;
}

/**
 * 剧情偏离记录值对象
 */
export interface DeviationRecord {
  readonly id: string;
  readonly timestamp: Date;
  readonly playerAction: string;
  readonly expectedAction: string;
  readonly deviationScore: number; // 0-100
  readonly currentPlotPoint: string;
  readonly impact: 'minor' | 'moderate' | 'major' | 'critical';
  readonly description: string;
}

/**
 * 干预历史记录值对象
 */
export interface InterventionRecord {
  readonly id: string;
  readonly timestamp: Date;
  readonly interventionType: InterventionType;
  readonly intensity: InterventionIntensity;
  readonly trigger: string;
  readonly outcome: 'successful' | 'partially_successful' | 'failed';
  readonly effectiveness: number; // 0-100
  readonly playerReaction: string;
  readonly notes: string;
}

/**
 * 游戏模式状态值对象
 */
export interface GameModeState {
  readonly currentMode: GameModeType;
  readonly isTransitioning: boolean;
  readonly sessionStartTime: Date;
  readonly totalPlayTime: number; // 分钟
  readonly currentActivity: string;
  readonly stateVariables: Record<string, any>;
}