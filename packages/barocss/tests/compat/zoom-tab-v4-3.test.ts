import { compile } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const supported = [
  ['zoom-0', 'zoom', '0%'],
  ['zoom-75', 'zoom', '75%'],
  ['zoom-125', 'zoom', '125%'],
  ['zoom-[1.1]', 'zoom', '1.1'],
  ['zoom-[80%]', 'zoom', '80%'],
  ['zoom-(--scale)', 'zoom', 'var(--scale)'],
  ['tab-0', 'tab-size', '0'],
  ['tab-2', 'tab-size', '2'],
  ['tab-4', 'tab-size', '4'],
  ['tab-[12px]', 'tab-size', '12px'],
  ['tab-(--size)', 'tab-size', 'var(--size)'],
] as const;

describe('Tailwind CSS 4.3.3 zoom and tab utilities', () => {
  it.each(supported)('%s emits the same rule as Tailwind', async (candidate, prop, value) => {
    const compiler = await compile('@tailwind utilities;');
    const reference = compiler.build([candidate]);
    const barocss = generateCss(candidate, createContext({ preflight: false }));
    const nodes = normalizeCss(barocss);
    expect(nodes).toEqual(normalizeCss(reference));
    expect(nodes).toEqual([{
      type: 'rule',
      selector: expect.any(String),
      nodes: [{ type: 'decl', prop, value }],
    }]);
  });

  it.each(['zoom-1.5', 'zoom-auto', 'tab-1.5', 'tab-none'])('%s does not create a rule', async (candidate) => {
    const compiler = await compile('@tailwind utilities;');
    expect(normalizeCss(compiler.build([candidate]))).toEqual([]);
    expect(normalizeCss(generateCss(candidate, createContext({ preflight: false })))).toEqual([]);
  });
});
