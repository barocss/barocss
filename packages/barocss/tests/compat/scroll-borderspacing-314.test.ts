import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { runParity } from './parity-compare';
import '../../src/presets';

// #314: scroll-*-px, no negative scroll-padding, and border-spacing x/y vars, checked against tailwindcss 4.3.3.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/scroll-borderspacing-314.test.ts
const SIDES = ['', 'x', 'y', 't', 'r', 'b', 'l', 's', 'e'];
const TOKENS = [
  ...SIDES.flatMap((s) => [`scroll-m${s}-px`, `-scroll-m${s}-px`, `scroll-p${s}-px`]),
  '-scroll-mt-4', '-scroll-mx-2', 'scroll-p-4', 'scroll-px-2', 'scroll-p-[3px]',
  'border-spacing-2', 'border-spacing-px', 'border-spacing-[3px]', 'border-spacing-(--a)',
  'border-spacing-x-2', 'border-spacing-x-px', 'border-spacing-x-[3px]', 'border-spacing-x-(--a)',
  'border-spacing-y-4', 'border-spacing-y-px', 'border-spacing-y-[1rem]', 'border-spacing-y-(--b)',
  'md:border-spacing-x-2',
];

describe('#314 scroll-*-px, negative scroll-padding and border-spacing match Tailwind 4.3.3', () => {
  it('passes effective-value parity', async () => {
    const results = await runParity(TOKENS.map((t) => [t, 1] as const));
    expect(results.filter((r) => !r.pass).map((r) => `${r.token}: ${r.diffs.join('; ')}`)).toEqual([]);
  });

  it('composes border-spacing-x and border-spacing-y on one element', async () => {
    const results = await runParity([['border-spacing-x-2 border-spacing-y-4', 1] as const]);
    expect(results.filter((r) => !r.pass).map((r) => `${r.token}: ${r.diffs.join('; ')}`)).toEqual([]);
    const css = generateCss('border-spacing-x-2 border-spacing-y-4', createContext({ preflight: false }));
    expect(css).toMatch(/--baro-border-spacing-x: calc\(var\(--spacing\) \* 2\)/);
    expect(css).toMatch(/--baro-border-spacing-y: calc\(var\(--spacing\) \* 4\)/);
    expect(css).toMatch(/border-spacing: var\(--baro-border-spacing-x\) var\(--baro-border-spacing-y\)/);
    expect(css).toMatch(/@property --baro-border-spacing-y \{[^}]*syntax: "<length>"[^}]*initial-value: 0/);
  });

  it('maps internal vars to --tw-* with cssVarPrefix tw', () => {
    const css = generateCss('border-spacing-x-px', createContext({ preflight: false, cssVarPrefix: 'tw' } as never));
    expect(css).toMatch(/--tw-border-spacing-x: 1px/);
  });

  it('emits nothing for negative scroll-padding', () => {
    const ctx = createContext({ preflight: false });
    expect(generateCss('-scroll-p-4 -scroll-px-2 -scroll-pt-px -scroll-p-[3px] -scroll-p-(--x)', ctx).trim()).toBe('');
  });
});
