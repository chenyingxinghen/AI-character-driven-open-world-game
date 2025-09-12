/**
 * 格式化文本提取器服务测试
 * 验证统一格式化文本处理的功能
 */

import { FormattedTextExtractorService } from '../services/llm/FormattedTextExtractorService';
import { FormattedTextGenerator } from '../services/llm/FormattedTextResponse';
import { Logger } from '../services/Logger';

// Mock Logger
const mockLogger: Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
} as any;

describe('FormattedTextExtractorService', () => {
  let extractor: FormattedTextExtractorService;

  beforeEach(() => {
    extractor = new FormattedTextExtractorService(mockLogger);
  });

  describe('extractInputClassification', () => {
    it('should extract valid input classification from formatted text', () => {
      const formattedText = `
=== INPUT_CLASSIFICATION ===
TYPE: speech
INTENT: dialogue
CONFIDENCE: 85
TARGET_CHARACTER: Elena
IS_DIRECT_SPEECH: true
IS_ACTION_DESCRIPTION: false
IS_SYSTEM_QUERY: false
IS_COMPOUND_ACTION: false
EXTRACTED_ACTION: none
EXTRACTED_SPEECH: Hello Elena
URGENCY: medium
EMOTIONAL_TONE: positive
CONTEXTUAL_HINTS: greeting, friendly
=== END_CLASSIFICATION ===
      `;

      const result = extractor.extractInputClassification(formattedText);

      expect(result.type).toBe('speech');
      expect(result.intent).toBe('dialogue');
      expect(result.confidence).toBe(85);
      expect(result.targetCharacter).toBe('Elena');
      expect(result.isDirectSpeech).toBe(true);
      expect(result.isActionDescription).toBe(false);
      expect(result.urgency).toBe('medium');
      expect(result.emotionalTone).toBe('positive');
      expect(result.contextualHints).toEqual(['greeting', 'friendly']);
    });

    it('should return default values for malformed text', () => {
      const malformedText = 'This is not a valid formatted response';
      
      const result = extractor.extractInputClassification(malformedText);

      expect(result.type).toBe('speech');
      expect(result.intent).toBe('dialogue');
      expect(result.confidence).toBe(50);
      expect(result.isDirectSpeech).toBe(true);
      expect(result.urgency).toBe('medium');
      expect(result.emotionalTone).toBe('neutral');
    });
  });

  describe('extractCharacterDialogue', () => {
    it('should extract valid character dialogue from formatted text', () => {
      const formattedText = `
=== CHARACTER_DIALOGUE ===
DIALOGUE: Hello there, traveler! Welcome to our town.
ACTION: Elena smiles warmly and gestures toward the library
EMOTIONAL_STATE_MOOD: happy
EMOTIONAL_STATE_INTENSITY: 75
CONFIDENCE: 0.9
=== END_DIALOGUE ===
      `;

      const result = extractor.extractCharacterDialogue(formattedText);

      expect(result.dialogue).toBe('Hello there, traveler! Welcome to our town.');
      expect(result.action).toBe('Elena smiles warmly and gestures toward the library');
      expect(result.emotionalState.mood).toBe('happy');
      expect(result.emotionalState.intensity).toBe(75);
      expect(result.confidence).toBe(0.9);
    });

    it('should handle missing optional fields', () => {
      const formattedText = `
=== CHARACTER_DIALOGUE ===
DIALOGUE: Hello!
ACTION: none
EMOTIONAL_STATE_MOOD: neutral
EMOTIONAL_STATE_INTENSITY: 50
CONFIDENCE: 0.7
=== END_DIALOGUE ===
      `;

      const result = extractor.extractCharacterDialogue(formattedText);

      expect(result.dialogue).toBe('Hello!');
      expect(result.action).toBeUndefined();
      expect(result.emotionalState.mood).toBe('neutral');
      expect(result.confidence).toBe(0.7);
    });
  });

  describe('extractDirectorDecision', () => {
    it('should extract valid director decision from formatted text', () => {
      const formattedText = `
=== DIRECTOR_DECISION ===
ACTION: ADVANCE_PLOT
REASONING: Player has gathered enough information to progress
CONFIDENCE: 0.85
PARAMETERS: chapter=2,tension=high
=== END_DECISION ===
      `;

      const result = extractor.extractDirectorDecision(formattedText);

      expect(result.action).toBe('ADVANCE_PLOT');
      expect(result.reasoning).toBe('Player has gathered enough information to progress');
      expect(result.confidence).toBe(0.85);
      expect(result.parameters).toEqual({ chapter: '2', tension: 'high' });
    });
  });

  describe('extractCompoundAction', () => {
    it('should extract valid compound action from formatted text', () => {
      const formattedText = `
=== COMPOUND_ACTION_ANALYSIS ===
IS_COMPOUND: true
ACTION_SEQUENCE: sequential
SUB_ACTIONS: walk to library|talk to Elena|ask about ancient texts
=== END_COMPOUND_ACTION ===
      `;

      const result = extractor.extractCompoundAction(formattedText);

      expect(result.isCompound).toBe(true);
      expect(result.actionSequence).toBe('sequential');
      expect(result.subActions).toEqual(['walk to library', 'talk to Elena', 'ask about ancient texts']);
    });

    it('should handle non-compound actions', () => {
      const formattedText = `
=== COMPOUND_ACTION_ANALYSIS ===
IS_COMPOUND: false
ACTION_SEQUENCE: sequential
SUB_ACTIONS: none
=== END_COMPOUND_ACTION ===
      `;

      const result = extractor.extractCompoundAction(formattedText);

      expect(result.isCompound).toBe(false);
      expect(result.actionSequence).toBe('sequential');
      expect(result.subActions).toEqual([]);
    });
  });

  describe('extractIntentClassification', () => {
    it('should extract valid intent classification from formatted text', () => {
      const formattedText = `
=== INTENT_CLASSIFICATION ===
INTENT: DIALOGUE
CONFIDENCE: 0.85
EMOTIONAL_TONE: POSITIVE
URGENCY: MEDIUM
ENTITIES: character:Elena,location:library
=== END_INTENT ===
      `;

      const result = extractor.extractIntentClassification(formattedText);

      expect(result.intent).toBe('DIALOGUE');
      expect(result.confidence).toBe(0.85);
      expect(result.emotionalTone).toBe('POSITIVE');
      expect(result.urgency).toBe('MEDIUM');
      expect(result.entities).toEqual([
        { type: 'character', value: 'Elena' },
        { type: 'location', value: 'library' }
      ]);
    });

    it('should handle no entities', () => {
      const formattedText = `
=== INTENT_CLASSIFICATION ===
INTENT: UNKNOWN
CONFIDENCE: 0.5
EMOTIONAL_TONE: NEUTRAL
URGENCY: LOW
ENTITIES: none
=== END_INTENT ===
      `;

      const result = extractor.extractIntentClassification(formattedText);

      expect(result.intent).toBe('UNKNOWN');
      expect(result.entities).toEqual([]);
    });
  });
});

