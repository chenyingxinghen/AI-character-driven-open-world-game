/**
 * RESTful API接口定义
 * 为游戏会话管理、角色交互等提供标准化的API接口
 */

import { 
  EntityId, 
  Timestamp, 
  Position, 
  PaginatedResponse, 
  PaginationRequest, 
  OperationResult,
  LocationType,
  TimeOfDay,
  WeatherType,
  DifficultyLevel,
  GameMode
} from '../types';

// ========== 游戏会话管理API ==========

/**
 * 创建游戏会话请求
 */
export interface CreateGameSessionRequest {
  readonly playerId: string;
  readonly gameMode: GameMode;
  readonly initialLocation?: string;
  readonly sessionName?: string;
  readonly settings?: {
    readonly difficultyLevel: DifficultyLevel;
    readonly enableAI: boolean;
    readonly maxDuration?: number;
  };
}

/**
 * 游戏会话响应
 */
export interface GameSessionResponse {
  readonly sessionId: EntityId;
  readonly playerId: string;
  readonly gameMode: string;
  readonly status: 'active' | 'paused' | 'completed' | 'abandoned';
  readonly currentLocation: string;
  readonly startTime: Timestamp;
  readonly lastActivity: Timestamp;
  readonly settings: Record<string, any>;
  readonly statistics: {
    readonly totalTurns: number;
    readonly charactersEncountered: number;
    readonly locationsVisited: number;
    readonly objectives: {
      readonly completed: number;
      readonly total: number;
    };
  };
}

/**
 * 更新游戏会话请求
 */
export interface UpdateGameSessionRequest {
  readonly status?: 'active' | 'paused' | 'completed' | 'abandoned';
  readonly currentLocation?: string;
  readonly settings?: Record<string, any>;
}

// ========== 角色交互API ==========

/**
 * 角色对话请求
 */
export interface CharacterDialogueRequest {
  readonly sessionId: EntityId;
  readonly characterId: EntityId;
  readonly playerInput: string;
  readonly context?: {
    readonly locationId?: string;
    readonly previousTurns?: number;
    readonly mood?: string;
  };
}

/**
 * 角色对话响应
 */
export interface CharacterDialogueResponse {
  readonly conversationId: EntityId;
  readonly characterResponse: string;
  readonly characterState: {
    readonly mood: string;
    readonly emotionalIntensity: number;
    readonly relationshipLevel: number;
  };
  readonly conversationMetrics: {
    readonly turnNumber: number;
    readonly sentiment: 'positive' | 'neutral' | 'negative';
    readonly complexity: number;
    readonly confidence: number;
  };
  readonly suggestions?: {
    readonly nextTopics: readonly string[];
    readonly recommendedActions: readonly string[];
  };
}

/**
 * 获取角色信息响应
 */
export interface CharacterInfoResponse {
  readonly characterId: EntityId;
  readonly name: string;
  readonly description: string;
  readonly personality: {
    readonly traits: readonly string[];
    readonly values: Record<string, number>;
  };
  readonly currentState: {
    readonly mood: string;
    readonly location: string;
    readonly availability: boolean;
  };
  readonly relationships: Array<{
    readonly targetId: string;
    readonly type: string;
    readonly strength: number;
  }>;
  readonly statistics: {
    readonly totalConversations: number;
    readonly averageRating: number;
    readonly lastInteraction: Timestamp;
  };
}

// ========== 世界管理API ==========

/**
 * 获取位置信息响应
 */
export interface LocationInfoResponse {
  readonly locationId: EntityId;
  readonly name: string;
  readonly description: string;
  readonly type: LocationType;
  readonly position: Position;
  readonly state: {
    readonly population: number;
    readonly dangerLevel: number;
    readonly activityLevel: number;
  };
  readonly features: {
    readonly availableActions: readonly string[];
    readonly npcsPresent: readonly string[];
    readonly itemsAvailable: readonly string[];
  };
  readonly connections: Array<{
    readonly toLocationId: string;
    readonly travelTime: number;
    readonly requirements?: readonly string[];
  }>;
  readonly environment: {
    readonly weather: WeatherType;
    readonly timeOfDay: TimeOfDay;
    readonly ambientSounds: readonly string[];
  };
}

/**
 * 位置行动请求
 */
export interface LocationActionRequest {
  readonly sessionId: EntityId;
  readonly locationId: EntityId;
  readonly action: string;
  readonly parameters?: Record<string, any>;
}

/**
 * 位置行动响应
 */
export interface LocationActionResponse {
  readonly actionId: EntityId;
  readonly result: 'success' | 'failure' | 'partial';
  readonly description: string;
  readonly effects: Array<{
    readonly target: string;
    readonly change: string;
    readonly value: number;
  }>;
  readonly newState?: {
    readonly playerLocation?: string;
    readonly locationChanges?: Record<string, any>;
    readonly triggeredEvents?: readonly string[];
  };
}

// ========== 系统监控API ==========

/**
 * 系统健康状态响应
 */
