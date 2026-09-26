import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #311: Tailwind 4.3 @container-size, not-@<size> container variants, scroll-pbs/pbe/mbs/mbe and border-s/e,
// compared per candidate against a fresh Tailwind 4.3.3 compile.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/container-43-311.test.ts
const tailwindInput = `@theme { --spacing: 0.25rem; --spacing-gutter: 2.5rem; --color-red-500: oklch(63.7% 0.237 25.331); --container-sm: 24rem; }\n@tailwind utilities;`;
const ctx = () => createContext({ preflight: false, theme: { extend: { spacing: { gutter: '2.5rem' } } } });

// Every declaration as "[@container params] prop: value", ignoring theme vars, @property, @supports and layers.
function decls(css: string): string[] {
  const out: string[] = [];
  postcss.parse(css).walkDecls((d) => {
    const p = d.parent;
    if (p?.type === 'rule' && (p as postcss.Rule).selector === ':root, :host') return;
    if (/^--(tw|baro)-/.test(d.prop)) return;
    let container = '';
    let a: postcss.Node | undefined = p;
    while (a) {
      if (a.type === 'atrule') {
        const at = a as postcss.AtRule;
        if (['property', 'supports', 'layer'].includes(at.name)) return;
        if (at.name === 'container') container = `@container ${at.params} `;
      }
      a = a.parent as postcss.Node | undefined;
    }
    out.push(`${container}${d.prop}: ${d.value}`.replace(/--tw-/g, '--baro-'));
  });
  return out.sort();
}

const families: Record<string, string[]> = {
  container: [
    '@container', '@container/main', '@container-normal', '@container-normal/x', '@container-size', '@container-size/main',
  ],
  'container variants': [
    '@sm:flex', '@max-sm:flex', 'not-@sm:flex', 'not-@max-sm:flex', 'not-@sm/main:flex', 'not-@max-sm/main:flex',
    'not-@[10px]:flex', 'not-@min-[5rem]:flex', 'not-@max-[30rem]:flex',
  ],
  'scroll-padding': ['scroll-pbs-4', 'scroll-pbs-gutter', 'scroll-pbe-[3px]', 'scroll-pbs-2.5', 'scroll-pbe-(--x)'],
  'scroll-margin': [
    'scroll-mbs-4', '-scroll-mbe-2', '-scroll-mbs-4', 'scroll-mbs-gutter', 'scroll-mbe-[3px]', 'scroll-mbs-(--x)',
  ],
  border: [
    'border-s', 'border-e', 'border-s-2', 'border-e-0', 'border-s-[3px]', 'border-e-red-500', 'border-s-red-500/50',
    'border-e-(--x)',
  ],
};

describe('#311 Tailwind 4.3 container / scroll / border logical utilities (fresh Tailwind 4.3.3 compile)', () => {
  for (const [family, candidates] of Object.entries(families)) {
    it.each(candidates)(`${family}: %s matches Tailwind`, async (candidate) => {
      const tailwind = (await compile(tailwindInput)).build([candidate]);
      const baro = generateCss(candidate, ctx());
      expect(decls(tailwind).length).toBeGreaterThan(0);
      expect(decls(baro)).toEqual(decls(tailwind));
    });
  }

  it.each(['not-@container:flex', 'not-@nope:flex', 'border-separate', 'border-solid'])(
    '%s behaves like Tailwind',
    async (candidate) => {
      const tailwind = (await compile(tailwindInput)).build([candidate]);
      expect(decls(generateCss(candidate, ctx()))).toEqual(decls(tailwind));
    },
  );
});
