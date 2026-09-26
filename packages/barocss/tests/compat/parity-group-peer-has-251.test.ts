/** #251: `group-has-*` / `peer-has-*` variants vs Tailwind 4.3 (fresh compile() per candidate). */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';
import { flatRules } from './parity-compare';

const require = createRequire(import.meta.url);
const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
async function tw(cls: string): Promise<string> {
  const c = await compile(themeCss + '\n@tailwind utilities;');
  return c.build([cls]);
}

describe('#251 group-has-* / peer-has-* selectors match Tailwind', () => {
  it.each([
    'group-has-checked:flex', 'group-has-hover:flex', 'group-has-focus:flex', 'group-has-open:flex',
    'group-has-data-open:flex', 'group-has-[.x]:flex', 'group-has-[a,b]:flex', 'group-has-[.x]/name:flex',
    'group-has-checked/name:flex', 'group-has-hover/name:flex',
    'peer-has-checked:flex', 'peer-has-hover:flex', 'peer-has-focus:flex', 'peer-has-data-open:flex',
    'peer-has-[.x]:flex', 'peer-has-[.x]/name:flex', 'peer-has-checked/name:flex', 'peer-has-hover/name:flex',
  ])('%s', async (cls) => {
    // #312: same rules after flattening nesting and dropping the redundant `*` in `:has(*:x)` (see flatRules).
    const expected = flatRules(await tw(cls));
    expect(expected.length).toBeGreaterThan(0);
    expect(flatRules(generateCss(cls, createContext({})))).toEqual(expected);
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
