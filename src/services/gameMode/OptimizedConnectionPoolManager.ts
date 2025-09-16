import { Pool, PoolClient, PoolConfig } from 'pg';
import { Logger } from '../Logger';
import Redis, { Cluster } from 'ioredis';

/**
 * 连接池统计信息
 */
export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingCount: number;
  totalQueries: number;
  averageQueryTime: number;
  errorCount: number;
  connectionFailures: number;
}

/**
 * 查询性能指标
 */
export interface QueryMetrics {
  query: string;
  executionTime: number;
  timestamp: Date;
  success: boolean;
  rowCount?: number;
  error?: string;
}

/**
 * 连接池配置
 */
export interface OptimizedPoolConfig extends PoolConfig {
  // 性能优化配置
  enableQueryMetrics?: boolean;
  slowQueryThreshold?: number; // 慢查询阈值（毫秒）
  enableConnectionReuse?: boolean;
  connectionWarmupQueries?: string[];
  
  // 监控配置
  healthCheckInterval?: number;
  metricsRetentionTime?: number;
  
  // 自动调优配置
  enableAutoTuning?: boolean;
  autoTuningInterval?: number;
}

/**
 * 优化的数据库连接池管理器
 * 
 * 特性：
 * - 智能连接池管理和自动调优
 * - 查询性能监控和优化
 * - 连接健康检查和故障恢复
 * - 慢查询检测和告警
 * - 连接预热和复用优化
 * - 实时性能指标收集
 */
export class OptimizedConnectionPoolManager {
  private pgPool!: Pool;
  private redisPool: Cluster | Redis | null = null;
  
  private poolStats: PoolStats = {
    totalConnections: 0,
    idleConnections: 0,
    activeConnections: 0,
    waitingCount: 0,
    totalQueries: 0,
    averageQueryTime: 0,
    errorCount: 0,
    connectionFailures: 0
  };

  private queryMetrics: QueryMetrics[] = [];
  private slowQueries: QueryMetrics[] = [];
  private connectionHealth = new Map<string, {
    lastCheck: Date;
    status: 'healthy' | 'warning' | 'error';
    errorCount: number;
    averageResponseTime: number;
  }>();

  private performanceHistory: Array<{
    timestamp: Date;
    stats: PoolStats;
    memoryUsage: number;
    cpuUsage: number;
  }> = [];

  private autoTuningEnabled = false;
  private lastTuningTime = new Date();

  constructor(
    private config: OptimizedPoolConfig,
    private logger: Logger
  ) {
    this.initializePostgresPool();
    this.initializeRedisPool();
    this.startHealthMonitoring();
    this.startPerformanceTracking();
    
    if (config.enableAutoTuning) {
      this.enableAutoTuning();
    }
  }

  /**
   * 初始化PostgreSQL连接池
   */
  private initializePostgresPool(): void {
    // 优化的连接池配置
    const optimizedConfig: PoolConfig = {
      ...this.config,
      // 性能优化设置
      max: this.config.max || 20,
      min: this.config.min || 5,
      idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis || 10000,
      
      // 启用keep-alive
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      
      // 连接验证
      allowExitOnIdle: false
    };

    this.pgPool = new Pool(optimizedConfig);

    // 监听连接池事件
    this.pgPool.on('connect', (client: PoolClient) => {
      this.poolStats.totalConnections++;
      this.logger.debug('New database connection established', {
        totalConnections: this.poolStats.totalConnections,
        component: 'OptimizedConnectionPoolManager'
      });

      // 连接预热
      this.warmupConnection(client);
    });

    this.pgPool.on('remove', () => {
      this.poolStats.totalConnections--;
      this.logger.debug('Database connection removed', {
        totalConnections: this.poolStats.totalConnections,
        component: 'OptimizedConnectionPoolManager'
      });
    });

    this.pgPool.on('error', (err: Error) => {
      this.poolStats.errorCount++;
      this.poolStats.connectionFailures++;
      this.logger.error('Connection pool error', err, {
        component: 'OptimizedConnectionPoolManager'
      });
    });

    this.logger.info('PostgreSQL connection pool initialized', {
      maxConnections: optimizedConfig.max,
      minConnections: optimizedConfig.min,
      component: 'OptimizedConnectionPoolManager'
    });
  }

  /**
   * 初始化Redis连接池
   */
  private initializeRedisPool(): void {
    // Redis连接池配置会在实际使用时根据具体需求配置
    this.logger.info('Redis connection pool ready for initialization');
  }

