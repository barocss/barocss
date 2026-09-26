// TODO(#304): known 4.3 difference, so this file stays pinned to Tailwind 4.1.13 (`tailwindcss-4-1`). 4.3 flattens nested `&` rules and drops the redundant `*` in `:has(*:checked)` -> `:has(:checked)`; the regex here expects the 4.1 shape.
// Effective-value parity against 4.3 is covered by parity-corpus/parity-heldout; port this text/shape check to 4.3 output.
/** #251: `group-has-*` / `peer-has-*` variants vs Tailwind 4.1.13 (fresh compile() per candidate). */
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

describe('#251 group-has-* / peer-has-* selectors match Tailwind', () => {
  it.each([
    'group-has-checked:flex', 'group-has-hover:flex', 'group-has-focus:flex', 'group-has-open:flex',
    'group-has-data-open:flex', 'group-has-[.x]:flex', 'group-has-[a,b]:flex', 'group-has-[.x]/name:flex',
    'group-has-checked/name:flex', 'group-has-hover/name:flex',
    'peer-has-checked:flex', 'peer-has-hover:flex', 'peer-has-focus:flex', 'peer-has-data-open:flex',
    'peer-has-[.x]:flex', 'peer-has-[.x]/name:flex', 'peer-has-checked/name:flex', 'peer-has-hover/name:flex',
  ])('%s', async (cls) => {
    const baro = ws(generateCss(cls, createContext({})));
    expect(baro).toBe(flattenTw(await tw(cls)));
  });
});

describe('#251 guard: structural characters in group-has-[…] / peer-has-[…] emit nothing', () => {
  const open = '/' + '*';
  const close = '*' + '/';
  it.each(['{', '}', ';', open, close])('bracket containing %s', (tok) => {
    for (const v of ['group-has', 'peer-has']) {
      for (const cls of [`${v}-[.a${tok}]:flex`, `${v}-[${tok}.a]:flex`, `${v}-[.a${tok}]/name:flex`]) {
        expect(generateCss(cls, createContext({}))).toBe('');
      }
    }
  });
  it('a bracket starting with an at-rule token emits nothing', () => {
    for (const v of ['group-has', 'peer-has']) {
      for (const cls of [`${v}-[@x]:flex`, `${v}-[_@x]:flex`, `${v}-[@x]/name:flex`]) {
        expect(generateCss(cls, createContext({}))).toBe('');
      }
    }
  });
});
