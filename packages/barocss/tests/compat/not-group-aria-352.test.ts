import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { invalidSelectors, tailwindBuilder } from './parity-compare';

// #352: negated (not-data/aria/has/supports/<breakpoint>/<media>) and group-/peer-aria variants, compared with
// Tailwind 4.3.3 compile(): the wrapping at-rules (outer to inner) and the rule selectors.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/not-group-aria-352.test.ts
const ctx = createContext({ preflight: false });

// `(width >= x)` and `(min-width: x)` are the same query; `:has(:is(x))` and `:has(x)`, `*[a]` and `[a]` inside
// `:has()` select the same elements (BaroCSS's has-[…] already emits the short forms).
const norm = (s: string) => s
  .replace(/\(width >= ([^)]+)\)/g, '(min-width: $1)')
  .replace(/:has\(:is\(([^(),]+)\)\)/g, ':has($1)')
  .replace(/:has\(\s*([>+~])\s*/g, ':has($1')
  .replace(/:has\(\*\[/g, ':has([')
  .replace(/\s*~\s*/g, ' ~ ')
  .replace(/\s+/g, ' ').trim();

const shape = (css: string) => {
  const out: string[] = [];
  postcss.parse(css).walkRules((r) => {
    const at: string[] = [];
    for (let p = r.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule') at.unshift(`@${(p as postcss.AtRule).name} ${(p as postcss.AtRule).params}`);
    }
    out.push(norm([...at, r.selector].join(' > ')));
  });
  return out.filter((s) => !s.includes(':root')).sort();
};

const MATCH = [
  // not-data / not-aria
  'not-data-[state=open]:flex', 'not-data-active:flex', 'not-data-[state=a_b]:flex', 'not-data-[x]:flex',
  'not-aria-checked:flex', 'not-aria-foo:flex', 'not-aria-[sort=asc]:flex', 'not-aria-[sort]:flex',
  // not-has
  'not-has-[img]:flex', 'not-has-[>img]:flex', 'not-has-aria-checked:flex', 'not-has-data-[slot=x]:flex',
  // not-supports / not-<breakpoint> / not-<media>
  'not-supports-[display:grid]:flex', 'not-sm:flex', 'not-md:flex', 'not-lg:flex', 'not-xl:flex', 'not-2xl:flex',
  'not-max-md:flex', 'not-max-2xl:flex', 'not-min-[500px]:flex', 'not-max-[500px]:flex',
  'not-dark:flex', 'not-print:flex', 'not-motion-safe:flex', 'not-motion-reduce:flex', 'not-portrait:flex',
  'not-landscape:flex', 'not-forced-colors:flex',
  // group-/peer-aria, with /name
  'group-aria-checked:flex', 'group-aria-foo:flex', 'group-aria-[sort=asc]:flex', 'group-aria-checked/x:flex',
  'group-aria-[sort=asc]/x:flex', 'peer-aria-checked:flex', 'peer-aria-[sort=asc]:flex', 'peer-aria-checked/x:flex',
  'group-not-aria-checked:flex', 'group-not-data-active:flex', 'peer-not-aria-checked:flex',
  // stacking
  'hover:not-md:flex', 'not-sm:hover:flex', 'md:not-data-active:flex', 'not-md:not-dark:flex',
  'md:group-aria-checked:flex', 'md:group-aria-checked/x:flex', 'not-supports-[display:grid]:hover:flex',
  'not-max-md:not-aria-checked:flex', 'dark:not-has-[img]:flex',
];

describe('negated and group-aria variants match Tailwind 4.3.3 (#352)', () => {
  const tw = tailwindBuilder();
  it.each(MATCH)('%s', async (cls) => {
    const ours = generateCss(cls, ctx);
    expect(ours).not.toBe('');
    expect(invalidSelectors(ours)).toEqual([]);
    expect(shape(ours)).toEqual(shape(await tw([cls])));
  });
});

describe('negating an unknown or non-negatable inner variant emits nothing (#335, #352)', () => {
  it.each(['not-foo:flex', 'not-starting:flex', 'not-data-:flex', 'not-aria-:flex', 'not-has-foo:flex',
    'not-supports-:flex', 'not-min-md-x:flex', 'group-aria-:flex', 'not-group-foo:flex'])('%s', (cls) => {
    expect(generateCss(cls, ctx)).toBe('');
  });
});

describe('url( in a negated at-rule prelude drops the rule (#335)', () => {
  it('not-supports-[background:url(x)]', () => {
    expect(generateCss('not-supports-[background:url(x)]:flex', ctx)).not.toMatch(/url\s*\(/i);
  });
});
