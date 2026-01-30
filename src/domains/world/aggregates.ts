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
 * 世界域的主要聚合根，协调所有 world 相关的业务逻辑
 */
export class WorldManager {
  private sessions: Map<string, GameWorld> = new Map();
  private currentSessionId?: string; // For legacy methods or internal state
  private locationGenerationService: LocationGenerationService;
  private environmentService: EnvironmentManagementService;
  private sceneDescriptionService: SceneDescriptionService;
  private worldEventService: WorldEventService;

  /**
   * 动态获取当前世界的 Getter（兼容旧代码）
   */
  get world(): GameWorld {
    if (!this.currentSessionId) {
      const defaultSessionId = 'default_session';
      if (!this.sessions.has(defaultSessionId)) {
        this.sessions.set(defaultSessionId, new GameWorld());
      }
      return this.sessions.get(defaultSessionId)!;
    }

    if (!this.sessions.has(this.currentSessionId)) {
      this.sessions.set(this.currentSessionId, new GameWorld());
    }
    return this.sessions.get(this.currentSessionId)!;
  }

  constructor(
    private llmService: LLMService,
    private logger: Logger,
    private databaseService?: any,
    initialTime?: GameTime
  ) {
    this.locationGenerationService = new LocationGenerationService(llmService, logger);
    this.environmentService = new EnvironmentManagementService(logger);
    this.sceneDescriptionService = new SceneDescriptionService(llmService, logger);
    this.worldEventService = new WorldEventService(logger);
  }

