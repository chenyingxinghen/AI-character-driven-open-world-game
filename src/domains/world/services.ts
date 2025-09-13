/**
 * 世界域服务
 * 这些服务包含世界域的业务逻辑，但不属于任何特定实体
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
import { 
  Location, 
  EnvironmentalFactors, 
  GameTime, 
  SceneDescription,
  WorldEvent,
  WorldEventEffect 
} from './valueObjects';
import { GameLocation, GameScene, GameWorld } from './entities';

/**
 * 位置生成服务
 * 处理动态位置生成的逻辑
 */
export class LocationGenerationService {
  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {}

  /**
   * 生成新位置
   */
  async generateLocation(
    name: string,
    regionId: string,
    context: {
      nearbyLocations?: GameLocation[];
      theme?: string;
      purpose?: string;
    }
  ): Promise<GameLocation> {
    this.logger.info(`Generating new location: ${name}`);

    // 生成位置描述
    const description = await this.generateLocationDescription(name, context);

    // 计算位置坐标
    const position = this.calculateLocationPosition(context.nearbyLocations);

    return new GameLocation(
      `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      position,
      regionId
    );
  }

  /**
   * 生成位置描述
   */
  private async generateLocationDescription(
    name: string, 
    context: any
  ): Promise<string> {
    const prompt = `
生成一个名为"${name}"的游戏位置描述。
上下文信息：
- 主题：${context.theme || '通用'}
- 用途：${context.purpose || '未指定'}
- 附近位置：${context.nearbyLocations?.map((l: GameLocation) => l.name).join(', ') || '无'}

请生成一个简洁但富有想象力的位置描述（50-100字）：
`;

    try {
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.8,
        maxTokens: 150
      });
      
      return response || `A ${context.purpose || 'mysterious'} place called ${name}`;
    } catch (error) {
      this.logger.error('Error generating location description:', error as Error);
      return `A ${context.purpose || 'mysterious'} place called ${name}`;
    }
  }

  /**
   * 计算位置坐标
   */
  private calculateLocationPosition(nearbyLocations?: GameLocation[]): Location {
    if (!nearbyLocations || nearbyLocations.length === 0) {
      return { x: 0, y: 0 };
    }

    // 在附近位置周围生成新坐标
    const avgX = nearbyLocations.reduce((sum, loc) => sum + loc.position.x, 0) / nearbyLocations.length;
    const avgY = nearbyLocations.reduce((sum, loc) => sum + loc.position.y, 0) / nearbyLocations.length;

    const offsetX = (Math.random() - 0.5) * 200; // ±100 单位偏移
    const offsetY = (Math.random() - 0.5) * 200;

    return {
      x: Math.round(avgX + offsetX),
      y: Math.round(avgY + offsetY)
    };
  }
}

/**
 * 环境管理服务
 * 处理环境因素的变化和影响
 */
export class EnvironmentManagementService {
  constructor(private logger: Logger) {}

  /**
   * 更新环境因素
   */
  updateEnvironmentalFactors(
    currentFactors: EnvironmentalFactors,
    timeElapsed: number,
    gameTime: GameTime
  ): EnvironmentalFactors {
    let newFactors = { ...currentFactors };

    // 基于时间变化调整光照
    newFactors = {
      ...newFactors,
      lighting: this.calculateLighting(gameTime),
      temperature: this.calculateTemperature(currentFactors.temperature, gameTime, timeElapsed)
    };

    // 天气变化
    if (Math.random() < 0.1) { // 10% 概率天气变化
      newFactors.weather = this.generateWeatherChange(currentFactors.weather);
    }

    return newFactors;
  }

  /**
   * 计算光照
   */
  private calculateLighting(gameTime: GameTime): string {
    switch (gameTime.timeOfDay) {
      case 'dawn': return 'dim';
      case 'morning': return 'bright';
      case 'afternoon': return 'bright';
      case 'evening': return 'dim';
      case 'night': return 'dark';
      default: return 'normal';
    }
  }

  /**
   * 计算温度
   */
  private calculateTemperature(
    currentTemp: number, 
    gameTime: GameTime, 
    timeElapsed: number
  ): number {
    // 基于时段调整温度
    let targetTemp = currentTemp;
    
    switch (gameTime.timeOfDay) {
      case 'dawn': targetTemp -= 2; break;
      case 'morning': targetTemp += 1; break;
      case 'afternoon': targetTemp += 3; break;
      case 'evening': targetTemp -= 1; break;
      case 'night': targetTemp -= 3; break;
    }

    // 季节影响
    switch (gameTime.season) {
      case 'spring': targetTemp += 5; break;
      case 'summer': targetTemp += 15; break;
      case 'autumn': targetTemp -= 5; break;
      case 'winter': targetTemp -= 15; break;
    }

    // 逐渐变化
    const changeRate = 0.1 * timeElapsed; // 每分钟0.1度变化
    return currentTemp + (targetTemp - currentTemp) * changeRate;
  }

  /**
   * 生成天气变化
   */
  private generateWeatherChange(currentWeather: string): string {
    const weatherTransitions: Record<string, string[]> = {
      'sunny': ['cloudy', 'partly_cloudy'],
      'cloudy': ['sunny', 'rainy', 'partly_cloudy'],
      'rainy': ['cloudy', 'stormy'],
      'stormy': ['rainy', 'cloudy'],
      'partly_cloudy': ['sunny', 'cloudy']
    };

    const possibleWeathers = weatherTransitions[currentWeather] || ['sunny', 'cloudy'];
    return possibleWeathers[Math.floor(Math.random() * possibleWeathers.length)];
  }
}

/**
 * 场景描述服务
 * 生成和更新场景描述
 */
export class SceneDescriptionService {
  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {}

  /**
   * 生成场景描述
   */
  async generateSceneDescription(
    location: GameLocation,
    environmentalFactors: EnvironmentalFactors,
    gameTime: GameTime,
    context?: {
      recentEvents?: WorldEvent[];
      mood?: string;
    }
  ): Promise<SceneDescription> {
    const prompt = this.buildSceneDescriptionPrompt(location, environmentalFactors, gameTime, context);

    try {
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.8,
        maxTokens: 300
      });
      
      const content = response || '';
      return this.parseSceneDescription(content);
    } catch (error) {
      this.logger.error('Error generating scene description:', error as Error);
      return this.getFallbackSceneDescription(location, environmentalFactors);
    }
  }

  /**
   * 构建场景描述提示
   */
  private buildSceneDescriptionPrompt(
    location: GameLocation,
    env: EnvironmentalFactors,
    time: GameTime,
    context?: any
  ): string {
    return `
生成场景描述：

位置信息：
- 名称：${location.name}
- 基础描述：${location.description}

环境条件：
- 天气：${env.weather}
- 光照：${env.lighting}
- 温度：${env.temperature}°C
- 噪音等级：${env.noiseLevel}

时间信息：
- 时段：${time.timeOfDay}
- 季节：${time.season}

${context?.mood ? `整体氛围：${context.mood}` : ''}

请生成包含以下四个方面的场景描述：
1. 视觉描述（visual）：描述可见的景象
2. 环境声音（ambient）：描述听到的声音
3. 氛围感受（atmosphere）：描述整体氛围
4. 情绪基调（mood）：描述情绪感受

格式：
视觉：[视觉描述]
声音：[环境声音]
氛围：[氛围感受]
情绪：[情绪基调]
`;
  }

  /**
   * 解析场景描述
   */
  private parseSceneDescription(content: string): SceneDescription {
    const lines = content.split('\n').filter(line => line.trim());
    
    let visual = '';
    let ambient = '';
    let atmosphere = '';
    let mood = '';

    for (const line of lines) {
      if (line.includes('视觉：') || line.includes('Visual:')) {
        visual = line.split('：')[1]?.trim() || line.split(':')[1]?.trim() || '';
      } else if (line.includes('声音：') || line.includes('Ambient:')) {
        ambient = line.split('：')[1]?.trim() || line.split(':')[1]?.trim() || '';
      } else if (line.includes('氛围：') || line.includes('Atmosphere:')) {
        atmosphere = line.split('：')[1]?.trim() || line.split(':')[1]?.trim() || '';
      } else if (line.includes('情绪：') || line.includes('Mood:')) {
        mood = line.split('：')[1]?.trim() || line.split(':')[1]?.trim() || '';
      }
    }

    return {
      visual: visual || content.substring(0, 100),
      ambient: ambient || 'Quiet ambiance fills the space.',
      atmosphere: atmosphere || 'A neutral atmosphere pervades.',
      mood: mood || 'calm'
    };
  }

  /**
   * 获取备用场景描述
   */
  private getFallbackSceneDescription(
    location: GameLocation,
    env: EnvironmentalFactors
  ): SceneDescription {
    return {
      visual: `${location.description} The ${env.weather} weather creates ${env.lighting} lighting.`,
      ambient: `The sounds of ${env.noiseLevel} activity can be heard in the distance.`,
      atmosphere: 'A peaceful atmosphere fills the area.',
      mood: 'tranquil'
    };
  }
}

/**
 * 世界事件处理服务
 * 处理世界事件的生成、传播和影响
 */
export class WorldEventService {
  constructor(private logger: Logger) {}

  /**
   * 创建世界事件
   */
  createWorldEvent(
    type: string,
    description: string,
    locationId: string,
    effects: WorldEventEffect[],
    participants?: string[]
  ): WorldEvent {
    return {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      locationId,
      timestamp: new Date(),
      effects,
      participants: participants || []
    };
  }

  /**
   * 应用事件效果
   */
  applyEventEffects(event: WorldEvent, world: GameWorld): void {
    this.logger.info(`Applying effects for event: ${event.type}`);

    for (const effect of event.effects) {
      this.applyEventEffect(effect, event.locationId, world);
    }
  }

  /**
   * 应用单个事件效果
   */
  private applyEventEffect(effect: WorldEventEffect, locationId: string, world: GameWorld): void {
    switch (effect.target) {
      case 'location':
        this.applyLocationEffect(effect, locationId, world);
        break;
      case 'environment':
        this.applyEnvironmentEffect(effect, locationId, world);
        break;
      case 'global':
        this.applyGlobalEffect(effect, world);
        break;
      default:
        this.logger.warn(`Unknown effect target: ${effect.target}`);
    }
  }

  /**
   * 应用位置效果
   */
  private applyLocationEffect(effect: WorldEventEffect, locationId: string, world: GameWorld): void {
    const location = world.getLocation(locationId);
    if (!location) return;

    const currentState = location.getState();
    const changes: any = {};

    switch (effect.property) {
      case 'population':
        changes.population = Math.max(0, currentState.population + effect.change);
        break;
      case 'dangerLevel':
        changes.dangerLevel = Math.max(0, Math.min(100, currentState.dangerLevel + effect.change));
        break;
      case 'activityLevel':
        changes.activityLevel = Math.max(0, Math.min(100, currentState.activityLevel + effect.change));
        break;
    }

    if (Object.keys(changes).length > 0) {
      location.updateState(changes);
    }
  }

  /**
   * 应用环境效果
   */
  private applyEnvironmentEffect(effect: WorldEventEffect, locationId: string, world: GameWorld): void {
    const scenes = world.getScenesByLocation(locationId);
    
    for (const scene of scenes) {
      const currentFactors = scene.getEnvironmentalFactors();
      const changes: any = {};

      switch (effect.property) {
        case 'temperature':
          changes.temperature = currentFactors.temperature + effect.change;
          break;
        case 'noiseLevel':
          changes.noiseLevel = effect.change;
          break;
        case 'lighting':
          changes.lighting = effect.change;
          break;
      }

      if (Object.keys(changes).length > 0) {
        scene.updateEnvironmentalFactors(changes);
      }
    }
  }

  /**
   * 应用全局效果
   */
  private applyGlobalEffect(effect: WorldEventEffect, world: GameWorld): void {
    // 全局效果可能影响时间、全局环境等
    this.logger.info(`Applying global effect: ${effect.property} = ${effect.change}`);
    
    switch (effect.property) {
      case 'time_advance':
        world.advanceTime(effect.change);
        break;
      // 可以添加更多全局效果
    }
  }
}

/**
 * 动态位置服务
 * 处理位置的动态生成、更新和管理
 */
export class DynamicLocationService {
  private locationTemplates: Map<string, any> = new Map();
  private procedureGenerators: Map<string, Function> = new Map();
  
  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {
    this.initializeLocationTemplates();
    this.initializeProcedureGenerators();
  }

  /**
   * 动态创建位置
   */
  async createDynamicLocation(
    name: string,
    regionId: string,
    playerContext: {
      level: number;
      preferences: string[];
      visitedLocations: string[];
    },
    worldContext: {
      currentTime: GameTime;
      nearbyLocations: GameLocation[];
      regionalTheme: string;
    }
  ): Promise<GameLocation> {
    this.logger.info(`Creating dynamic location: ${name}`);

    // 选择适合的位置模板
    const template = this.selectLocationTemplate(playerContext, worldContext);
    
    // 生成位置特性
    const features = await this.generateLocationFeatures(name, template, worldContext);
    
    // 创建位置实体
    const location = new GameLocation(
      `dyn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      features.description,
      features.position,
      regionId,
      template.locationType,
      features.initialState
    );
    
    // 添加动态特性
    this.applyDynamicFeatures(location, features);
    
    return location;
  }

