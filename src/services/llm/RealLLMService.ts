import {
  LLMRequest,
  LLMResponse,
  LLMCharacterResponse,
  DirectorDecision,
  RateLimitStatus,
  CostEstimate,
  BatchRequestOptions,
  LLMProvider,
  LLMServiceConfig,
  RequestPriority
} from './types/LLMTypes';
import { LLMService } from './LLMService';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AnthropicProvider } from './providers/AnthropicProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { OpenRouterProvider } from './providers/OpenRouterProvider';
import { OpenAILikeProvider } from './providers/OpenAILikeProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { ZhipuProvider } from './providers/ZhipuProvider';
import { LLMProviderAdapter } from './types/LLMTypes';
import { LLMCache } from './LLMCache';
import { JsonUtils } from '../../utils/JsonUtils';

export interface ProviderHealth {
  isHealthy: boolean;
  latency: number;
  lastCheck: Date;
  errorCount: number;
}

export interface LoadBalancingStrategy {
  type: 'round-robin' | 'least-latency' | 'random' | 'weighted';
  weights?: Record<LLMProvider, number>;
}

export interface FailoverConfig {
  enabled: boolean;
  healthCheckInterval: number;
  maxFailures: number;
  fallbackOrder: LLMProvider[];
}

export class RealLLMService implements LLMService {
  private config: LLMServiceConfig;
  private providers: Map<LLMProvider, LLMProviderAdapter> = new Map();
  private defaultProvider: LLMProvider;
  private requestQueue: { request: LLMRequest, priority: RequestPriority }[] = [];
  private costTracking: { [key in LLMProvider]?: number } = {};
  private providerHealth: Map<LLMProvider, ProviderHealth> = new Map();
  private currentProviderIndex: number = 0;
  private loadBalancingStrategy: LoadBalancingStrategy = { type: 'round-robin' };
  private failoverConfig: FailoverConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private configWatcher?: any; // File watcher for dynamic config
  private cache: LLMCache;

  constructor(config: LLMServiceConfig, loadBalancingStrategy?: LoadBalancingStrategy, failoverConfig?: FailoverConfig) {
    this.config = config;
    this.defaultProvider = config.defaultProvider;
    this.loadBalancingStrategy = loadBalancingStrategy || { type: 'round-robin' };
    this.failoverConfig = failoverConfig || {
      enabled: true,
      healthCheckInterval: 30000, // 30 seconds
      maxFailures: 3,
      fallbackOrder: [LLMProvider.OPENAI, LLMProvider.ANTHROPIC, LLMProvider.GEMINI, LLMProvider.OPENROUTER, LLMProvider.ZHIPU]
    };

    this.initializeProviders();
    this.startHealthMonitoring();
    this.watchConfigChanges();
    this.cache = new LLMCache();
  }

