/**
 * 事件生成服务
 * 专门负责生成各种类型的游戏事件来引导故事发展
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
import {
  InterventionType,
  InterventionIntensity,
  StoryGenre,
  PlotPoint
} from '../../domains/gameMode/valueObjects';

/**
 * 事件类型枚举
 */
export enum EventType {
  CHARACTER_APPEARANCE = 'character_appearance',
  ENVIRONMENTAL_CHANGE = 'environmental_change',
  ITEM_DISCOVERY = 'item_discovery',
  OBSTACLE_CREATION = 'obstacle_creation',
  OPPORTUNITY_PRESENTATION = 'opportunity_presentation',
  EMOTIONAL_TRIGGER = 'emotional_trigger',
  MEMORY_FLASHBACK = 'memory_flashback',
  SURPRISE_ENCOUNTER = 'surprise_encounter'
}

/**
 * 事件生成上下文
 */
export interface EventGenerationContext {
  readonly currentLocation: string;
  readonly playerAction: string;
  readonly storyGenre: StoryGenre;
  readonly currentPlotPoint?: PlotPoint;
  readonly recentEvents: string[];
  readonly availableCharacters: string[];
  readonly environmentalState: Record<string, any>;
  readonly playerEmotionalState?: string;
}

/**
 * 生成的事件结果
 */
export interface GeneratedEvent {
  readonly type: EventType;
  readonly title: string;
  readonly description: string;
  readonly consequences: string[];
  readonly involvedCharacters: string[];
  readonly locationChanges: Record<string, any>;
  readonly immediateEffects: string[];
  readonly longTermImpacts: string[];
  readonly playerChoices?: string[];
}

/**
 * 事件生成服务
 */
export class EventGenerationService {
  private eventTemplates: Map<EventType, string[]> = new Map();
  private recentEvents: string[] = [];

  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {
    this.initializeEventTemplates();
  }

  /**
   * 生成干预事件
   */
  async generateInterventionEvent(
    interventionType: InterventionType,
    intensity: InterventionIntensity,
    context: EventGenerationContext,
    targetOutcome: string
  ): Promise<GeneratedEvent> {
    this.logger.debug('Generating intervention event', {
      interventionType,
      intensity,
      context: context.currentLocation,
      component: 'EventGenerationService'
    });

    const eventType = this.selectEventTypeForIntervention(interventionType, context);
    const eventPrompt = this.buildEventGenerationPrompt(
      eventType,
      intensity,
      context,
      targetOutcome
    );

    try {
      const eventData = await this.llmService.generateStructuredResponse(
        eventPrompt,
        this.getEventSchema(),
        {
          temperature: 0.7,
          maxTokens: 400
        }
      );

      const generatedEvent = this.parseEventData(eventData, eventType);
      this.recordEvent(generatedEvent);

      return generatedEvent;
    } catch (error) {
      this.logger.error('Failed to generate intervention event', error as Error);
      return this.getFallbackEvent(eventType, context);
    }
  }

  /**
   * 生成随机事件（自由模式）
   */
  async generateRandomEvent(
    context: EventGenerationContext,
    creativity: number = 70
  ): Promise<GeneratedEvent> {
    const eventType = this.selectRandomEventType(context, creativity);
    const eventPrompt = this.buildRandomEventPrompt(eventType, context, creativity);

    try {
      const eventData = await this.llmService.generateStructuredResponse(
        eventPrompt,
        this.getEventSchema(),
        {
          temperature: 0.6 + (creativity / 200), // 根据创意度调整温度
          maxTokens: 300
        }
      );

      const generatedEvent = this.parseEventData(eventData, eventType);
      this.recordEvent(generatedEvent);

      return generatedEvent;
    } catch (error) {
      this.logger.error('Failed to generate random event', error as Error);
      return this.getFallbackEvent(eventType, context);
    }
  }

  /**
   * 生成基于情节点的事件
   */
  async generatePlotPointEvent(
    plotPoint: PlotPoint,
    context: EventGenerationContext
  ): Promise<GeneratedEvent> {
    const eventType = this.selectEventTypeForPlotPoint(plotPoint);
    const eventPrompt = this.buildPlotPointEventPrompt(plotPoint, eventType, context);

    try {
      const eventData = await this.llmService.generateStructuredResponse(
        eventPrompt,
        this.getEventSchema(),
        {
          temperature: 0.6,
          maxTokens: 350
        }
      );

      const generatedEvent = this.parseEventData(eventData, eventType);
      this.recordEvent(generatedEvent);

      return generatedEvent;
    } catch (error) {
      this.logger.error('Failed to generate plot point event', error as Error);
      return this.getFallbackEvent(eventType, context);
    }
  }

