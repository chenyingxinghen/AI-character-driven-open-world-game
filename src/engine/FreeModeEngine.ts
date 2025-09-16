/**
 * 自由模式引擎
 * 负责处理自由模式下的游戏逻辑，提供无约束的创意体验
 */

import { Logger } from '../services/Logger';
import { LLMService } from '../services/llm/LLMService';
import { WorldManager } from '../domains/world/aggregates';
import { CharacterManager } from '../domains/character/aggregates';
import { FreeModeConfig } from '../domains/gameMode/valueObjects';

/**
 * 自由模式上下文
 */
export interface FreeModeContext {
  readonly sessionId: string;
  readonly playerId: string;
  readonly currentLocation: string;
  readonly worldSeed: string;
  readonly creativeFreedom: number;
  readonly eventRandomness: number;
  readonly recentActions: string[];
  readonly worldState: Record<string, any>;
}

/**
 * 自由模式响应
 */
export interface FreeModeResponse {
  readonly responseText: string;
  readonly worldChanges: string[];
  readonly newCharacters: string[];
  readonly newLocations: string[];
  readonly triggeredEvents: string[];
  readonly creativityScore: number;
}

/**
 * 自由模式引擎接口
 */
export interface IFreeModeEngine {
  initialize(config: FreeModeConfig): Promise<void>;
  processAction(action: string, context: FreeModeContext): Promise<FreeModeResponse>;
  generateRandomEvent(context: FreeModeContext): Promise<string>;
  createDynamicContent(request: string, context: FreeModeContext): Promise<any>;
  getWorldExpansionSuggestions(context: FreeModeContext): string[];
}

/**
 * 自由模式引擎实现
 */
export class FreeModeEngine implements IFreeModeEngine {
  private config: FreeModeConfig | null = null;
  private dynamicContentCache: Map<string, any> = new Map();
  private actionHistory: string[] = [];

  constructor(
    private llmService: LLMService,
    private worldManager: WorldManager,
    private characterManager: CharacterManager,
    private logger: Logger
  ) {}

  /**
   * 初始化自由模式引擎
   */
  async initialize(config: FreeModeConfig): Promise<void> {
    this.logger.info('Initializing Free Mode Engine', {
      config,
      component: 'FreeModeEngine'
    });

    this.config = config;
    this.dynamicContentCache.clear();
    this.actionHistory = [];

    // 根据配置初始化世界生成参数
    await this.setupWorldGeneration(config);

    this.logger.info('Free Mode Engine initialized successfully');
  }

  /**
   * 处理玩家行动
   */
  async processAction(action: string, context: FreeModeContext): Promise<FreeModeResponse> {
    if (!this.config) {
      throw new Error('Free Mode Engine not initialized');
    }

    this.logger.debug('Processing free mode action', {
      action,
      sessionId: context.sessionId,
      component: 'FreeModeEngine'
    });

    // 记录行动历史
    this.actionHistory.push(action);
    if (this.actionHistory.length > 50) {
      this.actionHistory = this.actionHistory.slice(-50);
    }

    const worldChanges: string[] = [];
    const newCharacters: string[] = [];
    const newLocations: string[] = [];
    const triggeredEvents: string[] = [];

    // 分析行动创意性
    const creativityScore = this.analyzeActionCreativity(action, context);

    // 生成基础响应
    let responseText = await this.generateBaseResponse(action, context);

    // 检查是否需要创建新内容
    await this.handleDynamicContentCreation(action, context, newCharacters, newLocations, worldChanges);

    // 处理随机事件
    if (this.shouldTriggerRandomEvent(context)) {
      const randomEvent = await this.generateRandomEvent(context);
      triggeredEvents.push(randomEvent);
      responseText += `\n\n突然，${randomEvent}`;
    }

    // 应用世界变化
    await this.applyWorldChanges(worldChanges, context);

    return {
      responseText,
      worldChanges,
      newCharacters,
      newLocations,
      triggeredEvents,
      creativityScore
    };
  }

  /**
   * 生成随机事件
   */
  async generateRandomEvent(context: FreeModeContext): Promise<string> {
    const eventPrompt = this.buildRandomEventPrompt(context);

    try {
      const event = await this.llmService.generateText(eventPrompt, {
        temperature: 0.9,
        maxTokens: 150
      });

      return event || '世界中发生了一些有趣的变化...';
    } catch (error) {
      this.logger.error('Failed to generate random event', error as Error);
      return '周围的环境发生了微妙的变化...';
    }
  }

  /**
   * 创建动态内容
   */
  async createDynamicContent(request: string, context: FreeModeContext): Promise<any> {
    this.logger.info('Creating dynamic content', {
      request,
      component: 'FreeModeEngine'
    });

    const cacheKey = `${request}_${context.currentLocation}`;
    if (this.dynamicContentCache.has(cacheKey)) {
      return this.dynamicContentCache.get(cacheKey);
    }

    const contentPrompt = this.buildDynamicContentPrompt(request, context);
    
    try {
      const content = await this.llmService.generateText(contentPrompt, {
        temperature: 0.8,
        maxTokens: 300
      });

      const parsedContent = this.parseDynamicContent(content || '', request);
      this.dynamicContentCache.set(cacheKey, parsedContent);
      
      return parsedContent;
    } catch (error) {
      this.logger.error('Failed to create dynamic content', error as Error);
      return this.getFallbackContent(request);
    }
  }

