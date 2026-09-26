import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #300: a NEW key in a theme namespace creates its utility, as in Tailwind 4 (`--radius-card` → `rounded-card`).
// Compared per candidate against a fresh Tailwind 4.3.3 compile of the matching @theme.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/theme-keys-300.test.ts
const theme = {
  extend: {
    borderRadius: { card: '1.25rem' },
    fontFamily: { display: ['Inter', 'sans-serif'] },
    fontWeight: { heavy: '850' },
    boxShadow: { card: '0 2px 4px rgb(0 0 0 / 0.2)' },
    insetShadow: { card: 'inset 0 1px 2px rgb(0 0 0 / 0.1)' },
    dropShadow: { card: '0 2px 2px rgb(0 0 0 / 0.3)' },
    textShadow: { card: '0 1px 1px rgb(0 0 0 / 0.3)' },
    fontSize: { hero: ['4rem', { lineHeight: '1.1' }], lead: '1.375rem' },
    blur: { huge: '100px' },
    transitionTimingFunction: { snappy: 'cubic-bezier(0.2, 0, 0, 1)' },
    animations: { wiggle: 'wiggle 1s ease-in-out infinite' },
    aspect: { poster: '2 / 3' },
    container: { prose2: '70ch' },
    lineHeight: { cozy: '1.4' },
    letterSpacing: { airy: '0.2em' },
    breakpoints: { tablet: '900px' },
  },
};
const tailwindInput = `@theme {
  --radius-card: 1.25rem; --font-display: Inter, sans-serif; --font-weight-heavy: 850;
  --shadow-card: 0 2px 4px rgb(0 0 0 / 0.2); --inset-shadow-card: inset 0 1px 2px rgb(0 0 0 / 0.1);
  --drop-shadow-card: 0 2px 2px rgb(0 0 0 / 0.3); --text-shadow-card: 0 1px 1px rgb(0 0 0 / 0.3);
  --text-hero: 4rem; --text-hero--line-height: 1.1; --text-lead: 1.375rem; --blur-huge: 100px;
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1); --animate-wiggle: wiggle 1s ease-in-out infinite;
  --aspect-poster: 2 / 3; --container-prose2: 70ch; --leading-cozy: 1.4; --tracking-airy: 0.2em;
  --breakpoint-tablet: 900px; --color-red-500: oklch(63.7% 0.237 25.331);
}\n@tailwind utilities;`;
const ctx = () => createContext({ preflight: false, theme } as never);

// Every declaration as "[@media params] prop: value", ignoring theme vars, @property, @supports and layers.
function decls(css: string): string[] {
  const out: string[] = [];
  postcss.parse(css).walkDecls((d) => {
    const p = d.parent;
    if (p?.type === 'rule' && (p as postcss.Rule).selector === ':root, :host') return;
    let media = '';
    let a: postcss.Node | undefined = p;
    while (a) {
      if (a.type === 'atrule') {
        const at = a as postcss.AtRule;
        if (['property', 'supports', 'layer'].includes(at.name)) return;
        if (at.name === 'media') media = `@media ${at.params} `;
      }
      a = a.parent as postcss.Node | undefined;
    }
    out.push(`${media}${d.prop}: ${d.value}`.replace(/--tw-/g, '--baro-').replace(/,\s+\)/g, ',)'));
  });
  return out.sort();
}

// Same declarations as Tailwind 4.3.3.
const exact: Record<string, string[]> = {
  radius: ['rounded-card', 'rounded-t-card', 'rounded-r-card', 'rounded-b-card', 'rounded-l-card', 'rounded-tl-card', 'rounded-tr-card', 'rounded-br-card', 'rounded-bl-card'],
  'font-family': ['font-display'],
  shadow: ['shadow-card', 'shadow-card/50', 'inset-shadow-card', 'inset-shadow-card/25'],
  'drop/text-shadow': ['drop-shadow-card', 'text-shadow-card', 'text-shadow-card/50'],
  'font-size': ['text-hero', 'text-lead'],
  blur: ['blur-huge'],
  aspect: ['aspect-poster'],
  container: ['max-w-prose2'],
  animate: ['animate-wiggle'],
  breakpoints: ['max-tablet:flex'],
};

