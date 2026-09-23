import { compile } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss, generateCssRules } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const input = '@theme inline { --color-red-500: #ef4444; } @tailwind utilities;';
const context = () => createContext({ preflight: false, theme: { colors: { red: { 500: '#ef4444' } } } });

const cases = [
  'scrollbar-thumb-red-500',
  'scrollbar-thumb-red-500/50',
  'scrollbar-thumb-transparent',
  'scrollbar-thumb-current',
  'scrollbar-thumb-[#123456]',
  'scrollbar-track-red-500',
  'scrollbar-track-red-500/25',
  'scrollbar-track-transparent',
  'scrollbar-track-(--track-color)',
] as const;

describe('Tailwind CSS 4.3.3 scrollbar colors', () => {
  it.each(cases)('%s emits the same class declarations and property defaults', async (candidate) => {
    const compiler = await compile(input);
    const reference = normalizeCss(compiler.build([candidate]));
    const barocss = normalizeCss(generateCss(candidate, context()));
    const classRule = (nodes: typeof reference) => nodes.find((node) => node.type === 'rule' && node.selector?.includes('scrollbar-'));
    expect(classRule(barocss)).toEqual(classRule(reference));
    for (const name of ['--tw-scrollbar-thumb', '--tw-scrollbar-track']) {
      const property = barocss.find((node) => node.type === 'atrule' && node.name === 'property' && node.params === name);
      expect(property?.nodes).toEqual([
        { type: 'decl', prop: 'syntax', value: '"<color>"' },
        { type: 'decl', prop: 'inherits', value: 'false' },
        { type: 'decl', prop: 'initial-value', value: '#0000' },
      ]);
    }
    const fallback = (nodes: typeof reference) => nodes.find((node) => node.type === 'atrule' && node.name === 'layer' && node.params === 'properties' && node.nodes?.length);
    expect(fallback(barocss)).toEqual(fallback(reference));
    expect(barocss).not.toEqual(reference);
  });

  it('deduplicates property defaults when thumb and track classes are combined', () => {
    const css = generateCss('scrollbar-thumb-red-500 scrollbar-track-red-500', context());
    expect(css.match(/@property --tw-scrollbar-thumb \{/g)).toHaveLength(1);
    expect(css.match(/@property --tw-scrollbar-track \{/g)).toHaveLength(1);
    expect(css.match(/@layer properties \{/g)).toHaveLength(1);
    expect(css).toContain('--tw-scrollbar-thumb: #ef4444;');
    expect(css).toContain('--tw-scrollbar-track: #ef4444;');
  });

  it('includes registered defaults in the per-class runtime output', () => {
    const [result] = generateCssRules('scrollbar-thumb-red-500', context());
    expect(result.css).toContain('scrollbar-color: var(--tw-scrollbar-thumb) var(--tw-scrollbar-track);');
    expect(result.rootCss).toContain('@property --tw-scrollbar-thumb');
    expect(result.rootCss).toContain('@property --tw-scrollbar-track');
    expect(result.rootCss).toContain('@layer properties');
  });

  it('does not invent an unknown named color', async () => {
    const candidate = 'scrollbar-thumb-never';
    const compiler = await compile(input);
    expect(normalizeCss(compiler.build([candidate]))).toEqual([]);
    expect(normalizeCss(generateCss(candidate, context()))).toEqual([]);
  });
});
