import { compile } from 'tailwindcss-v4-3';
import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { normalizeCss } from './normalize';

const candidates = [
  'font-features-["tnum"]',
  "font-features-['smcp','onum']",
  'font-features-(--my-features)',
] as const;

describe('Tailwind CSS 4.3.3 font feature settings', () => {
  it.each(candidates)('%s has the same CSS structure', async (candidate) => {
    const compiler = await compile('@tailwind utilities;');
    const reference = normalizeCss(compiler.build([candidate]));
    const barocss = normalizeCss(generateCss(candidate, createContext({ preflight: false })));
    expect(barocss).toEqual(reference);
  });

  it('keeps the feature declaration inside a responsive variant', () => {
    const css = generateCss("md:font-features-['smcp']", createContext({ preflight: false }));
    expect(css).toContain('@media (min-width: 48rem)');
    expect(css).toContain("font-feature-settings: 'smcp';");
    expect(css).not.toContain('font-family:');
  });

  it('does not turn an unknown named feature into a font family', async () => {
    const candidate = 'font-features-unknown';
    const compiler = await compile('@tailwind utilities;');
    expect(normalizeCss(compiler.build([candidate]))).toEqual([]);
    expect(normalizeCss(generateCss(candidate, createContext({ preflight: false })))).toEqual([]);
  });
});
