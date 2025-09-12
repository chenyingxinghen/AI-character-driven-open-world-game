/**
 * 运维域值对象
 * 这些是不可变的值对象，代表运维域中的核心概念
 */

/**
 * 性能指标值对象
 */
export interface PerformanceMetrics {
  readonly operation: string;
  readonly executionTime: number;
  readonly memoryUsage: number;
  readonly cpuUsage: number;
  readonly timestamp: Date;
  readonly success: boolean;
  readonly errorMessage?: string;
}

/**
 * 成本指标值对象
 */
export interface CostMetrics {
  readonly provider: string;
  readonly operation: string;
  readonly tokensUsed: number;
  readonly cost: number;
  readonly currency: string;
  readonly timestamp: Date;
  readonly sessionId?: string;
}

/**
 * 系统健康状况值对象
 */
export interface SystemHealth {
  readonly status: 'healthy' | 'warning' | 'critical' | 'down';
  readonly uptime: number;
  readonly responseTime: number;
  readonly errorRate: number;
  readonly throughput: number;
  readonly timestamp: Date;
  readonly issues: readonly HealthIssue[];
}

/**
 * 健康问题值对象
 */
export interface HealthIssue {
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly category: string;
  readonly description: string;
  readonly firstOccurred: Date;
  readonly lastOccurred: Date;
  readonly count: number;
}

/**
 * 瓶颈报告值对象
 */
export interface BottleneckReport {
  readonly component: string;
  readonly bottleneckType: 'cpu' | 'memory' | 'io' | 'network' | 'external_api';
  readonly severity: number;
  readonly description: string;
  readonly impact: string;
  readonly recommendations: readonly string[];
  readonly detectedAt: Date;
}

/**
 * 错误记录值对象
 */
export interface ErrorRecord {
  readonly id: string;
  readonly type: string;
  readonly message: string;
  readonly stackTrace?: string;
  readonly context: Record<string, any>;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly timestamp: Date;
  readonly resolved: boolean;
  readonly resolutionNotes?: string;
}

/**
 * 分析报告值对象
 */
export interface AnalyticsReport {
  readonly reportType: string;
  readonly period: {
    readonly start: Date;
    readonly end: Date;
  };
  readonly metrics: Record<string, any>;
  readonly insights: readonly string[];
  readonly recommendations: readonly string[];
  readonly generatedAt: Date;
}

/**
 * 资源使用情况值对象
 */
export interface ResourceUsage {
  readonly memory: {
    readonly used: number;
    readonly total: number;
    readonly percentage: number;
  };
  readonly cpu: {
    readonly usage: number;
    readonly cores: number;
  };
  readonly storage: {
    readonly used: number;
    readonly total: number;
    readonly percentage: number;
  };
  readonly network: {
    readonly bytesIn: number;
    readonly bytesOut: number;
    readonly connectionsActive: number;
  };
  readonly timestamp: Date;
}

/**
 * 告警规则值对象
 */
export interface AlertRule {
  readonly id: string;
  readonly name: string;
  readonly metric: string;
  readonly operator: '>' | '<' | '=' | '>=' | '<=';
  readonly threshold: number;
  readonly duration: number;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly enabled: boolean;
  readonly notifications: readonly string[];
}

/**
 * 告警值对象
 */
export interface Alert {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly metric: string;
  readonly currentValue: number;
  readonly threshold: number;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly message: string;
  readonly triggeredAt: Date;
  readonly resolvedAt?: Date;
  readonly acknowledged: boolean;
  readonly acknowledgedBy?: string;
  readonly acknowledgedAt?: Date;
}