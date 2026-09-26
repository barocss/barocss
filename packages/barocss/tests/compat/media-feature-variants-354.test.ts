import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { invalidSelectors, tailwindBuilder } from './parity-compare';

// #354: at-rule-led not-[@…], contrast-more/-less, noscript and named supports-<feature>, compared with
// Tailwind 4.3.3 compile(): the wrapping at-rules (outer to inner) and the rule selector.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/media-feature-variants-354.test.ts
const ctx = createContext({ preflight: false });

const norm = (s: string) => s.replace(/\(width >= ([^)]+)\)/g, '(min-width: $1)').replace(/\s+/g, ' ').trim();

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
  // not-[@media|@supports|@container …]
  'not-[@media_print]:flex', 'not-[@media_not_print]:flex', 'not-[@media(hover:hover)]:flex',
  'not-[@media_screen_and_(min-width:10px)]:flex', 'not-[@media_only_screen]:flex',
  'not-[@supports(display:grid)]:flex', 'not-[@supports_(display:grid)]:flex', 'not-[@supports_not_(display:grid)]:flex',
  'not-[@container_(min-width:10px)]:flex', 'not-[@container_x_(min-width:10px)]:flex',
  'not-[@container_not_(min-width:10px)]:flex', 'not-[@container_x_not_(min-width:10px)]:flex',
  'not-[@media_print]:hover:flex', 'hover:not-[@media_print]:flex', 'md:not-[@media_print]:flex',
  // contrast / scripting built-ins
  'contrast-more:flex', 'contrast-less:flex', 'noscript:flex', 'not-contrast-more:flex', 'not-noscript:flex',
  'contrast-more:hover:flex', 'motion-safe:contrast-more:flex', 'noscript:print:flex',
  // supports-<feature> and supports-[…]
  'supports-grid:flex', 'supports-display:flex', 'supports-foo-bar:flex', 'not-supports-grid:flex',
  'supports-[display]:flex', 'supports-[--x]:flex', 'supports-[display:grid]:flex', 'supports-[(display:grid)]:flex',
  'supports-[selector(a>b)]:flex', 'md:supports-grid:flex',
];

describe('media and feature variants match Tailwind 4.3.3 (#354)', () => {
  const tw = tailwindBuilder();
  it.each(MATCH)('%s', async (cls) => {
    const ours = generateCss(cls, ctx);
    expect(ours).not.toBe('');
    expect(invalidSelectors(ours)).toEqual([]);
    expect(shape(ours)).toEqual(shape(await tw([cls])));
  });

});

// Any other at-rule-led bracket form: Tailwind emits nothing (or an invalid empty `@media not`); so does BaroCSS,
// instead of a `:not(@…)` selector.
describe('other at-rule-led not-[@…] forms emit nothing (#354)', () => {
  it.each([
    'not-[@media]:flex', 'not-[@supports]:flex', 'not-[@container]:flex', 'not-[@media_print,screen]:flex',
    'not-[@page]:flex', 'not-[@starting-style]:flex', 'not-[@layer_x]:flex', 'not-[@scope_(.a)]:flex',
    'not-[@foo_bar]:flex', 'not-[@MEDIA_print]:flex', 'not-[@mediaprint]:flex', 'not-[@]:flex',
    'group-not-[@media_print]:flex', 'peer-not-[@media_print]:flex',
  ])('%s', (cls) => {
    expect(generateCss(cls, ctx)).toBe('');
  });
});

describe('existing guards still reject at-rule-led not-[@…] (#220, #273, #332, #335)', () => {
  it.each([
    'not-[@media_(a:b]:flex', 'not-[@media_(a:b))]:flex', 'not-[@media_print{}]:flex', 'not-[@media_print;]:flex',
    'not-[@media_/*x*/print]:flex', 'not-[@supports_(background:url(x))]:flex',
  ])('%s', (cls) => {
    const css = generateCss(cls, ctx);
    expect(css).not.toMatch(/url\s*\(|\/\*|\{\s*\}/i);
    expect(css.trim()).toBe('');
  });
});
