/** #233: bare `rounded` and divide-<color> vs Tailwind 4.1.13 (fresh compile() per candidate). */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

const require = createRequire(import.meta.url);
const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
const ws = (s: string) => s.replace(/\s+/g, ' ').trim();
async function tw(cls: string): Promise<string> {
  const c = await compile(themeCss + '\n@tailwind utilities;');
  return c.build([cls]);
}
const decls = (css: string, prop: string) => ws(css).match(new RegExp(`${prop}:\\s*[^;]+;`, 'g')) ?? [];

describe('#233 bare rounded vs Tailwind 4.1.13', () => {
  it.each(['rounded', 'rounded-t', 'rounded-tl', 'rounded-b'])('%s', async (cls) => {
    const baro = generateCss(cls, createContext({}));
    expect(baro).not.toContain('var(--radius)');
    expect(decls(baro, '[a-z-]*radius')).toEqual(decls(await tw(cls), '[a-z-]*radius'));
  });
});

describe('#233 divide-<color> vs Tailwind 4.1.13', () => {
  it.each(['divide-red-500', 'divide-[#123456]', 'divide-current', 'divide-transparent', 'divide-(--c)'])('%s', async (cls) => {
    const baro = generateCss(cls, createContext({}));
    const t = await tw(cls);
    expect(ws(baro)).toContain(`:where(.${cls.replace(/[[\]#()]/g, '\\$&')} > :not(:last-child))`);
    expect(t).toContain(':where(& > :not(:last-child))');
    // Tailwind references theme colours by var; BaroCSS inlines the theme value (existing border-<color> convention).
    const norm = (s: string) => decls(s.replace(/var\(--color-red-500\)/g, 'oklch(63.7% 0.237 25.331)').replace(/currentcolor/gi, 'currentColor'), 'border-color');
    expect(norm(baro)).toEqual(norm(t.replace(/:root, :host \{[^}]*\}/, '')));
  });
  it('divide-red-500/50 mixes alpha like Tailwind', async () => {
    const baro = ws(generateCss('divide-red-500/50', createContext({})));
    const t = ws(await tw('divide-red-500/50'));
    expect(baro).toContain('color-mix(in srgb, oklch(63.7% 0.237 25.331) 50%, transparent)');
    expect(t).toContain('color-mix(in srgb, oklch(63.7% 0.237 25.331) 50%, transparent)');
    expect(baro).toContain('color-mix(in oklab, var(--color-red-500) 50%, transparent)');
    expect(t).toContain('color-mix(in oklab, var(--color-red-500) 50%, transparent)');
  });
});

describe('#233 divide-<color> rejects non-colour arbitrary values', () => {
  it('divide-[3px] emits nothing (Tailwind emits nothing)', () => {
    expect(generateCss('divide-[3px]', createContext({}))).toBe('');
  });
  it('divide-red-500 references the theme var', () => {
    expect(generateCss('divide-red-500', createContext({}))).toContain('border-color: var(--color-red-500)');
  });
});
