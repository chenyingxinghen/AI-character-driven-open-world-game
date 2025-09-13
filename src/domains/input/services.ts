/**
 * 输入域服务
 * 这些服务包含输入域的业务逻辑，但不属于任何特定实体
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
import { FormattedTextGenerator } from '../../services/llm/FormattedTextResponse';
import { FormattedTextExtractorService } from '../../services/llm/FormattedTextExtractorService';
import { GameContextService } from '../../services/game/GameContextService';
import { 
  InputClassification, 
  ExtractedEntity, 
  IntentType,
  EmotionalTone,
  UrgencyLevel,
  ComplexScenarioAnalysis,
  PreprocessedInput,
  ChoiceDetectionResult,
  ChoicePoint,
  ChoiceOption,
  ContextHistory 
} from './valueObjects';

/**
 * 输入预处理服务
 */
export class InputPreprocessingService {
  constructor(private logger: Logger) {}

  preprocessInput(rawInput: string): PreprocessedInput {
    const preprocessingNotes: string[] = [];
    let normalizedInput = rawInput.trim();
    
    // 检测语言
    const detectedLanguage = this.detectLanguage(normalizedInput);
    
    // 标准化空白字符
    normalizedInput = normalizedInput.replace(/\s+/g, ' ');
    
    // 清理特殊字符但保留必要的标点
    const sanitizedInput = normalizedInput.replace(/[^\w\s\u4e00-\u9fff.,!?;:()"'-]/g, '');
    
    const hasSpecialCharacters = /[^\w\s\u4e00-\u9fff.,!?;:()"'-]/.test(rawInput);
    if (hasSpecialCharacters) preprocessingNotes.push('removed_special_characters');
    
    if (normalizedInput.length > 500) preprocessingNotes.push('long_input_detected');
    if (normalizedInput.length < 3) preprocessingNotes.push('very_short_input');

    return {
      originalInput: rawInput,
      normalizedInput,
      sanitizedInput,
      detectedLanguage,
      inputLength: normalizedInput.length,
      hasSpecialCharacters,
      preprocessingNotes
    };
  }

  private detectLanguage(input: string): string {
    const chineseCharCount = (input.match(/[\u4e00-\u9fff]/g) || []).length;
    const totalChars = input.length;
    return chineseCharCount / totalChars > 0.3 ? 'zh' : 'en';
  }
}

/**
 * 实体提取服务
 */
export class EntityExtractionService {
  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {}

  async extractEntities(
    input: string,
    context?: {
      knownCharacters?: string[];
      knownLocations?: string[];
    }
  ): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];

    // 提取各类实体
    entities.push(...await this.extractCharacterEntities(input, context?.knownCharacters));
    entities.push(...await this.extractLocationEntities(input, context?.knownLocations));
    entities.push(...this.extractActionEntities(input));
    entities.push(...this.extractTimeEntities(input));
    entities.push(...this.extractObjectEntities(input));

    return entities.sort((a, b) => a.position.start - b.position.start);
  }

  private async extractCharacterEntities(input: string, knownCharacters?: string[]): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    // 检查已知角色
    if (knownCharacters) {
      for (const character of knownCharacters) {
        const regex = new RegExp(`\\b${character}\\b`, 'gi');
        let match;
        while ((match = regex.exec(input)) !== null) {
          entities.push({
            type: 'character',
            value: character,
            confidence: 0.9,
            position: { start: match.index, end: match.index + character.length }
          });
        }
      }
    }

    return entities;
  }

  private async extractLocationEntities(input: string, knownLocations?: string[]): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    
    if (knownLocations) {
      for (const location of knownLocations) {
        const regex = new RegExp(`\\b${location}\\b`, 'gi');
        let match;
        while ((match = regex.exec(input)) !== null) {
          entities.push({
            type: 'location',
            value: location,
            confidence: 0.9,
            position: { start: match.index, end: match.index + location.length }
          });
        }
      }
    }

