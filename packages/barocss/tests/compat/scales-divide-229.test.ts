/** #229: blur / radius scales and divide border style vs Tailwind 4.3 (fresh compile() per candidate). */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { blur } from '../../src/theme/blur';
import { borderRadius } from '../../src/theme/border-radius';
import '../../src/presets';
import { flatRules } from './parity-compare';

const require = createRequire(import.meta.url);
const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
const ws = (s: string) => s.replace(/\s+/g, ' ').trim();

async function tw(cls: string): Promise<string> {
  const c = await compile(themeCss + '\n@tailwind utilities;');
  return c.build([cls]);
}
const twVar = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(themeCss)?.[1].trim();
/** The declarations of the rule for `cls`, with Tailwind's var prefix mapped to BaroCSS's. */
const body = (css: string, sel: string) => {
  const flat = ws(css.replace(/@property[\s\S]*?\}\s*/g, '').replace(/--tw-/g, '--baro-'));
  const i = flat.indexOf(sel);
  return i < 0 ? '' : flat.slice(flat.indexOf('{', i) + 1, flat.indexOf('}', i)).trim();
};

describe('#229 scales and divide vs Tailwind 4.3', () => {
  it.each(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'])('--blur-%s', (k) => {
    expect(blur[k as keyof typeof blur]).toBe(twVar(`--blur-${k}`));
  });
  it.each(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'])('--radius-%s', (k) => {
    expect(borderRadius[k as keyof typeof borderRadius]).toBe(twVar(`--radius-${k}`));
  });
  it.each(['blur', 'backdrop-blur', 'rounded-xs', 'rounded-4xl', 'rounded-t-4xl'])('%s is generated', async (cls) => {
    const baro = generateCss(cls, createContext({}));
    expect(baro).toContain(`.${cls} {`);
    if (cls.includes('blur')) expect(baro).toContain('blur(8px)');
    expect(await tw(cls)).toContain(`.${cls} {`);
  });
  it('bare rounded is 0.25rem', () => expect(borderRadius.DEFAULT).toBe('0.25rem'));
  it.each(['divide-x', 'divide-y', 'divide-x-2', 'divide-y-4', 'divide-x-0', 'divide-y-[3px]'])('%s', async (cls) => {
    const baro = generateCss(cls, createContext({}));
    const sel = `:where(.${cls.replace(/[[\]]/g, '\\$&')} > :not(:last-child))`;
    expect(baro).toContain('@property --baro-border-style');
    expect(body(baro, sel)).not.toBe('');
    // #312: 4.3 emits the flat `:where(.x > :not(:last-child))` rule; compare whole rules structurally.
    expect(flatRules(baro)).toEqual(flatRules(await tw(cls)));
  });
});
