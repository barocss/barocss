import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #308: Tailwind 4.3 logical-property utilities, compared per candidate against a fresh Tailwind 4.3.3 compile.
const tailwindInput = `@theme { --spacing: 0.25rem; --spacing-gutter: 2.5rem; --color-red-500: oklch(63.7% 0.237 25.331); --container-sm: 24rem; --container-3xs: 16rem; }\n@tailwind utilities;`;
const ctx = () => createContext({ preflight: false, theme: { extend: { spacing: { gutter: '2.5rem' } } } });

// Every declaration as "prop: value", ignoring the theme-variable block, @property and the properties fallback layer.
function decls(css: string): string[] {
  const out: string[] = [];
  postcss.parse(css).walkDecls((d) => {
    const p = d.parent;
    if (p?.type === 'atrule') return;
    if (p?.type === 'rule' && (p as postcss.Rule).selector === ':root, :host') return;
    if (/^--(tw|baro)-/.test(d.prop)) return;
    let a: postcss.Node | undefined = p;
    while (a) {
      if (a.type === 'atrule' && ['property', 'supports', 'layer'].includes((a as postcss.AtRule).name)) return;
      a = a.parent as postcss.Node | undefined;
    }
    // Fractions: BaroCSS writes `calc(1/2 * 100%)` (inset: `50%`) where Tailwind writes `calc(1 / 2 * 100%)`; same value,
    // compared as a percentage like tests/compat/parity-compare.ts does.
    const value = d.value.replace(/calc\((-?\d+) ?\/ ?(\d+) \* 100%\)/g, (_, a, b) => `${+((a / b) * 100).toFixed(4)}%`)
      .replace(/calc\(([\d.]+%) \* -1\)/g, '-$1');
    out.push(`${d.prop}: ${value}`.replace(/--tw-/g, '--baro-'));
  });
  return out.sort();
}

const families: Record<string, string[]> = {
  inset: [
    'inset-s-4', 'inset-e-1/2', 'inset-bs-auto', 'inset-be-full', 'inset-s-px', '-inset-be-px', '-inset-s-4',
    '-inset-e-1/2', 'inset-bs-gutter', 'inset-e-[3px]', 'inset-bs-3.5', 'inset-be-(--x)',
  ],
  sizing: [
    'inline-4', 'inline-1/2', 'inline-full', 'inline-screen', 'inline-dvw', 'inline-min', 'inline-max', 'inline-fit',
    'inline-auto', 'inline-px', 'inline-0', 'inline-sm', 'inline-3xs', 'inline-gutter', 'inline-[5px]', 'inline-(--x)',
    'block-4', 'block-3/4', 'block-screen', 'block-dvh', 'block-lh', 'block-auto', 'block-fit', 'block-gutter', 'block-[5px]',
    'min-inline-4', 'min-inline-auto', 'min-inline-screen', 'min-inline-sm', 'max-inline-none', 'max-inline-sm',
    'max-inline-full', 'min-block-auto', 'min-block-lh', 'max-block-screen', 'max-block-none', 'max-block-1/2',
  ],
  padding: ['pbs-4', 'pbe-px', 'pbs-gutter', 'pbe-[3px]', 'pbs-2.5'],
  margin: ['mbs-4', 'mbs-auto', 'mbe-px', '-mbe-2', '-mbs-px', 'mbe-gutter', 'mbs-[3px]'],
  border: [
    'border-bs', 'border-be', 'border-bs-2', 'border-be-0', 'border-bs-[3px]', 'border-bs-red-500',
    'border-be-red-500/50', 'border-bs-(--x)',
  ],
  display: ['inline', 'block', 'inline-block', 'inline-flex', 'inline-grid', 'inline-table'],
};

describe('#308 logical properties (fresh Tailwind 4.3.3 compile per candidate)', () => {
  for (const [family, candidates] of Object.entries(families)) {
    it.each(candidates)(`${family}: %s matches Tailwind declarations`, async (candidate) => {
      const tailwind = (await compile(tailwindInput)).build([candidate]);
      const baro = generateCss(candidate, ctx());
      expect(decls(tailwind).length).toBeGreaterThan(0);
      expect(decls(baro)).toEqual(decls(tailwind));
    });
  }

  it.each(['inline-dvh', 'block-dvw', 'inline-lh', 'inline-none', 'block-none', '-inline-4', 'pbs-1/2', 'inset-s-nope', 'block-sm'])(
    '%s emits nothing, like Tailwind',
    async (candidate) => {
      expect((await compile(tailwindInput)).build([candidate])).not.toMatch(/\{[^}]*(size|inset|padding):/);
      expect(generateCss(candidate, ctx())).toBe('');
    },
  );

  it('display collisions stay display', () => {
    const c = ctx();
    expect(generateCss('inline', c)).toContain('display: inline;');
    expect(generateCss('block', c)).toContain('display: block;');
    expect(generateCss('inline-flex', c)).toContain('display: inline-flex;');
    expect(generateCss('inline-block', c)).not.toContain('inline-size');
  });

  it('variants apply', () => {
    const c = ctx();
    expect(generateCss('hover:border-bs-2', c)).toMatch(/:hover[\s\S]*border-block-start-width: 2px/);
    expect(generateCss('md:inline-1/2', c)).toMatch(/@media[\s\S]*inline-size: calc\(1\/2 \* 100%\)/);
    expect(generateCss('focus:-mbe-2', c)).toMatch(/:focus[\s\S]*margin-block-end: calc\(var\(--spacing\) \* -2\)/);
  });
});