  private initializeProviders(): void {
    // 初始化OpenAI提供者
    if (this.config.providers[LLMProvider.OPENAI]?.apiKey) {
      this.providers.set(
        LLMProvider.OPENAI,
        new OpenAIProvider(
          this.config.providers[LLMProvider.OPENAI]!.apiKey,
          this.config.providers[LLMProvider.OPENAI]!.defaultModel
        )
      );
      this.costTracking[LLMProvider.OPENAI] = 0;
    }

    // 初始化Anthropic提供者
    if (this.config.providers[LLMProvider.ANTHROPIC]?.apiKey) {
      this.providers.set(
        LLMProvider.ANTHROPIC,
        new AnthropicProvider(
          this.config.providers[LLMProvider.ANTHROPIC]!.apiKey,
          this.config.providers[LLMProvider.ANTHROPIC]!.defaultModel
        )
      );
      this.costTracking[LLMProvider.ANTHROPIC] = 0;
    }

    // 初始化Gemini提供者
    if (this.config.providers[LLMProvider.GEMINI]?.apiKey) {
      this.providers.set(
        LLMProvider.GEMINI,
        new GeminiProvider(
          this.config.providers[LLMProvider.GEMINI]!.apiKey,
          this.config.providers[LLMProvider.GEMINI]!.defaultModel
        )
      );
      this.costTracking[LLMProvider.GEMINI] = 0;
    }

    // 初始化OpenRouter提供者
    if (this.config.providers[LLMProvider.OPENROUTER]?.apiKey) {
      this.providers.set(
        LLMProvider.OPENROUTER,
        new OpenRouterProvider(
          this.config.providers[LLMProvider.OPENROUTER]!.apiKey,
          this.config.providers[LLMProvider.OPENROUTER]!.defaultModel
        )
      );
      this.costTracking[LLMProvider.OPENROUTER] = 0;
    }

    // 初始化本地模型提供者 (Ollama)
    if (this.config.providers[LLMProvider.LOCAL]) {
      const localConfig = this.config.providers[LLMProvider.LOCAL]!;
      this.providers.set(
        LLMProvider.LOCAL,
        new OllamaProvider({
          baseUrl: localConfig.baseUrl || 'http://localhost:11434',
          model: localConfig.defaultModel
        })
      );
      this.costTracking[LLMProvider.LOCAL] = 0;
    }

    // 初始化Zhipu提供者
    if (this.config.providers[LLMProvider.ZHIPU]?.apiKey) {
      this.providers.set(
        LLMProvider.ZHIPU,
        new ZhipuProvider(
          this.config.providers[LLMProvider.ZHIPU]!.apiKey,
          this.config.providers[LLMProvider.ZHIPU]!.defaultModel
        )
      );
      this.costTracking[LLMProvider.ZHIPU] = 0;
    }

    // 初始化OpenAI兼容的提供者
    if (this.config.providers[LLMProvider.OPENAI] && this.config.providers[LLMProvider.OPENAI]?.baseUrl) {
      const openaiConfig = this.config.providers[LLMProvider.OPENAI]!;
      this.providers.set(
        LLMProvider.OPENAI,
        new OpenAILikeProvider(
          openaiConfig.apiKey,
          openaiConfig.baseUrl!,
          openaiConfig.defaultModel
        )
      );
    }
  }

  async generateCharacterResponse(
    character: any,
    context: any,
    prompt: string
  ): Promise<LLMCharacterResponse> {
    const cacheKey = this.cache.generateKey(prompt, { characterId: character.id, context });
    const cachedResponse = this.cache.get<LLMCharacterResponse>(cacheKey);
    if (cachedResponse) {
      console.log('Cache hit for character response');
      return cachedResponse;
    }

    const provider = this.providers.get(this.defaultProvider);
    if (!provider) {
      throw new Error(`Provider ${this.defaultProvider} not initialized`);
    }

    const response = await provider.generateCharacterResponse(character, context, prompt);
    this.cache.set(cacheKey, response);
    return response;
  }

  async generateDirectorDecision(
    context: any,
    evaluation: any
  ): Promise<DirectorDecision> {
    const provider = this.providers.get(this.defaultProvider);
    if (!provider) {
      throw new Error(`Provider ${this.defaultProvider} not initialized`);
    }

    return provider.generateDirectorDecision(context, evaluation);
  }

