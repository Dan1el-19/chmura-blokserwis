import type { NextRequest } from 'next/server';

export interface SecurityEvent {
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'TOKEN_REFRESH' | 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY' | 'API_ERROR' | 'RATE_LIMIT_EXCEEDED';
  userId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

class SecurityLogger {
  private static instance: SecurityLogger;
  private events: SecurityEvent[] = [];
  private maxEvents = 1000; // Keep last 1000 events in memory

  private constructor() {}

  public static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  private getClientIP(request?: NextRequest): string {
    if (!request) return 'unknown';
    
    return (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-client-ip') ||
      'unknown'
    );
  }

  public async log(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    // Add to in-memory store
    this.events.unshift(securityEvent);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    // Console log with severity-based styling
    const logLevel = this.getLogLevel(event.severity);
    console[logLevel]('🛡️ SECURITY EVENT:', {
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      ip: event.ip,
      path: event.path,
      details: event.details,
      timestamp: securityEvent.timestamp.toISOString()
    });

    // In production, you might want to send this to external logging service
    if (process.env.NODE_ENV === 'production' && event.severity === 'CRITICAL') {
      await this.alertCriticalEvent(securityEvent);
    }
  }

  public logFromRequest(
    request: NextRequest,
    type: SecurityEvent['type'],
    severity: SecurityEvent['severity'],
    userId?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    return this.log({
      type,
      severity,
      userId,
      ip: this.getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
      path: request.nextUrl.pathname,
      method: request.method,
      details
    });
  }

  public getRecentEvents(limit = 50): SecurityEvent[] {
    return this.events.slice(0, limit);
  }

  public getEventsByType(type: SecurityEvent['type'], limit = 50): SecurityEvent[] {
    return this.events
      .filter(event => event.type === type)
      .slice(0, limit);
  }

  public getEventsByUser(userId: string, limit = 50): SecurityEvent[] {
    return this.events
      .filter(event => event.userId === userId)
      .slice(0, limit);
  }

  public getSuspiciousActivity(timeframe = 3600000): SecurityEvent[] {
    const cutoff = new Date(Date.now() - timeframe);
    return this.events.filter(event => 
      event.timestamp > cutoff && 
      (event.severity === 'HIGH' || event.severity === 'CRITICAL')
    );
  }

  private getLogLevel(severity: SecurityEvent['severity']): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'LOW':
        return 'log';
      case 'MEDIUM':
        return 'log';
      case 'HIGH':
        return 'warn';
      case 'CRITICAL':
        return 'error';
      default:
        return 'log';
    }
  }

  private async alertCriticalEvent(event: SecurityEvent): Promise<void> {
    // Here you could integrate with alerting services like:
    // - Email notifications
    // - Slack/Discord webhooks
    // - PagerDuty
    // - Datadog/NewRelic
    console.error('🚨 CRITICAL SECURITY EVENT ALERT:', event);
    
    // Example: Log to external service
    // await fetch(process.env.SECURITY_WEBHOOK_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(event)
    // });
  }
}

// Export singleton instance
export const securityLogger = SecurityLogger.getInstance();

// Helper functions for common security events
export const logSecurityEvent = {
  loginSuccess: (userId: string, ip?: string, userAgent?: string) =>
    securityLogger.log({
      type: 'LOGIN_SUCCESS',
      severity: 'LOW',
      userId,
      ip,
      userAgent
    }),

  loginFailed: (ip?: string, userAgent?: string, details?: Record<string, unknown>) =>
    securityLogger.log({
      type: 'LOGIN_FAILED',
      severity: 'MEDIUM',
      ip,
      userAgent,
      details
    }),

  logout: (userId: string, ip?: string) =>
    securityLogger.log({
      type: 'LOGOUT',
      severity: 'LOW',
      userId,
      ip
    }),

  unauthorizedAccess: (request: NextRequest, userId?: string, details?: Record<string, unknown>) =>
    securityLogger.logFromRequest(request, 'UNAUTHORIZED_ACCESS', 'HIGH', userId, details),

  suspiciousActivity: (request: NextRequest, userId?: string, details?: Record<string, unknown>) =>
    securityLogger.logFromRequest(request, 'SUSPICIOUS_ACTIVITY', 'CRITICAL', userId, details),

  apiError: (request: NextRequest, error: unknown, userId?: string) =>
    securityLogger.logFromRequest(request, 'API_ERROR', 'MEDIUM', userId, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }),

  rateLimitExceeded: (request: NextRequest, userId?: string) =>
    securityLogger.logFromRequest(request, 'RATE_LIMIT_EXCEEDED', 'HIGH', userId)
};