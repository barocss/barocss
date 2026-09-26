import { describe, expect, it } from 'vitest';
import { ServerRuntime } from '../src/index';

// #300: new theme keys create utilities through ServerRuntime, with their theme vars defined (#267).
const theme = {
  extend: {
    borderRadius: { card: '1.25rem' },
    fontFamily: { display: ['Inter', 'sans-serif'] },
    boxShadow: { card: '0 2px 4px rgb(0 0 0 / 0.2)' },
    fontSize: { hero: ['4rem', { lineHeight: '1.1' }] },
    blur: { huge: '100px' },
    container: { prose2: '70ch' },
  },
};

describe('#300 ServerRuntime new theme keys', () => {
  const runtime = new ServerRuntime({ theme } as never);

  it('generates utilities for new keys and defines every referenced theme var', () => {
    const css = runtime.generateCss('rounded-card rounded-t-card font-display shadow-card text-hero blur-huge max-w-prose2');
    expect(css).toContain('border-radius: var(--radius-card)');
    expect(css).toContain('border-top-left-radius: var(--radius-card)');
    expect(css).toContain('font-family: var(--font-display)');
    expect(css).toContain('0 2px 4px var(--baro-shadow-color, rgb(0 0 0 / 0.2))');
    expect(css).toContain('font-size: var(--text-hero)');
    expect(css).toContain('line-height: var(--baro-leading, var(--text-hero--line-height))');
    expect(css).toContain('max-width: var(--container-prose2)');
    for (const [, name] of css.matchAll(/var\((--(?:radius|font|text|blur|container)-[\w-]+)/g))
      expect(css, name).toMatch(new RegExp(`${name}:\\s*[^;]+;`));
    expect(css).toMatch(/--text-hero--line-height:\s*1\.1;/);
  });

  it('emits nothing for unknown keys', () => {
    expect(runtime.generateCss('rounded-nope font-nope shadow-nope text-nope blur-nope max-w-nope')).toBe('');
  });
});
