import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { runParity } from './parity-compare';
import '../../src/presets';

// #309: Tailwind 4.3 scrollbar-* and font-features-* utilities, checked against tailwindcss 4.3.3.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/scrollbar-fontfeatures-309.test.ts
const TOKENS = [
  'scrollbar-auto', 'scrollbar-thin', 'scrollbar-none',
  'scrollbar-gutter-auto', 'scrollbar-gutter-stable', 'scrollbar-gutter-both',
  'scrollbar-thumb-red-500', 'scrollbar-track-blue-200', 'scrollbar-thumb-red-500/50', 'scrollbar-track-red-500/[37%]',
  'scrollbar-thumb-[#fff]', 'scrollbar-thumb-[color:var(--y)]', 'scrollbar-track-[var(--y)]',
  'scrollbar-thumb-(--x)', 'scrollbar-track-(color:--z)',
  'scrollbar-thumb-current', 'scrollbar-thumb-transparent', 'scrollbar-track-inherit',
  'hover:scrollbar-thumb-red-500', 'dark:scrollbar-thin', 'md:scrollbar-gutter-stable',
  'font-features-["smcp"]', 'font-features-["smcp","onum"]', 'font-features-(--x)', 'font-features-(feat:--x)',
  'hover:font-features-["liga"_0]',
];

describe('#309 scrollbar-* and font-features-* match Tailwind 4.3.3', () => {
  it('passes effective-value parity', async () => {
    const results = await runParity(TOKENS.map((t) => [t, 1] as const));
    expect(results.filter((r) => !r.pass).map((r) => `${r.token}: ${r.diffs.join('; ')}`)).toEqual([]);
  });

  it('composes scrollbar-color from both halves with @property defaults', () => {
    const css = generateCss('scrollbar-thumb-red-500', createContext({ preflight: false }));
    expect(css).toMatch(/--baro-scrollbar-thumb: var\(--color-red-500\)/);
    expect(css).toMatch(/scrollbar-color: var\(--baro-scrollbar-thumb\) var\(--baro-scrollbar-track\)/);
    expect(css).toMatch(/@property --baro-scrollbar-track \{[^}]*initial-value: #0000/);
  });

  it('maps internal vars to --tw-* with cssVarPrefix tw', () => {
    const css = generateCss('scrollbar-track-red-500', createContext({ preflight: false, cssVarPrefix: 'tw' } as never));
    expect(css).toMatch(/--tw-scrollbar-track: var\(--color-red-500\)/);
  });

  it('emits nothing for unknown named values', () => {
    const ctx = createContext({ preflight: false });
    expect(generateCss('font-features-smcp scrollbar-thumb-nope scrollbar-hidden', ctx).trim()).toBe('');
  });
});
