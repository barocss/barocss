import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #311: not-@[…] and @container-size/<name> go through the same variant/value guards as @[…] (#220/#248/#273).
// A structurally hostile value emits nothing, or one rule inside at most one @container with only its own props.
//   pnpm --filter @barocss/kit exec vitest run tests/security/container-variant-311.test.ts
const BAD_VALUES = [
  'a;b', 'a;', ';a', 'a}b{', 'a{', 'a}', '{a', '}a', 'a)', '(a', 'a)_or_(b', 'a]', "'a", 'a/*', '*/a', 'a,b',
];
const FORMS = [
  (v: string) => `not-@[${v}]:flex`,
  (v: string) => `not-@min-[${v}]:flex`,
  (v: string) => `not-@max-[${v}]/n:flex`,
  (v: string) => `not-@sm/${v}:flex`,
  (v: string) => `@container-size/${v}`,
];

describe('#311 container variants and named container-size keep the block intact', () => {
  const ctx = createContext({ preflight: false });
  it.each(FORMS.flatMap((f) => BAD_VALUES.map((v) => f(v))))('%s', (cls) => {
    const css = generateCss(cls, ctx).trim();
    if (css === '') return;
    const root = postcss.parse(css);
    let rules = 0;
    let containers = 0;
    root.walkRules(() => { rules++; });
    root.walkDecls((d) => { expect(['display', 'container-type', 'container-name'], `${cls} -> ${css}`).toContain(d.prop); });
    root.walkAtRules((a) => {
      expect(a.name, `${cls} -> ${css}`).toBe('container');
      expect(a.params, `${cls} -> ${css}`).not.toMatch(/[;{}]|\/\*/);
      containers++;
    });
    expect(rules, `${cls} -> ${css}`).toBeLessThanOrEqual(1);
    expect(containers, `${cls} -> ${css}`).toBeLessThanOrEqual(1);
  });
});
