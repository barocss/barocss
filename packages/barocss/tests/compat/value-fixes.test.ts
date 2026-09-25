import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { createContext } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import '../../src/presets';

const require = createRequire(import.meta.url);
const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');

async function tailwindDecl(cls: string): Promise<string | undefined> {
  const tw = await compile(themeCss + '\n@tailwind utilities;');
  const css = tw.build([cls]);
  return css.match(/\{\s*([a-z-]+:[^;]*);\s*\}\s*$/)?.[1];
}

function baroDecl(cls: string): string | undefined {
  const css = generateCss(cls, createContext({}));
  return css.match(/\{\s*([a-z-]+:[^;]*);\s*\}\s*$/)?.[1];
}

describe('#227 value fixes vs Tailwind 4.1.13', () => {
  const cases = [
    'bg-(--x)',
    'max-w-[calc(100%-2rem)]',
    'w-[min(100%-2rem,50px)]',
    'w-[max(1px,2px)]',
    'w-[clamp(1rem,10vw-2px,3rem)]',
    'w-[calc(var(--x-y)*-1+1e-3px)]',
    'gap-px',
    'gap-x-px',
    'gap-y-px',
  ];
  for (const cls of cases) {
    it(cls, async () => {
      const expected = await tailwindDecl(cls);
      expect(expected).toBeTruthy();
      expect(baroDecl(cls)).toBe(expected);
    });
  }
});
