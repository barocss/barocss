import { compile } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const context = createContext({ preflight: false });

const exactCases = [
  'pbs-0',
  'pbs-px',
  'pbs-[13px]',
  'pbs-(--gap)',
  'pbe-0',
  'pbe-px',
  'pbe-[3px]',
  'pbe-(--gap)',
  'mbs-0',
  'mbs-auto',
  'mbs-px',
  '-mbs-px',
  'mbs-[17px]',
  'mbs-(--gap)',
  'mbe-0',
  'mbe-auto',
  'mbe-px',
  '-mbe-px',
] as const;

describe('Tailwind CSS 4.3.3 logical padding and margin', () => {
  it.each(exactCases)('%s emits the same CSS structure as Tailwind', async (candidate) => {
    const compiler = await compile('@theme inline { --spacing: 0.25rem; } @tailwind utilities;');
    const reference = normalizeCss(compiler.build([candidate]));
    const actual = normalizeCss(generateCss(candidate, context));
    expect(actual).toEqual(reference);
    expect(actual).not.toEqual([]);
  });

  it.each([
    ['pbs-4', 'padding-block-start', '4'],
    ['pbe-8', 'padding-block-end', '8'],
    ['mbs-6', 'margin-block-start', '6'],
    ['-mbs-6', 'margin-block-start', '-6'],
    ['mbe-2', 'margin-block-end', '2'],
  ])('%s uses the spacing variable', (candidate, property, value) => {
    const actual = generateCss(candidate, context);
    expect(actual).toContain(`${property}: calc(var(--spacing) * ${value})`);
  });

  it('does not emit an invalid padding value', async () => {
    const candidate = 'pbs-auto';
    const compiler = await compile('@tailwind utilities;');
    expect(normalizeCss(compiler.build([candidate]))).toEqual([]);
    expect(normalizeCss(generateCss(candidate, context))).toEqual([]);
  });
});
