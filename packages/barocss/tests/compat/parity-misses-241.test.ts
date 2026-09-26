/** #241: container queries, sr-only, select-*, justify-self vs Tailwind 4.1.13 (fresh compile() per candidate). */
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
/** Declarations of the first rule body, in order. */
const decls = (css: string) => ws(css.replace(/\/\*[^]*?\*\//g, '').replace(/:root, :host \{[^}]*\}/, '')).match(/[a-z-]+:\s*[^;{}]+;/g) ?? [];
/** `@container <params>` of the (only) container query. */
const query = (css: string) => /@container\s+([^{]+?)\s*\{/.exec(css)?.[1] ?? null;

describe('#241 static utilities match Tailwind declarations', () => {
  it.each([
    'sr-only', 'not-sr-only',
    'select-none', 'select-text', 'select-all', 'select-auto',
    'justify-self-auto', 'justify-self-start', 'justify-self-center', 'justify-self-center-safe',
    'justify-self-end', 'justify-self-end-safe', 'justify-self-stretch',
    '@container', '@container/card', '@container/card-header', '@container-normal',
  ])('%s', async (cls) => {
    expect(decls(generateCss(cls, createContext({})))).toEqual(decls(await tw(cls)));
  });
});

describe('#241 container query variants match Tailwind', () => {
  it.each([
    '@3xs:flex', '@md:flex', '@7xl:flex', '@min-md:flex', '@max-md:flex', '@max-2xl:flex',
    '@md/card:flex', '@max-lg/sidebar:flex', '@[500px]:flex', '@min-[30rem]/b:flex', '@max-[500px]/x:flex',
  ])('%s', async (cls) => {
    const baro = generateCss(cls, createContext({}));
    const t = await tw(cls);
    expect(query(baro)).not.toBeNull();
    expect(query(baro)).toBe(query(t));
    expect(decls(baro)).toEqual(['display: flex;']);
  });
  it('unknown size emits nothing, like Tailwind', async () => {
    expect(generateCss('@foo:flex', createContext({}))).toBe('');
    expect(await tw('@foo:flex')).not.toContain('@container');
  });
});
