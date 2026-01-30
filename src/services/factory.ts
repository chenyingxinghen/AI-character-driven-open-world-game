import { LLMService, MockLLMService, LLMProvider } from './llm/LLMService';
import { RealLLMService } from './llm/RealLLMService';
import { CharacterService } from './character/CharacterService';
import { UnifiedInputClassificationService } from './input/UnifiedInputClassificationService';
import { container, ServiceIdentifier } from './DependencyInjectionContainer';
import { RealDatabaseService } from './database/RealDatabaseService';
import { MockDatabaseService, DatabaseService } from './database/DatabaseService';
import { Logger, LogLevel } from './Logger';
import { GameContextService } from './game/GameContextService';
import { WorldLoreService } from './world/WorldLoreService';
import { StoryOutlineGeneratorService } from './gameMode/StoryOutlineGeneratorService';
import { EnhancedInitialSceneService } from './gameMode/EnhancedInitialSceneService';

// Import domain managers
import { CharacterManager } from '../domains/character/aggregates';
import { WorldManager } from '../domains/world/aggregates';
import { InputManager } from '../domains/input/aggregates';
import { OperationsManager } from '../domains/operations/aggregates';
import { DomainCoordinator } from '../domains/DomainCoordinator';

// Service identifiers
export const SERVICE_IDENTIFIERS = {
  LLM_SERVICE: 'LLM_SERVICE',
  CHARACTER_SERVICE: 'CHARACTER_SERVICE',
  UNIFIED_INPUT_CLASSIFICATION_SERVICE: 'UNIFIED_INPUT_CLASSIFICATION_SERVICE',
  DATABASE_SERVICE: 'DATABASE_SERVICE',
  LOGGER: 'LOGGER',
  GAME_CONTEXT_SERVICE: 'GAME_CONTEXT_SERVICE',
  WORLD_LORE_SERVICE: 'WORLD_LORE_SERVICE',
  STORY_OUTLINE_GENERATOR_SERVICE: 'STORY_OUTLINE_GENERATOR_SERVICE',
  ENHANCED_INITIAL_SCENE_SERVICE: 'ENHANCED_INITIAL_SCENE_SERVICE',

  // Domain service identifiers
  CHARACTER_MANAGER: 'CHARACTER_MANAGER',
  WORLD_MANAGER: 'WORLD_MANAGER',
  INPUT_MANAGER: 'INPUT_MANAGER',
  OPERATIONS_MANAGER: 'OPERATIONS_MANAGER',
  DOMAIN_COORDINATOR: 'DOMAIN_COORDINATOR'
};

export interface ServiceFactory {
  createLLMService(): LLMService;
  createCharacterService(): CharacterService;
  createUnifiedInputClassificationService(): UnifiedInputClassificationService;
  createDatabaseService(): DatabaseService;
  createLogger(): Logger;
  createGameContextService(): GameContextService;
  createWorldLoreService(): WorldLoreService;
  createStoryOutlineGeneratorService(): StoryOutlineGeneratorService;
  createEnhancedInitialSceneService(): EnhancedInitialSceneService;

  // Domain manager creation methods
  createCharacterManager(): CharacterManager;
  createWorldManager(): WorldManager;
  createInputManager(): InputManager;
  createOperationsManager(): OperationsManager;
  createDomainCoordinator(): DomainCoordinator;
}

export class DefaultServiceFactory implements ServiceFactory {
  private logger?: Logger;
  private llmService?: LLMService;
  private databaseService?: DatabaseService;
  private gameContextService?: GameContextService;
  private unifiedInputClassificationService?: UnifiedInputClassificationService;
  private worldLoreService?: WorldLoreService;
  private storyOutlineGeneratorService?: StoryOutlineGeneratorService;
  private enhancedInitialSceneService?: EnhancedInitialSceneService;

  // Domain managers (lazy initialization)
  private characterManager?: CharacterManager;
  private worldManager?: WorldManager;
  private inputManager?: InputManager;
  private operationsManager?: OperationsManager;
  private domainCoordinator?: DomainCoordinator;

