/** #247: arbitrary text lengths, ease-*, sizing keywords, --spacing() vs Tailwind 4.1.13. */
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
/** Declarations of the utility rule, ignoring :root theme blocks, @property registrations and --tw-* bookkeeping vars. */
const decls = (css: string) =>
  (
    ws(
      css
        .replace(/\/\*[^]*?\*\//g, '')
        .replace(/@layer properties;/, '')
        .replace(/@property[^]*$/, '')
        .replace(/:root, :host \{[^}]*\}/, ''),
    ).match(/-?-?[a-z-]+:\s*[^;{}]+;/g) ?? []
  ).filter((d) => !/^--(tw|baro)-/.test(d));

describe('#247 utilities match Tailwind declarations', () => {
  it.each([
    // arbitrary lengths -> font-size; colours stay colours
    'text-[0.8rem]', 'text-[13px]', 'text-[length:var(--x)]', 'text-[2em]', 'text-[calc(1rem+2px)]',
    'text-[#fff]', 'text-[rgb(1,2,3)]', 'text-[color:var(--x)]', 'text-(--x)', 'text-[var(--x)]',
    // easing
    'ease-in-out', 'ease-in', 'ease-out', 'ease-linear',
    // sizing keywords
    'max-w-max', 'max-w-min', 'max-w-fit', 'w-max', 'w-min', 'w-fit', 'min-w-max', 'min-w-min', 'min-w-fit',
    'h-max', 'h-min', 'h-fit', 'max-h-max', 'max-h-min', 'max-h-fit', 'min-h-fit',
    // --spacing() in arbitrary properties / values
    '[--cell-size:--spacing(8)]', 'p-[--spacing(3)]', '[color:red]', '[--gap:calc(1px+2px)]', 'm-[--spacing(1.5)]',
  ])('%s', async (cls) => {
    expect(decls(generateCss(cls, createContext({})))).toEqual(decls(await tw(cls)));
  });
});

describe('#247 --ease-* theme vars exist (Tailwind names)', () => {
  it('ease-in / ease-out / ease-in-out resolve to theme vars', async () => {
    const { transitionTimingFunctionToCssVars } = await import('../../src/core/cssVars');
    const { transitionTimingFunction } = await import('../../src/theme/transition-timing-function');
    const vars = transitionTimingFunctionToCssVars(transitionTimingFunction);
    expect(vars['--ease-in']).toBe('cubic-bezier(0.4, 0, 1, 1)');
    expect(vars['--ease-out']).toBe('cubic-bezier(0, 0, 0.2, 1)');
    expect(vars['--ease-in-out']).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
  });
});
