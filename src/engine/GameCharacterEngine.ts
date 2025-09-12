import { CharacterManager } from '../domains/character/aggregates';
import { DatabaseService } from '../services/database/DatabaseService';
import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';

export interface CharacterResponse {
  content: string;
  emotion: string;
  action?: string;
  metadata?: any;
}

export class GameCharacterEngine {
  private characterManager: CharacterManager;
  
  constructor(
    private databaseService: DatabaseService,
    private llmService: LLMService,
    private logger: Logger
  ) {
    this.characterManager = new CharacterManager(llmService, logger);
  }

  async getCharacterResponse(id: string, input: string, sessionId: string): Promise<CharacterResponse> {
    try {
      // Create character profile for getting or creating character
      const characterProfile = {
        id,
        name: `Character_${id}`,
        appearance: 'A typical character in the game world',
        personality: {
          traits: { friendly: 0.7, helpful: 0.8 },
          values: { honesty: 0.8 },
          goals: ['assist player'],
          fears: ['failure'],
          motivations: ['helpfulness']
        },
        background: `A character with ID ${id}`
      };
      
      // Create or get character using domain manager
      let character = this.characterManager.createCharacter(characterProfile);
      
      // Try to load from database and update if needed
      try {
        const characterData = await this.databaseService.getCharacter(id, sessionId);
        if (characterData) {
          // Update character with database data
          const updatedProfile = {
            ...characterProfile,
            name: characterData.name,
            appearance: 'A character from the database',
            personality: {
              traits: JSON.parse(characterData.personality || '{}').traits || { neutral: 0.5 },
              values: JSON.parse(characterData.personality || '{}').values || {},
              goals: JSON.parse(characterData.personality || '{}').goals || [],
              fears: JSON.parse(characterData.personality || '{}').fears || [],
              motivations: JSON.parse(characterData.personality || '{}').motivations || []
            },
            background: characterData.background || characterProfile.background
          };
          character = this.characterManager.createCharacter(updatedProfile);
        }
      } catch (dbError) {
        this.logger.warn(`Could not load character ${id} from database`);
      }
      
      // Generate response using character domain
      const response = await this.characterManager.generateCharacterResponse(
        character,
        { input, sessionId, context: 'dialogue' }
      );
      
      return {
        content: response,
        emotion: character.getEmotionalState().mood,
        metadata: {
          characterId: id,
          sessionId,
          timestamp: new Date()
        }
      };
    } catch (error) {
      this.logger.error(`Error generating character response for ${id}:`, error as Error);
      return {
        content: "I'm not sure how to respond to that right now.",
        emotion: 'confused'
      };
    }
  }

  async updateCharacterState(id: string, stateUpdate: any): Promise<void> {
    // For this simplified implementation, we'll log the update
    // In a full implementation, you'd need to track characters and update their states
    this.logger.info(`Character ${id} state update requested`);
  }

  async getCharacterInfo(id: string): Promise<any> {
    // For this simplified implementation, return basic info
    // In a full implementation, you'd retrieve the actual character
    return {
      id,
      name: `Character_${id}`,
      personality: { traits: ['friendly', 'helpful'] },
      emotionalState: { mood: 'neutral' },
      location: 'town_square'
    };
  }
}