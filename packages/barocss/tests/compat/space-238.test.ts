/** #238: space-x/space-y vs Tailwind 4.1.13 (fresh compile() per candidate). */
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
// Only the declarations of the `:not(:last-child)` rule (skip @property / @layer properties fallbacks).
const decls = (css: string) =>
  ws(css).slice(ws(css).indexOf(':not(:last-child))')).split('}')[0].replace(/--tw-/g, '--baro-').match(/(--baro-space-[xy]-reverse|margin-(?:block|inline)-(?:start|end)):\s*[^;]+;/g) ?? [];

describe('#238 space-x/space-y vs Tailwind 4.1.13', () => {
  it.each([
    'space-y-4', 'space-x-2', 'space-y-0.5', 'space-y-px', 'space-x-px', '-space-y-2', '-space-x-px',
    'space-y-[3px]', 'space-x-[1rem]', 'space-y-(--x)', 'space-y-reverse', 'space-x-reverse',
  ])('%s', async (cls) => {
    const baro = generateCss(cls, createContext({}));
    const t = await tw(cls);
    expect(t).toContain(':where(& > :not(:last-child))');
    expect(ws(baro)).toContain(' > :not(:last-child))');
    expect(baro).not.toContain(':not([hidden])');
    expect(decls(baro.replace(/@property[^}]*\}/g, ''))).toEqual(decls(t.replace(/@property[^}]*\}/g, '')));
    expect(ws(baro)).toMatch(/@property --baro-space-[xy]-reverse \{ syntax: "\*"; inherits: false; initial-value: 0;? ?\}/);
  });
});
