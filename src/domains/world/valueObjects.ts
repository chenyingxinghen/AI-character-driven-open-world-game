/**
 * 世界域值对象
 * 这些是不可变的值对象，代表世界域中的核心概念
 */

/**
 * 位置坐标值对象
 */
export interface Location {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

/**
 * 环境因素值对象
 */
export interface EnvironmentalFactors {
  readonly weather: string;
  readonly lighting: string;
  readonly temperature: number;
  readonly humidity: number;
  readonly noiseLevel: string;
  readonly visibility: number;
}

/**
 * 时间状态值对象
 */
export interface GameTime {
  readonly hour: number;
  readonly day: number;
  readonly month: number;
  readonly year: number;
  readonly season: string;
  readonly timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
}

/**
 * 场景描述值对象
 */
export interface SceneDescription {
  readonly visual: string;
  readonly ambient: string;
  readonly atmosphere: string;
  readonly mood: string;
}

/**
 * 位置连接值对象
 */
export interface LocationConnection {
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly connectionType: 'door' | 'path' | 'stairs' | 'portal' | 'hidden';
  readonly direction: string;
  readonly travelTime: number;
  readonly requirements?: string[];
}

/**
 * 世界事件值对象
 */
export interface WorldEvent {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly locationId: string;
  readonly timestamp: Date;
  readonly effects: readonly WorldEventEffect[];
  readonly participants?: readonly string[];
}

/**
 * 世界事件效果值对象
 */
export interface WorldEventEffect {
  readonly target: string;
  readonly property: string;
  readonly change: any;
  readonly duration?: number;
}

/**
 * 位置状态值对象
 */
export interface LocationState {
  readonly population: number;
  readonly accessibility: number;
  readonly dangerLevel: number;
  readonly activityLevel: number;
  readonly lastUpdated: Date;
}

/**
 * 区域值对象
 */
export interface Region {
  readonly id: string;
  readonly name: string;
  readonly type: 'urban' | 'rural' | 'wilderness' | 'dungeon' | 'special';
  readonly boundingBox: {
    readonly topLeft: Location;
    readonly bottomRight: Location;
  };
  readonly characteristics: readonly string[];
}