import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

// #274: the runtime inserts the @keyframes an animate-* class references once, never reclaims it, and leaves
// a @keyframes the page's own sheets define to them (companion mode).
const injected = () => Array.from(document.querySelectorAll<HTMLStyleElement>('[data-barocss="partition"]'))
  .flatMap(style => Array.from(style.sheet?.cssRules ?? []).map(rule => rule.cssText)).join('\n');
const count = (re: RegExp) => injected().match(re)?.length ?? 0;
const flush = () => new Promise(r => setTimeout(r, 0));
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const addSheet = (css: string) => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

describe('#274 browser @keyframes', () => {
  it('inserts the keyframes once for two classes sharing an animation', () => {
    runtime = new BrowserRuntime();
    runtime.addClass('animate-spin');
    runtime.addClass('hover:animate-spin');
    expect(count(/@keyframes spin\b/g)).toBe(1);
    expect(injected()).toContain('.animate-spin');
  });

  it('does not insert unused theme keyframes', () => {
    runtime = new BrowserRuntime();
    runtime.addClass('p-4');
    expect(injected()).not.toMatch(/@keyframes/);
  });

  it('skips a @keyframes an existing sheet defines (skipExisting)', () => {
    addSheet('@keyframes spin { to { transform: rotate(90deg) } }');
    runtime = new BrowserRuntime({ skipExisting: true });
    runtime.addClass('animate-spin animate-ping');
    expect(count(/@keyframes spin\b/g)).toBe(0);
    expect(count(/@keyframes ping\b/g)).toBe(1);
    expect(injected()).toContain('.animate-spin');
  });

  it('supports a custom theme animation', () => {
    runtime = new BrowserRuntime({
      config: { theme: { extend: { animation: { wiggle: 'wiggle 1s ease-in-out infinite' }, keyframes: { wiggle: { '0%, 100%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' } } } } } },
    });
    runtime.addClass('animate-wiggle');
    expect(count(/@keyframes wiggle\b/g)).toBe(1);
  });

  it('GC reclaims the class rule but never the keyframes', async () => {
    runtime = new BrowserRuntime({ gcGraceMs: 30 });
    runtime.observe(document.body, { scan: true });
    await flush();
    const d = document.createElement('div');
    d.className = 'animate-spin';
    document.body.appendChild(d);
    await flush();
    expect(count(/@keyframes spin\b/g)).toBe(1);
    d.remove();
    await wait(120);
    expect(runtime.has('animate-spin')).toBe(false);
    expect(injected()).not.toMatch(/\.animate-spin/);
    expect(count(/@keyframes spin\b/g)).toBe(1);
  });
});
