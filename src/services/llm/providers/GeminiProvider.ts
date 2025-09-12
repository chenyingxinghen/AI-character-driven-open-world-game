import { LLMProviderAdapter, LLMCharacterResponse, DirectorDecision, RateLimitStatus, LLMProvider } from '../types/LLMTypes';
import { FormattedTextGenerator } from '../FormattedTextResponse';
import { FormattedTextExtractorService } from '../FormattedTextExtractorService';
import { Logger } from '../../Logger';

// Note: You'll need to install the Google Generative AI SDK
// npm install @google/generative-ai
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export class GeminiProvider implements LLMProviderAdapter {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;
  private rateLimit: RateLimitStatus;
  private apiKey: string;
  private extractor: FormattedTextExtractorService;
  private logger: Logger;

  constructor(apiKey: string, model: string = 'gemini-pro', logger?: Logger) {
    this.apiKey = apiKey;
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = model;
    this.model = this.client.getGenerativeModel({ model: model });
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
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: options?.maxTokens || 150,
            temperature: options?.temperature || 0.7
          }
        });

        // Update rate limit status
        this.updateRateLimit(1);
        
        return result.response.text() || '';
      } catch (error: any) {
        lastError = error;
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error('Gemini API error after max retries:', error);
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Gemini API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
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
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: characterPrompt }] }],
          generationConfig: {
            temperature: 0.7
          }
        });

        // Update rate limit status
        this.updateRateLimit(1);
        
        const content = result.response.text() || '';
        
        // 使用格式化文本提取器解析响应
        const extractedResult = this.extractor.extractCharacterDialogue(content);
        
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
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: directorPrompt }] }],
          generationConfig: {
            temperature: 0.5
          }
        });

        // Update rate limit status
        this.updateRateLimit(1);
        
        const content = result.response.text() || '';
        
        // 使用格式化文本提取器解析响应
        const extractedResult = this.extractor.extractDirectorDecision(content);
        
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
      await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
      });
      return true;
    } catch (error) {
      console.error('Gemini health check failed:', error);
      return false;
    }
  }

  getModel(): string {
    return this.modelName;
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