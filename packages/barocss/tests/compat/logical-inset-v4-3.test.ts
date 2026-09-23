import { compile } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const context = createContext({ preflight: false });
const referenceInput = '@theme inline { --spacing: 0.25rem; } @tailwind utilities;';

const exactCases = [
  'inset-s-0',
  'inset-s-auto',
  'inset-s-full',
  'inset-s-1/2',
  '-inset-s-px',
  'inset-s-[7px]',
  'inset-s-(--offset)',
  'inset-e-px',
  'inset-e-full',
  'inset-e-1/2',
  'inset-e-0',
  'inset-e-(--offset)',
  'inset-bs-auto',
  'inset-bs-px',
  'inset-bs-1/2',
  'inset-bs-0',
  '-inset-bs-1/2',
  'inset-bs-[13px]',
  'inset-be-auto',
  'inset-be-full',
  'inset-be-0',
  '-inset-be-full',
  'inset-be-(--offset)',
] as const;

describe('Tailwind CSS 4.3.3 logical inset utilities', () => {
  it.each(exactCases)('%s emits the same CSS structure as Tailwind', async (candidate) => {
    const compiler = await compile(referenceInput);
    const reference = normalizeCss(compiler.build([candidate]));
    const actual = normalizeCss(generateCss(candidate, context));
    expect(actual).toEqual(reference);
    expect(actual).not.toEqual([]);
  });

  it.each([
    ['inset-bs-2', 'inset-block-start', '2'],
    ['inset-e-4', 'inset-inline-end', '4'],
    ['-inset-e-2', 'inset-inline-end', '-2'],
    ['inset-be-8', 'inset-block-end', '8'],
  ])('%s uses the spacing variable', (candidate, property, value) => {
    expect(generateCss(candidate, context)).toContain(
      `${property}: calc(var(--spacing) * ${value})`,
    );
  });

  it('keeps the existing inset and start utilities', () => {
    expect(generateCss('inset-2', context)).toContain('inset: calc(var(--spacing) * 2)');
    expect(generateCss('start-2', context)).toContain('inset-inline-start:');
  });
});
