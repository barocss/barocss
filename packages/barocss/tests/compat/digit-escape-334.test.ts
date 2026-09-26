import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { escapeClassName } from '../../src/core/registry';
import '../../src/presets';
import { invalidSelectorReason, invalidSelectors, runParity, tailwindBuilder } from './parity-compare';

// #334: class names whose selector would start with a digit are CSS-escaped the CSS.escape way (`\32 xl`),
// byte-identical to Tailwind 4.3.3, and the parity comparator fails an invalid emitted selector.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/digit-escape-334.test.ts
const selectors = (css: string) => {
  const out: string[] = [];
  postcss.parse(css).walkRules((r) => { if (!/keyframes$/.test((r.parent as postcss.AtRule)?.name ?? '')) out.push(r.selector); });
  return out.filter((s) => !s.startsWith(':root')).sort();
};

describe('escapeClassName first-character rules (#334)', () => {
  it.each([
    ['2xl:p-4', '\\32 xl\\:p-4'],
    ['-2xl:p-4', '-\\32 xl\\:p-4'],
    ['-', '\\-'],
    ['-mt-2', '-mt-2'],
    ['max-2xl:p-4', 'max-2xl\\:p-4'],
    ['9', '\\39 '],
  ])('%s -> %s', (cls, esc) => expect(escapeClassName(cls)).toBe(esc));
});

describe('selectors match Tailwind 4.3.3 (#334)', () => {
  const tw = tailwindBuilder();
  const ctx = createContext({ preflight: false });
  it.each(['2xl:p-4', '2xl:hover:flex', '@2xl:p-4', '2xl:-mt-2', 'max-2xl:p-4', 'min-[2px]:p-4'])('%s', async (cls) => {
    expect(selectors(generateCss(cls, ctx))).toEqual(selectors(await tw([cls])));
  });
  it('the -digit leading case (-2xl: max variant) is valid', () => {
    expect(invalidSelectors(generateCss('-2xl:p-4', ctx))).toEqual([]);
  });
  it('2xl: fixtures pass parity', async () => {
    const r = await runParity([['2xl:p-4', 1], ['2xl:hover:flex', 1], ['@2xl:p-4', 1]]);
    expect(r.filter((x) => !x.pass).map((x) => `${x.token}: ${x.diffs.join('; ')}`)).toEqual([]);
  });
});

describe('parity comparator selector validity (#334)', () => {
  it('flags unescaped digit-leading, -digit and lone - classes', () => {
    expect(invalidSelectorReason('.2xl\\:p-4')).toMatch(/digit/);
    expect(invalidSelectorReason('.-2x')).toMatch(/-digit/);
    expect(invalidSelectorReason('.- .a')).toMatch(/lone/);
    expect(invalidSelectors('@media (width>=96rem){.2xl\\:p-4{padding:1rem}}')).toHaveLength(1);
  });
  it('accepts escaped and ordinary selectors', () => {
    for (const s of ['.\\32 xl\\:p-4', '.-mt-2', '.w-1\\.5', '.group:hover .a', '.a[data-x="1.5"]', ':where(.divide-y>:not(:last-child))'])
      expect(invalidSelectorReason(s)).toBeUndefined();
  });
});
