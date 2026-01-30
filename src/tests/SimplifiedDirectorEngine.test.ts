import { SimplifiedDirectorEngine } from '../engine/SimplifiedDirectorEngine';
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

describe('SimplifiedDirectorEngine', () => {
  let directorEngine: SimplifiedDirectorEngine;
  let mockLLMService: MockLLMService;
  let mockDatabaseService: MockDatabaseService;
  let mockLogger: any;

  beforeEach(() => {
    mockLLMService = new MockLLMService();
    mockDatabaseService = new MockDatabaseService();
    mockLogger = new MockLogger();
    directorEngine = new SimplifiedDirectorEngine(mockLLMService, mockDatabaseService, mockLogger);
  });

  describe('evaluateStoryProgression', () => {
    it('should not intervene when LLM returns no intervention', async () => {
      // Mock LLM to return no intervention
      jest.spyOn(mockLLMService, 'generateStructuredResponse').mockResolvedValue({
        shouldIntervene: false,
        stagnationLevel: 10,
        conflictEvaluation: {
          currentTension: 20,
          primaryConflict: 'None'
        }
      });

      const context = {
        sessionId: 'test-session',
        playerId: 'test-player',
        currentLocation: 'town_square',
        recentActions: ['look around', 'talk to guard'],
        storyState: { act: 1, completedPoints: [] },
        characterStates: { guard: { mood: 'friendly' } },
        currentTime: new Date()
      };

      const result = await directorEngine.evaluateStoryProgression(context);
      expect(result.shouldIntervene).toBe(false);
      expect(result.stagnationLevel).toBe(10);
    });

    it('should intervene when LLM returns intervention decision', async () => {
      // Mock LLM to return intervention decision
      jest.spyOn(mockLLMService, 'generateStructuredResponse').mockResolvedValue({
        shouldIntervene: true,
        stagnationLevel: 85,
        conflictEvaluation: {
          currentTension: 30,
          primaryConflict: 'Stagnation'
        },
        intervention: {
          type: 'character_introduction',
          content: 'Introduce a new character to spice things up',
          characterParams: {
            name: 'Mysterious Stranger',
            role: 'guide',
            appearance: 'Cloaked figure',
            personalityHint: 'Helpful but cryptic'
          }
        }
      });

      const context = {
        sessionId: 'test-session',
        playerId: 'test-player',
        currentLocation: 'forest',
        recentActions: ['wander', 'look for path'],
        storyState: { act: 1, completedPoints: [] },
        characterStates: { player: { mood: 'confused' } },
        currentTime: new Date()
      };

      const result = await directorEngine.evaluateStoryProgression(context);

      expect(result.shouldIntervene).toBe(true);
      expect(result.decision).toBeDefined();
      expect(result.decision?.interventionType).toBe('character_introduction');
      expect(result.decision?.characterParams).toBeDefined();
      expect(result.decision?.characterParams.name).toBe('Mysterious Stranger');
      expect(result.stagnationLevel).toBe(85);
    });
  });

  describe('executeIntervention', () => {
    it('should store intervention event in database', async () => {
      // Mock database storeStoryEvent
      const storeStoryEventSpy = jest.spyOn(mockDatabaseService, 'storeStoryEvent').mockResolvedValue();

      const decision = {
        shouldIntervene: true,
        interventionType: 'event_generation',
        content: 'Generate a mysterious sound to guide the player',
        effectiveness: 75,
        parameters: { soundType: 'whispering' }
      };

      const context = {
        sessionId: 'test-session',
        playerId: 'test-player',
        currentLocation: 'dark_cave',
        recentActions: ['enter cave', 'light torch'],
        storyState: { act: 2, completedPoints: ['find_cave_entrance'] },
        characterStates: { player: { fear_level: 0.6 } },
        currentTime: new Date()
      };

      const result = await directorEngine.executeIntervention(decision, context);

      expect(result.success).toBe(true);
      expect(storeStoryEventSpy).toHaveBeenCalled();

      // Verify the stored event has the correct structure
      const callArgs = storeStoryEventSpy.mock.calls[0][0];
      expect(callArgs.session_id).toBe('test-session');
      expect(callArgs.event_type).toBe('director_intervention');
      expect(callArgs.description).toContain('event_generation');
      expect(callArgs.location).toBe('dark_cave');
      expect(callArgs.story_data.interventionType).toBe('event_generation');
      expect(callArgs.story_data.content).toBe('Generate a mysterious sound to guide the player');
    });
  });
});