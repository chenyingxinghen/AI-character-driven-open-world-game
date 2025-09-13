/**
 * 共享类型库
 * 统一和标准化项目中的类型定义
 */

// ========== 基础类型 ==========

/**
 * 通用ID类型
 */
export type EntityId = string;

/**
 * 时间戳类型
 */
export type Timestamp = Date;

/**
 * 坐标类型
 */
export interface Position {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * 严重程度枚举
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 状态类型
 */
export type SystemStatus = 'healthy' | 'warning' | 'critical' | 'down';

// ========== 角色相关类型 ==========

/**
 * 情绪类型
 */
export type EmotionType = 'happy' | 'sad' | 'angry' | 'fear' | 'surprise' | 'neutral';

/**
 * 关系类型
 */
export type RelationshipType = 'friend' | 'acquaintance' | 'enemy' | 'neutral' | 'romantic' | 'family';

/**
 * 角色类别
 */
export type CharacterCategory = 'npc' | 'companion' | 'antagonist' | 'neutral';

// ========== 世界相关类型 ==========

/**
 * 位置类型
 */
export type LocationType = 'urban' | 'rural' | 'wilderness' | 'underground' | 'mystical';

/**
 * 天气类型
 */
export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'foggy' | 'snowy';

/**
 * 时间段
 */
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

// ========== 输入相关类型 ==========

/**
 * 输入意图类型
 */
export type InputIntent = 'greeting' | 'question' | 'command' | 'statement' | 'goodbye' | 'unknown';

/**
 * 复杂度等级
 */
export type ComplexityLevel = 1 | 2 | 3 | 4 | 5;

// ========== 系统相关类型 ==========

/**
 * 错误类型
 */
export type ErrorType = 'NETWORK_ERROR' | 'TIMEOUT_ERROR' | 'DATABASE_ERROR' | 'API_ERROR' | 'TEMPORARY_FAILURE';

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 操作类型
 */
export type OperationType = 'llm_call' | 'database_query' | 'classification' | 'generation' | 'analysis';

// ========== 游戏机制类型 ==========

/**
 * 难度等级
 */
export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'expert';

/**
 * 游戏模式
 */
export type GameMode = 'story' | 'sandbox' | 'challenge' | 'tutorial';

// ========== 通用接口 ==========

/**
 * 基础实体接口
 */
export interface BaseEntity {
  readonly id: EntityId;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * 带名称的实体
 */
export interface NamedEntity extends BaseEntity {
  readonly name: string;
  readonly description?: string;
}

/**
 * 带位置的实体
 */
export interface PositionedEntity extends BaseEntity {
  readonly position: Position;
}

/**
 * 配置选项基础接口
 */
export interface BaseConfig {
  readonly enabled: boolean;
  readonly priority: number;
}

/**
 * 可序列化接口
 */
export interface Serializable {
  toJSON(): Record<string, any>;
}

/**
 * 统计信息接口
 */
export interface Statistics {
  readonly count: number;
  readonly average: number;
  readonly min: number;
  readonly max: number;
  readonly lastUpdated: Timestamp;
}

/**
 * 时间范围接口
 */
export interface TimeRange {
  readonly start: Timestamp;
  readonly end: Timestamp;
}

/**
 * 分页信息接口
 */
export interface PaginationInfo {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

/**
 * 分页请求接口
 */
export interface PaginationRequest {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * 分页响应接口
 */
export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly pagination: PaginationInfo;
}

/**
 * 搜索选项接口
 */
export interface SearchOptions {
  readonly query?: string;
  readonly filters?: Record<string, any>;
  readonly pagination?: PaginationRequest;
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * 操作结果接口
 */
export interface OperationResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly timestamp: Timestamp;
}

/**
 * 配置加载结果接口
 */
export interface ConfigLoadResult {
  readonly loaded: boolean;
  readonly source: string;
  readonly errors: readonly string[];
  readonly loadedAt: Timestamp;
}

// ========== 扩展接口 ==========

/**
 * 带权重的项目
 */
export interface WeightedItem<T> {
  readonly item: T;
  readonly weight: number;
}

/**
 * 带分数的项目
 */
export interface ScoredItem<T> {
  readonly item: T;
  readonly score: number;
}

/**
 * 带时间戳的项目
 */
export interface TimestampedItem<T> {
  readonly item: T;
  readonly timestamp: Timestamp;
}

/**
 * 带元数据的项目
 */
export interface MetadataItem<T> {
  readonly item: T;
  readonly metadata: Record<string, any>;
}

// ========== 工具类型 ==========

/**
 * 深度只读类型
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * 可选属性类型
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * 必需属性类型
 */
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * 值类型提取
 */
export type ValueOf<T> = T[keyof T];

/**
 * 数组元素类型提取
 */
export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;