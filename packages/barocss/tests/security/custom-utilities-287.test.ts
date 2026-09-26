/** #287: config.utilities names and declarations are validated; unsafe entries are skipped whole. */
import { describe, expect, it } from 'vitest';
import { createContext, validateCustomUtility } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

describe('#287 custom utility validation (security)', () => {
  it.each(['a{b', 'a}b', 'x,y', 'x y', '.x', 'x:hover', 'x[y]', 'a/*', '*', '', '1abc', 'x>y', 'x;y'])('rejects name %j', (name) => {
    expect(validateCustomUtility(name, { color: 'red' })).toBeNull();
    const css = generateCss('ok', createContext({ utilities: { [name]: { color: 'red' }, ok: { color: 'blue' } } }));
    expect(css).not.toContain('red');
  });
  it.each([
    [{ 'color;x': 'red' }], [{ 'col or': 'red' }], [{ '{color': 'red' }],
    [{ color: 'red; } body { color: blue' }], [{ color: 'red }' }], [{ color: 'a /* x' }],
    [{ color: '' }], [{ color: { a: 1 } }], [{ color: ['red'] }],
  ])('rejects unsafe declarations %j', (decls) => {
    expect(validateCustomUtility('bad', decls)).toBeNull();
    const c = createContext({ utilities: { bad: decls as never } });
    expect(generateCss('bad', c)).toBe('');
  });
  it('ignores non-object config values', () => {
    expect(() => createContext({ utilities: 'x' as never })).not.toThrow();
    expect(() => createContext({ utilities: [] as never })).not.toThrow();
    expect(validateCustomUtility('x', null)).toBeNull();
  });
});
