import { Context, Config } from './context';

/**
 * Barocss Plugin System
 * 
 * Plugins allow you to extend BAROCSS with custom utilities, variants, and theme extensions.
 * Each plugin is a function that receives the BAROCSS context and can register utilities,
 * modifiers, theme extensions, and other customizations.
 */

export interface Plugin {
  /**
   * Plugin name for identification and debugging
   */
  name?: string;
  
  /**
   * Plugin version for compatibility checking
   */
  version?: string;
  
  /**
   * Plugin description for documentation
   */
  description?: string;
  
  /**
   * Main plugin function that receives the BAROCSS context
   * @param ctx - BAROCSS context with theme, config, and utilities
   * @param config - User configuration passed to the plugin
   */
  handler: (ctx: Context, config?: any) => void;

  /**
   * Plugin theme function that receives the BAROCSS context
   * @param ctx - BAROCSS context with theme, config, and utilities
   * @param config - User configuration passed to the plugin
   */
  theme?: (ctx: Context, config?: any) => Record<string, any>;
  
  /**
   * Plugin dependencies (other plugin names)
   */
  dependencies?: string[];
  
  /**
   * Plugin options schema for validation
   */
  optionsSchema?: Record<string, any>;
}

/**
 * Utility Plugin - Extends BAROCSS with custom utilities
 */
export interface UtilityPlugin {
  /**
   * Plugin name
   */
  name: string;
  
  /**
   * Plugin version
   */
  version?: string;
  
  /**
   * Plugin description
   */
  description?: string;
  
  /**
   * Register custom utilities
   * @param ctx - BAROCSS context
   * @param config - Plugin configuration
   */
  utilities?: (ctx: Context, config?: any) => void;
  
  /**
   * Extend theme with custom values
   * @param ctx - BAROCSS context
   * @param config - Plugin configuration
   */
  theme?: (ctx: Context, config?: any) => Record<string, any>;
  
  /**
   * Plugin dependencies
   */
  dependencies?: string[];
  
  /**
   * Plugin options schema
   */
  optionsSchema?: Record<string, any>;
}

/**
 * Variant Plugin - Extends BAROCSS with custom variants/modifiers
 */
export interface VariantPlugin {
  /**
   * Plugin name
   */
  name: string;
  
  /**
   * Plugin version
   */
  version?: string;
  
  /**
   * Plugin description
   */
  description?: string;
  
  /**
   * Register custom variants/modifiers
   * @param ctx - BAROCSS context
   * @param config - Plugin configuration
   */
  variants?: (ctx: Context, config?: any) => void;
  
  /**
   * Plugin dependencies
   */
  dependencies?: string[];
  
  /**
   * Plugin options schema
   */
  optionsSchema?: Record<string, any>;
}

/**
 * Theme Plugin - Extends BAROCSS with custom theme extensions
 */
export interface ThemePlugin {
  /**
   * Plugin name
   */
  name: string;
  
  /**
   * Plugin version
   */
  version?: string;
  
  /**
   * Plugin description
   */
  description?: string;
  
  /**
   * Extend theme with custom values
   * @param ctx - BAROCSS context
   * @param config - Plugin configuration
   */
  theme?: (ctx: Context, config?: any) => Record<string, any>;
  
  /**
   * Plugin dependencies
   */
  dependencies?: string[];
  
  /**
   * Plugin options schema
   */
  optionsSchema?: Record<string, any>;
}

