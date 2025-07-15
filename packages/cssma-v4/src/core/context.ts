// Types for theme/config/context
export interface CssmaTheme {
  extend?: CssmaTheme;
  [namespace: string]: any;
}

export interface CssmaConfig {
  prefix?: string;  // prefix for class names, default is 'cssma-'
  darkMode?: boolean | 'media' | 'class';
  theme?: CssmaTheme;
  presets?: { theme: CssmaTheme }[];
  plugins?: any[];
  [key: string]: any;
}

export interface CssmaContext {
  hasPreset: (category: string, preset: string) => boolean;
  theme: (...path: (string|number)[]) => any;
  config: (...path: (string|number)[]) => any;
  plugins: any[];
}

// Deep merge utility
export function deepMerge<T>(base: T, override: Partial<T>): T {
  const result: any = {};
  const keys = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(override || {}),
  ]);
  for (const key of keys) {
    const skey = String(key);
    const baseVal = base && typeof base === 'object' ? base[skey] : undefined;
    const overrideVal = override && typeof override === 'object' ? override[skey] : undefined;
    if (
      overrideVal &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal)
    ) {
      result[skey] = deepMerge(
        (typeof baseVal === 'object' && baseVal !== null) ? baseVal : {},
        overrideVal
      );
    } else if (overrideVal !== undefined) {
      result[skey] = overrideVal;
    } else {
      result[skey] = baseVal;
    }
  }
  return result;
}

// Shallow merge utility
export function shallowMerge<T>(base: T, override: Partial<T>): T {
  return { ...base, ...override };
}

// theme getter
export function themeGetter(themeObj: CssmaTheme, ...path: (string | number)[]): any {
  
  // Handle dot notation in single path
  if (path.length === 1 && typeof path[0] === 'string' && path[0].includes('.')) {
    const keys = path[0].split('.');
    return keys.reduce((acc, key) => (acc == null ? undefined : acc[key]), themeObj);
  }
  
  // For multiple path segments, try different strategies
  if (path.length >= 2) {
    const [namespace, ...rest] = path;
    
    // Strategy 1: Try exact key match first (flat structure)
    // e.g., colors['red-500']
    if (rest.length === 1 && typeof rest[0] === 'string') {
      const exactResult = themeObj[namespace as string]?.[rest[0]];
      if (exactResult !== undefined) {
        return exactResult;
      }
    }
    
    // Strategy 2: Try nested structure by splitting on '-'
    // e.g., colors.red.500 (from 'red-500')
    const expandedKeys = rest.map(key => {
      if (typeof key === 'string' && key.includes('-')) {
        return key.split('-');
      }
      if (typeof key === 'string' && key.includes('.')) {
        return key.split('.');
      }
      return key;
    }).flat();
    
    const allKeys = [namespace, ...expandedKeys];
    return allKeys.reduce((acc, key) => (acc == null ? undefined : acc[key]), themeObj);
  }
  
  // Fallback: simple path traversal
  return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), themeObj);
}

// config getter
export function configGetter(config: any, ...path: (string|number)[]): any {
  let keys: (string|number)[] = [];
  if (path.length === 1 && typeof path[0] === 'string' && path[0].includes('.')) {
    keys = path[0].split('.');
  } else {
    keys = path;
  }
  return keys.reduce((acc, key) => (acc ? acc[key] : undefined), config);
}

// hasPreset
export function hasPreset(themeObj: CssmaTheme, category: string, preset: string): any {
  return themeObj[category]?.includes?.(preset);
}

// resolveTheme
export function resolveTheme(config: CssmaConfig): CssmaTheme {
  let theme: CssmaTheme = {};
  if (config.presets) {
    for (const preset of config.presets) {
      if (preset.theme) {
        theme = deepMerge(theme, preset.theme);
      }
    }
  }
  if (config.theme) {
    const { extend, ...overrideTheme } = config.theme as any;
    theme = shallowMerge(theme, overrideTheme);
    if (extend) {
      theme = deepMerge(theme, extend);
    }
  }
  return theme;
}

// createContext
export function createContext(configObj: CssmaConfig): CssmaContext {
  const themeObj = resolveTheme(configObj);
  return {
    hasPreset: (category: string, preset: string) => hasPreset(themeObj, category, preset),
    theme: (...args) => themeGetter(themeObj, ...args),
    config: (...args) => configGetter(configObj, ...args),
    plugins: configObj.plugins ?? [],
  };
} 