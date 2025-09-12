/**
 * 输入域 - Input Domain
 * 
 * 职责范围：
 * - 用户输入分析和分类
 * - 意图识别和解析
 * - 复杂场景检测
 * - 输入预处理和标准化
 * - 上下文相关的输入解释
 * 
 * 不包含：
 * - 角色行为逻辑（由角色域处理）
 * - 世界状态变更（由世界域处理）
 * - 具体的业务执行（由相应域处理）
 */

export * from './entities';
export * from './services';
export * from './aggregates';
export * from './valueObjects';