  /**
   * 获取世界扩展建议
   */
  getWorldExpansionSuggestions(context: FreeModeContext): string[] {
    const suggestions: string[] = [];

    // 基于创意自由度生成建议
    if (context.creativeFreedom > 70) {
      suggestions.push('创建一个全新的区域');
      suggestions.push('引入神秘的魔法元素');
      suggestions.push('开启一个意想不到的冒险');
    }

    // 基于最近行动生成建议
    const recentThemes = this.analyzeRecentThemes(context.recentActions);
    for (const theme of recentThemes) {
      suggestions.push(`探索更多${theme}相关的内容`);
    }

    // 基于世界状态生成建议
    if (Object.keys(context.worldState).length < 5) {
      suggestions.push('丰富当前区域的细节');
      suggestions.push('添加更多有趣的角色');
    }

    return suggestions.slice(0, 5); // 限制建议数量
  }

  /**
   * 设置世界生成
   */
  private async setupWorldGeneration(config: FreeModeConfig): Promise<void> {
    this.logger.debug('Setting up world generation', {
      worldGenerationType: config.worldGenerationType,
      component: 'FreeModeEngine'
    });

    // 根据配置调整世界生成参数
    // 这里可以设置各种生成参数，如位置密度、角色出现频率等
  }

  /**
   * 分析行动创意性
   */
  private analyzeActionCreativity(action: string, context: FreeModeContext): number {
    let creativityScore = 50; // 基础分数

    // 检查行动的独特性
    const similarActions = this.actionHistory.filter(pastAction => 
      this.calculateActionSimilarity(action, pastAction) > 0.7
    );
    
    if (similarActions.length === 0) {
      creativityScore += 20; // 全新的行动
    } else if (similarActions.length < 3) {
      creativityScore += 10; // 较少重复
    }

    // 检查行动的复杂性
    const actionComplexity = this.calculateActionComplexity(action);
    creativityScore += actionComplexity * 0.3;

    // 根据创意自由度调整
    const freedomBonus = (context.creativeFreedom - 50) * 0.2;
    creativityScore += freedomBonus;

    return Math.max(0, Math.min(100, creativityScore));
  }

  /**
   * 生成基础响应
   */
  private async generateBaseResponse(action: string, context: FreeModeContext): Promise<string> {
    const responsePrompt = this.buildResponsePrompt(action, context);

    try {
      const response = await this.llmService.generateText(responsePrompt, {
        temperature: 0.7 + (context.creativeFreedom / 200), // 根据创意自由度调整温度
        maxTokens: 250
      });

      return response || this.getFallbackResponse(action);
    } catch (error) {
      this.logger.error('Failed to generate base response', error as Error);
      return this.getFallbackResponse(action);
    }
  }

  /**
   * 处理动态内容创建
   */
  private async handleDynamicContentCreation(
    action: string,
    context: FreeModeContext,
    newCharacters: string[],
    newLocations: string[],
    worldChanges: string[]
  ): Promise<void> {
    if (!this.config?.characterCreationEnabled) return;

    // 检查是否暗示需要新角色
    if (this.detectCharacterCreationIntent(action)) {
      const characterName = await this.createDynamicCharacter(action, context);
      if (characterName) {
        newCharacters.push(characterName);
        worldChanges.push(`新角色 ${characterName} 出现了`);
      }
    }

    // 检查是否暗示需要新位置
    if (this.detectLocationCreationIntent(action)) {
      const locationName = await this.createDynamicLocation(action, context);
      if (locationName) {
        newLocations.push(locationName);
        worldChanges.push(`发现了新地点：${locationName}`);
      }
    }
  }

  /**
   * 判断是否应该触发随机事件
   */
  private shouldTriggerRandomEvent(context: FreeModeContext): boolean {
    const randomChance = context.eventRandomness / 100;
    const roll = Math.random();
    
    // 增加一些条件来影响随机事件触发
    let adjustedChance = randomChance;
    
    // 如果最近没有事件，增加触发机会
    if (context.recentActions.length > 5) {
      adjustedChance *= 1.5;
    }
    
    return roll < adjustedChance;
  }

  /**
   * 应用世界变化
   */
  private async applyWorldChanges(changes: string[], context: FreeModeContext): Promise<void> {
    for (const change of changes) {
      this.logger.debug('Applying world change', {
        change,
        sessionId: context.sessionId,
        component: 'FreeModeEngine'
      });
      
      // 这里可以实际修改世界状态
      // 例如：更新位置状态、角色状态等
    }
  }

