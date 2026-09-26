import { describe, expect, it } from 'vitest';
import { createContext } from '../src/core/context';
import { generateCss, generateCssRules } from '../src/core/engine';
import '../src/presets';

// #406: !important never lands inside @property descriptor blocks (the browser would drop the whole rule).
describe('#406 important modifier and descriptor at-rules', () => {
  it.each(['!via-red-500', 'via-red-500!', '!rotate-45', '!shadow-md'])('%s keeps @property descriptors plain', (cls) => {
    const ctx = createContext({});
    const rules = generateCssRules(cls, ctx).flatMap((r) => [...(r.rootCssList ?? []), ...(r.cssList ?? [])]);
    const css = generateCss(cls, ctx) + '\n' + rules.join('\n');
    const blocks = css.match(/@property[^{]*\{[^}]*\}/g) ?? [];
    for (const b of blocks) expect(b).not.toContain('!important');
    expect(css).toContain('!important');
  });
});
