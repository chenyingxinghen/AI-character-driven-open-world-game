import { FormattedTextExtractorService } from '../services/llm/FormattedTextExtractorService';
import { IntentType, EmotionalTone, UrgencyLevel } from '../domains/input/valueObjects';

// Mock logger
const mockLogger: any = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('FormattedTextExtractorService', () => {
  let extractor: FormattedTextExtractorService;

  beforeEach(() => {
    extractor = new FormattedTextExtractorService(mockLogger);
  });

  describe('extractInputClassification', () => {
    it('should correctly extract input classification with proper enum types', () => {
      const formattedText = `
=== INPUT_CLASSIFICATION ===
TYPE: speech
INTENT: dialogue
CONFIDENCE: 85
TARGET_CHARACTER: Alice
TARGET_LOCATION: none
IS_DIRECT_SPEECH: true
IS_ACTION_DESCRIPTION: false
IS_SYSTEM_QUERY: false
IS_COMPOUND_ACTION: false
EXTRACTED_ACTION: none
EXTRACTED_SPEECH: Hello there!
URGENCY: medium
EMOTIONAL_TONE: positive
ENTITIES: character:Alice
CONTEXTUAL_HINTS: greeting,friendly
=== END_CLASSIFICATION ===
      `.trim();

      const result = extractor.extractInputClassification(formattedText);
      
      expect(result.type).toBe('speech');
      expect(result.intent).toBe(IntentType.DIALOGUE);
      expect(result.confidence).toBe(85);
      expect(result.targetCharacter).toBe('Alice');
      expect(result.isDirectSpeech).toBe(true);
      expect(result.isActionDescription).toBe(false);
      expect(result.isSystemQuery).toBe(false);
      expect(result.isCompoundAction).toBe(false);
      expect(result.extractedSpeech).toBe('Hello there!');
      expect(result.urgency).toBe(UrgencyLevel.MEDIUM);
      expect(result.emotionalTone).toBe(EmotionalTone.POSITIVE);
      expect(result.contextualHints).toEqual(['greeting', 'friendly']);
      expect(result.contextualHints).toEqual(['greeting', 'friendly']);
    });
  });

  describe('extractIntentClassification', () => {
    it('should correctly extract intent classification with proper enum types', () => {
      const formattedText = `
=== INTENT_CLASSIFICATION ===
INTENT: movement
CONFIDENCE: 0.9
EMOTIONAL_TONE: neutral
URGENCY: high
ENTITIES: location:forest
=== END_INTENT ===
      `.trim();

      const result = extractor.extractIntentClassification(formattedText);
      
      expect(result.intent).toBe(IntentType.MOVEMENT);
      expect(result.confidence).toBe(0.9);
      expect(result.emotionalTone).toBe(EmotionalTone.NEUTRAL);
      expect(result.urgency).toBe(UrgencyLevel.HIGH);
      // IntentClassificationResult 不包含 contextualHints 字段
      expect(result.intent).toBe(IntentType.EXPLORATION);
      expect(result.confidence).toBe(90);
      expect(result.emotionalTone).toBe(EmotionalTone.NEUTRAL);
      expect(result.urgency).toBe(UrgencyLevel.MEDIUM);
    });

    it('should return default classification for invalid intent', () => {
      const formattedText = `
=== INTENT_CLASSIFICATION ===
INTENT: invalid_intent
CONFIDENCE: 0.9
EMOTIONAL_TONE: neutral
URGENCY: high
ENTITIES: location:forest
=== END_INTENT ===
      `.trim();

      const result = extractor.extractIntentClassification(formattedText);
      
      // 应该返回默认值而不是抛出异常
      expect(result.intent).toBe(IntentType.UNKNOWN);
      expect(result.confidence).toBe(0.5);
      expect(result.emotionalTone).toBe(EmotionalTone.NEUTRAL);
      expect(result.urgency).toBe(UrgencyLevel.MEDIUM);
    });
  });
});