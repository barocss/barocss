/** #248: `in-*` and `has-<pseudo>` variants vs Tailwind 4.1.13 (fresh compile() per candidate). */
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

/**
 * Tailwind nests `.cls { <sel with &> { [@media q {] decls } }`; flatten it to BaroCSS's shape:
 * `[@media q {] <sel with & → .cls> { decls } [}]`.
 */
function flattenTw(css: string): string {
  const body = ws(css.replace(/\/\*[^]*?\*\//g, '').replace(/:root, :host \{[^}]*\}/, ''));
  const m = /^(\S+) \{ ([^{]*&[^{]*?) \{ (?:(@media [^{]+?) \{ )?([^{}]+?) \}/.exec(body);
  if (!m) throw new Error(`unexpected Tailwind shape: ${body}`);
  const [, cls, sel, media, decls] = m;
  const rule = `${sel.replace('&', cls)} { ${decls} }`;
  return media ? `${media} { ${rule} }` : rule;
}

describe('#248 in-* / has-<pseudo> selectors match Tailwind', () => {
  it.each([
    'in-focus:flex', 'in-hover:flex', 'in-disabled:flex', 'in-first:flex',
    'in-[.x]:flex', 'in-[&.x]:flex', 'in-data-[side=left]:cursor-w-resize', 'in-data-open:flex', 'in-aria-expanded:flex',
    'has-hover:flex', 'has-focus:flex', 'has-checked:flex', 'has-first:flex', 'has-open:flex',
    'has-focus-visible:flex', 'has-disabled:flex',
  ])('%s', async (cls) => {
    const baro = ws(generateCss(cls, createContext({})));
    const expected = flattenTw(await tw(cls));
    expect(baro).toBe(expected);
  });

  it('non-selector variants inside in-/has- emit nothing, like Tailwind', async () => {
    for (const cls of ['has-md:flex', 'in-dark:flex']) {
      expect(generateCss(cls, createContext({}))).toBe('');
      expect(await tw(cls)).not.toContain('display');
    }
  });
});

describe('#248 #220 guard: structural characters in in-[…] / has-[…] emit nothing', () => {
  const ctx = () => createContext({});
  it.each(['{', '}', ';'])('bracket containing %s', (ch) => {
    for (const v of ['in', 'has']) {
      expect(generateCss(`${v}-[.a${ch}]:flex`, ctx())).toBe('');
      expect(generateCss(`${v}-[${ch}.a]:flex`, ctx())).toBe('');
    }
  });
  it('bracket opening with an at-rule', () => {
    for (const v of ['in', 'has']) {
      expect(generateCss(`${v}-[@x]:flex`, ctx())).toBe('');
      expect(generateCss(`${v}-[_@x]:flex`, ctx())).toBe('');
    }
  });
});
