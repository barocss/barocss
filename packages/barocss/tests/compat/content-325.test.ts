/** #325: content-[…] quoting vs Tailwind 4.3 (fresh compile() per candidate). */
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
const decls = (css: string) =>
  (ws(css.replace(/@property[^{]*\{[^}]*\}/g, '').replace(/@layer properties\s*\{[\s\S]*?\}\s*\}\s*\}/g, ''))
    .match(/(?:--(?:tw|baro)-content|(?<![-\w])content):\s*[^;]+;/g) ?? [])
    .map((d) => d.replace('--tw-', '--baro-'))
    // effective declarations: last one per property wins (Tailwind keeps a dead earlier `content`)
    .filter((d, i, all) => !all.slice(i + 1).some((e) => e.split(':')[0] === d.split(':')[0]));

const bases = [
  'content-["x"]', "content-['x']", 'content-[hello_world]', 'content-[attr(data-x)]',
  "content-['@']", 'content-(--c)', 'content-none',
];

describe('#325 content quoting vs Tailwind 4.3', () => {
  it.each(bases.flatMap((b) => [b, 'before:' + b, 'after:' + b]))('%s', async (cls) => {
    const t = decls(await tw(cls));
    expect(t.length).toBeGreaterThan(0);
    expect(decls(generateCss(cls, createContext({})))).toEqual(t);
  });
});
