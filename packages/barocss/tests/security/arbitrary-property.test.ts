import { describe, expect, it } from 'vitest';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #247 review: arbitrary-property values go through the same #224 value guard as every arbitrary value, and no
// arbitrary value may carry a comment token. Generic shapes only.
//   pnpm --filter @barocss/kit exec vitest run tests/security/arbitrary-property.test.ts
const css = (cls: string) => generateCss(cls, createContext({})).trim();
const OPEN = '/' + '*';
const CLOSE = '*' + '/';

describe('arbitrary property value guard', () => {
  it.each(['@x', 'a_@x', '@x_y', '1px_@x'])('[prop:%s] (at-rule token) emits nothing', (v) => {
    expect(css(`[--a:${v}]`)).toBe('');
    expect(css(`[color:${v}]`)).toBe('');
  });

  it.each([OPEN, CLOSE, `a${OPEN}`, `a${CLOSE}`, `${OPEN}a${CLOSE}`])('comment token %s emits nothing', (v) => {
    expect(css(`[--a:${v}]`)).toBe('');
    expect(css(`[color:red${v}]`)).toBe('');
    expect(css(`bg-[${v}]`)).toBe('');
    expect(css(`p-[1px${v}]`)).toBe('');
    expect(css(`hover:bg-[red${v}]`)).toBe('');
  });

  it.each(['1a', '_a', 'a.b', 'a/b', '---', 'a!', '@a', 'A'])('property name %s that is not an ident/custom prop emits nothing', (p) => {
    expect(css(`[${p}:x]`)).toBe('');
  });

  it('valid ident and custom-prop names still work', () => {
    expect(css('[color:red]')).toContain('color: red');
    expect(css('[--a:1px]')).toContain('--a: 1px');
  });
});
