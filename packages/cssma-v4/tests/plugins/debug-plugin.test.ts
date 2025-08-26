import { describe, it, expect } from 'vitest';
import { createContext } from '../../src/core/context';
import { staticUtility } from '../../src/core/registry';
import { parseClassToAst } from '../../src/core/engine';
import '../../src/presets';

describe('Plugin Debug Test', () => {
  it('should debug utility registration', () => {
    // 1. Direct registration
    staticUtility('debug-bg-red', [
      ['background-color', '#ff0000']
    ]);

    // 2. Create context
    const ctx = createContext({});

    // 3. Assertions
    const result = parseClassToAst('debug-bg-red', ctx);
    console.log('Direct registration result:', result);
    
    expect(result).toEqual([
      { type: 'decl', prop: 'background-color', value: '#ff0000', source: undefined }
    ]);
  });

  it('should debug plugin utility registration', () => {
    // 1. Plugin function
    const pluginFunction = (ctx: any) => {
      console.log('Plugin function executed');
      staticUtility('plugin-debug-bg-red', [
        ['background-color', '#ff0000']
      ]);
    };

    // 2. Create context
    const ctx = createContext({
      plugins: [pluginFunction]
    });

    // 3. Assertions
    const result = parseClassToAst('plugin-debug-bg-red', ctx);
    console.log('Plugin registration result:', result);
    
    expect(result).toEqual([
      { type: 'decl', prop: 'background-color', value: '#ff0000', source: undefined }
    ]);
  });

  it('should debug theme extension', () => {
    // 1. Plugin with theme extension
    const themePlugin = {
      name: 'debug-theme-plugin',
      handler: (ctx: any) => {
        console.log('Theme plugin executed');
        // Theme extension would be handled by the plugin system
      },
      theme: (ctx: any) => ({
        colors: {
          'debug-blue': '#0066cc'
        }
      })
    };

    // 2. Create context
    const ctx = createContext({
      plugins: [themePlugin]
    });

    // 3. Assertions
    console.log('Theme lookup result:', ctx.theme('colors', 'debug-blue'));
    
    // This should work if theme extension is working
    expect(ctx.theme('colors', 'debug-blue')).toBe('#0066cc');
  });

  it('should debug configuration passing', () => {
    let receivedConfig: any = null;

    const configPlugin = {
      name: 'debug-config-plugin',
      handler: (ctx: any, config: any) => {
        console.log('Config plugin executed with config:', config);
        receivedConfig = config;
      }
    };

    const testConfig = {
      enableFeature: true,
      customValue: 'test'
    };

    const ctx = createContext({
      plugins: [configPlugin],
      pluginConfig: testConfig
    });

    console.log('Received config:', receivedConfig);
    expect(receivedConfig).toEqual(testConfig);
  });
}); 