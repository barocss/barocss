import { compile } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const exactCases = [
  'inline-full',
  'inline-auto',
  'inline-px',
  'inline-screen',
  'inline-fit',
  'inline-1/2',
  'inline-[37px]',
  'inline-(--logical-size)',
  'block-full',
  'block-screen',
  'block-lh',
  'block-3/4',
  'block-[12px]',
  'block-(--logical-size)',
] as const;

const context = createContext({ preflight: false });

describe('Tailwind CSS 4.3.3 logical sizing utilities', () => {
  it.each(exactCases)('%s emits the same CSS structure as Tailwind', async (candidate) => {
    const compiler = await compile('@tailwind utilities;');
    const reference = compiler.build([candidate]);
    const actual = generateCss(candidate, context);
    expect(normalizeCss(actual)).toEqual(normalizeCss(reference));
    expect(normalizeCss(actual)).not.toEqual([]);
  });

  it.each([
    ['inline-0', 'inline-size', '0'],
    ['inline-1.5', 'inline-size', '1.5'],
    ['block-24', 'block-size', '24'],
  ])('%s uses the spacing variable', (candidate, property, value) => {
    const actual = generateCss(candidate, context);
    expect(actual).toContain(`${property}: calc(var(--spacing) * ${value})`);
  });

  it('uses the container variable for inline-sm', () => {
    expect(generateCss('inline-sm', context)).toContain('inline-size: var(--container-sm)');
  });

  it('keeps display utilities distinct from logical sizing', () => {
    expect(generateCss('block inline inline-block', context)).toContain('display: block');
    expect(generateCss('block inline inline-block', context)).toContain('display: inline');
    expect(generateCss('block inline inline-block', context)).toContain('display: inline-block');
  });
});
