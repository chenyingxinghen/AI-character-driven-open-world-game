/**
 * 运维域聚合
 * 组合多个相关的服务和实体，提供统一的业务接口
 */

import { Logger } from '../../services/Logger';
import { PerformanceMonitor, CostTracker, ErrorTracker, AlertManager } from './entities';
import { 
  PerformanceMetrics, 
  CostMetrics, 
  SystemHealth,
  BottleneckReport,
  ErrorRecord,
  ResourceUsage,
  AnalyticsReport,
  AlertRule,
  Alert 
} from './valueObjects';
import { SystemHealthService, AnalyticsReportService } from './services';

/**
 * 运维管理器
 * 运维域的主要聚合根，协调所有运维相关的业务逻辑
 */
export class OperationsManager {
  private performanceMonitor: PerformanceMonitor;
  private costTracker: CostTracker;
  private errorTracker: ErrorTracker;
  private alertManager: AlertManager;
  
  private healthService: SystemHealthService;
  private analyticsService: AnalyticsReportService;
  
  constructor(private logger: Logger) {
    this.performanceMonitor = new PerformanceMonitor('main_monitor', 'Main Performance Monitor');
    this.costTracker = new CostTracker('main_tracker', 'USD');
    this.errorTracker = new ErrorTracker('main_error_tracker');
    this.alertManager = new AlertManager('main_alert_manager');
    
    this.healthService = new SystemHealthService(logger);
    this.analyticsService = new AnalyticsReportService(logger);
    
    this.initializeDefaultAlertRules();
  }

  /**
   * 记录性能指标
   */
  recordPerformance(metric: PerformanceMetrics): void {
    this.performanceMonitor.recordMetric(metric);
    
    // 检查性能告警
    this.checkPerformanceAlerts(metric);
  }

  /**
   * 记录成本
   */
  recordCost(cost: CostMetrics): void {
    this.costTracker.recordCost(cost);
    
    // 检查成本告警
    this.checkCostAlerts(cost);
  }

  /**
   * 记录错误
   */
  recordError(error: ErrorRecord): void {
    this.errorTracker.recordError(error);
    
    // 根据错误严重程度触发告警
    if (error.severity === 'critical' || error.severity === 'high') {
      this.alertManager.checkMetric('error_severity', this.getSeverityValue(error.severity));
    }
  }

  /**
   * 获取系统健康状况
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const recentPerformance = this.performanceMonitor.getRecentMetrics(100);
    const recentErrors = this.errorTracker.getUnresolvedErrors();
    const resourceUsage = await this.getCurrentResourceUsage();
    
    return this.healthService.performHealthCheck(recentPerformance, recentErrors, resourceUsage);
  }

  /**
   * 检测性能瓶颈
   */
  detectBottlenecks(): BottleneckReport[] {
    return this.performanceMonitor.detectBottlenecks({
      executionTime: 2000, // 2秒
      memoryUsage: 500 * 1024 * 1024, // 500MB
      errorRate: 0.05 // 5%
    });
  }

  /**
   * 生成分析报告
   */
  generateAnalyticsReport(
    reportType: 'performance' | 'cost' | 'error',
    period: { start: Date; end: Date }
  ): AnalyticsReport {
    switch (reportType) {
      case 'performance':
        const performanceData = this.performanceMonitor.getRecentMetrics(10000);
        return this.analyticsService.generatePerformanceReport(performanceData, period);
        
      case 'cost':
        const costData = this.getCostDataInPeriod(period);
        return this.analyticsService.generateCostReport(costData, period);
        
      case 'error':
        const errorData = this.getErrorDataInPeriod(period);
        return this.analyticsService.generateErrorReport(errorData, period);
        
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }

  /**
   * 获取运维仪表板数据
   */
  async getDashboardData(): Promise<{
    systemHealth: SystemHealth;
    recentPerformance: PerformanceMetrics[];
    totalCost: { daily: number; weekly: number; monthly: number };
    recentErrors: ErrorRecord[];
    activeAlerts: Alert[];
    bottlenecks: BottleneckReport[];
  }> {
    const systemHealth = await this.getSystemHealth();
    const recentPerformance = this.performanceMonitor.getRecentMetrics(50);
    const recentErrors = this.errorTracker.getUnresolvedErrors().slice(0, 10);
    const activeAlerts = this.alertManager.getActiveAlerts();
    const bottlenecks = this.detectBottlenecks();
    
    // 计算成本趋势
    const now = new Date();
    const totalCost = {
      daily: this.costTracker.getTotalCost({
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now
      }),
      weekly: this.costTracker.getTotalCost({
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now
      }),
      monthly: this.costTracker.getTotalCost({
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now
      })
    };

    return {
      systemHealth,
      recentPerformance,
      totalCost,
      recentErrors,
      activeAlerts,
      bottlenecks
    };
  }

  /**
   * 管理告警规则
   */
  addAlertRule(rule: AlertRule): void {
    this.alertManager.addRule(rule);
  }

  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    return this.alertManager.updateRule(ruleId, updates);
  }

