// TODO(#304): known 4.3 difference, so this file stays pinned to Tailwind 4.1.13 (`tailwindcss-4-1`). 4.3 flattens nested `&` rules and drops the redundant `*` in `:not(*:is(.a))` -> `:not(:is(.a))`; this test compares selector text.
// Effective-value parity against 4.3 is covered by parity-corpus/parity-heldout; port this text/shape check to 4.3 output.
/**
 * #226: variant/selector parity with Tailwind 4.1.13. Tailwind nests (`.cls { &X { @media … { … } } }`);
 * BaroCSS emits the flattened rule inside its at-rules. Both are reduced to
 * `[at-rules] selector { declarations }` and compared, with a fresh Tailwind compiler per candidate.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss-4-1';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

const req = createRequire(import.meta.url);
const theme = fs.readFileSync(req.resolve('tailwindcss-4-1/theme.css'), 'utf8');
const ws = (s: string) => s.replace(/\s+/g, ' ').trim();

type Flat = { media: string[]; selector: string; decls: string };

/** Walks Tailwind's nested output: `&` resolves to the parent selector; `@media` blocks are collected. */
function flattenTailwind(css: string): Flat {
  const body = ws(css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@property[\s\S]*$/, '')
    .replace(/:root, :host \{[^}]*\}/, '').replace(/@layer theme \{\s*\}/, ''));
  const media: string[] = [];
  let selector = '';
  let rest = body;
  for (;;) {
    const m = /^([^{}]+?) \{ ([\s\S]*) \}$/.exec(rest);
    if (!m) return { media, selector, decls: rest };
    const head = m[1];
    if (head.startsWith('@media ')) media.push(head.slice(7));
    else selector = selector ? (head.includes('&') ? head.replace(/&/g, selector) : `${selector} ${head}`) : head;
    rest = m[2];
  }
}

function flattenBaro(css: string): Flat {
  const media: string[] = [];
  let rest = ws(css.replace(/:root, :host \{[^}]*\}/, ''));
  for (;;) {
    const m = /^([^{}]+?) \{ ([\s\S]*) \}$/.exec(rest);
    if (!m) throw new Error(`unexpected BaroCSS output: ${rest}`);
    if (!m[1].startsWith('@media ')) return { media, selector: m[1], decls: m[2] };
    media.push(m[1].slice(7));
    rest = m[2];
  }
}

// Tailwind's `(width >= X)` and BaroCSS's `(min-width: X)` for `md:` are the same query.
const normMedia = (q: string) => q.replace(/\(min-width: ([^)]+)\)/, '(width >= $1)');

const CANDIDATES = [
  'max-sm:flex', 'max-md:flex', 'max-lg:flex', 'max-xl:flex', 'max-2xl:flex',
  'hover:block', 'group-hover:block', 'peer-hover:block', 'group-hover/x:block', 'peer-hover/x:block',
  'group-focus:block',
  'group-not-[.a]:block', 'peer-not-[.a]:block', 'group-not-[a,b]:block',
  '*:hidden', '**:hidden', 'md:*:hidden',
  '[:root]:hidden', '[.a]:hidden',
];

describe('#226 variant parity with Tailwind 4.1.13', () => {
  const ctx = createContext({ preflight: false });
  for (const cls of CANDIDATES) {
    it(cls, async () => {
      const tw = flattenTailwind((await compile(`${theme}\n@tailwind utilities;`)).build([cls]));
      const bc = flattenBaro(generateCss(cls, ctx));
      expect(bc.selector).toBe(tw.selector);
      expect(bc.media.map(normMedia).sort()).toEqual(tw.media.sort());
      expect(bc.decls).toBe(tw.decls);
    });
  }
});