// BaroCSS keeps the form of its built-in keys in these namespaces (no --baro-font-weight/--baro-ease/--baro-tracking,
// --letter-spacing-* and var(--leading-*, fallback)); the value still comes from the theme key.
const own: [string, string[]][] = [
  ['font-heavy', ['font-weight: var(--font-weight-heavy)']],
  ['ease-snappy', ['transition-timing-function: var(--ease-snappy)']],
  ['tracking-airy', ['letter-spacing: var(--letter-spacing-airy)']],
  ['leading-cozy', ['--baro-leading: var(--leading-cozy, 1.4)', 'line-height: var(--leading-cozy, 1.4)']],
  ['columns-prose2', ['columns: var(--container-prose2)']],
  ['max-inline-prose2', ['max-inline-size: var(--container-prose2)']],
  ['backdrop-blur-huge', ['--baro-backdrop-blur: blur(var(--blur-huge))']], // built-ins order the two filter decls differently
  ['tablet:flex', ['@media (min-width: 900px) display: flex']], // built-in breakpoints use the min-width form too
  ['@prose2:flex', []],
];

describe('#300 new theme keys create utilities (Tailwind 4.3.3)', () => {
  for (const [family, candidates] of Object.entries(exact)) {
    it.each(candidates)(`${family}: %s matches Tailwind declarations`, async (candidate) => {
      const tailwind = (await compile(tailwindInput)).build([candidate]);
      const baro = generateCss(candidate, ctx());
      expect(baro).not.toBe('');
      expect(decls(baro)).toEqual(decls(tailwind));
    });
  }

  it.each(own)('%s resolves the new key in the built-in form', (candidate, expected) => {
    const baro = generateCss(candidate, ctx());
    expect(baro).not.toBe('');
    for (const d of expected) expect(decls(baro)).toContain(d);
  });

  it('keeps the built-in keys unchanged', () => {
    const c = ctx();
    expect(decls(generateCss('rounded-lg', c))).toEqual(['border-radius: var(--radius-lg)']);
    expect(decls(generateCss('font-sans', c))).toEqual(['font-family: var(--font-sans)']);
    expect(decls(generateCss('font-bold', c))).toEqual(['font-weight: var(--font-weight-bold)']);
    expect(decls(generateCss('text-xs', c))).toContain('font-size: var(--text-xs)');
    expect(decls(generateCss('text-red-500', c))).toEqual(['color: var(--color-red-500)']);
    expect(decls(generateCss('leading-7', c))).toContain('line-height: 1.75rem');
    expect(decls(generateCss('rounded-4', c))).toEqual(['border-radius: calc(var(--spacing) * 4)']);
  });

  const unknown = [
    'rounded-nope', 'rounded-t-nope', 'font-nope', 'shadow-nope', 'inset-shadow-nope', 'text-nope', 'blur-nope',
    'backdrop-blur-nope', 'ease-nope', 'aspect-nope', 'max-w-nope', 'columns-nope', 'leading-nope', 'tracking-nope',
    'animate-nope', 'drop-shadow-nope', 'text-shadow-nope', 'rounded-DEFAULT', 'shadow-DEFAULT', 'text-hero/50', 'shadow-none/50',
  ];
  it.each(unknown)('unknown key %s emits nothing, like Tailwind', async (candidate) => {
    expect(generateCss(candidate, ctx())).toBe('');
    expect((await compile(tailwindInput)).build([candidate])).not.toMatch(new RegExp(`\\.${candidate.replace(/[/]/g, '\\\\/')}\\s*\\{`));
  });

  it('defines a :root var for every new key it references', () => {
    const root = ctx().themeToCssVars();
    for (const name of ['--radius-card', '--font-display', '--font-weight-heavy', '--text-hero', '--blur-huge', '--ease-snappy', '--aspect-poster', '--container-prose2', '--letter-spacing-airy'])
      expect(root, name).toMatch(new RegExp(`${name}:\\s*[^;]+;`));
    expect(root).toMatch(/--text-hero--line-height:\s*1\.1;/);
  });

  // Collisions with built-in names follow Tailwind 4.3.3: --font-<key> beats --font-weight-<key>, and an own
  // --radius-full replaces rounded-full's literal.
  it.each(['font-bold', 'rounded-full', 'rounded-t-full'])('collision %s matches Tailwind', async (candidate) => {
    const input = `@theme { --font-bold: Fancy, serif; --font-weight-bold: 700; --radius-full: 2rem; }\n@tailwind utilities;`;
    const tailwind = (await compile(input)).build([candidate]);
    const c = createContext({ preflight: false, theme: { extend: { fontFamily: { bold: ['Fancy', 'serif'] }, borderRadius: { full: '2rem' } } } } as never);
    expect(decls(generateCss(candidate, c))).toEqual(decls(tailwind));
  });

  it('keeps font-bold a weight and rounded-full 9999px without those keys', () => {
    expect(decls(generateCss('font-bold', ctx()))).toEqual(['font-weight: var(--font-weight-bold)']);
    expect(decls(generateCss('rounded-full', ctx()))).toEqual(['border-radius: 9999px']);
  });
});
