export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

export interface LogManagerOptions {
  level: LogLevel;
  prefix?: string;
  enableConsole?: boolean;
  enableCustomHandler?: (level: LogLevel, message: string, data?: unknown) => void;
}

export class LogManager {
  private options: LogManagerOptions;
  private levels = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

  constructor(options: LogManagerOptions) {
    this.options = {
      prefix: '[UIRuntime]',
      enableConsole: true,
      ...options
    };
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const currentLevel = this.levels[this.options.level];
    const messageLevel = this.levels[level];
    
    if (messageLevel > currentLevel) return;

    const formattedMessage = `${this.options.prefix} ${message}`;
    
    if (this.options.enableConsole) {
      switch (level) {
        case 'error':
          console.error(formattedMessage, data || '');
          break;
        case 'warn':
          console.warn(formattedMessage, data || '');
          break;
        case 'info':
          console.info(formattedMessage, data || '');
          break;
        case 'debug':
          console.debug(formattedMessage, data || '');
          break;
      }
    }

    if (this.options.enableCustomHandler) {
      this.options.enableCustomHandler(level, message, data);
    }
  }
}
