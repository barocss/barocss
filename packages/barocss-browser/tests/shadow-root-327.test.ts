import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';
import { baroStart } from '../src/baro-boot';
import { acquireSharedRootSheet, releaseIfUnused, getSharedRootSheetStats, scopePreflightForShadowRoot } from '../src/shadow-root-sheet';

const flush = () => new Promise(r => setTimeout(r, 0));
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const GRACE = 30;

let runtimes: BrowserRuntime[] = [];
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtimes.forEach(r => r.destroy()); runtimes = []; vi.restoreAllMocks(); });

function widget(html: string): ShadowRoot {
  const host = document.createElement('ai-widget');
  document.body.appendChild(host);
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML = html;
  return sr;
}
const start = (root: ShadowRoot, config = {}) => {
  const rt = new BrowserRuntime({ root, config, gcGraceMs: GRACE });
  runtimes.push(rt);
  return rt;
};
/** Fallback mode (jsdom has no constructable sheets): the rule <style> inside the root. */
const rootCss = (sr: ShadowRoot) => Array.from(sr.querySelectorAll<HTMLStyleElement>('style[data-barocss]'))
  .map(s => (s.sheet ? Array.from(s.sheet.cssRules, r => r.cssText).join('\n') : s.textContent)).join('\n');

describe('#327 shadow root option (fallback <style> path)', () => {
  it('scopes utilities, theme vars and preflight into the root, only @property into document.head (#384)', async () => {
    const sr = widget('<div class="p-4 text-red-500">x</div>');
    start(sr);
    await flush();
    const css = rootCss(sr);
    expect(css).toMatch(/\.p-4/);
    expect(css).toMatch(/\.text-red-500/);
    expect(css).toMatch(/:root,:host/);
    expect(css).toMatch(/:host \{[^}]*font-family/);
    // p-4 / text-red-500 need no @property: the document stays empty.
    expect(document.head.innerHTML).toBe('');
    // shadow-md does: the document gains only its @property registrations.
    sr.querySelector('div')!.className = 'p-4 shadow-md';
    await flush();
    const docStyles = Array.from(document.head.querySelectorAll('style'));
    expect(docStyles.map(s => s.getAttribute('data-barocss'))).toEqual(['document-properties']);
    const docRules = Array.from(docStyles[0].sheet?.cssRules ?? [], r => r.cssText);
    const docText = docRules.length ? docRules : [docStyles[0].textContent ?? ''];
    expect(docText.join('\n')).toMatch(/@property --baro-shadow/);
    expect(docText.join('\n')).not.toMatch(/\.p-4|\.shadow-md|:root|:host/);
  });

  it('styles classes added later inside the root', async () => {
    const sr = widget('<div id="d">x</div>');
    start(sr);
    sr.getElementById('d')!.className = 'mt-[37px]';
    await flush();
    expect(rootCss(sr)).toMatch(/mt-\\\[37px\\\]/);
  });

  it('two roots with the same config share one entry and generate each class once', async () => {
    const a = widget('<div class="p-4 flex">a</div>');
    const b = widget('<div class="p-4 flex m-2">b</div>');
    start(a); start(b);
    await flush();
    const stats = getSharedRootSheetStats();
    expect(stats).toHaveLength(1);
    expect(stats[0].roots).toBe(2);
    expect(stats[0].generations).toBe(3); // p-4, flex, m-2
    expect(rootCss(b)).toMatch(/\.p-4/);
    expect(rootCss(a)).toMatch(/\.m-2/); // one shared rule list: B's class reaches A too
  });

  it('a class used in A and later in B; removed in A but still used in B keeps its rule', async () => {
    const a = widget('<div id="x" class="p-4">a</div>');
    const b = widget('<div id="y">b</div>');
    start(a); start(b);
    await flush();
    b.getElementById('y')!.className = 'p-4';
    await flush();
    expect(getSharedRootSheetStats()[0].generations).toBe(1);
    a.getElementById('x')!.className = '';
    await flush();
    await wait(GRACE * 3);
    expect(rootCss(b)).toMatch(/\.p-4/);
    b.getElementById('y')!.className = '';
    await flush();
    await wait(GRACE * 3);
    expect(rootCss(b)).not.toMatch(/\.p-4/);
  });

  it('different configs do not share; destroy detaches and releases', async () => {
    const a = widget('<div class="p-4">a</div>');
    const b = widget('<div class="tw:p-4">b</div>');
    const ra = start(a); start(b, { prefix: 'tw' });
    await flush();
    expect(getSharedRootSheetStats()).toHaveLength(2);
    ra.destroy();
    expect(a.querySelectorAll('style').length).toBe(0);
    expect(getSharedRootSheetStats()).toHaveLength(1);
  });

  it('baroStart({ root }) returns a runtime for that root', async () => {
    const sr = widget('<div class="flex">a</div>');
    const rt = baroStart({ root: sr });
    runtimes.push(rt);
    await flush();
    expect(rt.getStats().sharedSheet?.roots).toBe(1);
    expect(rootCss(sr)).toMatch(/\.flex/);
    expect(document.head.innerHTML).toBe('');
  });
});

