// CSSMA 로거 - 단순한 구조
const isDevelopment = process.env.NODE_ENV === 'development';
const CSSMA_VERBOSE = process.env.CSSMA_VERBOSE === 'true';
const CSSMA_DEBUG = process.env.CSSMA_DEBUG === 'true';
const PREFIX = '🔍 [CSSMA]';

const shouldLog = (level: 'error' | 'warn' | 'info' | 'debug' | 'verbose') => {
  switch (level) {
    case 'error': return true; // 에러는 항상 로그
    case 'warn': return isDevelopment; // 경고는 개발 모드에서만
    case 'info': return isDevelopment; // 정보는 개발 모드에서만
    case 'debug': return isDevelopment && CSSMA_DEBUG; // 디버그는 디버그 모드에서만
    case 'verbose': return isDevelopment && CSSMA_VERBOSE; // 상세는 상세 모드에서만
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

// 로거 설정 함수
export const setLoggerLevel = (level: 'error' | 'warn' | 'info' | 'debug' | 'verbose') => {
  // 환경 변수로 로그 레벨 설정
  if (level === 'verbose') {
    process.env.CSSMA_VERBOSE = 'true';
  } else if (level === 'debug') {
    process.env.CSSMA_DEBUG = 'true';
  }
};