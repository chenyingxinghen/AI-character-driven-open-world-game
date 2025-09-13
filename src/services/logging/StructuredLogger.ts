/**
 * 结构化日志系统
 * 提供统一的日志记录、追踪和分析功能
 */

import { getCurrentConfig } from '../../config/EnvironmentConfig';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  readonly timestamp: Date;
  readonly level: LogLevel;
  readonly message: string;
  readonly context: Record<string, any>;
  readonly service: string;
  readonly traceId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly operation?: string;
  readonly duration?: number;
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
}

/**
 * 日志输出接口
 */
export interface LogOutput {
  write(entry: LogEntry): Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

/**
 * 控制台日志输出
 */
export class ConsoleLogOutput implements LogOutput {
  async write(entry: LogEntry): Promise<void> {
    const levelName = LogLevel[entry.level];
    const timestamp = entry.timestamp.toISOString();
    
    const logLine = `[${timestamp}] ${levelName} [${entry.service}] ${entry.message}`;
    
    if (entry.level >= LogLevel.ERROR) {
      console.error(logLine, entry.context);
    } else if (entry.level >= LogLevel.WARN) {
      console.warn(logLine, entry.context);
    } else {
      console.log(logLine, entry.context);
    }
  }
}

/**
 * 文件日志输出
 */
export class FileLogOutput implements LogOutput {
  private writeQueue: LogEntry[] = [];
  private isWriting = false;

  constructor(
    private filePath: string,
    private maxFileSize: number = 10 * 1024 * 1024, // 10MB
    private maxFiles: number = 5
  ) {}

  async write(entry: LogEntry): Promise<void> {
    this.writeQueue.push(entry);
    
    if (!this.isWriting) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return;
    
    this.isWriting = true;
    
    try {
      while (this.writeQueue.length > 0) {
        const entries = this.writeQueue.splice(0, 100); // 批量处理
        const logLines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
        
        // 这里应该实现实际的文件写入逻辑
        // 简化实现，实际项目中应使用fs模块
        console.log(`Writing to file ${this.filePath}:`, logLines);
      }
    } finally {
      this.isWriting = false;
    }
  }

  async flush(): Promise<void> {
    await this.processQueue();
  }
}

/**
 * 远程日志输出
 */
export class RemoteLogOutput implements LogOutput {
  private buffer: LogEntry[] = [];
  private readonly bufferSize = 100;
  private readonly flushInterval = 5000; // 5秒

  constructor(
    private endpoint: string,
    private apiKey: string
  ) {
    // 定期刷新缓冲区
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  async write(entry: LogEntry): Promise<void> {
    this.buffer.push(entry);
    
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const logs = this.buffer.splice(0, this.bufferSize);
    
    try {
      // 简化实现，实际项目中应使用HTTP客户端
      console.log(`Sending ${logs.length} logs to ${this.endpoint}`);
      // await fetch(this.endpoint, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.apiKey}`
      //   },
      //   body: JSON.stringify({ logs })
      // });
    } catch (error) {
      // 发送失败，将日志重新加入缓冲区
      this.buffer.unshift(...logs);
      console.error('Failed to send logs to remote endpoint:', error);
    }
  }
}

/**
 * 结构化日志记录器
 */
export class StructuredLogger {
  private outputs: LogOutput[] = [];
  private minLevel: LogLevel = LogLevel.INFO;
  private traceId?: string;

  constructor(
    private service: string,
    outputs?: LogOutput[]
  ) {
    if (outputs) {
      this.outputs = outputs;
    } else {
      this.initializeDefaultOutputs();
    }
  }

  /**
   * 设置追踪ID
   */
  setTraceId(traceId: string): void {
    this.traceId = traceId;
  }

  /**
   * 清除追踪ID
   */
  clearTraceId(): void {
    this.traceId = undefined;
  }

  /**
   * 设置最小日志级别
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * 记录调试日志
   */
  debug(message: string, context: Record<string, any> = {}): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * 记录信息日志
   */
  info(message: string, context: Record<string, any> = {}): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, context: Record<string, any> = {}): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error, context: Record<string, any> = {}): void {
    const errorContext = error ? {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    } : context;
    
    this.log(LogLevel.ERROR, message, errorContext);
  }

  /**
   * 记录操作开始
   */
  startOperation(operation: string, context: Record<string, any> = {}): OperationLogger {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    this.info(`Operation started: ${operation}`, {
      ...context,
      operation,
      operationId,
      phase: 'start'
    });
    
    return new OperationLogger(this, operation, operationId, startTime, context);
  }

  /**
   * 记录用户操作
   */
  userAction(
    userId: string,
    action: string,
    context: Record<string, any> = {}
  ): void {
    this.info(`User action: ${action}`, {
      ...context,
      userId,
      action,
      category: 'user_action'
    });
  }