  async generateText(
    prompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      provider?: LLMProvider;
      jsonMode?: boolean;
      systemPrompt?: string;
    }
  ): Promise<string> {
    const cacheKey = this.cache.generateKey(prompt, options);
    const cachedResponse = this.cache.get<string>(cacheKey);
    if (cachedResponse) {
      console.log('Cache hit for text generation');
      return cachedResponse;
    }

    let response: string;
    if (options?.provider) {
      // Use specified provider
      const provider = this.providers.get(options.provider);
      if (!provider) {
        throw new Error(`Provider ${options.provider} not initialized`);
      }
      response = await provider.generateText(prompt, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
        jsonMode: options?.jsonMode,
        systemPrompt: options?.systemPrompt
      });
    } else {
      // Use intelligent selection
      response = await this.generateTextWithIntelligentSelection(prompt, {
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
        fallbackEnabled: true,
        jsonMode: options?.jsonMode,
        systemPrompt: options?.systemPrompt
      });
    }

    this.cache.set(cacheKey, response);
    return response;
  }

  // 生成结构化响应
  async generateStructuredResponse(
    prompt: string,
    schema: any,
    options?: {
      maxTokens?: number;
      temperature?: number;
      provider?: LLMProvider;
      jsonMode?: boolean;
      systemPrompt?: string;
    }
  ): Promise<any> {
    try {
      // 对于结构化响应，我们需要在提示中包含schema信息
      const structuredPrompt = `${prompt}\n\nPlease respond in JSON format according to this schema: ${JSON.stringify(schema)}`;

      const response = await this.generateText(structuredPrompt, {
        maxTokens: options?.maxTokens || 1000,
        temperature: options?.temperature || 0.1,
        provider: options?.provider,
        jsonMode: options?.jsonMode ?? true,
        systemPrompt: options?.systemPrompt
      });

      // 使用 JsonUtils 提取 JSON
      return JsonUtils.extractJson<any>(response);
    } catch (error) {
      console.error('Failed to generate structured response:', error);
      throw error;
    }
  }

  async processBatchRequests(
    requests: LLMRequest[],
    options?: BatchRequestOptions
  ): Promise<LLMResponse[]> {
    // 简化的批处理实现
    const responses: LLMResponse[] = [];
    const maxConcurrency = options?.maxConcurrency || 5;
    const retryAttempts = options?.retryAttempts || 3;
    const timeoutMs = options?.timeoutMs || 30000;

    // Process requests with limited concurrency
    for (let i = 0; i < requests.length; i += maxConcurrency) {
      const batch = requests.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(request => this.processRequestWithRetry(request, retryAttempts, timeoutMs));

      try {
        const batchResponses = await Promise.all(batchPromises);
        responses.push(...batchResponses);
      } catch (error) {
        console.error('Error processing batch requests:', error);
        // Add error responses for failed requests
        batch.forEach(request => {
          responses.push({
            content: `Error: ${(error as Error).message}`,
            confidence: 0,
            source: 'error',
            tokensUsed: 0,
            provider: request.provider || this.defaultProvider,
            model: 'error',
            requestId: request.agentId
          });
        });
      }
    }

    return responses;
  }

  private async processRequestWithRetry(
    request: LLMRequest,
    maxRetries: number,
    timeoutMs: number
  ): Promise<LLMResponse> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check rate limit before making request
        const providerKey = request.provider || this.defaultProvider;
        const rateLimitStatus = this.getRateLimitStatus(providerKey);

        if (rateLimitStatus.requestsRemaining <= 0) {
          // Wait until rate limit resets
          const waitTime = rateLimitStatus.resetTime.getTime() - Date.now();
          if (waitTime > 0) {
            console.log(`Rate limit reached for ${providerKey}, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }

        const provider = this.providers.get(providerKey);
        if (!provider) {
          throw new Error(`Provider ${providerKey} not initialized`);
        }

        const content = await provider.generateText(request.prompt, {
          maxTokens: request.maxTokens,
          temperature: request.temperature
        });

        // Estimate cost and update tracking
        const costEstimate = this.estimateCost(request);
        this.costTracking[providerKey] = (this.costTracking[providerKey] || 0) + costEstimate.totalCost;

        return {
          content,
          confidence: 0.9,
          source: 'real',
          tokensUsed: content.length / 4, // 简化的token计算
          provider: providerKey,
          model: provider.getModel(),
          requestId: request.agentId
        };
      } catch (error) {
        lastError = error;

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error(`Error processing request ${request.agentId} after ${maxRetries} retries:`, error);
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Error processing request ${request.agentId} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, (error as Error).message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  getRateLimitStatus(provider?: LLMProvider): RateLimitStatus {
    const providerKey = provider || this.defaultProvider;
    const providerInstance = this.providers.get(providerKey);
    if (!providerInstance) {
      throw new Error(`Provider ${providerKey} not initialized`);
    }

    return providerInstance.getRateLimitStatus();
  }

  estimateCost(request: LLMRequest): CostEstimate {
    // 简化的成本估算
    const providerKey = request.provider || this.defaultProvider;
    const providerConfig = this.config.providers[providerKey];

    if (!providerConfig) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        currency: 'USD'
      };
    }

    // 简化的token计算
    const inputTokens = request.prompt.length / 4;
    const outputTokens = request.maxTokens || 0;

    const inputCost = (inputTokens / 1000) * providerConfig.pricing.inputTokenPrice;
    const outputCost = (outputTokens / 1000) * providerConfig.pricing.outputTokenPrice;

    return {
      inputTokens,
      outputTokens,
      totalCost: inputCost + outputCost,
      currency: 'USD'
    };
  }

  updateConfig(config: Partial<LLMServiceConfig>): void {
    this.config = { ...this.config, ...config };
    // 重新初始化提供者
    this.initializeProviders();
  }

  getAvailableProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }

  switchProvider(provider: LLMProvider): void {
    if (this.providers.has(provider)) {
      this.defaultProvider = provider;
    } else {
      throw new Error(`Provider ${provider} not available`);
    }
  }

  getDefaultProvider(): LLMProvider {
    return this.defaultProvider;
  }

  async healthCheck(): Promise<{ [key in LLMProvider]?: boolean }> {
    const results: { [key in LLMProvider]?: boolean } = {};

    // Convert Map to Array for iteration
    for (const [providerKey, provider] of Array.from(this.providers.entries())) {
      try {
        results[providerKey] = await provider.healthCheck();
      } catch (error) {
        console.error(`Health check failed for provider ${providerKey}:`, error);
        results[providerKey] = false;
      }
    }

    return results;
  }

  // Get current cost tracking
  getCostTracking(): { [key in LLMProvider]?: number } {
    return { ...this.costTracking };
  }

  // Load balancing and intelligent provider selection
  private selectOptimalProvider(): LLMProvider {
    const availableProviders = this.getHealthyProviders();

    if (availableProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    switch (this.loadBalancingStrategy.type) {
      case 'round-robin':
        return this.selectRoundRobin(availableProviders);
      case 'least-latency':
        return this.selectLeastLatency(availableProviders);
      case 'random':
        return this.selectRandom(availableProviders);
      case 'weighted':
        return this.selectWeighted(availableProviders);
      default:
        return availableProviders[0];
    }
  }

  private getHealthyProviders(): LLMProvider[] {
    return Array.from(this.providers.keys()).filter(provider => {
      const health = this.providerHealth.get(provider);
      return health?.isHealthy ?? true;
    });
  }

  private selectRoundRobin(providers: LLMProvider[]): LLMProvider {
    const provider = providers[this.currentProviderIndex % providers.length];
    this.currentProviderIndex++;
    return provider;
  }

  private selectLeastLatency(providers: LLMProvider[]): LLMProvider {
    return providers.reduce((best, current) => {
      const bestHealth = this.providerHealth.get(best);
      const currentHealth = this.providerHealth.get(current);

      if (!bestHealth) return current;
      if (!currentHealth) return best;

      return currentHealth.latency < bestHealth.latency ? current : best;
    });
  }

  private selectRandom(providers: LLMProvider[]): LLMProvider {
    return providers[Math.floor(Math.random() * providers.length)];
  }

  private selectWeighted(providers: LLMProvider[]): LLMProvider {
    if (!this.loadBalancingStrategy.weights) {
      return this.selectRandom(providers);
    }

    const weights = this.loadBalancingStrategy.weights;
    const totalWeight = providers.reduce((sum, provider) => sum + (weights[provider] || 1), 0);
    let random = Math.random() * totalWeight;

    for (const provider of providers) {
      random -= weights[provider] || 1;
      if (random <= 0) {
        return provider;
      }
    }

    return providers[0];
  }

  // Health monitoring
  private startHealthMonitoring(): void {
    if (!this.failoverConfig.enabled) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.failoverConfig.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [provider, providerAdapter] of this.providers.entries()) {
      const startTime = Date.now();

      try {
        const isHealthy = await providerAdapter.healthCheck();
        const latency = Date.now() - startTime;

        const currentHealth = this.providerHealth.get(provider) || {
          isHealthy: true,
          latency: 0,
          lastCheck: new Date(),
          errorCount: 0
        };

        this.providerHealth.set(provider, {
          isHealthy,
          latency,
          lastCheck: new Date(),
          errorCount: isHealthy ? 0 : currentHealth.errorCount + 1
        });

        // Mark as unhealthy if too many failures
        if (currentHealth.errorCount >= this.failoverConfig.maxFailures) {
          this.providerHealth.set(provider, {
            ...currentHealth,
            isHealthy: false
          });
        }

      } catch (error) {
        const currentHealth = this.providerHealth.get(provider) || {
          isHealthy: true,
          latency: 0,
          lastCheck: new Date(),
          errorCount: 0
        };

        this.providerHealth.set(provider, {
          isHealthy: false,
          latency: Date.now() - startTime,
          lastCheck: new Date(),
          errorCount: currentHealth.errorCount + 1
        });

        console.error(`Health check failed for provider ${provider}:`, error);
      }
    }
  }

  // Dynamic configuration management
  private watchConfigChanges(): void {
    // In a real implementation, this would watch for config file changes
    // For now, we'll just set up a basic structure
    console.log('Config watcher initialized (placeholder implementation)');
  }

  async reloadConfig(newConfig?: Partial<LLMServiceConfig>): Promise<void> {
    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
      this.initializeProviders();
      console.log('Configuration reloaded from provided config');
    } else {
      // In real implementation, reload from file
      console.log('Configuration reload requested (would reload from file)');
    }
  }

  // Enhanced generateText with intelligent provider selection
  async generateTextWithIntelligentSelection(
    prompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      preferredProviders?: LLMProvider[];
      fallbackEnabled?: boolean;
      jsonMode?: boolean;
      systemPrompt?: string;
    }
  ): Promise<string> {
    const preferredProviders = options?.preferredProviders || [this.selectOptimalProvider()];
    const fallbackEnabled = options?.fallbackEnabled ?? true;

    let lastError: any;

    for (const provider of preferredProviders) {
      try {
        const providerAdapter = this.providers.get(provider);
        if (!providerAdapter) {
          throw new Error(`Provider ${provider} not available`);
        }

        const health = this.providerHealth.get(provider);
        if (health && !health.isHealthy) {
          throw new Error(`Provider ${provider} is currently unhealthy`);
        }

        return await providerAdapter.generateText(prompt, {
          maxTokens: options?.maxTokens,
          temperature: options?.temperature,
          jsonMode: options?.jsonMode,
          systemPrompt: options?.systemPrompt
        });

      } catch (error) {
        lastError = error;
        console.warn(`Provider ${provider} failed, trying next:`, (error as Error).message);

        // Update health status
        const currentHealth = this.providerHealth.get(provider);
        if (currentHealth) {
          this.providerHealth.set(provider, {
            ...currentHealth,
            errorCount: currentHealth.errorCount + 1
          });
        }
      }
    }

    if (fallbackEnabled && this.failoverConfig.enabled) {
      // Try fallback providers
      for (const fallbackProvider of this.failoverConfig.fallbackOrder) {
        if (preferredProviders.includes(fallbackProvider)) {
          continue; // Already tried
        }

        try {
          const providerAdapter = this.providers.get(fallbackProvider);
          if (!providerAdapter) continue;

          console.log(`Falling back to provider ${fallbackProvider}`);
          return await providerAdapter.generateText(prompt, {
            maxTokens: options?.maxTokens,
            temperature: options?.temperature,
            jsonMode: options?.jsonMode,
            systemPrompt: options?.systemPrompt
          });

        } catch (error) {
          console.warn(`Fallback provider ${fallbackProvider} also failed:`, (error as Error).message);
        }
      }
    }

    throw lastError || new Error('All providers failed');
  }

  // Provider statistics
  getProviderStatistics(): Record<LLMProvider, {
    health: ProviderHealth;
    totalRequests: number;
    totalCost: number;
    averageLatency: number;
  }> {
    const stats: any = {};

    for (const provider of this.providers.keys()) {
      const health = this.providerHealth.get(provider) || {
        isHealthy: true,
        latency: 0,
        lastCheck: new Date(),
        errorCount: 0
      };

      stats[provider] = {
        health,
        totalRequests: 0, // Would track in real implementation
        totalCost: this.costTracking[provider] || 0,
        averageLatency: health.latency
      };
    }

    return stats;
  }

  // Update load balancing strategy
  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this.loadBalancingStrategy = strategy;
    console.log(`Load balancing strategy updated to: ${strategy.type}`);
  }

  // Update failover configuration
  setFailoverConfig(config: Partial<FailoverConfig>): void {
    this.failoverConfig = { ...this.failoverConfig, ...config };

    // Restart health monitoring with new config
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    this.startHealthMonitoring();

    console.log('Failover configuration updated');
  }

  // Cleanup method
  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    if (this.configWatcher) {
      // Close config watcher if implemented
    }

    console.log('LLM Service shutdown completed');
  }
}