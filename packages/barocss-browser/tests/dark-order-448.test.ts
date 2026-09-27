import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

const rules = () => Array.from(document.querySelectorAll<HTMLStyleElement>('[data-barocss="partition"]'))
  .flatMap(style => Array.from(style.sheet?.cssRules ?? []).map(rule => rule.cssText));

let runtime: BrowserRuntime | undefined;
beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });
afterEach(() => { runtime?.destroy(); runtime = undefined; });

describe('#448 dynamic class-based dark text', () => {
  it.each([
    ['dark:text-white', 'text-slate-900'],
    ['text-slate-900', 'dark:text-white'],
  ])('orders %s then dynamically inserted %s', async (first, second) => {
    runtime = new BrowserRuntime({ config: { darkMode: 'class', darkModeSelector: '&:where(.dark,.dark *)', preflight: false }, gc: false });
    const element = document.createElement('p');
    element.className = first;
    document.body.append(element);
    runtime.observe(document.body, { scan: true });
    expect(runtime.has(first)).toBe(true);
    element.classList.add(second);
    await Promise.resolve();
    expect(runtime.has(second)).toBe(true);
    const css = rules();
    const base = css.findIndex(rule => rule.includes('.text-slate-900'));
    const dark = css.findIndex(rule => rule.includes('.dark\\:text-white'));
    expect(base).toBeGreaterThanOrEqual(0);
    expect(dark).toBeGreaterThan(base);
    expect(css[dark]).toMatch(/:where\(\.dark,\s*\.dark \*\)/);
  });
});