  private getSessionWorld(sessionId: string): GameWorld {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new GameWorld());
    }
    return this.sessions.get(sessionId)!;
  }

  /**
   * 获取游戏世界 (兼容接口)
   */
  getWorld(): GameWorld {
    return this.world;
  }

  /**
   * 初始化基础世界
   */
  async initializeWorld(): Promise<void> {
    this.logger.info('Initializing game world...');

    const world = this.world; // 使用当前 session 的 world

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

    world.addRegion(townRegion);

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

    world.addLocation(townSquare);
    world.addLocation(tavern);

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
   * 从数据库加载会话状态
   */
  async loadSessionState(sessionId: string): Promise<void> {
    if (!this.databaseService) {
      this.logger.warn('No database service available, skipping state load');
      return;
    }

    try {
      this.logger.info(`Loading session state for: ${sessionId}`);

      // 1. 加载位置
      const locationRecords = await this.databaseService.getLocationsBySession(sessionId);

      // 2. 准备该会话的全新世界对象
      const world = new GameWorld();
      this.sessions.set(sessionId, world);
      this.currentSessionId = sessionId;

      if (locationRecords.length === 0) {
        this.logger.info('No existing locations found for session, initializing defaults');
        await this.initializeWorld();
        return;
      }

      // 3. 构建位置实体
      for (const record of locationRecords) {
        const locationData = typeof record.location_data === 'string' ?
          JSON.parse(record.location_data) : record.location_data;

        const location = new GameLocation(
          record.id,
          record.name,
          record.description,
          { x: Number(record.position_x), y: Number(record.position_y) },
          record.region_id,
          record.location_type
        );

        // 恢复状态
        if (locationData && locationData.state) {
          location.updateState(locationData.state);
        }

        world.addLocation(location);
      }

      // 4. 第二轮循环：恢复连接
      for (const record of locationRecords) {
        const locationData = typeof record.location_data === 'string' ?
          JSON.parse(record.location_data) : record.location_data;

        if (locationData && locationData.connections && Array.isArray(locationData.connections)) {
          const fromLoc = world.getLocation(record.id);
          if (fromLoc) {
            for (const conn of locationData.connections) {
              fromLoc.addConnection(conn);
            }
          }
        }
      }

      // 5. 恢复场景
      for (const location of world.getAllLocations()) {
        await this.createSceneForLocation(location, sessionId);
      }

      this.logger.info(`Successfully loaded ${locationRecords.length} locations for session ${sessionId}`);
    } catch (error) {
      this.logger.error('Failed to load session state', error as Error);
      throw error;
    }
  }

  /**
   * 处理位置移动
   */
  async processLocationMovement(
    currentLocationId: string,
    targetLocationId: string,
    playerId: string,
    sessionId: string
  ): Promise<{
    success: boolean;
    message: string;
    newLocation?: GameLocation;
    travelTime: number;
    sceneDescription?: string;
  }> {
    this.currentSessionId = sessionId;
    const world = this.getSessionWorld(sessionId);
    const currentLocation = world.getLocation(currentLocationId);

    // 1. 尝试通过 ID 查找
    let targetLocation = world.getLocation(targetLocationId);

    // 2. 如果 ID 找不到，尝试通过名称查找
    if (!targetLocation) {
      targetLocation = world.getAllLocations().find(loc =>
        loc.name === targetLocationId || loc.name.toLowerCase() === targetLocationId.toLowerCase()
      );
    }

    let isNewLocation = false;

    if (!currentLocation) {
      return {
        success: false,
        message: 'Invalid current location specified',
        travelTime: 0
      };
    }

    // 如果目标位置不存在，尝试动态创建
    if (!targetLocation) {
      this.logger.warn(`Target location "${targetLocationId}" not found, attempting to create dynamically`);

      try {
        const dynamicLocationService = new DynamicLocationService(this.llmService, this.logger);
        const existingLocations = world.getAllLocations().map(loc => loc.name);

        // 生成动态位置定义
        const locationDefinition = await dynamicLocationService.generateLocation(
          targetLocationId,
          {
            currentLocation: currentLocation.name,
            gameStyle: 'fantasy_open_world',
            existingLocations
          }
        );

        // 创建新位置实体
        targetLocation = new GameLocation(
          locationDefinition.id,
          locationDefinition.name,
          locationDefinition.description,
          { x: Math.random() * 100, y: Math.random() * 100 },
          locationDefinition.region,
          'urban'
        );

        // 添加到世界
        world.addLocation(targetLocation);

        // 创建双向连接
        currentLocation.addConnection({
          fromLocationId: currentLocationId,
          toLocationId: targetLocation.id,
          connectionType: 'path',
          direction: 'unknown',
          travelTime: 5
        });

        targetLocation.addConnection({
          fromLocationId: targetLocation.id,
          toLocationId: currentLocationId,
          connectionType: 'path',
          direction: 'unknown',
          travelTime: 5
        });

        // 创建场景
        await this.createSceneForLocation(targetLocation, sessionId);

        // 数据持久化
        if (this.databaseService) {
          await this.persistLocationToDatabase(targetLocation, sessionId);
        }

        isNewLocation = true;
      } catch (error) {
        this.logger.error('Failed to dynamically create location', error as Error);
        return {
          success: false,
          message: `Cannot reach or create location: ${targetLocationId}`,
          travelTime: 0
        };
      }
    }

    // 检查可达性
    if (!isNewLocation && !currentLocation.canReach(targetLocation.id)) {
      return {
        success: false,
        message: `Cannot reach ${targetLocation.name} from ${currentLocation.name}`,
        travelTime: 0
      };
    }

    // 获取行程信息
    const connection = currentLocation.getConnection(targetLocation.id);
    const travelTime = connection?.travelTime || 5;

    // 状态更新
    world.advanceTime(travelTime / 60);
    currentLocation.updateState({ activityLevel: Math.max(0, currentLocation.getState().activityLevel - 5) });
    targetLocation.updateState({ activityLevel: Math.min(100, targetLocation.getState().activityLevel + 5) });

    // 获取场景描述
    const scenes = world.getScenesByLocation(targetLocation.id);
    let sceneDescription = scenes.length > 0 ?
      scenes[0].generateFullDescription() :
      await this.generateArrivalDescription(targetLocation);

    // 记录移动事件
    const movementEvent = this.worldEventService.createWorldEvent(
      'player_movement',
      `Player moved to ${targetLocation.name}`,
      targetLocation.id,
      [],
      [playerId]
    );

    world.addGlobalEvent(movementEvent);
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
   * 生成动态位置 (API 接口)
   */
  async generateDynamicLocation(
    name: string,
    regionId: string,
    context: {
      theme?: string;
      purpose?: string;
      nearbyLocationIds?: string[];
      sessionId: string;
    }
  ): Promise<GameLocation> {
    const world = this.getSessionWorld(context.sessionId);
    const nearbyLocations = context.nearbyLocationIds?.map(id => world.getLocation(id)).filter(Boolean) as GameLocation[] || [];

    const newLocation = await this.locationGenerationService.generateLocation(
      name,
      regionId,
      { nearbyLocations, theme: context.theme, purpose: context.purpose }
    );

    world.addLocation(newLocation);

    if (this.databaseService) {
      await this.persistLocationToDatabase(newLocation, context.sessionId).catch(err =>
        this.logger.error('Failed to persist dynamic location', err)
      );
    }

    await this.createSceneForLocation(newLocation, context.sessionId);
    return newLocation;
  }

  /**
   * 更新世界状态
   */
  updateWorldState(timeElapsed: number): void {
    const world = this.world;
    const currentTime = world.getCurrentTime();

    for (const location of world.getAllLocations()) {
      const scenes = world.getScenesByLocation(location.id);
      for (const scene of scenes) {
        const updatedFactors = this.environmentService.updateEnvironmentalFactors(
          scene.getEnvironmentalFactors(),
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
    const world = this.world;
    this.worldEventService.applyEventEffects(event, world);
    const location = world.getLocation(event.locationId);
    if (location) location.addEvent(event);
    world.addGlobalEvent(event);
  }

  /**
   * 获取位置上下文
   */
  async getLocationContext(locationId: string): Promise<{
    location: GameLocation;
    scene: GameScene | null;
    recentEvents: WorldEvent[];
    nearbyLocations: GameLocation[];
    currentTime: GameTime;
  }> {
    const world = this.world;
    const location = world.getLocation(locationId);
    if (!location) throw new Error(`Location not found: ${locationId}`);

    const scenes = world.getScenesByLocation(locationId);
    return {
      location,
      scene: scenes.length > 0 ? scenes[0] : null,
      recentEvents: location.getRecentEvents(5),
      nearbyLocations: this.findNearbyLocations(location, 3),
      currentTime: world.getCurrentTime()
    };
  }

  private async createInitialScenes(): Promise<void> {
    const world = this.world;
    for (const location of world.getAllLocations()) {
      await this.createSceneForLocation(location);
    }
  }

  private async createSceneForLocation(location: GameLocation, sessionId?: string): Promise<void> {
    const world = sessionId ? this.getSessionWorld(sessionId) : this.world;

    const environmentalFactors: EnvironmentalFactors = {
      weather: 'sunny', lighting: 'bright', temperature: 20, humidity: 60, noiseLevel: 'moderate', visibility: 100
    };

    const sceneDescription = await this.sceneDescriptionService.generateSceneDescription(
      location,
      environmentalFactors,
      world.getCurrentTime()
    );

    const scene = new GameScene(`scene_${location.id}`, location.id, `${location.name} Scene`, environmentalFactors, sceneDescription);
    world.addScene(scene);
  }

  private async generateArrivalDescription(location: GameLocation): Promise<string> {
    return `You arrive at ${location.name}. ${location.description}`;
  }

  private findNearbyLocations(centerLocation: GameLocation, radius: number): GameLocation[] {
    const world = this.world;
    return world.getAllLocations()
      .filter(loc => loc.id !== centerLocation.id)
      .filter(loc => this.calculateDistance(centerLocation.position, loc.position) <= radius * 50)
      .sort((a, b) => this.calculateDistance(centerLocation.position, a.position) - this.calculateDistance(centerLocation.position, b.position));
  }

  private calculateDistance(pos1: Location, pos2: Location): number {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
  }

  private async persistLocationToDatabase(location: GameLocation, sessionId: string): Promise<void> {
    if (!this.databaseService || !sessionId) return;
    try {
      await this.databaseService.createLocation({
        id: location.id,
        session_id: sessionId,
        name: location.name,
        description: location.description,
        location_type: location.locationType || 'urban',
        region_id: location.regionId,
        position_x: location.position.x,
        position_y: location.position.y,
        location_data: {
          state: location.getState(),
          connections: location.getAllConnections()
        }
      });
    } catch (error) {
      this.logger.error('Failed to persist location', error as Error);
    }
  }
}