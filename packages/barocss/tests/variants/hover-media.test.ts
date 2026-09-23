import { describe, expect, it } from 'vitest';
import '../../src/presets';
import { atRule, decl } from '../../src/core/ast';
import { createContext } from '../../src/core/context';
import { generateCss, generateCssRules, parseClassToAst } from '../../src/core/engine';
import { generateCssFromJson } from '../../src/core/jsonToAst';
import { functionalModifier } from '../../src/core/registry';

describe('modifier selector and media wrappers', () => {
  it('places hover:block inside the hover media query', () => {
    const ctx = createContext({});
    const css = generateCss('hover:block', ctx);
    expect(css).toContain('@media (hover: hover)');
    expect(css).toContain('.hover\\:block:hover');
    expect(css).toContain('display: block');
    expect(generateCssRules('hover:block', ctx)[0].css).toContain('@media (hover: hover)');
    expect(generateCssFromJson([{ utility: { name: 'block' }, variants: ['hover'] }], ctx))
      .toContain('@media (hover: hover)');
  });

  it('applies selector and at-rule from one modifier', () => {
    const ctx = createContext({});
    functionalModifier(
      (name) => name === 'combined-test',
      () => '&:focus',
      () => [atRule('media', '(min-width: 1px)', [])],
      {},
      ctx,
    );

    expect(parseClassToAst('combined-test:block', ctx)).toMatchObject([
      {
        type: 'at-rule',
        name: 'media',
        params: '(min-width: 1px)',
        nodes: [{ type: 'rule', selector: '&:focus', nodes: [{ type: 'decl', prop: 'display', value: 'block' }] }],
      },
    ]);
  });

  it('preserves children already present in a wrap item', () => {
    const ctx = createContext({});
    functionalModifier(
      (name) => name === 'existing-child-test',
      undefined,
      () => [atRule('media', '(min-width: 1px)', [decl('color', 'red')])],
      {},
      ctx,
    );

    expect(parseClassToAst('existing-child-test:block', ctx)).toMatchObject([
      {
        type: 'at-rule',
        nodes: [
          { type: 'decl', prop: 'color', value: 'red' },
          { type: 'decl', prop: 'display', value: 'block' },
        ],
      },
    ]);
  });
});
