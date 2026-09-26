import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { fontFamily } from '../../src/theme/font-family';
import { colors } from '../../src/theme/colors';
import '../../src/presets';

// #307: default theme data matches Tailwind 4.3.3's theme.css (font-sans, neutral/zinc hue `none`,
// mauve/olive/mist/taupe palettes) and placeholder-<color> matches its `::placeholder` utility.
const themeCss = readFileSync(createRequire(import.meta.url).resolve('tailwindcss/theme.css'), 'utf8');
const ctx = () => createContext({ preflight: false });

function decls(css: string): string[] {
  const out: string[] = [];
  postcss.parse(css).walkDecls((d) => {
    const rule = d.parent?.type === 'rule' ? (d.parent as postcss.Rule).selector : '';
    if (rule !== ':root, :host') out.push(`${d.prop}: ${d.value}`);
  });
  return out.sort();
}

function themeVar(name: string): string {
  const m = themeCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return (m?.[1] ?? '').replace(/\s+/g, ' ').trim();
}

describe('#307 theme values equal Tailwind 4.3.3 theme.css', () => {
  it.each(['sans', 'serif', 'mono'])('font-%s stack', (k) => {
    const expected = themeVar(`font-${k}`).split(',').map((f) => f.trim().replace(/^'|'$/g, ''));
    expect((fontFamily as Record<string, string[]>)[k]).toEqual(expected);
  });

  it('every palette shade equals theme.css', () => {
    const vars = [...themeCss.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)];
    expect(vars.length).toBeGreaterThan(280);
    for (const [, name, shade, value] of vars) {
      expect((colors as Record<string, Record<string, string>>)[name]?.[shade], `${name}-${shade}`).toBe(value.trim());
    }
  });
});

describe('#307 utilities vs Tailwind 4.3.3 compile()', () => {
  const candidates = [
    'font-sans', 'bg-neutral-500', 'text-zinc-50', 'bg-mauve-500', 'text-olive-700', 'border-mist-200', 'fill-olive-600', 'stroke-mist-900', 'bg-taupe-950/50', 'outline-mist-50',
    'placeholder-red-500', 'placeholder-mauve-500/50', 'placeholder-neutral-400', 'placeholder-[#123456]', 'placeholder-transparent',
  ];
  it.each(candidates)('%s matches', async (candidate) => {
    const tw = (await compile(`${themeCss}\n@tailwind utilities;`)).build([candidate]);
    expect(decls(generateCss(candidate, ctx()))).toEqual(decls(tw));
  });

  // ring-/from- compose through BaroCSS's own --baro-* vars (covered by shadow-ring/gradient compat tests);
  // here only the new palette colour must resolve to Tailwind's var.
  it.each([['ring-taupe-400', 'taupe-400'], ['from-mauve-300', 'mauve-300'], ['via-olive-500', 'olive-500'], ['to-mist-700', 'mist-700']])(
    '%s resolves the 4.3 palette var',
    (candidate, key) => {
      expect(generateCss(candidate, ctx())).toContain(`var(--color-${key})`);
    },
  );

  it('placeholder emits a ::placeholder rule', () => {
    expect(generateCss('placeholder-red-500', ctx())).toContain('.placeholder-red-500::placeholder');
  });
});