export interface SystemHealthResponse {
  readonly status: 'healthy' | 'warning' | 'critical' | 'down';
  readonly timestamp: Timestamp;
  readonly uptime: number;
  readonly metrics: {
    readonly responseTime: number;
    readonly errorRate: number;
    readonly throughput: number;
    readonly activeUsers: number;
  };
  readonly services: Array<{
    readonly name: string;
    readonly status: string;
    readonly responseTime: number;
    readonly lastCheck: Timestamp;
  }>;
  readonly alerts: Array<{
    readonly id: string;
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
    readonly message: string;
    readonly triggeredAt: Timestamp;
  }>;
}

/**
 * 系统统计响应
 */
export interface SystemStatisticsResponse {
  readonly sessions: {
    readonly active: number;
    readonly total: number;
    readonly averageDuration: number;
  };
  readonly interactions: {
    readonly totalConversations: number;
    readonly totalActions: number;
    readonly averageResponseTime: number;
  };
  readonly performance: {
    readonly cpuUsage: number;
    readonly memoryUsage: number;
    readonly storageUsage: number;
  };
  readonly trends: {
    readonly userGrowth: number;
    readonly engagementRate: number;
    readonly satisfactionScore: number;
  };
}

// ========== 内容管理API ==========

/**
 * 创建角色请求
 */
export interface CreateCharacterRequest {
  readonly templateId?: string;
  readonly name: string;
  readonly personality: {
    readonly traits: readonly string[];
    readonly values: Record<string, number>;
  };
  readonly background?: string;
  readonly initialLocation?: string;
  readonly customization?: {
    readonly appearance?: Record<string, any>;
    readonly behavior?: Record<string, any>;
  };
}

/**
 * 创建位置请求
 */
export interface CreateLocationRequest {
  readonly templateId?: string;
  readonly name: string;
  readonly description: string;
  readonly type: LocationType;
  readonly position: Position;
  readonly features?: {
    readonly availableActions?: readonly string[];
    readonly environment?: Record<string, any>;
  };
}

// ========== 分析和报告API ==========

/**
 * 游戏分析报告请求
 */
export interface GameAnalyticsRequest {
  readonly timeRange: {
    readonly start: Timestamp;
    readonly end: Timestamp;
  };
  readonly metrics: readonly string[];
  readonly groupBy?: 'day' | 'week' | 'month';
  readonly filters?: Record<string, any>;
}

/**
 * 游戏分析报告响应
 */
export interface GameAnalyticsResponse {
  readonly reportId: EntityId;
  readonly timeRange: {
    readonly start: Timestamp;
    readonly end: Timestamp;
  };
  readonly metrics: Array<{
    readonly name: string;
    readonly data: Array<{
      readonly timestamp: Timestamp;
      readonly value: number;
    }>;
    readonly summary: {
      readonly total: number;
      readonly average: number;
      readonly trend: 'increasing' | 'decreasing' | 'stable';
    };
  }>;
  readonly insights: readonly string[];
  readonly recommendations: readonly string[];
  readonly generatedAt: Timestamp;
}

// ========== 错误处理API ==========

/**
 * HTTP状态码常量
 */
export enum HTTPStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_ERROR = 500,
  INTERNAL_SERVER_ERROR = 500
}

/**
 * API错误响应
 */
export interface APIErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, any>;
    readonly timestamp: Timestamp;
    readonly requestId: string;
  };
  readonly suggestions?: readonly string[];
}

/**
 * 批量操作响应
 */
export interface BatchOperationResponse<T> {
  readonly results: Array<{
    readonly id: string;
    readonly success: boolean;
    readonly data?: T;
    readonly error?: string;
  }>;
  readonly summary: {
    readonly total: number;
    readonly successful: number;
    readonly failed: number;
  };
  readonly processedAt: Timestamp;
}

// ========== 搜索和过滤API ==========

/**
 * 搜索角色请求
 */
export interface SearchCharactersRequest extends PaginationRequest {
  readonly query?: string;
  readonly filters?: {
    readonly category?: string;
    readonly location?: string;
    readonly traits?: readonly string[];
    readonly availability?: boolean;
  };
}

/**
 * 搜索位置请求
 */
export interface SearchLocationsRequest extends PaginationRequest {
  readonly query?: string;
  readonly filters?: {
    readonly type?: string;
    readonly dangerLevel?: {
      readonly min?: number;
      readonly max?: number;
    };
    readonly hasNPCs?: boolean;
  };
}

// ========== Webhook和事件API ==========

/**
 * Webhook配置
 */
export interface WebhookConfig {
  readonly id: EntityId;
  readonly url: string;
  readonly events: readonly string[];
  readonly active: boolean;
  readonly secret?: string;
  readonly retryPolicy: {
    readonly maxRetries: number;
    readonly backoffMultiplier: number;
  };
}

/**
 * 游戏事件
 */
export interface GameEvent {
  readonly eventId: EntityId;
  readonly type: string;
  readonly sessionId: EntityId;
  readonly data: Record<string, any>;
  readonly timestamp: Timestamp;
  readonly metadata?: Record<string, any>;
}