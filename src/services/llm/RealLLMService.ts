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
import { LLMProviderAdapter } from './types/LLMTypes';

export class RealLLMService implements LLMService {
  private config: LLMServiceConfig;
  private providers: Map<LLMProvider, LLMProviderAdapter> = new Map();
  private defaultProvider: LLMProvider;
  private requestQueue: { request: LLMRequest, priority: RequestPriority }[] = [];
  private costTracking: { [key in LLMProvider]?: number } = {};

  constructor(config: LLMServiceConfig) {
    this.config = config;
    this.defaultProvider = config.defaultProvider;
    this.initializeProviders();
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

    // 可以继续添加其他提供者...
  }

  async generateCharacterResponse(
    character: any,
    context: any,
    prompt: string
  ): Promise<LLMCharacterResponse> {
    const provider = this.providers.get(this.defaultProvider);
    if (!provider) {
      throw new Error(`Provider ${this.defaultProvider} not initialized`);
    }

    return provider.generateCharacterResponse(character, context, prompt);
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
    }
  ): Promise<string> {
    const providerKey = options?.provider || this.defaultProvider;
    const provider = this.providers.get(providerKey);
    if (!provider) {
      throw new Error(`Provider ${providerKey} not initialized`);
    }

    return provider.generateText(prompt, {
      maxTokens: options?.maxTokens,
      temperature: options?.temperature
    });
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
}