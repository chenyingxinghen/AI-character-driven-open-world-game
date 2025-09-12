/**
 * 运维域服务
 * 这些服务包含运维域的业务逻辑，但不属于任何特定实体
 */

import { Logger } from '../../services/Logger';
import { 
  PerformanceMetrics, 
  CostMetrics, 
  SystemHealth,
  BottleneckReport,
  ErrorRecord,
  ResourceUsage,
  AnalyticsReport,
  HealthIssue 
} from './valueObjects';

/**
 * 系统健康检查服务
 * 监控系统整体健康状况
 */
export class SystemHealthService {
  constructor(private logger: Logger) {}

  /**
   * 执行系统健康检查
   */
  async performHealthCheck(
    performanceData: PerformanceMetrics[],
    errorData: ErrorRecord[],
    resourceUsage: ResourceUsage
  ): Promise<SystemHealth> {
    const issues: HealthIssue[] = [];
    
    // 检查性能问题
    const performanceIssues = this.checkPerformanceHealth(performanceData);
    issues.push(...performanceIssues);
    
    // 检查错误率
    const errorIssues = this.checkErrorHealth(errorData);
    issues.push(...errorIssues);
    
    // 检查资源使用
    const resourceIssues = this.checkResourceHealth(resourceUsage);
    issues.push(...resourceIssues);
    
    // 计算整体状态
    const status = this.calculateOverallStatus(issues);
    
    // 计算响应时间
    const responseTime = this.calculateAverageResponseTime(performanceData);
    
    // 计算错误率
    const errorRate = this.calculateErrorRate(errorData);
    
    return {
      status,
      uptime: this.calculateUptime(),
      responseTime,
      errorRate,
      throughput: this.calculateThroughput(performanceData),
      timestamp: new Date(),
      issues
    };
  }

