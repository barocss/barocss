import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { invalidSelectors, tailwindBuilder } from './parity-compare';

// #360: supports-[…] decodes `_` to a space and `\_` to a literal `_`, as Tailwind 4.3.3 does, so compound
// and / or / not conditions give a valid `@supports` prelude. The prelude guards run after decoding.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/supports-underscore-360.test.ts
const ctx = createContext({ preflight: false });

const atParams = (css: string) => {
  const out: string[] = [];
  postcss.parse(css).walkAtRules('supports', (a) => {
    if (a.nodes?.some((n) => n.type === 'rule')) out.push(a.params.replace(/\s+/g, ' ').trim());
  });
  return out.sort();
};

const CASES: [string, string][] = [
  ['supports-[(display:grid)_and_(gap:1px)]:flex', '(display:grid) and (gap:1px)'],
  ['supports-[(display:grid)_or_(gap:1px)]:flex', '(display:grid) or (gap:1px)'],
  ['supports-[not_(display:grid)]:flex', 'not (display:grid)'],
  ['supports-[not_(display:grid)_and_(gap:1px)]:flex', 'not (display:grid) and (gap:1px)'],
  ['supports-[display:grid_and_gap:1px]:flex', '(display:grid and gap:1px)'],
  ['supports-[selector(a_>_b)]:flex', 'selector(a > b)'],
  ['supports-[font-format(opentype)_or_(x:y)]:flex', 'font-format(opentype) or (x:y)'],
  ['supports-[(a:b\\_c)]:flex', '(a:b_c)'],
  ['supports-[(content:"a\\_b")]:flex', '(content:"a_b")'],
];

describe('supports-[…] underscore decoding matches Tailwind 4.3.3 (#360)', () => {
  const tw = tailwindBuilder();
  it.each(CASES)('%s', async (cls, expected) => {
    const ours = generateCss(cls, ctx);
    expect(invalidSelectors(ours)).toEqual([]);
    expect(atParams(ours)).toEqual([expected]);
    expect(atParams(ours)).toEqual(atParams(await tw([cls])));
  });
});

// Guards apply to the decoded prelude: an underscore-built comment, imbalance or url( is still rejected.
describe('prelude guards run after decoding (#273, #332, #335)', () => {
  it.each([
    'supports-[(a:b)_and_(c:/*d)]:flex', 'supports-[(a:b)_/*_x_*/_and_(c:d)]:flex',
    'supports-[(a:b)_and_(c:d]:flex', 'supports-[(a:b))_and_((c:d)]:flex',
    'supports-[(a:b)_and_(url(x))]:flex', 'supports-[(a:b)_or_(c:url(x))]:flex',
  ])('%s', (cls) => {
    const css = generateCss(cls, ctx);
    expect(css).not.toMatch(/url\s*\(|\/\*/i);
    expect(css.trim()).toBe('');
  });
});
