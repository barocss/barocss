/**
 * #221: arbitrary/data variants that shadcn/ui uses produce Tailwind 4.3's selectors.
 * Tailwind nests (`.cls { &X { … } }`); BaroCSS emits the flattened rule (`.clsX { … }`). Both are
 * reduced to `selector { declarations }` and compared, with a fresh Tailwind compiler per candidate.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { flatRules } from './parity-compare';

const req = createRequire(import.meta.url);
const theme = fs.readFileSync(req.resolve('tailwindcss/theme.css'), 'utf8');

const CANDIDATES = [
  '[&_svg]:size-4',
  '[&_*]:underline',
  '[&_svg:not([class*=size-])]:size-4',
  '[&>*]:underline',
  'group-data-[state=open]:underline',
  'group-data-[orientation=horizontal]/tabs:h-9',
  'peer-data-[state=open]:underline',
  'group-aria-[expanded=true]:underline',
  'data-[state=open]:underline',
  'has-[a,b]:underline',
  'has-[>svg]:px-3',
  'has-data-[slot=card-action]:grid-cols-[1fr_auto]',
  'not-[a,b]:underline',
];

const ws = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('#221 shadcn variant selectors match Tailwind 4.3', () => {
  const ctx = createContext({ preflight: false });
  for (const cls of CANDIDATES) {
    it(cls, async () => {
      // #312: the single utility rule, nesting flattened and `:has(*:x)` ≡ `:has(:x)` (see flatRules).
      const tw = flatRules((await compile(`${theme}\n@tailwind utilities;`)).build([cls]));
      expect(tw).toHaveLength(1);
      expect(flatRules(generateCss(cls, ctx))).toEqual(tw);
    });
  }
});

describe('#221 has-[a,b] keeps the selector list to one member', () => {
  const ctx = createContext({ preflight: false });
  // Commas are allowed inside :has(); a class inside the value must stay inside the pseudo-class.
  for (const cls of ['has-[a,.x]:hidden', 'has-[.x,a]:hidden', 'not-[a,.x]:hidden', 'group-has-[a,.x]:hidden', 'peer-has-[a,.x]:hidden']) {
    it(cls, () => {
      const css = ws(generateCss(cls, ctx));
      if (!css) return;
      const selector = /^([^{]+?) \{/.exec(css)![1];
      let depth = 0, members = 1;
      for (let i = 0; i < selector.length; i++) {
        const c = selector[i];
        if (c === '\\') i++;
        else if (c === '(' || c === '[') depth++;
        else if (c === ')' || c === ']') depth--;
        else if (c === ',' && depth === 0) members++;
      }
      expect(members).toBe(1);
    });
  }
});
