import { LLMProviderAdapter, LLMCharacterResponse, DirectorDecision, RateLimitStatus, LLMProvider } from '../types/LLMTypes';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeout?: number;
}

export class OllamaProvider implements LLMProviderAdapter {
  private config: OllamaConfig;
  private rateLimit: RateLimitStatus;

  constructor(config: OllamaConfig) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.model,
      timeout: config.timeout || 30000
    };

    this.rateLimit = {
      requestsRemaining: 10000, // Local model, high limit
      resetTime: new Date(Date.now() + 60000),
      currentUsage: 0,
      provider: LLMProvider.LOCAL
    };
  }

  async generateText(prompt: string, options?: { maxTokens?: number; temperature?: number; jsonMode?: boolean; systemPrompt?: string }): Promise<string> {
    const maxRetries = 3;
    let lastError: any;

    // Construct the full prompt with system prompt if provided
    let fullPrompt = prompt;
    if (options?.systemPrompt) {
      fullPrompt = `${options.systemPrompt}\n\n${prompt}`;
    }

    // Add JSON formatting instruction if jsonMode is enabled
    if (options?.jsonMode) {
      fullPrompt = `${fullPrompt}\n\nPlease respond with valid JSON only.`;
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const requestBody: any = {
          model: this.config.model,
          prompt: fullPrompt,
          stream: false,
          options: {
            num_predict: options?.maxTokens || 150,
            temperature: options?.temperature || 0.7
          }
        };

        // Use Ollama's native JSON format if available
        if (options?.jsonMode) {
          requestBody.format = 'json';
        }

        const response = await fetch(`${this.config.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(this.config.timeout!)
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.updateRateLimit(1);

        return data.response || '';
      } catch (error: any) {
        lastError = error;

        if (attempt === maxRetries) {
          console.error('Ollama API error after max retries:', error);
          throw error;
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Ollama API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  async generateCharacterResponse(character: any, context: any, prompt: string): Promise<LLMCharacterResponse> {
    const characterPrompt = `
You are ${character.name}, a character with the following personality: ${JSON.stringify(character.personality)}.
Current emotional state: ${JSON.stringify(character.emotionalState)}.
Context: ${JSON.stringify(context)}
Player says: ${prompt}

Please respond as the character. Format your response as follows:
DIALOGUE: [Your response as the character]
EMOTION_MOOD: [current mood]
EMOTION_INTENSITY: [0-100]
CONFIDENCE: [0.0-1.0]
    `;

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            prompt: characterPrompt,
            stream: false,
            options: {
              num_predict: 300,
              temperature: 0.7
            }
          }),
          signal: AbortSignal.timeout(this.config.timeout!)
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.updateRateLimit(1);

        const content = data.response || '';
        return this.parseCharacterResponse(content);
      } catch (error: any) {
        lastError = error;

        if (attempt === maxRetries) {
          console.error('Ollama API error after max retries:', error);
          return {
            dialogue: "I'm having trouble responding right now.",
            emotionalState: { mood: 'confused', intensity: 50 },
            confidence: 0.3
          };
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Ollama API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      dialogue: "I'm having trouble responding right now.",
      emotionalState: { mood: 'confused', intensity: 50 },
      confidence: 0.3
    };
  }

  async generateDirectorDecision(context: any, evaluation: any): Promise<DirectorDecision> {
    const directorPrompt = `
You are the game director making narrative decisions.
Context: ${JSON.stringify(context)}
Evaluation: ${JSON.stringify(evaluation)}

Analyze the situation and decide on the next narrative action. Format your response as follows:
ACTION: [CONTINUE|ADVANCE_PLOT|INTRODUCE_CONFLICT|etc]
REASONING: [explanation of the decision]
CONFIDENCE: [0.0-1.0]
PARAMETERS: [key1=value1,key2=value2]
    `;

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            prompt: directorPrompt,
            stream: false,
            options: {
              num_predict: 300,
              temperature: 0.5
            }
          }),
          signal: AbortSignal.timeout(this.config.timeout!)
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.updateRateLimit(1);

        const content = data.response || '';
        return this.parseDirectorResponse(content);
      } catch (error: any) {
        lastError = error;

        if (attempt === maxRetries) {
          console.error('Ollama API error after max retries:', error);
          return {
            action: 'CONTINUE',
            reasoning: 'Default action due to processing error',
            confidence: 0.3,
            parameters: {}
          };
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Ollama API error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      action: 'CONTINUE',
      reasoning: 'Default action due to processing error',
      confidence: 0.3,
      parameters: {}
    };
  }

  getRateLimitStatus(): RateLimitStatus {
    return this.rateLimit;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      return response.ok;
    } catch (error) {
      console.error('Ollama health check failed:', error);
      return false;
    }
  }

  getModel(): string {
    return this.config.model;
  }

  private updateRateLimit(usedRequests: number): void {
    this.rateLimit.currentUsage += usedRequests;
    this.rateLimit.requestsRemaining = Math.max(0, this.rateLimit.requestsRemaining - usedRequests);

    // Reset rate limit if past reset time
    if (new Date() > this.rateLimit.resetTime) {
      this.rateLimit.requestsRemaining = 10000;
      this.rateLimit.currentUsage = 0;
      this.rateLimit.resetTime = new Date(Date.now() + 60000);
    }
  }

  private parseCharacterResponse(content: string): LLMCharacterResponse {
    const lines = content.split('\n');
    let dialogue = '';
    let mood = 'neutral';
    let intensity = 50;
    let confidence = 0.8;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('DIALOGUE:')) {
        dialogue = trimmed.substring(9).trim();
      } else if (trimmed.startsWith('EMOTION_MOOD:')) {
        mood = trimmed.substring(13).trim();
      } else if (trimmed.startsWith('EMOTION_INTENSITY:')) {
        intensity = parseInt(trimmed.substring(18).trim()) || 50;
      } else if (trimmed.startsWith('CONFIDENCE:')) {
        confidence = parseFloat(trimmed.substring(11).trim()) || 0.8;
      }
    }

    return {
      dialogue: dialogue || content.trim(),
      emotionalState: { mood, intensity },
      confidence
    };
  }

  private parseDirectorResponse(content: string): DirectorDecision {
    const lines = content.split('\n');
    let action = 'CONTINUE';
    let reasoning = '';
    let confidence = 0.8;
    let parameters: Record<string, any> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('ACTION:')) {
        action = trimmed.substring(7).trim();
      } else if (trimmed.startsWith('REASONING:')) {
        reasoning = trimmed.substring(10).trim();
      } else if (trimmed.startsWith('CONFIDENCE:')) {
        confidence = parseFloat(trimmed.substring(11).trim()) || 0.8;
      } else if (trimmed.startsWith('PARAMETERS:')) {
        const paramStr = trimmed.substring(11).trim();
        const pairs = paramStr.split(',');
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            parameters[key.trim()] = value.trim();
          }
        }
      }
    }

    return {
      action,
      reasoning: reasoning || content.trim(),
      confidence,
      parameters
    };
  }

  // Ollama-specific methods
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  async pullModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: modelName
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to pull Ollama model:', error);
      return false;
    }
  }

  switchModel(modelName: string): void {
    this.config.model = modelName;
  }
}