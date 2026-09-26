import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { invalidSelectors, tailwindBuilder } from './parity-compare';

// #335: low-severity fuzz findings. Selectors match Tailwind 4.3.3 compile() where it applies.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/low-severity-335.test.ts
const ctx = createContext({ preflight: false });
const selectors = (css: string) => {
  const out: string[] = [];
  postcss.parse(css).walkRules((r) => { out.push(r.selector.replace(/ \*::/g, ' ::').replace(/\s*~\s*/g, ' ~ ')); });
  return out.filter((s) => !s.startsWith(':root')).sort();
};

describe('unknown inner variants emit nothing (#335)', () => {
  it.each(['not-foo:flex', 'not-t:flex', 'group-foo:flex', 'peer-foo:flex', 'group-not-foo:flex',
    'peer-not-foo:flex', 'peer-has-foo:flex', 'not-placeholder:flex', 'group-before:flex', 'foo:flex'])('%s', (cls) => {
    expect(generateCss(cls, ctx)).toBe('');
  });
});

describe('known inner variants compound like Tailwind 4.3.3 (#335)', () => {
  const tw = tailwindBuilder();
  it.each(['not-first:flex', 'group-first:flex', 'peer-odd:flex', 'group-not-first:flex', 'not-disabled:flex',
    'group-open:flex', 'group-focus:flex', 'peer-checked:flex', 'not-focus-visible:flex',
    'placeholder:flex', 'selection:flex', 'file:flex', 'marker:flex'])('%s', async (cls) => {
    expect(selectors(generateCss(cls, ctx))).toEqual(selectors(await tw([cls])));
  });
});

describe('pseudo-element variants: no legacy vendor splits, each rule valid (#335)', () => {
  it.each(['placeholder:text-red-500', 'selection:bg-red-500', 'file:flex', 'marker:flex', 'focus:placeholder:divide-y'])('%s', (cls) => {
    const css = generateCss(cls, ctx);
    expect(css).not.toMatch(/-moz-(placeholder|selection|list)|-ms-input|-webkit-(input-placeholder|file-upload)/);
    expect(invalidSelectors(css)).toEqual([]);
  });
  it('@property descriptors appear once per block', () => {
    const css = generateCss('marker:divide-y focus:placeholder:divide-y divide-y', ctx);
    let blocks = 0;
    postcss.parse(css).walkAtRules('property', (a) => {
      blocks++;
      const props = (a.nodes ?? []).map((n) => (n as postcss.Declaration).prop);
      expect(props).toEqual([...new Set(props)]);
    });
    expect(blocks).toBeGreaterThan(0);
  });
});

describe('url( in a selector or at-rule prelude drops the rule (#335)', () => {
  it.each(['[&_url(x)]:flex', 'supports-[background:url(x)]:flex', '[&:is(URL(x))]:flex', '[@media_url(x)]:flex'])('%s', (cls) => {
    expect(generateCss(cls, ctx)).not.toMatch(/url\s*\(/i);
  });
  it('url() in a declaration value is kept', () => {
    expect(generateCss('bg-[url(x)]', ctx)).toContain('background-image: url(x)');
  });
});

describe('class lists split on ASCII whitespace only (#335)', () => {
  it('non-ASCII spaces are not separators', () => {
    expect(generateCss('p-4 m-2', ctx)).toBe('');
    expect(generateCss('p-4　', ctx)).toBe('');
    expect(generateCss(' flex', ctx)).toBe('');
  });
  it('ASCII whitespace still separates', () => {
    const css = generateCss('p-4\tm-2\nflex\f underline\r', ctx);
    for (const c of ['.p-4', '.m-2', '.flex', '.underline']) expect(css).toContain(c);
  });
});
