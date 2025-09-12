/**
 * 世界域实体
 * 这些是有身份的业务对象，包含世界域的核心业务逻辑
 */

import { 
  Location, 
  EnvironmentalFactors, 
  GameTime, 
  SceneDescription,
  LocationConnection,
  WorldEvent,
  LocationState,
  Region 
} from './valueObjects';

/**
 * 游戏位置实体
 * 代表游戏世界中的一个具体位置
 */
export class GameLocation {
  private connections: Map<string, LocationConnection> = new Map();
  private events: WorldEvent[] = [];
  private state: LocationState;
  
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly position: Location,
    public readonly regionId: string,
    initialState?: LocationState
  ) {
    this.state = initialState || {
      population: 0,
      accessibility: 100,
      dangerLevel: 0,
      activityLevel: 50,
      lastUpdated: new Date()
    };
  }

  /**
   * 获取位置状态
   */
  getState(): LocationState {
    return this.state;
  }

  /**
   * 更新位置状态
   */
  updateState(changes: Partial<LocationState>): void {
    this.state = {
      ...this.state,
      ...changes,
      lastUpdated: new Date()
    };
  }

  /**
   * 添加连接
   */
  addConnection(connection: LocationConnection): void {
    this.connections.set(connection.toLocationId, connection);
  }

  /**
   * 获取连接
   */
  getConnection(targetLocationId: string): LocationConnection | undefined {
    return this.connections.get(targetLocationId);
  }

  /**
   * 获取所有连接
   */
  getAllConnections(): LocationConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * 删除连接
   */
  removeConnection(targetLocationId: string): void {
    this.connections.delete(targetLocationId);
  }

  /**
   * 添加事件
   */
  addEvent(event: WorldEvent): void {
    this.events.push(event);
    // 保持事件列表在合理大小
    if (this.events.length > 100) {
      this.events = this.events.slice(-50);
    }
  }

  /**
   * 获取最近的事件
   */
  getRecentEvents(count: number = 10): WorldEvent[] {
    return this.events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, count);
  }

  /**
   * 检查是否可以到达指定位置
   */
  canReach(targetLocationId: string): boolean {
    const connection = this.getConnection(targetLocationId);
    if (!connection) return false;
    
    // 检查可达性
    if (this.state.accessibility < 50) return false;
    
    // 检查连接要求
    if (connection.requirements && connection.requirements.length > 0) {
      // 这里应该检查玩家是否满足要求，简化实现
      return true;
    }
    
    return true;
  }
}

/**
 * 游戏场景实体
 * 代表游戏中的一个场景，包含位置、环境和描述
 */
export class GameScene {
  constructor(
    public readonly id: string,
    public readonly locationId: string,
    public readonly name: string,
    private environmentalFactors: EnvironmentalFactors,
    private sceneDescription: SceneDescription
  ) {}

  /**
   * 获取环境因素
   */
  getEnvironmentalFactors(): EnvironmentalFactors {
    return this.environmentalFactors;
  }

  /**
   * 更新环境因素
   */
  updateEnvironmentalFactors(changes: Partial<EnvironmentalFactors>): void {
    this.environmentalFactors = {
      ...this.environmentalFactors,
      ...changes
    };
  }

  /**
   * 获取场景描述
   */
  getSceneDescription(): SceneDescription {
    return this.sceneDescription;
  }

  /**
   * 更新场景描述
   */
  updateSceneDescription(changes: Partial<SceneDescription>): void {
    this.sceneDescription = {
      ...this.sceneDescription,
      ...changes
    };
  }

  /**
   * 生成完整的场景描述
   */
  generateFullDescription(): string {
    const env = this.environmentalFactors;
    const desc = this.sceneDescription;
    
    return `${desc.visual} ${desc.ambient} The weather is ${env.weather} with ${env.lighting} lighting. ${desc.atmosphere}`;
  }
}

/**
 * 游戏世界实体
 * 管理整个游戏世界的状态
 */
export class GameWorld {
  private locations: Map<string, GameLocation> = new Map();
  private scenes: Map<string, GameScene> = new Map();
  private regions: Map<string, Region> = new Map();
  private globalEvents: WorldEvent[] = [];
  private currentTime: GameTime;

  constructor(initialTime?: GameTime) {
    this.currentTime = initialTime || {
      hour: 12,
      day: 1,
      month: 1,
      year: 1,
      season: 'spring',
      timeOfDay: 'afternoon'
    };
  }

  /**
   * 添加位置
   */
  addLocation(location: GameLocation): void {
    this.locations.set(location.id, location);
  }

  /**
   * 获取位置
   */
  getLocation(locationId: string): GameLocation | undefined {
    return this.locations.get(locationId);
  }

  /**
   * 获取所有位置
   */
  getAllLocations(): GameLocation[] {
    return Array.from(this.locations.values());
  }

  /**
   * 删除位置
   */
  removeLocation(locationId: string): void {
    this.locations.delete(locationId);
  }

  /**
   * 添加场景
   */
  addScene(scene: GameScene): void {
    this.scenes.set(scene.id, scene);
  }

  /**
   * 获取场景
   */
  getScene(sceneId: string): GameScene | undefined {
    return this.scenes.get(sceneId);
  }

  /**
   * 根据位置获取场景
   */
  getScenesByLocation(locationId: string): GameScene[] {
    return Array.from(this.scenes.values()).filter(
      scene => scene.locationId === locationId
    );
  }

  /**
   * 添加区域
   */
  addRegion(region: Region): void {
    this.regions.set(region.id, region);
  }

  /**
   * 获取区域
   */
  getRegion(regionId: string): Region | undefined {
    return this.regions.get(regionId);
  }

  /**
   * 获取当前时间
   */
  getCurrentTime(): GameTime {
    return this.currentTime;
  }

  /**
   * 推进时间
   */
  advanceTime(hours: number): void {
    let newHour = this.currentTime.hour + hours;
    let newDay = this.currentTime.day;
    let newMonth = this.currentTime.month;
    let newYear = this.currentTime.year;

    // 处理小时溢出
    while (newHour >= 24) {
      newHour -= 24;
      newDay++;
    }

    // 处理天数溢出 (简化为每月30天)
    while (newDay > 30) {
      newDay -= 30;
      newMonth++;
    }

    // 处理月份溢出
    while (newMonth > 12) {
      newMonth -= 12;
      newYear++;
    }

    this.currentTime = {
      hour: newHour,
      day: newDay,
      month: newMonth,
      year: newYear,
      season: this.calculateSeason(newMonth),
      timeOfDay: this.calculateTimeOfDay(newHour)
    };
  }

  /**
   * 添加全局事件
   */
  addGlobalEvent(event: WorldEvent): void {
    this.globalEvents.push(event);
    // 保持事件列表在合理大小
    if (this.globalEvents.length > 1000) {
      this.globalEvents = this.globalEvents.slice(-500);
    }
  }

  /**
   * 获取最近的全局事件
   */
  getRecentGlobalEvents(count: number = 10): WorldEvent[] {
    return this.globalEvents
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, count);
  }

  /**
   * 计算季节
   */
  private calculateSeason(month: number): string {
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  /**
   * 计算时段
   */
  private calculateTimeOfDay(hour: number): GameTime['timeOfDay'] {
    if (hour >= 5 && hour < 7) return 'dawn';
    if (hour >= 7 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 20) return 'evening';
    return 'night';
  }
}