import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #344: three border-family details against a fresh Tailwind 4.3.3 compile.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/border-family-344.test.ts
// 1. divide-x/y-<colour> emits nothing; divide-x/y-[...] and -(--var) are widths.
// 2. border-x/y are border-inline/border-block (width and colour), so they follow the writing direction (RTL).
// 3. a borderWidth theme key reads var(--border-width-<key>), declared on :root.
const theme = { extend: { borderWidth: { thick: '3px' }, colors: { hue: '#00ff00' } } };
const tailwindInput = `@theme { --border-width-thick: 3px; --color-hue: #00ff00; --color-red-500: oklch(63.7% 0.237 25.331); }\n@tailwind utilities;`;
const ctx = () => createContext({ preflight: false, theme } as never);

// Utility declarations (prop: value), ignoring :root, @property and @layer fallbacks; --tw- is BaroCSS's --baro-.
function decls(css: string): string[] {
  const out: string[] = [];
  postcss.parse(css).walkDecls((d) => {
    const p = d.parent;
    if (p?.type === 'rule' && (p as postcss.Rule).selector === ':root, :host') return;
    for (let a: postcss.Node | undefined = p; a; a = a.parent as postcss.Node | undefined)
      if (a.type === 'atrule' && ['property', 'layer'].includes((a as postcss.AtRule).name)) return;
    out.push(`${d.prop}: ${d.value}`.replace(/--tw-/g, '--baro-').toLowerCase());
  });
  return out.sort();
}

const same = async (candidate: string) => {
  const tailwind = (await compile(tailwindInput)).build([candidate]);
  expect(decls(generateCss(candidate, ctx())), candidate).toEqual(decls(tailwind));
};

describe('#344 border family matches Tailwind 4.3.3', () => {
  it.each([
    'divide-x-red-500', 'divide-y-red-500', 'divide-x-red-500/50', 'divide-x-hue', 'divide-x-current',
    'divide-y-inherit', 'divide-x-transparent',
  ])('%s emits nothing', async (candidate) => {
    expect((await compile(tailwindInput)).build([candidate])).not.toContain('.divide');
    expect(generateCss(candidate, ctx())).toBe('');
  });

  it.each([
    'divide-x-[#f00]', 'divide-x-(--c)', 'divide-y-(length:--w)', 'divide-x-thick', 'divide-y-2', 'divide-red-500',
    'divide-(--c)',
  ])('%s matches (width / plain divide colour)', same);

  it.each([
    'border-x', 'border-y', 'border-x-0', 'border-x-2', 'border-y-4', 'border-y-8', 'border-x-3', 'border-t-3', 'border-s-3', 'border-x-[3px]',
    'border-x-(length:--w)', 'border-x-red-500', 'border-y-red-500', 'border-x-hue', 'border-x-[#f00]',
    'border-x-(--c)', 'border-y-current', 'border-x-thick', 'border-y-thick',
  ])('%s matches', same);

  it.each(['border-thick', 'border-t-thick', 'border-s-thick', 'border-bs-thick'])('%s reads the width var', async (c) => {
    await same(c);
    expect(generateCss(c, ctx())).toContain('var(--border-width-thick)');
  });

  it('RTL: border-x maps to the inline axis, never to physical left/right', () => {
    const css = generateCss('border-x-2 border-x-red-500 border-y-2', ctx());
    expect(css).toMatch(/border-inline-width:\s*2px/);
    expect(css).toMatch(/border-inline-color:/);
    expect(css).toMatch(/border-block-width:\s*2px/);
    expect(css).not.toMatch(/border-(left|right|top|bottom)-/);
  });

  it('declares --border-width-<key> on :root, as Tailwind does', async () => {
    const root = ctx().themeToCssVars();
    const tailwind = (await compile(tailwindInput)).build(['border-thick']);
    expect(tailwind).toMatch(/:root, :host \{[^}]*--border-width-thick: 3px/);
    expect(root).toMatch(/--border-width-thick:\s*3px/);
  });
});