  /**
   * 获取事件历史
   */
  getEventHistory(limit: number = 10): string[] {
    return [...this.recentEvents].slice(-limit);
  }

  /**
   * 清除事件历史
   */
  clearEventHistory(): void {
    this.recentEvents = [];
  }

  /**
   * 初始化事件模板
   */
  private initializeEventTemplates(): void {
    this.eventTemplates.set(EventType.CHARACTER_APPEARANCE, [
      '一个神秘的陌生人出现了',
      '一位老朋友意外现身',
      '传说中的人物降临此地'
    ]);

    this.eventTemplates.set(EventType.ENVIRONMENTAL_CHANGE, [
      '天气突然发生变化',
      '地形出现了不寻常的变化',
      '周围的氛围变得紧张'
    ]);

    this.eventTemplates.set(EventType.ITEM_DISCOVERY, [
      '你发现了一个隐藏的物品',
      '某个重要的线索暴露了',
      '一件古老的遗物出现在视野中'
    ]);

    this.eventTemplates.set(EventType.OPPORTUNITY_PRESENTATION, [
      '一个新的机会出现了',
      '你察觉到了一个可能的选择',
      '情况的发展为你打开了新的道路'
    ]);

    this.eventTemplates.set(EventType.EMOTIONAL_TRIGGER, [
      '某件事触动了你的情感',
      '一段回忆被唤起',
      '内心深处的感受被激发'
    ]);
  }

  /**
   * 选择干预事件类型
   */
  private selectEventTypeForIntervention(
    interventionType: InterventionType,
    context: EventGenerationContext
  ): EventType {
    switch (interventionType) {
      case InterventionType.EVENT_GENERATION:
        if (context.availableCharacters.length > 0) {
          return EventType.CHARACTER_APPEARANCE;
        }
        return EventType.ENVIRONMENTAL_CHANGE;
      
      case InterventionType.DIALOGUE_GUIDANCE:
        return EventType.CHARACTER_APPEARANCE;
      
      case InterventionType.INFORMATION_INTERFERENCE:
        return Math.random() > 0.5 ? EventType.ITEM_DISCOVERY : EventType.MEMORY_FLASHBACK;
      
      case InterventionType.ENVIRONMENT_CONTROL:
        return EventType.ENVIRONMENTAL_CHANGE;
      
      default:
        return EventType.SURPRISE_ENCOUNTER;
    }
  }

  /**
   * 选择随机事件类型
   */
  private selectRandomEventType(context: EventGenerationContext, creativity: number): EventType {
    const eventTypes = Object.values(EventType);
    
    // 根据创意度调整事件类型选择
    if (creativity > 80) {
      // 高创意度，偏向奇特事件
      const creativeEvents = [
        EventType.SURPRISE_ENCOUNTER,
        EventType.EMOTIONAL_TRIGGER,
        EventType.MEMORY_FLASHBACK
      ];
      return creativeEvents[Math.floor(Math.random() * creativeEvents.length)];
    } else if (creativity < 40) {
      // 低创意度，偏向常规事件
      const normalEvents = [
        EventType.CHARACTER_APPEARANCE,
        EventType.ITEM_DISCOVERY,
        EventType.ENVIRONMENTAL_CHANGE
      ];
      return normalEvents[Math.floor(Math.random() * normalEvents.length)];
    }

    // 中等创意度，随机选择
    return eventTypes[Math.floor(Math.random() * eventTypes.length)];
  }

  /**
   * 选择情节点事件类型
   */
  private selectEventTypeForPlotPoint(plotPoint: PlotPoint): EventType {
    const description = plotPoint.description.toLowerCase();
    
    if (description.includes('遇见') || description.includes('对话')) {
      return EventType.CHARACTER_APPEARANCE;
    }
    if (description.includes('发现') || description.includes('寻找')) {
      return EventType.ITEM_DISCOVERY;
    }
    if (description.includes('回忆') || description.includes('想起')) {
      return EventType.MEMORY_FLASHBACK;
    }
    if (description.includes('机会') || description.includes('选择')) {
      return EventType.OPPORTUNITY_PRESENTATION;
    }

    return EventType.SURPRISE_ENCOUNTER;
  }

  /**
   * 构建事件生成提示
   */
  private buildEventGenerationPrompt(
    eventType: EventType,
    intensity: InterventionIntensity,
    context: EventGenerationContext,
    targetOutcome: string
  ): string {
    return `
作为游戏事件生成AI，请生成一个${eventType}类型的事件：

当前情境:
- 位置: ${context.currentLocation}
- 玩家行动: ${context.playerAction}
- 故事风格: ${context.storyGenre}
- 干预强度: ${intensity}

目标结果: ${targetOutcome}

生成要求:
1. 事件应该${this.getIntensityDescription(intensity)}
2. 符合${context.storyGenre}的故事风格
3. 与当前位置${context.currentLocation}相匹配
4. 引导玩家朝向目标结果发展

请生成详细的事件信息，包括标题、描述、后果和选择。
`;
  }

