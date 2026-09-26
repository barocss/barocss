import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { astToCss } from '../../src/core/astToCss';
import { escapeClassName } from '../../src/core/registry';
import { isScopedSelector } from '../../src/core/parser';
import { ServerRuntime } from '../../../barocss-server/src/index';
// @ts-expect-error plain ESM helper without types
import * as H from '../fuzz/harness.mjs';
import '../../src/presets';

// #392: class inputs carrying unusual separator, whitespace or invisible code points must never produce a rule
// that applies outside the generating element (fuzz property P2). Guarded twice: the class escaper hex-escapes
// such code points (never a backslash plus the raw character), and the serializer drops any style rule whose
// selector does not name the generating class.
//   pnpm --filter @barocss/kit exec vitest run tests/security/separator-scope-392.test.ts

// Named code-point categories, built from char codes.
const CATEGORIES: Record<string, number[]> = {
  spaceSeparators: [0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009,
    0x200a, 0x202f, 0x205f, 0x3000],
  lineParagraph: [0x2028, 0x2029, 0x85],
  format: [0xfeff, 0x200b, 0x200c, 0x200d, 0x2060, 0xad, 0x200e, 0x200f, 0x202a, 0x202e, 0x2066, 0x2069, 0x61c, 0x180e],
  control: [0x0, 0x1, 0xb, 0x1f, 0x7f, 0x9f],
  ascii: [0x2c, 0x3b, 0x9, 0xa, 0xc, 0xd, 0x20],
};
const VALID = ['p-4', 'bg-red-500', 'hover:underline'];
const MALFORMED = ['text-3', 'bg-red-500/', 'p-', 'h-[x', 'w-(y'];
const PUNCT = [String.fromCharCode(0x2c), String.fromCharCode(0x3b), ''];

function* shapes(): Generator<[string, string]> {
  for (const [cat, codes] of Object.entries(CATEGORIES))
    for (const code of codes) {
      const ch = String.fromCodePoint(code);
      for (const u of [...VALID, ...MALFORMED])
        for (const p of PUNCT) {
          yield [cat, u + p + ch];
          yield [cat, u + p + ch + ' underline'];
          yield [cat, ch + p + u];
        }
    }
}

const RAW_UNSAFE_ESCAPE = /\\[\s\p{C}\p{Z}]/u;

describe('#392 unusual separators never escape class scope', () => {
  const ctx = createContext({});

  it('kit output keeps every rule scoped (P2) and never escapes a raw invisible code point', () => {
    let n = 0;
    for (const [cat, input] of shapes()) {
      const css = generateCss(input, ctx);
      const p2 = H.checkCss(css, input, H.classPredicate(input)).filter((v: { prop: string }) => v.prop === 'P2');
      expect(p2, `${cat} #${n}`).toEqual([]);
      expect(RAW_UNSAFE_ESCAPE.test(css), `${cat} #${n}`).toBe(false);
      n++;
    }
    expect(n).toBeGreaterThan(500);
  });

  it('server output keeps every rule scoped', () => {
    const srv = new ServerRuntime({});
    let n = 0;
    for (const [cat, input] of shapes()) {
      const css = srv.generateCss(input);
      const p2 = H.checkCss(css, input, H.classPredicate(input)).filter((v: { prop: string }) => v.prop === 'P2');
      expect(p2, `${cat} #${n++}`).toEqual([]);
    }
  });

  it('escapeClassName hex-escapes whitespace, format, control and separator code points', () => {
    for (const codes of Object.values(CATEGORIES))
      for (const code of codes) {
        if (code >= 0x20 && code < 0x7f) continue; // printable ASCII keeps its named escape
        const esc = escapeClassName('a' + String.fromCodePoint(code));
        expect(esc, code.toString(16)).toBe('a\\' + code.toString(16) + ' ');
      }
    // legitimate classes are unchanged
    expect(escapeClassName('bg-red-500/50')).toBe('bg-red-500\\/50');
    expect(escapeClassName('hover:p-4')).toBe('hover\\:p-4');
  });

  it('serializer drops a style rule not scoped to the generating class', () => {
    const decl = { type: 'decl' as const, prop: 'color', value: 'red' };
    const scope = 'p-4';
    expect(astToCss([{ type: 'style-rule', selector: '.other', nodes: [decl] } as never], undefined, { scope }).trim()).toBe('');
    expect(astToCss([{ type: 'style-rule', selector: '.p-4, .other', nodes: [decl] } as never], undefined, { scope }).trim()).toBe('');
    expect(astToCss([{ type: 'style-rule', selector: '.p-40', nodes: [decl] } as never], undefined, { scope }).trim()).toBe('');
    expect(astToCss([{ type: 'style-rule', selector: '.group:hover .p-4', nodes: [decl] } as never], undefined, { scope })).toContain('color');
    expect(astToCss([{ type: 'style-rule', selector: '.p-4:is(.a, .b)', nodes: [decl] } as never], undefined, { scope })).toContain('color');
  });

  it('isScopedSelector splits on top-level commas only and needs a whole class token', () => {
    const esc = '.' + escapeClassName('a');
    expect(isScopedSelector('.a', esc)).toBe(true);
    expect(isScopedSelector('.a:is(.x, .y)', esc)).toBe(true);
    expect(isScopedSelector('.a, .b', esc)).toBe(false);
    expect(isScopedSelector('.ab', esc)).toBe(false);
    expect(isScopedSelector('.x\\.a', esc)).toBe(false);
    expect(isScopedSelector('& > *', esc)).toBe(false);
    expect(isScopedSelector('& > *', esc, true)).toBe(true);
  });
});
