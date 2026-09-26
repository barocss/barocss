import { describe, expect, it } from 'vitest';
import '../../src/presets';
import { createContext } from '../../src/core/context';
import { generateCss, parseClassToAst } from '../../src/core/engine';

// #191: before:/after: create the pseudo-element, as Tailwind does.
describe('before:/after: content default', () => {
  it('adds content: var(--baro-content) and registers --baro-content', () => {
    const ctx = createContext({});
    for (const v of ['before', 'after']) {
      const ast = parseClassToAst(`${v}:absolute`, ctx);
      expect(ast[0]).toMatchObject({
        type: 'at-root',
        nodes: [{ type: 'at-rule', name: 'property', params: '--baro-content' }],
      });
      expect(ast[1]).toMatchObject({
        type: 'rule',
        selector: `&::${v}`,
        nodes: [
          { type: 'decl', prop: 'position', value: 'absolute' },
          { type: 'decl', prop: 'content', value: 'var(--baro-content)' },
        ],
      });
      const css = generateCss(`${v}:absolute`, ctx);
      expect(css).toContain('@property --baro-content');
      expect(css).toContain('initial-value: ""');
    }
  });

  it('lets content-none and content-[…] win', () => {
    const ctx = createContext({});
    for (const cls of ['before:content-none', 'after:content-none']) {
      const decls = (parseClassToAst(cls, ctx)[1] as any).nodes;
      expect(decls.find((d: any) => d.prop === '--baro-content').value).toBe('none');
      expect(decls.at(-1)).toMatchObject({ prop: 'content', value: 'none' }); // #325: utility wins, like Tailwind
    }
    const arb = (parseClassToAst("after:content-['x']", ctx)[1] as any).nodes;
    expect(arb[0].prop).toBe('--baro-content');
    // Either class order: content-none sets --baro-content, so the default resolves to it.
    for (const list of ['before:absolute before:content-none', 'before:content-none before:absolute']) {
      expect(generateCss(list, ctx)).toContain('--baro-content: none');
    }
  });
});
