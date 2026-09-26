import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { isSafeThemeVar, keyframesBlock } from '../../src/core/cssVars';
import { hasHtmlEndTagOpener } from '../../src/core/parser';
import { ServerRuntime } from '../../../barocss-server/src/index';
import '../../src/presets';

// #323 follow-up: generated CSS may be inlined in an HTML style element, so no emitted declaration, selector
// or prelude may carry a markup end-tag opener. A lone less-than (range queries) stays allowed.
//   pnpm --filter @barocss/kit exec vitest run tests/security/endtag-323.test.ts

const ch = (n: number) => String.fromCharCode(n);
const SEQ = ch(60) + ch(47);
const Q = ch(39);
const lower = SEQ + 'zz';
const upper = SEQ + 'ZZ';
const has = (s: unknown) => String(s).includes(SEQ);

const classTokens = [
  `content-[${Q}${lower}${Q}]`,
  `content-[${Q}${upper}${Q}]`,
  `bg-[url(${lower})]`,
  `[color:${lower}]`,
  `[--a:${Q}${lower}${Q}]`,
  `bg-(--a${lower})`,
  `[&[data-x=${Q}${lower}${Q}]]:p-4`,
  `data-[a=${Q}${lower}${Q}]:p-4`,
  `has-[[data-x=${Q}${lower}${Q}]]:p-4`,
  `supports-[content:${Q}${lower}${Q}]:p-4`,
];

describe('#323 markup end-tag opener in generated CSS', () => {
  it('predicate matches only the two-char sequence', () => {
    expect(hasHtmlEndTagOpener('a' + SEQ)).toBe(true);
    expect(hasHtmlEndTagOpener('(width ' + ch(60) + ' 40rem)')).toBe(false);
    expect(hasHtmlEndTagOpener('\\' + ch(60) + '\\' + ch(47))).toBe(false);
  });

  it('kit generateCss emits no sequence for class tokens carrying it', () => {
    const ctx = createContext({});
    classTokens.forEach((t, i) => expect(has(generateCss(t, ctx)), String(i)).toBe(false));
  });

  it('server generateCss / generateCssForHtml emit no sequence', () => {
    const s = new ServerRuntime({});
    classTokens.forEach((t, i) => {
      expect(has(s.generateCss(t)), String(i)).toBe(false);
      expect(has(s.generateCssForHtml([t])), String(i)).toBe(false);
    });
  });

  it('theme values and keyframes carrying it are dropped', () => {
    expect(isSafeThemeVar('--color-x', lower)).toBe(false);
    const ctx = createContext({ theme: { extend: { colors: { x: lower, ok: '#123456' } } } });
    const css = ctx.themeToCssVars();
    expect(has(css)).toBe(false);
    expect(css).toContain('--color-ok: #123456;');
    expect(keyframesBlock('k', { to: { content: lower } })).toBe('');
  });

  it('range queries keep a plain less-than and are byte-identical', () => {
    const ctx = createContext({});
    const out = ['max-sm:p-4', '@max-md:p-4', 'max-[600px]:p-4', 'not-@sm:p-4'].map((c) => generateCss(c, ctx)).join('\n---\n');
    expect(out).toContain(ch(60));
    expect(out).toMatchSnapshot();
  });
});