  createLogger(): Logger {
    if (!this.logger) {
      // 根据环境变量设置日志级别
      const logLevelStr = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
      let logLevel = LogLevel.INFO;

      switch (logLevelStr) {
        case 'DEBUG':
          logLevel = LogLevel.DEBUG;
          break;
        case 'WARN':
          logLevel = LogLevel.WARN;
          break;
        case 'ERROR':
          logLevel = LogLevel.ERROR;
          break;
        default:
          logLevel = LogLevel.INFO;
      }

      const enableDebug = process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug';
      this.logger = new Logger(logLevel, enableDebug);
    }
    return this.logger;
  }
  createLLMService(): LLMService {
    if (!this.llmService) {
      // Check if we have API keys in environment variables
      const openaiApiKey = process.env.OPENAI_API_KEY;
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      const geminiApiKey = process.env.GEMINI_API_KEY;
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      const zhipuApiKey = process.env.ZHIPU_API_KEY;
      const ollamaConfigured = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_DEFAULT_MODEL;

      // If we have real API keys or Ollama configured, use RealLLMService
      if (openaiApiKey || anthropicApiKey || geminiApiKey || openRouterApiKey || zhipuApiKey || ollamaConfigured) {
        const config = {
          providers: {
            ...(openaiApiKey ? {
              [LLMProvider.OPENAI]: {
                apiKey: openaiApiKey,
                defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-3.5-turbo',
                rateLimit: {
                  requestsPerMinute: parseInt(process.env.OPENAI_RATE_LIMIT_RPM || '60'),
                  tokensPerMinute: parseInt(process.env.OPENAI_RATE_LIMIT_TPM || '150000')
                },
                pricing: {
                  inputTokenPrice: parseFloat(process.env.OPENAI_PRICING_INPUT || '0.0015'),
                  outputTokenPrice: parseFloat(process.env.OPENAI_PRICING_OUTPUT || '0.002')
                }
              }
            } : {}),
            ...(anthropicApiKey ? {
              [LLMProvider.ANTHROPIC]: {
                apiKey: anthropicApiKey,
                defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-haiku-20240307',
                rateLimit: {
                  requestsPerMinute: parseInt(process.env.ANTHROPIC_RATE_LIMIT_RPM || '60'),
                  tokensPerMinute: parseInt(process.env.ANTHROPIC_RATE_LIMIT_TPM || '150000')
                },
                pricing: {
                  inputTokenPrice: parseFloat(process.env.ANTHROPIC_PRICING_INPUT || '0.008'),
                  outputTokenPrice: parseFloat(process.env.ANTHROPIC_PRICING_OUTPUT || '0.024')
                }
              }
            } : {}),
            ...(geminiApiKey ? {
              [LLMProvider.GEMINI]: {
                apiKey: geminiApiKey,
                defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-pro',
                rateLimit: {
                  requestsPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT_RPM || '60'),
                  tokensPerMinute: parseInt(process.env.GEMINI_RATE_LIMIT_TPM || '150000')
                },
                pricing: {
                  inputTokenPrice: parseFloat(process.env.GEMINI_PRICING_INPUT || '0.0005'),
                  outputTokenPrice: parseFloat(process.env.GEMINI_PRICING_OUTPUT || '0.0015')
                }
              }
            } : {}),
            ...(openRouterApiKey ? {
              [LLMProvider.OPENROUTER]: {
                apiKey: openRouterApiKey,
                defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'mistralai/mistral-7b-instruct',
                rateLimit: {
                  requestsPerMinute: parseInt(process.env.OPENROUTER_RATE_LIMIT_RPM || '60'),
                  tokensPerMinute: parseInt(process.env.OPENROUTER_RATE_LIMIT_TPM || '150000')
                },
                pricing: {
                  inputTokenPrice: parseFloat(process.env.OPENROUTER_PRICING_INPUT || '0.0002'),
                  outputTokenPrice: parseFloat(process.env.OPENROUTER_PRICING_OUTPUT || '0.0002')
                }
              }
            } : {}),
            ...(zhipuApiKey ? {
              [LLMProvider.ZHIPU]: {
                apiKey: zhipuApiKey,
                defaultModel: process.env.ZHIPU_DEFAULT_MODEL || 'glm-4',
                rateLimit: {
                  requestsPerMinute: parseInt(process.env.ZHIPU_RATE_LIMIT_RPM || '60'),
                  tokensPerMinute: parseInt(process.env.ZHIPU_RATE_LIMIT_TPM || '150000')
                },
                pricing: {
                  inputTokenPrice: parseFloat(process.env.ZHIPU_PRICING_INPUT || '0.0001'),
                  outputTokenPrice: parseFloat(process.env.ZHIPU_PRICING_OUTPUT || '0.0001')
                }
              }
            } : {}),
            ...((process.env.OLLAMA_BASE_URL || process.env.OLLAMA_DEFAULT_MODEL) ? {
              [LLMProvider.LOCAL]: {
                apiKey: 'local', // Placeholder for local provider
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
                defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3',
                rateLimit: {
                  requestsPerMinute: parseInt(process.env.OLLAMA_RATE_LIMIT_RPM || '1000'),
                  tokensPerMinute: parseInt(process.env.OLLAMA_RATE_LIMIT_TPM || '1000000')
                },
                pricing: {
                  inputTokenPrice: 0, // Free for local
                  outputTokenPrice: 0
                }
              }
            } : {})
          },
          defaultProvider: this.parseLLMProvider(process.env.DEFAULT_LLM_PROVIDER) ||
            (geminiApiKey ? LLMProvider.GEMINI :
              openaiApiKey ? LLMProvider.OPENAI :
                anthropicApiKey ? LLMProvider.ANTHROPIC :
                  openRouterApiKey ? LLMProvider.OPENROUTER :
                    zhipuApiKey ? LLMProvider.ZHIPU :
                      (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_DEFAULT_MODEL) ? LLMProvider.LOCAL :
                        LLMProvider.GEMINI), // 默认使用Gemini而不是OpenAI
          deputyProvider: this.parseLLMProvider(process.env.DEPUTY_LLM_PROVIDER) || undefined,
          deputyModel: process.env.DEPUTY_LLM_MODEL,
          retryConfig: {
            maxAttempts: parseInt(process.env.LLM_RETRY_MAX_ATTEMPTS || '3'),
            backoffMultiplier: parseFloat(process.env.LLM_RETRY_BACKOFF_MULTIPLIER || '2'),
            maxBackoffMs: parseInt(process.env.LLM_RETRY_MAX_BACKOFF_MS || '10000')
          },
          timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '30000')
        };

        this.llmService = new RealLLMService(config);
      } else {
        // Fall back to MockLLMService if no API keys
        this.llmService = new MockLLMService();
      }
    }

    return this.llmService;
  }

  /**
   * 解析LLM提供者枚举值
   */
  private parseLLMProvider(providerStr?: string): LLMProvider | null {
    if (!providerStr) return null;

    // 转换为小写进行比较
    const lowerProvider = providerStr.toLowerCase();

    switch (lowerProvider) {
      case 'openai': return LLMProvider.OPENAI;
      case 'anthropic': return LLMProvider.ANTHROPIC;
      case 'gemini': return LLMProvider.GEMINI;
      case 'openrouter': return LLMProvider.OPENROUTER;
      case 'local': return LLMProvider.LOCAL;
      case 'mistral': return LLMProvider.MISTRAL;
      case 'llama': return LLMProvider.LLAMA;
      case 'zhipu': return LLMProvider.ZHIPU;
      default: return null;
    }
  }

  createCharacterService(): CharacterService {
    return new CharacterService(
      this.createLLMService(),
      this.createLogger(),
      this.createDatabaseService()
    );
  }

  createUnifiedInputClassificationService(): UnifiedInputClassificationService {
    if (!this.unifiedInputClassificationService) {
      this.unifiedInputClassificationService = new UnifiedInputClassificationService(
        this.createLLMService(),
        this.createGameContextService(),
        this.createLogger()
      );
    }
    return this.unifiedInputClassificationService;
  }

  createDatabaseService(): DatabaseService {
    if (!this.databaseService) {
      // Check if we have database credentials
      const dbHost = process.env.DATABASE_HOST;

      // If we have database credentials, use RealDatabaseService
      if (dbHost) {
        const config: any = {
          postgres: {
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || '5432'),
            database: process.env.DATABASE_NAME || 'ai_narrative_game',
            user: process.env.DATABASE_USER || 'app_user',
            password: process.env.DATABASE_PASSWORD || 'app_password',
            max: parseInt(process.env.DATABASE_POOL_MAX || '20'),
            idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
            connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '5000')
          }
        };

        // Add Redis configuration if available
        if (process.env.REDIS_HOST) {
          config.redis = {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB || '0')
          };
        }

        this.databaseService = new RealDatabaseService(config);
      } else {
        // Fall back to MockDatabaseService if no database credentials
        this.databaseService = new MockDatabaseService();
      }
    }

    return this.databaseService;
  }

  createGameContextService(): GameContextService {
    if (!this.gameContextService) {
      this.gameContextService = new GameContextService(
        this.createDatabaseService(),
        this.createLogger(),
        this.createWorldLoreService()
      );
    }
    return this.gameContextService;
  }

  createWorldLoreService(): WorldLoreService {
    if (!this.worldLoreService) {
      this.worldLoreService = new WorldLoreService(
        this.createLLMService(),
        this.createDatabaseService(),
        this.createLogger()
      );
    }
    return this.worldLoreService;
  }

  createStoryOutlineGeneratorService(): StoryOutlineGeneratorService {
    if (!this.storyOutlineGeneratorService) {
      this.storyOutlineGeneratorService = new StoryOutlineGeneratorService(
        this.createLLMService(),
        this.createWorldLoreService(),
        this.createDatabaseService(),
        this.createLogger()
      );
    }
    return this.storyOutlineGeneratorService;
  }

  createEnhancedInitialSceneService(): EnhancedInitialSceneService {
    if (!this.enhancedInitialSceneService) {
      this.enhancedInitialSceneService = new EnhancedInitialSceneService(
        this.createLLMService(),
        this.createWorldLoreService(),
        this.createDatabaseService(),
        this.createStoryOutlineGeneratorService(),
        this.createLogger()
      );
    }
    return this.enhancedInitialSceneService;
  }

  // Domain manager creation methods
  createCharacterManager(): CharacterManager {
    if (!this.characterManager) {
      this.characterManager = new CharacterManager(
        this.createLLMService(),
        this.createLogger(),
        this.createDatabaseService()
      );
    }
    return this.characterManager;
  }

  createWorldManager(): WorldManager {
    if (!this.worldManager) {
      this.worldManager = new WorldManager(
        this.createLLMService(),
        this.createLogger(),
        this.createDatabaseService()
      );
    }
    return this.worldManager;
  }

  createInputManager(): InputManager {
    if (!this.inputManager) {
      this.inputManager = new InputManager(
        this.createLLMService(),
        this.createLogger(),
        this.createGameContextService()
      );
    }
    return this.inputManager;
  }

  createOperationsManager(): OperationsManager {
    if (!this.operationsManager) {
      this.operationsManager = new OperationsManager(
        this.createLogger()
      );
    }
    return this.operationsManager;
  }

  createDomainCoordinator(): DomainCoordinator {
    if (!this.domainCoordinator) {
      this.domainCoordinator = new DomainCoordinator(
        this.createLLMService(),
        this.createLogger(),
        this.createGameContextService(),
        this.createDatabaseService(),
        this.createWorldLoreService(),
        this.createEnhancedInitialSceneService()
      );
    }
    return this.domainCoordinator;
  }

  /**
   * Register all services with the dependency injection container
   */
  registerAllServices(): void {
    // Register basic services
    container.register(SERVICE_IDENTIFIERS.LOGGER, () => this.createLogger());
    container.register(SERVICE_IDENTIFIERS.LLM_SERVICE, () => this.createLLMService());
    container.register(SERVICE_IDENTIFIERS.CHARACTER_SERVICE, () => this.createCharacterService());
    container.register(SERVICE_IDENTIFIERS.UNIFIED_INPUT_CLASSIFICATION_SERVICE, () => this.createUnifiedInputClassificationService());
    container.register(SERVICE_IDENTIFIERS.DATABASE_SERVICE, () => this.createDatabaseService());
    container.register(SERVICE_IDENTIFIERS.GAME_CONTEXT_SERVICE, () => this.createGameContextService());
    container.register(SERVICE_IDENTIFIERS.WORLD_LORE_SERVICE, () => this.createWorldLoreService());
    container.register(SERVICE_IDENTIFIERS.STORY_OUTLINE_GENERATOR_SERVICE, () => this.createStoryOutlineGeneratorService());
    container.register(SERVICE_IDENTIFIERS.ENHANCED_INITIAL_SCENE_SERVICE, () => this.createEnhancedInitialSceneService());

    // Register domain managers
    container.register(SERVICE_IDENTIFIERS.CHARACTER_MANAGER, () => this.createCharacterManager());
    container.register(SERVICE_IDENTIFIERS.WORLD_MANAGER, () => this.createWorldManager());
    container.register(SERVICE_IDENTIFIERS.INPUT_MANAGER, () => this.createInputManager());
    container.register(SERVICE_IDENTIFIERS.OPERATIONS_MANAGER, () => this.createOperationsManager());
    container.register(SERVICE_IDENTIFIERS.DOMAIN_COORDINATOR, () => this.createDomainCoordinator());
  }

  /**
   * Get all domain managers as a collection
   */
  getAllDomainManagers(): {
    characterManager: CharacterManager;
    worldManager: WorldManager;
    inputManager: InputManager;
    operationsManager: OperationsManager;
    domainCoordinator: DomainCoordinator;
  } {
    return {
      characterManager: this.createCharacterManager(),
      worldManager: this.createWorldManager(),
      inputManager: this.createInputManager(),
      operationsManager: this.createOperationsManager(),
      domainCoordinator: this.createDomainCoordinator()
    };
  }
}