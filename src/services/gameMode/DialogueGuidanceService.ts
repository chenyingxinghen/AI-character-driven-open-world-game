/**
 * 对话引导服务
 * 专门负责通过NPC对话和对话选项来引导玩家
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
import {
  InterventionIntensity,
  StoryGenre,
  PlotPoint
} from '../../domains/gameMode/valueObjects';
import { promptManager } from '../../prompts';

/**
 * 对话引导类型
 */
export enum DialogueGuidanceType {
  SUBTLE_HINT = 'subtle_hint',
  DIRECT_SUGGESTION = 'direct_suggestion',
  QUESTION_PROMPT = 'question_prompt',
  WARNING = 'warning',
  ENCOURAGEMENT = 'encouragement',
  EXPOSITION = 'exposition',
  CHOICE_CLARIFICATION = 'choice_clarification',
  INNER_THOUGHT = 'inner_thought'
}

/**
 * 对话角色类型
 */
export enum DialogueSpeakerType {
  NARRATOR = 'narrator',
  EXISTING_CHARACTER = 'existing_character',
  NEW_CHARACTER = 'new_character',
  MYSTERIOUS_VOICE = 'mysterious_voice',
  INNER_THOUGHT = 'inner_thought',
  ENVIRONMENTAL_SOUND = 'environmental_sound'
}

/**
 * 对话引导上下文
 */
export interface DialogueGuidanceContext {
  readonly currentLocation: string;
  readonly playerAction: string;
  readonly targetOutcome: string;
  readonly availableCharacters: string[];
  readonly recentDialogue: string[];
  readonly playerEmotionalState?: string;
  readonly storyGenre: StoryGenre;
  readonly currentPlotPoint?: PlotPoint;
}

/**
 * 生成的对话引导
 */
export interface GeneratedDialogueGuidance {
  readonly type: DialogueGuidanceType;
  readonly speakerType: DialogueSpeakerType;
  readonly speakerName: string;
  readonly dialogue: string;
  readonly tone: string;
  readonly subtext: string;
  readonly playerOptions: string[];
  readonly expectedPlayerResponse: string[];
  readonly followUpActions: string[];
  readonly effectiveness: number; // 预期效果 0-100
}

/**
 * 对话引导服务
 */
export class DialogueGuidanceService {
  private guidanceHistory: GeneratedDialogueGuidance[] = [];
  private characterPersonalities: Map<string, any> = new Map();

  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {
    this.initializeDefaultCharacters();
  }

  /**
   * 生成对话引导
   */
  async generateDialogueGuidance(
    intensity: InterventionIntensity,
    context: DialogueGuidanceContext
  ): Promise<GeneratedDialogueGuidance> {
    this.logger.debug('Generating dialogue guidance', {
      intensity,
      context: context.currentLocation,
      component: 'DialogueGuidanceService'
    });

    const guidanceType = this.selectGuidanceType(intensity, context);
    const speakerType = this.selectSpeakerType(guidanceType, context);
    const speakerName = this.selectSpeaker(speakerType, context);

    const dialoguePrompt = this.buildDialoguePrompt(
      guidanceType,
      speakerType,
      speakerName,
      intensity,
      context
    );

    try {
      const dialogueData = await this.llmService.generateStructuredResponse(
        dialoguePrompt,
        this.getDialogueSchema(),
        {
          temperature: 0.6,
          maxTokens: 500,
          systemPrompt: promptManager.generate('system.dialogue_guidance_system', {})
        }
      );

      const guidance = this.parseDialogueData(
        dialogueData,
        guidanceType,
        speakerType,
        speakerName
      );

      this.recordGuidance(guidance);
      return guidance;
    } catch (error) {
      this.logger.error('Failed to generate dialogue guidance', error as Error);
      return this.getFallbackGuidance(guidanceType, speakerType, speakerName, context);
    }
  }

  /**
   * 生成多选项引导
   */
  async generateChoiceGuidance(
    originalChoices: string[],
    preferredChoice: string,
    context: DialogueGuidanceContext
  ): Promise<{
    modifiedChoices: string[];
    guidance: GeneratedDialogueGuidance;
  }> {
    const guidance = await this.generateDialogueGuidance(
      InterventionIntensity.SUBTLE,
      {
        ...context,
        targetOutcome: `引导玩家选择: ${preferredChoice}`
      }
    );

    // 调整选项顺序和表述
    const modifiedChoices = this.modifyChoices(originalChoices, preferredChoice);

    return {
      modifiedChoices,
      guidance
    };
  }

