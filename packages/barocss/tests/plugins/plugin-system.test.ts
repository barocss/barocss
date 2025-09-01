import { describe, it, expect, beforeEach } from 'vitest';
import { createContext } from '../../src/core/context';
import { 
  createUtilityPlugin, 
  createVariantPlugin, 
  createThemePlugin,
  type BarocssPlugin,
  type UtilityPlugin,
  type VariantPlugin,
  type ThemePlugin
} from '../../src/core/plugin';
import { staticUtility, functionalUtility } from '../../src/core/registry';
import { staticModifier, functionalModifier } from '../../src/core/registry';
import { decl, rule } from '../../src/core/ast';
import { parseClassToAst } from '../../src/core/engine';
import '../../src/presets'; // Import presets to register utilities

describe('Barocss Plugin System', () => {
  beforeEach(() => {
    // Clear any existing registrations before each test
    // This would require exposing clear methods from registry
  });

  describe('Utility Plugin', () => {
    it('should register custom utilities via plugin', () => {
      // Create a utility plugin that adds custom utilities
      const customUtilityPlugin: UtilityPlugin = createUtilityPlugin({
        name: 'custom-utility-plugin',
        version: '1.0.0',
        description: 'Adds custom utility classes',
        utilities: (ctx) => {
          // Register a static utility
          staticUtility('custom-bg-red', [
            ['background-color', '#ff0000']
          ]);

          // Register a functional utility
          functionalUtility({
            name: 'custom-text',
            prop: 'color',
            supportsArbitrary: true,
            handleBareValue: ({ value }) => {
              return `var(--custom-color-${value})`;
            }
          });
        }
      });

      // Create context with the plugin
      const ctx = createContext({
        plugins: [customUtilityPlugin]
      });

      // Test that the custom utilities work
      const result1 = parseClassToAst('custom-bg-red', ctx);
      expect(result1).toEqual([
        { type: 'decl', prop: 'background-color', value: '#ff0000', source: undefined }
      ]);

      const result2 = parseClassToAst('custom-text-blue', ctx);
      expect(result2).toEqual([
        { type: 'decl', prop: 'color', value: 'var(--custom-color-blue)', source: undefined }
      ]);
    });

    it('should extend theme via utility plugin', () => {
      const themePlugin: ThemePlugin = createThemePlugin({
        name: 'custom-theme-plugin',
        version: '1.0.0',
        description: 'Extends theme with custom values',
        theme: (ctx) => ({
          colors: {
            'custom-blue': '#0066cc',
            'custom-green': '#00cc66'
          },
          spacing: {
            'custom-lg': '2rem',
            'custom-xl': '3rem'
          }
        })
      });

      const ctx = createContext({
        plugins: [themePlugin]
      });

      // Test that custom theme values are available
      expect(ctx.theme('colors', 'custom-blue')).toBe('#0066cc');
      expect(ctx.theme('spacing', 'custom-lg')).toBe('2rem');
    });
  });

  describe('Variant Plugin', () => {
    it('should register custom variants via plugin', () => {
      const customVariantPlugin: VariantPlugin = createVariantPlugin({
        name: 'custom-variant-plugin',
        version: '1.0.0',
        description: 'Adds custom variant modifiers',
        variants: (ctx) => {
          // Register a static modifier
          staticModifier('custom-hover', ['&:hover'], { source: 'custom' });

          // Register a functional modifier
          functionalModifier(
            (mod) => mod.startsWith('custom-'),
            ({ selector, mod }) => {
              return `${selector}[data-custom="${mod.replace('custom-', '')}"]`;
            },
            undefined,
            { source: 'custom' }
          );
        }
      });

      const ctx = createContext({
        plugins: [customVariantPlugin]
      });

      // Test custom variant functionality
      // This would require testing the variant system integration
      expect(ctx.plugins).toContain(customVariantPlugin);
    });
  });

  describe('General Plugin', () => {
    it('should execute general plugin handler', () => {
      let pluginExecuted = false;
      let receivedCtx: any = null;
      let receivedConfig: any = null;

      const generalPlugin: BarocssPlugin = {
        name: 'test-general-plugin',
        version: '1.0.0',
        description: 'Test general plugin',
        handler: (ctx, config) => {
          pluginExecuted = true;
          receivedCtx = ctx;
          receivedConfig = config;
        }
      };

      const config = {
        theme: {
          colors: { 'test-red': '#ff0000' }
        }
      };

      const ctx = createContext({
        ...config,
        plugins: [generalPlugin]
      });

      expect(pluginExecuted).toBe(true);
      expect(receivedCtx).toBe(ctx);
      expect(receivedConfig).toEqual(expect.objectContaining(config));
    });

    it('should handle plugin functions (not just objects)', () => {
      let pluginExecuted = false;

      const pluginFunction = (ctx: any, config: any) => {
        pluginExecuted = true;
        // Register a utility in the plugin function
        staticUtility('plugin-function-utility', [
          ['background-color', '#00ff00']
        ]);
      };

      const ctx = createContext({
        plugins: [pluginFunction]
      });

      expect(pluginExecuted).toBe(true);

      // Test that the utility registered in the plugin function works
      const result = parseClassToAst('plugin-function-utility', ctx);
      expect(result).toEqual([
        { type: 'decl', prop: 'background-color', value: '#00ff00', source: undefined }
      ]);
    });
  });

  describe('Plugin Dependencies', () => {
    it('should handle plugin dependencies', () => {
      const dependencyPlugin: BarocssPlugin = {
        name: 'dependency-plugin',
        version: '1.0.0',
        description: 'Plugin with dependencies',
        dependencies: ['base-plugin'],
        handler: (ctx) => {
          // This plugin depends on base-plugin
          staticUtility('dependent-utility', [
            ['color', 'var(--base-color)']
          ]);
        }
      };

      const basePlugin: BarocssPlugin = {
        name: 'base-plugin',
        version: '1.0.0',
        description: 'Base plugin that provides foundation',
        handler: (ctx) => {
          // Set up CSS variables that dependent plugins can use
          staticUtility('base-color', [
            ['--base-color', '#333333']
          ]);
        }
      };

      const ctx = createContext({
        plugins: [basePlugin, dependencyPlugin]
      });

      // Test that both plugins work together
      const baseResult = parseClassToAst('base-color', ctx);
      expect(baseResult).toEqual([
        { type: 'decl', prop: '--base-color', value: '#333333', source: undefined }
      ]);

      const dependentResult = parseClassToAst('dependent-utility', ctx);
      expect(dependentResult).toEqual([
        { type: 'decl', prop: 'color', value: 'var(--base-color)', source: undefined }
      ]);
    });
  });

  describe('Plugin Error Handling', () => {
    it('should handle plugin errors gracefully', () => {
      const errorPlugin: BarocssPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        description: 'Plugin that throws an error',
        handler: () => {
          throw new Error('Plugin error for testing');
        }
      };

      const workingPlugin: BarocssPlugin = {
        name: 'working-plugin',
        version: '1.0.0',
        description: 'Plugin that works correctly',
        handler: (ctx) => {
          staticUtility('working-utility', [
            ['background-color', '#ffffff']
          ]);
        }
      };

      // Should not throw error, should continue with working plugin
      const ctx = createContext({
        plugins: [errorPlugin, workingPlugin]
      });

      // Test that working plugin still functions
      const result = parseClassToAst('working-utility', ctx);
      expect(result).toEqual([
        { type: 'decl', prop: 'background-color', value: '#ffffff', source: undefined }
      ]);
    });
  });

  describe('Complex Plugin Example', () => {
    it('should demonstrate a realistic plugin implementation', () => {
      // Create a comprehensive plugin that demonstrates real-world usage
      const comprehensivePlugin: BarocssPlugin = {
        name: 'comprehensive-example-plugin',
        version: '1.0.0',
        description: 'A comprehensive plugin example with utilities, variants, and theme extensions',
        handler: (ctx, config) => {
          // 1. Register custom utilities
          staticUtility('btn', [
            ['display', 'inline-block'],
            ['padding', '0.5rem 1rem'],
            ['border-radius', '0.25rem'],
            ['text-decoration', 'none'],
            ['cursor', 'pointer']
          ]);

          functionalUtility({
            name: 'btn',
            prop: 'background-color',
            supportsArbitrary: true,
            handleBareValue: ({ value }) => {
              return `var(--btn-color-${value})`;
            }
          });

          // 2. Register custom variants
          staticModifier('btn-hover', ['&:hover'], { source: 'button' });
          staticModifier('btn-active', ['&:active'], { source: 'button' });

          // 3. Extend theme with custom values
          const customTheme = {
            colors: {
              'btn-primary': '#007bff',
              'btn-secondary': '#6c757d',
              'btn-success': '#28a745'
            },
            spacing: {
              'btn-sm': '0.25rem 0.5rem',
              'btn-lg': '0.75rem 1.5rem'
            }
          };

          // Merge custom theme with existing theme
          // This would require theme merging functionality
        }
      };

      const ctx = createContext({
        plugins: [comprehensivePlugin]
      });

      // Test button utilities
      const btnResult = parseClassToAst('btn', ctx);
      expect(btnResult).toEqual([
        { type: 'decl', prop: 'display', value: 'inline-block', source: undefined },
        { type: 'decl', prop: 'padding', value: '0.5rem 1rem', source: undefined },
        { type: 'decl', prop: 'border-radius', value: '0.25rem', source: undefined },
        { type: 'decl', prop: 'text-decoration', value: 'none', source: undefined },
        { type: 'decl', prop: 'cursor', value: 'pointer', source: undefined }
      ]);

      // Test button with color
      const btnPrimaryResult = parseClassToAst('btn-primary', ctx);
      expect(btnPrimaryResult).toEqual([
        { type: 'decl', prop: 'background-color', value: 'var(--btn-color-primary)', source: undefined }
      ]);
    });
  });

  describe('Plugin Configuration', () => {
    it('should pass configuration to plugins', () => {
      let receivedConfig: any = null;

      const configurablePlugin: BarocssPlugin = {
        name: 'configurable-plugin',
        version: '1.0.0',
        description: 'Plugin that uses configuration',
        handler: (ctx, config) => {
          receivedConfig = config;
          
          // Use configuration to customize behavior
          if (config?.enableCustomUtilities) {
            staticUtility('custom-enabled', [
              ['background-color', config.customColor || '#000000']
            ]);
          }
        }
      };

      const pluginConfig = {
        enableCustomUtilities: true,
        customColor: '#ff6600'
      };

      const ctx = createContext({
        plugins: [configurablePlugin],
        pluginConfig // This would need to be passed to plugins
      });

      expect(receivedConfig).toEqual(pluginConfig);

      // Test that configuration affects plugin behavior
      const result = parseClassToAst('custom-enabled', ctx);
      expect(result).toEqual([
        { type: 'decl', prop: 'background-color', value: '#ff6600', source: undefined }
      ]);
    });
  });
}); 