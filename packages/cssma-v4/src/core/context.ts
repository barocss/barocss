// Types for theme/config/context
export interface CssmaTheme {
  [namespace: string]: any;
}

export interface CssmaConfig {
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
  let keys: (string | number)[] = [];
  if (path.length === 1 && typeof path[0] === 'string' && path[0].includes('.')) {
    keys = path[0].split('.');
  } else {
    keys = path;
  }
  return keys.reduce((acc, key) => (acc == null ? undefined : acc[key]), themeObj);
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