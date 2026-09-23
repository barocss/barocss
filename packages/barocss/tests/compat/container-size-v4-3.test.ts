import { compile } from 'tailwindcss-v4-3';
import { compile as compileV4_1_13 } from 'tailwindcss';
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

const inlineCases = [
  ['@container', undefined],
  ['@container/sidebar', 'sidebar'],
  ['@container/card-grid', 'card-grid'],
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

describe('Tailwind CSS 4.1.13 and 4.3.3 inline-size containers', () => {
  it.each(inlineCases)('%s emits the same rule as both Tailwind versions', async (candidate, name) => {
    const [oldCompiler, latestCompiler] = await Promise.all([
      compileV4_1_13('@tailwind utilities;'),
      compile('@tailwind utilities;'),
    ]);
    const oldReference = oldCompiler.build([candidate]);
    const latestReference = latestCompiler.build([candidate]);
    const actual = generateCss(candidate, createContext({ preflight: false }));
    const nodes = normalizeCss(actual);
    expect(nodes).toEqual(normalizeCss(oldReference));
    expect(nodes).toEqual(normalizeCss(latestReference));
    expect(nodes).toEqual([{
      type: 'rule',
      selector: expect.any(String),
      nodes: [
        { type: 'decl', prop: 'container-type', value: 'inline-size' },
        ...(name ? [{ type: 'decl', prop: 'container-name', value: name }] : []),
      ],
    }]);
  });
});
