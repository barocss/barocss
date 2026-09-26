import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { runParity } from './parity-compare';
import '../../src/presets';

// #310: Tailwind 4.3 zoom-*, tab-*, bare auto-rows/auto-cols-<n> and named shadow /<decimal> opacity,
// checked against tailwindcss 4.3.3 (effective-value parity).
//   pnpm --filter @barocss/kit exec vitest run tests/compat/misc-43-310.test.ts
const TOKENS = [
  'zoom-50', 'zoom-125', 'zoom-0', 'zoom-[1.5]', 'zoom-(--z)', 'hover:zoom-50', 'md:zoom-75',
  'tab-4', 'tab-0', 'tab-[8]', 'tab-(--t)', 'dark:tab-2',
  'auto-rows-12', 'auto-cols-4', 'auto-rows-2.5', 'auto-cols-0.5', 'hover:auto-rows-12',
  'auto-rows-auto', 'auto-rows-min', 'auto-rows-max', 'auto-rows-fr', 'auto-cols-auto', 'auto-cols-fr',
  'auto-cols-[minmax(0,2fr)]', 'auto-rows-(--r)',
  'shadow-lg/12.5', 'shadow-lg/50', 'shadow-2xs/5', 'shadow-sm/12.25', 'shadow-xl/7.5', 'shadow-2xl/40',
  'inset-shadow-sm/12.5', 'inset-shadow-2xs/7.5', 'inset-shadow-xs/50', 'hover:shadow-md/12.5',
  'shadow-lg', 'inset-shadow-sm',
];

// Candidates Tailwind 4.3.3 emits nothing for.
const REJECTED = [
  'zoom-2.5', 'zoom-normal', '-zoom-50', 'tab-2.5', 'tab-foo', 'auto-cols-px',
  'shadow-lg/x', 'inset-shadow-lg/50', 'shadow-none/50',
];

describe('#310 zoom, tab-size, bare auto-rows/cols, shadow /fraction match Tailwind 4.3.3', () => {
  it('passes effective-value parity', async () => {
    const results = await runParity(TOKENS.map((t) => [t, 1] as const));
    expect(results.filter((r) => !r.pass).map((r) => `${r.token}: ${r.diffs.join('; ')}`)).toEqual([]);
  });

  it.each(REJECTED)('%s emits nothing', (c) => {
    expect(generateCss(c, createContext({ preflight: false }))).toBe('');
  });

  it('keeps tabular-nums and cursor-zoom-in', () => {
    const ctx = createContext({ preflight: false });
    expect(generateCss('tabular-nums', ctx)).toContain('font-variant-numeric: tabular-nums');
    expect(generateCss('cursor-zoom-in', ctx)).toContain('cursor: zoom-in');
  });

  it('named shadow alpha uses oklab relative colour and the alpha var', () => {
    const css = generateCss('shadow-lg/12.5', createContext({ preflight: false }));
    expect(css).toContain('--baro-shadow-alpha: 12.5%');
    expect(css).toContain('var(--baro-shadow-color, oklab(from rgb(0 0 0 / 0.1) l a b / 12.5%))');
  });
});
