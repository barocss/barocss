import { compile as compileV4_1_13 } from 'tailwindcss';
import { compile as compileV4_3_3 } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const candidates = [
  'bg-(--custom-color)',
  'bg-(color:--custom-color)',
  'bg-(length:--my-size)',
  'bg-(image:--my-image)',
  'bg-size-(--my-size)',
] as const;

describe('background custom properties in pinned Tailwind CSS versions', () => {
  it.each(candidates)('%s matches both compiler CSS structures', async (candidate) => {
    const barocss = normalizeCss(generateCss(candidate, createContext({ preflight: false })));
    for (const compile of [compileV4_1_13, compileV4_3_3]) {
      const compiler = await compile('@tailwind utilities;');
      expect(barocss).toEqual(normalizeCss(compiler.build([candidate])));
    }
  });
});
