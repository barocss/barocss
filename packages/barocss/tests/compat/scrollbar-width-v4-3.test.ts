import { compile } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const supported = [
  ['scrollbar-auto', 'auto'],
  ['scrollbar-thin', 'thin'],
  ['scrollbar-none', 'none'],
] as const;

describe('Tailwind CSS 4.3.3 scrollbar-width utilities', () => {
  it.each(supported)('%s emits the same rule as Tailwind', async (candidate, value) => {
    const compiler = await compile('@tailwind utilities;');
    const reference = compiler.build([candidate]);
    const actual = generateCss(candidate, createContext({ preflight: false }));
    const nodes = normalizeCss(actual);
    expect(nodes).toEqual(normalizeCss(reference));
    expect(nodes).toEqual([{
      type: 'rule',
      selector: expect.any(String),
      nodes: [{ type: 'decl', prop: 'scrollbar-width', value }],
    }]);
  });

  it('does not emit an unsupported arbitrary width', async () => {
    const candidate = 'scrollbar-[3px]';
    const compiler = await compile('@tailwind utilities;');
    expect(normalizeCss(compiler.build([candidate]))).toEqual([]);
    expect(normalizeCss(generateCss(candidate, createContext({ preflight: false })))).toEqual([]);
  });
});
