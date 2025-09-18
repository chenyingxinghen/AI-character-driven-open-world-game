import { Logger } from '../Logger';
import { CacheUtil } from '../../utils/CommonUtils';
import { GameSession } from '../../domains/gameMode/entities';
import { StoryOutline, PlotPoint, InterventionRecord } from '../../domains/gameMode/valueObjects';
import LRUCache from 'lru-cache';

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
  private storyOutlineCache: any; // 简化类型定义
  private responseCache: any;
  private deviationCalculationCache: any;
  private interventionCache: any;
  
  private memoryWatermarks: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };

  private performanceMetrics: {
    cacheHits: number;
    cacheMisses: number;
    averageResponseTime: number;
    memoryCleanups: number;
    optimizationEvents: number;
  };

  private sessionRegistry = new Map<string, {
    session: GameSession;
    lastAccessed: Date;
    memoryUsage: number;
    hotData: Set<string>;
  }>();

  constructor(private logger: Logger) {
    // 初始化属性为空值，等待具体配置
    this.memoryWatermarks = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    this.performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      memoryCleanups: 0,
      optimizationEvents: 0
    };

    // 缓存将在具体使用时初始化
  }

  /**
   * 初始化缓存配置
   */
  initializeCaches(options?: {
    storyOutlineCache?: { max: number; maxAge: number };
    responseCache?: { max: number; maxAge: number };
    deviationCache?: { max: number; maxAge: number };
    interventionCache?: { max: number; maxAge: number };
  }): void {
    const defaultOptions = {
      storyOutlineCache: { max: 100, maxAge: 30 * 60 * 1000 },
      responseCache: { max: 500, maxAge: 10 * 60 * 1000 },
      deviationCache: { max: 200, maxAge: 5 * 60 * 1000 },
      interventionCache: { max: 150, maxAge: 15 * 60 * 1000 }
    };

    const config = { ...defaultOptions, ...options };

    this.storyOutlineCache = new LRUCache(config.storyOutlineCache);
    this.responseCache = new LRUCache(config.responseCache);
    this.deviationCalculationCache = new LRUCache(config.deviationCache);
    this.interventionCache = new LRUCache(config.interventionCache);

    this.logger.info('Caches initialized', { config, component: 'GameModePerformanceOptimizer' });
  }

  /**
   * 配置内存水位
   */
  configureMemoryWatermarks(watermarks: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  }): void {
    this.memoryWatermarks = watermarks;
    this.logger.info('Memory watermarks configured', { watermarks, component: 'GameModePerformanceOptimizer' });
  }

  /**
   * 启动内存监控
   */
  startMemoryMonitoring(intervalMs: number = 30000): void {
    setInterval(() => {
      this.monitorMemoryUsage();
    }, intervalMs);

    this.logger.info('Memory monitoring started', {
      intervalMs,
      component: 'GameModePerformanceOptimizer'
    });
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring(intervalMs: number = 60000): void {
    setInterval(() => {
      this.reportPerformanceMetrics();
    }, intervalMs);

    this.logger.info('Performance monitoring started', {
      intervalMs,
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
    if (!this.storyOutlineCache) {
      this.logger.warn('Story outline cache not initialized, loading directly', { storyId });
      return await loader();
    }

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
    
    if (!useCache || !this.responseCache) {
      if (!this.responseCache) {
        this.logger.warn('Response cache not initialized, generating directly');
      }
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
    if (!this.deviationCalculationCache) {
      this.logger.warn('Deviation calculation cache not initialized, calculating directly');
      return calculator(action, expectedAction, plotPoint);
    }

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
    if (!this.interventionCache) {
      this.logger.warn('Intervention cache not initialized, loading directly');
      return loader(sessionId, limit);
    }

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
    
    // 将 Map.entries() 转换为数组以避免 TypeScript 编译错误
    const entries = Array.from(this.sessionRegistry.entries());
    for (const [sessionId, sessionInfo] of entries) {
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
  async warmupCriticalData(
    sessionId: string, 
    storyOutlineId: string,
    loaders?: {
      storyOutlineLoader?: () => Promise<StoryOutline>;
      responseTemplateLoaders?: Record<string, () => Promise<string>>;
    }
  ): Promise<void> {
    if (!this.storyOutlineCache || !this.responseCache) {
      this.logger.warn('Caches not initialized, skipping warmup', { sessionId });
      return;
    }

    this.logger.info('Starting critical data warmup', {
      sessionId,
      storyOutlineId,
      component: 'GameModePerformanceOptimizer'
    });

    try {
      // 预加载故事大纲
      const storyKey = `story_outline_${storyOutlineId}`;
      if (!this.storyOutlineCache.has(storyKey) && loaders?.storyOutlineLoader) {
        const outline = await loaders.storyOutlineLoader();
        this.storyOutlineCache.set(storyKey, outline);
        this.logger.debug('Story outline preloaded', { storyOutlineId });
      }

      // 预加载常用响应模板
      if (loaders?.responseTemplateLoaders) {
        for (const [key, loader] of Object.entries(loaders.responseTemplateLoaders)) {
          const cacheKey = `response_template_${key}`;
          if (!this.responseCache.has(cacheKey)) {
            const template = await loader();
            this.responseCache.set(cacheKey, template);
            this.logger.debug('Response template preloaded', { key });
          }
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

    // 只有在配置了内存水位时才进行检查
    if (this.memoryWatermarks.critical > 0) {
      if (heapUsed > this.memoryWatermarks.critical) {
        this.triggerEmergencyCleanup();
      } else if (heapUsed > this.memoryWatermarks.high) {
        this.triggerAggressiveCleanup();
      } else if (heapUsed > this.memoryWatermarks.medium) {
        this.triggerNormalCleanup();
      }
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
    
    // 清理缓存
    this.responseCache.reset();
    this.deviationCalculationCache.reset();
    
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
    
    // 清理缓存
    this.responseCache.reset();
    this.deviationCalculationCache.reset();
    
    // 清理不活跃会话
    this.cleanupInactiveSessions(15 * 60 * 1000); // 15分钟
    
    this.performanceMetrics.optimizationEvents++;
  }

  /**
   * 触发常规清理
   */
  private triggerNormalCleanup(): void {
    this.logger.debug('Triggering normal memory cleanup');
    
    // 清理缓存
    this.deviationCalculationCache.reset();
    
    // 清理不活跃会话
    this.cleanupInactiveSessions(); // 默认30分钟
  }

  /**
   * 修剪缓存
   */
  private trimCache(cache: any, ratio: number): void {
    const currentSize = cache.itemCount;
    const targetSize = Math.floor(currentSize * (1 - ratio));
    
    // 由于 lru-cache v5.1.1 没有直接的方法来删除特定数量的项目，
    // 我们需要手动实现修剪逻辑
    // 这里简化处理，只重置缓存（实际实现中可能需要更复杂的逻辑）
    if (targetSize <= 0) {
      cache.reset();
    }
  }

  /**
   * 清理会话相关缓存
   */
  private cleanupSessionCaches(sessionId: string): void {
    // 由于 lru-cache v5.1.1 没有简单的键过滤方法，
    // 我们需要重置整个缓存（实际实现中可能需要更复杂的逻辑）
    this.responseCache.reset();
    this.interventionCache.reset();
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
    const stats: any = {};
    
    if (this.storyOutlineCache) {
      stats.storyOutline = {
        size: this.storyOutlineCache.itemCount,
        max: this.storyOutlineCache.max
      };
    }
    
    if (this.responseCache) {
      stats.response = {
        size: this.responseCache.itemCount,
        max: this.responseCache.max
      };
    }
    
    if (this.deviationCalculationCache) {
      stats.deviation = {
        size: this.deviationCalculationCache.itemCount,
        max: this.deviationCalculationCache.max
      };
    }
    
    if (this.interventionCache) {
      stats.intervention = {
        size: this.interventionCache.itemCount,
        max: this.interventionCache.max
      };
    }
    
    return stats;
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
    // 清理所有缓存（如果已初始化）
    if (this.storyOutlineCache) {
      this.storyOutlineCache.reset();
    }
    if (this.responseCache) {
      this.responseCache.reset();
    }
    if (this.deviationCalculationCache) {
      this.deviationCalculationCache.reset();
    }
    if (this.interventionCache) {
      this.interventionCache.reset();
    }
    
    // 清理会话注册表
    this.sessionRegistry.clear();
    
    this.logger.info('Performance optimizer shut down', {
      component: 'GameModePerformanceOptimizer'
    });
  }
}