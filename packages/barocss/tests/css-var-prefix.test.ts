import { describe, expect, it } from 'vitest';
import '../src/presets';
import { createContext } from '../src/core/context';
import { generateCss } from '../src/core/engine';
import { jsonToAst } from '../src/core/jsonToAst';

// #222 companion mode: next to a Tailwind build, cssVarPrefix: 'tw' makes the runtime's composite
// variables the build's own --tw-* names, so a build class and a runtime class compose on one element.
const COMPOSITES: [string, string[]][] = [
  ['shadow-md', ['--tw-shadow:', 'var(--tw-ring-shadow)', '@property --tw-shadow']],
  ['ring-2', ['--tw-ring-shadow:', 'var(--tw-shadow)']],
  ['inset-shadow-sm', ['--tw-inset-shadow:']],
  ['translate-x-2', ['--tw-translate-x:', 'var(--tw-translate-y)']],
  ['scale-x-50', ['--tw-scale-x:', 'var(--tw-scale-y)']],
  ['skew-x-3', ['--tw-skew-x:']],
  ['rotate-x-12', ['--tw-rotate-x:']],
  ['grayscale', ['--tw-grayscale:', 'var(--tw-blur']],
  ['backdrop-blur-sm', ['--tw-backdrop-blur:', 'var(--tw-backdrop-grayscale']],
  ['from-red-500', ['--tw-gradient-from:', '--tw-gradient-stops:', '@property --tw-gradient-from']],
  ['border-2', ['var(--tw-border-style)', '@property --tw-border-style']],
  ['border-dashed', ['--tw-border-style: dashed']],
  ['outline-2', ['var(--tw-outline-style)']],
];

describe('cssVarPrefix (#222)', () => {
  it.each(COMPOSITES)('%s uses --tw-* names with cssVarPrefix: "tw"', (cls, expected) => {
    const css = generateCss(cls, createContext({ cssVarPrefix: 'tw' }));
    for (const e of expected) expect(css).toContain(e);
    expect(css).not.toContain('--baro-');
  });

  it.each(['tw', '--tw', '--tw-', ' tw '])('normalizes prefix %j', (prefix) => {
    const css = generateCss('ring-2', createContext({ cssVarPrefix: prefix }));
    expect(css).toContain('--tw-ring-shadow');
    expect(css).not.toContain('--baro-');
  });

  it('keeps --baro-* by default and for "baro"', () => {
    for (const ctx of [createContext({}), createContext({ cssVarPrefix: 'baro' }), createContext({ cssVarPrefix: '' })]) {
      const css = generateCss('shadow-md ring-2 translate-x-2 border-2', ctx);
      expect(css).toContain('--baro-shadow');
      expect(css).not.toContain('--tw-');
    }
  });

  it('does not leak between contexts sharing a class', () => {
    const tw = createContext({ cssVarPrefix: 'tw', clearCacheOnContextChange: false });
    const baro = createContext({ clearCacheOnContextChange: false });
    expect(generateCss('shadow-md', tw)).toContain('--tw-shadow');
    expect(generateCss('shadow-md', baro)).toContain('--baro-shadow');
    expect(generateCss('shadow-md', tw)).not.toContain('--baro-');
  });
});

describe('cssVarPrefix through jsonToAst (#222)', () => {
  it('JSON input gets the same --tw-* composites as class input', () => {
    const tw = JSON.stringify(jsonToAst({ utility: { name: 'ring', value: '2' } }, createContext({ cssVarPrefix: 'tw' })));
    expect(tw).toContain('--tw-ring-shadow');
    expect(tw).not.toContain('--baro-');
    const def = JSON.stringify(jsonToAst({ utility: { name: 'ring', value: '2' } }, createContext({})));
    expect(def).toContain('--baro-ring-shadow');
  });
});
