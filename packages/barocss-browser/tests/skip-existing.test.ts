import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime, unescapeCssIdent } from '../src/browser-runtime';

const injected = () => Array.from(document.querySelectorAll<HTMLStyleElement>('[data-barocss="partition"]'))
  .flatMap(style => Array.from(style.sheet?.cssRules ?? []).map(rule => rule.cssText)).join('\n');

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

const addSheet = (css: string) => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };

describe('skipExisting (#210)', () => {
  it('skips a class an existing stylesheet defines and generates a missing one', () => {
    addSheet('.p-4{padding:1rem}');
    runtime = new BrowserRuntime({ skipExisting: true });
    runtime.addClass('p-4 m-2');
    const css = injected();
    expect(css).not.toContain('.p-4');
    expect(css).toContain('.m-2');
  });

  it('indexes classes inside @layer/@media groups and unescapes identifiers', () => {
    addSheet('@layer utilities{.hover\\:bg-red-500:hover{color:red}@media (min-width:48rem){.md\\:p-4{padding:1rem}}}');
    runtime = new BrowserRuntime({ skipExisting: true });
    const existing = runtime.getExistingClasses();
    expect(existing.has('hover:bg-red-500')).toBe(true);
    expect(existing.has('md:p-4')).toBe(true);
    runtime.addClass('md:p-4 p-4');
    const css = injected();
    expect(css).not.toContain('md\\:p-4');
    expect(css).toContain('.p-4');
  });

  it('does not count a class that appears only as a descendant', () => {
    addSheet('.group:hover .p-4{padding:1rem}');
    runtime = new BrowserRuntime({ skipExisting: true });
    runtime.addClass('p-4');
    expect(injected()).toContain('.p-4');
  });

  it('picks up stylesheets added later', () => {
    runtime = new BrowserRuntime({ skipExisting: true });
    runtime.addClass('m-2');
    addSheet('.p-4{padding:1rem}');
    runtime.addClass('p-4');
    expect(injected()).not.toContain('.p-4');
  });

  it('is off by default', () => {
    addSheet('.p-4{padding:1rem}');
    runtime = new BrowserRuntime();
    runtime.addClass('p-4');
    expect(injected()).toContain('.p-4');
  });

  it('unescapes hex escapes', () => {
    expect(unescapeCssIdent('\\31 0')).toBe('10');
    expect(unescapeCssIdent('w-\\[1\\.5rem\\]')).toBe('w-[1.5rem]');
  });
});