  /**
   * 执行优化查询
   */
  async executeQuery<T = any>(
    text: string,
    params?: any[],
    options: {
      timeout?: number;
      priority?: 'low' | 'medium' | 'high';
      enableMetrics?: boolean;
      retryCount?: number;
    } = {}
  ): Promise<{ rows: T[]; rowCount: number; executionTime: number }> {
    const startTime = Date.now();
    const queryId = this.generateQueryId();
    const enableMetrics = options.enableMetrics ?? this.config.enableQueryMetrics ?? true;
    const retryCount = options.retryCount ?? 0;

    this.logger.debug('Executing database query', {
      queryId,
      priority: options.priority,
      hasParams: Boolean(params?.length),
      component: 'OptimizedConnectionPoolManager'
    });

    let client: PoolClient | null = null;
    
    try {
      // 获取连接（带超时）
      client = await this.getConnection(options.timeout);
      
      // 设置查询超时
      if (options.timeout) {
        await client.query('SET statement_timeout = $1', [options.timeout]);
      }

      // 执行查询
      const result = await client.query(text, params);
      const executionTime = Date.now() - startTime;

      // 更新统计信息
      this.updateQueryStats(true, executionTime);

      // 记录查询指标
      if (enableMetrics) {
        this.recordQueryMetrics({
          query: this.sanitizeQuery(text),
          executionTime,
          timestamp: new Date(),
          success: true,
          rowCount: result.rowCount || 0
        });
      }

      // 检查慢查询
      this.checkSlowQuery(text, executionTime);

      this.logger.debug('Query executed successfully', {
        queryId,
        executionTime,
        rowCount: result.rowCount,
        component: 'OptimizedConnectionPoolManager'
      });

      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateQueryStats(false, executionTime);

      // 记录错误指标
      if (enableMetrics) {
        this.recordQueryMetrics({
          query: this.sanitizeQuery(text),
          executionTime,
          timestamp: new Date(),
          success: false,
          error: (error as Error).message
        });
      }

      // 重试逻辑
      if (retryCount < 3 && this.shouldRetryQuery(error as Error)) {
        this.logger.warn('Retrying failed query', {
          queryId,
          retryCount: retryCount + 1,
          error: (error as Error).message,
          component: 'OptimizedConnectionPoolManager'
        });

        await this.delay(Math.pow(2, retryCount) * 100); // 指数退避
        return this.executeQuery(text, params, { ...options, retryCount: retryCount + 1 });
      }

      this.logger.error('Query execution failed', error as Error, {
        queryId,
        executionTime,
        retryCount,
        component: 'OptimizedConnectionPoolManager'
      });

      throw error;
    } finally {
      // 释放连接
      if (client) {
        client.release();
      }
    }
  }

