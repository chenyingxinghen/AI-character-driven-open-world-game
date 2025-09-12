import { LLMProviderAdapter, LLMCharacterResponse, DirectorDecision, RateLimitStatus, LLMProvider } from '../types/LLMTypes';
import OpenAI from 'openai';

export class OpenAILikeProvider implements LLMProviderAdapter {
  private client: OpenAI;
  private model: string;
  private rateLimit: RateLimitStatus;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string, model: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseUrl
    });
    this.model = model;
    this.rateLimit = {
      requestsRemaining: 1000,
      resetTime: new Date(Date.now() + 60000),
      currentUsage: 0,
      provider: LLMProvider.OPENAI
    };
  }

  async generateText(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<string> {
    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options?.maxTokens || 150,
          temperature: options?.temperature || 0.7
        });

        // Update rate limit status
        this.updateRateLimit(1);
        
        return response.choices[0]?.message?.content || '';
      } catch (error: any) {
        lastError = error;
        
        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error('OpenAI-like API error after max retries:', error);
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`OpenAI-like API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  async generateCharacterResponse(character: any, context: any, prompt: string): Promise<LLMCharacterResponse> {
    // 构建角色特定的提示词
    const characterPrompt = `
      You are ${character.name}, a character with the following personality: ${JSON.stringify(character.personality)}.
      Current emotional state: ${JSON.stringify(character.emotionalState)}.
      Context: ${JSON.stringify(context)}
      Player says: ${prompt}
      
      Respond as the character in a JSON format:
      {
        "dialogue": "your response here",
        "emotionalState": { "mood": "current mood", "intensity": 0-100 },
        "confidence": 0-1
      }
    `;

    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: characterPrompt }],
          temperature: 0.7,
          response_format: { type: "json_object" }
        });

        // Update rate limit status
        this.updateRateLimit(1);
        
        const content = response.choices[0]?.message?.content || '{}';
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
          console.error('OpenAI-like API error after max retries:', error);
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`OpenAI-like API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  async generateDirectorDecision(context: any, evaluation: any): Promise<DirectorDecision> {
    // 构建导演决策提示词
    const directorPrompt = `
      You are the game director making narrative decisions.
      Context: ${JSON.stringify(context)}
      Evaluation: ${JSON.stringify(evaluation)}
      
      Respond with a JSON object:
      {
        "action": "CONTINUE|ADVANCE_PLOT|INTRODUCE_CONFLICT|etc",
        "reasoning": "explanation of the decision",
        "confidence": 0-1,
        "parameters": { "key": "value" }
      }
    `;

    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: directorPrompt }],
          temperature: 0.5,
          response_format: { type: "json_object" }
        });

        // Update rate limit status
        this.updateRateLimit(1);
        
        const content = response.choices[0]?.message?.content || '{}';
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
          console.error('OpenAI-like API error after max retries:', error);
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`OpenAI-like API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
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
      await this.client.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI-like health check failed:', error);
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