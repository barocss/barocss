import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { runParity } from './parity-compare';

// #393: opacity modifiers on arbitrary, custom-property and theme colours, across the colour utilities.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/color-opacity-393.test.ts
const UTILS = ['bg', 'text', 'border', 'ring', 'inset-ring', 'fill', 'stroke', 'outline', 'decoration', 'shadow', 'inset-shadow',
  'text-shadow', 'divide', 'placeholder', 'accent', 'caret', 'from', 'via', 'to'];
const COLORS = ['[#f00]', '[rgb(255_0_0)]', '[oklch(0.6_0.2_30)]', '[var(--x)]', '(--x)', '(color:--x)', 'red-500'];
const MODS = ['', '/50', '/[0.3]', '/(--o)', '/[50%]'];

describe('#393 colour opacity modifiers', async () => {
  const matrix = UTILS.flatMap((u) => COLORS.flatMap((c) => MODS.map((m) => `${u}-${c}${m}`)));
  const results = await runParity(matrix.map((t) => [t, 1] as const));

  it(`matches Tailwind 4.3.3 over the ${matrix.length}-class matrix`, () => {
    expect(results.filter((r) => !r.pass).map((r) => `${r.token}: ${r.diffs.join('; ')}`)).toEqual([]);
  });

  const ctx = createContext({ preflight: false });
  // Only a number, [number], [percentage], (--x) or [var(--x)] (a bare 50% is invalid, as in Tailwind 4.3.3) is an alpha; the rest emits nothing.
  const INVALID = ['/', '/[url(x)]', '/[abc]', '/foo', '/[50px]', '/(x)', '/[var(x)]', '/[1;x]', '/[50', '/50]', '/[calc(50%)]', '/50%'];
  const cases = UTILS.flatMap((u) => COLORS.flatMap((c) => INVALID.map((m) => `${u}-${c}${m}`)));
  it('an empty or invalid modifier emits nothing', () => {
    expect(cases.filter((t) => generateCss(t, ctx).trim() !== '')).toEqual([]);
  });

  it('valid modifiers produce a color-mix (or nothing) and never a malformed value', () => {
    for (const u of UTILS) for (const c of COLORS) for (const m of ['/50', '/[0.3]', '/[50%]', '/(--o)', '/[var(--o)]']) {
      const css = generateCss(`${u}-${c}${m}`, ctx);
      if (css === '') continue; // e.g. from-[var(--x)]/50: Tailwind emits nothing either (the matrix above checks)
      expect(css.replace(/^[^{]*\{/gm, ''), `${u}-${c}${m}`).not.toMatch(/\)\/|\/\d|\]\//);
      expect(css, `${u}-${c}${m}`).toMatch(/color-mix\(in oklab, [^;]+ (\d+(\.\d+)?%|var\(--o\)), transparent\)|--baro-(inset-shadow|shadow|text-shadow)-alpha/);
    }
  });
});
