/**
 * 游戏模式域实体
 * 这些实体具有唯一标识符和生命周期，代表业务中的核心概念
 */

import {
  GameModeType,
  ModeConfig,
  StoryOutline,
  PlotPoint,
  DeviationRecord,
  InterventionRecord,
  PlayerPreferences,
  GameModeState
} from './valueObjects';

/**
 * 游戏会话实体
 * 表示一个完整的游戏会话
 */
export class GameSession {
  private config: ModeConfig;
  private state: GameModeState;
  private events: Array<{ timestamp: Date; event: string; data: any }> = [];

  constructor(
    public readonly id: string,
    config: ModeConfig,
    public readonly playerId: string,
    public readonly createdAt: Date = new Date()
  ) {
    this.config = config;
    this.state = {
      currentMode: config.mode,
      isTransitioning: false,
      sessionStartTime: this.createdAt,
      totalPlayTime: 0,
      currentActivity: 'initializing',
      stateVariables: {}
    };
  }

  /**
   * 获取配置
   */
  getConfig(): ModeConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ModeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.addEvent('config_updated', { changes: newConfig });
  }

  /**
   * 获取状态
   */
  getState(): GameModeState {
    return { ...this.state };
  }

  /**
   * 更新状态
   */
  updateState(newState: Partial<GameModeState>): void {
    this.state = { ...this.state, ...newState };
    this.addEvent('state_updated', { changes: newState });
  }

  /**
   * 切换游戏模式
   */
  switchMode(newMode: GameModeType, newConfig: any): void {
    const oldMode = this.state.currentMode;
    this.state = {
      ...this.state,
      currentMode: newMode,
      isTransitioning: true
    };
    
    this.config = {
      ...this.config,
      mode: newMode,
      modeSpecificConfig: newConfig
    };

    this.addEvent('mode_switched', { 
      from: oldMode, 
      to: newMode,
      config: newConfig 
    });
  }

  /**
   * 完成模式切换
   */
  completeModeTransition(): void {
    this.state = {
      ...this.state,
      isTransitioning: false
    };
    this.addEvent('mode_transition_completed', {});
  }

  /**
   * 更新游戏时间
   */
  updatePlayTime(additionalMinutes: number): void {
    this.state = {
      ...this.state,
      totalPlayTime: this.state.totalPlayTime + additionalMinutes
    };
  }

  /**
   * 设置状态变量
   */
  setStateVariable(key: string, value: any): void {
    this.state = {
      ...this.state,
      stateVariables: {
        ...this.state.stateVariables,
        [key]: value
      }
    };
  }

  /**
   * 获取状态变量
   */
  getStateVariable(key: string): any {
    return this.state.stateVariables[key];
  }

  /**
   * 添加事件
   */
  private addEvent(eventType: string, data: any): void {
    this.events.push({
      timestamp: new Date(),
      event: eventType,
      data
    });
  }

  /**
   * 获取事件历史
   */
  getEventHistory(limit?: number): Array<{ timestamp: Date; event: string; data: any }> {
    const events = [...this.events];
    return limit ? events.slice(-limit) : events;
  }
}

/**
 * 故事进展实体
 * 跟踪剧本模式中的故事进展情况
 */
export class StoryProgress {
  private completedPlotPoints: Set<string> = new Set();
  private deviationHistory: DeviationRecord[] = [];
  private interventionHistory: InterventionRecord[] = [];
  private storyVariables: Map<string, any> = new Map();

  constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly storyOutline: StoryOutline,
    public readonly startedAt: Date = new Date()
  ) {}

  /**
   * 获取当前章节
   */
  getCurrentAct(): number {
    const totalActs = this.storyOutline.acts.length;
    const completedPoints = this.completedPlotPoints.size;
    const totalPoints = this.storyOutline.acts.reduce(
      (sum, act) => sum + act.plotPoints.length, 
      0
    );
    
    const progress = completedPoints / totalPoints;
    return Math.min(totalActs, Math.floor(progress * totalActs) + 1);
  }

  /**
   * 获取当前剧情点
   */
  getCurrentPlotPoint(): PlotPoint | null {
    const currentActIndex = this.getCurrentAct() - 1;
    if (currentActIndex >= this.storyOutline.acts.length) {
      return null; // 故事已完成
    }

    const currentAct = this.storyOutline.acts[currentActIndex];
    const uncompletedPoints = currentAct.plotPoints.filter(
      point => !this.completedPlotPoints.has(point.id)
    );

    // 返回优先级最高的未完成剧情点
    return uncompletedPoints.reduce((highest, current) => 
      !highest || current.priority > highest.priority ? current : highest
    , null as PlotPoint | null);
  }

  /**
   * 完成剧情点
   */
  completePlotPoint(plotPointId: string): boolean {
    if (this.completedPlotPoints.has(plotPointId)) {
      return false; // 已经完成
    }

    // 验证剧情点是否存在
    const exists = this.storyOutline.acts.some(act =>
      act.plotPoints.some(point => point.id === plotPointId)
    );

    if (!exists) {
      return false; // 剧情点不存在
    }

    this.completedPlotPoints.add(plotPointId);
    return true;
  }

  /**
   * 记录偏离
   */
  recordDeviation(deviation: DeviationRecord): void {
    this.deviationHistory.push(deviation);
  }

  /**
   * 记录干预
   */
  recordIntervention(intervention: InterventionRecord): void {
    this.interventionHistory.push(intervention);
  }

  /**
   * 计算总体偏离度
   */
  calculateOverallDeviation(): number {
    if (this.deviationHistory.length === 0) {
      return 0;
    }

    // 计算最近的偏离记录的加权平均
    const recentDeviations = this.deviationHistory.slice(-10);
    const weightedSum = recentDeviations.reduce((sum, record, index) => {
      const weight = (index + 1) / recentDeviations.length; // 越新的记录权重越高
      return sum + record.deviationScore * weight;
    }, 0);

    return weightedSum / recentDeviations.length;
  }

  /**
   * 获取故事完成度
   */
  getCompletionPercentage(): number {
    const totalPoints = this.storyOutline.acts.reduce(
      (sum, act) => sum + act.plotPoints.length, 
      0
    );
    
    if (totalPoints === 0) return 100;
    
    return (this.completedPlotPoints.size / totalPoints) * 100;
  }

  /**
   * 检查是否可以完成指定剧情点
   */
  canCompletePlotPoint(plotPointId: string): boolean {
    const plotPoint = this.findPlotPoint(plotPointId);
    if (!plotPoint) return false;

    // 检查前置条件
    return plotPoint.requiredConditions.every(condition => 
      this.checkCondition(condition)
    );
  }

  /**
   * 设置故事变量
   */
  setStoryVariable(key: string, value: any): void {
    this.storyVariables.set(key, value);
  }

  /**
   * 获取故事变量
   */
  getStoryVariable(key: string): any {
    return this.storyVariables.get(key);
  }

  /**
   * 获取偏离历史
   */
  getDeviationHistory(limit?: number): DeviationRecord[] {
    const history = [...this.deviationHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * 获取干预历史
   */
  getInterventionHistory(limit?: number): InterventionRecord[] {
    const history = [...this.interventionHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * 获取已完成的剧情点
   */
  getCompletedPlotPoints(): string[] {
    return Array.from(this.completedPlotPoints);
  }

  /**
   * 查找剧情点
   */
  private findPlotPoint(plotPointId: string): PlotPoint | null {
    for (const act of this.storyOutline.acts) {
      const point = act.plotPoints.find(p => p.id === plotPointId);
      if (point) return point;
    }
    return null;
  }

  /**
   * 检查条件
   */
  private checkCondition(condition: string): boolean {
    // 简化的条件检查逻辑
    // 实际实现应该更复杂，支持各种条件类型
    
    if (condition.startsWith('completed:')) {
      const plotPointId = condition.substring(10);
      return this.completedPlotPoints.has(plotPointId);
    }
    
    if (condition.startsWith('variable:')) {
      const [, variableName, operator, value] = condition.split(':');
      const variableValue = this.storyVariables.get(variableName);
      
      switch (operator) {
        case 'equals':
          return variableValue === value;
        case 'greater':
          return Number(variableValue) > Number(value);
        case 'less':
          return Number(variableValue) < Number(value);
        default:
          return false;
      }
    }
    
    // 默认返回true（条件检查通过）
    return true;
  }
}

/**
 * 导演控制器实体
 * 管理剧本模式中的导演干预逻辑
 */
export class DirectorController {
  private isActive: boolean = true;
  private interventionCooldown: Map<string, Date> = new Map();
  private interventionCount: number = 0;

  constructor(
    public readonly id: string,
    public readonly sessionId: string,
    public readonly interventionLevel: number, // 0-100
    public readonly deviationTolerance: number // 0-100
  ) {}

  /**
   * 判断是否应该干预
   */
  shouldIntervene(
    currentDeviation: number,
    recentInterventions: InterventionRecord[]
  ): boolean {
    if (!this.isActive) return false;
    
    // 检查偏离度是否超过容忍度
    if (currentDeviation < this.deviationTolerance) {
      return false;
    }

    // 检查最近的干预频率
    const recentInterventionCount = recentInterventions.filter(
      record => Date.now() - record.timestamp.getTime() < 300000 // 5分钟
    ).length;

    if (recentInterventionCount >= 3) {
      return false; // 避免过度干预
    }

    // 根据干预级别决定
    const threshold = 100 - this.interventionLevel;
    return currentDeviation > threshold;
  }

  /**
   * 设置干预冷却
   */
  setInterventionCooldown(interventionType: string, duration: number): void {
    const cooldownEnd = new Date(Date.now() + duration);
    this.interventionCooldown.set(interventionType, cooldownEnd);
  }

  /**
   * 检查是否在冷却中
   */
  isOnCooldown(interventionType: string): boolean {
    const cooldownEnd = this.interventionCooldown.get(interventionType);
    if (!cooldownEnd) return false;
    
    if (Date.now() > cooldownEnd.getTime()) {
      this.interventionCooldown.delete(interventionType);
      return false;
    }
    
    return true;
  }

  /**
   * 记录干预
   */
  recordIntervention(): void {
    this.interventionCount++;
  }

  /**
   * 获取干预统计
   */
  getInterventionStats(): {
    totalInterventions: number;
    activeCooldowns: string[];
    isActive: boolean;
  } {
    const activeCooldowns = Array.from(this.interventionCooldown.entries())
      .filter(([, endTime]) => Date.now() <= endTime.getTime())
      .map(([type]) => type);

    return {
      totalInterventions: this.interventionCount,
      activeCooldowns,
      isActive: this.isActive
    };
  }

  /**
   * 启用/禁用导演
   */
  setActive(active: boolean): void {
    this.isActive = active;
  }
}