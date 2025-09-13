/**
 * 增强的错误处理和追踪系统
 * 提供统一的异常处理机制和错误追踪功能
 */

import { Logger, LogLevel } from '../services/Logger';
import { ErrorRecord } from '../domains/operations/valueObjects';

/**
 * 错误类型枚举
 */
export enum ErrorCode {
  // 系统级错误
  SYSTEM_INITIALIZATION_FAILED = 'SYSTEM_INITIALIZATION_FAILED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // 网络和API错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',
  
  // 数据库错误
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',
  DATABASE_TRANSACTION_FAILED = 'DATABASE_TRANSACTION_FAILED',
  
  // LLM相关错误
  LLM_PROVIDER_ERROR = 'LLM_PROVIDER_ERROR',
  LLM_RESPONSE_INVALID = 'LLM_RESPONSE_INVALID',
  LLM_QUOTA_EXCEEDED = 'LLM_QUOTA_EXCEEDED',
  
  // 业务逻辑错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_STATE = 'INVALID_STATE',
  
  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 自定义错误基类
 */
export abstract class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly context: Record<string, any>;
  public readonly timestamp: Date;
  public readonly stackTrace: string;

  constructor(
    code: ErrorCode,
    message: string,
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.stackTrace = this.stack || '';

    if (cause) {
      this.context.cause = {
        name: cause.name,
        message: cause.message,
        stack: cause.stack
      };
    }

    // 确保错误堆栈正确显示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 转换为错误记录
   */
  toErrorRecord(): ErrorRecord {
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.code,
      message: this.message,
      stackTrace: this.stackTrace,
      context: this.context,
      severity: this.getSeverity(),
      timestamp: this.timestamp,
      resolved: false
    };
  }

  /**
   * 获取错误严重程度
   */
  abstract getSeverity(): 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 系统错误
 */
export class SystemError extends BaseError {
  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.code) {
      case ErrorCode.SYSTEM_INITIALIZATION_FAILED:
        return 'critical';
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 'high';
      case ErrorCode.CONFIGURATION_ERROR:
        return 'medium';
      default:
        return 'medium';
    }
  }
}

/**
 * 网络错误
 */
export class NetworkError extends BaseError {
  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.code) {
      case ErrorCode.API_AUTHENTICATION_FAILED:
        return 'high';
      case ErrorCode.API_RATE_LIMIT:
        return 'medium';
      case ErrorCode.NETWORK_ERROR:
        return 'medium';
      case ErrorCode.API_TIMEOUT:
        return 'low';
      default:
        return 'medium';
    }
  }
}

/**
 * 数据库错误
 */
export class DatabaseError extends BaseError {
  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.code) {
      case ErrorCode.DATABASE_CONNECTION_FAILED:
        return 'critical';
      case ErrorCode.DATABASE_TRANSACTION_FAILED:
        return 'high';
      case ErrorCode.DATABASE_QUERY_FAILED:
        return 'medium';
      default:
        return 'medium';
    }
  }
}

/**
 * LLM错误
 */
export class LLMError extends BaseError {
  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.code) {
      case ErrorCode.LLM_QUOTA_EXCEEDED:
        return 'high';
      case ErrorCode.LLM_PROVIDER_ERROR:
        return 'medium';
      case ErrorCode.LLM_RESPONSE_INVALID:
        return 'low';
      default:
        return 'medium';
    }
  }
}

/**
 * 业务逻辑错误
 */
export class BusinessError extends BaseError {
  getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.code) {
      case ErrorCode.PERMISSION_DENIED:
        return 'high';
      case ErrorCode.INVALID_STATE:
        return 'medium';
      case ErrorCode.VALIDATION_ERROR:
        return 'low';
      case ErrorCode.RESOURCE_NOT_FOUND:
        return 'low';
      default:
        return 'low';
    }
  }
}

/**
 * 错误追踪器
 */
export class ErrorTracker {
  private static instance: ErrorTracker | null = null;
  private errors: BaseError[] = [];
  private readonly maxErrors = 1000;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger(LogLevel.ERROR);
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  /**
   * 记录错误
   */
  track(error: BaseError): void {
    this.errors.push(error);
    
    // 保持错误数量在限制内
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors / 2);
    }

    // 记录到日志
    this.logger.error(`[${error.code}] ${error.message}`, new Error(error.message));
  }

  /**
   * 获取错误统计
   */
  getStatistics(timeWindow?: { start: Date; end: Date }): {
    totalErrors: number;
    errorsByCode: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    recentErrors: BaseError[];
  } {
    let relevantErrors = this.errors;
    
    if (timeWindow) {
      relevantErrors = this.errors.filter(error => 
        error.timestamp >= timeWindow.start && error.timestamp <= timeWindow.end
      );
    }

    const errorsByCode: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    for (const error of relevantErrors) {
      errorsByCode[error.code] = (errorsByCode[error.code] || 0) + 1;
      errorsBySeverity[error.getSeverity()] = (errorsBySeverity[error.getSeverity()] || 0) + 1;
    }

    return {
      totalErrors: relevantErrors.length,
      errorsByCode,
      errorsBySeverity,
      recentErrors: relevantErrors.slice(-10)
    };
  }

  /**
   * 清理旧错误
   */
  cleanup(olderThan: Date): void {
    const initialCount = this.errors.length;
    this.errors = this.errors.filter(error => error.timestamp > olderThan);
    const removedCount = initialCount - this.errors.length;
    
    if (removedCount > 0) {
      this.logger.info(`Cleaned up ${removedCount} old errors`);
    }
  }
}

