/**
 * API模块导出
 * 统一导出所有API相关的接口、路由和控制器
 */

// 接口定义
export * from './interfaces';
export * from './routes';

// 控制器
export * from './controllers/BaseController';

// 中间件类型
export interface APIMiddleware {
  (req: any, res: any, next: any): void | Promise<void>;
}

// 路由处理器类型
export interface RouteHandler {
  (req: any, res: any): void | Promise<void>;
}

// API配置接口
export interface APIConfig {
  readonly port: number;
  readonly host: string;
  readonly cors: {
    readonly enabled: boolean;
    readonly origins: readonly string[];
  };
  readonly rateLimit: {
    readonly enabled: boolean;
    readonly windowMs: number;
    readonly maxRequests: number;
  };
  readonly auth: {
    readonly enabled: boolean;
    readonly jwtSecret: string;
    readonly tokenExpiry: string;
  };
  readonly documentation: {
    readonly enabled: boolean;
    readonly title: string;
    readonly version: string;
    readonly description: string;
  };
}

// API服务接口
export interface APIService {
  start(): Promise<void>;
  stop(): Promise<void>;
  getHealth(): Promise<{ status: string; uptime: number }>;
}