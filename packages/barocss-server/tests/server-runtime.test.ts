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

  it('skips self-referencing theme root vars but keeps the utility reference (#260)', () => {
    const css = new ServerRuntime({
      theme: { extend: { colors: { brand: { 600: 'var(--color-brand-600)', 700: 'var(--color-brand-700, #111)', 800: '#222' } } } },
    }).generateCss('bg-brand-600 text-brand-700 border-brand-800');
    expect(css).toContain('var(--color-brand-600)');
    expect(css).not.toMatch(/--color-brand-600:/);
    expect(css).not.toMatch(/--color-brand-700:/);
    expect(css).toContain('--color-brand-800: #222;');
  });

  it('bracketed and decimal alpha on theme colours emit valid percentages (#236)', () => {
    const css = runtime.generateCss('bg-red-500/[37%] bg-red-500/[0.5] text-blue-500/[.8]');
    expect(css).toContain('var(--color-red-500) 37%');
    expect(css).toContain('var(--color-red-500) 50%');
    expect(css).toContain('var(--color-blue-500) 80%');
    expect(css).not.toMatch(/\]%/);
    expect(css).toMatch(/--color-red-500:\s*[^;]+;/);
  });

  it('defines every referenced theme var, not only colours (#267)', () => {
    const css = runtime.generateCss('rounded-lg text-xl shadow-md max-w-md font-sans ease-in-out aspect-video p-4');
    const refs = [...new Set([...css.matchAll(/var\((--(?:radius|text|shadow|container|font|ease|aspect|spacing)[\w-]*)/g)].map((m) => m[1]))];
    expect(refs.length).toBeGreaterThan(3);
    for (const name of refs) expect(css, name).toMatch(new RegExp(`${name}:\\s*[^;]+;`));
    expect(css.match(/:root,:host \{/g)).toHaveLength(1);
  });

  it('emits each :root and @property block once across generateCssForClasses (#267)', () => {
    const sheet = runtime
      .generateCssForClasses(['bg-red-500', 'text-red-500', 'translate-x-2', 'translate-y-2', 'shadow-md', 'shadow-lg', 'ring-2'])
      .map((x) => x.css).filter(Boolean).join('\n');
    expect(sheet.match(/:root,:host \{/g)).toHaveLength(1);
    const props = [...sheet.matchAll(/@property (--[\w-]+)/g)].map((m) => m[1]);
    expect(props.length).toBeGreaterThan(0);
    expect(new Set(props).size).toBe(props.length);
    expect(sheet).toMatch(/--color-red-500:/);
  });

  it('keeps Tailwind variant order: base < sm < lg whatever the input order (#267)', () => {
    const css = runtime.generateCss('lg:px-8 sm:px-6 px-4');
    const base = css.indexOf('.px-4'), sm = css.indexOf('.sm\\:px-6'), lg = css.indexOf('.lg\\:px-8');
    expect(base).toBeGreaterThan(-1);
    expect(base).toBeLessThan(sm);
    expect(sm).toBeLessThan(lg);
    const joined = runtime.generateCssForClasses(['lg:px-8', 'sm:px-6', 'px-4']).map((x) => x.css).join('\n');
    expect(joined.indexOf('.px-4')).toBeGreaterThan(-1);
    expect(joined.indexOf('.px-4')).toBeLessThan(joined.indexOf('.sm\\:px-6'));
    expect(joined.indexOf('.sm\\:px-6')).toBeLessThan(joined.indexOf('.lg\\:px-8'));
  });

  it('leaves simple class output otherwise unchanged (#267)', () => {
    expect(runtime.generateCss('block')).toBe('.block {\n  display: block;\n}\n');
    expect(runtime.generateCssForClasses(['block', 'hidden'])).toEqual([
      { className: 'block', css: runtime.generateCss('block') },
      { className: 'hidden', css: runtime.generateCss('hidden') },
    ]);
  });
});
