// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Structured Logger (pino wrapper)
// ═══════════════════════════════════════════════════════════════════════

import { resolve } from 'node:path';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVEL_NUM: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const LEVEL_LABEL: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO ',
  40: 'WARN ',
  50: 'ERROR',
  60: 'FATAL',
};

export interface LogEntry {
  level: number;
  time: string;
  msg: string;
  [key: string]: unknown;
}

class Logger {
  private minLevel: number = 30; // info default
  private outputStream: 'stdout' | 'file' = 'stdout';
  private logFilePath = '';

  configure(opts: { level?: LogLevel; logDir?: string; logFile?: string }): void {
    if (opts.level) this.minLevel = LEVEL_NUM[opts.level];
    if (opts.logDir && opts.logFile) {
      this.outputStream = 'file';
      this.logFilePath = resolve(opts.logDir, opts.logFile);
      const dir = resolve(opts.logDir);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
  }

  private write(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
    const num = LEVEL_NUM[level];
    if (num < this.minLevel) return;

    const entry: LogEntry = {
      level: num,
      time: new Date().toISOString(),
      msg,
      ...extra,
    };

    const line = JSON.stringify(entry);

    if (this.outputStream === 'file') {
      try {
        appendFileSync(this.logFilePath, line + '\n');
      } catch { /* best effort */ }
    } else {
      // Always write logs to stderr — stdout is for tool output
      process.stderr.write(line + '\n');
    }
  }

  trace(msg: string, extra?: Record<string, unknown>): void { this.write('trace', msg, extra); }
  debug(msg: string, extra?: Record<string, unknown>): void { this.write('debug', msg, extra); }
  info(msg: string, extra?: Record<string, unknown>): void { this.write('info', msg, extra); }
  warn(msg: string, extra?: Record<string, unknown>): void { this.write('warn', msg, extra); }
  error(msg: string, extra?: Record<string, unknown>): void { this.write('error', msg, extra); }
  fatal(msg: string, extra?: Record<string, unknown>): void { this.write('fatal', msg, extra); }

  /**
   * Create a child logger with bound context.
   * @param bindings Context to merge into every log entry
   * @returns New Logger instance with inherited settings
   */
  child(bindings: Record<string, unknown>): Logger {
    const child = new Logger();
    child.minLevel = this.minLevel;
    child.outputStream = this.outputStream;
    child.logFilePath = this.logFilePath;
    const parentWrite = this.write.bind(this);
    child.write = (level, msg, extra) => parentWrite(level, msg, { ...bindings, ...extra });
    return child;
  }

  /** Reset to default state (stdout, info level) */
  reset(): void {
    this.minLevel = 30;
    this.outputStream = 'stdout';
    this.logFilePath = '';
  }
}

/**
 * Shared singleton logger instance.
 * Use `logger.child()` to create scoped loggers with bound context.
 */
export const logger = new Logger();