    return entities;
  }

  private extractActionEntities(input: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const actionKeywords = ['走', '去', '说', '看', 'go', 'walk', 'say', 'look'];

    for (const action of actionKeywords) {
      const regex = new RegExp(`\\b${action}\\b`, 'gi');
      let match;
      while ((match = regex.exec(input)) !== null) {
        entities.push({
          type: 'action',
          value: action,
          confidence: 0.8,
          position: { start: match.index, end: match.index + action.length }
        });
      }
    }

    return entities;
  }

  private extractTimeEntities(input: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const timePatterns = [
      /\b\d{1,2}:\d{2}\b/g,
      /\b(早上|中午|下午|晚上|morning|noon|afternoon|evening)\b/gi
    ];

    for (const pattern of timePatterns) {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        entities.push({
          type: 'time',
          value: match[0],
          confidence: 0.8,
          position: { start: match.index, end: match.index + match[0].length }
        });
      }
    }

    return entities;
  }

  private extractObjectEntities(input: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const objectKeywords = ['剑', '盾', '药水', 'sword', 'shield', 'potion'];

    for (const object of objectKeywords) {
      const regex = new RegExp(`\\b${object}\\b`, 'gi');
      let match;
      while ((match = regex.exec(input)) !== null) {
        entities.push({
          type: 'object',
          value: object,
          confidence: 0.7,
          position: { start: match.index, end: match.index + object.length }
        });
      }
    }

    return entities;
  }
}

/**
 * 意图分类服务
 */
export class IntentClassificationService {
  private extractor: FormattedTextExtractorService;
  
  constructor(
    private llmService: LLMService,
    private logger: Logger,
    private gameContextService?: GameContextService
  ) {
    this.extractor = new FormattedTextExtractorService(logger);
  }

  async classifyIntent(
    input: string,
    entities: ExtractedEntity[],
    context?: ContextHistory,
    sessionId?: string,
    playerId?: string
  ): Promise<{
    intent: IntentType;
    confidence: number;
    emotionalTone: EmotionalTone;
    urgency: UrgencyLevel;
  }> {
    const ruleBasedResult = this.ruleBasedClassification(input, entities);
    
    if (ruleBasedResult.confidence > 0.8) {
      return ruleBasedResult;
    }

    try {
      const llmResult = await this.llmBasedClassification(input, context, sessionId, playerId);
      if (llmResult.confidence > ruleBasedResult.confidence) {
        return llmResult;
      }
    } catch (error) {
      this.logger.error('LLM classification failed',error as Error);
    }

    return ruleBasedResult;
  }

  private ruleBasedClassification(input: string, entities: ExtractedEntity[]): any {
    const lowerInput = input.toLowerCase();
    
    const hasMovementAction = entities.some(e => 
      e.type === 'action' && ['走', '去', 'go', 'walk'].includes(e.value.toLowerCase())
    );
    
    const hasDialogueAction = entities.some(e => 
      e.type === 'action' && ['说', 'say', 'talk'].includes(e.value.toLowerCase())
    );

    const hasCharacter = entities.some(e => e.type === 'character');
    const hasLocation = entities.some(e => e.type === 'location');

    let intent = IntentType.UNKNOWN;
    let confidence = 0.5;

    if (hasMovementAction && hasLocation) {
      intent = IntentType.MOVEMENT;
      confidence = 0.85;
    } else if (hasDialogueAction && hasCharacter) {
      intent = IntentType.DIALOGUE;
      confidence = 0.85;
    } else if (hasCharacter) {
      intent = IntentType.CHARACTER_INTERACTION;
      confidence = 0.7;
    } else if (hasLocation) {
      intent = IntentType.LOCATION_QUERY;
      confidence = 0.7;
    }

    return { 
      intent, 
      confidence, 
      emotionalTone: this.analyzeEmotionalTone(input),
      urgency: this.analyzeUrgency(input)
    };
  }