  removeAlertRule(ruleId: string): boolean {
    return this.alertManager.removeRule(ruleId);
  }

  /**
   * 管理告警
   */
  getActiveAlerts(): Alert[] {
    return this.alertManager.getActiveAlerts();
  }

  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    return this.alertManager.acknowledgeAlert(alertId, acknowledgedBy);
  }

  resolveAlert(alertId: string): boolean {
    return this.alertManager.resolveAlert(alertId);
  }

  /**
   * 获取统计信息
   */
  getStatistics(timeWindow?: { start: Date; end: Date }): {
    performance: any;
    cost: any;
    errors: any;
  } {
    const performanceStats = {
      totalOperations: this.performanceMonitor.getRecentMetrics(1000).length,
      averageExecutionTime: this.performanceMonitor.getAverageExecutionTime(undefined, timeWindow),
      successRate: this.performanceMonitor.getSuccessRate(undefined, timeWindow)
    };

    const costStats = {
      totalCost: this.costTracker.getTotalCost(timeWindow),
      costTrend: this.costTracker.getCostTrend(7)
    };

    const errorStats = this.errorTracker.getErrorStats(timeWindow);

    return {
      performance: performanceStats,
      cost: costStats,
      errors: errorStats
    };
  }

  /**
   * 获取增强的运维仪表板数据
   */
  async getEnhancedDashboardData(): Promise<{
    systemHealth: SystemHealth;
    healthTrends: any;
    realtimeMetrics: PerformanceMetrics[];
    performanceAlerts: any[];
    errorPatterns: any[];
    optimizationRecommendations: any[];
    predictiveInsights: {
      performanceTrends: any;
      errorPredictions: any;
      capacityForecasts: any;
    };
    totalCost: { daily: number; weekly: number; monthly: number };
    activeAlerts: Alert[];
  }> {
    const systemHealth = await this.getSystemHealth();
    const healthTrends = this.healthService.getHealthTrends();
    const realtimeMetrics = this.performanceMonitor.getRealtimeMetrics();
    const performanceAlerts = this.performanceMonitor.getPerformanceAlerts();
    const errorPatterns = this.errorTracker.getErrorPatterns();
    const optimizationRecommendations = this.performanceMonitor.getOptimizationRecommendations();
    
    // 获取预测洞察
    const predictiveInsights = {
      performanceTrends: this.performanceMonitor.getTrendAnalysis(),
      errorPredictions: this.errorTracker.getErrorTrends(),
      capacityForecasts: this.generateCapacityForecasts()
    };
    
    // 计算成本趋势
    const now = new Date();
    const totalCost = {
      daily: this.costTracker.getTotalCost({
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now
      }),
      weekly: this.costTracker.getTotalCost({
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now
      }),
      monthly: this.costTracker.getTotalCost({
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now
      })
    };
    
    const activeAlerts = this.alertManager.getActiveAlerts();
    
    return {
      systemHealth,
      healthTrends,
      realtimeMetrics,
      performanceAlerts,
      errorPatterns,
      optimizationRecommendations,
      predictiveInsights,
      totalCost,
      activeAlerts
    };
  }

  /**
   * 获取系统健康评估报告
   */
  getSystemHealthAssessment(): {
    overallScore: number;
    healthTrends: any;
    criticalIssues: any[];
    recommendations: any[];
    riskAssessment: {
      performanceRisk: 'low' | 'medium' | 'high' | 'critical';
      reliabilityRisk: 'low' | 'medium' | 'high' | 'critical';
      securityRisk: 'low' | 'medium' | 'high' | 'critical';
      capacityRisk: 'low' | 'medium' | 'high' | 'critical';
    };
  } {
    const healthTrends = this.healthService.getHealthTrends();
    const overallScore = this.calculateOverallSystemScore();
    const criticalIssues = this.identifyCriticalIssues();
    const recommendations = this.healthService.getIntelligentHealthRecommendations();
    const riskAssessment = this.assessSystemRisks();
    
    return {
      overallScore,
      healthTrends,
      criticalIssues,
      recommendations,
      riskAssessment
    };
  }

  /**
   * 获取智能运维建议
   */
  getIntelligentOperationsRecommendations(): Array<{
    category: 'performance' | 'reliability' | 'cost' | 'security' | 'capacity';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    actionItems: string[];
    expectedBenefits: string[];
    implementationEffort: 'low' | 'medium' | 'high';
    timeline: string;
  }> {
    const recommendations = [];
    
    // 性能优化建议
    const performanceRecs = this.performanceMonitor.getOptimizationRecommendations();
    for (const rec of performanceRecs) {
      recommendations.push({
        category: 'performance' as const,
        priority: rec.severity,
        title: `Optimize ${rec.operation} Performance`,
        description: rec.issue,
        actionItems: [rec.recommendation],
        expectedBenefits: [rec.expectedImprovement],
        implementationEffort: this.assessImplementationEffort(rec.recommendation),
        timeline: this.estimateImplementationTimeline(rec.severity)
      });
    }
    
    // 错误恢复建议
    const errorRecs = this.errorTracker.getRecoveryRecommendations();
    for (const rec of errorRecs) {
      recommendations.push({
        category: 'reliability' as const,
        priority: rec.priority,
        title: `Improve ${rec.errorType} Reliability`,
        description: rec.issue,
        actionItems: [rec.recommendation],
        expectedBenefits: rec.preventiveMeasures,
        implementationEffort: 'medium' as const,
        timeline: this.estimateImplementationTimeline(rec.priority)
      });
    }
    
    // 健康建议
    const healthRecs = this.healthService.getIntelligentHealthRecommendations();
    for (const rec of healthRecs) {
      recommendations.push({
        category: rec.category as any,
        priority: rec.priority,
        title: `System Health: ${rec.category}`,
        description: rec.issue,
        actionItems: [rec.recommendation],
        expectedBenefits: [rec.expectedImprovement],
        implementationEffort: rec.implementationComplexity,
        timeline: rec.estimatedTimeframe
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 初始化默认告警规则
   */
  private initializeDefaultAlertRules(): void {
    // 响应时间告警
    this.alertManager.addRule({
      id: 'response_time_high',
      name: 'High Response Time',
      metric: 'response_time',
      operator: '>',
      threshold: 2000,
      duration: 300, // 5分钟
      severity: 'high',
      enabled: true,
      notifications: ['system']
    });

    // 错误率告警
    this.alertManager.addRule({
      id: 'error_rate_high',
      name: 'High Error Rate',
      metric: 'error_rate',
      operator: '>',
      threshold: 0.05, // 5%
      duration: 300,
      severity: 'high',
      enabled: true,
      notifications: ['system']
    });

    // 成本告警
    this.alertManager.addRule({
      id: 'daily_cost_high',
      name: 'High Daily Cost',
      metric: 'daily_cost',
      operator: '>',
      threshold: 10, // $10
      duration: 0,
      severity: 'medium',
      enabled: true,
      notifications: ['system']
    });

    // 严重错误告警
    this.alertManager.addRule({
      id: 'critical_error',
      name: 'Critical Error Detected',
      metric: 'error_severity',
      operator: '>=',
      threshold: this.getSeverityValue('critical'),
      duration: 0,
      severity: 'critical',
      enabled: true,
      notifications: ['system', 'email']
    });
  }

  /**
   * 检查性能告警
   */
  private checkPerformanceAlerts(metric: PerformanceMetrics): void {
    // 检查响应时间
    this.alertManager.checkMetric('response_time', metric.executionTime);
    
    // 检查内存使用
    this.alertManager.checkMetric('memory_usage', metric.memoryUsage);
  }

  /**
   * 检查成本告警
   */
  private checkCostAlerts(cost: CostMetrics): void {
    // 获取今日总成本
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dailyCost = this.costTracker.getTotalCost({
      start: startOfDay,
      end: new Date()
    });
    
    this.alertManager.checkMetric('daily_cost', dailyCost);
  }

  /**
   * 获取严重程度数值
   */
  private getSeverityValue(severity: string): number {
    const severityMap: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    return severityMap[severity] || 0;
  }

  /**
   * 获取当前资源使用情况
   */
  private async getCurrentResourceUsage(): Promise<ResourceUsage> {
    // 在实际实现中，这里应该获取真实的系统资源使用情况
    // 这里提供一个模拟实现
    return {
      memory: {
        used: 512 * 1024 * 1024, // 512MB
        total: 2 * 1024 * 1024 * 1024, // 2GB
        percentage: 25
      },
      cpu: {
        usage: 35,
        cores: 4
      },
      storage: {
        used: 5 * 1024 * 1024 * 1024, // 5GB
        total: 100 * 1024 * 1024 * 1024, // 100GB
        percentage: 5
      },
      network: {
        bytesIn: 1024 * 1024, // 1MB
        bytesOut: 512 * 1024, // 512KB
        connectionsActive: 10
      },
      timestamp: new Date()
    };
  }

  /**
   * 获取时间段内的成本数据
   */
  private getCostDataInPeriod(period: { start: Date; end: Date }): CostMetrics[] {
    // 这里应该从存储中获取实际数据
    // 临时实现返回空数组
    return [];
  }

  /**
   * 获取时间段内的错误数据
   */
  private getErrorDataInPeriod(period: { start: Date; end: Date }): ErrorRecord[] {
    // 这里应该从存储中获取实际数据
    // 临时实现返回空数组
    return [];
  }

  /**
   * 生成容量预测
   */
  private generateCapacityForecasts(): {
    cpuCapacity: { current: number; predicted: number; recommendedAction: string };
    memoryCapacity: { current: number; predicted: number; recommendedAction: string };
    storageCapacity: { current: number; predicted: number; recommendedAction: string };
    networkCapacity: { current: number; predicted: number; recommendedAction: string };
  } {
    // 简化实现，实际情况下应该基于历史数据进行复杂预测
    return {
      cpuCapacity: {
        current: 65,
        predicted: 75,
        recommendedAction: 'Consider scaling CPU resources in next 2 weeks'
      },
      memoryCapacity: {
        current: 70,
        predicted: 85,
        recommendedAction: 'Plan memory upgrade within next month'
      },
      storageCapacity: {
        current: 45,
        predicted: 60,
        recommendedAction: 'Storage levels healthy, continue monitoring'
      },
      networkCapacity: {
        current: 30,
        predicted: 40,
        recommendedAction: 'Network utilization optimal'
      }
    };
  }

  /**
   * 计算整体系统评分
   */
  private calculateOverallSystemScore(): number {
    const recentPerformance = this.performanceMonitor.getRecentMetrics(50);
    const recentErrors = this.errorTracker.getUnresolvedErrors();
    
    let score = 100;
    
    // 性能评分
    if (recentPerformance.length > 0) {
      const avgResponseTime = recentPerformance.reduce((sum, p) => sum + p.executionTime, 0) / recentPerformance.length;
      const successRate = recentPerformance.filter(p => p.success).length / recentPerformance.length;
      
      if (avgResponseTime > 2000) score -= 20;
      if (successRate < 0.95) score -= 25;
    }
    
    // 错误评分
    if (recentErrors.length > 10) score -= 30;
    if (recentErrors.some(e => e.severity === 'critical')) score -= 40;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 识别关键问题
   */
  private identifyCriticalIssues(): Array<{
    type: string;
    severity: 'high' | 'critical';
    description: string;
    impact: string;
    urgency: number;
  }> {
    const issues = [];
    
    // 性能关键问题
    const performanceAlerts = this.performanceMonitor.getPerformanceAlerts();
    for (const alert of performanceAlerts) {
      if (alert.alertType === 'HIGH_EXECUTION_TIME') {
        issues.push({
          type: 'performance',
          severity: 'high' as const,
          description: `High execution time detected for ${alert.operation}`,
          impact: 'User experience degradation and potential timeout issues',
          urgency: 8
        });
      }
    }
    
    // 错误关键问题
    const errorPatterns = this.errorTracker.getErrorPatterns();
    for (const pattern of errorPatterns) {
      if (pattern.severity === 'critical' || pattern.count > 50) {
        issues.push({
          type: 'reliability',
          severity: pattern.severity === 'critical' ? 'critical' as const : 'high' as const,
          description: `Critical error pattern detected: ${pattern.pattern}`,
          impact: 'System instability and potential service outages',
          urgency: pattern.severity === 'critical' ? 10 : 7
        });
      }
    }
    
    return issues.sort((a, b) => b.urgency - a.urgency);
  }

  /**
   * 评估系统风险
   */
  private assessSystemRisks(): {
    performanceRisk: 'low' | 'medium' | 'high' | 'critical';
    reliabilityRisk: 'low' | 'medium' | 'high' | 'critical';
    securityRisk: 'low' | 'medium' | 'high' | 'critical';
    capacityRisk: 'low' | 'medium' | 'high' | 'critical';
  } {
    // 性能风险评估
    const recentMetrics = this.performanceMonitor.getRecentMetrics(100);
    const avgResponseTime = recentMetrics.length > 0 ? 
      recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length : 0;
    
    let performanceRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (avgResponseTime > 3000) performanceRisk = 'critical';
    else if (avgResponseTime > 2000) performanceRisk = 'high';
    else if (avgResponseTime > 1000) performanceRisk = 'medium';
    
    // 可靠性风险评估
    const unresolvedErrors = this.errorTracker.getUnresolvedErrors();
    let reliabilityRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (unresolvedErrors.length > 20) reliabilityRisk = 'critical';
    else if (unresolvedErrors.length > 10) reliabilityRisk = 'high';
    else if (unresolvedErrors.length > 5) reliabilityRisk = 'medium';
    
    // 安全风险评估（简化）
    const securityRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    // 容量风险评估（简化）
    const capacityRisk: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    
    return {
      performanceRisk,
      reliabilityRisk,
      securityRisk,
      capacityRisk
    };
  }

  /**
   * 评估实施难度
   */
  private assessImplementationEffort(recommendation: string): 'low' | 'medium' | 'high' {
    const lowEffortKeywords = ['cache', 'config', 'setting', 'parameter'];
    const highEffortKeywords = ['refactor', 'redesign', 'architecture', 'infrastructure'];
    
    const lowerRec = recommendation.toLowerCase();
    
    if (highEffortKeywords.some(keyword => lowerRec.includes(keyword))) {
      return 'high';
    }
    
    if (lowEffortKeywords.some(keyword => lowerRec.includes(keyword))) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * 估算实施时间表
   */
  private estimateImplementationTimeline(priority: 'low' | 'medium' | 'high' | 'critical'): string {
    const timelines = {
      critical: '1-3 days',
      high: '1-2 weeks',
      medium: '2-4 weeks',
      low: '1-2 months'
    };
    
    return timelines[priority];
  }

  /**
   * 清理旧数据
   */
  cleanupOldData(cutoffDate: Date): void {
    this.performanceMonitor.cleanup(cutoffDate);
    this.costTracker.cleanup(cutoffDate);
    this.errorTracker.cleanup(cutoffDate);
    this.alertManager.cleanupResolvedAlerts(cutoffDate);
  }

  /**
   * 清理系统资源
   */
  async cleanupSystem(olderThanHours: number = 24): Promise<void> {
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    this.cleanupOldData(cutoffDate);
    this.logger.info(`Operations cleanup completed for data older than ${olderThanHours} hours`);
  }
}