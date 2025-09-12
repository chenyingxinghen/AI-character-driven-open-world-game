import { CharacterMemoryService, MemoryRecord, EmotionalState } from '../services/character/CharacterMemoryService';
import { describe, it, beforeEach, expect } from '@jest/globals';

describe('CharacterMemoryService', () => {
  let memoryService: CharacterMemoryService;
  let testMemory: MemoryRecord;
  let testCharacterId: string;

  beforeEach(() => {
    memoryService = new CharacterMemoryService();
    testCharacterId = 'character-1';
    
    testMemory = {
      id: 'memory-1',
      characterId: testCharacterId,
      sessionId: 'session-1',
      content: 'Test memory content',
      emotionalWeight: 0.8,
      associatedCharacters: ['character-2'],
      tags: ['test', 'memory'],
      memoryType: 'dialogue',
      significance: 8,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 0
    };
  });

  describe('storeMemory', () => {
    it('should store a memory record', () => {
      memoryService.storeMemory(testMemory);
      
      const memories = memoryService.getCharacterMemories(testCharacterId, 'session-1');
      expect(memories).toHaveLength(1);
      expect(memories[0]).toEqual(testMemory);
    });
  });

  describe('getCharacterMemories', () => {
    it('should retrieve character memories for a session', () => {
      memoryService.storeMemory(testMemory);
      
      const memories = memoryService.getCharacterMemories(testCharacterId, 'session-1');
      expect(memories).toHaveLength(1);
      expect(memories[0].characterId).toBe(testCharacterId);
      expect(memories[0].sessionId).toBe('session-1');
    });

    it('should limit the number of returned memories', () => {
      // Store multiple memories
      for (let i = 0; i < 10; i++) {
        const memory: MemoryRecord = {
          ...testMemory,
          id: `memory-${i}`,
          significance: i
        };
        memoryService.storeMemory(memory);
      }
      
      const memories = memoryService.getCharacterMemories(testCharacterId, 'session-1', 5);
      expect(memories).toHaveLength(5);
    });
  });

  describe('searchMemoriesByTags', () => {
    it('should search memories by tags', () => {
      memoryService.storeMemory(testMemory);
      
      const results = memoryService.searchMemoriesByTags(testCharacterId, ['test']);
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('test');
    });

    it('should return empty array when no matching tags', () => {
      memoryService.storeMemory(testMemory);
      
      const results = memoryService.searchMemoriesByTags(testCharacterId, ['nonexistent']);
      expect(results).toHaveLength(0);
    });
  });

  describe('searchMemoriesByContent', () => {
    it('should search memories by content', () => {
      memoryService.storeMemory(testMemory);
      
      const results = memoryService.searchMemoriesByContent(testCharacterId, 'Test memory');
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('Test memory');
    });

    it('should perform case-insensitive search', () => {
      memoryService.storeMemory(testMemory);
      
      const results = memoryService.searchMemoriesByContent(testCharacterId, 'test MEMORY');
      expect(results).toHaveLength(1);
    });
  });

  describe('getEmotionalState', () => {
    it('should return default emotional state when none set', () => {
      const emotionalState = memoryService.getEmotionalState(testCharacterId);
      
      expect(emotionalState).toEqual({
        mood: 'neutral',
        intensity: 50,
        stability: 70,
        triggers: []
      });
    });

    it('should return updated emotional state', () => {
      const updatedEmotionalState: Partial<EmotionalState> = {
        mood: 'happy',
        intensity: 80
      };
      
      memoryService.updateEmotionalState(testCharacterId, updatedEmotionalState);
      const emotionalState = memoryService.getEmotionalState(testCharacterId);
      
      expect(emotionalState.mood).toBe('happy');
      expect(emotionalState.intensity).toBe(80);
    });
  });

  describe('updateEmotionalState', () => {
    it('should update emotional state', () => {
      const update: Partial<EmotionalState> = {
        mood: 'sad',
        intensity: 30,
        stability: 60
      };
      
      memoryService.updateEmotionalState(testCharacterId, update);
      const emotionalState = memoryService.getEmotionalState(testCharacterId);
      
      expect(emotionalState).toEqual({
        mood: 'sad',
        intensity: 30,
        stability: 60,
        triggers: []
      });
    });

    it('should constrain emotional values to valid ranges', () => {
      const update: Partial<EmotionalState> = {
        intensity: 150, // Should be capped at 100
        stability: -20  // Should be capped at 0
      };
      
      memoryService.updateEmotionalState(testCharacterId, update);
      const emotionalState = memoryService.getEmotionalState(testCharacterId);
      
      expect(emotionalState.intensity).toBe(100);
      expect(emotionalState.stability).toBe(0);
    });
  });

  describe('updateEmotionalStateFromEvent', () => {
    it('should update emotional state based on positive interaction', () => {
      const event = { type: 'positive_interaction' };
      
      memoryService.updateEmotionalStateFromEvent(testCharacterId, event);
      const emotionalState = memoryService.getEmotionalState(testCharacterId);
      
      expect(emotionalState.mood).toBe('happy');
      expect(emotionalState.intensity).toBeGreaterThanOrEqual(50);
    });

    it('should update emotional state based on negative interaction', () => {
      const event = { type: 'negative_interaction' };
      
      memoryService.updateEmotionalStateFromEvent(testCharacterId, event);
      const emotionalState = memoryService.getEmotionalState(testCharacterId);
      
      expect(emotionalState.mood).toBe('sad');
      expect(emotionalState.intensity).toBeGreaterThanOrEqual(50);
    });

    it('should update emotional state based on surprise', () => {
      const event = { type: 'surprise' };
      
      memoryService.updateEmotionalStateFromEvent(testCharacterId, event);
      const emotionalState = memoryService.getEmotionalState(testCharacterId);
      
      expect(emotionalState.mood).toBe('surprised');
      expect(emotionalState.intensity).toBeGreaterThanOrEqual(50);
    });

    it('should update emotional state based on threat', () => {
      const event = { type: 'threat' };
      
      memoryService.updateEmotionalStateFromEvent(testCharacterId, event);
      const emotionalState = memoryService.getEmotionalState(testCharacterId);
      
      expect(emotionalState.mood).toBe('fearful');
      expect(emotionalState.intensity).toBeGreaterThanOrEqual(50);
    });
  });

  describe('getRelevantMemories', () => {
    it('should return relevant memories based on context', () => {
      // Store multiple memories with different tags and significance
      const memory1: MemoryRecord = {
        ...testMemory,
        id: 'memory-1',
        tags: ['important', 'quest'],
        significance: 9 // Higher significance for important memory
      };
      
      const memory2: MemoryRecord = {
        ...testMemory,
        id: 'memory-2',
        tags: ['trivial', 'conversation'],
        significance: 3 // Lower significance for trivial memory
      };
      
      memoryService.storeMemory(memory1);
      memoryService.storeMemory(memory2);
      
      const context = { tags: ['important'] };
      const relevantMemories = memoryService.getRelevantMemories(testCharacterId, context, 5);
      
      // Should return memories sorted by relevance, with the important one first
      expect(relevantMemories.length).toBeGreaterThanOrEqual(1);
      expect(relevantMemories[0].tags).toContain('important');
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics', () => {
      memoryService.storeMemory(testMemory);
      
      const stats = memoryService.getMemoryStats(testCharacterId);
      
      expect(stats.totalMemories).toBe(1);
      expect(stats.memoryTypes.dialogue).toBe(1);
      expect(stats.averageSignificance).toBe(8);
      expect(stats.mostAccessedMemory).toEqual(testMemory);
    });
  });
});