  private async llmBasedClassification(
    input: string, 
    context?: ContextHistory,
    sessionId?: string,
    playerId?: string
  ): Promise<any> {
    try {
      let promptContext;
      
      // 如果有GameContextService且提供了sessionId和playerId，使用动态上下文
      if (this.gameContextService && sessionId && playerId) {
        try {
          const gameContext = await this.gameContextService.getInputClassificationContext(sessionId, playerId);
          promptContext = {
            sessionId: gameContext.sessionId,
            currentLocation: gameContext.currentLocation,
            nearbyCharacters: gameContext.nearbyCharacters,
            recentConversation: [...gameContext.recentConversation] // 转换为可变数组
          };
          
          this.logger.debug('Using dynamic game context for intent classification', {
            sessionId,
            currentLocation: gameContext.currentLocation,
            nearbyCharactersCount: gameContext.nearbyCharacters.length,
            component: 'IntentClassificationService'
          });
        } catch (error) {
          this.logger.warn('Failed to get dynamic context, using fallback', error as Error);
          // 使用备用上下文
          promptContext = {
            sessionId: sessionId || 'temp-session',
            currentLocation: 'unknown',
            nearbyCharacters: [],
            recentConversation: [...(context?.recentInputs || [])] // 转换为可变数组
          };
        }
      } else {
        // 使用基本上下文格式（兼容旧代码）
        promptContext = {
          sessionId: sessionId || 'temp-session',
          currentLocation: 'unknown',
          nearbyCharacters: [],
          recentConversation: [...(context?.recentInputs || [])] // 转换为可变数组
        };
      }
      
      // 生成格式化文本提示词
      const prompt = FormattedTextGenerator.generateInputClassificationPrompt(input, promptContext);
      
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.3,
        maxTokens: 200
      });

      // 使用格式化文本提取器解析响应
      const result = this.extractor.extractIntentClassification(response);
      
      return {
        intent: this.mapToIntentType(result.intent),
        confidence: result.confidence,
        emotionalTone: this.mapToEmotionalTone(result.emotionalTone),
        urgency: this.mapToUrgencyLevel(result.urgency)
      };
    } catch (error) {
      this.logger.error('LLM based classification failed:', error as Error);
      return {
        intent: IntentType.UNKNOWN,
        confidence: 0.5,
        emotionalTone: EmotionalTone.NEUTRAL,
        urgency: UrgencyLevel.MEDIUM
      };
    }
  }

  private analyzeEmotionalTone(input: string): EmotionalTone {
    const lowerInput = input.toLowerCase();
    
    if (['好', '棒', 'good', 'great'].some(word => lowerInput.includes(word))) {
      return EmotionalTone.POSITIVE;
    }
    if (['坏', '生气', 'bad', 'angry'].some(word => lowerInput.includes(word))) {
      return EmotionalTone.NEGATIVE;
    }
    
    return EmotionalTone.NEUTRAL;
  }

  private analyzeUrgency(input: string): UrgencyLevel {
    const lowerInput = input.toLowerCase();
    
    if (['快', '急', 'quick', 'urgent'].some(word => lowerInput.includes(word))) {
      return UrgencyLevel.URGENT;
    }
    if (input.includes('!') || input.includes('！')) {
      return UrgencyLevel.HIGH;
    }
    
    return UrgencyLevel.MEDIUM;
  }

  private mapToIntentType(intent: string): IntentType {
    const mapping: Record<string, IntentType> = {
      'dialogue': IntentType.DIALOGUE,
      'movement': IntentType.MOVEMENT,
      'exploration': IntentType.EXPLORATION,
      'character_interaction': IntentType.CHARACTER_INTERACTION,
      'location_query': IntentType.LOCATION_QUERY,
      'inventory_action': IntentType.INVENTORY_ACTION,
      'combat': IntentType.COMBAT,
      'information_query': IntentType.INFORMATION_QUERY,
      'complex_scenario': IntentType.COMPLEX_SCENARIO,
      'unknown': IntentType.UNKNOWN
    };
    return mapping[intent] || IntentType.UNKNOWN;
  }

  private mapToEmotionalTone(tone: string): EmotionalTone {
    const mapping: Record<string, EmotionalTone> = {
      'positive': EmotionalTone.POSITIVE,
      'negative': EmotionalTone.NEGATIVE,
      'neutral': EmotionalTone.NEUTRAL,
      'excited': EmotionalTone.EXCITED,
      'angry': EmotionalTone.ANGRY,
      'sad': EmotionalTone.SAD,
      'fearful': EmotionalTone.FEARFUL,
      'confused': EmotionalTone.CONFUSED
    };
    return mapping[tone] || EmotionalTone.NEUTRAL;
  }

  private mapToUrgencyLevel(urgency: string): UrgencyLevel {
    const mapping: Record<string, UrgencyLevel> = {
      'low': UrgencyLevel.LOW,
      'medium': UrgencyLevel.MEDIUM,
      'high': UrgencyLevel.HIGH,
      'urgent': UrgencyLevel.URGENT
    };
    return mapping[urgency] || UrgencyLevel.MEDIUM;
  }
}

