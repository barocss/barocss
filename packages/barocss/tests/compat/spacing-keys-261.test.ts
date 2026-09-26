import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #261: named spacing keys (`theme.extend.spacing.gutter`) resolve to `var(--spacing-gutter)` like Tailwind 4.1.13.
const tailwindInput = `@theme { --spacing: 0.25rem; --spacing-gutter: 2.5rem; }\n@tailwind utilities;`;
const ctx = () => createContext({ preflight: false, theme: { extend: { spacing: { gutter: '2.5rem' } } } });

// Every declaration as "prop: value", ignoring nesting, the theme-variable block and @property.
function decls(css: string): string[] {
  const out: string[] = [];
  postcss.parse(css).walkDecls((d) => {
    const p = d.parent;
    if (p?.type === 'atrule') return;
    if (p?.type === 'rule' && (p as postcss.Rule).selector === ':root, :host') return;
    if (/^--(tw|baro)-/.test(d.prop) && p?.parent?.type === 'atrule') return;
    out.push(`${d.prop}: ${d.value}`.replace(/--tw-/g, '--baro-'));
  });
  return out.sort();
}

const families: Record<string, string[]> = {
  padding: ['p-gutter', 'px-gutter', 'py-gutter', 'ps-gutter', 'pe-gutter', 'pt-gutter', 'pr-gutter', 'pb-gutter', 'pl-gutter'],
  margin: ['m-gutter', 'mx-gutter', 'my-gutter', 'mt-gutter', 'ms-gutter', '-mt-gutter', '-mx-gutter', '-m-gutter'],
  gap: ['gap-gutter', 'gap-x-gutter', 'gap-y-gutter'],
  inset: ['inset-gutter', 'inset-x-gutter', 'inset-y-gutter', 'top-gutter', 'right-gutter', 'bottom-gutter', 'left-gutter', 'start-gutter', 'end-gutter', '-top-gutter', '-inset-x-gutter'],
  space: ['space-x-gutter', 'space-y-gutter', '-space-x-gutter', '-space-y-gutter'],
  sizing: ['size-gutter', 'w-gutter', 'h-gutter', 'min-w-gutter', 'max-w-gutter', 'min-h-gutter', 'max-h-gutter'],
  scroll: ['scroll-m-gutter', 'scroll-mt-gutter', 'scroll-mx-gutter', 'scroll-p-gutter', 'scroll-pt-gutter', 'scroll-px-gutter'],
};

describe('#261 named spacing keys (fresh Tailwind compile per candidate)', () => {
  for (const [family, candidates] of Object.entries(families)) {
    it.each(candidates)(`${family}: %s matches Tailwind declarations`, async (candidate) => {
      const tailwind = (await compile(tailwindInput)).build([candidate]);
      const baro = generateCss(candidate, ctx());
      expect(baro).toContain('var(--spacing-gutter)');
      expect(decls(baro)).toEqual(decls(tailwind));
    });
  }

  it('numeric spacing and built-in keywords are unchanged', () => {
    const c = ctx();
    expect(generateCss('p-4', c)).toContain('padding: calc(var(--spacing) * 4);');
    expect(generateCss('-mt-2', c)).toContain('margin-top: calc(var(--spacing) * -2);');
    expect(generateCss('w-full', c)).toContain('width: 100%;');
    expect(generateCss('m-auto', c)).toContain('margin: auto;');
    expect(generateCss('gap-px', c)).toContain('gap: 1px;');
    expect(generateCss('w-1/2', c)).toContain('width: calc(1/2 * 100%);');
  });

  it('unknown names still emit nothing', () => {
    expect(generateCss('p-nope', ctx())).toBe('');
    expect(generateCss('scroll-m-nope', ctx())).toBe('');
  });

  it('the theme vars define the referenced root var', () => {
    expect(ctx().themeToCssVars()).toMatch(/--spacing-gutter: 2\.5rem;/);
  });
});
