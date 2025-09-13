/**
 * 公共工具类 - 消除代码重复
 * 提供通用的错误处理、模式识别、和业务逻辑辅助方法
 */

import { Logger } from '../services/Logger';
import { OperationResult } from '../types';

/**
 * 错误处理工具类
 */
export class ErrorHandlerUtil {
  /**
   * 安全执行异步操作，统一错误处理
   */
  static async safeExecute<T>(
    operation: () => Promise<T>,
    logger: Logger,
    context: string = 'Unknown operation'
  ): Promise<OperationResult<T>> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const executionTime = Date.now() - startTime;
      
      logger.info(`${context} completed successfully in ${executionTime}ms`);
      
      return {
        success: true,
        data: result,
        timestamp: new Date()
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(`${context} failed after ${executionTime}ms:`, error as Error);
      
      return {
        success: false,
        error: errorMessage,
        timestamp: new Date()
      };
    }
  }

  /**
   * 带重试的安全执行
   */
  static async safeExecuteWithRetry<T>(
    operation: () => Promise<T>,
    logger: Logger,
    context: string = 'Unknown operation',
    maxRetries: number = 3,
    retryDelayMs: number = 1000
  ): Promise<OperationResult<T>> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        logger.warn(`${context} retry attempt ${attempt}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
      }
      
      const result = await this.safeExecute(operation, logger, `${context} (attempt ${attempt + 1})`);
      
      if (result.success) {
        if (attempt > 0) {
          logger.info(`${context} succeeded after ${attempt} retries`);
        }
        return result;
      }
      
      lastError = new Error(result.error || 'Unknown error');
    }
    
    logger.error(`${context} failed after ${maxRetries} retries`);
    return {
      success: false,
      error: lastError?.message || 'Max retries exceeded',
      timestamp: new Date()
    };
  }

  /**
   * 统一的服务初始化错误处理
   */
  static async initializeService<T>(
    serviceName: string,
    initializer: () => Promise<T>,
    logger: Logger
  ): Promise<T> {
    logger.info(`Initializing ${serviceName}...`);
    
    try {
      const service = await initializer();
      logger.info(`${serviceName} initialized successfully`);
      return service;
    } catch (error) {
      logger.error(`Failed to initialize ${serviceName}:`, error as Error);
      throw new Error(`${serviceName} initialization failed: ${(error as Error).message}`);
    }
  }
}

/**
 * 文本模式识别工具类
 */
export class PatternRecognitionUtil {
  // 通用的文本模式常量
  static readonly MOVEMENT_PATTERNS = [
    /(move|go|walk|run|travel|前往|去|走|跑|移动)/i,
    /(enter|exit|进入|离开|出去)/i,
    /(north|south|east|west|up|down|北|南|东|西|上|下)/i
  ];

  static readonly DIALOGUE_PATTERNS = [
    /(say|tell|ask|speak|talk|说|告诉|询问|说话|对话)/i,
    /(hello|hi|greetings|你好|嗨|问候)/i,
    /(question|answer|问题|回答)/i
  ];

  static readonly OBSERVATION_PATTERNS = [
    /(look|observe|check|examine|inspect|看|观察|检查|审视)/i,
    /(search|find|寻找|找)/i,
    /(watch|监视|观看)/i
  ];

  static readonly INTERACTION_PATTERNS = [
    /(take|grab|pick up|get|拿|取|捡|获取)/i,
    /(open|close|unlock|lock|打开|关闭|解锁|上锁)/i,
    /(use|operate|使用|操作)/i
  ];

  /**
   * 统一的模式匹配方法
   */
  static matchPatterns(text: string, patterns: RegExp[]): {
    hasMatch: boolean;
    matchedPattern?: RegExp;
    extractedText?: string;
  } {
    const lowerText = text.toLowerCase();
    
    for (const pattern of patterns) {
      const match = pattern.exec(lowerText);
      if (match) {
        return {
          hasMatch: true,
          matchedPattern: pattern,
          extractedText: match[0]
        };
      }
    }
    
    return { hasMatch: false };
  }

  /**
   * 获取文本意图分类
   */
  static classifyTextIntent(text: string): {
    intent: 'movement' | 'dialogue' | 'observation' | 'interaction' | 'unknown';
    confidence: number;
    extractedAction?: string;
  } {
    const movementMatch = this.matchPatterns(text, this.MOVEMENT_PATTERNS);
    if (movementMatch.hasMatch) {
      return {
        intent: 'movement',
        confidence: 85,
        extractedAction: movementMatch.extractedText
      };
    }

    const dialogueMatch = this.matchPatterns(text, this.DIALOGUE_PATTERNS);
    if (dialogueMatch.hasMatch) {
      return {
        intent: 'dialogue',
        confidence: 80,
        extractedAction: dialogueMatch.extractedText
      };
    }

    const observationMatch = this.matchPatterns(text, this.OBSERVATION_PATTERNS);
    if (observationMatch.hasMatch) {
      return {
        intent: 'observation',
        confidence: 75,
        extractedAction: observationMatch.extractedText
      };
    }

    const interactionMatch = this.matchPatterns(text, this.INTERACTION_PATTERNS);
    if (interactionMatch.hasMatch) {
      return {
        intent: 'interaction',
        confidence: 70,
        extractedAction: interactionMatch.extractedText
      };
    }

    return {
      intent: 'unknown',
      confidence: 0
    };
  }

  /**
   * 提取目标实体
   */
  static extractTarget(text: string): string | undefined {
    // 简化的目标提取逻辑
    const targetPatterns = [
      /(?:to|towards|at|with|和|对|向|朝)\s+([^\s,.!?]+)/i,
      /(?:the|这个|那个)\s+([^\s,.!?]+)/i
    ];

    for (const pattern of targetPatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * 提取位置信息
   */
  static extractLocation(text: string): string | undefined {
    const locationPatterns = [
      /(?:in|at|to|在|到|向)\s+([^\s,.!?]+(?:\s+[^\s,.!?]+)*)/i,
      /(?:library|market|square|图书馆|市场|广场|房间|房子)/i
    ];

    for (const pattern of locationPatterns) {
      const match = pattern.exec(text);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }
}

/**
 * 数据验证工具类
 */
export class ValidationUtil {
  /**
   * 验证必需字段
   */
  static validateRequired(data: any, fields: string[]): {
    isValid: boolean;
    missingFields: string[];
  } {
    const missingFields: string[] = [];
    
    for (const field of fields) {
      if (!data || data[field] === undefined || data[field] === null || data[field] === '') {
        missingFields.push(field);
      }
    }
    
    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * 验证字符串长度
   */
  static validateStringLength(
    value: string,
    minLength: number = 0,
    maxLength: number = Number.MAX_SAFE_INTEGER
  ): { isValid: boolean; error?: string } {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Value must be a string' };
    }
    
    if (value.length < minLength) {
      return { isValid: false, error: `Value must be at least ${minLength} characters` };
    }
    
    if (value.length > maxLength) {
      return { isValid: false, error: `Value must not exceed ${maxLength} characters` };
    }
    
    return { isValid: true };
  }

  /**
   * 验证数值范围
   */
  static validateNumberRange(
    value: number,
    min: number = Number.MIN_SAFE_INTEGER,
    max: number = Number.MAX_SAFE_INTEGER
  ): { isValid: boolean; error?: string } {
    if (typeof value !== 'number' || isNaN(value)) {
      return { isValid: false, error: 'Value must be a valid number' };
    }
    
    if (value < min) {
      return { isValid: false, error: `Value must be at least ${min}` };
    }
    
    if (value > max) {
      return { isValid: false, error: `Value must not exceed ${max}` };
    }
    
    return { isValid: true };
  }
}

/**
 * 缓存工具类
 */
export class CacheUtil {
  private static caches = new Map<string, Map<string, { data: any; timestamp: number; ttl: number }>>();

  /**
   * 获取缓存实例
   */
  static getCache(namespace: string): Map<string, { data: any; timestamp: number; ttl: number }> {
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new Map());
    }
    return this.caches.get(namespace)!;
  }

  /**
   * 设置缓存
   */
  static set(namespace: string, key: string, data: any, ttlMs: number = 300000): void {
    const cache = this.getCache(namespace);
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  /**
   * 获取缓存
   */
  static get<T>(namespace: string, key: string): T | null {
    const cache = this.getCache(namespace);
    const item = cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }

  /**
   * 清理过期缓存
   */
  static cleanup(namespace: string): void {
    const cache = this.getCache(namespace);
    const now = Date.now();
    
    for (const [key, item] of cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        cache.delete(key);
      }
    }
  }

  /**
   * 清空缓存命名空间
   */
  static clear(namespace: string): void {
    const cache = this.getCache(namespace);
    cache.clear();
  }
}

/**
 * 格式化工具类
 */
export class FormatUtil {
  /**
   * 格式化时间差
   */
  static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(2)}s`;
    } else if (milliseconds < 3600000) {
      return `${(milliseconds / 60000).toFixed(2)}m`;
    } else {
      return `${(milliseconds / 3600000).toFixed(2)}h`;
    }
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 截断长文本
   */
  static truncateText(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }
}

/**
 * 随机工具类
 */
export class RandomUtil {
  /**
   * 生成随机ID
   */
  static generateId(prefix: string = '', length: number = 9): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix ? `${prefix}_${result}` : result;
  }

  /**
   * 从数组中随机选择元素
   */
  static randomChoice<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * 从数组中随机选择多个元素
   */
  static randomChoices<T>(array: T[], count: number): T[] {
    if (count >= array.length) return [...array];
    
    const result: T[] = [];
    const remaining = [...array];
    
    for (let i = 0; i < count; i++) {
      const index = Math.floor(Math.random() * remaining.length);
      result.push(remaining.splice(index, 1)[0]);
    }
    
    return result;
  }

  /**
   * 生成随机数范围
   */
  static randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  /**
   * 生成随机整数范围
   */
  static randomIntInRange(min: number, max: number): number {
    return Math.floor(this.randomInRange(min, max + 1));
  }
}