/**
 * 运维域实体
 * 这些是有身份的业务对象，包含运维域的核心业务逻辑
 */

import { 
  PerformanceMetrics, 
  CostMetrics, 
  SystemHealth,
  BottleneckReport,
  ErrorRecord,
  ResourceUsage,
  AlertRule,
  Alert,
  HealthIssue 
} from './valueObjects';

/**
 * 性能监控器实体
 * 收集和分析系统性能数据
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetricsHistory = 10000;

  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}

  /**
   * 记录性能指标
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // 保持历史记录在合理大小
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory / 2);
    }
  }

  /**
   * 获取最近的性能指标
   */
  getRecentMetrics(count: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * 按操作类型获取指标
   */
  getMetricsByOperation(operation: string, timeWindow?: { start: Date; end: Date }): PerformanceMetrics[] {
    let filtered = this.metrics.filter(m => m.operation === operation);
    
    if (timeWindow) {
      filtered = filtered.filter(m => 
        m.timestamp >= timeWindow.start && m.timestamp <= timeWindow.end
      );
    }
    
    return filtered;
  }

  /**
   * 计算平均执行时间
   */
  getAverageExecutionTime(operation?: string, timeWindow?: { start: Date; end: Date }): number {
    let relevantMetrics = operation ? 
      this.getMetricsByOperation(operation, timeWindow) : 
      this.getMetricsInTimeWindow(timeWindow);

    if (relevantMetrics.length === 0) return 0;

    const totalTime = relevantMetrics.reduce((sum, m) => sum + m.executionTime, 0);
    return totalTime / relevantMetrics.length;
  }

  /**
   * 计算成功率
   */
  getSuccessRate(operation?: string, timeWindow?: { start: Date; end: Date }): number {
    let relevantMetrics = operation ? 
      this.getMetricsByOperation(operation, timeWindow) : 
      this.getMetricsInTimeWindow(timeWindow);

    if (relevantMetrics.length === 0) return 0;

    const successCount = relevantMetrics.filter(m => m.success).length;
    return successCount / relevantMetrics.length;
  }

  /**
   * 检测性能瓶颈
   */
  detectBottlenecks(thresholds: {
    executionTime: number;
    memoryUsage: number;
    errorRate: number;
  }): BottleneckReport[] {
    const reports: BottleneckReport[] = [];
    const recentMetrics = this.getRecentMetrics(1000);
    
    // 按操作分组
    const operationGroups = this.groupMetricsByOperation(recentMetrics);
    
    for (const [operation, metrics] of operationGroups.entries()) {
      // 检查执行时间瓶颈
      const avgExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
      if (avgExecutionTime > thresholds.executionTime) {
        reports.push({
          component: operation,
          bottleneckType: 'cpu',
          severity: Math.min(10, avgExecutionTime / thresholds.executionTime),
          description: `High execution time detected for ${operation}`,
          impact: `Average execution time: ${avgExecutionTime.toFixed(2)}ms`,
          recommendations: ['Optimize algorithm', 'Consider caching', 'Review database queries'],
          detectedAt: new Date()
        });
      }

      // 检查内存使用瓶颈
      const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;
      if (avgMemoryUsage > thresholds.memoryUsage) {
        reports.push({
          component: operation,
          bottleneckType: 'memory',
          severity: Math.min(10, avgMemoryUsage / thresholds.memoryUsage),
          description: `High memory usage detected for ${operation}`,
          impact: `Average memory usage: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
          recommendations: ['Review memory leaks', 'Optimize data structures', 'Implement garbage collection'],
          detectedAt: new Date()
        });
      }

      // 检查错误率
      const errorRate = 1 - this.getSuccessRate(operation);
      if (errorRate > thresholds.errorRate) {
        reports.push({
          component: operation,
          bottleneckType: 'external_api',
          severity: Math.min(10, errorRate / thresholds.errorRate * 10),
          description: `High error rate detected for ${operation}`,
          impact: `Error rate: ${(errorRate * 100).toFixed(2)}%`,
          recommendations: ['Review error handling', 'Implement retry logic', 'Check external dependencies'],
          detectedAt: new Date()
        });
      }
    }

    return reports;
  }

  /**
   * 获取时间窗口内的指标
   */
  private getMetricsInTimeWindow(timeWindow?: { start: Date; end: Date }): PerformanceMetrics[] {
    if (!timeWindow) return this.metrics;
    
    return this.metrics.filter(m => 
      m.timestamp >= timeWindow.start && m.timestamp <= timeWindow.end
    );
  }

  /**
   * 按操作分组指标
   */
  private groupMetricsByOperation(metrics: PerformanceMetrics[]): Map<string, PerformanceMetrics[]> {
    const groups = new Map<string, PerformanceMetrics[]>();
    
    for (const metric of metrics) {
      if (!groups.has(metric.operation)) {
        groups.set(metric.operation, []);
      }
      groups.get(metric.operation)!.push(metric);
    }
    
    return groups;
  }

  /**
   * 清理旧指标
   */
  cleanup(olderThan: Date): void {
    this.metrics = this.metrics.filter(m => m.timestamp > olderThan);
  }
}

/**
 * 成本追踪器实体
 * 追踪和分析API调用成本
 */
export class CostTracker {
  private costs: CostMetrics[] = [];
  private readonly maxCostHistory = 5000;

  constructor(
    public readonly id: string,
    public readonly currency: string = 'USD'
  ) {}

  /**
   * 记录成本
   */
  recordCost(cost: CostMetrics): void {
    this.costs.push(cost);
    
    if (this.costs.length > this.maxCostHistory) {
      this.costs = this.costs.slice(-this.maxCostHistory / 2);
    }
  }

  /**
   * 获取总成本
   */
  getTotalCost(timeWindow?: { start: Date; end: Date }): number {
    const relevantCosts = timeWindow ? 
      this.costs.filter(c => c.timestamp >= timeWindow.start && c.timestamp <= timeWindow.end) :
      this.costs;
    
    return relevantCosts.reduce((sum, c) => sum + c.cost, 0);
  }

  /**
   * 按提供商获取成本
   */
  getCostByProvider(provider: string, timeWindow?: { start: Date; end: Date }): number {
    const relevantCosts = this.costs.filter(c => c.provider === provider);
    
    if (timeWindow) {
      return relevantCosts
        .filter(c => c.timestamp >= timeWindow.start && c.timestamp <= timeWindow.end)
        .reduce((sum, c) => sum + c.cost, 0);
    }
    
    return relevantCosts.reduce((sum, c) => sum + c.cost, 0);
  }

  /**
   * 获取成本趋势
   */
  getCostTrend(days: number = 7): { date: string; cost: number }[] {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    const dailyCosts: { [key: string]: number } = {};
    
    // 初始化所有日期
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyCosts[dateStr] = 0;
    }
    
    // 计算每日成本
    for (const cost of this.costs) {
      if (cost.timestamp >= startDate && cost.timestamp <= endDate) {
        const dateStr = cost.timestamp.toISOString().split('T')[0];
        dailyCosts[dateStr] += cost.cost;
      }
    }
    
    return Object.entries(dailyCosts).map(([date, cost]) => ({ date, cost }));
  }

  /**
   * 清理旧成本记录
   */
  cleanup(olderThan: Date): void {
    this.costs = this.costs.filter(c => c.timestamp > olderThan);
  }
}

/**
 * 错误追踪器实体
 * 收集和分析系统错误
 */
export class ErrorTracker {
  private errors: ErrorRecord[] = [];
  private readonly maxErrorHistory = 5000;

  constructor(public readonly id: string) {}

  /**
   * 记录错误
   */
  recordError(error: ErrorRecord): void {
    this.errors.push(error);
    
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(-this.maxErrorHistory / 2);
    }
  }

  /**
   * 获取错误统计
   */
  getErrorStats(timeWindow?: { start: Date; end: Date }): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsBySeverity: Record<string, number>;
    resolvedErrors: number;
    unresolvedErrors: number;
  } {
    const relevantErrors = timeWindow ? 
      this.errors.filter(e => e.timestamp >= timeWindow.start && e.timestamp <= timeWindow.end) :
      this.errors;

    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};
    let resolvedErrors = 0;

    for (const error of relevantErrors) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
      
      if (error.resolved) {
        resolvedErrors++;
      }
    }

    return {
      totalErrors: relevantErrors.length,
      errorsByType,
      errorsBySeverity,
      resolvedErrors,
      unresolvedErrors: relevantErrors.length - resolvedErrors
    };
  }

  /**
   * 获取未解决的错误
   */
  getUnresolvedErrors(): ErrorRecord[] {
    return this.errors.filter(e => !e.resolved);
  }

  /**
   * 标记错误为已解决
   */
  resolveError(errorId: string, resolutionNotes: string): boolean {
    const errorIndex = this.errors.findIndex(e => e.id === errorId);
    if (errorIndex === -1) return false;

    this.errors[errorIndex] = {
      ...this.errors[errorIndex],
      resolved: true,
      resolutionNotes
    };

    return true;
  }

  /**
   * 清理旧错误记录
   */
  cleanup(olderThan: Date): void {
    this.errors = this.errors.filter(e => e.timestamp > olderThan);
  }
}

/**
 * 告警管理器实体
 * 管理告警规则和告警状态
 */
export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];

  constructor(public readonly id: string) {}

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * 更新告警规则
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    this.rules.set(ruleId, { ...rule, ...updates });
    return true;
  }

  /**
   * 删除告警规则
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * 检查指标并触发告警
   */
  checkMetric(metric: string, value: number): Alert[] {
    const triggeredAlerts: Alert[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.metric !== metric) continue;

      const shouldTrigger = this.evaluateRule(rule, value);
      
      if (shouldTrigger) {
        const existingAlert = Array.from(this.activeAlerts.values())
          .find(alert => alert.ruleId === rule.id);

        if (!existingAlert) {
          const alert: Alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ruleId: rule.id,
            ruleName: rule.name,
            metric: rule.metric,
            currentValue: value,
            threshold: rule.threshold,
            severity: rule.severity,
            message: `${rule.name}: ${metric} is ${value}, threshold is ${rule.threshold}`,
            triggeredAt: new Date(),
            acknowledged: false
          };

          this.activeAlerts.set(alert.id, alert);
          triggeredAlerts.push(alert);
        }
      } else {
        // 检查是否需要解决现有告警
        const existingAlert = Array.from(this.activeAlerts.values())
          .find(alert => alert.ruleId === rule.id);

        if (existingAlert) {
          this.resolveAlert(existingAlert.id);
        }
      }
    }

    return triggeredAlerts;
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    this.activeAlerts.set(alertId, {
      ...alert,
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: new Date()
    });

    return true;
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    const resolvedAlert: Alert = {
      ...alert,
      resolvedAt: new Date()
    };

    this.alertHistory.push(resolvedAlert);
    this.activeAlerts.delete(alertId);

    return true;
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(count: number = 100): Alert[] {
    return this.alertHistory.slice(-count);
  }

  /**
   * 评估告警规则
   */
  private evaluateRule(rule: AlertRule, value: number): boolean {
    switch (rule.operator) {
      case '>': return value > rule.threshold;
      case '<': return value < rule.threshold;
      case '>=': return value >= rule.threshold;
      case '<=': return value <= rule.threshold;
      case '=': return value === rule.threshold;
      default: return false;
    }
  }
}