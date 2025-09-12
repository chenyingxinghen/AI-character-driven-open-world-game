import { StoryProgressionService, StoryEvent, StoryCondition, StoryConsequence } from '../services/game/StoryProgressionService';
import { describe, it, beforeEach, expect } from '@jest/globals';

describe('StoryProgressionService', () => {
  let storyService: StoryProgressionService;
  let testEvent: StoryEvent;

  beforeEach(() => {
    // Create service without default events for testing
    storyService = new StoryProgressionService(false);
    
    testEvent = {
      id: 'event-1',
      type: 'plot_point',
      title: 'Test Event',
      description: 'A test story event',
      triggers: ['test'],
      consequences: [
        {
          type: 'stat_change',
          target: 'character-1',
          value: 10,
          description: 'Increase character stat by 10'
        }
      ],
      requiredConditions: [],
      probability: 1.0,
      priority: 5,
      createdAt: new Date()
    };
  });

  describe('addEvent', () => {
    it('should add a story event', () => {
      storyService.addEvent(testEvent);
      
      // We can't directly access events, but we can test by evaluating triggerable events
      const triggerableEvents = storyService.evaluateTriggerableEvents({
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      expect(triggerableEvents).toHaveLength(1);
      expect(triggerableEvents[0].id).toBe('event-1');
    });
  });

  describe('evaluateTriggerableEvents', () => {
    it('should return events that meet conditions', () => {
      const eventWithConditions: StoryEvent = {
        ...testEvent,
        id: 'event-2',
        requiredConditions: [
          {
            type: 'story_flag',
            target: 'flag1',
            operator: 'eq',
            value: true
          }
        ]
      };
      
      storyService.addEvent(testEvent);
      storyService.addEvent(eventWithConditions);
      
      const context = {
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      };
      const triggerableEvents = storyService.evaluateTriggerableEvents(context);
      
      // Only the event without conditions should be triggerable
      expect(triggerableEvents).toHaveLength(1);
      expect(triggerableEvents[0].id).toBe('event-1');
    });

    it('should exclude completed events', () => {
      storyService.addEvent(testEvent);
      
      // Mark event as completed
      storyService.triggerEvent(testEvent, {
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      
      const triggerableEvents = storyService.evaluateTriggerableEvents({
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      expect(triggerableEvents).toHaveLength(0);
    });
  });

  describe('triggerEvent', () => {
    it('should trigger an event and apply consequences', () => {
      storyService.addEvent(testEvent);
      
      const consequences = storyService.triggerEvent(testEvent, {
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      
      expect(consequences).toHaveLength(1);
      expect(consequences[0].type).toBe('stat_change');
      expect(consequences[0].target).toBe('character-1');
      
      // Verify event is marked as completed
      const triggerableEvents = storyService.evaluateTriggerableEvents({
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      expect(triggerableEvents).toHaveLength(0);
    });
  });

  describe('getProgress', () => {
    it('should return current story progress', () => {
      const progress = storyService.getProgress();
      
      expect(progress).toEqual({
        currentChapter: 'chapter_1',
        completedEvents: [],
        activeQuests: [],
        storyFlags: {},
        characterRelationships: {},
        worldStates: {}
      });
    });
  });

  describe('updateProgress', () => {
    it('should update story progress', () => {
      storyService.updateProgress({
        currentChapter: 'chapter_2',
        completedEvents: ['event-1']
      });
      
      const progress = storyService.getProgress();
      expect(progress.currentChapter).toBe('chapter_2');
      expect(progress.completedEvents).toContain('event-1');
    });
  });

  describe('getAvailableChoices', () => {
    it('should return player choice events', () => {
      const choiceEvent: StoryEvent = {
        ...testEvent,
        type: 'player_choice'
      };
      
      const plotEvent: StoryEvent = {
        ...testEvent,
        id: 'event-2',
        type: 'plot_point'
      };
      
      storyService.addEvent(choiceEvent);
      storyService.addEvent(plotEvent);
      
      const choices = storyService.getAvailableChoices({
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      
      expect(choices).toHaveLength(1);
      expect(choices[0].type).toBe('player_choice');
    });
  });

  describe('checkChapterCompletion', () => {
    it('should check if chapter completion conditions are met', () => {
      // Add some events to meet the completion condition
      for (let i = 0; i < 5; i++) {
        const event: StoryEvent = {
          ...testEvent,
          id: `event-${i}`
        };
        storyService.addEvent(event);
        storyService.triggerEvent(event, {
          sessionId: 'test-session',
          playerId: 'player-1',
          currentLocation: 'town_square',
          characters: {},
          currentTime: new Date(),
          recentEvents: []
        });
      }
      
      // Mock the required events for chapter completion
      (storyService as any).progress.completedEvents = ['arrive_in_town', 'meet_elena'];
      
      const isComplete = storyService.checkChapterCompletion({
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      expect(isComplete).toBe(true);
    });
  });

  describe('condition checking', () => {
    it('should correctly evaluate equality conditions', () => {
      const condition: StoryCondition = {
        type: 'story_flag',
        target: 'test_flag',
        operator: 'eq',
        value: true
      };
      
      // Set the flag to true
      storyService.updateProgress({
        storyFlags: { 'test_flag': true }
      });
      
      // We can't directly test the private method, but we can test through event evaluation
      const eventWithCondition: StoryEvent = {
        ...testEvent,
        requiredConditions: [condition]
      };
      
      storyService.addEvent(eventWithCondition);
      const triggerableEvents = storyService.evaluateTriggerableEvents({
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      
      expect(triggerableEvents).toHaveLength(1);
    });

    it('should correctly evaluate greater than conditions', () => {
      // For numeric comparisons, we should use a different condition type
      // Let's test with character_stat instead
      const condition: StoryCondition = {
        type: 'character_stat',
        target: 'character1',
        operator: 'gt',
        value: 5
      };
      
      // Set the character stat to a value greater than 5
      const context = {
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {
          'character1': {
            stat: 10
          }
        },
        currentTime: new Date(),
        recentEvents: []
      };
      
      const eventWithCondition: StoryEvent = {
        ...testEvent,
        id: 'event-2',
        requiredConditions: [condition]
      };
      
      storyService.addEvent(eventWithCondition);
      const triggerableEvents = storyService.evaluateTriggerableEvents(context);
      
      expect(triggerableEvents).toHaveLength(1);
    });
  });

  describe('consequence application', () => {
    it('should apply relationship change consequences', () => {
      const consequence: StoryConsequence = {
        type: 'relationship_change',
        target: 'character1:character2',
        value: 10,
        description: 'Improve relationship by 10'
      };
      
      // We can't directly test the private method, but we can test through event triggering
      const eventWithConsequence: StoryEvent = {
        ...testEvent,
        consequences: [consequence]
      };
      
      storyService.addEvent(eventWithConsequence);
      storyService.triggerEvent(eventWithConsequence, {
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      
      const progress = storyService.getProgress();
      expect(progress.characterRelationships['character1']['character2']).toBe(10);
    });

    it('should apply story flag consequences', () => {
      const consequence: StoryConsequence = {
        type: 'story_flag',
        target: 'new_flag',
        value: true,
        description: 'Set new flag to true'
      };
      
      const eventWithConsequence: StoryEvent = {
        ...testEvent,
        consequences: [consequence]
      };
      
      storyService.addEvent(eventWithConsequence);
      storyService.triggerEvent(eventWithConsequence, {
        sessionId: 'test-session',
        playerId: 'player-1',
        currentLocation: 'town_square',
        characters: {},
        currentTime: new Date(),
        recentEvents: []
      });
      
      const progress = storyService.getProgress();
      expect(progress.storyFlags['new_flag']).toBe(true);
    });
  });
});