/**
 * Plugin Registry
 */
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private utilityPlugins: Map<string, UtilityPlugin> = new Map();
  private variantPlugins: Map<string, VariantPlugin> = new Map();
  private themePlugins: Map<string, ThemePlugin> = new Map();

  /**
   * Register a general plugin
   */
  register(plugin: Plugin): void {
    const name = plugin.name || `plugin-${Date.now()}`;
    this.plugins.set(name, plugin);
  }

  /**
   * Register a utility plugin
   */
  registerUtility(plugin: UtilityPlugin): void {
    this.utilityPlugins.set(plugin.name, plugin);
  }

  /**
   * Register a variant plugin
   */
  registerVariant(plugin: VariantPlugin): void {
    this.variantPlugins.set(plugin.name, plugin);
  }

  /**
   * Register a theme plugin
   */
  registerTheme(plugin: ThemePlugin): void {
    this.themePlugins.set(plugin.name, plugin);
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all utility plugins
   */
  getUtilityPlugins(): UtilityPlugin[] {
    return Array.from(this.utilityPlugins.values());
  }

  /**
   * Get all variant plugins
   */
  getVariantPlugins(): VariantPlugin[] {
    return Array.from(this.variantPlugins.values());
  }

  /**
   * Get all theme plugins
   */
  getThemePlugins(): ThemePlugin[] {
    return Array.from(this.themePlugins.values());
  }

  /**
   * Execute all plugins with context
   */
  executePlugins(ctx: Context, config: Config): void {
    // Execute general plugins
    for (const plugin of this.plugins.values()) {
      try {
        plugin.handler(ctx, config);
      } catch (error) {
        console.error(`Error executing plugin ${plugin.name}:`, error);
      }
    }

    // Execute utility plugins
    for (const plugin of this.utilityPlugins.values()) {
      try {
        if (plugin.utilities) {
          plugin.utilities(ctx, config);
        }
      } catch (error) {
        console.error(`Error executing utility plugin ${plugin.name}:`, error);
      }
    }

    // Execute variant plugins
    for (const plugin of this.variantPlugins.values()) {
      try {
        if (plugin.variants) {
          plugin.variants(ctx, config);
        }
      } catch (error) {
        console.error(`Error executing variant plugin ${plugin.name}:`, error);
      }
    }
  }

  /**
   * Execute theme plugins and return merged theme
   */
  executeThemePlugins(ctx: Context, config: Config): Record<string, any> {
    let mergedTheme: Record<string, any> = {};

    for (const plugin of this.themePlugins.values()) {
      try {
        if (plugin.theme) {
          const pluginTheme = plugin.theme(ctx, config);
          mergedTheme = { ...mergedTheme, ...pluginTheme };
        }
      } catch (error) {
        console.error(`Error executing theme plugin ${plugin.name}:`, error);
      }
    }

    return mergedTheme;
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
    this.utilityPlugins.clear();
    this.variantPlugins.clear();
    this.themePlugins.clear();
  }
}

// Global plugin registry instance
export const pluginRegistry = new PluginRegistry();

/**
 * Plugin helper functions
 */

/**
 * Create a utility plugin
 */
export function createUtilityPlugin(plugin: UtilityPlugin): Plugin {
  return {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    handler: (ctx: Context, config?: any) => {
      if (plugin.utilities) {
        plugin.utilities(ctx, config);
      }
      if (plugin.theme) {
        const pluginTheme = plugin.theme(ctx, config);
        if (pluginTheme) {
          // Extend the context's theme with plugin theme
          const currentTheme = ctx.theme();
          Object.assign(currentTheme, pluginTheme);
        }
      }
    }
  };
}

/**
 * Create a variant plugin
 */
export function createVariantPlugin(plugin: VariantPlugin): Plugin {
  return {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    handler: (ctx: Context, config?: any) => {
      if (plugin.variants) {
        plugin.variants(ctx, config);
      }
    }
  };
}

/**
 * Create a theme plugin
 */
export function createThemePlugin(plugin: ThemePlugin): Plugin {
  return {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    handler: (ctx: Context, config?: any) => {
      // Theme extension is handled in context.ts
      // But we need to call the theme function to register it
      if (plugin.theme) {
        plugin.theme(ctx, config);
      }
    },
    // Include the theme function so context can access it
    theme: plugin.theme
  };
}

/**
 * Register a plugin with the global registry
 */
export function registerPlugin(plugin: Plugin): void {
  pluginRegistry.register(plugin);
}

/**
 * Register a utility plugin with the global registry
 */
export function registerUtilityPlugin(plugin: UtilityPlugin): void {
  pluginRegistry.registerUtility(plugin);
}

/**
 * Register a variant plugin with the global registry
 */
export function registerVariantPlugin(plugin: VariantPlugin): void {
  pluginRegistry.registerVariant(plugin);
}

/**
 * Register a theme plugin with the global registry
 */
export function registerThemePlugin(plugin: ThemePlugin): void {
  pluginRegistry.registerTheme(plugin);
} 