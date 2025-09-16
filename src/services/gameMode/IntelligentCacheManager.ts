import { Logger } from '../Logger';
import { CacheUtil } from '../../utils/CommonUtils';
import Redis from 'ioredis';

/**
 * 多层级缓存策略
 */
export enum CacheLevel {
  MEMORY = 'memory',     // 内存缓存（最快）
  REDIS = 'redis',       // Redis缓存（中等速度）
  DATABASE = 'database'  // 数据库（最慢）
}

/**
 * 缓存项配置
 */
export interface CacheItemConfig {
  ttl: number;           // 生存时间（毫秒）
  priority: 'low' | 'medium' | 'high' | 'critical';
  compressionEnabled?: boolean;
  serializationStrategy?: 'json' | 'binary' | 'none';
  hotDataThreshold?: number;  // 热数据访问次数阈值
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
  hitRate: number;
  averageAccessTime: number;
}

/**
 * 智能多层级缓存管理器
 * 
 * 特性：
 * - 多层级缓存策略（内存 -> Redis -> 数据库）
 * - 智能缓存预加载和预测
 * - 热数据识别和优先级管理
 * - 压缩和序列化优化
 * - 性能监控和自动调优
 */
export class IntelligentCacheManager {
  private memoryCache = new Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccess: number;
    priority: string;
    size: number;
  }>();

  private redisClient: Redis | null = null;
  private hotDataRegistry = new Map<string, {
    accessCount: number;
    lastAccess: number;
    promoteTimestamp: number;
  }>();

  private cacheStats = new Map<string, CacheStats>();
  private compressionThreshold = 1024; // 1KB以上数据启用压缩
  private memoryLimit = 50 * 1024 * 1024; // 50MB内存限制
  private currentMemoryUsage = 0;

  private accessPatterns = new Map<string, {
    hourlyAccess: number[];
    predictedNextAccess: number;
    accessFrequency: number;
  }>();

  constructor(
    private logger: Logger,
    private redisConfig?: {
      host: string;
      port: number;
      password?: string;
    }
  ) {
    this.initializeRedis();
    this.startCacheOptimization();
    this.startHotDataAnalysis();
  }

  /**
   * 初始化Redis连接
   */
  private async initializeRedis(): Promise<void> {
    if (!this.redisConfig) {
      this.logger.info('Redis not configured, using memory-only cache');
      return;
    }

    try {
      this.redisClient = new Redis({
        host: this.redisConfig.host,
        port: this.redisConfig.port,
        password: this.redisConfig.password,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        lazyConnect: true
      });

      await this.redisClient.ping();
      this.logger.info('Redis cache connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error as Error);
      this.redisClient = null;
    }
  }

  /**
   * 智能缓存获取
   */
  async get<T>(
    key: string,
    config: CacheItemConfig,
    fallbackLoader?: () => Promise<T>
  ): Promise<T | null> {
    const startTime = Date.now();
    this.updateAccessPattern(key);

    try {
      // 1. 尝试内存缓存
      const memoryResult = this.getFromMemory<T>(key);
      if (memoryResult !== null) {
        this.recordCacheHit(key, 'memory', Date.now() - startTime);
        this.updateHotData(key);
        return memoryResult;
      }

      // 2. 尝试Redis缓存
      if (this.redisClient) {
        const redisResult = await this.getFromRedis<T>(key, config);
        if (redisResult !== null) {
          this.recordCacheHit(key, 'redis', Date.now() - startTime);
          this.updateHotData(key);
          
          // 提升到内存缓存
          await this.promoteToMemory(key, redisResult, config);
          return redisResult;
        }
      }

      // 3. 缓存未命中，使用fallback加载器
      if (fallbackLoader) {
        const result = await fallbackLoader();
        if (result !== null) {
          await this.set(key, result, config);
        }
        this.recordCacheMiss(key, Date.now() - startTime);
        return result;
      }

      this.recordCacheMiss(key, Date.now() - startTime);
      return null;
    } catch (error) {
      this.logger.error('Cache get operation failed', error as Error, { key });
      this.recordCacheMiss(key, Date.now() - startTime);
      
      // 降级到fallback
      if (fallbackLoader) {
        return await fallbackLoader();
      }
      return null;
    }
  }

  /**
   * 智能缓存设置
   */
  async set(key: string, value: any, config: CacheItemConfig): Promise<boolean> {
    try {
      const serializedData = this.serialize(value, config.serializationStrategy || 'json');
      const compressedData = config.compressionEnabled && serializedData.length > this.compressionThreshold
        ? await this.compress(serializedData)
        : serializedData;

      const dataSize = compressedData.length;
      
      // 根据优先级和大小决定缓存策略
      const shouldCacheInMemory = this.shouldCacheInMemory(config.priority, dataSize);
      const shouldCacheInRedis = this.shouldCacheInRedis(config.priority, dataSize);

      let memorySuccess = false;
      let redisSuccess = false;

      // 设置内存缓存
      if (shouldCacheInMemory) {
        memorySuccess = this.setInMemory(key, value, config, dataSize);
      }

      // 设置Redis缓存
      if (shouldCacheInRedis && this.redisClient) {
        redisSuccess = await this.setInRedis(key, compressedData, config);
      }

      this.logger.debug('Cache set operation completed', {
        key,
        memorySuccess,
        redisSuccess,
        dataSize,
        priority: config.priority,
        component: 'IntelligentCacheManager'
      });

      return memorySuccess || redisSuccess;
    } catch (error) {
      this.logger.error('Cache set operation failed', error as Error, { key });
      return false;
    }
  }

  /**
   * 批量预加载
   */
  async preload(
    keys: string[],
    loaders: Map<string, () => Promise<any>>,
    configs: Map<string, CacheItemConfig>
  ): Promise<{ loaded: number; failed: number }> {
    let loaded = 0;
    let failed = 0;

    const promises = keys.map(async (key) => {
      try {
        const loader = loaders.get(key);
        const config = configs.get(key);
        
        if (loader && config) {
          // 检查是否已缓存
          const cached = await this.get(key, config);
          if (cached === null) {
            const data = await loader();
            await this.set(key, data, config);
            loaded++;
          }
        }
      } catch (error) {
        this.logger.error('Failed to preload cache item', error as Error, { key });
        failed++;
      }
    });

    await Promise.allSettled(promises);

    this.logger.info('Cache preload completed', {
      totalKeys: keys.length,
      loaded,
      failed,
      component: 'IntelligentCacheManager'
    });

    return { loaded, failed };
  }

  /**
   * 智能预测和预加载
   */
  async predictivePreload(sessionId: string): Promise<void> {
    const predictions = this.generateAccessPredictions(sessionId);
    
    for (const prediction of predictions) {
      if (prediction.confidence > 0.7) {
        // 预加载高置信度的数据
        try {
          await this.get(prediction.key, prediction.config);
        } catch (error) {
          this.logger.debug('Predictive preload failed', { key: prediction.key });
        }
      }
    }
  }

  /**
   * 删除缓存项
   */
  async delete(key: string): Promise<boolean> {
    let memoryDeleted = false;
    let redisDeleted = false;

    // 从内存删除
    if (this.memoryCache.has(key)) {
      const item = this.memoryCache.get(key);
      if (item) {
        this.currentMemoryUsage -= item.size;
      }
      this.memoryCache.delete(key);
      memoryDeleted = true;
    }

    // 从Redis删除
    if (this.redisClient) {
      try {
        const result = await this.redisClient.del(key);
        redisDeleted = result > 0;
      } catch (error) {
        this.logger.error('Failed to delete from Redis', error as Error, { key });
      }
    }

    // 清理相关数据
    this.hotDataRegistry.delete(key);
    this.accessPatterns.delete(key);

    return memoryDeleted || redisDeleted;
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<{ cleaned: number; memoryFreed: number }> {
    let cleaned = 0;
    let memoryFreed = 0;
    const now = Date.now();

    // 清理内存缓存
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.timestamp > item.ttl) {
        memoryFreed += item.size;
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    // 更新内存使用量
    this.currentMemoryUsage -= memoryFreed;

    this.logger.debug('Cache cleanup completed', {
      cleaned,
      memoryFreed,
      currentMemoryUsage: this.currentMemoryUsage,
      component: 'IntelligentCacheManager'
    });

    return { cleaned, memoryFreed };
  }

  /**
   * 从内存获取
   */
  private getFromMemory<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.currentMemoryUsage -= item.size;
      this.memoryCache.delete(key);
      return null;
    }

    item.accessCount++;
    item.lastAccess = now;
    return item.data as T;
  }

  /**
   * 从Redis获取
   */
  private async getFromRedis<T>(key: string, config: CacheItemConfig): Promise<T | null> {
    if (!this.redisClient) return null;

    try {
      const data = await this.redisClient.get(key);
      if (!data) return null;

      const decompressed = await this.decompress(data);
      const deserialized = this.deserialize(decompressed, config.serializationStrategy || 'json');
      return deserialized as T;
    } catch (error) {
      this.logger.error('Failed to get from Redis', error as Error, { key });
      return null;
    }
  }

  /**
   * 设置到内存
   */
  private setInMemory(key: string, value: any, config: CacheItemConfig, dataSize: number): boolean {
    // 检查内存限制
    if (this.currentMemoryUsage + dataSize > this.memoryLimit) {
      this.evictMemoryItems(dataSize);
    }

    this.memoryCache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: config.ttl,
      accessCount: 1,
      lastAccess: Date.now(),
      priority: config.priority,
      size: dataSize
    });

    this.currentMemoryUsage += dataSize;
    return true;
  }

  /**
   * 设置到Redis
   */
  private async setInRedis(key: string, data: string, config: CacheItemConfig): Promise<boolean> {
    if (!this.redisClient) return false;

    try {
      await this.redisClient.setex(key, Math.floor(config.ttl / 1000), data);
      return true;
    } catch (error) {
      this.logger.error('Failed to set in Redis', error as Error, { key });
      return false;
    }
  }

  /**
   * 提升到内存缓存
   */
  private async promoteToMemory(key: string, value: any, config: CacheItemConfig): Promise<void> {
    if (this.isHotData(key)) {
      const dataSize = JSON.stringify(value).length;
      this.setInMemory(key, value, config, dataSize);
    }
  }

  /**
   * 内存项驱逐
   */
  private evictMemoryItems(requiredSpace: number): void {
    const items = Array.from(this.memoryCache.entries())
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => {
        // 基于优先级、访问频率和时间的综合评分
        const scoreA = this.calculateEvictionScore(a);
        const scoreB = this.calculateEvictionScore(b);
        return scoreA - scoreB;
      });

    let freedSpace = 0;
    let evicted = 0;

    for (const item of items) {
      if (freedSpace >= requiredSpace) break;

      this.memoryCache.delete(item.key);
      freedSpace += item.size;
      evicted++;
    }

    this.currentMemoryUsage -= freedSpace;

    this.logger.debug('Memory eviction completed', {
      evicted,
      freedSpace,
      requiredSpace,
      component: 'IntelligentCacheManager'
    });
  }

  /**
   * 计算驱逐评分
   */
  private calculateEvictionScore(item: any): number {
    const now = Date.now();
    const ageWeight = (now - item.timestamp) / item.ttl;
    const accessWeight = 1 / (item.accessCount + 1);
    const priorityWeight = this.getPriorityWeight(item.priority);
    const sizeWeight = item.size / 1024; // KB

    return ageWeight + accessWeight + sizeWeight - priorityWeight;
  }

  /**
   * 获取优先级权重
   */
  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'critical': return 10;
      case 'high': return 5;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 1;
    }
  }

  /**
   * 判断是否应该缓存在内存
   */
  private shouldCacheInMemory(priority: string, dataSize: number): boolean {
    if (priority === 'critical') return true;
    if (priority === 'high' && dataSize < 10 * 1024) return true; // 10KB
    if (priority === 'medium' && dataSize < 5 * 1024) return true; // 5KB
    if (priority === 'low' && dataSize < 1024) return true; // 1KB
    return false;
  }

  /**
   * 判断是否应该缓存在Redis
   */
  private shouldCacheInRedis(priority: string, dataSize: number): boolean {
    return this.redisClient !== null && (priority !== 'low' || dataSize < 100 * 1024);
  }

  /**
   * 序列化数据
   */
  private serialize(data: any, strategy: string): string {
    switch (strategy) {
      case 'json':
        return JSON.stringify(data);
      case 'binary':
        // 简化实现，实际可以使用更高效的二进制序列化
        return JSON.stringify(data);
      case 'none':
        return data.toString();
      default:
        return JSON.stringify(data);
    }
  }

  /**
   * 反序列化数据
   */
  private deserialize(data: string, strategy: string): any {
    switch (strategy) {
      case 'json':
        return JSON.parse(data);
      case 'binary':
        return JSON.parse(data);
      case 'none':
        return data;
      default:
        return JSON.parse(data);
    }
  }

  /**
   * 压缩数据
   */
  private async compress(data: string): Promise<string> {
    // 简化实现，实际可以使用zlib或其他压缩算法
    return data;
  }

  /**
   * 解压数据
   */
  private async decompress(data: string): Promise<string> {
    // 简化实现
    return data;
  }

  /**
   * 更新访问模式
   */
  private updateAccessPattern(key: string): void {
    const pattern = this.accessPatterns.get(key) || {
      hourlyAccess: new Array(24).fill(0),
      predictedNextAccess: 0,
      accessFrequency: 0
    };

    const hour = new Date().getHours();
    pattern.hourlyAccess[hour]++;
    pattern.accessFrequency++;

    this.accessPatterns.set(key, pattern);
  }

  /**
   * 更新热数据
   */
  private updateHotData(key: string): void {
    const hotData = this.hotDataRegistry.get(key) || {
      accessCount: 0,
      lastAccess: 0,
      promoteTimestamp: 0
    };

    hotData.accessCount++;
    hotData.lastAccess = Date.now();

    this.hotDataRegistry.set(key, hotData);
  }

  /**
   * 判断是否为热数据
   */
  private isHotData(key: string, threshold: number = 5): boolean {
    const hotData = this.hotDataRegistry.get(key);
    return hotData ? hotData.accessCount >= threshold : false;
  }

  /**
   * 生成访问预测
   */
  private generateAccessPredictions(sessionId: string): Array<{
    key: string;
    confidence: number;
    config: CacheItemConfig;
  }> {
    // 简化的预测实现
    const predictions: Array<{ key: string; confidence: number; config: CacheItemConfig }> = [];

    // 基于访问模式生成预测
    for (const [key, pattern] of this.accessPatterns.entries()) {
      if (key.includes(sessionId)) {
        const hour = new Date().getHours();
        const avgAccess = pattern.hourlyAccess.reduce((sum, count) => sum + count, 0) / 24;
        const currentHourAccess = pattern.hourlyAccess[hour];
        
        const confidence = Math.min(1, currentHourAccess / (avgAccess || 1));
        
        if (confidence > 0.3) {
          predictions.push({
            key,
            confidence,
            config: {
              ttl: 10 * 60 * 1000, // 10分钟
              priority: confidence > 0.7 ? 'high' : 'medium'
            }
          });
        }
      }
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 记录缓存命中
   */
  private recordCacheHit(key: string, level: string, accessTime: number): void {
    const stats = this.cacheStats.get(level) || {
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0,
      hitRate: 0,
      averageAccessTime: 0
    };

    stats.hits++;
    stats.averageAccessTime = (stats.averageAccessTime + accessTime) / 2;
    stats.hitRate = stats.hits / (stats.hits + stats.misses);

    this.cacheStats.set(level, stats);
  }

  /**
   * 记录缓存未命中
   */
  private recordCacheMiss(key: string, accessTime: number): void {
    for (const level of ['memory', 'redis']) {
      const stats = this.cacheStats.get(level) || {
        hits: 0,
        misses: 0,
        evictions: 0,
        memoryUsage: 0,
        hitRate: 0,
        averageAccessTime: 0
      };

      stats.misses++;
      stats.hitRate = stats.hits / (stats.hits + stats.misses);

      this.cacheStats.set(level, stats);
    }
  }

  /**
   * 启动缓存优化
   */
  private startCacheOptimization(): void {
    setInterval(async () => {
      await this.cleanup();
      this.optimizeCacheStrategy();
    }, 60000); // 每分钟优化一次
  }

  /**
   * 启动热数据分析
   */
  private startHotDataAnalysis(): void {
    setInterval(() => {
      this.analyzeHotData();
    }, 300000); // 每5分钟分析一次
  }

  /**
   * 优化缓存策略
   */
  private optimizeCacheStrategy(): void {
    // 基于统计信息调整缓存策略
    const memoryStats = this.cacheStats.get('memory');
    const redisStats = this.cacheStats.get('redis');

    if (memoryStats && memoryStats.hitRate < 0.7) {
      // 内存命中率过低，调整策略
      this.logger.debug('Adjusting memory cache strategy', {
        hitRate: memoryStats.hitRate,
        component: 'IntelligentCacheManager'
      });
    }

    if (redisStats && redisStats.hitRate < 0.5) {
      // Redis命中率过低
      this.logger.debug('Adjusting Redis cache strategy', {
        hitRate: redisStats.hitRate,
        component: 'IntelligentCacheManager'
      });
    }
  }

  /**
   * 分析热数据
   */
  private analyzeHotData(): void {
    const now = Date.now();
    const hotDataThreshold = 10;
    let promotedCount = 0;

    for (const [key, hotData] of this.hotDataRegistry.entries()) {
      if (hotData.accessCount >= hotDataThreshold && 
          now - hotData.promoteTimestamp > 60000) { // 1分钟内不重复提升
        
        // 提升热数据到内存缓存
        if (!this.memoryCache.has(key) && this.redisClient) {
          this.promoteHotDataToMemory(key);
          hotData.promoteTimestamp = now;
          promotedCount++;
        }
      }
    }

    if (promotedCount > 0) {
      this.logger.debug('Hot data promoted to memory', {
        promotedCount,
        component: 'IntelligentCacheManager'
      });
    }
  }

  /**
   * 提升热数据到内存
   */
  private async promoteHotDataToMemory(key: string): Promise<void> {
    if (!this.redisClient) return;

    try {
      const data = await this.redisClient.get(key);
      if (data) {
        const deserializedData = this.deserialize(data, 'json');
        const dataSize = data.length;
        
        this.setInMemory(key, deserializedData, {
          ttl: 10 * 60 * 1000,
          priority: 'high'
        }, dataSize);
      }
    } catch (error) {
      this.logger.error('Failed to promote hot data to memory', error as Error, { key });
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): Map<string, CacheStats> {
    // 更新内存使用统计
    const memoryStats = this.cacheStats.get('memory');
    if (memoryStats) {
      memoryStats.memoryUsage = this.currentMemoryUsage;
    }

    return new Map(this.cacheStats);
  }

  /**
   * 关闭缓存管理器
   */
  async shutdown(): Promise<void> {
    this.memoryCache.clear();
    this.hotDataRegistry.clear();
    this.accessPatterns.clear();
    this.cacheStats.clear();

    if (this.redisClient) {
      await this.redisClient.quit();
    }

    this.logger.info('Intelligent cache manager shut down', {
      component: 'IntelligentCacheManager'
    });
  }
}