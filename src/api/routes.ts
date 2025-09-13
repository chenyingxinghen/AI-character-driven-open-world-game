/**
 * API路由定义
 * 定义所有RESTful API端点的路由规范
 */

// ========== 游戏会话管理路由 ==========

/**
 * 游戏会话API路由
 * Base Path: /api/v1/sessions
 */
export const SessionRoutes = {
  // 创建新游戏会话
  CREATE: 'POST /api/v1/sessions',
  
  // 获取会话列表
  LIST: 'GET /api/v1/sessions',
  
  // 获取特定会话信息
  GET: 'GET /api/v1/sessions/:sessionId',
  
  // 更新会话状态
  UPDATE: 'PUT /api/v1/sessions/:sessionId',
  
  // 删除会话
  DELETE: 'DELETE /api/v1/sessions/:sessionId',
  
  // 恢复会话
  RESUME: 'POST /api/v1/sessions/:sessionId/resume',
  
  // 暂停会话
  PAUSE: 'POST /api/v1/sessions/:sessionId/pause',
  
  // 获取会话统计
  STATISTICS: 'GET /api/v1/sessions/:sessionId/statistics'
} as const;

// ========== 角色交互路由 ==========

/**
 * 角色API路由
 * Base Path: /api/v1/characters
 */
export const CharacterRoutes = {
  // 获取角色列表
  LIST: 'GET /api/v1/characters',
  
  // 搜索角色
  SEARCH: 'GET /api/v1/characters/search',
  
  // 创建新角色
  CREATE: 'POST /api/v1/characters',
  
  // 获取角色信息
  GET: 'GET /api/v1/characters/:characterId',
  
  // 更新角色信息
  UPDATE: 'PUT /api/v1/characters/:characterId',
  
  // 删除角色
  DELETE: 'DELETE /api/v1/characters/:characterId',
  
  // 与角色对话
  DIALOGUE: 'POST /api/v1/characters/:characterId/dialogue',
  
  // 获取对话历史
  CONVERSATION_HISTORY: 'GET /api/v1/characters/:characterId/conversations',
  
  // 获取角色关系
  RELATIONSHIPS: 'GET /api/v1/characters/:characterId/relationships',
  
  // 更新角色关系
  UPDATE_RELATIONSHIP: 'PUT /api/v1/characters/:characterId/relationships/:targetId',
  
  // 获取角色记忆
  MEMORIES: 'GET /api/v1/characters/:characterId/memories',
  
  // 添加角色记忆
  ADD_MEMORY: 'POST /api/v1/characters/:characterId/memories'
} as const;

// ========== 世界管理路由 ==========

/**
 * 位置API路由
 * Base Path: /api/v1/locations
 */
export const LocationRoutes = {
  // 获取位置列表
  LIST: 'GET /api/v1/locations',
  
  // 搜索位置
  SEARCH: 'GET /api/v1/locations/search',
  
  // 创建新位置
  CREATE: 'POST /api/v1/locations',
  
  // 获取位置信息
  GET: 'GET /api/v1/locations/:locationId',
  
  // 更新位置信息
  UPDATE: 'PUT /api/v1/locations/:locationId',
  
  // 删除位置
  DELETE: 'DELETE /api/v1/locations/:locationId',
  
  // 执行位置动作
  ACTION: 'POST /api/v1/locations/:locationId/actions',
  
  // 获取位置连接
  CONNECTIONS: 'GET /api/v1/locations/:locationId/connections',
  
  // 添加位置连接
  ADD_CONNECTION: 'POST /api/v1/locations/:locationId/connections',
  
  // 获取位置事件
  EVENTS: 'GET /api/v1/locations/:locationId/events',
  
  // 获取位置中的角色
  CHARACTERS: 'GET /api/v1/locations/:locationId/characters'
} as const;

// ========== 系统监控路由 ==========

/**
 * 系统监控API路由
 * Base Path: /api/v1/system
 */
export const SystemRoutes = {
  // 获取系统健康状态
  HEALTH: 'GET /api/v1/system/health',
  
  // 获取系统统计
  STATISTICS: 'GET /api/v1/system/statistics',
  
  // 获取系统指标
  METRICS: 'GET /api/v1/system/metrics',
  
  // 获取活跃告警
  ALERTS: 'GET /api/v1/system/alerts',
  
  // 确认告警
  ACKNOWLEDGE_ALERT: 'POST /api/v1/system/alerts/:alertId/acknowledge',
  
  // 获取系统日志
  LOGS: 'GET /api/v1/system/logs',
  
  // 获取性能报告
  PERFORMANCE: 'GET /api/v1/system/performance',
  
  // 系统配置
  CONFIG: 'GET /api/v1/system/config',
  
  // 更新系统配置
  UPDATE_CONFIG: 'PUT /api/v1/system/config'
} as const;

// ========== 分析和报告路由 ==========

/**
 * 分析API路由
 * Base Path: /api/v1/analytics
 */
export const AnalyticsRoutes = {
  // 获取游戏分析报告
  GAME_REPORT: 'POST /api/v1/analytics/game-report',
  
  // 获取用户行为分析
  USER_BEHAVIOR: 'GET /api/v1/analytics/user-behavior',
  
  // 获取内容性能分析
  CONTENT_PERFORMANCE: 'GET /api/v1/analytics/content-performance',
  
  // 获取系统性能分析
  SYSTEM_PERFORMANCE: 'GET /api/v1/analytics/system-performance',
  
  // 导出数据
  EXPORT_DATA: 'POST /api/v1/analytics/export',
  
  // 获取趋势分析
  TRENDS: 'GET /api/v1/analytics/trends',
  
  // 获取预测分析
  PREDICTIONS: 'GET /api/v1/analytics/predictions'
} as const;