  /**
   * 检查性能健康状况
   */
  private checkPerformanceHealth(performanceData: PerformanceMetrics[]): HealthIssue[] {
    const issues: HealthIssue[] = [];
    
    if (performanceData.length === 0) return issues;
    
    // 检查平均响应时间
    const avgResponseTime = performanceData.reduce((sum, p) => sum + p.executionTime, 0) / performanceData.length;
    if (avgResponseTime > 2000) { // 2秒阈值
      issues.push({
        severity: avgResponseTime > 5000 ? 'critical' : 'high',
        category: 'performance',
        description: `High average response time: ${avgResponseTime.toFixed(2)}ms`,
        firstOccurred: new Date(),
        lastOccurred: new Date(),
        count: 1
      });
    }
    
    // 检查内存使用
    const avgMemoryUsage = performanceData.reduce((sum, p) => sum + p.memoryUsage, 0) / performanceData.length;
    if (avgMemoryUsage > 500 * 1024 * 1024) { // 500MB阈值
      issues.push({
        severity: avgMemoryUsage > 1024 * 1024 * 1024 ? 'critical' : 'medium',
        category: 'memory',
        description: `High memory usage: ${(avgMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
        firstOccurred: new Date(),
        lastOccurred: new Date(),
        count: 1
      });
    }
    
    return issues;
  }

  /**
   * 检查错误健康状况
   */
  private checkErrorHealth(errorData: ErrorRecord[]): HealthIssue[] {
    const issues: HealthIssue[] = [];
    
    if (errorData.length === 0) return issues;
    
    // 检查错误率
    const recentErrors = errorData.filter(e => 
      e.timestamp > new Date(Date.now() - 60 * 60 * 1000) // 最近1小时
    );
    
    if (recentErrors.length > 10) {
      issues.push({
        severity: recentErrors.length > 50 ? 'critical' : 'high',
        category: 'errors',
        description: `High error count in the last hour: ${recentErrors.length} errors`,
        firstOccurred: new Date(),
        lastOccurred: new Date(),
        count: recentErrors.length
      });
    }
    
    // 检查严重错误
    const criticalErrors = recentErrors.filter(e => e.severity === 'critical');
    if (criticalErrors.length > 0) {
      issues.push({
        severity: 'critical',
        category: 'critical_errors',
        description: `Critical errors detected: ${criticalErrors.length} in the last hour`,
        firstOccurred: new Date(),
        lastOccurred: new Date(),
        count: criticalErrors.length
      });
    }
    
    return issues;
  }

  /**
   * 检查资源健康状况
   */
  private checkResourceHealth(resourceUsage: ResourceUsage): HealthIssue[] {
    const issues: HealthIssue[] = [];
    
    // 检查内存使用率
    if (resourceUsage.memory.percentage > 80) {
      issues.push({
        severity: resourceUsage.memory.percentage > 95 ? 'critical' : 'high',
        category: 'memory',
        description: `High memory usage: ${resourceUsage.memory.percentage.toFixed(1)}%`,
        firstOccurred: new Date(),
        lastOccurred: new Date(),
        count: 1
      });
    }
    
    // 检查CPU使用率
    if (resourceUsage.cpu.usage > 80) {
      issues.push({
        severity: resourceUsage.cpu.usage > 95 ? 'critical' : 'high',
        category: 'cpu',
        description: `High CPU usage: ${resourceUsage.cpu.usage.toFixed(1)}%`,
        firstOccurred: new Date(),
        lastOccurred: new Date(),
        count: 1
      });
    }
    
    // 检查存储使用率
    if (resourceUsage.storage.percentage > 85) {
      issues.push({
        severity: resourceUsage.storage.percentage > 95 ? 'critical' : 'medium',
        category: 'storage',
        description: `High storage usage: ${resourceUsage.storage.percentage.toFixed(1)}%`,
        firstOccurred: new Date(),
        lastOccurred: new Date(),
        count: 1
      });
    }
    
    return issues;
  }

  /**
   * 计算整体状态
   */
  private calculateOverallStatus(issues: HealthIssue[]): SystemHealth['status'] {
    if (issues.length === 0) return 'healthy';
    
    const hasCritical = issues.some(i => i.severity === 'critical');
    if (hasCritical) return 'critical';
    
    const hasHigh = issues.some(i => i.severity === 'high');
    if (hasHigh) return 'warning';
    
    return 'warning';
  }

  /**
   * 计算平均响应时间
   */
  private calculateAverageResponseTime(performanceData: PerformanceMetrics[]): number {
    if (performanceData.length === 0) return 0;
    
    const totalTime = performanceData.reduce((sum, p) => sum + p.executionTime, 0);
    return totalTime / performanceData.length;
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(errorData: ErrorRecord[]): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentErrors = errorData.filter(e => e.timestamp > oneHourAgo);
    
    // 简化计算：假设每小时有100个请求作为基准
    const estimatedRequests = 100;
    return Math.min(1, recentErrors.length / estimatedRequests);
  }

  /**
   * 计算运行时间
   */
  private calculateUptime(): number {
    // 简化实现：返回系统启动以来的时间（毫秒）
    return Date.now() - this.getSystemStartTime();
  }

  /**
   * 计算吞吐量
   */
  private calculateThroughput(performanceData: PerformanceMetrics[]): number {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentMetrics = performanceData.filter(p => p.timestamp > oneMinuteAgo);
    
    return recentMetrics.length; // 每分钟的操作数
  }

  /**
   * 获取系统启动时间（简化实现）
   */
  private getSystemStartTime(): number {
    // 在实际实现中，这应该从系统启动时记录的时间戳获取
    return Date.now() - 24 * 60 * 60 * 1000; // 假设24小时前启动
  }
}

/**
 * 分析报告生成服务
 * 生成各种分析报告
 */
export class AnalyticsReportService {
  constructor(private logger: Logger) {}

  /**
   * 生成性能报告
   */
  generatePerformanceReport(
    performanceData: PerformanceMetrics[],
    period: { start: Date; end: Date }
  ): AnalyticsReport {
    const filteredData = performanceData.filter(p => 
      p.timestamp >= period.start && p.timestamp <= period.end
    );

    const metrics = this.calculatePerformanceMetrics(filteredData);
    const insights = this.generatePerformanceInsights(metrics);
    const recommendations = this.generatePerformanceRecommendations(metrics);

    return {
      reportType: 'performance',
      period,
      metrics,
      insights,
      recommendations,
      generatedAt: new Date()
    };
  }

  /**
   * 生成成本报告
   */
  generateCostReport(
    costData: CostMetrics[],
    period: { start: Date; end: Date }
  ): AnalyticsReport {
    const filteredData = costData.filter(c => 
      c.timestamp >= period.start && c.timestamp <= period.end
    );

    const metrics = this.calculateCostMetrics(filteredData);
    const insights = this.generateCostInsights(metrics);
    const recommendations = this.generateCostRecommendations(metrics);

    return {
      reportType: 'cost',
      period,
      metrics,
      insights,
      recommendations,
      generatedAt: new Date()
    };
  }

  /**
   * 生成错误报告
   */
  generateErrorReport(
    errorData: ErrorRecord[],
    period: { start: Date; end: Date }
  ): AnalyticsReport {
    const filteredData = errorData.filter(e => 
      e.timestamp >= period.start && e.timestamp <= period.end
    );

    const metrics = this.calculateErrorMetrics(filteredData);
    const insights = this.generateErrorInsights(metrics);
    const recommendations = this.generateErrorRecommendations(metrics);

    return {
      reportType: 'error',
      period,
      metrics,
      insights,
      recommendations,
      generatedAt: new Date()
    };
  }

  /**
   * 计算性能指标
   */
  private calculatePerformanceMetrics(data: PerformanceMetrics[]): Record<string, any> {
    if (data.length === 0) {
      return {
        totalOperations: 0,
        averageExecutionTime: 0,
        successRate: 0,
        averageMemoryUsage: 0
      };
    }

    const totalOperations = data.length;
    const averageExecutionTime = data.reduce((sum, p) => sum + p.executionTime, 0) / totalOperations;
    const successfulOperations = data.filter(p => p.success).length;
    const successRate = successfulOperations / totalOperations;
    const averageMemoryUsage = data.reduce((sum, p) => sum + p.memoryUsage, 0) / totalOperations;

    // 按操作类型分组统计
    const operationStats: Record<string, any> = {};
    const operationGroups = this.groupByOperation(data);
    
    for (const [operation, metrics] of operationGroups.entries()) {
      operationStats[operation] = {
        count: metrics.length,
        averageTime: metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length,
        successRate: metrics.filter(m => m.success).length / metrics.length
      };
    }

    return {
      totalOperations,
      averageExecutionTime,
      successRate,
      averageMemoryUsage,
      operationStats
    };
  }

  /**
   * 计算成本指标
   */
  private calculateCostMetrics(data: CostMetrics[]): Record<string, any> {
    if (data.length === 0) {
      return { totalCost: 0, costByProvider: {}, totalTokens: 0 };
    }

    const totalCost = data.reduce((sum, c) => sum + c.cost, 0);
    const totalTokens = data.reduce((sum, c) => sum + c.tokensUsed, 0);
    
    // 按提供商分组
    const costByProvider: Record<string, number> = {};
    const tokensByProvider: Record<string, number> = {};
    
    for (const cost of data) {
      costByProvider[cost.provider] = (costByProvider[cost.provider] || 0) + cost.cost;
      tokensByProvider[cost.provider] = (tokensByProvider[cost.provider] || 0) + cost.tokensUsed;
    }

    return {
      totalCost,
      totalTokens,
      costByProvider,
      tokensByProvider,
      averageCostPerToken: totalTokens > 0 ? totalCost / totalTokens : 0
    };
  }

  /**
   * 计算错误指标
   */
  private calculateErrorMetrics(data: ErrorRecord[]): Record<string, any> {
    if (data.length === 0) {
      return { totalErrors: 0, errorsByType: {}, errorsBySeverity: {}, resolutionRate: 0 };
    }

    const totalErrors = data.length;
    const resolvedErrors = data.filter(e => e.resolved).length;
    const resolutionRate = resolvedErrors / totalErrors;

    // 按类型分组
    const errorsByType: Record<string, number> = {};
    for (const error of data) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    }

    // 按严重程度分组
    const errorsBySeverity: Record<string, number> = {};
    for (const error of data) {
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    }

    return {
      totalErrors,
      resolvedErrors,
      resolutionRate,
      errorsByType,
      errorsBySeverity
    };
  }

  /**
   * 生成性能洞察
   */
  private generatePerformanceInsights(metrics: Record<string, any>): string[] {
    const insights: string[] = [];

    if (metrics.successRate < 0.95) {
      insights.push(`Success rate is ${(metrics.successRate * 100).toFixed(1)}%, which is below the recommended 95%`);
    }

    if (metrics.averageExecutionTime > 1000) {
      insights.push(`Average execution time is ${metrics.averageExecutionTime.toFixed(0)}ms, consider optimization`);
    }

    if (metrics.operationStats) {
      const slowestOperation = Object.entries(metrics.operationStats)
        .sort(([,a]: any, [,b]: any) => b.averageTime - a.averageTime)[0];
      
      if (slowestOperation) {
        insights.push(`Slowest operation: ${slowestOperation[0]} with ${(slowestOperation[1] as any).averageTime.toFixed(0)}ms average time`);
      }
    }

    return insights;
  }

  /**
   * 生成成本洞察
   */
  private generateCostInsights(metrics: Record<string, any>): string[] {
    const insights: string[] = [];

    insights.push(`Total cost for the period: $${metrics.totalCost.toFixed(4)}`);
    insights.push(`Total tokens used: ${metrics.totalTokens.toLocaleString()}`);

    if (metrics.costByProvider) {
      const mostExpensiveProvider = Object.entries(metrics.costByProvider)
        .sort(([,a]: any, [,b]: any) => b - a)[0];
      
      if (mostExpensiveProvider) {
        insights.push(`Most expensive provider: ${mostExpensiveProvider[0]} ($${(mostExpensiveProvider[1] as number).toFixed(4)})`);
      }
    }

    return insights;
  }

  /**
   * 生成错误洞察
   */
  private generateErrorInsights(metrics: Record<string, any>): string[] {
    const insights: string[] = [];

    insights.push(`Total errors in period: ${metrics.totalErrors}`);
    insights.push(`Error resolution rate: ${(metrics.resolutionRate * 100).toFixed(1)}%`);

    if (metrics.errorsByType) {
      const mostCommonError = Object.entries(metrics.errorsByType)
        .sort(([,a]: any, [,b]: any) => b - a)[0];
      
      if (mostCommonError) {
        insights.push(`Most common error type: ${mostCommonError[0]} (${mostCommonError[1]} occurrences)`);
      }
    }

    return insights;
  }

  /**
   * 生成性能建议
   */
  private generatePerformanceRecommendations(metrics: Record<string, any>): string[] {
    const recommendations: string[] = [];

    if (metrics.successRate < 0.95) {
      recommendations.push('Investigate and fix the root causes of failures to improve success rate');
    }

    if (metrics.averageExecutionTime > 1000) {
      recommendations.push('Consider implementing caching, optimizing algorithms, or adding more resources');
    }

    recommendations.push('Monitor performance trends and set up alerts for performance degradation');

    return recommendations;
  }

  /**
   * 生成成本建议
   */
  private generateCostRecommendations(metrics: Record<string, any>): string[] {
    const recommendations: string[] = [];

    recommendations.push('Review token usage patterns and optimize prompts to reduce costs');
    recommendations.push('Consider implementing request caching to avoid redundant API calls');
    
    if (metrics.averageCostPerToken > 0.001) {
      recommendations.push('Evaluate alternative providers or models with better cost efficiency');
    }

    return recommendations;
  }

  /**
   * 生成错误建议
   */
  private generateErrorRecommendations(metrics: Record<string, any>): string[] {
    const recommendations: string[] = [];

    if (metrics.resolutionRate < 0.8) {
      recommendations.push('Improve error resolution processes and documentation');
    }

    recommendations.push('Implement better error prevention mechanisms');
    recommendations.push('Set up automated error detection and alerting');

    return recommendations;
  }

  /**
   * 按操作分组
   */
  private groupByOperation(data: PerformanceMetrics[]): Map<string, PerformanceMetrics[]> {
    const groups = new Map<string, PerformanceMetrics[]>();
    
    for (const metric of data) {
      if (!groups.has(metric.operation)) {
        groups.set(metric.operation, []);
      }
      groups.get(metric.operation)!.push(metric);
    }
    
    return groups;
  }
}