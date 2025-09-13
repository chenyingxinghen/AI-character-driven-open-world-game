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
 * 游戏位置实体（增强版）
 * 代表游戏世界中的一个具体位置，包含动态特性
 */
export class GameLocation {
  private connections: Map<string, LocationConnection> = new Map();
  private events: WorldEvent[] = [];
  private state: LocationState;
  private resources: Map<string, number> = new Map();
  private occupants: Set<string> = new Set(); // 当前位置的角色ID
  private items: Map<string, number> = new Map(); // 物品和数量
  private weatherHistory: Array<{ weather: string; timestamp: Date }> = [];
  private visitHistory: Array<{ playerId: string; timestamp: Date }> = [];
  
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly description: string,
    public readonly position: Location,
    public readonly regionId: string,
    public readonly locationType: 'urban' | 'rural' | 'wilderness' | 'underground' | 'mystical' = 'urban',
    initialState?: LocationState
  ) {
    this.state = initialState || {
      population: 0,
      accessibility: 100,
      dangerLevel: 0,
      activityLevel: 50,
      lastUpdated: new Date(),
      prosperity: 50,
      security: 50,
      cleanliness: 50
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

  /**
   * 添加占据者（角色或玩家）
   */
  addOccupant(entityId: string): void {
    this.occupants.add(entityId);
    this.updateActivityLevel(5);
  }

  /**
   * 移除占据者
   */
  removeOccupant(entityId: string): void {
    this.occupants.delete(entityId);
    this.updateActivityLevel(-3);
  }

  /**
   * 获取当前占据者
   */
  getOccupants(): string[] {
    return Array.from(this.occupants);
  }

  /**
   * 添加资源
   */
  addResource(resourceType: string, amount: number): void {
    const current = this.resources.get(resourceType) || 0;
    this.resources.set(resourceType, current + amount);
  }

  /**
   * 消耗资源
   */
  consumeResource(resourceType: string, amount: number): boolean {
    const current = this.resources.get(resourceType) || 0;
    if (current >= amount) {
      this.resources.set(resourceType, current - amount);
      return true;
    }
    return false;
  }

  /**
   * 获取资源量
   */
  getResourceAmount(resourceType: string): number {
    return this.resources.get(resourceType) || 0;
  }

  /**
   * 添加物品
   */
  addItem(itemId: string, quantity: number = 1): void {
    const current = this.items.get(itemId) || 0;
    this.items.set(itemId, current + quantity);
  }

  /**
   * 移除物品
   */
  removeItem(itemId: string, quantity: number = 1): boolean {
    const current = this.items.get(itemId) || 0;
    if (current >= quantity) {
      const newAmount = current - quantity;
      if (newAmount === 0) {
        this.items.delete(itemId);
      } else {
        this.items.set(itemId, newAmount);
      }
      return true;
    }
    return false;
  }

  /**
   * 获取所有物品
   */
  getItems(): Array<{ id: string; quantity: number }> {
    return Array.from(this.items.entries()).map(([id, quantity]) => ({ id, quantity }));
  }

  /**
   * 记录访问历史
   */
  recordVisit(playerId: string): void {
    this.visitHistory.push({ playerId, timestamp: new Date() });
    
    // 保持访问历史在合理大小
    if (this.visitHistory.length > 100) {
      this.visitHistory = this.visitHistory.slice(-50);
    }
  }

  /**
   * 获取访问统计
   */
  getVisitStatistics(): {
    totalVisits: number;
    uniqueVisitors: number;
    recentVisits: number;
    popularityScore: number;
  } {
    const totalVisits = this.visitHistory.length;
    const uniqueVisitors = new Set(this.visitHistory.map(v => v.playerId)).size;
    
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前
    const recentVisits = this.visitHistory.filter(v => v.timestamp > recentCutoff).length;
    
    const popularityScore = Math.min(100, (recentVisits * 10) + (uniqueVisitors * 5));
    
    return {
      totalVisits,
      uniqueVisitors,
      recentVisits,
      popularityScore
    };
  }

  /**
   * 更新活动等级
   */
  private updateActivityLevel(delta: number): void {
    const newLevel = Math.max(0, Math.min(100, this.state.activityLevel + delta));
    this.updateState({ activityLevel: newLevel });
  }

  /**
   * 动态更新状态（基于时间和事件）
   */
  updateDynamicState(currentTime: GameTime): void {
    const timeDelta = Date.now() - this.state.lastUpdated.getTime();
    const hoursPassed = timeDelta / (1000 * 60 * 60);
    
    // 自然恢复趋向
    const activityDecay = Math.max(0, this.state.activityLevel - (hoursPassed * 2));
    const dangerRecovery = Math.max(0, this.state.dangerLevel - (hoursPassed * 1));
    
    // 基于位置类型的特性调整
    let baseActivity = 50;
    let baseDanger = 10;
    
    switch (this.locationType) {
      case 'urban':
        baseActivity = 70;
        baseDanger = 5;
        break;
      case 'wilderness':
        baseActivity = 20;
        baseDanger = 30;
        break;
      case 'underground':
        baseActivity = 10;
        baseDanger = 50;
        break;
      case 'mystical':
        baseActivity = 40;
        baseDanger = 25;
        break;
    }
    
    this.updateState({
      activityLevel: Math.max(baseActivity, activityDecay),
      dangerLevel: Math.max(baseDanger, dangerRecovery)
    });
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