import { describe, expect, it } from 'vitest';
import '../src/presets';
import { createContext, type Context } from '../src/core/context';
import { getVarName } from '../src/core/cssVars';
import { clearAstCache, generateCss, getAstCacheStats, parseClassToAst } from '../src/core/engine';
import { functionalModifier, registerUtility } from '../src/core/registry';
import { decl } from '../src/core/ast';
import { clearAllCaches } from '../src/utils/cache';

describe('context isolation', () => {
  it('keeps theme output when another context uses the same class', () => {
    const first = createContext({ theme: { colors: { brand: '#123456' } }, clearCacheOnContextChange: false });
    const second = createContext({ theme: { colors: { brand: '#abcdef' } }, clearCacheOnContextChange: false });

    expect(generateCss('bg-brand', first)).toContain('#123456');
    expect(generateCss('bg-brand', second)).toContain('#abcdef');
    expect(generateCss('bg-brand', first)).toContain('#123456');
  });

  it('does not carry a failed lookup into another context', () => {
    const first = createContext({});
    expect(parseClassToAst('isolation-later-utility', first)).toEqual([]);

    registerUtility({
      name: 'isolation-later-utility',
      match: (name) => name === 'isolation-later-utility',
      handler: () => [decl('display', 'grid')],
    });
    const second = createContext({});
    expect(generateCss('isolation-later-utility', second)).toContain('display: grid');
  });

  it('keeps registrations local to a context', () => {
    const first = createContext({});
    const second = createContext({});
    expect(parseClassToAst('isolation-local-utility', first)).toEqual([]);
    registerUtility({
      name: 'isolation-local-utility',
      match: (name) => name === 'isolation-local-utility',
      handler: () => [decl('display', 'flex')],
    }, first);

    expect(generateCss('isolation-local-utility', first)).toContain('display: flex');
    expect(parseClassToAst('isolation-local-utility', second)).toEqual([]);
  });

  it('does not clear an existing context cache when creating another context', () => {
    const first = createContext({});
    const cached = parseClassToAst('flex', first);

    createContext({});
    expect(parseClassToAst('flex', first)).toBe(cached);
  });

  it('clears context caches when all caches are cleared', () => {
    const ctx = createContext({});
    const cached = parseClassToAst('flex', ctx);

    clearAllCaches();
    expect(parseClassToAst('flex', ctx)).not.toBe(cached);
  });

  it('reports and clears the requested context cache', () => {
    const first = createContext({});
    const second = createContext({});
    parseClassToAst('flex', first);
    parseClassToAst('grid', second);
    expect(getAstCacheStats(first).size).toBe(1);
    expect(getAstCacheStats(second).size).toBe(1);

    clearAstCache(first);
    expect(getAstCacheStats(first).size).toBe(0);
    expect(getAstCacheStats(second).size).toBe(1);
  });

  it('refreshes generated CSS after extending a theme', () => {
    const ctx = createContext({ theme: { colors: { brand: '#123456' } } });
    expect(generateCss('bg-brand', ctx)).toContain('#123456');

    ctx.extendTheme('colors', { brand: '#abcdef' });
    expect(generateCss('bg-brand', ctx)).toContain('#abcdef');
  });

  it('keeps modifiers local to a context', () => {
    const first = createContext({});
    const second = createContext({});
    functionalModifier(
      (name) => name === 'isolation-variant',
      () => '&:where(.isolated)',
      undefined,
      {},
      first,
    );

    expect(generateCss('isolation-variant:flex', first)).toContain(':where(.isolated)');
    expect(generateCss('isolation-variant:flex', second)).not.toContain(':where(.isolated)');
  });

  it('uses each context CSS variable prefix', () => {
    const first = createContext({ cssVarPrefix: 'first' });
    const second = createContext({ cssVarPrefix: 'second' });

    expect(getVarName('color-brand', first)).toBe('--first-color-brand');
    expect(getVarName('color-brand', second)).toBe('--second-color-brand');
    expect(getVarName('color-brand', first)).toBe('--first-color-brand');
  });

  it('resolves a theme path across contexts during nested lookup', () => {
    let second!: Context;
    const first = createContext({
      theme: { spacing: () => ({ 1: second.theme('spacing.1') }) },
    });
    second = createContext({ theme: { spacing: { 1: '2rem' } } });

    expect(first.theme('spacing.1')).toBe('2rem');
  });
});