  /**
   * 记录系统事件
   */
  systemEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context: Record<string, any> = {}
  ): void {
    const level = severity === 'critical' ? LogLevel.ERROR : 
                  severity === 'high' ? LogLevel.WARN : LogLevel.INFO;
    
    this.log(level, `System event: ${event}`, {
      ...context,
      event,
      severity,
      category: 'system_event'
    });
  }

  /**
   * 记录性能指标
   */
  metric(
    name: string,
    value: number,
    unit: string = '',
    context: Record<string, any> = {}
  ): void {
    this.info(`Metric: ${name}`, {
      ...context,
      metric: {
        name,
        value,
        unit,
        timestamp: new Date()
      },
      category: 'metric'
    });
  }

  /**
   * 基础日志记录方法
   */
  private log(level: LogLevel, message: string, context: Record<string, any> = {}): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      service: this.service,
      traceId: this.traceId,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: context.operation,
      duration: context.duration
    };

    // 异步写入所有输出
    this.outputs.forEach(output => {
      output.write(entry).catch(error => {
        console.error('Failed to write log:', error);
      });
    });
  }

  /**
   * 初始化默认输出
   */
  private initializeDefaultOutputs(): void {
    try {
      const config = getCurrentConfig();
      
      // 控制台输出
      if (config.logging.outputs.console) {
        this.outputs.push(new ConsoleLogOutput());
      }
      
      // 文件输出
      if (config.logging.outputs.file.enabled) {
        this.outputs.push(new FileLogOutput(
          config.logging.outputs.file.path,
          config.logging.outputs.file.maxSize,
          config.logging.outputs.file.maxFiles
        ));
      }
      
      // 远程输出
      if (config.logging.outputs.remote.enabled && config.logging.outputs.remote.url) {
        this.outputs.push(new RemoteLogOutput(
          config.logging.outputs.remote.url,
          config.logging.outputs.remote.apiKey || ''
        ));
      }
      
      // 设置日志级别
      const levelMap: Record<string, LogLevel> = {
        'debug': LogLevel.DEBUG,
        'info': LogLevel.INFO,
        'warn': LogLevel.WARN,
        'error': LogLevel.ERROR
      };
      this.minLevel = levelMap[config.logging.level] || LogLevel.INFO;
      
    } catch (error) {
      // 配置加载失败，使用默认输出
      this.outputs.push(new ConsoleLogOutput());
      console.warn('Failed to load logging config, using console output only');
    }
  }

  /**
   * 刷新所有输出
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.outputs.map(output => 
        output.flush ? output.flush() : Promise.resolve()
      )
    );
  }

  /**
   * 关闭日志记录器
   */
  async close(): Promise<void> {
    await this.flush();
    
    await Promise.all(
      this.outputs.map(output => 
        output.close ? output.close() : Promise.resolve()
      )
    );
  }
}

/**
 * 操作日志记录器
 */
export class OperationLogger {
  constructor(
    private logger: StructuredLogger,
    private operation: string,
    private operationId: string,
    private startTime: number,
    private context: Record<string, any>
  ) {}

  /**
   * 记录操作步骤
   */
  step(step: string, context: Record<string, any> = {}): void {
    this.logger.info(`Operation step: ${this.operation} - ${step}`, {
      ...this.context,
      ...context,
      operation: this.operation,
      operationId: this.operationId,
      step,
      phase: 'step'
    });
  }

  /**
   * 记录操作成功
   */
  success(result?: any, context: Record<string, any> = {}): void {
    const duration = Date.now() - this.startTime;
    
    this.logger.info(`Operation completed: ${this.operation}`, {
      ...this.context,
      ...context,
      operation: this.operation,
      operationId: this.operationId,
      duration,
      result,
      phase: 'success'
    });
  }

  /**
   * 记录操作失败
   */
  failure(error: Error, context: Record<string, any> = {}): void {
    const duration = Date.now() - this.startTime;
    
    this.logger.error(`Operation failed: ${this.operation}`, error, {
      ...this.context,
      ...context,
      operation: this.operation,
      operationId: this.operationId,
      duration,
      phase: 'failure'
    });
  }
}

/**
 * 日志管理器
 */
export class LogManager {
  private static loggers = new Map<string, StructuredLogger>();

  /**
   * 获取日志记录器
   */
  static getLogger(service: string): StructuredLogger {
    if (!this.loggers.has(service)) {
      this.loggers.set(service, new StructuredLogger(service));
    }
    return this.loggers.get(service)!;
  }

  /**
   * 关闭所有日志记录器
   */
  static async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.loggers.values()).map(logger => logger.close())
    );
    this.loggers.clear();
  }

  /**
   * 刷新所有日志记录器
   */
  static async flushAll(): Promise<void> {
    await Promise.all(
      Array.from(this.loggers.values()).map(logger => logger.flush())
    );
  }
}