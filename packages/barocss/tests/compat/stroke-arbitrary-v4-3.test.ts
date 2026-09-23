import { compile as compileV4_1_13 } from 'tailwindcss';
import { compile as compileV4_3_3 } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const candidates = [
  'stroke-[3px]',
  'stroke-[1.5px]',
  'stroke-[2rem]',
  'stroke-[50%]',
  'stroke-[length:var(--stroke-width)]',
  'stroke-[rebeccapurple]',
  'stroke-[color:var(--stroke-color)]',
] as const;

describe('arbitrary SVG stroke widths and colors', () => {
  it.each(candidates)('%s matches both pinned Tailwind compilers', async (candidate) => {
    const barocss = normalizeCss(generateCss(candidate, createContext({ preflight: false })));
    for (const compile of [compileV4_1_13, compileV4_3_3]) {
      const compiler = await compile('@tailwind utilities;');
      expect(barocss).toEqual(normalizeCss(compiler.build([candidate])));
    }
  });

  it('keeps an arbitrary width under the hover media rule', async () => {
    const candidate = 'hover:stroke-[3px]';
    const barocss = normalizeCss(generateCss(candidate, createContext({ preflight: false })));
    const compiler = await compileV4_3_3('@tailwind utilities;');
    expect(barocss).toEqual(normalizeCss(compiler.build([candidate])));
  });
});
