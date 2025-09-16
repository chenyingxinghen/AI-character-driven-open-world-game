import { LLMServiceConfig } from './types/LLMTypes';

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



export interface LLMService {
  // 角色对话生成
  generateCharacterResponse(
    character: any,
    context: any,
    prompt: string
  ): Promise<LLMCharacterResponse>;
  
  // 导演决策
  generateDirectorDecision(
    context: any,
    evaluation: any
  ): Promise<DirectorDecision>;
  
  // 通用文本生成
  generateText(
    prompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      provider?: LLMProvider;
    }
  ): Promise<string>;
  
  // 结构化响应生成
  generateStructuredResponse(
    prompt: string,
    schema: any,
    options?: {
      maxTokens?: number;
      temperature?: number;
      provider?: LLMProvider;
    }
  ): Promise<any>;
  
  // 批量处理
  processBatchRequests(
    requests: LLMRequest[], 
    options?: BatchRequestOptions
  ): Promise<LLMResponse[]>;
  
  // 成本和频率控制
  getRateLimitStatus(provider?: LLMProvider): RateLimitStatus;
  estimateCost(request: LLMRequest): CostEstimate;
  
  // 配置和管理
  updateConfig(config: Partial<LLMServiceConfig>): void;
  getAvailableProviders(): LLMProvider[];
  switchProvider(provider: LLMProvider): void;
  getDefaultProvider(): LLMProvider;
  
  // 健康检查
  healthCheck(): Promise<{ [key in LLMProvider]?: boolean }>;
}

// Mock implementation for development
export class MockLLMService implements LLMService {
  async generateCharacterResponse(character: any, context: any, prompt: string): Promise<LLMCharacterResponse> {
    return {
      dialogue: `Mock response for character ${character.id} with prompt: ${prompt.substring(0, 50)}...`,
      emotionalState: { mood: 'neutral' },
      confidence: 0.8
    };
  }

  async generateDirectorDecision(context: any, evaluation: any): Promise<DirectorDecision> {
    return {
      action: 'CONTINUE',
      reasoning: 'Mock director decision',
      confidence: 0.9,
      parameters: {}
    };
  }

  async generateText(prompt: string, options?: { maxTokens?: number; temperature?: number; provider?: LLMProvider; }): Promise<string> {
    return `Mock text generation for prompt: ${prompt.substring(0, 50)}...`;
  }

  async generateStructuredResponse(prompt: string, schema: any, options?: { maxTokens?: number; temperature?: number; provider?: LLMProvider; }): Promise<any> {
    return { mock: 'structured response' };
  }

  async processBatchRequests(requests: LLMRequest[], options?: BatchRequestOptions): Promise<LLMResponse[]> {
    return requests.map(request => ({
      content: `Mock response for ${request.agentId}`,
      confidence: 0.8,
      source: 'mock',
      tokensUsed: 100,
      provider: request.provider || LLMProvider.OPENAI,
      model: 'mock-model',
      requestId: `mock-${Date.now()}-${Math.random()}`
    }));
  }

  getRateLimitStatus(provider?: LLMProvider): RateLimitStatus {
    return {
      requestsRemaining: 100,
      resetTime: new Date(Date.now() + 60000),
      currentUsage: 50,
      provider: provider || LLMProvider.OPENAI
    };
  }

  estimateCost(request: LLMRequest): CostEstimate {
    return {
      inputTokens: 100,
      outputTokens: 200,
      totalCost: 0.001,
      currency: 'USD'
    };
  }

  updateConfig(config: Partial<LLMServiceConfig>): void {
    // Mock implementation
  }

  getAvailableProviders(): LLMProvider[] {
    return [LLMProvider.OPENAI, LLMProvider.ANTHROPIC];
  }

  switchProvider(provider: LLMProvider): void {
    // Mock implementation
  }

  getDefaultProvider(): LLMProvider {
    return LLMProvider.OPENAI;
  }

  async healthCheck(): Promise<{ [key in LLMProvider]?: boolean }> {
    return {
      [LLMProvider.OPENAI]: true,
      [LLMProvider.ANTHROPIC]: true
    };
  }
}