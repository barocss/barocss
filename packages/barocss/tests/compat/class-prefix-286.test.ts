/** #286: config.prefix follows Tailwind 4 `prefix(tw)`: the prefix is the first `:` segment of the candidate. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

const require = createRequire(import.meta.url);
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
const loadStylesheet = async (id: string) => {
  const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.join(twDir, id.replace(/^tailwindcss\//, ''));
  return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') };
};
async function tw(cls: string): Promise<string> {
  const c = await compile('@import "tailwindcss" prefix(tw);', { base: twDir, loadStylesheet });
  const out = c.build([cls]);
  const i = out.indexOf('@layer utilities {');
  return i < 0 ? '' : out.slice(i);
}
const esc = (cls: string) => cls.replace(/[:!\[\]/#()]/g, '\\$&');
const decls = (css: string) =>
  (css.replace(/\s+/g, ' ').match(/[a-z-]+:\s*[^;{}]+;/g) ?? []).filter((d) => !d.startsWith('--')).sort();
const tws = () => createContext({ prefix: 'tw' });

const MATRIX: [string, string][] = [
  ['tw:flex', 'flex'],
  ['tw:hover:bg-red-500', 'hover:bg-red-500'],
  ['tw:md:p-4', 'md:p-4'],
  ['tw:p-[3px]', 'p-[3px]'],
  ['tw:[color:red]', '[color:red]'],
  ['tw:!flex', '!flex'],
  ['tw:flex!', 'flex!'],
  ['tw:hover:p-4!', 'hover:p-4!'],
  ['tw:-mt-2', '-mt-2'],
  ['tw:bg-red-500/50', 'bg-red-500/50'],
  ['tw:dark:md:hover:text-white', 'dark:md:hover:text-white'],
];

describe('#286 prefix matrix', () => {
  it.each(MATRIX)('%s styles like unprefixed %s, selector keeps the prefix', (pre, bare) => {
    const a = generateCss(pre, tws());
    const b = generateCss(bare, createContext({}));
    expect(a).not.toBe('');
    expect(a).toContain(`.${esc(pre)}`);
    expect(a.split(`.${esc(pre)}`).join('.X')).toBe(b.split(`.${esc(bare)}`).join('.X'));
  });
});

describe('#286 unprefixed or misplaced prefix emits nothing', () => {
  it.each(['flex', 'hover:bg-red-500', '!flex', 'p-4!', '-mt-2', '[color:red]', 'hover:tw:flex', '!tw:flex',
    'tw-flex', 'twflex', 'tw:', 'TW:flex', 'md:tw:p-4'])('%s', async (cls) => {
    expect(generateCss(cls, tws())).toBe('');
    expect(await tw(cls)).toBe('');
  });
});

describe('#286 no prefix: unchanged', () => {
  it('bare classes still style, tw: is not special', () => {
    expect(generateCss('flex', createContext({}))).toContain('display: flex');
    expect(generateCss('tw:flex', createContext({}))).toBe('');
  });
  it('an invalid prefix value is ignored (Tailwind 4 accepts lowercase letters only)', () => {
    expect(generateCss('flex', createContext({ prefix: 'tw-' }))).toContain('display: flex');
  });
});

describe('#286 vs Tailwind 4 compile() with prefix(tw)', () => {
  it.each(MATRIX.map(([p]) => p))('%s: same escaped selector', async (cls) => {
    expect(await tw(cls)).toContain(`.${esc(cls)}`);
    expect(generateCss(cls, tws())).toContain(`.${esc(cls)}`);
  });
  it.each(['tw:flex', 'tw:!flex', 'tw:flex!', 'tw:p-[3px]', 'tw:[color:red]'])('%s: same declarations', async (cls) => {
    expect(decls(generateCss(cls, tws()))).toEqual(decls(await tw(cls)));
  });
});

describe('#286 guards still run after the prefix is stripped', () => {
  it.each(['tw:[&}body{color:red]:flex', 'tw:bg-[red;}body{x:y]', 'tw:p-[1px]/*x*/'])('%s', (cls) => {
    const css = generateCss(cls, tws());
    expect(css).not.toContain('body');
    expect(css).not.toContain('/*');
  });
});
