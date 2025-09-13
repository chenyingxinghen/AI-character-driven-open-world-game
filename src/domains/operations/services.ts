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
 * 系统健康检查服务（增强版）
 * 监控系统整体健康状况，支持智能评估、预测分析和自动优化建议
 */
export class SystemHealthService {
  private healthHistory: SystemHealth[] = [];
  private healthScores: Map<string, number[]> = new Map();
  private predictiveModels: Map<string, { trend: number; prediction: number; confidence: number }> = new Map();
  private systemBaseline: {
    responseTime: number;
    errorRate: number;
    throughput: number;
    resourceUsage: { memory: number; cpu: number; storage: number };
  } | null = null;

  constructor(private logger: Logger) {
    this.initializeHealthTracking();
  }

  /**
   * 执行系统健康检查（增强版）
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
    
    // 计算整体状态（增强版）
    const status = this.calculateOverallStatus(issues, performanceData, errorData, resourceUsage);
    
    // 计算响应时间
    const responseTime = this.calculateAverageResponseTime(performanceData);
    
    // 计算错误率
    const errorRate = this.calculateErrorRate(errorData);
    
    // 计算吐吐量
    const throughput = this.calculateThroughput(performanceData);
    
    const healthCheck: SystemHealth = {
      status,
      uptime: this.calculateUptime(),
      responseTime,
      errorRate,
      throughput,
      timestamp: new Date(),
      issues
    };
    
    // 记录健康历史
    this.recordHealthHistory(healthCheck);
    
    // 更新健康评分
    this.updateHealthScores(healthCheck);
    
    // 更新预测模型
    this.updatePredictiveModels(healthCheck);
    
    return healthCheck;
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
   * 计算整体状态（增强版）
   */
  private calculateOverallStatus(
    issues: HealthIssue[],
    performanceData?: PerformanceMetrics[],
    errorData?: ErrorRecord[],
    resourceUsage?: ResourceUsage
  ): SystemHealth['status'] {
    if (issues.length === 0) {
      // 即使没有明显问题，也要检查系统指标
      return this.assessOverallHealthScore(performanceData, errorData, resourceUsage);
    }
    
    const hasCritical = issues.some(i => i.severity === 'critical');
    if (hasCritical) return 'critical';
    
    const hasHigh = issues.some(i => i.severity === 'high');
    if (hasHigh) return 'warning';
    
    const hasMedium = issues.some(i => i.severity === 'medium');
    if (hasMedium) return 'warning';
    
    return 'healthy';
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

  /**
   * 初始化健康追踪
   */
  private initializeHealthTracking(): void {
    // 每分钟计算基线指标
    setInterval(() => {
      this.calculateSystemBaseline();
    }, 60 * 1000); // 1分钟
  }

  /**
   * 记录健康历史
   */
  private recordHealthHistory(health: SystemHealth): void {
    this.healthHistory.push(health);
    
    // 保持最近100条记录
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }
  }

  /**
   * 更新健康评分
   */
  private updateHealthScores(health: SystemHealth): void {
    const score = this.calculateHealthScore(health);
    
    const metrics = ['overall', 'performance', 'errors', 'resources'];
    
    for (const metric of metrics) {
      const existing = this.healthScores.get(metric) || [];
      existing.push(score);
      
      // 保持最近50个评分
      if (existing.length > 50) {
        existing.shift();
      }
      
      this.healthScores.set(metric, existing);
    }
  }

