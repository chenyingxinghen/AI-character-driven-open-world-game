import { LLMProviderAdapter, LLMCharacterResponse, DirectorDecision, RateLimitStatus, LLMProvider } from '../types/LLMTypes';
import { FormattedTextGenerator } from '../FormattedTextResponse';
import { FormattedTextExtractorService } from '../FormattedTextExtractorService';
import { Logger } from '../../Logger';

export class GeminiProvider implements LLMProviderAdapter {
  private model: string;
  private rateLimit: RateLimitStatus;
  private apiKey: string;
  private extractor: FormattedTextExtractorService;
  private logger: Logger;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash-lite', logger?: Logger) {
    this.apiKey = apiKey;
    this.model = model;
    this.logger = logger || console as any;
    this.extractor = new FormattedTextExtractorService(this.logger);
    this.rateLimit = {
      requestsRemaining: 1000,
      resetTime: new Date(Date.now() + 60000),
      currentUsage: 0,
      provider: LLMProvider.GEMINI
    };
  }

  async generateText(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.callGeminiAPI(prompt, {
          maxTokens: options?.maxTokens,
          temperature: options?.temperature
        });

        // Update rate limit status
        this.updateRateLimit(1);
        
        return response;
      } catch (error: any) {
        lastError = error;
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          this.logger.error('Gemini API error after max retries:', error);
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(`Gemini API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
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
        const response = await this.callGeminiAPI(characterPrompt);

        // Update rate limit status
        this.updateRateLimit(1);
        
        // 使用格式化文本提取器解析响应
        const extractedResult = this.extractor.extractCharacterDialogue(response);
        
        return {
          dialogue: extractedResult.dialogue,
          action: extractedResult.action,
          emotionalState: extractedResult.emotionalState,
          confidence: extractedResult.confidence
        };
      } catch (error: any) {
        lastError = error;
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          this.logger.error('Gemini API error after max retries:', error);
          // 返回默认响应
          return this.extractor.extractCharacterDialogue('');
        }
        
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(`Gemini API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
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
        const response = await this.callGeminiAPI(directorPrompt);

        // Update rate limit status
        this.updateRateLimit(1);
        
        // 使用格式化文本提取器解析响应
        const extractedResult = this.extractor.extractDirectorDecision(response);
        
        return {
          action: extractedResult.action,
          reasoning: extractedResult.reasoning,
          confidence: extractedResult.confidence,
          parameters: extractedResult.parameters
        };
      } catch (error: any) {
        lastError = error;
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          this.logger.error('Gemini API error after max retries:', error);
          // 返回默认响应
          return this.extractor.extractDirectorDecision('');
        }
        
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(`Gemini API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      this.logger.error('Gemini health check failed:', error as Error);
      return false;
    }
  }

  getModel(): string {
    return this.model;
  }

  private async callGeminiAPI(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxTokens || 150
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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