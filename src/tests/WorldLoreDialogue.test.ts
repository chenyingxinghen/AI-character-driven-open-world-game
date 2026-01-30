import { DomainCoordinator, GameContext } from '../domains/DomainCoordinator';
import { MockLLMService } from '../services/llm/LLMService';
import { MockDatabaseService, CharacterRecord } from '../services/database/DatabaseService';
import { Logger } from '../services/Logger';
import { GameContextService } from '../services/game/GameContextService';
import { WorldLoreService } from '../services/world/WorldLoreService';
import { InputType, IntentType, EmotionalTone, UrgencyLevel } from '../domains/input/valueObjects';

// Mock logger implementation
class MockLogger {
    debug(message: string, meta?: any): void { }
    info(message: string, meta?: any): void { }
    warn(message: string, meta?: any): void { }
    error(message: string, error?: Error, meta?: any): void { }
}

describe('World Lore Integration in Dialogue', () => {
    let coordinator: DomainCoordinator;
    let mockLLMService: MockLLMService;
    let mockDatabaseService: MockDatabaseService;
    let mockGameContextService: GameContextService;
    let mockWorldLoreService: WorldLoreService;
    let mockLogger: any;

    beforeEach(() => {
        mockLLMService = new MockLLMService();
        mockDatabaseService = new MockDatabaseService();
        mockLogger = new MockLogger();
        mockWorldLoreService = new WorldLoreService(mockLLMService, mockDatabaseService as any, mockLogger);
        mockGameContextService = new GameContextService(mockDatabaseService as any, mockLogger, mockWorldLoreService);

        coordinator = new DomainCoordinator(
            mockLLMService,
            mockLogger,
            mockGameContextService,
            mockDatabaseService,
            mockWorldLoreService
        );
    });

    it('should include world lore in the response prompt', async () => {
        const sessionId = 'test-session-lore';
        const playerId = 'test-player';
        const characterName = 'Sentinel';
        const characterId = 'sentinel-id';
        const warLore = 'The Crimson War is spreading across the Eastern Plains. The capital is under siege.';

        // 1. Setup mock database with a character
        const mockCharacter: CharacterRecord = {
            id: characterId,
            session_id: sessionId,
            name: characterName,
            personality: { traits: ['serious', 'watchful'] },
            background: 'A guardian of the gates.',
            current_location: 'gate_tower',
            emotional_state: { mood: 'tense', intensity: 70 },
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
        };

        jest.spyOn(mockDatabaseService, 'getSessionCharacters').mockResolvedValue([mockCharacter]);
        jest.spyOn(mockDatabaseService, 'getCharacter').mockResolvedValue(mockCharacter);

        // Mock world lore
        jest.spyOn(mockDatabaseService, 'getWorldLoreBySession').mockResolvedValue([{
            id: 'lore-1',
            session_id: sessionId,
            lore_type: 'main_story',
            title: 'The Crimson War',
            content: warLore,
            created_at: new Date(),
            updated_at: new Date()
        }]);

        // 2. Setup mock LLM for intent analysis
        jest.spyOn(mockLLMService, 'generateStructuredResponse').mockResolvedValue({
            type: InputType.SPEECH,
            intent: IntentType.DIALOGUE,
            confidence: 95,
            targetCharacter: characterName,
            isDirectSpeech: true,
            isActionDescription: false,
            isSystemQuery: false,
            isCompoundAction: false,
            extractedSpeech: 'How is the situation at the front?',
            urgency: UrgencyLevel.HIGH,
            emotionalTone: EmotionalTone.NEUTRAL,
            contextualHints: ['dialogue']
        });

        // 3. Spy on prompt generation
        const generateTextSpy = jest.spyOn(mockLLMService, 'generateText').mockResolvedValue('The war is closer than we think.');

        const gameContext: GameContext = {
            sessionId,
            playerId,
            currentLocation: 'gate_tower',
            activeCharacters: [characterId],
            gameState: {},
            timestamp: new Date(),
            worldLore: warLore
        };

        // 4. Run the process
        const result = await coordinator.processPlayerInput(
            sessionId,
            playerId,
            'Ask about the front',
            gameContext
        );

        // 5. Assertions
        expect(result.success).toBe(true);
        expect(generateTextSpy).toHaveBeenCalled();

        const prompt = generateTextSpy.mock.calls[0][0];
        // Verify the prompt contains the world lore content
        expect(prompt).toContain(warLore);

        // Check for some character info keys (using common substrings to avoid encoding issues if possible)
        expect(prompt).toContain('Sentinel');
        expect(prompt).toContain('guardian of the gates');

        expect(result.responses.characterResponses?.[0].content).toBe('The war is closer than we think.');
    });
});
