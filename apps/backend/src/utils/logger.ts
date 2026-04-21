/**
 * Simple structured logger for development and production
 * Logs to console in dev mode, can be extended to send to monitoring service in production
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
  stack?: string;
}

class Logger {
  private formatEntry(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
    };
  }

  private output(entry: LogEntry) {
    const isDev = process.env.NODE_ENV === 'development';
    const output = isDev
      ? `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`
      : JSON.stringify(entry);

    switch (entry.level) {
      case 'error':
        console.error(output, isDev && entry.data ? entry.data : '');
        break;
      case 'warn':
        console.warn(output, isDev && entry.data ? entry.data : '');
        break;
      case 'info':
        console.info(output, isDev && entry.data ? entry.data : '');
        break;
      case 'debug':
        if (isDev) {
          // ...existing code...
        }
        break;
    }

    // TODO: In production, send logs to monitoring service (e.g., Sentry, DataDog, CloudWatch)
  }

  public debug(message: string, data?: any) {
    this.output(this.formatEntry('debug', message, data));
  }

  public info(message: string, data?: any) {
    this.output(this.formatEntry('info', message, data));
  }

  public warn(message: string, data?: any) {
    this.output(this.formatEntry('warn', message, data));
  }

  public error(message: string, data?: any) {
    this.output(this.formatEntry('error', message, data));
  }
}

export default new Logger();
