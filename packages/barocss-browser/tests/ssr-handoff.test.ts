import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

// #268: a server sheet rendered by @barocss/server's ssrStyleTag() (hand-written here: same shape).
const SSR_CSS = [
  ':root,:host {\n  --spacing: 0.25rem;\n}',
  '@property --baro-x { syntax: "*"; inherits: false; }',
  '.p-2 {\n  padding: calc(var(--spacing) * 2);\n}',
  ':where(.divide-y > :not(:last-child)) {\n  border-bottom-width: 1px;\n}',
  '@media (width >= 64rem) {\n  .lg\\:p-8 {\n    padding: calc(var(--spacing) * 8);\n  }\n}',
].join('\n');

/** Every rule's text across document.styleSheets, in cascade (document) order. */
const cascade = () => Array.from(document.styleSheets).flatMap(s => Array.from(s.cssRules).map(r => r.cssText));
const pos = (needle: string) => {
  const i = cascade().findIndex(t => t.includes(needle));
  expect(i, needle).toBeGreaterThanOrEqual(0);
  return i;
};
const count = (needle: string) => cascade().filter(t => t.includes(needle)).length;
const flush = () => new Promise(r => setTimeout(r, 0));
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = `<style data-barocss-ssr>${SSR_CSS}</style>`;
  document.body.innerHTML = '<div id="a" class="p-2 lg:p-8 divide-y"></div>';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

describe('SSR sheet handoff (#268)', () => {
  it('adopts the server class rules: not regenerated, each rule present once', async () => {
    runtime = new BrowserRuntime({ gcGraceMs: 20 });
    runtime.observe(document.body, { scan: true });
    await flush();
    expect(runtime.has('p-2')).toBe(false); // never generated client-side
    expect(count('.p-2 {')).toBe(1);
    expect(count('.lg\\:p-8')).toBe(1);
    expect(runtime.has('divide-y')).toBe(false); // :where(.divide-y ...) counts as the class's rule
    expect(count(':where(.divide-y')).toBe(1);
    // :root / @property stay in the server sheet
    const ssr = document.querySelector<HTMLStyleElement>('style[data-barocss-ssr]')!;
    expect(ssr.hasAttribute('data-barocss-adopted')).toBe(true);
    expect(Array.from(ssr.sheet!.cssRules).map(r => r.cssText).join('\n')).toMatch(/--spacing[\s\S]*--baro-x/);
    runtime.addClass('p-2');
    expect(count('.p-2 {')).toBe(1);
  });

  it('GC never reclaims server classes', async () => {
    runtime = new BrowserRuntime({ gcGraceMs: 20 });
    runtime.observe(document.body, { scan: true });
    await flush();
    document.getElementById('a')!.remove();
    await wait(100);
    expect(count('.p-2 {')).toBe(1);
    expect(count('.lg\\:p-8')).toBe(1);
  });

  it('a later client sm: rule lands before the server lg: rule (combined Tailwind order)', async () => {
    runtime = new BrowserRuntime();
    runtime.observe(document.body, { scan: true });
    await flush();
    const el = document.createElement('div');
    el.className = 'sm:p-6 p-4 xl:p-10';
    document.body.appendChild(el);
    await flush();
    expect(pos('.p-4 {')).toBeLessThan(pos('.sm\\:p-6'));
    expect(pos('.sm\\:p-6')).toBeLessThan(pos('.lg\\:p-8'));
    expect(pos('.lg\\:p-8')).toBeLessThan(pos('.xl\\:p-10'));
  });

  it('does not adopt a marked sheet added to body (or head) after start', async () => {
    runtime = new BrowserRuntime({ gcGraceMs: 20 });
    runtime.observe(document.body, { scan: true });
    const late = document.createElement('div');
    late.innerHTML = '<style data-barocss-ssr>.m-7 { margin: 1.75rem; }</style><p class="m-7 m-5"></p>';
    document.body.appendChild(late);
    const lateHead = document.createElement('style');
    lateHead.setAttribute('data-barocss-ssr', '');
    lateHead.textContent = '.m-5 { margin: 1.25rem; }';
    document.head.appendChild(lateHead);
    await flush();
    expect(late.querySelector('style')!.hasAttribute('data-barocss-adopted')).toBe(false);
    expect(lateHead.hasAttribute('data-barocss-adopted')).toBe(false);
    expect(runtime.has('m-7')).toBe(true); // generated as usual
    expect(runtime.has('m-5')).toBe(true);
  });

  it('keeps adopted rules across reset()', () => {
    runtime = new BrowserRuntime();
    runtime.addClass('sm:p-6');
    runtime.reset();
    runtime.addClass('sm:p-6');
    expect(count('.lg\\:p-8')).toBe(1);
    expect(pos('.sm\\:p-6')).toBeLessThan(pos('.lg\\:p-8'));
  });
});