/**
 * 错误处理装饰器
 */
export function handleErrors(errorCode: ErrorCode, context?: Record<string, any>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        const enhancedError = createEnhancedError(error, errorCode, {
          ...context,
          method: propertyName,
          class: target.constructor.name,
          arguments: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg))
        });

        ErrorTracker.getInstance().track(enhancedError);
        throw enhancedError;
      }
    };
  };
}

/**
 * 创建增强错误
 */
export function createEnhancedError(
  originalError: any,
  code: ErrorCode,
  context: Record<string, any> = {}
): BaseError {
  const message = originalError instanceof Error ? originalError.message : String(originalError);
  const cause = originalError instanceof Error ? originalError : undefined;

  // 根据错误代码选择适当的错误类型
  if (code.startsWith('SYSTEM_') || code.startsWith('SERVICE_') || code.startsWith('CONFIGURATION_')) {
    return new SystemError(code, message, context, cause);
  } else if (code.startsWith('NETWORK_') || code.startsWith('API_')) {
    return new NetworkError(code, message, context, cause);
  } else if (code.startsWith('DATABASE_')) {
    return new DatabaseError(code, message, context, cause);
  } else if (code.startsWith('LLM_')) {
    return new LLMError(code, message, context, cause);
  } else {
    return new BusinessError(code, message, context, cause);
  }
}

/**
 * 全局错误处理器
 */
export class GlobalErrorHandler {
  private static logger = new Logger(LogLevel.ERROR);
  private static errorTracker = ErrorTracker.getInstance();

  /**
   * 处理未捕获的异常
   */
  static handleUncaughtException(error: Error): void {
    const enhancedError = createEnhancedError(
      error,
      ErrorCode.UNKNOWN_ERROR,
      { type: 'uncaught_exception' }
    );

    this.errorTracker.track(enhancedError);
    this.logger.error('Uncaught exception:', error);

    // 在生产环境中，可能需要优雅地关闭应用程序
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  /**
   * 处理未处理的Promise拒绝
   */
  static handleUnhandledRejection(reason: any, promise: Promise<any>): void {
    const enhancedError = createEnhancedError(
      reason,
      ErrorCode.UNKNOWN_ERROR,
      { type: 'unhandled_rejection', promise: String(promise) }
    );

    this.errorTracker.track(enhancedError);
    this.logger.error('Unhandled promise rejection:', reason);
  }

  /**
   * 初始化全局错误处理
   */
  static initialize(): void {
    process.on('uncaughtException', this.handleUncaughtException.bind(this));
    process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));
    
    this.logger.info('Global error handling initialized');
  }
}

/**
 * 错误恢复策略
 */
export interface RecoveryStrategy {
  canRecover(error: BaseError): boolean;
  recover(error: BaseError): Promise<boolean>;
}

/**
 * 网络错误恢复策略
 */
export class NetworkErrorRecovery implements RecoveryStrategy {
  canRecover(error: BaseError): boolean {
    return error instanceof NetworkError && 
           [ErrorCode.NETWORK_ERROR, ErrorCode.API_TIMEOUT].includes(error.code);
  }

  async recover(error: BaseError): Promise<boolean> {
    // 简单的重试逻辑
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true; // 假设重试可能成功
  }
}

/**
 * 错误恢复管理器
 */
export class ErrorRecoveryManager {
  private strategies: RecoveryStrategy[] = [];

  constructor() {
    this.strategies.push(new NetworkErrorRecovery());
  }

  /**
   * 添加恢复策略
   */
  addStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * 尝试恢复错误
   */
  async tryRecover(error: BaseError): Promise<boolean> {
    for (const strategy of this.strategies) {
      if (strategy.canRecover(error)) {
        try {
          const recovered = await strategy.recover(error);
          if (recovered) {
            return true;
          }
        } catch (recoveryError) {
          // 恢复失败，继续尝试下一个策略
          continue;
        }
      }
    }
    return false;
  }
}