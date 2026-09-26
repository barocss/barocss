/** #303: bg-* type hints and stroke-[<length>] vs Tailwind 4.3 and 4.1 (fresh compile() per candidate). */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { compile as compile41 } from 'tailwindcss-4-1';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

const require = createRequire(import.meta.url);
const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
const ws = (s: string) => s.replace(/\s+/g, ' ').trim();
async function tw(cls: string, c = compile): Promise<string> {
  return (await c(themeCss + '\n@tailwind utilities;')).build([cls]);
}
const decls = (css: string) =>
  ws(css.replace(/:root, :host \{[^}]*\}/, '')).match(/(?:background(?:-[a-z]+)?|stroke(?:-width)?):\s*[^;]+;/g) ?? [];

const cases = [
  'bg-(position:--x)', 'bg-(size:--x)', 'bg-(image:--x)', 'bg-(length:--x)', 'bg-(percentage:--x)', 'bg-(url:--x)',
  'bg-[position:var(--x)]', 'bg-[size:var(--x)]', 'bg-[image:var(--x)]', 'bg-[url:var(--x)]', 'bg-[length:var(--x)]',
  'bg-(--x)', 'bg-[#f00]', 'bg-[url(a.png)]',
  'stroke-[1.5px]', 'stroke-[0.5rem]', 'stroke-[2]', 'stroke-[50%]', 'stroke-[calc(1px+2px)]',
  'stroke-[length:var(--x)]', 'stroke-(length:--x)', 'stroke-(number:--x)',
  'stroke-(--x)', 'stroke-[#f00]', 'stroke-[rgb(0,0,0)]',
];

describe('#303 bg hints / stroke width vs Tailwind', () => {
  it.each(cases)('%s', async (cls) => {
    const t43 = decls(await tw(cls));
    expect(t43.length).toBeGreaterThan(0);
    expect(decls(await tw(cls, compile41 as typeof compile))).toEqual(t43);
    expect(decls(generateCss(cls, createContext({})))).toEqual(t43);
  });
});
