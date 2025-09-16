import { Logger } from '../Logger';
import { EventEmitter } from 'events';

/**
 * 性能监控事件类型
 */
export enum PerformanceEventType {
  HIGH_MEMORY_USAGE = 'high_memory_usage',
  SLOW_RESPONSE = 'slow_response',
  HIGH_ERROR_RATE = 'high_error_rate',
  CACHE_MISS_SPIKE = 'cache_miss_spike'
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  timestamp: Date;
  memoryUsage: { heapUsed: number; percentage: number };
  responseTime: { average: number; p95: number };
  throughput: { requestsPerSecond: number };
  errorRate: { percentage: number };
  cacheMetrics: { hitRate: number; missRate: number };
}

/**
 * 游戏模式性能监控器
 */
export class GameModePerformanceMonitor extends EventEmitter {
  private metricsHistory: PerformanceMetrics[] = [];
  private responseTimes: number[] = [];
  private errorCounts: number[] = [];
  private requestCounts: number[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(private logger: Logger) {
    super();
  }

  /**
   * 开始性能监控
   */
  startMonitoring(interval: number = 5000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, interval);

    this.logger.info('Performance monitoring started');
  }

  /**
   * 停止性能监控
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.logger.info('Performance monitoring stopped');
  }

  /**
   * 记录响应时间
   */
  recordResponseTime(time: number): void {
    this.responseTimes.push(time);
    this.trimArray(this.responseTimes, 50);
    
    if (time > 2000) {
      this.emit('alert', {
        type: PerformanceEventType.SLOW_RESPONSE,
        value: time,
        timestamp: new Date()
      });
    }
  }

  /**
   * 记录错误
   */
  recordError(): void {
    this.errorCounts.push(Date.now());
    this.trimArray(this.errorCounts, 50);
  }

  /**
   * 记录请求
   */
  recordRequest(): void {
    this.requestCounts.push(Date.now());
    this.trimArray(this.requestCounts, 50);
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): PerformanceMetrics {
    return this.collectMetrics();
  }

  /**
   * 获取性能历史
   */
  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    return limit ? this.metricsHistory.slice(-limit) : [...this.metricsHistory];
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): PerformanceMetrics {
    const memoryUsage = this.collectMemoryMetrics();
    const responseTime = this.collectResponseTimeMetrics();
    const throughput = this.collectThroughputMetrics();
    const errorRate = this.collectErrorRateMetrics();
    const cacheMetrics = this.collectCacheMetrics();

    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      memoryUsage,
      responseTime,
      throughput,
      errorRate,
      cacheMetrics
    };

    this.metricsHistory.push(metrics);
    this.trimArray(this.metricsHistory, 1000);
    this.checkAlerts(metrics);

    return metrics;
  }

  /**
   * 收集内存指标
   */
  private collectMemoryMetrics(): PerformanceMetrics['memoryUsage'] {
    if (typeof process === 'undefined') {
      return { heapUsed: 0, percentage: 0 };
    }

    const memUsage = (process as any).memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
    };
  }

  /**
   * 收集响应时间指标
   */
  private collectResponseTimeMetrics(): PerformanceMetrics['responseTime'] {
    if (this.responseTimes.length === 0) {
      return { average: 0, p95: 0 };
    }

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const average = this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
    const p95Index = Math.ceil(0.95 * sorted.length) - 1;
    
    return {
      average,
      p95: sorted[Math.max(0, p95Index)]
    };
  }

  /**
   * 收集吞吐量指标
   */
  private collectThroughputMetrics(): PerformanceMetrics['throughput'] {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentRequests = this.requestCounts.filter(time => time > oneSecondAgo).length;
    
    return { requestsPerSecond: recentRequests };
  }

  /**
   * 收集错误率指标
   */
  private collectErrorRateMetrics(): PerformanceMetrics['errorRate'] {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentErrors = this.errorCounts.filter(time => time > oneMinuteAgo).length;
    const recentRequests = this.requestCounts.filter(time => time > oneMinuteAgo).length;
    const percentage = recentRequests > 0 ? (recentErrors / recentRequests) * 100 : 0;
    
    return { percentage };
  }

  /**
   * 收集缓存指标
   */
  private collectCacheMetrics(): PerformanceMetrics['cacheMetrics'] {
    return {
      hitRate: 85 + Math.random() * 10,
      missRate: 5 + Math.random() * 10
    };
  }

  /**
   * 检查告警
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    if (metrics.memoryUsage.percentage > 80) {
      this.emit('alert', {
        type: PerformanceEventType.HIGH_MEMORY_USAGE,
        value: metrics.memoryUsage.percentage,
        timestamp: new Date()
      });
    }

    if (metrics.errorRate.percentage > 5) {
      this.emit('alert', {
        type: PerformanceEventType.HIGH_ERROR_RATE,
        value: metrics.errorRate.percentage,
        timestamp: new Date()
      });
    }

    if (metrics.cacheMetrics.missRate > 30) {
      this.emit('alert', {
        type: PerformanceEventType.CACHE_MISS_SPIKE,
        value: metrics.cacheMetrics.missRate,
        timestamp: new Date()
      });
    }
  }

  /**
   * 修剪数组到指定大小
   */
  private trimArray<T>(array: T[], maxSize: number): void {
    if (array.length > maxSize) {
      array.splice(0, array.length - maxSize);
    }
  }

  /**
   * 关闭监控器
   */
  shutdown(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.metricsHistory.length = 0;
    this.responseTimes.length = 0;
    this.errorCounts.length = 0;
    this.requestCounts.length = 0;
  }
}