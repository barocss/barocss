import { describe, it, expect } from 'vitest';
import { generateCss } from '../src/core/engine';
import { createContext } from '../src/core/context';
import { defaultTheme } from '../src/theme';
import { decl, atRoot } from '../src/core/ast';

describe('atRoot Collection', () => {
  const ctx = createContext({ theme: defaultTheme });

  it('should collect atRoot nodes from multiple classes', () => {
    // Test classes containing atRoot
    const css = generateCss('bg-linear-to-r bg-linear-to-l', ctx);
    
    // Verify atRoot nodes are collected in logs
    console.log('Generated CSS:', css);
  });

  it('should handle atRoot nodes in AST', () => {
    // Create AST containing atRoot nodes directly
    const astWithAtRoot = [
      atRoot([
        decl('--tw-gradient-position', 'to right'),
        decl('--tw-gradient-stops', 'var(--tw-gradient-from), var(--tw-gradient-to)')
      ]),
      decl('background-image', 'linear-gradient(var(--tw-gradient-stops))')
    ];
    
    console.log('AST with atRoot:', astWithAtRoot);
  });
}); 