import { compile } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const cases = [
  ['scrollbar-gutter-auto', 'auto'],
  ['scrollbar-gutter-stable', 'stable'],
  ['scrollbar-gutter-both', 'stable both-edges'],
] as const;

describe('Tailwind CSS 4.3.3 scrollbar-gutter utilities', () => {
  it.each(cases)('%s emits the same rule as Tailwind', async (candidate, value) => {
    const compiler = await compile('@tailwind utilities;');
    const reference = compiler.build([candidate]);
    const actual = generateCss(candidate, createContext({ preflight: false }));
    const nodes = normalizeCss(actual);
    expect(nodes).toEqual(normalizeCss(reference));
    expect(nodes).toEqual([{
      type: 'rule',
      selector: expect.any(String),
      nodes: [{ type: 'decl', prop: 'scrollbar-gutter', value }],
    }]);
  });
});
