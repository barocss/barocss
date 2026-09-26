/** #321: logical border-radius utilities (rounded-s/e/ss/se/es/ee) vs Tailwind 4.3 (fresh compile() per candidate). */
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
const decls = (css: string) => ws(css.replace(/:root, :host \{[^}]*\}/, '')).match(/[a-z-]*radius:\s*[^;]+;/g) ?? [];

const prefixes = ['rounded-s', 'rounded-e', 'rounded-ss', 'rounded-se', 'rounded-es', 'rounded-ee'];
const suffixes = ['', '-none', '-xs', '-sm', '-md', '-lg', '-xl', '-2xl', '-3xl', '-4xl', '-full', '-[3px]', '-(--r)'];

describe('#321 logical rounded vs Tailwind 4.3', () => {
  it.each(prefixes.flatMap((p) => suffixes.map((s) => p + s)))('%s', async (cls) => {
    const t = decls(await tw(cls));
    expect(t.length).toBeGreaterThan(0);
    expect(decls(generateCss(cls, createContext({})))).toEqual(t);
  });
  it.each(prefixes.map((p) => p + '-2'))('%s bare number emits nothing, like Tailwind', async (cls) => {
    expect(decls(await tw(cls))).toEqual([]);
    expect(decls(generateCss(cls, createContext({})))).toEqual([]);
  });
});
