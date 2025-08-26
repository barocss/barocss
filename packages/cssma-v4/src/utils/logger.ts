// CSSMA logger - simple structure
const isDevelopment = process.env.NODE_ENV === 'development';
const CSSMA_VERBOSE = process.env.CSSMA_VERBOSE === 'true';
const CSSMA_DEBUG = process.env.CSSMA_DEBUG === 'true';
const PREFIX = '🔍 [CSSMA]';

const shouldLog = (level: 'error' | 'warn' | 'info' | 'debug' | 'verbose') => {
  switch (level) {
    case 'error': return true; // always log errors
    case 'warn': return isDevelopment; // log warnings only in development
    case 'info': return isDevelopment; // log info only in development
    case 'debug': return isDevelopment && CSSMA_DEBUG; // log debug only when enabled
    case 'verbose': return isDevelopment && CSSMA_VERBOSE; // log verbose only when enabled
    default: return false;
  }
};

export const logger = {
  error: (message: string, data?: any) => {
    console.error(`${PREFIX} ${message}`, data);
  },
  
  warn: (message: string, data?: any) => {
    if (shouldLog('warn')) {
      console.warn(`${PREFIX} ${message}`, data);
    }
  },
  
  info: (message: string, data?: any) => {
    if (shouldLog('info')) {
      console.log(`${PREFIX} ${message}`, data);
    }
  },
  
  debug: (message: string, data?: any) => {
    if (shouldLog('debug')) {
      console.log(`${PREFIX} ${message}`, data);
    }
  },
  
  verbose: (message: string, data?: any) => {
    if (shouldLog('verbose')) {
      console.log(`${PREFIX} ${message}`, data);
    }
  }
};

// Logger configuration helper
export const setLoggerLevel = (level: 'error' | 'warn' | 'info' | 'debug' | 'verbose') => {
  // Configure log level via environment variables
  if (level === 'verbose') {
    process.env.CSSMA_VERBOSE = 'true';
  } else if (level === 'debug') {
    process.env.CSSMA_DEBUG = 'true';
  }
};