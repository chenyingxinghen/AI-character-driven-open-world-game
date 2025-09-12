/**
 * 世界域聚合
 * 组合多个相关的服务和实体，提供统一的业务接口
 */

import { Logger } from '../../services/Logger';
import { LLMService } from '../../services/llm/LLMService';
import { GameWorld, GameLocation, GameScene } from './entities';
import { 
  Location, 
  EnvironmentalFactors, 
  GameTime, 
  SceneDescription,
  WorldEvent,
  Region 
} from './valueObjects';
import { 
  LocationGenerationService,
  EnvironmentManagementService,
  SceneDescriptionService,
  WorldEventService
} from './services';

/**
 * 世界管理器
 * 世界域的主要聚合根，协调所有世界相关的业务逻辑
 */
export class WorldManager {
  private world: GameWorld;
  private locationGenerationService: LocationGenerationService;
  private environmentService: EnvironmentManagementService;
  private sceneDescriptionService: SceneDescriptionService;
  private worldEventService: WorldEventService;
  
  constructor(
    private llmService: LLMService,
    private logger: Logger,
    initialTime?: GameTime
  ) {
    this.world = new GameWorld(initialTime);
    this.locationGenerationService = new LocationGenerationService(llmService, logger);
    this.environmentService = new EnvironmentManagementService(logger);
    this.sceneDescriptionService = new SceneDescriptionService(llmService, logger);
    this.worldEventService = new WorldEventService(logger);
  }

  /**
   * 获取游戏世界
   */
  getWorld(): GameWorld {
    return this.world;
  }

  /**
   * 初始化基础世界
   */
  async initializeWorld(): Promise<void> {
    this.logger.info('Initializing game world...');

    // 创建基础区域
    const townRegion: Region = {
      id: 'town_region',
      name: 'Town Region',
      type: 'urban',
      boundingBox: {
        topLeft: { x: -100, y: -100 },
        bottomRight: { x: 100, y: 100 }
      },
      characteristics: ['urban', 'populated', 'safe']
    };

    this.world.addRegion(townRegion);

    // 创建初始位置
    const townSquare = new GameLocation(
      'town_square',
      'Town Square',
      'A bustling town square with a fountain in the center, surrounded by shops and cafes.',
      { x: 0, y: 0 },
      'town_region'
    );

    const tavern = new GameLocation(
      'tavern',
      'The Golden Goblet Tavern',
      'A cozy tavern with warm lighting, filled with the aroma of ale and roasted meat.',
      { x: 20, y: 10 },
      'town_region'
    );

    this.world.addLocation(townSquare);
    this.world.addLocation(tavern);

    // 创建位置连接
    townSquare.addConnection({
      fromLocationId: 'town_square',
      toLocationId: 'tavern',
      connectionType: 'path',
      direction: 'northeast',
      travelTime: 2
    });

    tavern.addConnection({
      fromLocationId: 'tavern',
      toLocationId: 'town_square',
      connectionType: 'path',
      direction: 'southwest',
      travelTime: 2
    });

    // 创建初始场景
    await this.createInitialScenes();

    this.logger.info('World initialization completed');
  }

  /**
   * 处理位置移动
   */
  async processLocationMovement(
    currentLocationId: string,
    targetLocationId: string,
    playerId: string
  ): Promise<{
    success: boolean;
    message: string;
    newLocation?: GameLocation;
    travelTime: number;
    sceneDescription?: string;
  }> {
    const currentLocation = this.world.getLocation(currentLocationId);
    const targetLocation = this.world.getLocation(targetLocationId);

    if (!currentLocation || !targetLocation) {
      return {
        success: false,
        message: 'Invalid location specified',
        travelTime: 0
      };
    }

    // 检查是否可以到达
    if (!currentLocation.canReach(targetLocationId)) {
      return {
        success: false,
        message: `Cannot reach ${targetLocation.name} from ${currentLocation.name}`,
        travelTime: 0
      };
    }

    const connection = currentLocation.getConnection(targetLocationId);
    const travelTime = connection?.travelTime || 5;

    // 推进时间
    this.world.advanceTime(travelTime / 60); // 分钟转小时

    // 更新位置活动
    currentLocation.updateState({
      activityLevel: Math.max(0, currentLocation.getState().activityLevel - 5)
    });
    targetLocation.updateState({
      activityLevel: Math.min(100, targetLocation.getState().activityLevel + 5)
    });

    // 生成到达场景描述
    const scenes = this.world.getScenesByLocation(targetLocationId);
    let sceneDescription = '';
    
    if (scenes.length > 0) {
      sceneDescription = scenes[0].generateFullDescription();
    } else {
      sceneDescription = await this.generateArrivalDescription(targetLocation);
    }

    // 创建移动事件
    const movementEvent = this.worldEventService.createWorldEvent(
      'player_movement',
      `Player moved from ${currentLocation.name} to ${targetLocation.name}`,
      targetLocationId,
      [
        {
          target: 'location',
          property: 'activityLevel',
          change: 5
        }
      ],
      [playerId]
    );

    this.world.addGlobalEvent(movementEvent);
    targetLocation.addEvent(movementEvent);

    return {
      success: true,
      message: `Arrived at ${targetLocation.name}`,
      newLocation: targetLocation,
      travelTime,
      sceneDescription
    };
  }