  /**
   * 执行事务
   */
  async executeTransaction<T>(
    operations: Array<{ text: string; params?: any[] }>,
    options: {
      isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
      timeout?: number;
    } = {}
  ): Promise<T[]> {
    const client = await this.getConnection(options.timeout);
    const results: T[] = [];

    try {
      // 开始事务
      await client.query('BEGIN');

      // 设置隔离级别
      if (options.isolationLevel) {
        await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
      }

      // 执行所有操作
      for (const operation of operations) {
        const result = await client.query(operation.text, operation.params);
        results.push(result.rows as T);
      }

      // 提交事务
      await client.query('COMMIT');

      this.logger.debug('Transaction executed successfully', {
        operationCount: operations.length,
        component: 'OptimizedConnectionPoolManager'
      });

      return results;

    } catch (error) {
      // 回滚事务
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        this.logger.error('Failed to rollback transaction', rollbackError as Error);
      }

      this.logger.error('Transaction failed', error as Error, {
        operationCount: operations.length,
        component: 'OptimizedConnectionPoolManager'
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 批量执行查询
   */
  async executeBatch(
    queries: Array<{ text: string; params?: any[] }>,
    options: {
      parallel?: boolean;
      batchSize?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<Array<{ success: boolean; result?: any; error?: Error }>> {
    const { parallel = false, batchSize = 10, continueOnError = false } = options;
    const results: Array<{ success: boolean; result?: any; error?: Error }> = [];

    if (parallel) {
      // 并行执行（分批）
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (query) => {
          try {
            const result = await this.executeQuery(query.text, query.params);
            return { success: true, result };
          } catch (error) {
            if (!continueOnError) throw error;
            return { success: false, error: error as Error };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        for (const batchResult of batchResults) {
          if (batchResult.status === 'fulfilled') {
            results.push(batchResult.value);
          } else {
            results.push({ success: false, error: batchResult.reason });
          }
        }
      }
    } else {
      // 串行执行
      for (const query of queries) {
        try {
          const result = await this.executeQuery(query.text, query.params);
          results.push({ success: true, result });
        } catch (error) {
          if (!continueOnError) throw error;
          results.push({ success: false, error: error as Error });
        }
      }
    }

    return results;
  }

  /**
   * 获取连接池状态
   */
  getPoolStatus(): PoolStats & {
    healthStatus: 'healthy' | 'warning' | 'critical';
    recentPerformance: any;
  } {
    // 更新实时统计
    this.poolStats.totalConnections = this.pgPool.totalCount;
    this.poolStats.idleConnections = this.pgPool.idleCount;
    this.poolStats.activeConnections = this.pgPool.totalCount - this.pgPool.idleCount;
    this.poolStats.waitingCount = this.pgPool.waitingCount;

    // 计算健康状态
    const healthStatus = this.calculateHealthStatus();

    // 获取最近性能数据
    const recentPerformance = this.getRecentPerformance();

    return {
      ...this.poolStats,
      healthStatus,
      recentPerformance
    };
  }

  /**
   * 获取慢查询报告
   */
  getSlowQueryReport(limit: number = 10): QueryMetrics[] {
    return this.slowQueries
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * 获取查询性能统计
   */
  getQueryStats(): {
    totalQueries: number;
    averageExecutionTime: number;
    successRate: number;
    slowQueryCount: number;
    topQueries: QueryMetrics[];
  } {
    const totalQueries = this.queryMetrics.length;
    const successfulQueries = this.queryMetrics.filter(q => q.success).length;
    const successRate = totalQueries > 0 ? successfulQueries / totalQueries : 0;
    
    const avgExecutionTime = totalQueries > 0 
      ? this.queryMetrics.reduce((sum, q) => sum + q.executionTime, 0) / totalQueries 
      : 0;

    const topQueries = this.queryMetrics
      .filter(q => q.success)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 5);

    return {
      totalQueries,
      averageExecutionTime: avgExecutionTime,
      successRate,
      slowQueryCount: this.slowQueries.length,
      topQueries
    };
  }

  /**
   * 优化连接池配置
   */
  async optimizePoolConfiguration(): Promise<void> {
    const stats = this.getPoolStatus();
    const recentMetrics = this.getRecentQueryMetrics();

    this.logger.info('Starting pool optimization', {
      currentConnections: stats.totalConnections,
      averageQueryTime: stats.averageQueryTime,
      component: 'OptimizedConnectionPoolManager'
    });

    // 基于性能指标调整配置
    let needsRestart = false;

    // 调整最大连接数
    if (stats.waitingCount > 0 && stats.averageQueryTime > 1000) {
      const newMax = Math.min(this.config.max! * 1.5, 50);
      if (newMax !== this.config.max) {
        this.config.max = newMax;
        needsRestart = true;
        this.logger.info('Increased max connections', { newMax });
      }
    }

    // 调整最小连接数
    if (stats.idleConnections > stats.totalConnections * 0.8) {
      const newMin = Math.max(this.config.min! * 0.8, 2);
      if (newMin !== this.config.min) {
        this.config.min = newMin;
        needsRestart = true;
        this.logger.info('Decreased min connections', { newMin });
      }
    }

    if (needsRestart) {
      await this.restartPool();
    }

    this.lastTuningTime = new Date();
  }

  /**
   * 预热连接池
   */
  async warmupPool(): Promise<void> {
    this.logger.info('Starting connection pool warmup');

    const warmupQueries = this.config.connectionWarmupQueries || [
      'SELECT 1',
      'SELECT current_timestamp',
      'SELECT version()'
    ];

    const warmupPromises = [];
    for (let i = 0; i < (this.config.min || 5); i++) {
      warmupPromises.push(this.warmupSingleConnection(warmupQueries));
    }

    await Promise.allSettled(warmupPromises);
    this.logger.info('Connection pool warmup completed');
  }

  /**
   * 获取连接
   */
  private async getConnection(timeout?: number): Promise<PoolClient> {
    const connectTimeout = timeout || this.config.connectionTimeoutMillis || 10000;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Connection timeout after ${connectTimeout}ms`));
      }, connectTimeout);

      this.pgPool.connect((err, client, release) => {
        clearTimeout(timer);
        
        if (err) {
          reject(err);
        } else {
          // 包装release函数以添加监控
          const wrappedClient = client as PoolClient;
          const originalRelease = wrappedClient.release;
          
          wrappedClient.release = (err?: Error | boolean) => {
            if (typeof err === 'boolean') {
              return originalRelease(err);
            } else {
              return originalRelease(err);
            }
          };

          resolve(wrappedClient);
        }
      });
    });
  }

  /**
   * 连接预热
   */
  private async warmupConnection(client: PoolClient): Promise<void> {
    const warmupQueries = this.config.connectionWarmupQueries || ['SELECT 1'];
    
    try {
      for (const query of warmupQueries) {
        await client.query(query);
      }
    } catch (error) {
      this.logger.warn('Connection warmup query failed', {
        error: (error as Error).message,
        component: 'OptimizedConnectionPoolManager'
      });
    }
  }

  /**
   * 单个连接预热
   */
  private async warmupSingleConnection(queries: string[]): Promise<void> {
    let client: PoolClient | null = null;
    
    try {
      client = await this.getConnection();
      
      for (const query of queries) {
        await client.query(query);
      }
    } catch (error) {
      this.logger.warn('Single connection warmup failed', {
        error: (error as Error).message,
        component: 'OptimizedConnectionPoolManager'
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * 启动健康监控
   */
  private startHealthMonitoring(): void {
    const interval = this.config.healthCheckInterval || 30000; // 30秒
    
    setInterval(async () => {
      await this.performHealthCheck();
    }, interval);

    this.logger.info('Health monitoring started', {
      interval,
      component: 'OptimizedConnectionPoolManager'
    });
  }

  /**
   * 启动性能跟踪
   */
  private startPerformanceTracking(): void {
    setInterval(() => {
      this.trackPerformance();
    }, 60000); // 每分钟记录一次

    this.logger.info('Performance tracking started', {
      component: 'OptimizedConnectionPoolManager'
    });
  }

  /**
   * 启用自动调优
   */
  private enableAutoTuning(): void {
    this.autoTuningEnabled = true;
    const interval = this.config.autoTuningInterval || 300000; // 5分钟

    setInterval(async () => {
      if (this.shouldPerformAutoTuning()) {
        await this.optimizePoolConfiguration();
      }
    }, interval);

    this.logger.info('Auto-tuning enabled', {
      interval,
      component: 'OptimizedConnectionPoolManager'
    });
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    let client: PoolClient | null = null;
    const checkStart = Date.now();
    
    try {
      client = await this.getConnection(5000); // 5秒超时
      await client.query('SELECT 1');
      
      const responseTime = Date.now() - checkStart;
      
      this.connectionHealth.set('primary', {
        lastCheck: new Date(),
        status: responseTime < 1000 ? 'healthy' : 'warning',
        errorCount: 0,
        averageResponseTime: responseTime
      });

    } catch (error) {
      this.connectionHealth.set('primary', {
        lastCheck: new Date(),
        status: 'error',
        errorCount: (this.connectionHealth.get('primary')?.errorCount || 0) + 1,
        averageResponseTime: Date.now() - checkStart
      });

      this.logger.error('Health check failed', error as Error, {
        component: 'OptimizedConnectionPoolManager'
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * 跟踪性能
   */
  private trackPerformance(): void {
    const stats = this.getPoolStatus();
    const memoryUsage = typeof process !== 'undefined' ? (process as any).memoryUsage().heapUsed : 0;
    
    this.performanceHistory.push({
      timestamp: new Date(),
      stats: { ...stats },
      memoryUsage,
      cpuUsage: 0 // 简化实现
    });

    // 保留最近1小时的数据
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.performanceHistory = this.performanceHistory.filter(
      record => record.timestamp > oneHourAgo
    );
  }

  /**
   * 更新查询统计
   */
  private updateQueryStats(success: boolean, executionTime: number): void {
    this.poolStats.totalQueries++;
    
    if (!success) {
      this.poolStats.errorCount++;
    }

    // 更新平均查询时间
    this.poolStats.averageQueryTime = 
      (this.poolStats.averageQueryTime + executionTime) / 2;
  }

  /**
   * 记录查询指标
   */
  private recordQueryMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);

    // 保留最近的指标（限制内存使用）
    const retentionTime = this.config.metricsRetentionTime || 3600000; // 1小时
    const cutoffTime = new Date(Date.now() - retentionTime);
    
    this.queryMetrics = this.queryMetrics.filter(
      metric => metric.timestamp > cutoffTime
    );
  }

  /**
   * 检查慢查询
   */
  private checkSlowQuery(query: string, executionTime: number): void {
    const threshold = this.config.slowQueryThreshold || 1000; // 1秒
    
    if (executionTime > threshold) {
      const slowQuery: QueryMetrics = {
        query: this.sanitizeQuery(query),
        executionTime,
        timestamp: new Date(),
        success: true
      };

      this.slowQueries.push(slowQuery);
      
      // 限制慢查询记录数量
      if (this.slowQueries.length > 100) {
        this.slowQueries = this.slowQueries.slice(-50); // 保留最近50条
      }

      this.logger.warn('Slow query detected', {
        executionTime,
        query: slowQuery.query.substring(0, 100),
        component: 'OptimizedConnectionPoolManager'
      });
    }
  }

  /**
   * 判断是否应该重试查询
   */
  private shouldRetryQuery(error: Error): boolean {
    const retryableErrors = [
      'connection terminated',
      'connection reset',
      'timeout',
      'ECONNRESET',
      'ETIMEDOUT'
    ];

    return retryableErrors.some(errorPattern => 
      error.message.toLowerCase().includes(errorPattern.toLowerCase())
    );
  }

  /**
   * 计算健康状态
   */
  private calculateHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const errorRate = this.poolStats.totalQueries > 0 
      ? this.poolStats.errorCount / this.poolStats.totalQueries 
      : 0;

    const connectionUtilization = this.poolStats.totalConnections > 0
      ? this.poolStats.activeConnections / this.poolStats.totalConnections
      : 0;

    if (errorRate > 0.1 || connectionUtilization > 0.9 || this.poolStats.waitingCount > 5) {
      return 'critical';
    } else if (errorRate > 0.05 || connectionUtilization > 0.7 || this.poolStats.averageQueryTime > 2000) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * 获取最近性能数据
   */
  private getRecentPerformance(): any {
    const recent = this.performanceHistory.slice(-10); // 最近10个数据点
    
    if (recent.length === 0) return null;

    const avgQueryTime = recent.reduce((sum, r) => sum + r.stats.averageQueryTime, 0) / recent.length;
    const avgConnections = recent.reduce((sum, r) => sum + r.stats.activeConnections, 0) / recent.length;
    
    return {
      averageQueryTime: avgQueryTime,
      averageActiveConnections: avgConnections,
      dataPoints: recent.length
    };
  }

  /**
   * 获取最近查询指标
   */
  private getRecentQueryMetrics(): QueryMetrics[] {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.queryMetrics.filter(metric => metric.timestamp > fiveMinutesAgo);
  }

  /**
   * 判断是否应该执行自动调优
   */
  private shouldPerformAutoTuning(): boolean {
    const timeSinceLastTuning = Date.now() - this.lastTuningTime.getTime();
    const minInterval = 5 * 60 * 1000; // 5分钟最小间隔
    
    return this.autoTuningEnabled && timeSinceLastTuning > minInterval;
  }

  /**
   * 重启连接池
   */
  private async restartPool(): Promise<void> {
    this.logger.info('Restarting connection pool with new configuration');
    
    try {
      await this.pgPool.end();
      this.initializePostgresPool();
      await this.warmupPool();
      
      this.logger.info('Connection pool restarted successfully');
    } catch (error) {
      this.logger.error('Failed to restart connection pool', error as Error);
      throw error;
    }
  }

  /**
   * 生成查询ID
   */
  private generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理敏感信息的查询
   */
  private sanitizeQuery(query: string): string {
    // 移除潜在的敏感信息
    return query
      .replace(/\$\d+/g, '?') // 替换参数占位符
      .replace(/\s+/g, ' ')   // 规范化空白字符
      .trim()
      .substring(0, 200);     // 限制长度
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 关闭连接池
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down connection pool manager');

    try {
      await this.pgPool.end();
      
      if (this.redisPool) {
        await this.redisPool.quit();
      }

      // 清理指标数据
      this.queryMetrics.length = 0;
      this.slowQueries.length = 0;
      this.performanceHistory.length = 0;
      this.connectionHealth.clear();

      this.logger.info('Connection pool manager shutdown completed');
    } catch (error) {
      this.logger.error('Error during connection pool shutdown', error as Error);
      throw error;
    }
  }
}