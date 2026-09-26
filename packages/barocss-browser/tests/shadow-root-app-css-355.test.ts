import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

// #355: the only shadow-vs-document parity gap on the #253 CMS blocks was the site's own base CSS
// (h1-h3 { font-family: var(--font-display) }) in a document stylesheet, which by design does not cross the
// shadow boundary. The workaround is app-side: ship that CSS into the root. These tests pin that the runtime
// coexists with an app stylesheet inside the root: it keeps it, never removes it, and places its own sheets first.
const flush = () => new Promise(r => setTimeout(r, 0));
let rt: BrowserRuntime | null = null;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  rt?.destroy();
  rt = null;
  vi.restoreAllMocks();
});

function widget(): ShadowRoot {
  const host = document.createElement('ai-widget');
  document.body.appendChild(host);
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML = '<style id="app">@layer base { h1 { font-family: Georgia, serif } }</style><h1 class="text-4xl font-bold">x</h1>';
  return sr;
}
const cssOf = (s: HTMLStyleElement) => (s.sheet ? Array.from(s.sheet.cssRules, r => r.cssText).join('\n') : s.textContent ?? '');

describe('#355 app base CSS inside the shadow root', () => {
  it('keeps the app stylesheet and puts the runtime sheets before it', async () => {
    const sr = widget();
    rt = new BrowserRuntime({ root: sr });
    await flush();
    const styles = Array.from(sr.querySelectorAll('style'));
    const app = sr.getElementById('app') as HTMLStyleElement;
    const baro = styles.filter(s => s.hasAttribute('data-barocss'));
    expect(baro.length).toBeGreaterThan(0);
    expect(styles.indexOf(app)).toBeGreaterThan(styles.indexOf(baro[baro.length - 1]));
    expect(baro.map(cssOf).join('\n')).toMatch(/\.text-4xl/);
  });

  it('leaves the app stylesheet in place on destroy', async () => {
    const sr = widget();
    rt = new BrowserRuntime({ root: sr });
    await flush();
    rt.destroy();
    rt = null;
    expect(sr.getElementById('app')).not.toBeNull();
    expect(sr.querySelectorAll('style[data-barocss]').length).toBe(0);
  });
});
