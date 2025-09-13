import { InputManager } from '../domains/input/aggregates';
import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';
import { InputClassification, IntentType, EmotionalTone, UrgencyLevel } from '../domains/input/valueObjects';

export class GameInputEngine {
  private inputManager: InputManager;
  
  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {
    this.inputManager = new InputManager(llmService, logger);
  }

  async classify(input: string): Promise<any> {
    try {
      const result = await this.inputManager.analyzeInput(
        'temp-session',
        'temp-player', 
        input
      );
      return result.classification;
    } catch (error) {
      this.logger.error('Input classification failed:', error as Error);
      return {
        intent: 'unknown',
        confidence: 0,
        entities: [],
        emotionalTone: 'neutral',
        complexity: 1
      };
    }
  }
  
  async classifyInput(input: string, context: any): Promise<InputClassification> {
    try {
      const result = await this.inputManager.analyzeInput(
        context.sessionId || 'temp',
        'temp-player',
        input,
        {
          currentLocation: context.currentLocation,
          knownCharacters: context.nearbyCharacters,
          recentEvents: context.pendingActions
        }
      );
      return result.classification;
    } catch (error) {
      this.logger.error('Input classification with context failed:', error as Error);
      return {
        intent: IntentType.UNKNOWN,
        confidence: 0,
        entities: [],
        emotionalTone: EmotionalTone.NEUTRAL,
        complexity: 1,
        urgency: UrgencyLevel.MEDIUM,
        contextualInfo: {
          mentionedCharacters: [],
          mentionedLocations: [],
          actionSequence: [],
          timeReferences: [],
          emotionalIndicators: ['neutral'],
          complexityFactors: []
        }
      };
    }
  }

  async analyzeComplexScenario(input: string, context: any): Promise<any> {
    try {
      const result = await this.inputManager.analyzeInput(
        'temp-session',
        'temp-player',
        input
      );
      return result.complexAnalysis;
    } catch (error) {
      this.logger.error('Complex scenario analysis failed:', error as Error);
      return null;
    }
  }

  async preprocessInput(input: string): Promise<string> {
    // Simple preprocessing - just return cleaned input
    return input.trim();
  }
}