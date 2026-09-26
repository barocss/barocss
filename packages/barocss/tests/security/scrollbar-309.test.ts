import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #309: arbitrary/custom-property scrollbar-thumb/track values must not break out of the composite rule.
// A hostile value emits nothing, or only the utility's own declarations inside its own rule.
//   pnpm --filter @barocss/kit exec vitest run tests/security/scrollbar-309.test.ts
const BAD_VALUES = [
  'red;color:red', 'red;', ';red', 'red}.x{color:red', 'red{', 'red}', '{red', '}red',
  'red)', '(red', 'red]', '[red', '(red]', '[red)', "'red", 'red/*', '*/red',
];
const FORMS = [
  (v: string) => `scrollbar-thumb-[${v}]`,
  (v: string) => `scrollbar-track-[color:${v}]`,
  (v: string) => `scrollbar-thumb-(--x${v})`,
  (v: string) => `hover:scrollbar-track-[${v}]/50`,
];
const ALLOWED = new Set(['--baro-scrollbar-thumb', '--baro-scrollbar-track', 'scrollbar-color', 'syntax', 'inherits', 'initial-value']);

describe('#309 scrollbar color values keep the block intact', () => {
  const ctx = createContext({ preflight: false });
  it.each(FORMS.flatMap((f) => BAD_VALUES.map((v) => f(v))))('%s', (cls) => {
    const css = generateCss(cls, ctx).trim();
    if (css === '') return;
    const root = postcss.parse(css);
    const selectors: string[] = [];
    root.walkRules((r) => { selectors.push(r.selector); });
    root.walkDecls((d) => { expect(ALLOWED.has(d.prop), `${cls} -> ${css}`).toBe(true); });
    root.walkAtRules((a) => { expect(['property', 'supports', 'media'], `${cls} -> ${css}`).toContain(a.name); });
    expect(new Set(selectors).size, `${cls} -> ${css}`).toBeLessThanOrEqual(1);
    expect(css).not.toMatch(/\.x\s*\{/);
  });
});