  /**
   * 生成角色个性化对话
   */
  async generatePersonalizedDialogue(
    characterId: string,
    message: string,
    context: DialogueGuidanceContext
  ): Promise<string> {
    const personality = this.characterPersonalities.get(characterId);
    if (!personality) {
      return message; // 如果没有个性数据，返回原始消息
    }

    const personalityPrompt = promptManager.generate('guidance.personalize_dialogue', {
      characterId,
      personality: JSON.stringify(personality),
      message,
      currentLocation: context.currentLocation,
      targetOutcome: context.targetOutcome
    });

    try {
      const personalizedDialogue = await this.llmService.generateText(personalityPrompt, {
        temperature: 0.6,
        maxTokens: 150
      });

      return personalizedDialogue || message;
    } catch (error) {
      this.logger.error('Failed to personalize dialogue', error as Error);
      return message;
    }
  }

  /**
   * 获取引导历史
   */
  getGuidanceHistory(limit: number = 10): GeneratedDialogueGuidance[] {
    return [...this.guidanceHistory].slice(-limit);
  }

  /**
   * 设置角色个性
   */
  setCharacterPersonality(characterId: string, personality: any): void {
    this.characterPersonalities.set(characterId, personality);
  }

  /**
   * 评估引导效果
   */
  evaluateGuidanceEffectiveness(
    guidance: GeneratedDialogueGuidance,
    playerResponse: string
  ): number {
    const expectedResponses = guidance.expectedPlayerResponse;
    let effectiveness = 0;

    for (const expected of expectedResponses) {
      if (playerResponse.toLowerCase().includes(expected.toLowerCase())) {
        effectiveness += 25;
      }
    }

    // 基于对话类型调整效果评估
    switch (guidance.type) {
      case DialogueGuidanceType.DIRECT_SUGGESTION:
        effectiveness *= 1.2;
        break;
      case DialogueGuidanceType.SUBTLE_HINT:
        effectiveness *= 0.8;
        break;
      case DialogueGuidanceType.WARNING:
        effectiveness *= 1.1;
        break;
    }

    return Math.min(100, Math.max(0, effectiveness));
  }

  /**
   * 初始化默认角色
   */
  private initializeDefaultCharacters(): void {
    this.characterPersonalities.set('wise_elder', {
      traits: ['wisdom', 'patience', 'cryptic'],
      speechStyle: 'metaphorical',
      helpfulness: 'high'
    });

    this.characterPersonalities.set('helpful_guard', {
      traits: ['duty', 'straightforward', 'protective'],
      speechStyle: 'direct',
      helpfulness: 'medium'
    });

    this.characterPersonalities.set('mysterious_stranger', {
      traits: ['enigmatic', 'knowledgeable', 'cautious'],
      speechStyle: 'cryptic',
      helpfulness: 'variable'
    });
  }

  /**
   * 选择引导类型
   */
  private selectGuidanceType(
    intensity: InterventionIntensity,
    context: DialogueGuidanceContext
  ): DialogueGuidanceType {
    switch (intensity) {
      case InterventionIntensity.SUBTLE:
        return Math.random() > 0.5 ? DialogueGuidanceType.SUBTLE_HINT : DialogueGuidanceType.QUESTION_PROMPT;

      case InterventionIntensity.MODERATE:
        return Math.random() > 0.5 ? DialogueGuidanceType.DIRECT_SUGGESTION : DialogueGuidanceType.ENCOURAGEMENT;

      case InterventionIntensity.STRONG:
        return Math.random() > 0.5 ? DialogueGuidanceType.WARNING : DialogueGuidanceType.EXPOSITION;

      case InterventionIntensity.FORCED:
        return DialogueGuidanceType.CHOICE_CLARIFICATION;

      default:
        return DialogueGuidanceType.SUBTLE_HINT;
    }
  }

  /**
   * 选择说话者类型
   */
  private selectSpeakerType(
    guidanceType: DialogueGuidanceType,
    context: DialogueGuidanceContext
  ): DialogueSpeakerType {
    // 如果有可用角色，优先使用
    if (context.availableCharacters.length > 0) {
      return DialogueSpeakerType.EXISTING_CHARACTER;
    }

    switch (guidanceType) {
      case DialogueGuidanceType.INNER_THOUGHT:
        return DialogueSpeakerType.INNER_THOUGHT;

      case DialogueGuidanceType.WARNING:
        return Math.random() > 0.5 ? DialogueSpeakerType.MYSTERIOUS_VOICE : DialogueSpeakerType.NARRATOR;

      case DialogueGuidanceType.EXPOSITION:
        return DialogueSpeakerType.NARRATOR;

      default:
        return Math.random() > 0.7 ? DialogueSpeakerType.NEW_CHARACTER : DialogueSpeakerType.NARRATOR;
    }
  }

