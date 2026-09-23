import { compile } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const cases = [
  ['@container-size', undefined],
  ['@container-size/sidebar', 'sidebar'],
  ['@container-size/card-grid', 'card-grid'],
] as const;

describe('Tailwind CSS 4.3.3 size-container utilities', () => {
  it.each(cases)('%s emits the same rule as Tailwind', async (candidate, name) => {
    const compiler = await compile('@tailwind utilities;');
    const reference = compiler.build([candidate]);
    const actual = generateCss(candidate, createContext({ preflight: false }));
    const nodes = normalizeCss(actual);
    expect(nodes).toEqual(normalizeCss(reference));
    expect(nodes).toEqual([{
      type: 'rule',
      selector: expect.any(String),
      nodes: [
        { type: 'decl', prop: 'container-type', value: 'size' },
        ...(name ? [{ type: 'decl', prop: 'container-name', value: name }] : []),
      ],
    }]);
  });

  it('does not emit a rule for an empty container name', async () => {
    const candidate = '@container-size/';
    const compiler = await compile('@tailwind utilities;');
    expect(normalizeCss(compiler.build([candidate]))).toEqual([]);
    expect(normalizeCss(generateCss(candidate, createContext({ preflight: false })))).toEqual([]);
  });
});
