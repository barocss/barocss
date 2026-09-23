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
});
