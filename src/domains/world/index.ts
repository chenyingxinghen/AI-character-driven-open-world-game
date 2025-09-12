/**
 * 世界域 - World Domain
 * 
 * 职责范围：
 * - 游戏世界状态管理
 * - 位置和场景管理
 * - 环境因素管理
 * - 时间系统管理
 * - 世界事件处理
 * 
 * 不包含：
 * - 角色相关逻辑（由角色域处理）
 * - 输入处理（由输入域处理）
 * - 数据持久化（由基础设施层处理）
 */

export * from './entities';
export * from './services';
export * from './aggregates';
export * from './valueObjects';