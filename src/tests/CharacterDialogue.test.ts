import { DomainCoordinator, GameContext } from '../domains/DomainCoordinator';
import { MockLLMService } from '../services/llm/LLMService';
import { MockDatabaseService, CharacterRecord } from '../services/database/DatabaseService';
import { Logger } from '../services/Logger';
import { GameContextService } from '../services/game/GameContextService';
import { InputType, IntentType, EmotionalTone, UrgencyLevel } from '../domains/input/valueObjects';

// Mock logger implementation
class MockLogger {
    debug(message: string, meta?: any): void { }
    info(message: string, meta?: any): void { }
    warn(message: string, meta?: any): void { }
    error(message: string, error?: Error, meta?: any): void { }
}

describe('Character Dialogue Delivery', () => {
    let coordinator: DomainCoordinator;
    let mockLLMService: MockLLMService;
    let mockDatabaseService: MockDatabaseService;
    let mockGameContextService: GameContextService;
    let mockLogger: any;

    beforeEach(() => {
        mockLLMService = new MockLLMService();
        mockDatabaseService = new MockDatabaseService();
        mockLogger = new MockLogger();
        mockGameContextService = new GameContextService(mockDatabaseService as any, mockLogger);

        coordinator = new DomainCoordinator(
            mockLLMService,
            mockLogger,
            mockGameContextService,
            mockDatabaseService
        );
    });

    it('should resolve character by name when ID lookup fails', async () => {
        const sessionId = 'test-session';
        const playerId = 'test-player';
        const characterName = 'Old Man';
        const characterId = 'unique-old-man-id';

        // 1. Setup mock database with a character
        const mockCharacter: CharacterRecord = {
            id: characterId,
            session_id: sessionId,
            name: characterName,
            personality: { traits: ['wise'] },
            background: 'A wise old man.',
            current_location: 'town_square',
            emotional_state: { mood: 'neutral', intensity: 50 },
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
        };

        jest.spyOn(mockDatabaseService, 'getSessionCharacters').mockResolvedValue([mockCharacter]);
        jest.spyOn(mockDatabaseService, 'getCharacter').mockResolvedValue(null); // ID lookup fails

        // 2. Setup mock LLM for intent analysis
        // The input analyzer uses UnifiedInputClassificationService which uses generateStructuredResponse
        jest.spyOn(mockLLMService, 'generateStructuredResponse').mockResolvedValue({
            type: InputType.SPEECH,
            intent: IntentType.DIALOGUE,
            confidence: 90,
            targetCharacter: characterName, // Input is directed to "Old Man"
            isDirectSpeech: true,
            isActionDescription: false,
            isSystemQuery: false,
            isCompoundAction: false,
            extractedSpeech: 'Hello there!',
            urgency: UrgencyLevel.MEDIUM,
            emotionalTone: EmotionalTone.NEUTRAL,
            contextualHints: ['dialogue']
        });

        // 3. Setup mock LLM for character response
        jest.spyOn(mockLLMService, 'generateText').mockResolvedValue('Welcome to our town, young traveler.');

        const gameContext: GameContext = {
            sessionId,
            playerId,
            currentLocation: 'town_square',
            activeCharacters: [characterId],
            gameState: {},
            timestamp: new Date()
        };

        // 4. Run the process
        const result = await coordinator.processPlayerInput(
            sessionId,
            playerId,
            `Talk to ${characterName}`,
            gameContext
        );

        // 5. Assertions
        expect(result.success).toBe(true);
        expect(result.responses.characterResponses).toBeDefined();
        expect(result.responses.characterResponses?.length).toBe(1);
        expect(result.responses.characterResponses?.[0].characterName).toBe(characterName);
        expect(result.responses.characterResponses?.[0].content).toBe('Welcome to our town, young traveler.');
        expect(result.responses.characterResponses?.[0].characterId).toBe(characterId);
    });
});
