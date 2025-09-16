import { Logger } from '../Logger';
import { CacheUtil } from '../../utils/CommonUtils';
import { GameSession } from '../../domains/gameMode/entities';
import { StoryOutline, PlotPoint, InterventionRecord } from '../../domains/gameMode/valueObjects';
import { LRUCache } from 'lru-cache';

/**
 * 游戏模式性能优化器
 * 
 * 负责优化游戏模式系统的性能，包括：
 * - 智能缓存策略
 * - 内存管理优化
 * - 响应时间优化
 * - 资源回收管理
 */
export class GameModePerformanceOptimizer {
  private storyOutlineCache: LRUCache<string, StoryOutline>;
  private responseCache: LRUCache<string, string>;
  private deviationCalculationCache: LRUCache<string, number>;
  private interventionCache: LRUCache<string, InterventionRecord[]>;
  
  private memoryWatermarks = {
    low: 100 * 1024 * 1024,    // 100MB
    medium: 250 * 1024 * 1024, // 250MB
    high: 500 * 1024 * 1024,   // 500MB
    critical: 750 * 1024 * 1024 // 750MB
  };

  private performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0,
    memoryCleanups: 0,
    optimizationEvents: 0
  };

  private sessionRegistry = new Map<string, {
    session: GameSession;
    lastAccessed: Date;
    memoryUsage: number;
    hotData: Set<string>;
  }>();

  constructor(private logger: Logger) {
    // 初始化缓存
    this.storyOutlineCache = new LRUCache({
      max: 100,
      ttl: 30 * 60 * 1000, // 30分钟
      allowStale: true
    });

    this.responseCache = new LRUCache({
      max: 500,
      ttl: 10 * 60 * 1000, // 10分钟
      allowStale: false
    });

    this.deviationCalculationCache = new LRUCache({
      max: 200,
      ttl: 5 * 60 * 1000, // 5分钟
      allowStale: true
    });

    this.interventionCache = new LRUCache({
      max: 150,
      ttl: 15 * 60 * 1000, // 15分钟
      allowStale: false
    });

    this.startMemoryMonitoring();
    this.startPerformanceMonitoring();
  }

  /**
   * 启动内存监控
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      this.monitorMemoryUsage();
    }, 30000); // 每30秒检查一次内存

    this.logger.info('Memory monitoring started', {
      component: 'GameModePerformanceOptimizer'
    });
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.reportPerformanceMetrics();
    }, 60000); // 每分钟报告一次性能指标

    this.logger.info('Performance monitoring started', {
      component: 'GameModePerformanceOptimizer'
    });
  }

  /**
   * 优化故事大纲访问
   */
  async optimizedGetStoryOutline(
    storyId: string,
    loader: () => Promise<StoryOutline>
  ): Promise<StoryOutline> {
    const cacheKey = `story_outline_${storyId}`;
    
    // 尝试从缓存获取
    let outline = this.storyOutlineCache.get(cacheKey);
    if (outline) {
      this.performanceMetrics.cacheHits++;
      this.logger.debug('Story outline cache hit', { storyId });
      return outline;
    }

    // 缓存未命中，加载数据
    this.performanceMetrics.cacheMisses++;
    const startTime = Date.now();
    
    try {
      outline = await loader();
      
      // 缓存结果
      this.storyOutlineCache.set(cacheKey, outline);
      
      const loadTime = Date.now() - startTime;
      this.updateAverageResponseTime(loadTime);
      
      this.logger.debug('Story outline loaded and cached', { 
        storyId, 
        loadTime,
        component: 'GameModePerformanceOptimizer'
      });
      
      return outline;
    } catch (error) {
      this.logger.error('Failed to load story outline', error as Error, { storyId });
      throw error;
    }
  }

  /**
   * 优化响应生成缓存
   */
  async optimizedGetResponse(
    requestKey: string,
    generator: () => Promise<string>,
    options: {
      useCache?: boolean;
      cacheTTL?: number;
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<string> {
    const { useCache = true, priority = 'medium' } = options;
    
    if (!useCache) {
      return await generator();
    }

    const cacheKey = `response_${this.hashKey(requestKey)}`;
    
    // 尝试从缓存获取
    let response = this.responseCache.get(cacheKey);
    if (response) {
      this.performanceMetrics.cacheHits++;
      this.logger.debug('Response cache hit', { cacheKey });
      return response;
    }

    // 缓存未命中，生成响应
    this.performanceMetrics.cacheMisses++;
    const startTime = Date.now();
    
    try {
      response = await generator();
      
      // 根据优先级决定是否缓存
      if (this.shouldCacheResponse(priority)) {
        this.responseCache.set(cacheKey, response);
      }
      
      const generateTime = Date.now() - startTime;
      this.updateAverageResponseTime(generateTime);
      
      this.logger.debug('Response generated and cached', { 
        cacheKey,
        generateTime,
        priority,
        component: 'GameModePerformanceOptimizer'
      });
      
      return response;
    } catch (error) {
      this.logger.error('Failed to generate response', error as Error, { cacheKey });
      throw error;
    }
  }

  /**
   * 优化偏离度计算
   */
  optimizedCalculateDeviation(
    action: string,
    expectedAction: string,
    plotPoint: PlotPoint | null,
    calculator: (action: string, expected: string, point: PlotPoint | null) => number
  ): number {
    const cacheKey = `deviation_${this.hashKey(`${action}_${expectedAction}_${plotPoint?.id || 'null'}`)}`;
    
    // 尝试从缓存获取
    let deviation = this.deviationCalculationCache.get(cacheKey);
    if (deviation !== undefined) {
      this.performanceMetrics.cacheHits++;
      return deviation;
    }

    // 计算偏离度
    this.performanceMetrics.cacheMisses++;
    deviation = calculator(action, expectedAction, plotPoint);
    
    // 缓存结果
    this.deviationCalculationCache.set(cacheKey, deviation);
    
    return deviation;
  }

  /**
   * 优化干预记录访问
   */
  optimizedGetInterventionHistory(
    sessionId: string,
    limit: number,
    loader: (sessionId: string, limit: number) => Promise<InterventionRecord[]>
  ): Promise<InterventionRecord[]> {
    const cacheKey = `interventions_${sessionId}_${limit}`;
    
    // 尝试从缓存获取
    let interventions = this.interventionCache.get(cacheKey);
    if (interventions) {
      this.performanceMetrics.cacheHits++;
      return Promise.resolve(interventions);
    }

    // 加载干预记录
    this.performanceMetrics.cacheMisses++;
    
    return loader(sessionId, limit).then(result => {
      // 缓存结果
      this.interventionCache.set(cacheKey, result);
      return result;
    });
  }

  /**
   * 注册会话以进行内存管理
   */
  registerSession(session: GameSession): void {
    this.sessionRegistry.set(session.id, {
      session,
      lastAccessed: new Date(),
      memoryUsage: this.estimateSessionMemoryUsage(session),
      hotData: new Set()
    });

    this.logger.debug('Session registered for memory management', {
      sessionId: session.id,
      component: 'GameModePerformanceOptimizer'
    });
  }

  /**
   * 更新会话访问时间
   */
  updateSessionAccess(sessionId: string, hotDataKeys?: string[]): void {
    const sessionInfo = this.sessionRegistry.get(sessionId);
    if (sessionInfo) {
      sessionInfo.lastAccessed = new Date();
      
      // 更新热数据
      if (hotDataKeys) {
        hotDataKeys.forEach(key => sessionInfo.hotData.add(key));
      }
    }
  }

  /**
   * 清理不活跃的会话
   */
  cleanupInactiveSessions(inactiveThresholdMs: number = 30 * 60 * 1000): number {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [sessionId, sessionInfo] of this.sessionRegistry.entries()) {
      const inactiveTime = now.getTime() - sessionInfo.lastAccessed.getTime();
      
      if (inactiveTime > inactiveThresholdMs) {
        this.sessionRegistry.delete(sessionId);
        
        // 清理相关缓存
        this.cleanupSessionCaches(sessionId);
        
        cleanedCount++;
        
        this.logger.debug('Inactive session cleaned up', {
          sessionId,
          inactiveTime,
          component: 'GameModePerformanceOptimizer'
        });
      }
    }

    if (cleanedCount > 0) {
      this.performanceMetrics.memoryCleanups++;
      this.logger.info('Session cleanup completed', {
        cleanedSessions: cleanedCount,
        activeSessions: this.sessionRegistry.size,
        component: 'GameModePerformanceOptimizer'
      });
    }

    return cleanedCount;
  }

  /**
   * 预热关键数据
   */
  async warmupCriticalData(sessionId: string, storyOutlineId: string): Promise<void> {
    this.logger.info('Starting critical data warmup', {
      sessionId,
      storyOutlineId,
      component: 'GameModePerformanceOptimizer'
    });

    try {
      // 预加载故事大纲
      const storyKey = `story_outline_${storyOutlineId}`;
      if (!this.storyOutlineCache.has(storyKey)) {
        // 这里应该调用实际的加载函数
        this.logger.debug('Story outline would be preloaded', { storyOutlineId });
      }

      // 预加载常用响应模板
      const commonResponseKeys = [
        'default_response',
        'intervention_response',
        'deviation_response'
      ];

      for (const key of commonResponseKeys) {
        const cacheKey = `response_template_${key}`;
        if (!this.responseCache.has(cacheKey)) {
          // 这里可以预加载通用响应模板
          this.logger.debug('Response template would be preloaded', { key });
        }
      }

      this.logger.info('Critical data warmup completed', {
        sessionId,
        component: 'GameModePerformanceOptimizer'
      });
    } catch (error) {
      this.logger.error('Failed to warmup critical data', error as Error, {
        sessionId,
        storyOutlineId
      });
    }
  }

  /**
   * 监控内存使用
   */
  private monitorMemoryUsage(): void {
    if (typeof process === 'undefined') return;

    const memUsage = (process as any).memoryUsage();
    const heapUsed = memUsage.heapUsed;

    // 检查内存水位
    if (heapUsed > this.memoryWatermarks.critical) {
      this.triggerEmergencyCleanup();
    } else if (heapUsed > this.memoryWatermarks.high) {
      this.triggerAggressiveCleanup();
    } else if (heapUsed > this.memoryWatermarks.medium) {
      this.triggerNormalCleanup();
    }

    this.logger.debug('Memory usage monitored', {
      heapUsed: (heapUsed / 1024 / 1024).toFixed(2) + 'MB',
      cacheStats: this.getCacheStats(),
      component: 'GameModePerformanceOptimizer'
    });
  }

  /**
   * 触发紧急清理
   */
  private triggerEmergencyCleanup(): void {
    this.logger.warn('Triggering emergency memory cleanup');
    
    // 清理50%的缓存
    this.responseCache.clear();
    this.deviationCalculationCache.clear();
    
    // 清理不活跃会话（更短的阈值）
    this.cleanupInactiveSessions(5 * 60 * 1000); // 5分钟
    
    // 强制垃圾回收（如果可用）
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
    }

    this.performanceMetrics.optimizationEvents++;
    this.logger.info('Emergency memory cleanup completed');
  }

  /**
   * 触发激进清理
   */
  private triggerAggressiveCleanup(): void {
    this.logger.info('Triggering aggressive memory cleanup');
    
    // 清理30%的缓存
    this.trimCache(this.responseCache, 0.3);
    this.trimCache(this.deviationCalculationCache, 0.5);
    
    // 清理不活跃会话
    this.cleanupInactiveSessions(15 * 60 * 1000); // 15分钟
    
    this.performanceMetrics.optimizationEvents++;
  }

  /**
   * 触发常规清理
   */
  private triggerNormalCleanup(): void {
    this.logger.debug('Triggering normal memory cleanup');
    
    // 轻微清理缓存
    this.trimCache(this.deviationCalculationCache, 0.2);
    
    // 清理不活跃会话
    this.cleanupInactiveSessions(); // 默认30分钟
  }

  /**
   * 修剪缓存
   */
  private trimCache(cache: LRUCache<string, any>, ratio: number): void {
    const currentSize = cache.size;
    const targetSize = Math.floor(currentSize * (1 - ratio));
    
    while (cache.size > targetSize) {
      // LRU缓存会自动移除最旧的项目
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  /**
   * 清理会话相关缓存
   */
  private cleanupSessionCaches(sessionId: string): void {
    // 清理响应缓存中的会话相关项目
    for (const key of this.responseCache.keys()) {
      if (key.includes(sessionId)) {
        this.responseCache.delete(key);
      }
    }

    // 清理干预缓存
    for (const key of this.interventionCache.keys()) {
      if (key.includes(sessionId)) {
        this.interventionCache.delete(key);
      }
    }
  }

  /**
   * 估算会话内存使用
   */
  private estimateSessionMemoryUsage(session: GameSession): number {
    // 简化的内存估算
    let estimate = 1024; // 基础开销 1KB
    
    const sessionData = JSON.stringify(session.getState());
    estimate += sessionData.length * 2; // 假设字符串占用2字节每字符
    
    return estimate;
  }

  /**
   * 生成哈希键
   */
  private hashKey(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(36);
  }

  /**
   * 判断是否应该缓存响应
   */
  private shouldCacheResponse(priority: 'low' | 'medium' | 'high'): boolean {
    const memUsage = typeof process !== 'undefined' ? (process as any).memoryUsage().heapUsed : 0;
    
    if (memUsage > this.memoryWatermarks.high) {
      return priority === 'high';
    } else if (memUsage > this.memoryWatermarks.medium) {
      return priority !== 'low';
    }
    
    return true;
  }

  /**
   * 更新平均响应时间
   */
  private updateAverageResponseTime(newTime: number): void {
    if (this.performanceMetrics.averageResponseTime === 0) {
      this.performanceMetrics.averageResponseTime = newTime;
    } else {
      // 使用移动平均
      this.performanceMetrics.averageResponseTime = 
        (this.performanceMetrics.averageResponseTime * 0.9) + (newTime * 0.1);
    }
  }

  /**
   * 获取缓存统计
   */
  private getCacheStats(): any {
    return {
      storyOutline: {
        size: this.storyOutlineCache.size,
        max: this.storyOutlineCache.max
      },
      response: {
        size: this.responseCache.size,
        max: this.responseCache.max
      },
      deviation: {
        size: this.deviationCalculationCache.size,
        max: this.deviationCalculationCache.max
      },
      intervention: {
        size: this.interventionCache.size,
        max: this.interventionCache.max
      }
    };
  }

  /**
   * 报告性能指标
   */
  private reportPerformanceMetrics(): void {
    const hitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0 
      ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100).toFixed(2)
      : '0.00';

    this.logger.info('Performance metrics report', {
      cacheHitRate: `${hitRate}%`,
      averageResponseTime: `${this.performanceMetrics.averageResponseTime.toFixed(2)}ms`,
      memoryCleanups: this.performanceMetrics.memoryCleanups,
      optimizationEvents: this.performanceMetrics.optimizationEvents,
      activeSessions: this.sessionRegistry.size,
      cacheStats: this.getCacheStats(),
      component: 'GameModePerformanceOptimizer'
    });
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): any {
    const hitRate = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses > 0 
      ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) * 100)
      : 0;

    return {
      ...this.performanceMetrics,
      cacheHitRate: hitRate,
      cacheStats: this.getCacheStats(),
      activeSessions: this.sessionRegistry.size,
      memoryWatermarks: this.memoryWatermarks
    };
  }

  /**
   * 重置性能指标
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      memoryCleanups: 0,
      optimizationEvents: 0
    };

    this.logger.info('Performance metrics reset', {
      component: 'GameModePerformanceOptimizer'
    });
  }

  /**
   * 关闭优化器
   */
  shutdown(): void {
    // 清理所有缓存
    this.storyOutlineCache.clear();
    this.responseCache.clear();
    this.deviationCalculationCache.clear();
    this.interventionCache.clear();
    
    // 清理会话注册表
    this.sessionRegistry.clear();
    
    this.logger.info('Performance optimizer shut down', {
      component: 'GameModePerformanceOptimizer'
    });
  }
}