describe('FormattedTextGenerator', () => {
  describe('generateInputClassificationPrompt', () => {
    it('should generate proper prompt for input classification', () => {
      const input = 'Hello Elena, how are you?';
      const context = {
        sessionId: 'test-session',
        currentLocation: 'library',
        nearbyCharacters: ['Elena'],
        recentConversation: ['Player entered the library']
      };

      const prompt = FormattedTextGenerator.generateInputClassificationPrompt(input, context);

      expect(prompt).toContain('INPUT_CLASSIFICATION');
      expect(prompt).toContain('END_CLASSIFICATION');
      expect(prompt).toContain(input);
      expect(prompt).toContain('library');
      expect(prompt).toContain('Elena');
    });
  });

  describe('generateCharacterDialoguePrompt', () => {
    it('should generate proper prompt for character dialogue', () => {
      const character = {
        name: 'Elena',
        personality: { traits: ['kind', 'wise'] },
        emotionalState: { mood: 'neutral', intensity: 50 }
      };
      const context = { location: 'library' };
      const prompt = 'Hello Elena!';

      const generatedPrompt = FormattedTextGenerator.generateCharacterDialoguePrompt(character, context, prompt);

      expect(generatedPrompt).toContain('CHARACTER_DIALOGUE');
      expect(generatedPrompt).toContain('END_DIALOGUE');
      expect(generatedPrompt).toContain('Elena');
      expect(generatedPrompt).toContain('Hello Elena!');
    });
  });

  describe('generateDirectorDecisionPrompt', () => {
    it('should generate proper prompt for director decision', () => {
      const context = { tensionLevel: 5 };
      const evaluation = { plotPoints: ['discovery'] };

      const prompt = FormattedTextGenerator.generateDirectorDecisionPrompt(context, evaluation);

      expect(prompt).toContain('DIRECTOR_DECISION');
      expect(prompt).toContain('END_DECISION');
      expect(prompt).toContain('tensionLevel');
    });
  });

  describe('generateCompoundActionPrompt', () => {
    it('should generate proper prompt for compound action analysis', () => {
      const input = 'Go to the library and talk to Elena about the ancient texts';

      const prompt = FormattedTextGenerator.generateCompoundActionPrompt(input);

      expect(prompt).toContain('COMPOUND_ACTION_ANALYSIS');
      expect(prompt).toContain('END_COMPOUND_ACTION');
      expect(prompt).toContain(input);
    });
  });

  describe('generateIntentClassificationPrompt', () => {
    it('should generate proper prompt for intent classification', () => {
      const input = 'I want to explore the town';
      const context = { currentLocation: 'town_square' };

      const prompt = FormattedTextGenerator.generateIntentClassificationPrompt(input, context);

      expect(prompt).toContain('INTENT_CLASSIFICATION');
      expect(prompt).toContain('END_INTENT');
      expect(prompt).toContain(input);
      expect(prompt).toContain('town_square');
    });
  });
});