import { SimplifiedDirectorService } from '../services/gameMode/SimplifiedDirectorService';
import { MockLLMService } from '../services/llm/LLMService';
import { MockDatabaseService } from '../services/database/DatabaseService';
import { Logger } from '../services/Logger';

// Mock logger implementation
class MockLogger {
  debug(message: string, meta?: any): void {
    console.log(`[DEBUG] ${message}`, meta);
  }
  
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta);
  }
  
  warn(message: string, meta?: any): void {
    console.log(`[WARN] ${message}`, meta);
  }
  
  error(message: string, error?: Error, meta?: any): void {
    console.log(`[ERROR] ${message}`, error, meta);
  }
}

describe('SimplifiedDirectorService', () => {
  let directorService: SimplifiedDirectorService;
  let mockLLMService: MockLLMService;
  let mockDatabaseService: MockDatabaseService;
  let mockLogger: any;

  beforeEach(() => {
    mockLLMService = new MockLLMService();
    mockDatabaseService = new MockDatabaseService();
    mockLogger = new MockLogger();
    directorService = new SimplifiedDirectorService(mockLLMService, mockDatabaseService, mockLogger);
  });

  describe('evaluateAndIntervene', () => {
    it('should not intervene when LLM returns no intervention', async () => {
      // Mock LLM to return no intervention
      jest.spyOn(mockLLMService, 'generateText').mockResolvedValue(`
=== DIRECTOR_DECISION ===
ACTION: no_intervention
REASONING: Current story progression is fine
CONFIDENCE: 0.9
PARAMETERS: {}
=== END_DECISION ===
      `);

      const context = {
        sessionId: 'test-session',
        playerId: 'test-player',
        currentLocation: 'town_square',
        recentActions: ['look around', 'talk to guard'],
        storyState: { act: 1, completedPoints: [] },
        characterStates: { guard: { mood: 'friendly' } }
      };

      const result = await directorService.evaluateAndIntervene(context);
      expect(result).toBeNull();
    });

    it('should intervene when LLM returns intervention decision', async () => {
      // Mock LLM to return intervention decision
      jest.spyOn(mockLLMService, 'generateText').mockResolvedValue(`
=== DIRECTOR_DECISION ===
ACTION: dialogue_guidance
REASONING: Player seems lost, provide guidance
CONFIDENCE: 0.85
PARAMETERS: {interventionType: "dialogue_guidance"}
=== END_DECISION ===
      `);

      // Mock database storeStoryEvent
      const storeStoryEventSpy = jest.spyOn(mockDatabaseService, 'storeStoryEvent').mockResolvedValue();

      const context = {
        sessionId: 'test-session',
        playerId: 'test-player',
        currentLocation: 'forest',
        recentActions: ['wander', 'look for path'],
        storyState: { act: 1, completedPoints: [] },
        characterStates: { player: { mood: 'confused' } }
      };

      const result = await directorService.evaluateAndIntervene(context);
      
      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe('test-session');
      expect(result?.interventionType).toBe('dialogue_guidance');
      expect(storeStoryEventSpy).toHaveBeenCalled();
    });

    it('should handle LLM service errors gracefully', async () => {
      // Mock LLM to throw an error
      jest.spyOn(mockLLMService, 'generateText').mockRejectedValue(new Error('LLM service unavailable'));

      const context = {
        sessionId: 'test-session',
        playerId: 'test-player',
        currentLocation: 'town_square',
        recentActions: ['look around'],
        storyState: { act: 1, completedPoints: [] },
        characterStates: {}
      };

      const result = await directorService.evaluateAndIntervene(context);
      expect(result).toBeNull();
    });
  });
});