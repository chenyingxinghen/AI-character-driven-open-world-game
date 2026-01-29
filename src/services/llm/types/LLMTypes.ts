export interface LLMRequest {
  agentId: string;
  prompt: string;
  context: any;
  maxTokens: number;
  temperature: number;
  provider?: LLMProvider;
  model?: string;
  priority?: RequestPriority;
}

export interface LLMResponse {
  content: string;
  confidence: number; // 0-1
  source: string;
  tokensUsed: number;
  provider: LLMProvider;
  model: string;
  requestId: string;
}

export interface LLMCharacterResponse {
  dialogue: string;
  action?: string;
  emotionalState: any;
  confidence: number;
}

export interface DirectorDecision {
  action: string;
  reasoning: string;
  confidence: number;
  parameters: Record<string, any>;
}

export interface RateLimitStatus {
  requestsRemaining: number;
  resetTime: Date;
  currentUsage: number;
  provider: LLMProvider;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  currency: string;
}

export interface BatchRequestOptions {
  maxConcurrency?: number;
  retryAttempts?: number;
  timeoutMs?: number;
}

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  LOCAL = 'local',
  GEMINI = 'gemini',
  MISTRAL = 'mistral',
  LLAMA = 'llama',
  ZHIPU = 'zhipu',
  OPENROUTER = 'openrouter'
}

export enum RequestPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export interface LLMServiceConfig {
  providers: {
    [key in LLMProvider]?: {
      apiKey: string;
      baseUrl?: string;
      defaultModel: string;
      rateLimit: {
        requestsPerMinute: number;
        tokensPerMinute: number;
      };
      pricing: {
        inputTokenPrice: number;  // per 1000 tokens
        outputTokenPrice: number; // per 1000 tokens
      };
    };
  };
  defaultProvider: LLMProvider;
  retryConfig: {
    maxAttempts: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
  };
  timeoutMs: number;
}

export interface LLMProviderAdapter {
  generateText(prompt: string, options?: { maxTokens?: number; temperature?: number; jsonMode?: boolean; systemPrompt?: string }): Promise<string>;
  generateCharacterResponse(character: any, context: any, prompt: string): Promise<LLMCharacterResponse>;
  generateDirectorDecision(context: any, evaluation: any): Promise<DirectorDecision>;
  getRateLimitStatus(): RateLimitStatus;
  healthCheck(): Promise<boolean>;
  getModel(): string;
}