import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { preflightFullCSS, preflightStandardCSS } from '../../src/css/preflight';
import '../../src/presets';

// #228: theme colours reference `var(--color-*)` like Tailwind 4.1.13, so runtime theme overrides apply.
const tailwindInput = `@theme { --color-brand: #ff3366; --color-red-500: #ef4444; }\n@tailwind utilities;`;
const ctx = () => createContext({ preflight: false, theme: { extend: { colors: { brand: '#ff3366', red: { 500: '#ef4444' } } } } });

// Every declaration as "prop: value", in order, ignoring rule nesting and the theme-variable block.
function decls(css: string): string[] {
  const out: string[] = [];
  postcss.parse(css).walkDecls((d) => {
    const rule = d.parent?.type === 'rule' ? (d.parent as postcss.Rule).selector : '';
    if (rule !== ':root, :host') out.push(`${d.prop}: ${d.value}`);
  });
  return out.sort();
}

describe('#228 theme colour vars (fresh Tailwind compile per candidate)', () => {
  it.each(['bg-brand', 'bg-red-500', 'text-brand', 'border-brand', 'border-l-brand', 'outline-brand', 'decoration-brand', 'bg-brand/50', 'text-red-500/25', 'border-brand/50'])(
    '%s matches Tailwind declarations',
    async (candidate) => {
      const tailwind = (await compile(tailwindInput)).build([candidate]);
      expect(decls(generateCss(candidate, ctx()))).toEqual(decls(tailwind));
    },
  );

  it('bg-brand references the var so a runtime override applies', () => {
    expect(generateCss('bg-brand', ctx())).toContain('background-color: var(--color-brand);');
  });
});

describe('#228 preflight form-control reset', () => {
  it.each([['standard', preflightStandardCSS], ['full', preflightFullCSS]])('%s matches Tailwind 4.1.13 rules', (_level, css) => {
    const root = postcss.parse(css);
    const rules = root.nodes.filter((n): n is postcss.Rule => n.type === 'rule');
    const reset = rules.filter((r) => r.selector.replace(/\s+/g, '') === 'button,input,select,optgroup,textarea,::file-selector-button').pop();
    expect(reset?.nodes.map((d) => (d as postcss.Declaration).toString())).toEqual([
      'font: inherit', 'font-feature-settings: inherit', 'font-variation-settings: inherit', 'letter-spacing: inherit',
      'color: inherit', 'border-radius: 0', 'background-color: transparent', 'opacity: 1',
    ]);
    expect(css).toContain('::placeholder {\n  opacity: 1;\n}');
    expect(css).toContain('color: color-mix(in oklab, currentcolor 50%, transparent);');
    expect(css).toContain('textarea {\n  resize: vertical;\n}');
    // Appended last, so the earlier normalize-style `line-height: 1.15` is overridden by `font: inherit`.
    expect(css.lastIndexOf('line-height: 1.15')).toBeLessThan(css.indexOf('form-control reset'));
  });
});
