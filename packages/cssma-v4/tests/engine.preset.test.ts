import { describe, it, expect } from 'vitest';
import { applyClassName } from '../src/core/engine';
import { createContext } from '../src/core/context';
import { registerUtility, utilityRegistry } from '../src/core/registry';

describe('preset utilities', () => {
  it('p-4 resolves to theme spacing', () => {
    const config = { theme: { spacing: { 4: '1rem' } } };
    const ctx = createContext(config);
    const ast = applyClassName('p-4', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'padding', value: '1rem' }]);
  });

  it('rounded-lg resolves to theme borderRadius', () => {
    const config = { theme: { borderRadius: { lg: '0.5rem' } } };
    const ctx = createContext(config);
    const ast = applyClassName('rounded-lg', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'border-radius', value: '0.5rem' }]);
  });

  it('p-[2.5rem] resolves to arbitrary value', () => {
    const ctx = createContext({});
    const ast = applyClassName('p-[2.5rem]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'padding', value: '2.5rem' }]);
  });

  it('-m-4 resolves to negative theme value', () => {
    const config = { theme: { spacing: { 4: '1rem' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-m-4', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'margin', value: '-1rem' }]);
  });

  it('bg-[color:var(--my-color)] resolves to arbitrary background', () => {
    const ctx = createContext({});
    const ast = applyClassName('bg-[color:var(--my-color)]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'background-color', value: 'color:var(--my-color)' }]);
  });

  it('supports plugin/extension: dynamic utility registration and removal', () => {
    // Register a new utility
    const util = {
      name: 'foo',
      match: (className) => className === 'foo-bar',
      handler: (value, ctx, token) => [{ type: 'decl', prop: 'content', value: 'bar' }],
      description: 'foo plugin',
      category: 'plugin',
    };
    registerUtility(util);
    const ctx = createContext({});
    const ast = applyClassName('foo-bar', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'content', value: 'bar' }]);
    // Remove the utility
    const idx = utilityRegistry.indexOf(util);
    if (idx !== -1) utilityRegistry.splice(idx, 1);
    const ast2 = applyClassName('foo-bar', ctx);
    expect(ast2).toEqual([]);
  });

  it('w-1/2 resolves to theme width', () => {
    const config = { theme: { width: { '1/2': '50%' } } };
    const ctx = createContext(config);
    const ast = applyClassName('w-1/2', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'width', value: '50%' }]);
  });

  it('h-10 resolves to theme height', () => {
    const config = { theme: { height: { '10': '2.5rem' } } };
    const ctx = createContext(config);
    const ast = applyClassName('h-10', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'height', value: '2.5rem' }]);
  });

  it('w-[33vw] resolves to arbitrary width', () => {
    const ctx = createContext({});
    const ast = applyClassName('w-[33vw]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'width', value: '33vw' }]);
  });

  it('-h-10 resolves to negative theme height', () => {
    const config = { theme: { height: { '10': '2.5rem' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-h-10', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'height', value: '-2.5rem' }]);
  });

  it('opacity-50 resolves to theme opacity', () => {
    const config = { theme: { opacity: { '50': '0.5' } } };
    const ctx = createContext(config);
    const ast = applyClassName('opacity-50', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'opacity', value: '0.5' }]);
  });

  it('opacity-[0.33] resolves to arbitrary opacity', () => {
    const ctx = createContext({});
    const ast = applyClassName('opacity-[0.33]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'opacity', value: '0.33' }]);
  });

  it('-opacity-10 resolves to negative theme opacity', () => {
    const config = { theme: { opacity: { '10': '0.1' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-opacity-10', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'opacity', value: '-0.1' }]);
  });

  it('border-2 resolves to theme borderWidth', () => {
    const config = { theme: { borderWidth: { '2': '2px' } } };
    const ctx = createContext(config);
    const ast = applyClassName('border-2', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'border', value: '2px' }]);
  });

  it('border-[3px] resolves to arbitrary border', () => {
    const ctx = createContext({});
    const ast = applyClassName('border-[3px]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'border', value: '3px' }]);
  });

  it('-border-4 resolves to negative theme borderWidth', () => {
    const config = { theme: { borderWidth: { '4': '4px' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-border-4', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'border', value: '-4px' }]);
  });

  it('font-sans resolves to theme fontFamily', () => {
    const config = { theme: { fontFamily: { sans: 'ui-sans-serif' } } };
    const ctx = createContext(config);
    const ast = applyClassName('font-sans', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'font-family', value: 'ui-sans-serif' }]);
  });

  it('font-[Inter] resolves to arbitrary font', () => {
    const ctx = createContext({});
    const ast = applyClassName('font-[Inter]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'font-family', value: 'Inter' }]);
  });

  it('-font-serif resolves to negative theme fontFamily', () => {
    const config = { theme: { fontFamily: { serif: 'serif' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-font-serif', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'font-family', value: '-serif' }]);
  });

  it('flex-1 resolves to theme flex', () => {
    const config = { theme: { flex: { '1': '1 1 0%' } } };
    const ctx = createContext(config);
    const ast = applyClassName('flex-1', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'flex', value: '1 1 0%' }]);
  });

  it('flex-[2_2_0%] resolves to arbitrary flex', () => {
    const ctx = createContext({});
    const ast = applyClassName('flex-[2_2_0%]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'flex', value: '2_2_0%' }]);
  });

  it('-flex-auto resolves to negative theme flex', () => {
    const config = { theme: { flex: { auto: '1 1 auto' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-flex-auto', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'flex', value: '-1 1 auto' }]);
  });

  it('z-10 resolves to theme zIndex', () => {
    const config = { theme: { zIndex: { '10': '10' } } };
    const ctx = createContext(config);
    const ast = applyClassName('z-10', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'z-index', value: '10' }]);
  });

  it('z-[999] resolves to arbitrary z-index', () => {
    const ctx = createContext({});
    const ast = applyClassName('z-[999]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'z-index', value: '999' }]);
  });

  it('-z-20 resolves to negative theme zIndex', () => {
    const config = { theme: { zIndex: { '20': '20' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-z-20', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'z-index', value: '-20' }]);
  });

  it('gap-4 resolves to theme gap', () => {
    const config = { theme: { gap: { '4': '1rem' } } };
    const ctx = createContext(config);
    const ast = applyClassName('gap-4', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'gap', value: '1rem' }]);
  });

  it('gap-[2em] resolves to arbitrary gap', () => {
    const ctx = createContext({});
    const ast = applyClassName('gap-[2em]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'gap', value: '2em' }]);
  });

  it('-gap-8 resolves to negative theme gap', () => {
    const config = { theme: { gap: { '8': '2rem' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-gap-8', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'gap', value: '-2rem' }]);
  });

  it('shadow-lg resolves to theme boxShadow', () => {
    const config = { theme: { boxShadow: { lg: '0 10px 15px -3px #000' } } };
    const ctx = createContext(config);
    const ast = applyClassName('shadow-lg', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'box-shadow', value: '0 10px 15px -3px #000' }]);
  });

  it('shadow-[0_2px_8px] resolves to arbitrary box-shadow', () => {
    const ctx = createContext({});
    const ast = applyClassName('shadow-[0_2px_8px]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'box-shadow', value: '0_2px_8px' }]);
  });

  it('-shadow-md resolves to negative theme boxShadow', () => {
    const config = { theme: { boxShadow: { md: '0 4px 6px -1px #000' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-shadow-md', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'box-shadow', value: '-0 4px 6px -1px #000' }]);
  });

  it('overflow-auto resolves to theme overflow', () => {
    const config = { theme: { overflow: { auto: 'auto' } } };
    const ctx = createContext(config);
    const ast = applyClassName('overflow-auto', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'overflow', value: 'auto' }]);
  });

  it('overflow-[clip] resolves to arbitrary overflow', () => {
    const ctx = createContext({});
    const ast = applyClassName('overflow-[clip]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'overflow', value: 'clip' }]);
  });

  it('-overflow-hidden resolves to negative theme overflow', () => {
    const config = { theme: { overflow: { hidden: 'hidden' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-overflow-hidden', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'overflow', value: '-hidden' }]);
  });

  it('grid-cols-3 resolves to theme gridTemplateColumns', () => {
    const config = { theme: { gridTemplateColumns: { 'cols-3': 'repeat(3, minmax(0, 1fr))' } } };
    const ctx = createContext(config);
    const ast = applyClassName('grid-cols-3', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'grid-template-columns', value: 'repeat(3, minmax(0, 1fr))' }]);
  });

  it('grid-[repeat(2,1fr)] resolves to arbitrary grid-template-columns', () => {
    const ctx = createContext({});
    const ast = applyClassName('grid-[repeat(2,1fr)]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'grid-template-columns', value: 'repeat(2,1fr)' }]);
  });

  it('-grid-cols-4 resolves to negative theme gridTemplateColumns', () => {
    const config = { theme: { gridTemplateColumns: { 'cols-4': 'repeat(4, minmax(0, 1fr))' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-grid-cols-4', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'grid-template-columns', value: '-repeat(4, minmax(0, 1fr))' }]);
  });

  it('min-w-0 resolves to theme minWidth', () => {
    const config = { theme: { minWidth: { '0': '0px' } } };
    const ctx = createContext(config);
    const ast = applyClassName('min-w-0', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'min-width', value: '0px' }]);
  });

  it('min-w-[10vw] resolves to arbitrary min-width', () => {
    const ctx = createContext({});
    const ast = applyClassName('min-w-[10vw]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'min-width', value: '10vw' }]);
  });

  it('-min-w-full resolves to negative theme minWidth', () => {
    const config = { theme: { minWidth: { full: '100%' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-min-w-full', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'min-width', value: '-100%' }]);
  });

  it('max-w-xs resolves to theme maxWidth', () => {
    const config = { theme: { maxWidth: { xs: '20rem' } } };
    const ctx = createContext(config);
    const ast = applyClassName('max-w-xs', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'max-width', value: '20rem' }]);
  });

  it('max-w-[80vw] resolves to arbitrary max-width', () => {
    const ctx = createContext({});
    const ast = applyClassName('max-w-[80vw]', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'max-width', value: '80vw' }]);
  });

  it('-max-w-lg resolves to negative theme maxWidth', () => {
    const config = { theme: { maxWidth: { lg: '32rem' } } };
    const ctx = createContext(config);
    const ast = applyClassName('-max-w-lg', ctx);
    expect(ast).toEqual([{ type: 'decl', prop: 'max-width', value: '-32rem' }]);
  });
}); 