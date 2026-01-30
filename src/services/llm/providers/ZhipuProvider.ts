import { LLMProviderAdapter, LLMCharacterResponse, DirectorDecision, RateLimitStatus, LLMProvider } from '../types/LLMTypes';
import { promptManager } from '../../../prompts';

export class ZhipuProvider implements LLMProviderAdapter {
  private apiKey: string;
  private model: string;
  private rateLimit: RateLimitStatus;

  constructor(apiKey: string, model: string = 'glm-4') {
    this.apiKey = apiKey;
    this.model = model;
    this.rateLimit = {
      requestsRemaining: 1000,
      resetTime: new Date(Date.now() + 60000),
      currentUsage: 0,
      provider: LLMProvider.ZHIPU
    };
  }

  async generateText(prompt: string, options?: { maxTokens?: number; temperature?: number; jsonMode?: boolean; systemPrompt?: string; model?: string }): Promise<string> {
    // Implement retry mechanism
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const messages: any[] = [];
        if (options?.systemPrompt) {
          messages.push({ role: 'system', content: options.systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const requestBody: any = {
          model: options?.model || this.model,
          messages,
          max_tokens: options?.maxTokens || 1000,
          temperature: options?.temperature || 0.7
        };

        if (options?.jsonMode) {
          requestBody.response_format = { type: "json_object" };
        }

        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update rate limit status
        this.updateRateLimit(1);

        return data.choices[0]?.message?.content || '';
      } catch (error: any) {
        lastError = error;

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          console.error('Zhipu API error after max retries:', error);
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Zhipu API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: characterPrompt }],
            temperature: 0.7,
            response_format: { type: "json_object" }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update rate limit status
        this.updateRateLimit(1);

        const content = data.choices[0]?.message?.content || '{}';
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
          console.error('Zhipu API error after max retries:', error);
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Zhipu API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: directorPrompt }],
            temperature: 0.5,
            response_format: { type: "json_object" }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update rate limit status
        this.updateRateLimit(1);

        const content = data.choices[0]?.message?.content || '{}';
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
          console.error('Zhipu API error after max retries:', error);
          throw error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Zhipu API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
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
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Zhipu health check failed:', error);
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