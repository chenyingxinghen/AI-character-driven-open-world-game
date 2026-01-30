import { LLMProviderAdapter, LLMCharacterResponse, DirectorDecision, RateLimitStatus, LLMProvider } from '../types/LLMTypes';
import Anthropic from '@anthropic-ai/sdk';
import { promptManager } from '../../../prompts';

export class AnthropicProvider implements LLMProviderAdapter {
  private client: Anthropic;
  private model: string;
  private rateLimit: RateLimitStatus;
  private apiKey: string;

  constructor(apiKey: string, model: string = 'claude-3-haiku-20240307') {
    this.apiKey = apiKey;
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.rateLimit = {
      requestsRemaining: 1000,
      resetTime: new Date(Date.now() + 60000),
      currentUsage: 0,
      provider: LLMProvider.ANTHROPIC
    };
  }

  async generateText(prompt: string, options?: { maxTokens?: number; temperature?: number; jsonMode?: boolean; systemPrompt?: string; model?: string }): Promise<string> {
    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response: any = await (this.client as any).messages.create({
          model: options?.model || this.model,
          system: options?.systemPrompt,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options?.maxTokens || 1000,
          temperature: options?.temperature || 0.7
        });

        // Update rate limit status
        this.updateRateLimit(1);

        return response.content[0]?.type === 'text' ? response.content[0].text : '';
      } catch (error: any) {
        lastError = error;

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error('Anthropic API error after max retries:', error);
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Anthropic API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  async generateCharacterResponse(character: any, context: any, prompt: string): Promise<LLMCharacterResponse> {
    // 构建角色特定的提示词
    const characterPrompt = promptManager.generate('system.default_character_response', {
      name: character.name,
      personality: JSON.stringify(character.personality),
      emotionalState: JSON.stringify(character.emotionalState),
      context: JSON.stringify(context),
      prompt
    });

    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response: any = await (this.client as any).messages.create({
          model: this.model,
          messages: [{ role: 'user', content: characterPrompt }],
          max_tokens: 300,
          temperature: 0.7
        });

        // Update rate limit status
        this.updateRateLimit(1);

        const content = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
        const parsedResponse = JSON.parse(content);

        return {
          dialogue: parsedResponse.dialogue || '',
          emotionalState: parsedResponse.emotionalState || { mood: 'neutral', intensity: 50 },
          confidence: parsedResponse.confidence || 0.8
        };
      } catch (error: any) {
        lastError = error;

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error('Anthropic API error after max retries:', error);
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Anthropic API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  async generateDirectorDecision(context: any, evaluation: any): Promise<DirectorDecision> {
    // 构建导演决策提示词
    const directorPrompt = promptManager.generate('system.default_director_decision', {
      context: JSON.stringify(context),
      evaluation: JSON.stringify(evaluation)
    });

    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response: any = await (this.client as any).messages.create({
          model: this.model,
          messages: [{ role: 'user', content: directorPrompt }],
          max_tokens: 300,
          temperature: 0.5
        });

        // Update rate limit status
        this.updateRateLimit(1);

        const content = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
        const parsedResponse = JSON.parse(content);

        return {
          action: parsedResponse.action || 'CONTINUE',
          reasoning: parsedResponse.reasoning || '',
          confidence: parsedResponse.confidence || 0.8,
          parameters: parsedResponse.parameters || {}
        };
      } catch (error: any) {
        lastError = error;

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error('Anthropic API error after max retries:', error);
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Anthropic API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  getRateLimitStatus(): RateLimitStatus {
    // 在实际实现中，这应该从API获取真实的速率限制信息
    return this.rateLimit;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 发送一个简单的请求来检查连接
      // Use a simple message create request instead
      await (this.client as any).messages.create({
        model: this.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      return true;
    } catch (error) {
      console.error('Anthropic health check failed:', error);
      return false;
    }
  }

  getModel(): string {
    return this.model;
  }

  private updateRateLimit(usedRequests: number): void {
    this.rateLimit.currentUsage += usedRequests;
    this.rateLimit.requestsRemaining = Math.max(0, this.rateLimit.requestsRemaining - usedRequests);

    // Reset rate limit if past reset time
    if (new Date() > this.rateLimit.resetTime) {
      this.rateLimit.requestsRemaining = 1000;
      this.rateLimit.currentUsage = 0;
      this.rateLimit.resetTime = new Date(Date.now() + 60000);
    }
  }
}