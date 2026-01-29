import { DomainCoordinator } from '../domains/DomainCoordinator';
import { MockDatabaseService } from '../services/database/DatabaseService';
import { Logger } from '../services/Logger';
import { GameContextService } from '../services/game/GameContextService';
import { v4 as uuidv4 } from 'uuid';

// Mock LLM service
const mockLLMService = {
  generateText: jest.fn().mockResolvedValue('Mock response'),
  generateStructuredOutput: jest.fn().mockResolvedValue({}),
  getMaxTokens: jest.fn().mockReturnValue(4096),
  getModelName: jest.fn().mockReturnValue('mock-model')
};

// Mock WorldLoreService
const mockWorldLoreService = {
  generateWorldLoreForSession: jest.fn().mockResolvedValue([]),
  getWorldLoreForSession: jest.fn().mockResolvedValue([]),
  getLoreByQuery: jest.fn().mockResolvedValue(''),
  hasWorldLore: jest.fn().mockResolvedValue(false)
};

describe('Location Movement Integration', () => {
  let domainCoordinator: DomainCoordinator;
  let mockDatabaseService: MockDatabaseService;
  let mockLogger: Logger;
  let mockGameContextService: GameContextService;

  beforeEach(() => {
    mockDatabaseService = new MockDatabaseService();
    mockLogger = new Logger();
    mockGameContextService = new GameContextService(mockDatabaseService, mockLogger);
    
    // Mock the database service methods we need
    mockDatabaseService.getSession = jest.fn().mockImplementation(async (sessionId: string) => {
      return {
        id: sessionId,
        current_location: 'town_square',
        game_state: {}
      };
    });
    
    mockDatabaseService.updateSession = jest.fn().mockResolvedValue(undefined);
    mockDatabaseService.getConversationHistory = jest.fn().mockResolvedValue([]);
    mockDatabaseService.getGameState = jest.fn().mockResolvedValue({
      timeOfDay: 'afternoon',
      weather: 'sunny',
      atmosphere: 'peaceful'
    });
    mockDatabaseService.getPlayerPreferences = jest.fn().mockResolvedValue({
      language: 'zh',
      difficulty: 'normal',
      narrativeStyle: 'immersive'
    });

    domainCoordinator = new DomainCoordinator(
      mockLLMService as any,
      mockLogger,
      mockGameContextService,
      mockDatabaseService,
      mockWorldLoreService as any
    );
  });

  it('should update player location in database after successful movement', async () => {
    const sessionId = uuidv4();
    const playerId = uuidv4();
    
    // Mock game context
    const gameContext = {
      sessionId,
      playerId,
      currentLocation: 'town_square',
      activeCharacters: [],
      gameState: {},
      timestamp: new Date()
    };

    // Mock the world manager's processLocationMovement method
    const mockProcessLocationMovement = jest.fn().mockResolvedValue({
      success: true,
      message: 'Arrived at 魔法森林',
      newLocation: { id: 'magic_forest', name: '魔法森林' },
      travelTime: 5,
      sceneDescription: 'You arrive at 魔法森林. A mystical place filled with ancient trees and magical creatures.'
    });
    
    // Replace the world manager's method with our mock
    (domainCoordinator as any).worldManager.processLocationMovement = mockProcessLocationMovement;

    // Mock the input manager's analyzeInput method
    (domainCoordinator as any).inputManager.analyzeInput = jest.fn().mockResolvedValue({
      classification: {
        intent: 'movement',
        confidence: 95,
        emotionalTone: 'neutral',
        targetLocation: '魔法森林'
      },
      complexAnalysis: { isComplex: false }
    });

    // Process the movement input
    const result = await domainCoordinator.processPlayerInput(
      sessionId,
      playerId,
      '我前往魔法森林',
      gameContext
    );

    // Verify the movement was processed successfully
    expect(result.success).toBe(true);
    expect(result.stateChanges.locationChange).toBe('魔法森林');
    
    // Verify that the database update method was called with the correct parameters
    expect(mockDatabaseService.updateSession).toHaveBeenCalledWith(
      sessionId,
      expect.objectContaining({
        current_location: '魔法森林'
      })
    );
  });

  it('should correctly retrieve updated location from database', async () => {
    const sessionId = uuidv4();
    const playerId = uuidv4();
    
    // First, simulate a successful movement
    const gameContext = {
      sessionId,
      playerId,
      currentLocation: 'town_square',
      activeCharacters: [],
      gameState: {},
      timestamp: new Date()
    };

    // Mock the world manager's processLocationMovement method
    (domainCoordinator as any).worldManager.processLocationMovement = jest.fn().mockResolvedValue({
      success: true,
      message: 'Arrived at 魔法森林',
      newLocation: { id: 'magic_forest', name: '魔法森林' },
      travelTime: 5,
      sceneDescription: 'You arrive at 魔法森林. A mystical place filled with ancient trees and magical creatures.'
    });

    // Mock the input manager's analyzeInput method
    (domainCoordinator as any).inputManager.analyzeInput = jest.fn().mockResolvedValue({
      classification: {
        intent: 'movement',
        confidence: 95,
        emotionalTone: 'neutral',
        targetLocation: '魔法森林'
      },
      complexAnalysis: { isComplex: false }
    });

    // Process the movement input
    await domainCoordinator.processPlayerInput(
      sessionId,
      playerId,
      '我前往魔法森林',
      gameContext
    );

    // Now simulate a subsequent request that should use the updated location
    const updatedGameContext = {
      sessionId,
      playerId,
      currentLocation: '魔法森林', // This should be the updated location
      activeCharacters: [],
      gameState: {},
      timestamp: new Date()
    };

    // Mock for exploration request
    (domainCoordinator as any).inputManager.analyzeInput = jest.fn().mockResolvedValue({
      classification: {
        intent: 'exploration',
        confidence: 95,
        emotionalTone: 'neutral'
      },
      complexAnalysis: { isComplex: false }
    });

    // Mock the world manager's getLocationContext method to simulate it working with the new location
    (domainCoordinator as any).worldManager.getLocationContext = jest.fn().mockResolvedValue({
      location: { id: 'magic_forest', name: '魔法森林' },
      scene: {
        generateFullDescription: () => 'You are in a magical forest with glowing trees and mystical creatures.'
      },
      recentEvents: [],
      nearbyLocations: [],
      currentTime: { hour: 12, minute: 0, day: 1, season: 'spring' }
    });

    // Process an exploration request
    const explorationResult = await domainCoordinator.processPlayerInput(
      sessionId,
      playerId,
      '我想仔细观察一下周围的环境',
      updatedGameContext
    );

    // Verify the exploration was processed successfully
    expect(explorationResult.success).toBe(true);
    expect(explorationResult.responses.locationDescription).toContain('魔法森林');
    expect(explorationResult.responses.narrative).toBeDefined();
  });
});