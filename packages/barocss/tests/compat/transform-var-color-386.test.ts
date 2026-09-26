/** #386: bare `transform` emits nothing in Tailwind 4.3 (and in BaroCSS); untyped var() arbitrary colours. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

const require = createRequire(import.meta.url);
const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
async function tw(cls: string): Promise<string> {
  const c = await compile(themeCss + '\n@tailwind utilities;');
  return c.build([cls]);
}
const decls = (css: string) =>
  (css.replace(/:root, :host \{[^}]*\}/, '').replace(/@layer properties[\s\S]*$/, '').match(/[a-z-]+:\s*[^;{}]+;/g) ?? [])
    .map((d) => d.replace(/--tw-/g, '--baro-').replace(/\s+/g, ' '));

describe('#386 transform and var() arbitrary colours vs Tailwind 4.3', () => {
  it('bare transform emits nothing, like Tailwind', async () => {
    expect(decls(await tw('transform'))).toEqual([]);
    expect(decls(generateCss('transform', createContext({})))).toEqual([]);
  });
  it.each(['bg-[var(--primary)]', 'text-[var(--x)]', 'border-[var(--x)]', 'ring-[var(--x)]', 'outline-[var(--x)]', 'fill-[var(--x)]', 'bg-(--primary)'])(
    '%s',
    async (cls) => {
      const t = decls(await tw(cls));
      expect(t.length).toBeGreaterThan(0);
      expect(decls(generateCss(cls, createContext({})))).toEqual(t);
    },
  );
});