  /**
   * 计算健康评分
   */
  private calculateHealthScore(health: SystemHealth): number {
    let score = 100;
    
    // 根据问题严重程度减分
    for (const issue of health.issues) {
      switch (issue.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    
    // 根据性能指标调整
    if (this.systemBaseline) {
      if (health.responseTime > this.systemBaseline.responseTime * 1.5) {
        score -= 15;
      }
      if (health.errorRate > this.systemBaseline.errorRate * 2) {
        score -= 20;
      }
      if (health.throughput < this.systemBaseline.throughput * 0.7) {
        score -= 10;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 更新预测模型
   */
  private updatePredictiveModels(health: SystemHealth): void {
    const metrics = ['responseTime', 'errorRate', 'throughput'];
    
    for (const metric of metrics) {
      const values = this.healthHistory.map(h => {
        switch (metric) {
          case 'responseTime': return h.responseTime;
          case 'errorRate': return h.errorRate;
          case 'throughput': return h.throughput;
          default: return 0;
        }
      });
      
      if (values.length >= 5) {
        const trend = this.calculateTrend(values);
        const prediction = this.predictNextValue(values, trend);
        const confidence = this.calculatePredictionConfidence(values, trend);
        
        this.predictiveModels.set(metric, { trend, prediction, confidence });
      }
    }
  }

  /**
   * 计算趋势
   */
  private calculateTrend(values: number[]): number {
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
  private predictNextValue(values: number[], trend: number): number {
    if (values.length === 0) return 0;
    
    const lastValue = values[values.length - 1];
    return Math.max(0, lastValue + trend);
  }

  /**
   * 计算预测置信度
   */
  private calculatePredictionConfidence(values: number[], trend: number): number {
    if (values.length < 3) return 0.3;
    
    // 计算方差
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    // 方差越小，预测置信度越高
    const normalizedStdDev = standardDeviation / (mean || 1);
    const confidence = Math.max(0.1, Math.min(0.9, 1 - normalizedStdDev));
    
    return confidence;
  }

  /**
   * 计算系统基线
   */
  private calculateSystemBaseline(): void {
    if (this.healthHistory.length < 10) return;
    
    const recentHealth = this.healthHistory.slice(-10);
    
    const avgResponseTime = recentHealth.reduce((sum, h) => sum + h.responseTime, 0) / recentHealth.length;
    const avgErrorRate = recentHealth.reduce((sum, h) => sum + h.errorRate, 0) / recentHealth.length;
    const avgThroughput = recentHealth.reduce((sum, h) => sum + h.throughput, 0) / recentHealth.length;
    
    this.systemBaseline = {
      responseTime: avgResponseTime,
      errorRate: avgErrorRate,
      throughput: avgThroughput,
      resourceUsage: {
        memory: 70,
        cpu: 60,
        storage: 50
      }
    };
  }

  /**
   * 评估整体健康评分
   */
  private assessOverallHealthScore(
    performanceData?: PerformanceMetrics[],
    errorData?: ErrorRecord[],
    resourceUsage?: ResourceUsage
  ): SystemHealth['status'] {
    if (!this.systemBaseline) return 'healthy';
    
    let score = 100;
    
    // 性能评估
    if (performanceData && performanceData.length > 0) {
      const avgResponseTime = performanceData.reduce((sum, p) => sum + p.executionTime, 0) / performanceData.length;
      if (avgResponseTime > this.systemBaseline.responseTime * 2) {
        score -= 25;
      } else if (avgResponseTime > this.systemBaseline.responseTime * 1.5) {
        score -= 15;
      }
    }
    
    // 错误率评估
    if (errorData) {
      const recentErrors = errorData.filter(e => 
        e.timestamp > new Date(Date.now() - 60 * 60 * 1000)
      );
      const errorRate = recentErrors.length / 100; // 假设每小时100个请求
      
      if (errorRate > this.systemBaseline.errorRate * 3) {
        score -= 30;
      } else if (errorRate > this.systemBaseline.errorRate * 2) {
        score -= 20;
      }
    }
    
    // 资源使用评估
    if (resourceUsage) {
      if (resourceUsage.memory.percentage > 90) score -= 20;
      if (resourceUsage.cpu.usage > 90) score -= 20;
      if (resourceUsage.storage.percentage > 95) score -= 15;
    }
    
    if (score >= 90) return 'healthy';
    if (score >= 70) return 'warning';
    if (score >= 50) return 'critical';
    return 'down';
  }

  /**
   * 获取健康趋势分析
   */
  getHealthTrends(): {
    overallTrend: 'improving' | 'stable' | 'declining';
    responseTimeTrend: { trend: number; prediction: number; confidence: number };
    errorRateTrend: { trend: number; prediction: number; confidence: number };
    throughputTrend: { trend: number; prediction: number; confidence: number };
    healthScoreHistory: number[];
    predictions: {
      nextHour: { healthScore: number; confidence: number };
      nextDay: { healthScore: number; confidence: number };
    };
  } {
    const healthScores = this.healthScores.get('overall') || [];
    const overallTrend = this.determineOverallTrend(healthScores);
    
    const responseTimeTrend = this.predictiveModels.get('responseTime') || { trend: 0, prediction: 0, confidence: 0 };
    const errorRateTrend = this.predictiveModels.get('errorRate') || { trend: 0, prediction: 0, confidence: 0 };
    const throughputTrend = this.predictiveModels.get('throughput') || { trend: 0, prediction: 0, confidence: 0 };
    
    const predictions = this.generateHealthPredictions(healthScores);
    
    return {
      overallTrend,
      responseTimeTrend,
      errorRateTrend,
      throughputTrend,
      healthScoreHistory: [...healthScores],
      predictions
    };
  }

  /**
   * 确定整体趋势
   */
  private determineOverallTrend(scores: number[]): 'improving' | 'stable' | 'declining' {
    if (scores.length < 5) return 'stable';
    
    const recentScores = scores.slice(-5);
    const earlierScores = scores.slice(-10, -5);
    
    if (earlierScores.length === 0) return 'stable';
    
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const earlierAvg = earlierScores.reduce((a, b) => a + b, 0) / earlierScores.length;
    
    if (recentAvg > earlierAvg + 5) return 'improving';
    if (recentAvg < earlierAvg - 5) return 'declining';
    return 'stable';
  }

  /**
   * 生成健康预测
   */
  private generateHealthPredictions(scores: number[]): {
    nextHour: { healthScore: number; confidence: number };
    nextDay: { healthScore: number; confidence: number };
  } {
    if (scores.length < 3) {
      return {
        nextHour: { healthScore: 80, confidence: 0.3 },
        nextDay: { healthScore: 80, confidence: 0.2 }
      };
    }
    
    const trend = this.calculateTrend(scores);
    const lastScore = scores[scores.length - 1];
    
    const nextHourScore = Math.max(0, Math.min(100, lastScore + trend));
    const nextDayScore = Math.max(0, Math.min(100, lastScore + trend * 24));
    
    const confidence = this.calculatePredictionConfidence(scores, trend);
    
    return {
      nextHour: { healthScore: Math.round(nextHourScore), confidence },
      nextDay: { healthScore: Math.round(nextDayScore), confidence: confidence * 0.7 }
    };
  }

  /**
   * 获取智能健康建议
   */
  getIntelligentHealthRecommendations(): Array<{
    category: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    issue: string;
    recommendation: string;
    expectedImprovement: string;
    implementationComplexity: 'low' | 'medium' | 'high';
    estimatedTimeframe: string;
  }>{
    const recommendations: Array<{
      category: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      issue: string;
      recommendation: string;
      expectedImprovement: string;
      implementationComplexity: 'low' | 'medium' | 'high';
      estimatedTimeframe: string;
    }> = [];
    const recentHealth = this.healthHistory.slice(-5);
    
    if (recentHealth.length === 0) return recommendations;
    
    // 分析性能趋势
    const responseTimeTrend = this.predictiveModels.get('responseTime');
    if (responseTimeTrend && responseTimeTrend.trend > 0 && responseTimeTrend.confidence > 0.6) {
      recommendations.push({
        category: 'performance',
        priority: responseTimeTrend.trend > 50 ? 'high' : 'medium',
        issue: 'Response time is trending upward',
        recommendation: 'Implement performance monitoring and optimization strategies',
        expectedImprovement: 'Reduce response time by 20-40%',
        implementationComplexity: 'medium',
        estimatedTimeframe: '1-2 weeks'
      });
    }
    
    // 分析错误率趋势
    const errorRateTrend = this.predictiveModels.get('errorRate');
    if (errorRateTrend && errorRateTrend.trend > 0 && errorRateTrend.confidence > 0.6) {
      recommendations.push({
        category: 'reliability',
        priority: errorRateTrend.trend > 0.01 ? 'critical' : 'high',
        issue: 'Error rate is increasing',
        recommendation: 'Implement comprehensive error tracking and automated recovery',
        expectedImprovement: 'Reduce error rate by 50-70%',
        implementationComplexity: 'high',
        estimatedTimeframe: '2-4 weeks'
      });
    }
    
    // 分析吐吐量趋势
    const throughputTrend = this.predictiveModels.get('throughput');
    if (throughputTrend && throughputTrend.trend < 0 && throughputTrend.confidence > 0.6) {
      recommendations.push({
        category: 'capacity',
        priority: 'medium',
        issue: 'System throughput is declining',
        recommendation: 'Scale infrastructure and optimize bottlenecks',
        expectedImprovement: 'Increase throughput by 30-50%',
        implementationComplexity: 'medium',
        estimatedTimeframe: '1-3 weeks'
      });
    }
    
    // 分析整体健康评分
    const healthScores = this.healthScores.get('overall') || [];
    if (healthScores.length >= 5) {
      const recentAvg = healthScores.slice(-5).reduce((a, b) => a + b, 0) / 5;
      
      if (recentAvg < 70) {
        recommendations.push({
          category: 'system_health',
          priority: recentAvg < 50 ? 'critical' : 'high',
          issue: 'Overall system health is declining',
          recommendation: 'Comprehensive system audit and immediate intervention required',
          expectedImprovement: 'Improve overall health score by 20-30 points',
          implementationComplexity: 'high',
          estimatedTimeframe: '2-6 weeks'
        });
      }
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
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