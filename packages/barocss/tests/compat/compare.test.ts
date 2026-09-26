import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { fixtures } from './fixtures';
import { flatRules } from './parity-compare';

const tailwindInput = `
@theme inline {
  --spacing: 0.25rem;
  --breakpoint-md: 48rem;
}
@theme {
  --color-red-500: #ef4444;
}
@tailwind utilities;
`;

// #312: Tailwind 4.3 flattens nested `&` rules; compare rules after flatRules resolves nesting and normalises only
// shape (whitespace, `:has(*:x)` ≡ `:has(:x)`, `--tw-`/`--baro-`, `(width >= X)` ≡ `(min-width: X)`). Selectors,
// declarations and at-rules still have to match, so a different CSS result stays visible.
async function compare(candidate: string) {
  const compiler = await compile(tailwindInput);
  const tailwindCss = compiler.build([candidate]);
  const context = createContext({
    preflight: false,
    theme: { colors: { red: { 500: '#ef4444' } }, breakpoints: { md: '48rem' } },
  });
  const baroCss = generateCss(candidate, context);
  const tailwindNodes = flatRules(tailwindCss);
  const baroNodes = flatRules(baroCss);
  const result = tailwindNodes.length === 0 ? 'no-tailwind-rule'
    : baroNodes.length === 0 ? 'unsupported'
    : JSON.stringify(tailwindNodes) === JSON.stringify(baroNodes) ? 'match' : 'different';
  return { result, tailwindCss, baroCss };
}

describe('Tailwind CSS 4.3 output comparison', () => {
  it.each(fixtures)('$name: $candidate', async ({ candidate, expected }) => {
    const output = await compare(candidate);
    expect(output.tailwindCss).toMatch(/^\/\*! tailwindcss v4\.3\./);
    expect(output.result, `Tailwind:\n${output.tailwindCss}\nBaroCSS:\n${output.baroCss}`).toBe(expected);
  });

  it('emits a usable standalone mask rule while global property support differs', async () => {
    const { baroCss } = await compare('mask-linear-from-50%');
    expect(baroCss).toContain('--baro-mask-linear-from-position: 50%;');
    expect(baroCss).toContain('--baro-mask-linear: linear-gradient(var(--baro-mask-linear-stops));');
    expect(baroCss).toContain('mask-image: var(--baro-mask-linear), var(--baro-mask-radial), var(--baro-mask-conic);');
    for (const name of ['linear', 'radial', 'conic', 'linear-position', 'linear-from-position', 'linear-to-position', 'linear-from-color', 'linear-to-color']) {
      expect(baroCss).toContain(`@property --baro-mask-${name}`);
    }
    expect(baroCss).toContain('initial-value: linear-gradient(#fff, #fff)');
  });

  it('uses current color and defined shadow fallbacks for inset rings', async () => {
    const { baroCss } = await compare('inset-ring-2');
    expect(baroCss).toContain('var(--baro-inset-ring-color, currentcolor)');
    expect(baroCss).toContain('--baro-inset-shadow');
    expect(baroCss).toContain('initial-value: 0 0 #0000');
    expect(baroCss).not.toContain('rgb(59 130 246 / 0.5)');
  });

  it('uses the same md breakpoint value on both sides', async () => {
    const { tailwindCss, baroCss } = await compare('md:block');
    expect(tailwindCss).toContain('(width >= 48rem)');
    expect(baroCss).toContain('(min-width: 48rem)');
  });
});
