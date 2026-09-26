// TODO(#304): known 4.3 difference, so this file stays pinned to Tailwind 4.1.13 (`tailwindcss-4-1`). 4.3.1 emits `0px` for spacing `*-0` (was `calc(var(--spacing) * 0)`) and `var(--spacing)` for `*-1`; this test compares declaration text.
// Effective-value parity against 4.3 is covered by parity-corpus/parity-heldout; port this text/shape check to 4.3 output.
/** #246: trailing `!`, aspect-video, container, flex-grow/shrink aliases vs Tailwind 4.1.13. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss-4-1';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

const require = createRequire(import.meta.url);
const themeCss = fs.readFileSync(require.resolve('tailwindcss-4-1/theme.css'), 'utf8');
const ws = (s: string) => s.replace(/\s+/g, ' ').trim();
async function tw(cls: string): Promise<string> {
  const c = await compile(themeCss + '\n@tailwind utilities;');
  return c.build([cls]);
}
/** Declarations of the first rule body, in order. */
const decls = (css: string) => ws(css.replace(/\/\*[^]*?\*\//g, '').replace(/:root, :host \{[^}]*\}/, '')).match(/[a-z-]+:\s*[^;{}]+;/g) ?? [];
/** `@container <params>` of the (only) container query. */

describe('#246 utilities match Tailwind declarations', () => {
  it.each([
    'aspect-video',
    'flex-shrink-0', 'flex-shrink', 'flex-shrink-[3]', 'flex-grow', 'flex-grow-0', 'flex-grow-[2]',
  ])('%s', async (cls) => {
    expect(decls(generateCss(cls, createContext({})))).toEqual(decls(await tw(cls)));
  });
  it('container: width 100% + ascending breakpoint max-widths', async () => {
    const baro = generateCss('container', createContext({}));
    const t = await tw('container');
    expect(decls(baro)).toEqual(decls(t));
    expect(decls(baro)[0]).toBe('width: 100%;');
    const mq = (css: string) => [...css.matchAll(/@media\s*([^{]+?)\s*\{/g)].map((m) => ws(m[1]));
    expect(mq(baro)).toEqual(mq(t));
    expect(mq(baro)).toHaveLength(5);
  });
});

describe('#246 trailing ! behaves like leading !', () => {
  it.each([
    'p-4!', 'size-5!', 'hover:size-5!', 'group-data-[x]:p-2!', 'group-data-[collapsible=icon]:p-0!',
    'data-[slot=sidebar-menu-button]:p-1.5!', '*:data-[slot=toggle-group-item]:px-4!', 'p-[3px]!',
  ])('%s', async (cls) => {
    const baro = generateCss(cls, createContext({}));
    expect(decls(baro)).toEqual(decls(await tw(cls)));
    expect(decls(baro).length).toBeGreaterThan(0);
    expect(decls(baro).every((d) => d.includes('!important'))).toBe(true);
    const lead = `!${cls.slice(0, -1)}`;
    expect(decls(generateCss(lead, createContext({})))).toEqual(decls(baro));
  });
  it('! inside an arbitrary value is not an important modifier', () => {
    const css = generateCss('content-[\'hi!\']', createContext({}));
    expect(css).not.toContain('!important');
  });
});
