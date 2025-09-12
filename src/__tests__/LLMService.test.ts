import { RealLLMService } from '../services/llm/RealLLMService';
import { LLMProvider } from '../services/llm/types/LLMTypes';
import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';

// Mock配置
const mockConfig = {
  providers: {
    [LLMProvider.OPENAI]: {
      apiKey: 'test-openai-key',
      defaultModel: 'gpt-3.5-turbo',
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 10000
      },
      pricing: {
        inputTokenPrice: 0.001,
        outputTokenPrice: 0.002
      }
    },
    [LLMProvider.ANTHROPIC]: {
      apiKey: 'test-anthropic-key',
      defaultModel: 'claude-3-haiku-20240307',
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 10000
      },
      pricing: {
        inputTokenPrice: 0.002,
        outputTokenPrice: 0.004
      }
    }
  },
  defaultProvider: LLMProvider.OPENAI,
  retryConfig: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    maxBackoffMs: 10000
  },
  timeoutMs: 30000
};

// Mock LLM提供者适配器
jest.mock('../services/llm/providers/OpenAIProvider', () => {
  return {
    OpenAIProvider: jest.fn().mockImplementation(() => {
      return {
        generateText: jest.fn().mockImplementation(async () => 'Mock OpenAI response'),
        generateCharacterResponse: jest.fn().mockImplementation(async () => ({
          dialogue: 'Mock character response',
          emotionalState: { mood: 'neutral', intensity: 50 },
          confidence: 0.9
        })),
        generateDirectorDecision: jest.fn().mockImplementation(async () => ({
          action: 'CONTINUE',
          reasoning: 'Mock decision',
          confidence: 0.8,
          parameters: {}
        })),
        getRateLimitStatus: jest.fn().mockReturnValue({
          requestsRemaining: 100,
          resetTime: new Date(Date.now() + 60000),
          currentUsage: 50,
          provider: LLMProvider.OPENAI
        }),
        healthCheck: jest.fn().mockImplementation(async () => true),
        getModel: jest.fn().mockReturnValue('gpt-3.5-turbo')
      };
    })
  };
});

jest.mock('../services/llm/providers/AnthropicProvider', () => {
  return {
    AnthropicProvider: jest.fn().mockImplementation(() => {
      return {
        generateText: jest.fn().mockImplementation(async () => 'Mock Anthropic response'),
        generateCharacterResponse: jest.fn().mockImplementation(async () => ({
          dialogue: 'Mock character response',
          emotionalState: { mood: 'neutral', intensity: 50 },
          confidence: 0.9
        })),
        generateDirectorDecision: jest.fn().mockImplementation(async () => ({
          action: 'CONTINUE',
          reasoning: 'Mock decision',
          confidence: 0.8,
          parameters: {}
        })),
        getRateLimitStatus: jest.fn().mockReturnValue({
          requestsRemaining: 100,
          resetTime: new Date(Date.now() + 60000),
          currentUsage: 50,
          provider: LLMProvider.ANTHROPIC
        }),
        healthCheck: jest.fn().mockImplementation(async () => true),
        getModel: jest.fn().mockReturnValue('claude-3-haiku-20240307')
      };
    })
  };
});

describe('RealLLMService', () => {
  let llmService: RealLLMService;

  beforeEach(() => {
    llmService = new RealLLMService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateText', () => {
    it('should generate text using the default provider', async () => {
      const result = await llmService.generateText('Hello, world!');
      expect(result).toBe('Mock OpenAI response');
    });

    it('should generate text using a specific provider', async () => {
      const result = await llmService.generateText('Hello, world!', {
        provider: LLMProvider.ANTHROPIC
      });
      expect(result).toBe('Mock Anthropic response');
    });

    it('should handle generation options', async () => {
      const result = await llmService.generateText('Hello, world!', {
        maxTokens: 100,
        temperature: 0.7
      });
      expect(result).toBe('Mock OpenAI response');
    });
  });

  describe('generateCharacterResponse', () => {
    it('should generate a character response', async () => {
      const character = {
        id: '1',
        name: 'Test Character',
        personality: { traits: ['kind', 'wise'] },
        emotionalState: { mood: 'happy', intensity: 70 }
      };
      
      const context = { location: 'town_square' };
      const prompt = 'Hello there!';
      
      const result = await llmService.generateCharacterResponse(character, context, prompt);
      
      expect(result).toEqual({
        dialogue: 'Mock character response',
        emotionalState: { mood: 'neutral', intensity: 50 },
        confidence: 0.9
      });
    });
  });

  describe('generateDirectorDecision', () => {
    it('should generate a director decision', async () => {
      const context = { tensionLevel: 5 };
      const evaluation = { plotPoints: ['discovery'] };
      
      const result = await llmService.generateDirectorDecision(context, evaluation);
      
      expect(result).toEqual({
        action: 'CONTINUE',
        reasoning: 'Mock decision',
        confidence: 0.8,
        parameters: {}
      });
    });
  });

  describe('processBatchRequests', () => {
    it('should process batch requests', async () => {
      const requests = [
        {
          agentId: 'agent1',
          prompt: 'Request 1',
          context: {},
          maxTokens: 100,
          temperature: 0.7,
          provider: LLMProvider.OPENAI,
          model: 'gpt-3.5-turbo',
          priority: 1
        },
        {
          agentId: 'agent2',
          prompt: 'Request 2',
          context: {},
          maxTokens: 150,
          temperature: 0.8,
          provider: LLMProvider.ANTHROPIC,
          model: 'claude-3-haiku-20240307',
          priority: 2
        }
      ];
      
      const results = await llmService.processBatchRequests(requests);
      
      expect(results).toHaveLength(2);
      expect(results[0].content).toBe('Mock OpenAI response');
      expect(results[1].content).toBe('Mock Anthropic response');
    });
  });

  describe('getRateLimitStatus', () => {
    it('should get rate limit status for default provider', () => {
      const status = llmService.getRateLimitStatus();
      
      expect(status).toEqual({
        requestsRemaining: 100,
        resetTime: expect.any(Date),
        currentUsage: 50,
        provider: LLMProvider.OPENAI
      });
    });

    it('should get rate limit status for specific provider', () => {
      const status = llmService.getRateLimitStatus(LLMProvider.ANTHROPIC);
      
      expect(status).toEqual({
        requestsRemaining: 100,
        resetTime: expect.any(Date),
        currentUsage: 50,
        provider: LLMProvider.ANTHROPIC
      });
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for a request', () => {
      const request = {
        agentId: 'agent1',
        prompt: 'This is a test prompt with some content',
        context: {},
        maxTokens: 100,
        temperature: 0.7,
        provider: LLMProvider.OPENAI
      };
      
      const estimate = llmService.estimateCost(request);
      
      expect(estimate).toEqual({
        inputTokens: expect.any(Number),
        outputTokens: 100,
        totalCost: expect.any(Number),
        currency: 'USD'
      });
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available providers', () => {
      const providers = llmService.getAvailableProviders();
      
      expect(providers).toContain(LLMProvider.OPENAI);
      expect(providers).toContain(LLMProvider.ANTHROPIC);
    });
  });

  describe('healthCheck', () => {
    it('should perform health check on all providers', async () => {
      const healthStatus = await llmService.healthCheck();
      
      expect(healthStatus[LLMProvider.OPENAI]).toBe(true);
      expect(healthStatus[LLMProvider.ANTHROPIC]).toBe(true);
    });
  });
});