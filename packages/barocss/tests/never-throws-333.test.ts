import { describe, expect, it } from 'vitest';
import { createContext } from '../src/core/context';
import { generateCss } from '../src/core/engine';
import { functionalUtility } from '../src/core/registry';
import '../src/presets';

// #333: generation never throws on unusual class input. A colour utility whose theme lookup resolves to a
// palette object (no shade given) emits nothing; a class whose handler throws contributes nothing while
// the other classes still generate.
functionalUtility({ name: 'zz-throws-333', handleBareValue: () => { throw new Error('boom'); } });
const ctx = createContext({ theme: { extend: { colors: { brand: { 500: '#ff0000' } } } } });

describe('#333 kit generateCss never throws', () => {
  it('a colour whose theme lookup is a palette object emits nothing', () => {
    for (const cls of ['text-brand', 'bg-brand', 'from-brand', 'to-brand', 'border-brand', 'fill-brand']) {
      expect(() => generateCss(cls, ctx), cls).not.toThrow();
      expect(generateCss(cls, ctx).trim(), cls).toBe('');
    }
    expect(generateCss('text-brand-500', ctx)).toContain('.text-brand-500');
  });

  it('a throwing class among valid ones leaves the others generated', () => {
    const css = generateCss('p-4 zz-throws-333-1 text-brand underline', ctx);
    expect(css).toContain('.p-4');
    expect(css).toContain('.underline');
    expect(css).not.toContain('zz-throws');
  });
});
