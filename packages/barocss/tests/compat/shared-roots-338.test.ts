import { describe, expect, it } from 'vitest';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

// #338: on a utility root shared by colours and another namespace (border-*: colors + borderWidth), a custom key
// resolves in the namespace that has it, and a key in both follows Tailwind 4.3.3's precedence. Per candidate the
// declared properties (not values: BaroCSS inlines some theme values Tailwind references as vars) are compared
// against a fresh Tailwind 4.3.3 compile of the matching @theme.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/shared-roots-338.test.ts
// Keys: `both` is in colours and the other namespace, `own` only in the other namespace, `hue` only in colours.
const pair = (a: string, b: string) => ({ both: a, own: b });
const theme = {
  extend: {
    colors: { both: '#ff0000', hue: '#00ff00' },
    borderWidth: pair('3px', '5px'),
    outlineWidth: pair('3px', '5px'),
    ringWidth: pair('3px', '5px'),
    ringOffsetWidth: pair('3px', '5px'),
    divideWidth: pair('3px', '5px'),
    fontSize: pair('2rem', '3rem'),
    boxShadow: pair('0 1px 2px black', '0 2px 3px black'),
    insetShadow: pair('inset 0 1px black', 'inset 0 2px black'),
    textShadow: pair('0 1px black', '0 2px black'),
    dropShadow: pair('0 1px black', '0 2px black'),
    textDecorationThickness: pair('3px', '5px'),
    strokeWidth: pair('3', '5'),
  },
};
const vars = (ns: string, a: string, b: string) => `--${ns}-both: ${a}; --${ns}-own: ${b};`;
const tailwindInput = `@theme { --color-both: #ff0000; --color-hue: #00ff00;
  ${vars('border-width', '3px', '5px')} ${vars('outline-width', '3px', '5px')} ${vars('ring-width', '3px', '5px')}
  ${vars('ring-offset-width', '3px', '5px')} ${vars('divide-width', '3px', '5px')} ${vars('text', '2rem', '3rem')}
  ${vars('shadow', '0 1px 2px black', '0 2px 3px black')} ${vars('inset-shadow', 'inset 0 1px black', 'inset 0 2px black')}
  ${vars('text-shadow', '0 1px black', '0 2px black')} ${vars('drop-shadow', '0 1px black', '0 2px black')}
  ${vars('text-decoration-thickness', '3px', '5px')} ${vars('stroke-width', '3', '5')}
}\n@tailwind utilities;`;
const ctx = () => createContext({ preflight: false, theme } as never);

// Declared properties of the candidate's rules, ignoring theme vars, @property and @supports fallbacks.
function props(css: string): string[] {
  const out = new Set<string>();
  postcss.parse(css).walkDecls((d) => {
    const p = d.parent;
    if (p?.type === 'rule' && (p as postcss.Rule).selector === ':root, :host') return;
    for (let a: postcss.Node | undefined = p; a; a = a.parent as postcss.Node | undefined)
      if (a.type === 'atrule' && ['property', 'layer'].includes((a as postcss.AtRule).name)) return;
    out.add(d.prop.replace(/^--tw-/, '--baro-'));
  });
  return [...out].sort();
}

const roots = [
  'border', 'border-t', 'border-r', 'border-b', 'border-l', 'border-s', 'border-e', 'border-bs', 'border-be',
  'outline', 'ring', 'ring-offset', 'divide-x', 'divide-y', 'text', 'shadow', 'inset-shadow', 'text-shadow', 'drop-shadow',
  'decoration', 'stroke',
];

describe('#338 custom theme keys on shared colour roots (Tailwind 4.3.3)', () => {
  for (const key of ['own', 'hue', 'both']) {
    it.each(roots)(`%s-${key} declares the same properties as Tailwind`, async (root) => {
      const candidate = `${root}-${key}`;
      const tailwind = (await compile(tailwindInput)).build([candidate]);
      expect(props(generateCss(candidate, ctx()))).toEqual(props(tailwind));
    });
  }

  // #344: border-x/y are border-inline/block and a borderWidth key reads its var, as Tailwind 4.3.3.
  it.each([
    ['border-x-own', 'border-inline-width: var(--border-width-own)'],
    ['border-x-hue', 'border-inline-color: var(--color-hue)'],
    ['border-x-both', 'border-inline-color: var(--color-both)'],
    ['border-y-own', 'border-block-width: var(--border-width-own)'],
    ['border-y-both', 'border-block-color: var(--color-both)'],
    ['divide-own', null],
    ['divide-hue', 'border-color: var(--color-hue)'],
  ])('%s resolves in the right namespace', (candidate, expected) => {
    const css = generateCss(candidate, ctx());
    if (expected === null) expect(css).toBe('');
    else expect(css.replace(/\s+/g, ' ')).toContain(expected);
  });

  it('a key only in the other namespace uses its value', () => {
    const c = ctx();
    expect(generateCss('border-own', c)).toMatch(/border-width:\s*var\(--border-width-own\)/);
    expect(generateCss('border-t-own', c)).toMatch(/border-top-width:\s*var\(--border-width-own\)/);
    expect(generateCss('outline-own', c)).toMatch(/outline-width:\s*5px/);
    expect(generateCss('ring-own', c)).toMatch(/calc\(5px \+ var\(--baro-ring-offset-width\)\)/);
    expect(generateCss('ring-offset-own', c)).toMatch(/--baro-ring-offset-width:\s*5px/);
    expect(generateCss('decoration-own', c)).toMatch(/text-decoration-thickness:\s*5px/);
    expect(generateCss('stroke-own', c)).toMatch(/stroke-width:\s*5/);
  });

  it('keeps built-in colour and width classes unchanged', () => {
    const c = ctx();
    const has = (cls: string, text: string) => expect(generateCss(cls, c).replace(/\s+/g, ' '), cls).toContain(text);
    has('border-red-500', 'border-color: var(--color-red-500)');
    has('border-2', 'border-width: 2px');
    has('border-t-4', 'border-top-width: 4px');
    has('border-t-red-500', 'border-top-color: var(--color-red-500)');
    has('outline-2', 'outline-width: 2px');
    has('outline-red-500', 'outline-color: var(--color-red-500)');
    has('ring-2', 'calc(2px + var(--baro-ring-offset-width))');
    has('ring-red-500', '--baro-ring-color: var(--color-red-500)');
    has('ring-offset-2', '--baro-ring-offset-width: 2px');
    has('text-lg', 'font-size: var(--text-lg)');
    has('text-red-500', 'color: var(--color-red-500)');
    has('shadow-lg', 'box-shadow');
    has('shadow-red-500', '--baro-shadow-color');
    has('decoration-2', 'text-decoration-thickness: 2px');
    has('decoration-red-500', 'text-decoration-color: var(--color-red-500)');
    has('stroke-2', 'stroke-width: 2');
    has('stroke-red-500', 'stroke: var(--color-red-500)');
    has('divide-x-2', 'calc(2px * var(--baro-divide-x-reverse))');
    has('divide-red-500', 'border-color: var(--color-red-500)');
  });
});