  /**
   * 构建随机事件提示
   */
  private buildRandomEventPrompt(
    eventType: EventType,
    context: EventGenerationContext,
    creativity: number
  ): string {
    return `
作为自由模式事件生成AI，创造一个${eventType}类型的事件：

当前情境:
- 位置: ${context.currentLocation}
- 玩家行动: ${context.playerAction}
- 创意度: ${creativity}%
- 故事风格: ${context.storyGenre}

生成要求:
1. 事件的创意程度应该匹配${creativity}%的设定
2. 不应强制改变故事方向，而是提供有趣的可能性
3. 符合开放世界的探索精神
4. 给玩家提供有意义的选择

请生成有趣且富有创意的事件。
`;
  }

  /**
   * 构建情节点事件提示
   */
  private buildPlotPointEventPrompt(
    plotPoint: PlotPoint,
    eventType: EventType,
    context: EventGenerationContext
  ): string {
    return `
生成推进剧情的${eventType}事件：

剧情点信息:
- 标题: ${plotPoint.title}
- 描述: ${plotPoint.description}
- 预期结果: ${plotPoint.expectedOutcomes.join(', ')}
- 优先级: ${plotPoint.priority}/10

当前情境:
- 位置: ${context.currentLocation}
- 玩家行动: ${context.playerAction}

生成要求:
1. 事件应该推进当前剧情点的发展
2. 引导玩家朝向预期结果发展
3. 保持故事的自然流畅性
4. 提供符合剧情的选择机会

请生成符合剧情发展的事件。
`;
  }

  /**
   * 获取事件数据结构
   */
  private getEventSchema(): any {
    return {
      type: 'object',
      properties: {
        title: { type: 'string', description: '事件标题' },
        description: { type: 'string', description: '事件描述' },
        consequences: { 
          type: 'array', 
          items: { type: 'string' },
          description: '事件后果列表'
        },
        involvedCharacters: {
          type: 'array',
          items: { type: 'string' },
          description: '涉及的角色列表'
        },
        immediateEffects: {
          type: 'array',
          items: { type: 'string' },
          description: '立即效果'
        },
        longTermImpacts: {
          type: 'array',
          items: { type: 'string' },
          description: '长期影响'
        },
        playerChoices: {
          type: 'array',
          items: { type: 'string' },
          description: '玩家选择选项'
        }
      },
      required: ['title', 'description', 'consequences', 'immediateEffects']
    };
  }

  /**
   * 解析事件数据
   */
  private parseEventData(eventData: any, eventType: EventType): GeneratedEvent {
    return {
      type: eventType,
      title: eventData.title || `${eventType}事件`,
      description: eventData.description || '发生了一些事情...',
      consequences: eventData.consequences || [],
      involvedCharacters: eventData.involvedCharacters || [],
      locationChanges: {},
      immediateEffects: eventData.immediateEffects || [],
      longTermImpacts: eventData.longTermImpacts || [],
      playerChoices: eventData.playerChoices || []
    };
  }

  /**
   * 获取强度描述
   */
  private getIntensityDescription(intensity: InterventionIntensity): string {
    switch (intensity) {
      case InterventionIntensity.SUBTLE:
        return '微妙地引导，不显得突兀';
      case InterventionIntensity.MODERATE:
        return '明显但自然地影响情况';
      case InterventionIntensity.STRONG:
        return '强有力地改变当前状况';
      case InterventionIntensity.FORCED:
        return '不可忽视地强制引导';
      default:
        return '自然地发生';
    }
  }

  /**
   * 记录事件
   */
  private recordEvent(event: GeneratedEvent): void {
    this.recentEvents.push(`${event.type}: ${event.title}`);
    if (this.recentEvents.length > 50) {
      this.recentEvents = this.recentEvents.slice(-50);
    }
  }

  /**
   * 获取备用事件
   */
  private getFallbackEvent(eventType: EventType, context: EventGenerationContext): GeneratedEvent {
    const templates = this.eventTemplates.get(eventType) || ['发生了一些意想不到的事情'];
    const template = templates[Math.floor(Math.random() * templates.length)];

    return {
      type: eventType,
      title: '意外事件',
      description: template,
      consequences: ['情况发生了变化'],
      involvedCharacters: [],
      locationChanges: {},
      immediateEffects: ['玩家需要做出反应'],
      longTermImpacts: [],
      playerChoices: ['继续观察', '主动行动']
    };
  }
}