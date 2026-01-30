import { LLMProviderAdapter, LLMCharacterResponse, DirectorDecision, RateLimitStatus, LLMProvider } from '../types/LLMTypes';
import { FormattedTextGenerator } from '../FormattedTextResponse';
import { FormattedTextExtractorService } from '../FormattedTextExtractorService';
import { Logger } from '../../Logger';
import OpenAI from 'openai';

export class OpenAIProvider implements LLMProviderAdapter {
  private client: OpenAI;
  private model: string;
  private rateLimit: RateLimitStatus;
  private apiKey: string;
  private extractor: FormattedTextExtractorService;
  private logger: Logger;

  constructor(apiKey: string, model: string = 'gpt-3.5-turbo', logger?: Logger) {
    this.apiKey = apiKey;
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.logger = logger || console as any;
    this.extractor = new FormattedTextExtractorService(this.logger);
    this.rateLimit = {
      requestsRemaining: 1000,
      resetTime: new Date(Date.now() + 60000),
      currentUsage: 0,
      provider: LLMProvider.OPENAI
    };
  }

  async generateText(prompt: string, options?: { maxTokens?: number; temperature?: number; jsonMode?: boolean; systemPrompt?: string; model?: string }): Promise<string> {
    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: options?.model || this.model,
          messages: [
            ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
            { role: 'user' as const, content: prompt }
          ],
          max_tokens: options?.maxTokens || 1000,
          temperature: options?.temperature || 0.7,
          response_format: options?.jsonMode ? { type: 'json_object' } : undefined
        });

        // Update rate limit status (in a real implementation, this would come from API headers)
        this.updateRateLimit(1);

        return response.choices[0]?.message?.content || '';
      } catch (error: any) {
        lastError = error;

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error('OpenAI API error after max retries:', error);
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`OpenAI API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  async generateCharacterResponse(character: any, context: any, prompt: string): Promise<LLMCharacterResponse> {
    // 构建角色特定的格式化文本提示词
    const characterPrompt = FormattedTextGenerator.generateCharacterDialoguePrompt(character, context, prompt);

    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: characterPrompt }],
          temperature: 0.7,
          max_tokens: 300
        });

        // Update rate limit status
        this.updateRateLimit(1);

        const content = response.choices[0]?.message?.content || '';

        // 使用格式化文本提取器解析响应
        const result = this.extractor.extractCharacterDialogue(content);

        return {
          dialogue: result.dialogue,
          action: result.action,
          emotionalState: result.emotionalState,
          confidence: result.confidence
        };
      } catch (error: any) {
        lastError = error;

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          this.logger.error('OpenAI API error after max retries:', error);
          // 返回默认响应
          return this.extractor.extractCharacterDialogue('');
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(`OpenAI API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but just in case
    return this.extractor.extractCharacterDialogue('');
  }

  async generateDirectorDecision(context: any, evaluation: any): Promise<DirectorDecision> {
    // 构建导演决策格式化文本提示词
    const directorPrompt = FormattedTextGenerator.generateDirectorDecisionPrompt(context, evaluation);

    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: directorPrompt }],
          temperature: 0.5,
          max_tokens: 300
        });

        // Update rate limit status
        this.updateRateLimit(1);

        const content = response.choices[0]?.message?.content || '';

        // 使用格式化文本提取器解析响应
        const result = this.extractor.extractDirectorDecision(content);

        return {
          action: result.action,
          reasoning: result.reasoning,
          confidence: result.confidence,
          parameters: result.parameters
        };
      } catch (error: any) {
        lastError = error;

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          this.logger.error('OpenAI API error after max retries:', error);
          // 返回默认响应
          return this.extractor.extractDirectorDecision('');
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(`OpenAI API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but just in case
    return this.extractor.extractDirectorDecision('');
  }

  getRateLimitStatus(): RateLimitStatus {
    // 在实际实现中，这应该从API获取真实的速率限制信息
    return this.rateLimit;
  }

  async healthCheck(): Promise<boolean> {
    try {
      // 发送一个简单的请求来检查连接
      await this.client.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI health check failed:', error);
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