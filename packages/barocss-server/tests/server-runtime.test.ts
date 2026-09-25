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
});