  /**
   * 选择说话者
   */
  private selectSpeaker(
    speakerType: DialogueSpeakerType,
    context: DialogueGuidanceContext
  ): string {
    switch (speakerType) {
      case DialogueSpeakerType.EXISTING_CHARACTER:
        return context.availableCharacters[0] || '智者';

      case DialogueSpeakerType.NEW_CHARACTER:
        return this.generateNewCharacterName(context);

      case DialogueSpeakerType.NARRATOR:
        return '叙述者';

      case DialogueSpeakerType.MYSTERIOUS_VOICE:
        return '神秘声音';

      case DialogueSpeakerType.INNER_THOUGHT:
        return '内心声音';

      case DialogueSpeakerType.ENVIRONMENTAL_SOUND:
        return '环境提示';

      default:
        return '未知声音';
    }
  }

  /**
   * 生成新角色名称
   */
  private generateNewCharacterName(context: DialogueGuidanceContext): string {
    const namesByGenre: Record<StoryGenre, string[]> = {
      [StoryGenre.FANTASY]: ['智者艾伦', '守护者莉亚', '旅者卡尔'],
      [StoryGenre.SCIENCE_FICTION]: ['AI助手', '站长约翰', '调查员萨拉'],
      [StoryGenre.MYSTERY]: ['侦探布朗', '神秘人X', '目击者'],
      [StoryGenre.HISTORICAL]: ['村长', '商人', '信使'],
      [StoryGenre.MODERN]: ['路人甲', '咖啡店老板', '出租车司机'],
      [StoryGenre.ADVENTURE]: ['向导', '探险家', '当地人']
    };

    const names = namesByGenre[context.storyGenre] || ['神秘人'];
    return names[Math.floor(Math.random() * names.length)];
  }

  /**
   * 构建对话提示
   */
  private buildDialoguePrompt(
    guidanceType: DialogueGuidanceType,
    speakerType: DialogueSpeakerType,
    speakerName: string,
    intensity: InterventionIntensity,
    context: DialogueGuidanceContext
  ): string {
    return promptManager.generate('guidance.generate_dialogue', {
      guidanceType,
      speakerType,
      speakerName,
      intensity,
      currentLocation: context.currentLocation,
      playerAction: context.playerAction,
      targetOutcome: context.targetOutcome,
      storyGenre: context.storyGenre,
      guidanceDescription: this.getGuidanceDescription(guidanceType)
    });
  }

  /**
   * 获取对话数据结构
   */
  private getDialogueSchema(): any {
    return {
      type: 'object',
      properties: {
        dialogue: { type: 'string', description: '角色对话内容' },
        tone: { type: 'string', description: '对话语调' },
        subtext: { type: 'string', description: '对话潜台词或真实意图' },
        playerOptions: {
          type: 'array',
          items: { type: 'string' },
          description: '建议的玩家回应选项'
        },
        expectedPlayerResponse: {
          type: 'array',
          items: { type: 'string' },
          description: '期望的玩家回应关键词'
        },
        followUpActions: {
          type: 'array',
          items: { type: 'string' },
          description: '对话后的后续行动建议'
        }
      },
      required: ['dialogue', 'tone', 'playerOptions']
    };
  }

  /**
   * 解析对话数据
   */
  private parseDialogueData(
    dialogueData: any,
    guidanceType: DialogueGuidanceType,
    speakerType: DialogueSpeakerType,
    speakerName: string
  ): GeneratedDialogueGuidance {
    return {
      type: guidanceType,
      speakerType,
      speakerName,
      dialogue: dialogueData.dialogue || '我有些想法...',
      tone: dialogueData.tone || '友善',
      subtext: dialogueData.subtext || '试图提供帮助',
      playerOptions: dialogueData.playerOptions || ['继续听取', '询问更多'],
      expectedPlayerResponse: dialogueData.expectedPlayerResponse || [],
      followUpActions: dialogueData.followUpActions || [],
      effectiveness: this.estimateEffectiveness(guidanceType)
    };
  }