  /**
   * 更新位置态态（基于玩家行为和时间）
   */
  updateLocationEcosystem(
    location: GameLocation,
    playerActions: Array<{
      type: string;
      timestamp: Date;
      impact: number;
    }>,
    currentTime: GameTime
  ): void {
    // 分析玩家行为影响
    const behaviorImpact = this.analyzeBehaviorImpact(playerActions);
    
    // 应用时间影响
    this.applyTemporalChanges(location, currentTime);
    
    // 应用行为影响
    this.applyBehaviorImpact(location, behaviorImpact);
    
    // 更新动态状态
    location.updateDynamicState(currentTime);
  }

  /**
   * 生成程序化内容
   */
  generateProceduralContent(
    location: GameLocation,
    contentType: 'items' | 'npcs' | 'events' | 'secrets',
    playerLevel: number
  ): any[] {
    const generator = this.procedureGenerators.get(contentType);
    if (!generator) {
      this.logger.warn(`No generator found for content type: ${contentType}`);
      return [];
    }
    
    return generator(location, playerLevel);
  }

  /**
   * 初始化位置模板
   */
  private initializeLocationTemplates(): void {
    // 城市模板
    this.locationTemplates.set('urban', {
      locationType: 'urban',
      baseResources: { 'gold': 50, 'information': 80, 'safety': 70 },
      commonFeatures: ['market', 'tavern', 'guard_post'],
      rarityModifiers: { 'common': 0.7, 'uncommon': 0.2, 'rare': 0.1 }
    });
    
    // 荒野模板
    this.locationTemplates.set('wilderness', {
      locationType: 'wilderness',
      baseResources: { 'herbs': 70, 'wood': 80, 'danger': 60 },
      commonFeatures: ['forest', 'river', 'cave'],
      rarityModifiers: { 'common': 0.5, 'uncommon': 0.3, 'rare': 0.2 }
    });
    
    // 地下模板
    this.locationTemplates.set('underground', {
      locationType: 'underground',
      baseResources: { 'minerals': 90, 'danger': 80, 'mystery': 70 },
      commonFeatures: ['tunnel', 'chamber', 'crystal'],
      rarityModifiers: { 'common': 0.3, 'uncommon': 0.4, 'rare': 0.3 }
    });
  }

