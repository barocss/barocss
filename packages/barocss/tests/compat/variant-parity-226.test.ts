/**
 * #226: variant/selector parity with Tailwind 4.3. Both outputs are reduced by `flatRules` (#312) to
 * `[at-rules] selector { declarations }` (nesting resolved, `(width >= X)` ≡ `(min-width: X)`,
 * `:not(*:is(.a))` ≡ `:not(:is(.a))`) and compared, with a fresh Tailwind compiler per candidate.
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
  'max-sm:flex', 'max-md:flex', 'max-lg:flex', 'max-xl:flex', 'max-2xl:flex',
  'hover:block', 'group-hover:block', 'peer-hover:block', 'group-hover/x:block', 'peer-hover/x:block',
  'group-focus:block',
  'group-not-[.a]:block', 'peer-not-[.a]:block', 'group-not-[a,b]:block',
  '*:hidden', '**:hidden', 'md:*:hidden',
  '[:root]:hidden', '[.a]:hidden',
];

describe('#226 variant parity with Tailwind 4.3', () => {
  const ctx = createContext({ preflight: false });
  for (const cls of CANDIDATES) {
    it(cls, async () => {
      const tw = flatRules((await compile(`${theme}\n@tailwind utilities;`)).build([cls]));
      expect(tw).toHaveLength(1);
      expect(flatRules(generateCss(cls, ctx))).toEqual(tw);
    });
  }
});
