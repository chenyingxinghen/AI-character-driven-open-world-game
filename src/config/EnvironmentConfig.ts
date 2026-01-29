/**
 * 环境配置管理系统
 * 标准化配置文件结构，添加配置验证和环境变量管理
 */

import { Logger, LogLevel } from '../services/Logger';
import { ValidationUtil } from '../utils/CommonUtils';

/**
 * 环境类型
 */
export type Environment = 'development' | 'testing' | 'staging' | 'production';

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly poolSize: number;
  readonly connectionTimeout: number;
  readonly queryTimeout: number;
}

/**
 * Redis配置
 */
export interface RedisConfig {
  readonly host: string;
  readonly port: number;
  readonly password?: string;
  readonly database: number;
  readonly keyPrefix: string;
  readonly ttl: number;
}

/**
 * LLM配置
 */
export interface LLMConfig {
  readonly defaultProvider: string;
  readonly providers: Record<string, {
    readonly apiKey: string;
    readonly baseUrl?: string;
    readonly maxTokens: number;
    readonly temperature: number;
    readonly timeout: number;
    readonly rateLimit: {
      readonly requestsPerMinute: number;
      readonly tokensPerMinute: number;
    };
  }>;
  readonly fallbackStrategy: 'round-robin' | 'priority' | 'load-balance';
  readonly retryPolicy: {
    readonly maxRetries: number;
    readonly backoffMultiplier: number;
    readonly initialDelay: number;
  };
}

/**
 * 服务器配置
 */
export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly cors: {
    readonly enabled: boolean;
    readonly origins: readonly string[];
    readonly credentials: boolean;
  };
  readonly rateLimit: {
    readonly enabled: boolean;
    readonly windowMs: number;
    readonly maxRequests: number;
  };
  readonly security: {
    readonly helmet: boolean;
    readonly https: boolean;
    readonly compression: boolean;
  };
}

/**
 * 日志配置
 */
export interface LoggingConfig {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly format: 'json' | 'text';
  readonly outputs: {
    readonly console: boolean;
    readonly file: {
      readonly enabled: boolean;
      readonly path: string;
      readonly maxSize: number;
      readonly maxFiles: number;
    };
    readonly remote: {
      readonly enabled: boolean;
      readonly url?: string;
      readonly apiKey?: string;
    };
  };
}

/**
 * 监控配置
 */
export interface MonitoringConfig {
  readonly enabled: boolean;
  readonly metrics: {
    readonly prometheus: {
      readonly enabled: boolean;
      readonly port: number;
      readonly path: string;
    };
    readonly healthCheck: {
      readonly enabled: boolean;
      readonly interval: number;
      readonly timeout: number;
    };
  };
  readonly alerts: {
    readonly enabled: boolean;
    readonly thresholds: {
      readonly errorRate: number;
      readonly responseTime: number;
      readonly memoryUsage: number;
      readonly cpuUsage: number;
    };
  };
}

/**
 * 完整的应用配置
 */
export interface AppConfig {
  readonly environment: Environment;
  readonly version: string;
  readonly database: DatabaseConfig;
  readonly redis: RedisConfig;
  readonly llm: LLMConfig;
  readonly server: ServerConfig;
  readonly logging: LoggingConfig;
  readonly monitoring: MonitoringConfig;
  readonly game: {
    readonly sessionTimeout: number;
    readonly maxSessions: number;
    readonly contentGeneration: {
      readonly cacheEnabled: boolean;
      readonly cacheTtl: number;
    };
  };
}

/**
 * 配置验证规则
 */
interface ValidationRule {
  field: string;
  validator: (value: any) => { isValid: boolean; error?: string };
}

/**
 * 环境配置管理器
 */
export class EnvironmentConfigManager {
  private config: AppConfig | null = null;
  private logger: Logger;
  private validationRules: ValidationRule[] = [];

  constructor() {
    this.logger = new Logger(LogLevel.INFO);
    this.initializeValidationRules();
  }

  /**
   * 加载配置
   */
  async loadConfig(): Promise<AppConfig> {
    try {
      this.logger.info('Loading application configuration...');

      const environment = this.getEnvironment();
      const config = await this.buildConfig(environment);

      // 验证配置
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      this.config = config;
      this.logger.info(`Configuration loaded for environment: ${environment}`);

      return config;
    } catch (error) {
      this.logger.error('Failed to load configuration:', error as Error);
      throw error;
    }
  }

  /**
   * 获取配置
   */
  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(): Promise<AppConfig> {
    this.config = null;
    return this.loadConfig();
  }