  /**
   * 初始化程序生成器
   */
  private initializeProcedureGenerators(): void {
    // 物品生成器
    this.procedureGenerators.set('items', (location: GameLocation, playerLevel: number) => {
      const items = [];
      const itemCount = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < itemCount; i++) {
        items.push({
          id: `item_${Date.now()}_${i}`,
          name: this.generateItemName(location.locationType),
          type: this.selectItemType(location.locationType),
          value: Math.floor(Math.random() * playerLevel * 10) + 5
        });
      }
      
      return items;
    });
    
    // 事件生成器
    this.procedureGenerators.set('events', (location: GameLocation, playerLevel: number) => {
      const events = [];
      
      if (Math.random() < 0.3) { // 30%概率生成事件
        events.push({
          id: `event_${Date.now()}`,
          type: this.selectEventType(location.locationType),
          description: this.generateEventDescription(location),
          probability: Math.min(0.8, playerLevel * 0.1)
        });
      }
      
      return events;
    });
  }

  /**
   * 选择位置模板
   */
  private selectLocationTemplate(playerContext: any, worldContext: any): any {
    const availableTemplates = Array.from(this.locationTemplates.values());
    
    // 根据上下文选择最适合的模板
    if (worldContext.regionalTheme) {
      const matchingTemplate = this.locationTemplates.get(worldContext.regionalTheme);
      if (matchingTemplate) return matchingTemplate;
    }
    
    // 随机选择
    return availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
  }

  /**
   * 生成位置特性
   */
  private async generateLocationFeatures(name: string, template: any, worldContext: any): Promise<any> {
    const description = await this.generateDynamicDescription(name, template, worldContext);
    const position = this.calculateOptimalPosition(worldContext.nearbyLocations);
    
    const initialState = {
      population: Math.floor(Math.random() * 100),
      accessibility: 50 + Math.floor(Math.random() * 50),
      dangerLevel: template.baseResources.danger || 10,
      activityLevel: 30 + Math.floor(Math.random() * 40),
      lastUpdated: new Date(),
      prosperity: 50,
      security: 70,
      cleanliness: 60
    };
    
    return {
      description,
      position,
      initialState,
      resources: { ...template.baseResources },
      features: template.commonFeatures
    };
  }

  /**
   * 生成动态描述
   */
  private async generateDynamicDescription(name: string, template: any, worldContext: any): Promise<string> {
    const prompt = `
为名为"${name}"的${template.locationType}类型位置生成描述。

上下文：
- 时间：${worldContext.currentTime.timeOfDay}，${worldContext.currentTime.season}
- 区域主题：${worldContext.regionalTheme}
- 附近位置：${worldContext.nearbyLocations.map((l: GameLocation) => l.name).slice(0, 3).join(', ')}

请生成一个简洁但引人入胜的描述（50-100字）：
`;
    
    try {
      const response = await this.llmService.generateText(prompt, {
        temperature: 0.8,
        maxTokens: 150
      });
      
      return response || `A ${template.locationType} location named ${name}`;
    } catch (error) {
      this.logger.error('Error generating dynamic description:', error as Error);
      return `A ${template.locationType} location named ${name}`;
    }
  }

  // 简化的辅助方法
  private calculateOptimalPosition(nearbyLocations: GameLocation[]): Location {
    if (nearbyLocations.length === 0) {
      return { x: Math.random() * 1000, y: Math.random() * 1000 };
    }
    
    const avgX = nearbyLocations.reduce((sum, loc) => sum + loc.position.x, 0) / nearbyLocations.length;
    const avgY = nearbyLocations.reduce((sum, loc) => sum + loc.position.y, 0) / nearbyLocations.length;
    
    return {
      x: avgX + (Math.random() - 0.5) * 300,
      y: avgY + (Math.random() - 0.5) * 300
    };
  }

  private applyDynamicFeatures(location: GameLocation, features: any): void {
    // 添加资源
    for (const [resource, amount] of Object.entries(features.resources)) {
      location.addResource(resource, amount as number);
    }
  }
  
  private analyzeBehaviorImpact(actions: any[]): any {
    return { prosperity: 0, security: 0, cleanliness: 0 };
  }
  
  private applyTemporalChanges(location: GameLocation, currentTime: GameTime): void {
    // 时间影响逻辑
  }
  
  private applyBehaviorImpact(location: GameLocation, impact: any): void {
    // 行为影响逻辑
  }
  
  private generateItemName(locationType: string): string {
    const names = {
      urban: ['古董', '工具', '书籍'],
      wilderness: ['药草', '木材', '皙甩'],
      underground: ['水晶', '矿物', '宝石']
    };
    
    const typeNames = names[locationType as keyof typeof names] || names.urban;
    return typeNames[Math.floor(Math.random() * typeNames.length)];
  }
  
  private selectItemType(locationType: string): string {
    const types = {
      urban: 'tool',
      wilderness: 'resource',
      underground: 'treasure'
    };
    
    return types[locationType as keyof typeof types] || 'misc';
  }
  
  private selectEventType(locationType: string): string {
    const types = {
      urban: 'social',
      wilderness: 'encounter',
      underground: 'discovery'
    };
    
    return types[locationType as keyof typeof types] || 'random';
  }
  
  private generateEventDescription(location: GameLocation): string {
    return `Something interesting happens at ${location.name}`;
  }
}