describe('#327 adopted constructable sheet path (mocked)', () => {
  class MockSheet {
    cssRules: Array<{ cssText: string }> = [];
    text = '';
    replaceSync(t: string) { this.text = t; }
    insertRule(r: string, i: number) { this.cssRules.splice(i, 0, { cssText: r }); return i; }
    deleteRule(i: number) { this.cssRules.splice(i, 1); }
  }
  it('adopts one shared prologue + rules sheet in every root, keeping #254 order', async () => {
    vi.stubGlobal('CSSStyleSheet', MockSheet);
    const store = new WeakMap<object, unknown[]>();
    Object.defineProperty(ShadowRoot.prototype, 'adoptedStyleSheets', {
      configurable: true,
      get() { return store.get(this) ?? []; },
      set(v: unknown[]) { store.set(this, v); },
    });
    try {
      const a = widget('<div class="lg:p-8 p-4">a</div>');
      const b = widget('<div id="y">b</div>');
      start(a, { theme: {} }); start(b, { theme: {} });
      await flush();
      const sheetsA = a.adoptedStyleSheets as unknown as MockSheet[];
      const sheetsB = b.adoptedStyleSheets as unknown as MockSheet[];
      expect(sheetsA).toHaveLength(2);
      expect(sheetsA[0]).toBe(sheetsB[0]);
      expect(sheetsA[1]).toBe(sheetsB[1]);
      expect(sheetsA[0].text).toMatch(/:host/);
      expect(a.querySelectorAll('style').length).toBe(0);
      b.getElementById('y')!.className = 'sm:p-6';
      await flush();
      const texts = sheetsA[1].cssRules.map(r => r.cssText);
      const i = (s: string) => texts.findIndex(t => t.includes(s));
      expect(i('.p-4')).toBeLessThan(i('sm\\:p-6'));
      expect(i('sm\\:p-6')).toBeLessThan(i('lg\\:p-8'));
      expect(document.head.innerHTML).toBe('');
    } finally {
      delete (ShadowRoot.prototype as unknown as Record<string, unknown>).adoptedStyleSheets;
      vi.unstubAllGlobals();
    }
  });
});

describe('#327 registry identity', () => {
  it('two different configs never share an entry, even with a forced hash collision', () => {
    const collide = () => 'same';
    const a = acquireSharedRootSheet({ prefix: 'aa' }, collide);
    const b = acquireSharedRootSheet({ prefix: 'bb' }, collide);
    expect(a.key).toBe(b.key);
    expect(a).not.toBe(b);
    expect(acquireSharedRootSheet({ prefix: 'aa' }, collide)).toBe(a);
    releaseIfUnused(a); releaseIfUnused(b);
    expect(getSharedRootSheetStats()).toHaveLength(0);
  });
});

describe('#327 preflight rewrite', () => {
  it('maps html/:root to :host and re-emits body declarations last on :host', () => {
    const out = scopePreflightForShadowRoot('@layer base {\nhtml { line-height: 1.15; }\nbody { min-height: 100vh; line-height: 1.5; }\n* { margin: 0; }\n@media (x) { html { a: b; } }\n}');
    expect(out).not.toMatch(/\bhtml\b|\bbody\b|min-height/);
    expect(out).toMatch(/:host \{ line-height: 1.15; \}/);
    expect(out.trim().endsWith(':host {\n  line-height: 1.5;\n}\n}')).toBe(true);
    expect(out).toMatch(/@media \(x\) \{ :host \{ a: b; \} \}/);
  });
});

describe('#327 document mode unchanged', () => {
  it('without root, CSS goes to document.head partitions and no shared sheet is created', async () => {
    document.body.innerHTML = '<div class="p-4"></div>';
    const rt = new BrowserRuntime();
    runtimes.push(rt);
    rt.observe(document.body, { scan: true });
    await flush();
    expect(document.head.querySelector('[data-category="preflight"]')).not.toBeNull();
    expect(getSharedRootSheetStats()).toHaveLength(0);
    const rtDoc = new BrowserRuntime({ root: document, styleId: 'x2' });
    runtimes.push(rtDoc);
    expect(getSharedRootSheetStats()).toHaveLength(0);
  });
});