  /**
   * 获取环境变量值
   */
  private getEnvVar(key: string, defaultValue?: string): string {
    const value = process.env[key] || defaultValue;
    if (value === undefined) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }

  /**
   * 获取环境变量数值
   */
  private getEnvNumber(key: string, defaultValue?: number): number {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue === undefined) {
        throw new Error(`Required environment variable ${key} is not set`);
      }
      return defaultValue;
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`Environment variable ${key} must be a number`);
    }
    return num;
  }

  /**
   * 获取环境变量布尔值
   */
  private getEnvBoolean(key: string, defaultValue?: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue === undefined) {
        throw new Error(`Required environment variable ${key} is not set`);
      }
      return defaultValue;
    }
    return value.toLowerCase() === 'true';
  }

  /**
   * 获取当前环境
   */
  private getEnvironment(): Environment {
    const env = process.env.NODE_ENV || 'development';
    if (!['development', 'testing', 'staging', 'production'].includes(env)) {
      throw new Error(`Invalid environment: ${env}`);
    }
    return env as Environment;
  }

  /**
   * 构建配置对象
   */
  private async buildConfig(environment: Environment): Promise<AppConfig> {
    return {
      environment,
      version: this.getEnvVar('APP_VERSION', '1.0.0'),

      database: {
        host: this.getEnvVar('DB_HOST', 'localhost'),
        port: this.getEnvNumber('DB_PORT', 5432),
        database: this.getEnvVar('DB_NAME', 'gamedb'),
        username: this.getEnvVar('DB_USER', 'postgres'),
        password: this.getEnvVar('DB_PASSWORD'),
        ssl: this.getEnvBoolean('DB_SSL', false),
        poolSize: this.getEnvNumber('DB_POOL_SIZE', 10),
        connectionTimeout: this.getEnvNumber('DB_CONNECTION_TIMEOUT', 5000),
        queryTimeout: this.getEnvNumber('DB_QUERY_TIMEOUT', 10000)
      },

      redis: {
        host: this.getEnvVar('REDIS_HOST', 'localhost'),
        port: this.getEnvNumber('REDIS_PORT', 6379),
        password: process.env.REDIS_PASSWORD,
        database: this.getEnvNumber('REDIS_DB', 0),
        keyPrefix: this.getEnvVar('REDIS_PREFIX', 'game:'),
        ttl: this.getEnvNumber('REDIS_TTL', 3600)
      },

      llm: {
        defaultProvider: this.getEnvVar('LLM_DEFAULT_PROVIDER', 'openai'),
        providers: this.buildLLMProviders(),
        fallbackStrategy: this.getEnvVar('LLM_FALLBACK_STRATEGY', 'round-robin') as any,
        retryPolicy: {
          maxRetries: this.getEnvNumber('LLM_MAX_RETRIES', 3),
          backoffMultiplier: this.getEnvNumber('LLM_BACKOFF_MULTIPLIER', 2),
          initialDelay: this.getEnvNumber('LLM_INITIAL_DELAY', 1000)
        }
      },

      server: {
        host: this.getEnvVar('SERVER_HOST', '0.0.0.0'),
        port: this.getEnvNumber('SERVER_PORT', 3000),
        cors: {
          enabled: this.getEnvBoolean('CORS_ENABLED', true),
          origins: this.getEnvVar('CORS_ORIGINS', '*').split(','),
          credentials: this.getEnvBoolean('CORS_CREDENTIALS', false)
        },
        rateLimit: {
          enabled: this.getEnvBoolean('RATE_LIMIT_ENABLED', true),
          windowMs: this.getEnvNumber('RATE_LIMIT_WINDOW', 60000),
          maxRequests: this.getEnvNumber('RATE_LIMIT_MAX', 100)
        },
        security: {
          helmet: this.getEnvBoolean('SECURITY_HELMET', true),
          https: this.getEnvBoolean('SECURITY_HTTPS', environment === 'production'),
          compression: this.getEnvBoolean('SECURITY_COMPRESSION', true)
        }
      },

      logging: {
        level: this.getEnvVar('LOG_LEVEL', environment === 'production' ? 'info' : 'debug') as any,
        format: this.getEnvVar('LOG_FORMAT', 'json') as any,
        outputs: {
          console: this.getEnvBoolean('LOG_CONSOLE', true),
          file: {
            enabled: this.getEnvBoolean('LOG_FILE_ENABLED', environment === 'production'),
            path: this.getEnvVar('LOG_FILE_PATH', './logs'),
            maxSize: this.getEnvNumber('LOG_FILE_MAX_SIZE', 10485760), // 10MB
            maxFiles: this.getEnvNumber('LOG_FILE_MAX_FILES', 5)
          },
          remote: {
            enabled: this.getEnvBoolean('LOG_REMOTE_ENABLED', false),
            url: process.env.LOG_REMOTE_URL,
            apiKey: process.env.LOG_REMOTE_API_KEY
          }
        }
      },

      monitoring: {
        enabled: this.getEnvBoolean('MONITORING_ENABLED', environment === 'production'),
        metrics: {
          prometheus: {
            enabled: this.getEnvBoolean('PROMETHEUS_ENABLED', false),
            port: this.getEnvNumber('PROMETHEUS_PORT', 9090),
            path: this.getEnvVar('PROMETHEUS_PATH', '/metrics')
          },
          healthCheck: {
            enabled: this.getEnvBoolean('HEALTH_CHECK_ENABLED', true),
            interval: this.getEnvNumber('HEALTH_CHECK_INTERVAL', 30000),
            timeout: this.getEnvNumber('HEALTH_CHECK_TIMEOUT', 5000)
          }
        },
        alerts: {
          enabled: this.getEnvBoolean('ALERTS_ENABLED', environment === 'production'),
          thresholds: {
            errorRate: this.getEnvNumber('ALERT_ERROR_RATE', 5) / 100,
            responseTime: this.getEnvNumber('ALERT_RESPONSE_TIME', 2000),
            memoryUsage: this.getEnvNumber('ALERT_MEMORY_USAGE', 80) / 100,
            cpuUsage: this.getEnvNumber('ALERT_CPU_USAGE', 80) / 100
          }
        }
      },

      game: {
        sessionTimeout: this.getEnvNumber('GAME_SESSION_TIMEOUT', 1800000), // 30分钟
        maxSessions: this.getEnvNumber('GAME_MAX_SESSIONS', 1000),
        contentGeneration: {
          cacheEnabled: this.getEnvBoolean('CONTENT_CACHE_ENABLED', true),
          cacheTtl: this.getEnvNumber('CONTENT_CACHE_TTL', 3600000) // 1小时
        }
      }
    };
  }

  /**
   * 构建LLM提供商配置
   */
  private buildLLMProviders(): LLMConfig['providers'] {
    const providers: Record<string, any> = {};

    if (process.env.OPENAI_API_KEY) {
      providers.openai = {
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        maxTokens: this.getEnvNumber('OPENAI_MAX_TOKENS', 4000),
        temperature: this.getEnvNumber('OPENAI_TEMPERATURE', 0.7),
        timeout: this.getEnvNumber('OPENAI_TIMEOUT', 30000),
        rateLimit: {
          requestsPerMinute: this.getEnvNumber('OPENAI_RPM', 60),
          tokensPerMinute: this.getEnvNumber('OPENAI_TPM', 100000)
        }
      };
    }

    if (process.env.ZHIPU_API_KEY) {
      providers.zhipu = {
        apiKey: process.env.ZHIPU_API_KEY,
        maxTokens: this.getEnvNumber('ZHIPU_MAX_TOKENS', 4000),
        temperature: this.getEnvNumber('ZHIPU_TEMPERATURE', 0.7),
        timeout: this.getEnvNumber('ZHIPU_TIMEOUT', 30000),
        rateLimit: {
          requestsPerMinute: this.getEnvNumber('ZHIPU_RPM', 60),
          tokensPerMinute: this.getEnvNumber('ZHIPU_TPM', 100000)
        }
      };
    }

    if (process.env.ANTHROPIC_API_KEY) {
      providers.anthropic = {
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxTokens: this.getEnvNumber('ANTHROPIC_MAX_TOKENS', 4000),
        temperature: this.getEnvNumber('ANTHROPIC_TEMPERATURE', 0.7),
        timeout: this.getEnvNumber('ANTHROPIC_TIMEOUT', 30000),
        rateLimit: {
          requestsPerMinute: this.getEnvNumber('ANTHROPIC_RPM', 60),
          tokensPerMinute: this.getEnvNumber('ANTHROPIC_TPM', 100000)
        }
      };
    }

    // Ollama (Local LLM) Configuration
    if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_DEFAULT_MODEL) {
      providers.local = {
        apiKey: 'local', // Placeholder for local provider
        baseUrl: this.getEnvVar('OLLAMA_BASE_URL', 'http://localhost:11434'),
        maxTokens: this.getEnvNumber('OLLAMA_MAX_TOKENS', 4000),
        temperature: this.getEnvNumber('OLLAMA_TEMPERATURE', 0.7),
        timeout: this.getEnvNumber('OLLAMA_TIMEOUT', 30000),
        rateLimit: {
          requestsPerMinute: this.getEnvNumber('OLLAMA_RPM', 1000), // High limit for local
          tokensPerMinute: this.getEnvNumber('OLLAMA_TPM', 1000000)
        }
      };
    }

    return providers;
  }

  /**
   * 初始化验证规则
   */
  private initializeValidationRules(): void {
    this.validationRules = [
      {
        field: 'database.host',
        validator: (value) => ValidationUtil.validateStringLength(value, 1, 255)
      },
      {
        field: 'database.port',
        validator: (value) => ValidationUtil.validateNumberRange(value, 1, 65535)
      },
      {
        field: 'server.port',
        validator: (value) => ValidationUtil.validateNumberRange(value, 1, 65535)
      },
      {
        field: 'redis.port',
        validator: (value) => ValidationUtil.validateNumberRange(value, 1, 65535)
      },
      {
        field: 'game.sessionTimeout',
        validator: (value) => ValidationUtil.validateNumberRange(value, 60000, 7200000) // 1分钟到2小时
      }
    ];
  }

  /**
   * 验证配置
   */
  private validateConfig(config: AppConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of this.validationRules) {
      const value = this.getNestedProperty(config, rule.field);
      const result = rule.validator(value);

      if (!result.isValid) {
        errors.push(`${rule.field}: ${result.error}`);
      }
    }

    // 额外的业务逻辑验证
    if (Object.keys(config.llm.providers).length === 0) {
      errors.push('At least one LLM provider must be configured');
    }

    if (config.environment === 'production') {
      if (!config.server.security.https) {
        errors.push('HTTPS must be enabled in production');
      }
      if (config.logging.level === 'debug') {
        errors.push('Debug logging should not be used in production');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取嵌套属性值
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 导出配置为环境变量格式
   */
  exportAsEnvVars(): string[] {
    const config = this.getConfig();
    const envVars: string[] = [];

    // 数据库配置
    envVars.push(`DB_HOST=${config.database.host}`);
    envVars.push(`DB_PORT=${config.database.port}`);
    envVars.push(`DB_NAME=${config.database.database}`);
    envVars.push(`DB_USER=${config.database.username}`);
    envVars.push(`DB_SSL=${config.database.ssl}`);

    // 服务器配置
    envVars.push(`SERVER_HOST=${config.server.host}`);
    envVars.push(`SERVER_PORT=${config.server.port}`);
    envVars.push(`CORS_ENABLED=${config.server.cors.enabled}`);

    // 日志配置
    envVars.push(`LOG_LEVEL=${config.logging.level}`);
    envVars.push(`LOG_FORMAT=${config.logging.format}`);

    return envVars;
  }

  /**
   * 获取配置摘要（不包含敏感信息）
   */
  getConfigSummary(): Record<string, any> {
    const config = this.getConfig();

    return {
      environment: config.environment,
      version: config.version,
      database: {
        host: config.database.host,
        port: config.database.port,
        database: config.database.database,
        ssl: config.database.ssl
      },
      server: {
        host: config.server.host,
        port: config.server.port,
        cors: config.server.cors.enabled,
        rateLimit: config.server.rateLimit.enabled
      },
      llm: {
        defaultProvider: config.llm.defaultProvider,
        providersCount: Object.keys(config.llm.providers).length,
        fallbackStrategy: config.llm.fallbackStrategy
      },
      monitoring: {
        enabled: config.monitoring.enabled,
        metrics: config.monitoring.metrics.prometheus.enabled,
        alerts: config.monitoring.alerts.enabled
      }
    };
  }
}

// 单例实例
let configInstance: EnvironmentConfigManager | null = null;

/**
 * 获取配置管理器实例
 */
export function getConfigManager(): EnvironmentConfigManager {
  if (!configInstance) {
    configInstance = new EnvironmentConfigManager();
  }
  return configInstance;
}

/**
 * 初始化并加载配置
 */
export async function initializeConfig(): Promise<AppConfig> {
  const manager = getConfigManager();
  return await manager.loadConfig();
}

/**
 * 获取当前配置
 */
export function getCurrentConfig(): AppConfig {
  const manager = getConfigManager();
  return manager.getConfig();
}