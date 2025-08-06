import { describe, it, expect } from 'vitest';
import { createContext } from '../../src/core/context';
import { staticUtility } from '../../src/core/registry';
import { parseClassToAst } from '../../src/core/engine';
import '../../src/presets';

describe('Simple Plugin Test', () => {
  it('should register a simple utility', () => {
    // Register a simple utility
    staticUtility('test-bg-red', [
      ['background-color', '#ff0000']
    ]);

    // Create context
    const ctx = createContext({});

    // Test the utility
    const result = parseClassToAst('test-bg-red', ctx);
    console.log('Result:', result);
    
    expect(result).toEqual([
      { type: 'decl', prop: 'background-color', value: '#ff0000' }
    ]);
  });

  it('should work with plugin function', () => {
    const pluginFunction = (ctx: any) => {
      staticUtility('plugin-test', [
        ['color', '#00ff00']
      ]);
    };

    const ctx = createContext({
      plugins: [pluginFunction]
    });

    const result = parseClassToAst('plugin-test', ctx);
    console.log('Plugin result:', result);
    
    expect(result).toEqual([
      { type: 'decl', prop: 'color', value: '#00ff00' }
    ]);
  });
}); 