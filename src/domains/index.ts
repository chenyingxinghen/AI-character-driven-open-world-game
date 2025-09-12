/**
 * 领域层索引文件
 * 基于域驱动设计(DDD)重构游戏架构，实现职责清晰分离
 */

// 角色域 - 处理所有角色相关的业务逻辑
export * from './character';

// 世界域 - 处理游戏世界、位置、场景相关逻辑  
export * from './world';

// 输入域 - 处理所有输入分析和分类逻辑
export * from './input';

// 运维域 - 处理监控、分析、性能相关逻辑
export * from './operations';

// 领域协调器 - 管理各域之间的交互
export { DomainCoordinator, GameContext, DomainCoordinationResult } from './DomainCoordinator';