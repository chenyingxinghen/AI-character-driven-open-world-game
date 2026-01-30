/**
 * 角色域值对象
 * 这些是不可变的值对象，代表角色域中的核心概念
 */

/**
 * 角色记忆值对象
 */
export interface CharacterMemory {
  readonly id: string;
  readonly content: string;
  readonly emotionalWeight: number;
  readonly associatedCharacters: readonly string[];
  readonly tags: readonly string[];
  readonly memoryType: 'dialogue' | 'observation' | 'action';
  readonly significance: number;
  readonly createdAt: Date;
  readonly lastAccessed?: Date;
}

/**
 * 角色情绪状态值对象（增强版）
 */
export interface EmotionalState {
  readonly mood: string;
  readonly intensity: number;
  readonly stability: number;
  readonly triggers: readonly string[];
  readonly dominantEmotions: readonly string[];
  readonly emotionalHistory: readonly Partial<EmotionalState>[];
  readonly lastMoodChange: Date;
  readonly baselineStability: number;
}

/**
 * 情绪触发器值对象
 */
export interface EmotionalTrigger {
  readonly type: string;
  readonly intensity: number;
  readonly source: string;
  readonly timestamp: Date;
}

/**
 * 记忆访问模式值对象
 */
export interface MemoryAccessPattern {
  readonly memoryId: string;
  accessCount: number;
  lastAccessed: Date;
  accessFrequency: number;
  contextualTriggers: string[];
}

/**
 * 记忆聚类值对象
 */
export interface MemoryCluster {
  readonly id: string;
  readonly theme: string;
  memoryIds: string[];
  significance: number;
  emotionalTone: number;
  readonly createdAt: Date;
  lastUpdated: Date;
  readonly averageSignificance: number;
}

/**
 * 角色关系值对象（增强版）
 */
export interface CharacterRelationship {
  readonly characterId: string;
  readonly relationshipType: string;
  readonly strength: number;
  readonly trustLevel: number;
  readonly lastInteraction: Date;
  readonly interactionHistory: readonly string[];
  readonly relationshipHistory?: readonly any[];
  readonly emotionalBond?: number;
  readonly trustTrajectory?: readonly number[];
  readonly conflictHistory?: readonly any[];
}

/**
 * 行为决策值对象
 */
export interface BehaviorDecision {
  readonly action?: string;
  readonly reasoning: string;
  readonly confidence: number;
  readonly emotionalImpact?: number;
  readonly expectedOutcome?: string;
  selectedOption?: BehaviorOption;
  readonly alternativeOptions?: BehaviorOption[];
  readonly timestamp?: Date;
  readonly contextualFactors?: Record<string, any>;
}

/**
 * 行为选项值对象
 */
export interface BehaviorOption {
  readonly id?: string;
  readonly name?: string;
  readonly description?: string;
  readonly action?: string;
  readonly motivation?: string;
  readonly difficulty?: number;
  readonly riskLevel?: number;
  readonly expectedReward?: number;
  baseScore?: number;
  personalityFactors?: Record<string, number>;
  emotionalFactors?: Record<string, number>;
  readonly consequences?: string[];
  readonly requirements?: string[];
}

/**
 * 记忆重要性评分值对象
 */
export interface ImportanceScore {
  readonly score: number;
  readonly factors: readonly string[];
  readonly reasoning: string;
}

/**
 * 相关记忆值对象
 */
export interface RelatedMemory {
  readonly memory: CharacterMemory;
  readonly similarityScore: number;
  readonly relationshipType: string;
}

/**
 * 角色个性值对象
 */
export interface CharacterPersonality {
  readonly traits: Record<string, number>;
  readonly values: Record<string, number>;
  readonly goals: readonly string[];
  readonly fears: readonly string[];
  readonly motivations: readonly string[];
}

/**
 * 角色档案值对象
 */
export interface CharacterProfile {
  readonly id: string;
  readonly name: string;
  readonly age?: number;
  readonly background: string;
  readonly appearance: string;
  readonly personality: CharacterPersonality;
  readonly currentLocation?: string;
}