  /**
   * 获取引导描述
   */
  private getGuidanceDescription(guidanceType: DialogueGuidanceType): string {
    switch (guidanceType) {
      case DialogueGuidanceType.SUBTLE_HINT:
        return '巧妙地暗示正确方向，不直接说出答案';
      case DialogueGuidanceType.DIRECT_SUGGESTION:
        return '明确地建议具体行动';
      case DialogueGuidanceType.QUESTION_PROMPT:
        return '通过问题引导玩家思考';
      case DialogueGuidanceType.WARNING:
        return '警告潜在风险或错误';
      case DialogueGuidanceType.ENCOURAGEMENT:
        return '鼓励玩家继续当前方向';
      case DialogueGuidanceType.EXPOSITION:
        return '提供背景信息或解释';
      case DialogueGuidanceType.CHOICE_CLARIFICATION:
        return '澄清选择的含义和后果';
      default:
        return '自然地进行对话';
    }
  }

  /**
   * 估算效果
   */
  private estimateEffectiveness(guidanceType: DialogueGuidanceType): number {
    switch (guidanceType) {
      case DialogueGuidanceType.DIRECT_SUGGESTION:
        return 85;
      case DialogueGuidanceType.WARNING:
        return 80;
      case DialogueGuidanceType.CHOICE_CLARIFICATION:
        return 75;
      case DialogueGuidanceType.ENCOURAGEMENT:
        return 70;
      case DialogueGuidanceType.EXPOSITION:
        return 65;
      case DialogueGuidanceType.QUESTION_PROMPT:
        return 60;
      case DialogueGuidanceType.SUBTLE_HINT:
        return 55;
      default:
        return 50;
    }
  }

  /**
   * 修改选择选项
   */
  private modifyChoices(originalChoices: string[], preferredChoice: string): string[] {
    const modified = [...originalChoices];

    // 找到偏好选项的索引
    const preferredIndex = modified.findIndex(choice =>
      choice.toLowerCase().includes(preferredChoice.toLowerCase())
    );

    if (preferredIndex > 0) {
      // 将偏好选项移到前面
      const preferred = modified.splice(preferredIndex, 1)[0];
      modified.unshift(preferred);
    }

    // 微调表述，使偏好选项更有吸引力
    if (modified.length > 0) {
      modified[0] = this.enhanceChoiceWording(modified[0]);
    }

    return modified;
  }

  /**
   * 增强选项表述
   */
  private enhanceChoiceWording(choice: string): string {
    // 添加一些积极的修饰词
    const positiveWords = ['明智地', '小心地', '果断地', '聪明地'];
    const randomWord = positiveWords[Math.floor(Math.random() * positiveWords.length)];

    return `${randomWord}${choice}`;
  }

  /**
   * 记录引导
   */
  private recordGuidance(guidance: GeneratedDialogueGuidance): void {
    this.guidanceHistory.push(guidance);
    if (this.guidanceHistory.length > 100) {
      this.guidanceHistory = this.guidanceHistory.slice(-100);
    }
  }

  /**
   * 获取备用引导
   */
  private getFallbackGuidance(
    guidanceType: DialogueGuidanceType,
    speakerType: DialogueSpeakerType,
    speakerName: string,
    context: DialogueGuidanceContext
  ): GeneratedDialogueGuidance {
    const fallbackDialogues: Record<DialogueGuidanceType, string> = {
      [DialogueGuidanceType.SUBTLE_HINT]: '也许你应该仔细考虑一下...',
      [DialogueGuidanceType.DIRECT_SUGGESTION]: '我建议你这样做...',
      [DialogueGuidanceType.QUESTION_PROMPT]: '你想过这个问题吗？',
      [DialogueGuidanceType.WARNING]: '小心，这可能不是个好主意...',
      [DialogueGuidanceType.ENCOURAGEMENT]: '你做得很好，继续！',
      [DialogueGuidanceType.EXPOSITION]: '让我解释一下情况...',
      [DialogueGuidanceType.CHOICE_CLARIFICATION]: '让我澄清一下这些选择的含义...',
      [DialogueGuidanceType.INNER_THOUGHT]: '你内心深处感觉到...'
    };

    return {
      type: guidanceType,
      speakerType,
      speakerName,
      dialogue: fallbackDialogues[guidanceType] || '我想说些什么...',
      tone: '友善',
      subtext: '尝试提供帮助',
      playerOptions: ['继续', '询问更多', '忽略'],
      expectedPlayerResponse: ['好的', '继续', '明白'],
      followUpActions: ['观察玩家反应'],
      effectiveness: 50
    };
  }
}