import { describe, expect, it } from 'vitest';
import { createContext, generateCss, ruleSortKey } from '../src/index';

const config = { darkMode: 'class' as const, darkModeSelector: '&:where(.dark,.dark *)' };

describe('#448 class-based dark variant order', () => {
  it.each(['dark:text-white text-slate-900', 'text-slate-900 dark:text-white'])
  ('puts the dark text rule after the base rule for %s', classes => {
    const css = generateCss(classes, createContext(config));
    expect(css.indexOf('.text-slate-900')).toBeGreaterThanOrEqual(0);
    expect(css.indexOf('.dark\\:text-white')).toBeGreaterThan(css.indexOf('.text-slate-900'));
  });

  it.each(['[--mode:dark:active] [--mode:light]', '[--mode:light] [--mode:dark:active]'])
  ('does not classify dark text inside an arbitrary property as a variant: %s', classes => {
    const css = generateCss(classes, createContext({ preflight: false }));
    expect([...css.matchAll(/--mode:\s*([^;}\n]+)/g)].map(match => match[1].trim())).toEqual(['dark:active', 'light']);
    expect(ruleSortKey('.x{--mode:dark:active}', '[--mode:dark:active]')[0]).toBe(-1);
    expect(ruleSortKey('.x{color:red}', '[&:dark]:text-red-500')[0]).toBe(-1);
  });

  it('keeps media dark and other variants in their existing groups', () => {
    const base = ruleSortKey('.text-slate-900{color:black}', 'text-slate-900');
    const dark = ruleSortKey('.dark\\:text-white:where(.dark,.dark *){color:white}', 'dark:text-white');
    const hover = ruleSortKey('.hover\\:text-white:hover{color:white}', 'hover:text-white');
    const mediaDark = ruleSortKey('@media (prefers-color-scheme:dark){.dark\\:text-white{color:white}}', 'dark:text-white');
    expect(base[0]).toBe(-1);
    expect(hover[0]).toBe(-1);
    expect(dark.slice(0, 2)).toEqual([5, 0]);
    expect(mediaDark.slice(0, 3)).toEqual([5, 0, -1]);
    expect(ruleSortKey('@media (min-width:40rem){.x{color:white}}', 'sm:dark:text-white').slice(0, 4)).toEqual([2, 640, 5, 0]);
    expect(ruleSortKey('.x{color:white}', '[&:nth-child(2)]:dark:text-white').slice(0, 2)).toEqual([5, 0]);
  });
});
