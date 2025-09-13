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
 * 性能监控器实体（增强版）
 * 收集和分析系统性能数据，支持实时监控、智能预警和自动优化建议
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private readonly maxMetricsHistory = 10000;
  private realtimeMetrics: Map<string, PerformanceMetrics[]> = new Map();
  private baselineMetrics: Map<string, { avgExecutionTime: number; avgMemoryUsage: number; successRate: number }> = new Map();
  private performanceAlerts: Array<{ operation: string; alertType: string; threshold: number; triggeredAt: Date }> = [];
  private trendAnalysis: Map<string, { slope: number; correlation: number; prediction: number }> = new Map();

  constructor(
    public readonly id: string,
    public readonly name: string
  ) {
    this.initializeBaselineCalculation();
  }

  /**
   * 记录性能指标（增强版）
   */
  recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // 保持历史记录在合理大小
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory / 2);
    }

    // 更新实时指标
    this.updateRealtimeMetrics(metric);
    
    // 检查性能异常
    this.checkPerformanceAnomalies(metric);
    
    // 更新趋势分析
    this.updateTrendAnalysis(metric);
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
    
    // 清理实时指标
    for (const [operation, metrics] of this.realtimeMetrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp > olderThan);
      if (filteredMetrics.length === 0) {
        this.realtimeMetrics.delete(operation);
      } else {
        this.realtimeMetrics.set(operation, filteredMetrics);
      }
    }
    
    // 清理过旧的预警
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.performanceAlerts = this.performanceAlerts.filter(alert => alert.triggeredAt > oneHourAgo);
  }

  /**
   * 初始化基线计算
   */
  private initializeBaselineCalculation(): void {
    // 每小时重新计算基线指标
    setInterval(() => {
      this.calculateBaselines();
    }, 60 * 60 * 1000); // 1小时
  }

  /**
   * 计算基线指标
   */
  private calculateBaselines(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyMetrics = this.metrics.filter(m => m.timestamp > oneWeekAgo && m.success);
    
    const operationGroups = this.groupMetricsByOperation(weeklyMetrics);
    
    for (const [operation, metrics] of operationGroups.entries()) {
      if (metrics.length < 10) continue; // 需要足够的数据样本
      
      const avgExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length;
      const avgMemoryUsage = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;
      const successRate = metrics.filter(m => m.success).length / metrics.length;
      
      this.baselineMetrics.set(operation, {
        avgExecutionTime,
        avgMemoryUsage,
        successRate
      });
    }
  }

  /**
   * 更新实时指标
   */
  private updateRealtimeMetrics(metric: PerformanceMetrics): void {
    const operation = metric.operation;
    const existing = this.realtimeMetrics.get(operation) || [];
    
    existing.push(metric);
    
    // 保持最近100个指标
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.realtimeMetrics.set(operation, existing);
  }

  /**
   * 检查性能异常
   */
  private checkPerformanceAnomalies(metric: PerformanceMetrics): void {
    const baseline = this.baselineMetrics.get(metric.operation);
    if (!baseline) return;
    
    const alerts: Array<{ alertType: string; threshold: number }> = [];
    
    // 检查执行时间异常
    if (metric.executionTime > baseline.avgExecutionTime * 2) {
      alerts.push({
        alertType: 'HIGH_EXECUTION_TIME',
        threshold: baseline.avgExecutionTime * 2
      });
    }
    
    // 检查内存使用异常
    if (metric.memoryUsage > baseline.avgMemoryUsage * 1.5) {
      alerts.push({
        alertType: 'HIGH_MEMORY_USAGE',
        threshold: baseline.avgMemoryUsage * 1.5
      });
    }
    
    // 检查失败率异常
    if (!metric.success && baseline.successRate > 0.95) {
      alerts.push({
        alertType: 'UNEXPECTED_FAILURE',
        threshold: 0.95
      });
    }
    
    // 记录预警
    for (const alert of alerts) {
      this.performanceAlerts.push({
        operation: metric.operation,
        alertType: alert.alertType,
        threshold: alert.threshold,
        triggeredAt: new Date()
      });
    }
  }

  /**
   * 更新趋势分析
   */
  private updateTrendAnalysis(metric: PerformanceMetrics): void {
    const recentMetrics = this.realtimeMetrics.get(metric.operation) || [];
    if (recentMetrics.length < 10) return;
    
    // 计算执行时间趋势
    const executionTimes = recentMetrics.map(m => m.executionTime);
    const slope = this.calculateTrendSlope(executionTimes);
    
    // 预测下一个执行时间
    const prediction = this.predictNextValue(executionTimes, slope);
    
    // 计算相关性（简化实现）
    const correlation = Math.abs(slope) > 5 ? 0.8 : 0.3;
    
    this.trendAnalysis.set(metric.operation, {
      slope,
      correlation,
      prediction
    });
  }

  /**
   * 计算趋势斜率
   */
  private calculateTrendSlope(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({length: n}, (_, i) => i);
    const y = values;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope || 0;
  }

  /**
   * 预测下一个值
   */
  private predictNextValue(values: number[], slope: number): number {
    if (values.length === 0) return 0;
    
    const lastValue = values[values.length - 1];
    return lastValue + slope;
  }

  /**
   * 获取实时性能指标
   */
  getRealtimeMetrics(operation?: string): PerformanceMetrics[] {
    if (operation) {
      return this.realtimeMetrics.get(operation) || [];
    }
    
    const allMetrics: PerformanceMetrics[] = [];
    for (const metrics of this.realtimeMetrics.values()) {
      allMetrics.push(...metrics);
    }
    
    return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 获取性能预警
   */
  getPerformanceAlerts(operation?: string): Array<{ operation: string; alertType: string; threshold: number; triggeredAt: Date }> {
    if (operation) {
      return this.performanceAlerts.filter(alert => alert.operation === operation);
    }
    return [...this.performanceAlerts];
  }

  /**
   * 获取趋势分析
   */
  getTrendAnalysis(operation?: string): Map<string, { slope: number; correlation: number; prediction: number }> {
    if (operation) {
      const trend = this.trendAnalysis.get(operation);
      const result = new Map<string, { slope: number; correlation: number; prediction: number }>();
      if (trend) {
        result.set(operation, trend);
      }
      return result;
    }
    return new Map(this.trendAnalysis);
  }

  /**
   * 获取智能优化建议
   */
  getOptimizationRecommendations(): Array<{
    operation: string;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendation: string;
    expectedImprovement: string;
  }> {
    const recommendations: Array<{
      operation: string;
      issue: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      recommendation: string;
      expectedImprovement: string;
    }> = [];
    
    for (const [operation, baseline] of this.baselineMetrics.entries()) {
      const recentMetrics = this.realtimeMetrics.get(operation) || [];
      if (recentMetrics.length === 0) continue;
      
      const recentAvgTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length;
      const recentAvgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
      const recentSuccessRate = recentMetrics.filter(m => m.success).length / recentMetrics.length;
      
      // 执行时间优化建议
      if (recentAvgTime > baseline.avgExecutionTime * 1.5) {
        const severity = recentAvgTime > baseline.avgExecutionTime * 3 ? 'critical' : 'high';
        recommendations.push({
          operation,
          issue: `Execution time increased by ${((recentAvgTime / baseline.avgExecutionTime - 1) * 100).toFixed(1)}%`,
          severity,
          recommendation: 'Consider implementing caching, optimizing algorithms, or adding more resources',
          expectedImprovement: `Reduce execution time by 30-50%`
        });
      }
      
      // 内存优化建议
      if (recentAvgMemory > baseline.avgMemoryUsage * 1.3) {
        const severity = recentAvgMemory > baseline.avgMemoryUsage * 2 ? 'high' : 'medium';
        recommendations.push({
          operation,
          issue: `Memory usage increased by ${((recentAvgMemory / baseline.avgMemoryUsage - 1) * 100).toFixed(1)}%`,
          severity,
          recommendation: 'Review memory leaks, optimize data structures, implement garbage collection',
          expectedImprovement: `Reduce memory usage by 20-40%`
        });
      }
      
      // 成功率优化建议
      if (recentSuccessRate < baseline.successRate * 0.9) {
        const severity = recentSuccessRate < baseline.successRate * 0.8 ? 'critical' : 'high';
        recommendations.push({
          operation,
          issue: `Success rate decreased by ${((1 - recentSuccessRate / baseline.successRate) * 100).toFixed(1)}%`,
          severity,
          recommendation: 'Investigate error patterns, implement retry logic, check external dependencies',
          expectedImprovement: `Improve success rate by 10-20%`
        });
      }
    }
    
    return recommendations.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
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
 * 错误追踪器实体（增强版）
 * 收集和分析系统错误，支持智能分类、自动恢复建议和错误预测
 */
export class ErrorTracker {
  private errors: ErrorRecord[] = [];
  private readonly maxErrorHistory = 5000;
  private errorPatterns: Map<string, { count: number; lastOccurred: Date; commonContext: Record<string, any> }> = new Map();
  private errorTrends: Map<string, { hourly: number[]; daily: number[]; trend: 'increasing' | 'decreasing' | 'stable' }> = new Map();
  private autoRecoveryAttempts: Map<string, { attempts: number; successRate: number; lastAttempt: Date }> = new Map();
  private errorCorrelations: Map<string, { relatedErrors: string[]; correlationStrength: number }> = new Map();

  constructor(public readonly id: string) {
    this.initializeErrorAnalysis();
  }

  /**
   * 记录错误（增强版）
   */
  recordError(error: ErrorRecord): void {
    this.errors.push(error);
    
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(-this.maxErrorHistory / 2);
    }
    
    // 更新错误模式
    this.updateErrorPatterns(error);
    
    // 更新错误趋势
    this.updateErrorTrends(error);
    
    // 检查错误关联性
    this.analyzeErrorCorrelations(error);
    
    // 尝试自动恢复
    if (this.shouldAttemptAutoRecovery(error)) {
      this.attemptAutoRecovery(error);
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
    
    // 清理过旧的错误模式
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [pattern, data] of this.errorPatterns.entries()) {
      if (data.lastOccurred < oneDayAgo) {
        this.errorPatterns.delete(pattern);
      }
    }
  }

  /**
   * 初始化错误分析
   */
  private initializeErrorAnalysis(): void {
    // 每小时更新错误趋势
    setInterval(() => {
      this.updateErrorTrendsHourly();
    }, 60 * 60 * 1000); // 1小时
  }

  /**
   * 更新错误模式
   */
  private updateErrorPatterns(error: ErrorRecord): void {
    const pattern = this.generateErrorPattern(error);
    const existing = this.errorPatterns.get(pattern);
    
    if (existing) {
      existing.count++;
      existing.lastOccurred = error.timestamp;
      
      // 更新常见上下文
      existing.commonContext = this.mergeContexts(existing.commonContext, error.context);
    } else {
      this.errorPatterns.set(pattern, {
        count: 1,
        lastOccurred: error.timestamp,
        commonContext: error.context
      });
    }
  }

  /**
   * 生成错误模式标识
   */
  private generateErrorPattern(error: ErrorRecord): string {
    // 基于错误类型、严重程度和部分消息生成模式
    const messageWords = error.message.split(' ').slice(0, 3).join(' '); // 前3个单词
    return `${error.type}_${error.severity}_${messageWords}`;
  }

  /**
   * 合并上下文
   */
  private mergeContexts(existing: Record<string, any>, newContext: Record<string, any>): Record<string, any> {
    const merged = { ...existing };
    
    for (const [key, value] of Object.entries(newContext)) {
      if (existing[key] && existing[key] === value) {
        // 相同值，增加权重
        merged[`${key}_frequency`] = (merged[`${key}_frequency`] || 1) + 1;
      } else {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  /**
   * 更新错误趋势
   */
  private updateErrorTrends(error: ErrorRecord): void {
    const errorType = error.type;
    const existing = this.errorTrends.get(errorType);
    
    if (!existing) {
      this.errorTrends.set(errorType, {
        hourly: new Array(24).fill(0),
        daily: new Array(7).fill(0),
        trend: 'stable'
      });
    }
    
    const trend = this.errorTrends.get(errorType)!;
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    
    trend.hourly[currentHour]++;
    trend.daily[currentDay]++;
    
    // 计算趋势
    trend.trend = this.calculateErrorTrend(trend.hourly);
  }

  /**
   * 每小时更新错误趋势
   */
  private updateErrorTrendsHourly(): void {
    for (const [errorType, trend] of this.errorTrends.entries()) {
      // 滚动窗口更新
      trend.hourly.shift();
      trend.hourly.push(0);
      
      // 重新计算趋势
      trend.trend = this.calculateErrorTrend(trend.hourly);
    }
  }

  /**
   * 计算错误趋势
   */
  private calculateErrorTrend(data: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (data.length < 3) return 'stable';
    
    const recent = data.slice(-6); // 最近6个数据点
    const earlier = data.slice(-12, -6); // 前6个数据点
    
    const recentSum = recent.reduce((a, b) => a + b, 0);
    const earlierSum = earlier.reduce((a, b) => a + b, 0);
    
    if (recentSum > earlierSum * 1.2) return 'increasing';
    if (recentSum < earlierSum * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * 分析错误关联性
   */
  private analyzeErrorCorrelations(error: ErrorRecord): void {
    const recentErrors = this.errors.filter(e => 
      e.timestamp > new Date(Date.now() - 60 * 60 * 1000) && // 最近1小时
      e.type !== error.type
    );
    
    const correlatedTypes = new Map<string, number>();
    
    for (const recentError of recentErrors) {
      const correlation = this.calculateCorrelation(error, recentError);
      if (correlation > 0.3) {
        correlatedTypes.set(recentError.type, correlation);
      }
    }
    
    if (correlatedTypes.size > 0) {
      const relatedErrors = Array.from(correlatedTypes.keys());
      const avgCorrelation = Array.from(correlatedTypes.values()).reduce((a, b) => a + b, 0) / correlatedTypes.size;
      
      this.errorCorrelations.set(error.type, {
        relatedErrors,
        correlationStrength: avgCorrelation
      });
    }
  }

  /**
   * 计算错误关联性
   */
  private calculateCorrelation(error1: ErrorRecord, error2: ErrorRecord): number {
    let correlation = 0;
    
    // 时间相关性
    const timeDiff = Math.abs(error1.timestamp.getTime() - error2.timestamp.getTime());
    if (timeDiff < 5 * 60 * 1000) { // 5分钟内
      correlation += 0.4;
    }
    
    // 上下文相关性
    const commonContextKeys = Object.keys(error1.context).filter(key => 
      error2.context.hasOwnProperty(key) && error1.context[key] === error2.context[key]
    );
    correlation += commonContextKeys.length * 0.1;
    
    // 严重程度相关性
    if (error1.severity === error2.severity) {
      correlation += 0.2;
    }
    
    return Math.min(1, correlation);
  }

  /**
   * 是否应该尝试自动恢复
   */
  private shouldAttemptAutoRecovery(error: ErrorRecord): boolean {
    // 只对特定类型的错误尝试自动恢复
    const recoverableTypes = ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'TEMPORARY_FAILURE'];
    if (!recoverableTypes.includes(error.type)) return false;
    
    // 检查失败率
    const attempts = this.autoRecoveryAttempts.get(error.type);
    if (attempts && attempts.successRate < 0.3) return false; // 成功率太低
    
    return true;
  }

  /**
   * 尝试自动恢复
   */
  private attemptAutoRecovery(error: ErrorRecord): void {
    const existing = this.autoRecoveryAttempts.get(error.type);
    
    if (existing) {
      existing.attempts++;
      existing.lastAttempt = new Date();
    } else {
      this.autoRecoveryAttempts.set(error.type, {
        attempts: 1,
        successRate: 0.5, // 初始预估成功率
        lastAttempt: new Date()
      });
    }
    
    // 这里可以实现具体的恢复逻辑
    // 例如：重试请求、重新连接、切换服务等
  }

  /**
   * 获取错误模式分析
   */
  getErrorPatterns(): Array<{
    pattern: string;
    count: number;
    lastOccurred: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
    commonContext: Record<string, any>;
  }> {
    const patterns = [];
    
    for (const [pattern, data] of this.errorPatterns.entries()) {
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      
      if (data.count > 10) severity = 'medium';
      if (data.count > 50) severity = 'high';
      if (data.count > 100) severity = 'critical';
      
      patterns.push({
        pattern,
        count: data.count,
        lastOccurred: data.lastOccurred,
        severity,
        commonContext: data.commonContext
      });
    }
    
    return patterns.sort((a, b) => b.count - a.count);
  }

  /**
   * 获取错误趋势
   */
  getErrorTrends(): Array<{
    errorType: string;
    hourlyData: number[];
    dailyData: number[];
    trend: 'increasing' | 'decreasing' | 'stable';
    prediction: number;
  }> {
    const trends = [];
    
    for (const [errorType, data] of this.errorTrends.entries()) {
      const prediction = this.predictNextHourErrors(data.hourly);
      
      trends.push({
        errorType,
        hourlyData: [...data.hourly],
        dailyData: [...data.daily],
        trend: data.trend,
        prediction
      });
    }
    
    return trends;
  }

  /**
   * 预测下一小时错误数
   */
  private predictNextHourErrors(hourlyData: number[]): number {
    if (hourlyData.length < 3) return 0;
    
    const recent = hourlyData.slice(-3);
    const average = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    // 简化的线性预测
    const trend = recent[2] - recent[0];
    return Math.max(0, Math.round(average + trend * 0.5));
  }

  /**
   * 获取错误关联分析
   */
  getErrorCorrelations(): Array<{
    errorType: string;
    relatedErrors: string[];
    correlationStrength: number;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const correlations = [];
    
    for (const [errorType, data] of this.errorCorrelations.entries()) {
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      
      if (data.correlationStrength > 0.5) riskLevel = 'medium';
      if (data.correlationStrength > 0.7) riskLevel = 'high';
      
      correlations.push({
        errorType,
        relatedErrors: data.relatedErrors,
        correlationStrength: data.correlationStrength,
        riskLevel
      });
    }
    
    return correlations.sort((a, b) => b.correlationStrength - a.correlationStrength);
  }

  /**
   * 获取智能恢复建议
   */
  getRecoveryRecommendations(): Array<{
    errorType: string;
    issue: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    autoRecoverySuccess: number;
    recommendation: string;
    preventiveMeasures: string[];
  }> {
    const recommendations = [];
    
    for (const [pattern, data] of this.errorPatterns.entries()) {
      const [errorType] = pattern.split('_');
      const autoRecovery = this.autoRecoveryAttempts.get(errorType);
      
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (data.count > 5) priority = 'medium';
      if (data.count > 20) priority = 'high';
      if (data.count > 50) priority = 'critical';
      
      const successRate = autoRecovery ? autoRecovery.successRate : 0;
      
      recommendations.push({
        errorType,
        issue: `Recurring error pattern: ${data.count} occurrences`,
        priority,
        autoRecoverySuccess: successRate,
        recommendation: this.generateRecoveryRecommendation(errorType, data.count, successRate),
        preventiveMeasures: this.generatePreventiveMeasures(errorType, data.commonContext)
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 生成恢复建议
   */
  private generateRecoveryRecommendation(errorType: string, count: number, successRate: number): string {
    const recommendations: Record<string, string> = {
      'NETWORK_ERROR': 'Implement connection pooling and retry mechanisms with exponential backoff',
      'TIMEOUT_ERROR': 'Increase timeout values and implement circuit breaker pattern',
      'TEMPORARY_FAILURE': 'Add health checks and automatic service discovery',
      'DATABASE_ERROR': 'Implement database connection monitoring and failover mechanisms',
      'API_ERROR': 'Add API rate limiting and implement graceful degradation'
    };
    
    let baseRecommendation = recommendations[errorType] || 'Investigate root cause and implement appropriate error handling';
    
    if (count > 20) {
      baseRecommendation += '. Consider implementing automated incident response';
    }
    
    if (successRate < 0.3) {
      baseRecommendation += '. Current auto-recovery is ineffective, manual intervention required';
    }
    
    return baseRecommendation;
  }

  /**
   * 生成预防措施
   */
  private generatePreventiveMeasures(errorType: string, context: Record<string, any>): string[] {
    const baseMeasures: Record<string, string[]> = {
      'NETWORK_ERROR': ['Monitor network latency', 'Implement redundant connections', 'Add network health checks'],
      'TIMEOUT_ERROR': ['Profile slow operations', 'Optimize database queries', 'Implement caching'],
      'TEMPORARY_FAILURE': ['Add comprehensive logging', 'Implement health monitoring', 'Set up alerting systems'],
      'DATABASE_ERROR': ['Monitor database performance', 'Implement connection limits', 'Add query optimization'],
      'API_ERROR': ['Monitor API response times', 'Implement rate limiting', 'Add API versioning']
    };
    
    const measures = baseMeasures[errorType] || ['Add comprehensive monitoring', 'Implement error tracking', 'Set up alerting'];
    
    // 基于上下文添加特定措施
    if (context.userId) {
      measures.push('Implement user-specific error tracking');
    }
    
    if (context.endpoint) {
      measures.push('Add endpoint-specific monitoring');
    }
    
    return measures;
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

  /**
   * 清理已解决的告警
   */
  cleanupResolvedAlerts(olderThan: Date): void {
    this.alertHistory = this.alertHistory.filter(alert => 
      !alert.resolvedAt || alert.resolvedAt > olderThan
    );
  }
}