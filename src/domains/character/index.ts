/**
 * 角色域 - Character Domain
 * 
 * 职责范围：
 * - 角色核心逻辑和行为
 * - 记忆管理和分析
 * - 情绪状态管理
 * - 角色关系管理
 * - 角色对话生成
 * - 行为决策逻辑
 * 
 * 不包含：
 * - 数据持久化（由基础设施层处理）
 * - 外部服务调用（由服务层处理）
 * - 位置和场景逻辑（由世界域处理）
 */

export * from './entities';
export * from './services';
export * from './aggregates';
export * from './valueObjects';