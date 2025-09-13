/**
 * API控制器基类
 * 提供通用的API控制器功能和错误处理
 */

import { Logger, LogLevel } from '../../services/Logger';
import { OperationResult, PaginatedResponse, ValidationResult } from '../../types';
import { APIErrorResponse, HTTPStatus } from '../interfaces';

/**
 * API请求接口
 */
export interface APIRequest {
  readonly params: Record<string, string>;
  readonly query: Record<string, any>;
  readonly body: any;
  readonly headers: Record<string, string>;
  readonly user?: {
    readonly id: string;
    readonly role: string;
  };
}

/**
 * API响应接口
 */
export interface APIResponse {
  status(code: number): APIResponse;
  json(data: any): void;
  send(data: any): void;
  header(name: string, value: string): APIResponse;
}

/**
 * API控制器基类
 */
export abstract class BaseController {
  protected logger: Logger;

  constructor(name: string) {
    this.logger = new Logger(LogLevel.INFO);
  }

  /**
   * 处理成功响应
   */
  protected success<T>(res: APIResponse, data: T, status: number = HTTPStatus.OK): void {
    res.status(status).json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理创建成功响应
   */
  protected created<T>(res: APIResponse, data: T): void {
    this.success(res, data, HTTPStatus.CREATED);
  }

  /**
   * 处理无内容响应
   */
  protected noContent(res: APIResponse): void {
    res.status(HTTPStatus.NO_CONTENT).send('');
  }

  /**
   * 处理分页响应
   */
  protected paginated<T>(res: APIResponse, data: PaginatedResponse<T>): void {
    res.status(HTTPStatus.OK).json({
      success: true,
      data: data.data,
      pagination: data.pagination,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 处理错误响应
   */
  protected error(
    res: APIResponse,
    message: string,
    status: number = HTTPStatus.INTERNAL_SERVER_ERROR,
    code?: string,
    details?: Record<string, any>
  ): void {
    const errorResponse: APIErrorResponse = {
      error: {
        code: code || `ERROR_${status}`,
        message,
        details,
        timestamp: new Date(),
        requestId: this.generateRequestId()
      }
    };

    this.logger.error(`API Error [${status}]: ${message}`, new Error(message));
    res.status(status).json(errorResponse);
  }

  /**
   * 处理验证错误
   */
  protected validationError(res: APIResponse, validation: ValidationResult): void {
    this.error(
      res,
      'Validation failed',
      HTTPStatus.UNPROCESSABLE_ENTITY,
      'VALIDATION_ERROR',
      {
        errors: validation.errors,
        warnings: validation.warnings
      }
    );
  }

  /**
   * 处理未找到错误
   */
  protected notFound(res: APIResponse, resource: string = 'Resource'): void {
    this.error(
      res,
      `${resource} not found`,
      HTTPStatus.NOT_FOUND,
      'NOT_FOUND'
    );
  }

  /**
   * 处理未授权错误
   */
  protected unauthorized(res: APIResponse, message: string = 'Unauthorized'): void {
    this.error(
      res,
      message,
      HTTPStatus.UNAUTHORIZED,
      'UNAUTHORIZED'
    );
  }

  /**
   * 处理禁止访问错误
   */
  protected forbidden(res: APIResponse, message: string = 'Forbidden'): void {
    this.error(
      res,
      message,
      HTTPStatus.FORBIDDEN,
      'FORBIDDEN'
    );
  }

  /**
   * 处理冲突错误
   */
  protected conflict(res: APIResponse, message: string): void {
    this.error(
      res,
      message,
      HTTPStatus.CONFLICT,
      'CONFLICT'
    );
  }

  /**
   * 处理频率限制错误
   */
  protected rateLimitExceeded(res: APIResponse): void {
    this.error(
      res,
      'Rate limit exceeded',
      HTTPStatus.TOO_MANY_REQUESTS,
      'RATE_LIMIT_EXCEEDED'
    );
  }

  /**
   * 处理操作结果
   */
  protected handleOperationResult<T>(
    res: APIResponse,
    result: OperationResult<T>,
    successStatus: number = HTTPStatus.OK
  ): void {
    if (result.success) {
      this.success(res, result.data, successStatus);
    } else {
      this.error(res, result.error || 'Operation failed');
    }
  }

  /**
   * 安全执行异步操作
   */
  protected async safeExecute<T>(
    res: APIResponse,
    operation: () => Promise<T>,
    successStatus: number = HTTPStatus.OK
  ): Promise<void> {
    try {
      const result = await operation();
      this.success(res, result, successStatus);
    } catch (error) {
      this.handleError(res, error as Error);
    }
  }

  /**
   * 处理异常错误
   */
  protected handleError(res: APIResponse, error: Error): void {
    this.logger.error('Unhandled error in controller:', error);
    
    // 根据错误类型返回适当的响应
    if (error.name === 'ValidationError') {
      this.error(res, error.message, HTTPStatus.BAD_REQUEST, 'VALIDATION_ERROR');
    } else if (error.name === 'NotFoundError') {
      this.notFound(res);
    } else if (error.name === 'UnauthorizedError') {
      this.unauthorized(res);
    } else if (error.name === 'ForbiddenError') {
      this.forbidden(res);
    } else {
      this.error(res, 'Internal server error', HTTPStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 验证请求参数
   */
  protected validateRequired(data: any, fields: string[]): ValidationResult {
    const errors: string[] = [];
    
    for (const field of fields) {
      if (!data || data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push(`Field '${field}' is required`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * 提取分页参数
   */
  protected extractPagination(query: Record<string, any>): {
    page: number;
    pageSize: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } {
    return {
      page: Math.max(1, parseInt(query.page) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(query.pageSize) || 20)),
      sortBy: query.sortBy,
      sortOrder: query.sortOrder === 'desc' ? 'desc' : 'asc'
    };
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 记录API访问日志
   */
  protected logAccess(req: APIRequest, action: string): void {
    this.logger.info(`API Access: ${action}`, {
      userId: req.user?.id,
      params: req.params,
      query: req.query
    });
  }

  /**
   * 检查用户权限
   */
  protected checkPermission(req: APIRequest, requiredRole: string): boolean {
    if (!req.user) return false;
    
    // 简化的权限检查逻辑
    const roleHierarchy = ['user', 'moderator', 'admin', 'superadmin'];
    const userRoleIndex = roleHierarchy.indexOf(req.user.role);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
    
    return userRoleIndex >= requiredRoleIndex;
  }

  /**
   * 清理敏感数据
   */
  protected sanitizeOutput<T>(data: T, sensitiveFields: string[] = []): T {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data } as any;
    
    for (const field of sensitiveFields) {
      if (sanitized[field] !== undefined) {
        delete sanitized[field];
      }
    }
    
    return sanitized;
  }
}