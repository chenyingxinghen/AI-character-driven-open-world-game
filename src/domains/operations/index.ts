/**
 * 运维域 - Operations Domain
 * 
 * 职责范围：
 * - 系统性能监控
 * - 成本追踪和分析
 * - 错误检测和处理
 * - 系统健康状况监控
 * - 分析和报告生成
 * 
 * 不包含：
 * - 业务逻辑（由其他域处理）
 * - 数据持久化（由基础设施层处理）
 * - 用户交互（由应用层处理）
 */

export * from './entities';
export * from './services';
export * from './aggregates';
export * from './valueObjects';