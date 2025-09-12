import { CharacterService } from '../services/character/CharacterService';
import { MockLLMService } from '../services/llm/LLMService';
import { Logger } from '../services/Logger';
import { MockDatabaseService } from '../services/database/DatabaseService';

export interface GameState {
  sessionId: string;
  currentPlayerId: string;
  currentScene: string;
  tensionLevel: number;
  storyProgress: {
    currentChapter: number;
    completedEvents: string[];
    keyChoicesMade: string[];
  };
  activeCharacters: string[];
  connectedPlayers: string[];
  isMultiplayer: boolean;
  gameVariables: Record<string, any>;
}

export class GameStateEngine {
  private characterService: CharacterService;
  private gameState: GameState;

  constructor(sessionId: string) {
    this.characterService = new CharacterService(
      new MockLLMService(),
      new Logger(),
      new MockDatabaseService()
    );
    this.gameState = {
      sessionId,
      currentPlayerId: 'player1',
      currentScene: 'town_square',
      tensionLevel: 50,
      storyProgress: {
        currentChapter: 1,
        completedEvents: [],
        keyChoicesMade: []
      },
      activeCharacters: ['thomas', 'elena', 'marcus', 'sophia'],
      connectedPlayers: ['player1'],
      isMultiplayer: false,
      gameVariables: {}
    };
  }

  getGameState(): GameState {
    return { ...this.gameState };
  }

  updateGameState(newState: Partial<GameState>): void {
    this.gameState = { ...this.gameState, ...newState };
  }

  updateTensionLevel(newLevel: number): void {
    this.gameState.tensionLevel = Math.max(0, Math.min(100, newLevel));
  }

  addCompletedEvent(eventId: string): void {
    if (!this.gameState.storyProgress.completedEvents.includes(eventId)) {
      this.gameState.storyProgress.completedEvents.push(eventId);
    }
  }

  addKeyChoice(choiceId: string): void {
    if (!this.gameState.storyProgress.keyChoicesMade.includes(choiceId)) {
      this.gameState.storyProgress.keyChoicesMade.push(choiceId);
    }
  }

  setGameVariable(key: string, value: any): void {
    this.gameState.gameVariables[key] = value;
  }

  getGameVariable(key: string): any {
    return this.gameState.gameVariables[key];
  }

  addActiveCharacter(characterId: string): void {
    if (!this.gameState.activeCharacters.includes(characterId)) {
      this.gameState.activeCharacters.push(characterId);
    }
  }

  removeActiveCharacter(characterId: string): void {
    this.gameState.activeCharacters = this.gameState.activeCharacters.filter(id => id !== characterId);
  }
}