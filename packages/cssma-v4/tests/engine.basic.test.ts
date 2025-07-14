import { describe, it, expect } from 'vitest';
import { applyClassName } from '../src/core/engine';
import { createContext } from '../src/core/context';

describe('applyClassName', () => {
  it('should produce correct AST for sm:hover:bg-red-500', () => {
    const ctx = createContext({});
    const ast = applyClassName('sm:hover:bg-red-500', ctx);
    expect(ast).toEqual([
      {
        type: 'atrule',
        name: 'media',
        params: '(min-width: 640px)',
        nodes: [
          {
            type: 'rule',
            selector: ':hover',
            nodes: [
              { type: 'decl', prop: 'background-color', value: 'red-500' }
            ]
          }
        ]
      }
    ]);
  });

  it('applyClassName uses context theme for color', () => {
    const config = {
      theme: { colors: { red: { 500: '#f00' } } }
    };
    const ctx = createContext(config);
    const ast = applyClassName('bg-red-500', ctx);
    expect(ast).toEqual([
      { type: 'decl', prop: 'background-color', value: '#f00' }
    ]);
  });
}); 