  /**
   * 检测角色创建意图
   */
  private detectCharacterCreationIntent(action: string): boolean {
    const characterKeywords = ['寻找', '遇见', '找到', '某人', '角色', '人物', 'meet', 'find', 'someone'];
    return characterKeywords.some(keyword => action.toLowerCase().includes(keyword));
  }

  /**
   * 检测位置创建意图
   */
  private detectLocationCreationIntent(action: string): boolean {
    const locationKeywords = ['前往', '去', '探索', '发现', '地方', '位置', 'go', 'explore', 'discover', 'place'];
    return locationKeywords.some(keyword => action.toLowerCase().includes(keyword));
  }

  /**
   * 创建动态角色
   */
  private async createDynamicCharacter(action: string, context: FreeModeContext): Promise<string | null> {
    try {
      const characterPrompt = `基于玩家行动"${action}"，创建一个合适的角色。只返回角色名字：`;
      
      const characterName = await this.llmService.generateText(characterPrompt, {
        temperature: 0.8,
        maxTokens: 50
      });

      return characterName?.trim() || null;
    } catch (error) {
      this.logger.error('Failed to create dynamic character', error as Error);
      return null;
    }
  }

  /**
   * 创建动态位置
   */
  private async createDynamicLocation(action: string, context: FreeModeContext): Promise<string | null> {
    try {
      const locationPrompt = `基于玩家行动"${action}"，创建一个合适的地点。只返回地点名字：`;
      
      const locationName = await this.llmService.generateText(locationPrompt, {
        temperature: 0.8,
        maxTokens: 50
      });

      return locationName?.trim() || null;
    } catch (error) {
      this.logger.error('Failed to create dynamic location', error as Error);
      return null;
    }
  }

  /**
   * 构建随机事件提示
   */
  private buildRandomEventPrompt(context: FreeModeContext): string {
    return `
在开放世界游戏中生成一个随机事件：

当前位置: ${context.currentLocation}
创意自由度: ${context.creativeFreedom}%
最近行动: ${context.recentActions.slice(-3).join(', ')}

生成一个有趣但不会强制改变故事方向的随机事件（50字以内）：
`;
  }

  /**
   * 构建动态内容提示
   */
  private buildDynamicContentPrompt(request: string, context: FreeModeContext): string {
    return `
基于以下信息创建游戏内容：

请求: ${request}
当前位置: ${context.currentLocation}
创意设置: ${context.creativeFreedom}%
世界风格: 开放世界幻想

请创建详细的内容描述：
`;
  }

  /**
   * 构建响应提示
   */
  private buildResponsePrompt(action: string, context: FreeModeContext): string {
    return `
作为开放世界游戏的叙事AI，请响应玩家行动：

玩家行动: ${action}
当前位置: ${context.currentLocation}
创意自由度: ${context.creativeFreedom}%
最近行动: ${context.recentActions.slice(-3).join(', ')}

请生成一个鼓励创意探索的响应，保持开放和包容的态度：
`;
  }

  /**
   * 计算行动相似度
   */
  private calculateActionSimilarity(action1: string, action2: string): number {
    const words1 = action1.toLowerCase().split(/\s+/);
    const words2 = action2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  /**
   * 计算行动复杂度
   */
  private calculateActionComplexity(action: string): number {
    const words = action.split(/\s+/);
    const baseComplexity = Math.min(words.length * 2, 30);
    
    // 检查复杂动词和名词
    const complexWords = ['创造', '构建', '设计', '探索', '发现', '创新'];
    const complexWordCount = complexWords.filter(word => action.includes(word)).length;
    
    return baseComplexity + (complexWordCount * 10);
  }

  /**
   * 分析最近主题
   */
  private analyzeRecentThemes(recentActions: string[]): string[] {
    const themes: string[] = [];
    const actionText = recentActions.join(' ').toLowerCase();
    
    if (actionText.includes('战斗') || actionText.includes('攻击')) {
      themes.push('战斗');
    }
    if (actionText.includes('探索') || actionText.includes('寻找')) {
      themes.push('探索');
    }
    if (actionText.includes('对话') || actionText.includes('交谈')) {
      themes.push('社交');
    }
    if (actionText.includes('魔法') || actionText.includes('法术')) {
      themes.push('魔法');
    }
    
    return themes;
  }

  /**
   * 解析动态内容
   */
  private parseDynamicContent(content: string, request: string): any {
    // 简化的内容解析
    return {
      type: 'generated_content',
      description: content,
      request: request,
      timestamp: new Date()
    };
  }

  /**
   * 获取备用内容
   */
  private getFallbackContent(request: string): any {
    return {
      type: 'fallback_content',
      description: `关于${request}的内容正在生成中...`,
      request: request,
      timestamp: new Date()
    };
  }

  /**
   * 获取备用响应
   */
  private getFallbackResponse(action: string): string {
    const responses = [
      '你的行动在这个开放世界中产生了有趣的影响...',
      '世界以一种意想不到的方式回应了你的行动...',
      '你的创意想法在这个世界中找到了表达的空间...',
      '这个开放的世界为你的行动提供了无限的可能性...'
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }
}