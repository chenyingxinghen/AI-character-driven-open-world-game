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
import { DynamicLocationService } from '../../services/world/DynamicLocationService';

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
    private databaseService?: any,
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
    let targetLocation = this.world.getLocation(targetLocationId);
    let isNewLocation = false; // 标记是否是新创建的位置

    if (!currentLocation) {
      return {
        success: false,
        message: 'Invalid current location specified',
        travelTime: 0
      };
    }

    // 如果目标位置不存在，尝试动态创建
    if (!targetLocation) {
      this.logger.warn(`Target location "${targetLocationId}" not found, attempting to create dynamically`, {
        component: 'WorldManager',
        currentLocationId,
        targetLocationId
      });
      
      try {
        // 尝试通过动态位置服务创建新位置
        const dynamicLocationService = new DynamicLocationService(this.llmService, this.logger);
        
        // 获取所有现有位置名称
        const existingLocations = this.world.getAllLocations().map(loc => loc.name);
        
        // 生成动态位置
        const locationDefinition = await dynamicLocationService.generateLocation(
          targetLocationId, // 使用ID作为名称
          {
            currentLocation: currentLocation.name,
            gameStyle: 'fantasy_open_world',
            existingLocations
          }
        );
        
        this.logger.info('Generated location definition', {
          component: 'WorldManager',
          locationDefinition
        });
        
        // 创建新位置
        targetLocation = new GameLocation(
          locationDefinition.id,
          locationDefinition.name,
          locationDefinition.description,
          { x: Math.random() * 100, y: Math.random() * 100 }, // 随机位置
          locationDefinition.region,
          'urban'
        );
        
        // 添加到世界
        this.world.addLocation(targetLocation);
        
        this.logger.info('Added new location to world', {
          component: 'WorldManager',
          locationId: targetLocation.id,
          locationName: targetLocation.name
        });
        
        // 创建双向连接 - 从当前位置到新位置
        currentLocation.addConnection({
          fromLocationId: currentLocationId,
          toLocationId: targetLocation.id,
          connectionType: 'path',
          direction: 'unknown',
          travelTime: 5
        });
        
        // 创建双向连接 - 从新位置到当前位置
        targetLocation.addConnection({
          fromLocationId: targetLocation.id,
          toLocationId: currentLocationId,
          connectionType: 'path',
          direction: 'unknown',
          travelTime: 5
        });
        
        // 创建额外的连接到其他现有位置，提高世界的连通性
        const allLocations = this.world.getAllLocations();
        const otherLocations = allLocations.filter(loc => 
          loc.id !== currentLocationId && loc.id !== targetLocation!.id
        );
        
        // 随机选择1-2个其他位置建立连接
        const shuffledLocations = [...otherLocations].sort(() => 0.5 - Math.random());
        const locationsToConnect = shuffledLocations.slice(0, Math.min(2, shuffledLocations.length));
        
        for (const location of locationsToConnect) {
          // 从新位置到其他位置的连接
          targetLocation!.addConnection({
            fromLocationId: targetLocation!.id,
            toLocationId: location.id,
            connectionType: 'path',
            direction: 'unknown',
            travelTime: 7
          });
          
          // 从其他位置到新位置的连接
          location.addConnection({
            fromLocationId: location.id,
            toLocationId: targetLocation!.id,
            connectionType: 'path',
            direction: 'unknown',
            travelTime: 7
          });
        }
        
        // 创建场景
        await this.createSceneForLocation(targetLocation);
        
        this.logger.info(`Dynamically created new location: ${targetLocation.name}`, {
          component: 'WorldManager',
          locationId: targetLocation.id,
          connectionsCreated: 1 + locationsToConnect.length
        });
        
        isNewLocation = true; // 标记为新创建的位置
      } catch (error) {
        this.logger.error('Failed to dynamically create location', error as Error, {
          component: 'WorldManager',
          targetLocationId
        });
        
        return {
          success: false,
          message: `Cannot reach or create location: ${targetLocationId}`,
          travelTime: 0
        };
      }
    }

    // 检查是否可以到达（仅对已存在的位置进行检查）
    if (!isNewLocation && !currentLocation.canReach(targetLocationId)) {
      return {
        success: false,
        message: `Cannot reach ${targetLocation.name} from ${currentLocation.name}`,
        travelTime: 0
      };
    }

    // 获取连接和旅行时间
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

    // 持久化位置到数据库
    if (this.databaseService) {
      await this.persistLocationToDatabase(newLocation).catch(error => {
        this.logger.warn('Failed to persist location to database', error, {
          locationId: newLocation.id,
          component: 'WorldManager'
        });
      });
    }

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

  /**
   * 持久化位置到数据库
   */
  private async persistLocationToDatabase(location: GameLocation): Promise<void> {
    if (!this.databaseService) {
      return;
    }

    try {
      const locationRecord = {
        id: location.id,
        name: location.name,
        description: location.description,
        location_type: location.locationType || 'general',
        region_id: location.regionId,
        position_x: location.position.x,
        position_y: location.position.y,
        location_data: JSON.stringify({
          state: location.getState(),
          connections: location.getAllConnections().map(conn => ({
            fromLocationId: conn.fromLocationId,
            toLocationId: conn.toLocationId,
            connectionType: conn.connectionType,
            direction: conn.direction,
            travelTime: conn.travelTime
          }))
        })
      };

      await this.databaseService.createLocation(locationRecord);
    } catch (error) {
      this.logger.error('Failed to persist location to database', error as Error, {
        locationId: location.id,
        component: 'WorldManager'
      });
      throw error;
    }
  }
}