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
   * 清理旧数据
   */
  cleanupOldData(olderThan: Date): void {
    this.performanceMonitor.cleanup(olderThan);
    this.costTracker.cleanup(olderThan);
    this.errorTracker.cleanup(olderThan);
    
    this.logger.info(`Cleaned up operations data older than ${olderThan.toISOString()}`);
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
}