/**
 * 复杂场景分析服务
 */
export class ComplexScenarioAnalysisService {
  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {}

  async analyzeComplexScenario(
    input: string,
    classification: InputClassification
  ): Promise<ComplexScenarioAnalysis> {
    const complexityCheck = this.quickComplexityAssessment(input, classification);
    
    if (!complexityCheck.isComplex) {
      return {
        isComplex: false,
        complexityScore: complexityCheck.score,
        scenarioType: 'simple',
        requiredDomains: [this.mapIntentToDomain(classification.intent)],
        subIntents: [classification],
        executionOrder: [classification.intent],
        estimatedProcessingTime: 500
      };
    }

    return this.detailedComplexityAnalysis(input, classification);
  }

  private quickComplexityAssessment(input: string, classification: InputClassification): { isComplex: boolean; score: number } {
    let score = classification.complexity;
    
    if (input.length > 100) score += 2;
    if (classification.entities.length > 3) score += 2;
    
    return {
      isComplex: score >= 7,
      score: Math.min(10, score)
    };
  }

  private async detailedComplexityAnalysis(input: string, classification: InputClassification): Promise<ComplexScenarioAnalysis> {
    return {
      isComplex: true,
      complexityScore: 8,
      scenarioType: 'multi_step',
      requiredDomains: ['character', 'world'],
      subIntents: [classification],
      executionOrder: ['input', 'character', 'world'],
      estimatedProcessingTime: 2000
    };
  }

  private mapIntentToDomain(intent: string): string {
    const mapping: Record<string, string> = {
      'dialogue': 'character',
      'movement': 'world'
    };
    return mapping[intent] || 'character';
  }
}

/**
 * 选择检测服务
 */
export class ChoiceDetectionService {
  constructor(private logger: Logger) {}

  detectChoices(input: string, classification: InputClassification): ChoiceDetectionResult {
    const choiceIndicators = this.findChoiceIndicators(input);
    
    if (choiceIndicators.length === 0) {
      return { hasChoices: false, choicePoints: [] };
    }

    const choicePoints = this.generateChoicePoints(input, choiceIndicators);

    return {
      hasChoices: choicePoints.length > 0,
      choicePoints,
      defaultAction: this.determineDefaultAction(classification)
    };
  }

  private findChoiceIndicators(input: string): string[] {
    const indicators = [];
    const lowerInput = input.toLowerCase();
    
    if (['选择', 'choose', 'decide'].some(word => lowerInput.includes(word))) {
      indicators.push('choice_word');
    }
    
    if (lowerInput.includes('或者') || lowerInput.includes(' or ')) {
      indicators.push('or_statement');
    }
    
    return indicators;
  }

  private generateChoicePoints(input: string, indicators: string[]): ChoicePoint[] {
    const choicePoints: ChoicePoint[] = [];
    
    if (indicators.includes('or_statement')) {
      const options = this.parseOrStatement(input);
      if (options.length > 1) {
        choicePoints.push({
          id: `choice_${Date.now()}`,
          description: '选择一个行动',
          options,
          consequences: [],
          difficulty: 3
        });
      }
    }
    
    return choicePoints;
  }

  private parseOrStatement(input: string): ChoiceOption[] {
    const options: ChoiceOption[] = [];
    const parts = input.split(/或者|or/i);
    
    for (let i = 0; i < parts.length && i < 4; i++) {
      const part = parts[i].trim();
      if (part.length > 0) {
        options.push({
          id: `option_${i + 1}`,
          text: part,
          description: part,
          riskLevel: 0.3,
          probability: 0.8
        });
      }
    }
    
    return options;
  }

  private determineDefaultAction(classification: InputClassification): string | undefined {
    if (classification.intent === 'dialogue') return 'continue_conversation';
    if (classification.intent === 'movement') return 'proceed_movement';
    return undefined;
  }
}