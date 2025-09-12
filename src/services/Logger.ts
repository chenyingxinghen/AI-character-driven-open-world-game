export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogContext {
  sessionId?: string;
  playerId?: string;
  component?: string;
  operation?: string;
  timestamp?: Date;
  [key: string]: any;
}

export class Logger {
  private logLevel: LogLevel;
  private enableDebug: boolean;

  constructor(logLevel: LogLevel = LogLevel.INFO, enableDebug: boolean = false) {
    this.logLevel = logLevel;
    this.enableDebug = enableDebug || process.env.LOG_LEVEL === 'debug';
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${level}] [${context?.component || 'System'}]`;
    
    if (context?.sessionId) {
      return `${prefix} [Session:${context.sessionId}] ${message}`;
    }
    
    return `${prefix} ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  info(message: string, context?: LogContext, ...args: any[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', message, context), ...args);
    }
  }
  
  error(message: string, error?: Error, context?: LogContext, ...args: any[]) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formattedMessage = this.formatMessage('ERROR', message, context);
      if (error) {
        console.error(formattedMessage, error.message, error.stack, ...args);
      } else {
        console.error(formattedMessage, ...args);
      }
    }
  }
  
  debug(message: string, data?: any, context?: LogContext) {
    if (this.enableDebug && this.shouldLog(LogLevel.DEBUG)) {
      const formattedMessage = this.formatMessage('DEBUG', message, context);
      if (data) {
        console.log(formattedMessage, JSON.stringify(data, null, 2));
      } else {
        console.log(formattedMessage);
      }
    }
  }
  
  warn(message: string, context?: LogContext, ...args: any[]) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context), ...args);
    }
  }

  // 专门的方法用于跟踪特定操作
  logInputProcessing(sessionId: string, playerId: string, input: string, result: any) {
    this.debug('Input processing completed', {
      input,
      result: {
        intent: result.intent,
        confidence: result.confidence,
        entities: result.entities?.map((e: any) => ({ type: e.type, value: e.value })),
        emotionalTone: result.emotionalTone
      }
    }, { sessionId, playerId, component: 'InputProcessor' });
  }

  logLocationChange(sessionId: string, playerId: string, fromLocation: string, toLocation: string, success: boolean) {
    const message = success ? 
      `Player moved from ${fromLocation} to ${toLocation}` :
      `Failed to move player from ${fromLocation} to ${toLocation}`;
    
    this.info(message, { 
      sessionId, 
      playerId, 
      component: 'LocationManager',
      operation: 'location_change',
      fromLocation,
      toLocation,
      success
    });
  }

  logDomainCoordination(sessionId: string, domainsInvolved: string[], processingTime: number, success: boolean) {
    this.debug('Domain coordination completed', {
      domainsInvolved,
      processingTime,
      success
    }, { sessionId, component: 'DomainCoordinator' });
  }

  logLLMCall(component: string, operation: string, prompt: string, response: string, processingTime: number) {
    this.debug('LLM call completed', {
      operation,
      promptLength: prompt.length,
      responseLength: response.length,
      processingTime
    }, { component, operation: 'llm_call' });
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  enableDebugMode(enabled: boolean = true) {
    this.enableDebug = enabled;
  }
}