  /**
   * 生成动态位置
   */
  async generateDynamicLocation(
    name: string,
    regionId: string,
    context: {
      theme?: string;
      purpose?: string;
      nearbyLocationIds?: string[];
    }
  ): Promise<GameLocation> {
    const nearbyLocations = context.nearbyLocationIds?.map(id => this.world.getLocation(id))
      .filter(Boolean) as GameLocation[] || [];

    const newLocation = await this.locationGenerationService.generateLocation(
      name,
      regionId,
      {
        nearbyLocations,
        theme: context.theme,
        purpose: context.purpose
      }
    );

    this.world.addLocation(newLocation);

    // 创建场景
    await this.createSceneForLocation(newLocation);

    // 创建位置生成事件
    const generationEvent = this.worldEventService.createWorldEvent(
      'location_generated',
      `New location "${name}" has been discovered`,
      newLocation.id,
      [],
      []
    );

    this.world.addGlobalEvent(generationEvent);

    return newLocation;
  }

  /**
   * 更新世界状态
   */
  updateWorldState(timeElapsed: number): void {
    const currentTime = this.world.getCurrentTime();

    // 更新所有场景的环境因素
    for (const location of this.world.getAllLocations()) {
      const scenes = this.world.getScenesByLocation(location.id);
      
      for (const scene of scenes) {
        const currentFactors = scene.getEnvironmentalFactors();
        const updatedFactors = this.environmentService.updateEnvironmentalFactors(
          currentFactors,
          timeElapsed,
          currentTime
        );
        scene.updateEnvironmentalFactors(updatedFactors);
      }
    }
  }

  /**
   * 处理世界事件
   */
  async processWorldEvent(event: WorldEvent): Promise<void> {
    this.logger.info(`Processing world event: ${event.type}`);

    // 应用事件效果
    this.worldEventService.applyEventEffects(event, this.world);

    // 添加到相关位置
    const location = this.world.getLocation(event.locationId);
    if (location) {
      location.addEvent(event);
    }

    // 添加到全局事件
    this.world.addGlobalEvent(event);
  }

  /**
   * 获取位置的完整上下文
   */
  async getLocationContext(locationId: string): Promise<{
    location: GameLocation;
    scene: GameScene | null;
    recentEvents: WorldEvent[];
    nearbyLocations: GameLocation[];
    currentTime: GameTime;
  }> {
    const location = this.world.getLocation(locationId);
    if (!location) {
      throw new Error(`Location not found: ${locationId}`);
    }

    const scenes = this.world.getScenesByLocation(locationId);
    const scene = scenes.length > 0 ? scenes[0] : null;
    const recentEvents = location.getRecentEvents(5);
    const nearbyLocations = this.findNearbyLocations(location, 3);
    const currentTime = this.world.getCurrentTime();

    return {
      location,
      scene,
      recentEvents,
      nearbyLocations,
      currentTime
    };
  }

  /**
   * 创建初始场景
   */
  private async createInitialScenes(): Promise<void> {
    const locations = this.world.getAllLocations();
    
    for (const location of locations) {
      await this.createSceneForLocation(location);
    }
  }

  /**
   * 为位置创建场景
   */
  private async createSceneForLocation(location: GameLocation): Promise<void> {
    const environmentalFactors: EnvironmentalFactors = {
      weather: 'sunny',
      lighting: 'bright',
      temperature: 20,
      humidity: 60,
      noiseLevel: 'moderate',
      visibility: 100
    };

    const sceneDescription = await this.sceneDescriptionService.generateSceneDescription(
      location,
      environmentalFactors,
      this.world.getCurrentTime()
    );

    const scene = new GameScene(
      `scene_${location.id}`,
      location.id,
      `${location.name} Scene`,
      environmentalFactors,
      sceneDescription
    );

    this.world.addScene(scene);
  }

  /**
   * 生成到达描述
   */
  private async generateArrivalDescription(location: GameLocation): Promise<string> {
    return `You arrive at ${location.name}. ${location.description}`;
  }

  /**
   * 查找附近位置
   */
  private findNearbyLocations(centerLocation: GameLocation, radius: number): GameLocation[] {
    const allLocations = this.world.getAllLocations();
    const nearby: GameLocation[] = [];

    for (const location of allLocations) {
      if (location.id === centerLocation.id) continue;

      const distance = this.calculateDistance(centerLocation.position, location.position);
      if (distance <= radius * 50) { // 50 units per radius level
        nearby.push(location);
      }
    }

    return nearby.sort((a, b) => {
      const distA = this.calculateDistance(centerLocation.position, a.position);
      const distB = this.calculateDistance(centerLocation.position, b.position);
      return distA - distB;
    });
  }

  /**
   * 计算距离
   */
  private calculateDistance(pos1: Location, pos2: Location): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}