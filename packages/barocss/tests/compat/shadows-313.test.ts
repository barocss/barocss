import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { effective, runParity, tailwindBuilder } from './parity-compare';
import '../../src/presets';

// #313: text-shadow-*, drop-shadow-* sizes/colours, shadow size + colour composition, /[x%] and /(--o)
// opacity on named shadows, shadow-inner, checked against tailwindcss 4.3.3.
//   pnpm --filter @barocss/kit exec vitest run tests/compat/shadows-313.test.ts
const SINGLES = [
  'text-shadow-2xs', 'text-shadow-xs', 'text-shadow-sm', 'text-shadow-md', 'text-shadow-lg',
  'text-shadow-lg/50', 'text-shadow-sm/12.5', 'text-shadow-lg/[20%]', 'text-shadow-none',
  'text-shadow-[0_1px_2px_red]', 'text-shadow-[0_1px_2px_red]/50', 'text-shadow-(--x)', 'hover:text-shadow-md',
  'drop-shadow', 'drop-shadow-xs', 'drop-shadow-sm', 'drop-shadow-md', 'drop-shadow-lg', 'drop-shadow-xl', 'drop-shadow-2xl',
  'drop-shadow-lg/50', 'drop-shadow-lg/[20%]', 'drop-shadow-[0_1px_2px_red]', 'drop-shadow-none',
  'shadow', 'shadow/50', 'shadow-inner', 'shadow-inner/50', 'shadow-2xs', 'shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg',
  'shadow-xl', 'shadow-2xl', 'shadow-none', 'shadow-md/[20%]', 'shadow-[0_1px_2px_red]',
  'shadow-[0_1px_2px_red]/50', 'shadow-(--x)',
  'inset-shadow-2xs', 'inset-shadow-xs', 'inset-shadow-sm', 'inset-shadow-sm/[20%]', 
  'inset-shadow-none', 'inset-shadow-[0_1px_red]', 'inset-shadow-[0_1px_red,0_2px_blue]', 'inset-shadow-(--x)',
  'shadow-[0_1px_2px]', 'shadow-red-500/[20%]', 'drop-shadow/50', 'drop-shadow-(--x)',
];

// Colour classes compose with a size on one element: compare the effective value of the whole set.
const COMBOS = [
  'shadow-md shadow-red-500/20', 'shadow-md shadow-red-500', 'shadow-lg/50 shadow-red-500', 'shadow shadow-blue-500/50',
  'shadow-inner shadow-black/10', 'shadow-md shadow-(color:--c)', 'shadow-md shadow-[#f00]/50', 'shadow-md shadow-current',
  'shadow-md/[20%] shadow-red-500', '[--o:50%] shadow-md/(--o) shadow-red-500',
  // /(--o) needs --o defined on the element to resolve
  '[--o:50%] shadow-md/(--o)', '[--o:50%] inset-shadow-sm/(--o)', '[--o:50%] text-shadow-lg/(--o)', '[--o:50%] drop-shadow-lg/(--o)',
  'inset-shadow-sm inset-shadow-red-500/50', 'inset-shadow-xs inset-shadow-blue-500',
  'text-shadow-lg text-shadow-blue-500/50', 'text-shadow-sm text-shadow-red-500', 'text-shadow-lg/50 text-shadow-red-500',
  'text-shadow-md text-shadow-(color:--c)', 'text-shadow-md text-shadow-[#f00]', 'text-shadow-md text-shadow-current',
  'text-shadow-[0_1px_2px_red] text-shadow-blue-500', 'text-shadow-md text-shadow-inherit',
  'drop-shadow-xl', 'drop-shadow-xl drop-shadow-red-500/50', 'drop-shadow-lg drop-shadow-blue-500',
  'drop-shadow-lg/50 drop-shadow-red-500', 'drop-shadow drop-shadow-red-500', 'drop-shadow-md drop-shadow-(color:--c)',
  'drop-shadow-md drop-shadow-[#f00]', 'blur-sm drop-shadow-lg',
  // ring / inset-ring keep stacking with the box shadow
  'shadow-md ring-2', 'shadow-md shadow-red-500/20 ring-2 ring-blue-500', 'inset-shadow-sm inset-ring-2 shadow-lg',
  'shadow-md ring-2 ring-offset-2',
];

async function comboDiffs(set: string): Promise<string[]> {
  const tokens = set.split(' ');
  const ctx = createContext({ preflight: false });
  const root = new Map<string, string>();
  postcss.parse(ctx.themeToCssVars()).walkDecls((d) => { if (d.prop.startsWith('--')) root.set(d.prop, d.value); });
  const tw = effective(await tailwindBuilder()(tokens), new Map(), true);
  const baro = effective(tokens.map((t) => generateCss(t, ctx)).join('\n'), root, true);
  const out: string[] = [];
  for (const [prop, value] of Object.entries(tw.decls)) {
    if (baro.decls[prop] !== value) out.push(`${set} → ${prop}: ${baro.decls[prop] ?? 'missing'} ≠ ${value}`);
  }
  return out;
}

describe('#313 shadows match Tailwind 4.3.3', () => {
  it('single classes pass effective-value parity', async () => {
    const results = await runParity(SINGLES.map((t) => [t, 1] as const));
    expect(results.filter((r) => !r.pass).map((r) => `${r.token}: ${r.diffs.join('; ')}`)).toEqual([]);
  });

  it('size + colour combinations compose to the same effective value', async () => {
    const diffs = (await Promise.all(COMBOS.map(comboDiffs))).flat();
    expect(diffs).toEqual([]);
  });

  it.each(['text-shadow', 'text-shadow-foo', 'text-shadow-lg/x', 'drop-shadow-foo', 'shadow-inner/x', 'inset-shadow-lg/50'])(
    '%s emits nothing', (c) => {
      expect(generateCss(c, createContext({ preflight: false }))).toBe('');
    },
  );

  it('registers the text-shadow vars and maps them under cssVarPrefix tw', () => {
    const css = generateCss('text-shadow-lg/50', createContext({ preflight: false, cssVarPrefix: 'tw' }));
    expect(css).toContain('@property --tw-text-shadow-alpha');
    expect(css).toContain('@property --tw-text-shadow-color');
    expect(css).toContain('--tw-text-shadow-alpha: 50%');
    expect(css).not.toContain('--baro-');
    expect(createContext({}).themeToCssVars()).toContain('--text-shadow-lg:');
  });
});
