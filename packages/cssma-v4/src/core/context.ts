// Types for theme/config/context
export interface CssmaTheme {
  extend?: CssmaTheme;
  [namespace: string]: any;
}

export interface CssmaConfig {
  prefix?: string;  // prefix for class names, default is 'cssma-'
  /**
   * Tailwind-style dark mode strategy
   * - 'media': uses @media (prefers-color-scheme: dark)
   * - 'class': uses .dark selector
   * - string[]: custom selectors (e.g. ['class', '[data-theme="dark"]'])
   */
  darkMode?: 'media' | 'class' | string[];
  theme?: CssmaTheme;
  presets?: { theme: CssmaTheme }[];
  plugins?: any[];
  [key: string]: any;
}

export const defaultConfig: CssmaConfig = {
  prefix: 'cssma-',
  darkMode: 'media', // Tailwind 기본값과 동일
};

export interface CssmaContext {
  hasPreset: (category: string, preset: string) => boolean;
  theme: (...path: (string|number)[]) => any;
  config: (...path: (string|number)[]) => any;
  plugins: any[];
}

// Deep merge utility
export function deepMerge<T extends Record<string, any>>(base: T, override: Partial<T>): T {
  const result: any = {};
  const keys = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(override || {}),
  ]);
  for (const key of keys) {
    const skey = String(key);
    const baseVal = base && typeof base === 'object' ? (base as Record<string, any>)[skey] : undefined;
    const overrideVal = override && typeof override === 'object' ? (override as Record<string, any>)[skey] : undefined;
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

export type ThemeGetter = (...path: (string|number)[]) => any;

/**
 * Tailwind-style theme getter for CSSMA
 *
 * - Supports category-level (first path segment) function values only.
 *   - If the category (e.g., 'spacing', 'colors') is a function, it will be executed with the theme getter as argument.
 *   - This allows dynamic theme extension and plugin-style patterns, e.g.:
 *     spacing: (theme) => ({ ...theme('spacing'), '72': '18rem' })
 * - Leaf (property) functions are NOT supported and will be ignored (returns undefined).
 * - Infinite recursion is prevented: If the exact same path is being resolved recursively (directly or indirectly), undefined is returned for that call.
 *   - Category-level functions can safely call theme('category.otherKey') for dynamic references.
 *   - Only true recursion on the same path is blocked.
 * - All theme lookups (theme('category.key')) will always re-execute the category function if present, ensuring dynamic resolution.
 *
 * @param themeObj - The theme object (possibly with category functions)
 * @param path - Path segments (string or number), or dot-path string (e.g. 'colors.red.500')
 * @returns The resolved theme value, or undefined if not found or if a leaf function is encountered
 *
 * @example
 *   const theme = {
 *     spacing: (theme) => ({ 1: '0.25rem', 2: theme('spacing.1') }),
 *   };
 *   themeGetter(theme, 'spacing.2'); // '0.25rem'
 *
 * @example
 *   // Infinite recursion is prevented:
 *   const theme = {
 *     spacing: (theme) => theme('spacing.1'),
 *   };
 *   themeGetter(theme, 'spacing.1'); // undefined
 */
export function themeGetter(themeObj: CssmaTheme, ...path: (string | number)[]): any {
  // The theme getter function itself, passed to category functions for dynamic resolution
  const theme: ThemeGetter = (...args: (string | number)[]) => themeGetter(themeObj, ...args);

  // Parse the path: support both dot-path string and array of segments
  let keys: (string | number)[] = [];
  if (path.length === 1 && typeof path[0] === 'string' && path[0].includes('.')) {
    keys = path[0].split('.');
  } else {
    if (path[0] === 'colors' && typeof path[1] === 'string' && path[1].includes('-')) {
      // colors.red-500 → colors.red.500
      keys = (path[1] as string).split('-');
      keys = [path[0], ...keys];
    } else {
      keys = path;
    }
  }
  if (keys.length === 0) return undefined;

  // Infinite recursion protection: track currently resolving full paths
  // If the exact same path is being resolved recursively, return undefined
  const staticInProgress = (themeGetter as any)._inProgress || new Set();
  (themeGetter as any)._inProgress = staticInProgress;
  const pathKey = keys.join('.');
  if (staticInProgress.has(pathKey)) return undefined;
  staticInProgress.add(pathKey);

  // Get the category value (could be a function or object)
  let value = themeObj[keys[0]];
  // If the category is a function, execute it with the theme getter
  // This enables dynamic theme extension and plugin-style patterns
  if (typeof value === 'function') {
    value = value(theme);
  }

  // Traverse the rest of the path (leaf keys)
  for (let i = 1; i < keys.length; i++) {
    if (value == null) {
      staticInProgress.delete(pathKey);
      return undefined;
    }
    value = value[keys[i]];
  }

  staticInProgress.delete(pathKey);
  // If the final value is a function (leaf function), do NOT execute it
  // Only category-level functions are supported; leaf functions are ignored
  if (typeof value === 'function') return undefined;

  // Return the resolved value (static or dynamically generated)
  return value;
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
    theme = deepMerge(theme, overrideTheme); // shallowMerge → deepMerge로 변경
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
    theme: (...args) => {
      return themeGetter(themeObj, ...args);
    },
    config: (...args) => configGetter(configObj, ...args),
    plugins: configObj.plugins ?? [],
  };
} 