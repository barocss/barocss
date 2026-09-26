import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { astToCss } from '../../src/core/astToCss';
import { isBalancedPrelude, isWellFormedVariantBrackets } from '../../src/core/parser';
import { ServerRuntime } from '../../../barocss-server/src/index';
import '../../src/presets';

// #332: a composed selector or at-rule prelude with unbalanced brackets/parens/braces must never be emitted:
// in concatenated CSS text it would swallow the rules that follow. Guarded twice: the parser rejects malformed
// variant bracket groups, and the serializer drops any rule whose final prelude does not balance.
//   pnpm --filter @barocss/kit exec vitest run tests/security/balance-332.test.ts

const LB = '[';
const RB = ']';
const LP = '(';
const RP = ')';
const LC = '{';
const RC = '}';
const EMPTY = LB + RB;
const FOLLOW = 'underline';

// Generic shapes, built from the constants above.
const badVariants = [
  `${EMPTY}:${FOLLOW}`, // an empty arbitrary variant
  `has-${EMPTY}:p-4`, // an empty has bracket
  `group-has-${EMPTY}:p-4`, // an empty group-has bracket
  `group-has--${EMPTY}:p-4`, // a group-has whose value is a dash plus an empty bracket
  `peer-has-${EMPTY}:p-4`,
  `group-${EMPTY}:p-4`,
  `sm:group-${EMPTY}:p-4`,
  `${LB}&${RB}${LB}x${RB}:p-4`, // two adjacent bracket groups read as one arbitrary variant
  `${LB}&${RB}${LB}${EMPTY}${RB}:p-4`, // adjacent groups where the second nests an empty one
  `min-${LB}0${RB}:${LB}&${RB}${EMPTY}:p-4`,
];

function balanced(css: string): boolean {
  // Whole-sheet check: every emitted rule closes (same scanner as the serializer guard).
  return isBalancedPrelude(css);
}

describe('#332 helpers', () => {
  it('isBalancedPrelude skips escapes and quotes, allows top-level commas', () => {
    expect(isBalancedPrelude(`.a:is${LP}.b, .c${RP}`)).toBe(true);
    expect(isBalancedPrelude(`.a, .b`)).toBe(true);
    expect(isBalancedPrelude(`.x\\${LB}1\\${RB}`)).toBe(true);
    expect(isBalancedPrelude(`.x\\${LB}`)).toBe(true);
    expect(isBalancedPrelude(`.a${LB}data-x="${RB}"${RB}`)).toBe(true);
    expect(isBalancedPrelude(`.a${LB}`)).toBe(false);
    expect(isBalancedPrelude(`.a${RB}${LB}`)).toBe(false);
    expect(isBalancedPrelude(`.a:has${LP}${LB}${RP}`)).toBe(false);
    expect(isBalancedPrelude(`.a${LC}`)).toBe(false);
    expect(isBalancedPrelude(`.a${LB}x${RP}`)).toBe(false);
    expect(isBalancedPrelude(`.a${LB}x="${RB}`)).toBe(false);
  });

  it('isWellFormedVariantBrackets rejects empty and adjacent groups only', () => {
    expect(isWellFormedVariantBrackets(EMPTY)).toBe(false);
    expect(isWellFormedVariantBrackets(`has-${EMPTY}`)).toBe(false);
    expect(isWellFormedVariantBrackets(`${LB}&${RB}${LB}x${RB}`)).toBe(false);
    expect(isWellFormedVariantBrackets(`${LB}&_*${RB}`)).toBe(true);
    expect(isWellFormedVariantBrackets(`${LB}&:is${LP}${LB}x${RB}${RP}${RB}`)).toBe(true);
    expect(isWellFormedVariantBrackets(`has-${LB}>svg${RB}`)).toBe(true);
    expect(isWellFormedVariantBrackets(`${LB}data-x="${EMPTY}"${RB}`)).toBe(true);
  });

  it('serializer drops a rule whose selector or at-rule prelude is unbalanced', () => {
    const decl = { type: 'decl' as const, prop: 'color', value: 'red' };
    expect(astToCss([{ type: 'style-rule', selector: `.a${LB}`, nodes: [decl] } as never]).trim()).toBe('');
    expect(astToCss([{ type: 'at-rule', name: 'media', params: `${LP}x`, nodes: [decl] } as never]).trim()).toBe('');
    expect(astToCss([{ type: 'style-rule', selector: `.a:is${LP}.b, .c${RP}`, nodes: [decl] } as never])).toContain('color');
  });
});

describe('#332 unbalanced composed selectors emit nothing', () => {
  it.each(badVariants)('kit: %s', (cls) => {
    const css = generateCss(cls, createContext({}));
    expect(css.trim()).toBe('');
  });

  it('a following valid rule survives in concatenated kit output', () => {
    const ctx = createContext({});
    for (const cls of badVariants) {
      const css = generateCss(`${cls} ${FOLLOW}`, ctx);
      expect(balanced(css), cls).toBe(true);
      expect(css).toContain(`.${FOLLOW} {`);
    }
  });

  it('a following valid rule survives in concatenated server output', () => {
    const srv = new ServerRuntime({});
    for (const cls of badVariants) {
      const css = srv.generateCss(`${cls} ${FOLLOW}`);
      expect(balanced(css), cls).toBe(true);
      expect(css).toContain(`.${FOLLOW}`);
      const html = srv.generateCssForHtml(`<div class="${cls} ${FOLLOW}"></div>`);
      const text = typeof html === 'string' ? html : JSON.stringify(html);
      expect(text).toContain(FOLLOW);
    }
  });
});

describe('#332 legit nested forms are unchanged', () => {
  const legit = [
    `${LB}&:is${LP}.a,.b${RP}${RB}:p-4`,
    `has-${LB}>svg${RB}:p-4`,
    `${LB}&_*${RB}:p-4`,
    `group-has-${LB}.x${RB}:p-4`,
    `peer-has-${LB}.x${RB}:p-4`,
    `not-${LB}.x${RB}:p-4`,
    `@md:p-4`,
    `@min-${LB}400px${RB}:p-4`,
    `supports-${LB}display:grid${RB}:grid`,
    `${LB}@supports${LP}display:grid${RP}${RB}:grid`,
    `w-${LB}10px${RB}`,
    `bg-${LB}url${LP}"a${RP}b"${RP}${RB}`,
    `min-${LB}320px${RB}:p-4`,
    `data-${LB}state=open${RB}:p-4`,
    `group-hover:p-4`,
    `hover:focus:p-4`,
  ];
  it('byte-identical output', () => {
    const ctx = createContext({});
    const out = legit.map((cls) => [cls, generateCss(cls, ctx)]);
    for (const [cls, css] of out) expect(css.trim(), cls).not.toBe('');
    expect(out).toMatchSnapshot();
  });
});
