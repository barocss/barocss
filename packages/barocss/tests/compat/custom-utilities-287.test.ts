/** #287: config.utilities — static custom utilities (runtime mirror of a static `@utility`). */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
import { createContext, validateCustomUtility } from '../../src/core/context';
import { generateCss } from '../../src/core/engine';
import { parseClassName } from '../../src/core/parser';
import '../../src/presets';

const require = createRequire(import.meta.url);
const themeCss = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
const ws = (s: string) => s.replace(/\s+/g, ' ').trim();
const utilities = {
  'max-w-app': { 'max-width': '72rem', 'margin-inline': 'auto' },
  'app-layout': { 'max-width': '72rem', 'margin-inline': 'auto', 'padding-inline': '1rem' },
  'active-nav': { 'text-decoration-line': 'underline', '--nav-accent': 'red' },
  'content-auto': { 'content-visibility': 'auto' },
  block: { display: 'flow-root' },
};
const ctx = () => createContext({ utilities });

describe('#287 static custom utilities', () => {
  it('generates a static custom utility', () => {
    const css = ws(generateCss('max-w-app', ctx()));
    expect(css).toContain('.max-w-app {');
    expect(css).toContain('max-width: 72rem;');
    expect(css).toContain('margin-inline: auto;');
    expect(ws(generateCss('active-nav', ctx()))).toContain('--nav-accent: red;');
  });
  it('is resolved by the parser like a built-in', () => {
    expect(parseClassName('app-layout', ctx()).utility).not.toBeNull();
    expect(generateCss('app-layout', createContext({}))).toBe('');
  });
  it('applies variants and important', () => {
    const c = ctx();
    expect(ws(generateCss('md:max-w-app', c))).toMatch(/@media \([^)]*48rem\) \{ \.md\\:max-w-app \{ max-width: 72rem;/);
    expect(ws(generateCss('hover:active-nav', c))).toContain('.hover\\:active-nav:hover');
    expect(ws(generateCss('dark:active-nav', createContext({ utilities, darkMode: 'class' })))).toContain('.dark');
    expect(ws(generateCss('!content-auto', c))).toContain('content-visibility: auto !important;');
  });
  it('overrides a same-named built-in', () => {
    const css = ws(generateCss('block', ctx()));
    expect(css).toContain('display: flow-root;');
    expect(css).not.toContain('display: block;');
    expect(ws(generateCss('block', createContext({})))).toContain('display: block;');
  });
  it('stays on its own context', () => {
    ctx();
    expect(generateCss('max-w-app', createContext({}))).toBe('');
  });
  it('matches compile() with an equivalent @utility', async () => {
    const c = await compile(themeCss + '\n@tailwind utilities;\n@utility max-w-app { max-width: 72rem; margin-inline: auto; }');
    const decls = (s: string) => (ws(s).match(/\.max-w-app \{([^}]*)\}/)?.[1] ?? '').trim();
    expect(decls(generateCss('max-w-app', ctx()))).toBe(decls(c.build(['max-w-app'])));
  });
});
