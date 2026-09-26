import { describe, expect, it } from 'vitest';
import { ServerRuntime } from '../src/index';

describe('ServerRuntime', () => {
  const runtime = new ServerRuntime();

  it('returns empty CSS for empty and whitespace-only input', () => {
    expect(runtime.generateCss('')).toBe('');
    expect(runtime.generateCss('   ')).toBe('');
    expect(runtime.generateCssForClasses([])).toEqual([]);
    expect(runtime.generateCssForClasses([''])).toEqual([{ className: '', css: '' }]);
  });

  it('generates CSS for every class in a whitespace-separated string', () => {
    const css = runtime.generateCss('p-4 m-2');
    expect(css).toContain('.p-4');
    expect(css).toContain('.m-2');
  });

  it('includes shared root rules once when generating multiple classes', () => {
    const css = runtime.generateCss('translate-full -translate-full');

    expect(css).toContain('.translate-full');
    expect(css).toContain('.-translate-full');
    expect(css.match(/@property --baro-translate-x/g)).toHaveLength(1);
    expect(css.match(/@property --baro-translate-y/g)).toHaveLength(1);
  });

  it('defines every theme colour var its standalone output references (#228)', () => {
    const css = new ServerRuntime({ theme: { extend: { colors: { brand: '#ff3366' } } } })
      .generateCss('bg-red-500 text-blue-500/50 border-red-500 bg-brand');
    const refs = [...css.matchAll(/var\((--color-[\w-]+)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const name of refs) expect(css).toMatch(new RegExp(`${name}:\\s*[^;]+;`));
    expect(css).toContain('--color-brand: #ff3366;');
    expect(css).not.toContain('--color-green-500');
  });

  it('bracketed and decimal alpha on theme colours emit valid percentages (#236)', () => {
    const css = runtime.generateCss('bg-red-500/[37%] bg-red-500/[0.5] text-blue-500/[.8]');
    expect(css).toContain('var(--color-red-500) 37%');
    expect(css).toContain('var(--color-red-500) 50%');
    expect(css).toContain('var(--color-blue-500) 80%');
    expect(css).not.toMatch(/\]%/);
    expect(css).toMatch(/--color-red-500:\s*[^;]+;/);
  });
});
