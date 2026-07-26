/**
 * Operational Monitoring & Structured Client Logger for OrderRail Production Pilot.
 * Provides structured log formatting, crash reporting hooks, and performance metric tracking.
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  action: string;
  message: string;
  details?: any;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

export interface MetricEntry {
  timestamp: string;
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

export class Logger {
  private static logBuffer: LogEntry[] = [];
  private static maxBufferLength = 100;

  /**
   * Log informational event.
   */
  public static info(module: string, action: string, message: string, details?: any): void {
    this.appendLog('INFO', module, action, message, details);
  }

  /**
   * Log warning event.
   */
  public static warn(module: string, action: string, message: string, details?: any): void {
    this.appendLog('WARN', module, action, message, details);
  }

  /**
   * Log runtime error event with stack trace capture.
   */
  public static error(module: string, action: string, message: string, err?: any): void {
    const errorDetails = err ? {
      name: err?.name || 'Error',
      message: err?.message || String(err),
      stack: err?.stack,
    } : undefined;

    this.appendLog('ERROR', module, action, message, undefined, errorDetails);
  }

  /**
   * Track operational metric (e.g. order submission latency, print duration).
   */
  public static trackMetric(name: string, value: number, unit: string = 'ms', tags?: Record<string, string>): void {
    const entry: MetricEntry = {
      timestamp: new Date().toISOString(),
      name,
      value,
      unit,
      tags,
    };
    if (import.meta.env.DEV) {
      console.log(`[METRIC] ${name}: ${value}${unit}`, tags || '');
    }
  }

  /**
   * Retrieves recent buffered log entries for diagnostics & support.
   */
  public static getBufferedLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clears in-memory log buffer.
   */
  public static clearBuffer(): void {
    this.logBuffer = [];
  }

  private static appendLog(
    level: LogLevel,
    module: string,
    action: string,
    message: string,
    details?: any,
    error?: LogEntry['error']
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      action,
      message,
      details,
      error,
    };

    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferLength) {
      this.logBuffer.shift();
    }

    const consoleMsg = `[${entry.timestamp}] [${level}] [${module}:${action}] ${message}`;
    if (level === 'ERROR') {
      console.error(consoleMsg, details || '', error || '');
    } else if (level === 'WARN') {
      console.warn(consoleMsg, details || '');
    } else if (import.meta.env.DEV) {
      console.log(consoleMsg, details || '');
    }
  }
}
