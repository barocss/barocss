import { defaultTheme } from "../theme";
import { keyframesToCss, themeToCssVarsAll, toCssVarsBlock } from "./cssVars";
import { clearAllCaches } from "../utils/cache";
import { type Plugin } from "./plugin";
import preflightMinimalCSS from "../css/preflight-minimal.css?raw";
import preflightStandardCSS from "../css/preflight-standard.css?raw";
import preflightFullCSS from "../css/preflight-full.css?raw";

type PreflightLevel = 'minimal' | 'standard' | 'full' | true | false;

export function getPreflightCSS(level: PreflightLevel = true): string {
  if (level === 'minimal') {
    return preflightMinimalCSS;
  } else if (level === 'standard') {
    return preflightStandardCSS;
  } else if (level === 'full') {
    return preflightFullCSS;
  } else if (level === true) {
    return preflightFullCSS;
  } else if (level === false) {
    return '';
  }
  return '';
}

// Types for theme/config/context
export interface Theme {
  extend?: Theme;
  [namespace: string]: any;
}

export interface Config {
  prefix?: string;  // prefix for class names, default is 'barocss-'
  /**
   * Modern dark mode strategy
   * - 'media': uses @media (prefers-color-scheme: dark)
   * - 'class': uses .dark selector
   * - string[]: custom selectors (e.g. ['class', '[data-theme="dark"]'])
   */
  darkMode?: 'media' | 'class' | string[];
  theme?: Theme;
  presets?: { theme: Theme }[];

  /**
   * Whether to include preflight CSS
   * - 'minimal': Minimal preflight CSS
   * - 'standard': Standard preflight CSS
   * - 'full': Full preflight CSS
   * - true: Full preflight CSS (default)
   * - false: No preflight CSS
   * 
   * default: true (full preflight)
   */
  preflight?: PreflightLevel;
  /**
   * BAROCSS plugins for extending functionality
   * - Can be plugin functions, plugin objects, or plugin arrays
   * - Plugins are executed in order and can register utilities, variants, and theme extensions
   */
  plugins?: (Plugin | ((ctx: Context, config?: Config) => void))[];
  /**
   * Whether to clear all caches when context is created/changed
   * - true (default): Clear all caches on context change
   * - false: Keep existing caches
   */
  clearCacheOnContextChange?: boolean;
  [key: string]: any;
}

export const defaultConfig: Config = {
  prefix: 'barocss-',
  darkMode: 'media', // same as default
};