// ========== 内容管理路由 ==========

/**
 * 内容管理API路由
 * Base Path: /api/v1/content
 */
export const ContentRoutes = {
  // 模板管理
  TEMPLATES: {
    LIST: 'GET /api/v1/content/templates',
    GET: 'GET /api/v1/content/templates/:templateId',
    CREATE: 'POST /api/v1/content/templates',
    UPDATE: 'PUT /api/v1/content/templates/:templateId',
    DELETE: 'DELETE /api/v1/content/templates/:templateId'
  },
  
  // 内容生成
  GENERATE: {
    CHARACTER: 'POST /api/v1/content/generate/character',
    LOCATION: 'POST /api/v1/content/generate/location',
    DIALOGUE: 'POST /api/v1/content/generate/dialogue',
    SCENARIO: 'POST /api/v1/content/generate/scenario'
  },
  
  // 批量操作
  BATCH: {
    CREATE_CHARACTERS: 'POST /api/v1/content/batch/characters',
    CREATE_LOCATIONS: 'POST /api/v1/content/batch/locations',
    UPDATE_MULTIPLE: 'PUT /api/v1/content/batch/update',
    DELETE_MULTIPLE: 'DELETE /api/v1/content/batch/delete'
  }
} as const;

// ========== 配置管理路由 ==========

/**
 * 配置管理API路由
 * Base Path: /api/v1/config
 */
export const ConfigRoutes = {
  // 游戏配置
  GAME_CONFIG: 'GET /api/v1/config/game',
  UPDATE_GAME_CONFIG: 'PUT /api/v1/config/game',
  
  // LLM配置
  LLM_CONFIG: 'GET /api/v1/config/llm',
  UPDATE_LLM_CONFIG: 'PUT /api/v1/config/llm',
  
  // 数据库配置
  DATABASE_CONFIG: 'GET /api/v1/config/database',
  UPDATE_DATABASE_CONFIG: 'PUT /api/v1/config/database',
  
  // 验证配置
  VALIDATE_CONFIG: 'POST /api/v1/config/validate',
  
  // 重新加载配置
  RELOAD_CONFIG: 'POST /api/v1/config/reload'
} as const;

// ========== Webhook和事件路由 ==========

/**
 * Webhook API路由
 * Base Path: /api/v1/webhooks
 */
export const WebhookRoutes = {
  // 获取Webhook列表
  LIST: 'GET /api/v1/webhooks',
  
  // 创建Webhook
  CREATE: 'POST /api/v1/webhooks',
  
  // 获取Webhook信息
  GET: 'GET /api/v1/webhooks/:webhookId',
  
  // 更新Webhook
  UPDATE: 'PUT /api/v1/webhooks/:webhookId',
  
  // 删除Webhook
  DELETE: 'DELETE /api/v1/webhooks/:webhookId',
  
  // 测试Webhook
  TEST: 'POST /api/v1/webhooks/:webhookId/test',
  
  // 获取Webhook日志
  LOGS: 'GET /api/v1/webhooks/:webhookId/logs'
} as const;

/**
 * 事件API路由
 * Base Path: /api/v1/events
 */
export const EventRoutes = {
  // 获取事件列表
  LIST: 'GET /api/v1/events',
  
  // 获取事件详情
  GET: 'GET /api/v1/events/:eventId',
  
  // 订阅事件
  SUBSCRIBE: 'POST /api/v1/events/subscribe',
  
  // 取消订阅
  UNSUBSCRIBE: 'DELETE /api/v1/events/subscribe/:subscriptionId',
  
  // 获取事件统计
  STATISTICS: 'GET /api/v1/events/statistics'
} as const;

// ========== API版本和文档路由 ==========

/**
 * 文档和版本API路由
 */
export const MetaRoutes = {
  // API版本信息
  VERSION: 'GET /api/version',
  
  // API文档
  DOCS: 'GET /api/docs',
  
  // OpenAPI规范
  OPENAPI: 'GET /api/openapi.json',
  
  // 健康检查
  PING: 'GET /api/ping',
  
  // API使用统计
  USAGE: 'GET /api/usage'
} as const;

// ========== 路由组合 ==========

/**
 * 所有API路由的组合
 */
export const APIRoutes = {
  Sessions: SessionRoutes,
  Characters: CharacterRoutes,
  Locations: LocationRoutes,
  System: SystemRoutes,
  Analytics: AnalyticsRoutes,
  Content: ContentRoutes,
  Config: ConfigRoutes,
  Webhooks: WebhookRoutes,
  Events: EventRoutes,
  Meta: MetaRoutes
} as const;

/**
 * HTTP方法枚举
 */
export enum HTTPMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD'
}

/**
 * 内容类型
 */
export enum ContentType {
  JSON = 'application/json',
  XML = 'application/xml',
  FORM_DATA = 'multipart/form-data',
  URL_ENCODED = 'application/x-www-form-urlencoded',
  TEXT = 'text/plain',
  HTML = 'text/html'
}