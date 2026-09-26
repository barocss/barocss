import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { astToCss, rootToCss } from '../../src/core/astToCss';
import { hasCommentDelimiter } from '../../src/core/parser';
import { ServerRuntime } from '../../../barocss-server/src/index';
import '../../src/presets';

// #273: each variant token can be safe alone, yet two adjacent arbitrary variants may join into a comment
// delimiter in the final selector. The serializer must drop any rule whose selector or at-rule prelude carries one.
//   pnpm --filter @barocss/kit exec vitest run tests/security/comment-junction.test.ts

const SLASH = String.fromCharCode(47);
const STAR = String.fromCharCode(42);
const OPEN = SLASH + STAR;
const CLOSE = STAR + SLASH;

// "an arbitrary variant ending with A" followed by "one starting with B" (after the nesting marker).
const chain = (a: string, b: string, util = 'p-4') => `[&${a}]:[&${b}]:${util}`;
const junctionTokens = [
  chain(SLASH, STAR),
  chain(STAR, SLASH),
  chain('_' + STAR, SLASH),
];

describe('#273 comment delimiters formed across variant junctions', () => {
  it('helper finds delimiters but skips backslash escapes', () => {
    expect(hasCommentDelimiter('a' + OPEN + 'b')).toBe(true);
    expect(hasCommentDelimiter('a' + CLOSE)).toBe(true);
    expect(hasCommentDelimiter('.w-1\\' + SLASH + STAR)).toBe(false);
    expect(hasCommentDelimiter('.x\\' + STAR + SLASH + 'y')).toBe(false);
    expect(hasCommentDelimiter('.a > ' + STAR)).toBe(false);
  });

  it('kit generateCss emits nothing for junction-formed opener or closer', () => {
    const ctx = createContext({});
    for (const t of junctionTokens) {
      const css = generateCss(t, ctx);
      expect(hasCommentDelimiter(css), t.length.toString()).toBe(false);
      expect(css.trim()).toBe('');
    }
  });

  it('a following safe rule survives in the concatenated sheet', () => {
    const ctx = createContext({});
    const css = generateCss([...junctionTokens, 'p-2'].join(' '), ctx);
    expect(css).toContain('.p-2');
    expect(hasCommentDelimiter(css)).toBe(false);
  });

  it('server generateCss emits nothing for them', () => {
    const s = new ServerRuntime({});
    for (const t of junctionTokens) expect(String(s.generateCss(t)).trim()).toBe('');
  });

  it('astToCss / rootToCss drop crafted selectors and preludes directly', () => {
    const decl = { type: 'decl', prop: 'color', value: 'red' } as const;
    expect(astToCss([{ type: 'style-rule', selector: '.a' + OPEN, nodes: [decl] } as any]).trim()).toBe('');
    expect(astToCss([{ type: 'rule', selector: '& ' + CLOSE, nodes: [decl] } as any], 'x').trim()).toBe('');
    expect(astToCss([{ type: 'at-rule', name: 'media', params: OPEN, nodes: [{ type: 'rule', selector: '&', nodes: [decl] }] } as any], 'x').trim()).toBe('');
    expect(rootToCss([{ type: 'at-rule', name: 'property', params: '--a' + CLOSE, nodes: [decl] } as any]).trim()).toBe('');
  });

  it('legitimate slash/star forms still emit', () => {
    const ctx = createContext({});
    const legit = [
      `[&_${STAR}]:p-4`, `${STAR}:p-4`, `${STAR}${STAR}:p-4`, `[&>${STAR}]:p-4`, 'has-[>svg]:p-4',
      `w-[calc(100%${SLASH}3)]`, `w-[calc(2${STAR}var(--x))]`, `w-1${SLASH}2`, `group-hover${SLASH}name:p-4`,
    ];
    for (const t of legit) {
      const css = generateCss(t, ctx);
      expect(css.trim(), t).not.toBe('');
    }
  });
});