export interface Context {
  hasPreset: (category: string, preset: string) => boolean;
  theme: (...path: (string|number)[]) => any;
  config: (...path: (string|number)[]) => any;
  plugins: any[];
  themeToCssVars: (prefix?: string) => string;
  // Safe API for extending theme from plugins
  extendTheme: (category: string, values: Record<string, any> | Function) => void;
  getPreflightCSS: (level?: PreflightLevel) => string;
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
 * Modern theme getter for BAROCSS
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
export function themeGetter(themeObj: Theme, ...path: (string | number)[]): any {
  // The theme getter function itself, passed to category functions for dynamic resolution
  const theme: ThemeGetter = (...args: (string | number)[]) => themeGetter(themeObj, ...args);

  // Parse the path: support both dot-path string and array of segments
  let keys: (string | number)[] = [];
  if (path.length === 1 && typeof path[0] === 'string' && path[0].includes('.')) {
    keys = path[0].split('.');
  } else {
    if (path[0] === 'colors' && typeof path[1] === 'string' && path[1].includes('-')) {
      // colors.red-500 → colors.red.500 (only for color names with numbers)
      // But custom-blue should remain as custom-blue
      const colorKey = path[1] as string;
      if (colorKey.match(/^[a-zA-Z]+-\d+$/)) {
        // Only split if it's a pattern like "red-500", "blue-600", etc.
        keys = colorKey.split('-');
        keys = [path[0], ...keys];
      } else {
        // For custom keys like "custom-blue", keep as is
        keys = path;
      }
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
  // console.log(`[themeGetter] category '${keys[0]}' value:`, value, `type:`, typeof value);
  
  // If the category is a function, execute it with the theme getter
  // This enables dynamic theme extension and plugin-style patterns
  if (typeof value === 'function') {
    // console.log(`[themeGetter] executing category function for '${keys[0]}'`);
    value = value(theme);
    // console.log(`[themeGetter] category function result:`, value);
  }

  // Traverse the rest of the path (leaf keys)
  for (let i = 1; i < keys.length; i++) {
    // console.log(`[themeGetter] traversing key '${keys[i]}', current value:`, value);
    if (value == null) {
      // console.log(`[themeGetter] value is null/undefined at key '${keys[i]}'`);
      staticInProgress.delete(pathKey);
      return undefined;
    }
    value = value[keys[i]];
    // console.log(`[themeGetter] after accessing '${keys[i]}', value:`, value);
  }

  staticInProgress.delete(pathKey);
  // If the final value is a function (leaf function), do NOT execute it
  // Only category-level functions are supported; leaf functions are ignored
  if (typeof value === 'function') {
    return undefined;
  }

  // Return the resolved value (static or dynamically generated)
  // console.log(`[themeGetter] final result:`, value);
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
export function hasPreset(themeObj: Theme, category: string, preset: string): any {
  return themeObj[category]?.includes?.(preset);
}

// resolveTheme
export function resolveTheme(config: Config): Theme {
  let theme: Theme = {};
  if (config.presets) {
    for (const preset of config.presets) {
      if (preset.theme) {
        theme = deepMerge(theme, preset.theme);
      }
    }
  }
  if (config.theme) {
    const { extend, ...overrideTheme } = config.theme as any;
    theme = deepMerge(theme, overrideTheme); // switch from shallowMerge to deepMerge
    if (extend) {
      theme = deepMerge(theme, extend);
    }
  }
  return theme;
}


export function themeToCssVars(theme: Theme): string {
  const vars = themeToCssVarsAll(theme);
  // console.log('[themeToCssVars] vars', vars);
  const result = toCssVarsBlock(vars, `
${keyframesToCss(theme.keyframes || {})}
`);

// console.log('[themeToCssVars] result', result);

  return result;
}

// createContext
export function createContext(configObj: Config): Context {
  // Automatically include defaultTheme as the base preset
  const configWithDefaults = {
    presets: [
      { theme: defaultTheme },  // always include defaultTheme as base preset
      ...(configObj.presets || [])
    ],
    ...configObj
  };
  
  let themeObj = resolveTheme(configWithDefaults);
  
  // Auto-clear caches on context change (optional)
  if (configObj.clearCacheOnContextChange !== false) {
    clearAllCaches();
  }

  // 1. Declare ctx first as an object
  const ctx: Context = {
    hasPreset: (category: string, preset: string) => {
      const result = hasPreset(themeObj, category, preset);
      // console.log(`[hasPreset] category: ${category}, preset: ${preset} =>`, result);
      return result;
    },
    theme: (...args) => {
      const result = themeGetter(themeObj, ...args);
      // console.log(`[theme] path:`, args, `=>`, result);
      return result;
    },
    config: (...args) => {
      const result = configGetter(configWithDefaults, ...args);
      // console.log(`[config] path:`, args, `=>`, result);
      return result;
    },
    plugins: configWithDefaults.plugins ?? [],
    themeToCssVars: () => themeToCssVars(themeObj),
    // Safe API for theme extension from plugins
    extendTheme: (category: string, values: Record<string, any> | Function) => {
      // console.log(`[extendTheme] category: ${category}, values:`, values);
      
      if (typeof values === 'function') {
        // If it's a function, execute with theme getter
        const themeFunction = values as (theme: ThemeGetter) => any;
        const result = themeFunction(ctx.theme);
        if (result && typeof result === 'object') {
          // Merge with existing values
          const existingValues = themeObj[category] || {};
          themeObj[category] = {
            ...existingValues,
            ...result
          };
          // console.log(`[extendTheme] function result merged for ${category}:`, themeObj[category]);
        }
      } else if (typeof values === 'object' && values !== null && !Array.isArray(values)) {
        // Get existing category values
        const existingValues = themeObj[category] || {};
        
        // Merge existing and new values
        themeObj[category] = {
          ...existingValues,
          ...values
        };
        // console.log(`[extendTheme] merged ${category}:`, themeObj[category]);
      } else {
        // console.warn(`[extendTheme] Invalid values for category ${category}:`, values);
      }
    },
    getPreflightCSS: (level: PreflightLevel = true) => {
      return getPreflightCSS(level);
    }
  };

  // 2. Property assignment (functions reference themeObj, configWithDefaults, etc.)
  // ctx.hasPreset = (category: string, preset: string) => {
  //   const result = hasPreset(themeObj, category, preset);
  //   console.log(`[hasPreset] category: ${category}, preset: ${preset} =>`, result);
  //   return result;
  // };
  // ctx.theme = (...args) => {
  //   const value = themeGetter(themeObj, ...args);
  //   console.log(`[theme] path:`, args, '=>', value);
  //   return value;
  // };
  // ctx.config = (...args) => {
  //   const value = configGetter(configWithDefaults, ...args);
  //   console.log(`[config] path:`, args, '=>', value);
  //   return value;
  // };
  // ctx.plugins = configWithDefaults.plugins ?? [];
  // ctx.themeToCssVars = () => themeToCssVars(themeObj);

  // 3. Execute plugins after ctx is fully ready
  if (configWithDefaults.plugins && configWithDefaults.plugins.length > 0) {
    // console.log('--- Plugin execution start ---');
    for (const plugin of configWithDefaults.plugins) {
      try {
        // Extract pluginConfig from the config
        // const pluginConfig = configWithDefaults.pluginConfig || {}; // This line is removed
        // console.log('Executing plugin:', plugin.name || '[function]', plugin);
        
        if (typeof plugin === 'function') {
          // Plugin function - pass the full config
          plugin(ctx, configWithDefaults);
          // console.log('Executed plugin function');
        } else if (plugin && typeof plugin.handler === 'function') {
          // Plugin object - pass full config
          plugin.handler(ctx, configWithDefaults);
          // console.log('Executed plugin.handler for', plugin.name);
          
          // Handle theme extensions from plugins
          // Check if this plugin has a theme function
          if (plugin.theme && typeof plugin.theme === 'function') {
            // console.log(`Calling theme function for plugin: ${plugin.name}`);
            const pluginTheme = plugin.theme(ctx, configWithDefaults);
            // console.log(`Plugin theme result:`, pluginTheme);
            if (pluginTheme) {
              // console.log(`Merging theme:`, pluginTheme);
              // In-place merge for debugging
              for (const key in pluginTheme) {
                if (typeof pluginTheme[key] === 'object' && pluginTheme[key] !== null) {
                  themeObj[key] = themeObj[key] || {};
                  Object.assign(themeObj[key], pluginTheme[key]);
                  // console.log(`themeObj[${key}] after merge:`, themeObj[key]);
                } else {
                  themeObj[key] = pluginTheme[key];
                  // console.log(`themeObj[${key}] set to:`, pluginTheme[key]);
                }
              }
              // console.log(`Updated themeObj:`, themeObj);
            }
          }
        }
      } catch (error) {
        console.error(`Error executing plugin ${plugin.name || 'unknown'}:`, error);
      }
    }
    // console.log('--- Plugin execution end ---');
  }

  // 4. Return
  return ctx;
} 