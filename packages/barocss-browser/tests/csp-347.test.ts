import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

const flush = () => new Promise(r => setTimeout(r, 0));
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const GRACE = 30;

let runtimes: BrowserRuntime[] = [];
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});
afterEach(() => { runtimes.forEach(r => r.destroy()); runtimes = []; vi.unstubAllGlobals(); });
const start = (opts: ConstructorParameters<typeof BrowserRuntime>[0]) => {
  const rt = new BrowserRuntime({ gcGraceMs: GRACE, ...opts });
  runtimes.push(rt);
  return rt;
};

class MockSheet {
  cssRules: Array<{ cssText: string }> = [];
  text = '';
  replaceSync(t: string) { this.text = t; }
  insertRule(r: string, i: number) { this.cssRules.splice(i, 0, { cssText: r }); return i; }
  deleteRule(i: number) { this.cssRules.splice(i, 1); }
}
function mockDocumentAdoption(): () => void {
  vi.stubGlobal('CSSStyleSheet', MockSheet);
  let adopted: unknown[] = [];
  Object.defineProperty(Document.prototype, 'adoptedStyleSheets', {
    configurable: true,
    get() { return adopted; },
    set(v: unknown[]) { adopted = v; },
  });
  return () => { delete (Document.prototype as unknown as Record<string, unknown>).adoptedStyleSheets; };
}

describe('#347 nonce option', () => {
  it('sets the nonce on every <style> the runtime creates (preflight, vars, partitions, categories)', async () => {
    document.body.innerHTML = '<div class="p-4 flex text-red-500 lg:p-8 animate-spin">x</div>';
    const rt = start({ nonce: 'abc123' });
    rt.observe(document.body, { scan: true });
    await flush();
    const styles = Array.from(document.head.querySelectorAll('style'));
    expect(styles.length).toBeGreaterThan(2);
    for (const s of styles) expect(s.getAttribute('nonce')).toBe('abc123');
    expect(styles.some(s => s.getAttribute('data-category') === 'preflight')).toBe(true);
    // Partitions created later (reset) keep it too.
    rt.reset();
    for (const s of Array.from(document.head.querySelectorAll('style'))) expect(s.getAttribute('nonce')).toBe('abc123');
  });

  it('sets the nonce on the #327 shadow-root fallback <style> elements', async () => {
    const host = document.createElement('x-w');
    document.body.appendChild(host);
    const sr = host.attachShadow({ mode: 'open' });
    sr.innerHTML = '<div class="p-4">x</div>';
    start({ root: sr, nonce: 'n-1', config: { theme: { extend: {} } } });
    await flush();
    const styles = Array.from(sr.querySelectorAll('style'));
    expect(styles).toHaveLength(2);
    for (const s of styles) expect(s.getAttribute('nonce')).toBe('n-1');
  });

  it('default: no nonce attribute, <style> elements as before', async () => {
    document.body.innerHTML = '<div class="p-4">x</div>';
    const rt = start({});
    rt.observe(document.body, { scan: true });
    await flush();
    const styles = Array.from(document.head.querySelectorAll('style'));
    expect(styles.length).toBeGreaterThan(0);
    for (const s of styles) expect(s.hasAttribute('nonce')).toBe(false);
    expect(rt.getStats().adopted).toBe(false);
  });
});

describe('#347 constructable document mode', () => {
  it('falls back to (nonce\'d) <style> elements when document.adoptedStyleSheets is unsupported', async () => {
    document.body.innerHTML = '<div class="p-4">x</div>';
    const rt = start({ constructable: true, nonce: 'z' });
    rt.observe(document.body, { scan: true });
    await flush();
    expect(rt.getStats().adopted).toBe(false);
    const styles = Array.from(document.head.querySelectorAll('style'));
    expect(styles.map(s => s.textContent + Array.from(s.sheet?.cssRules ?? [], r => r.cssText).join('')).join('')).toMatch(/\.p-4/);
    for (const s of styles) expect(s.getAttribute('nonce')).toBe('z');
  });

  it('adopts a prologue + rules sheet, creates no <style>, keeps #254 order and #269 GC', async () => {
    const restore = mockDocumentAdoption();
    try {
      document.body.innerHTML = '<div id="a" class="lg:p-8 p-4">a</div><div id="b">b</div>';
      const rt = start({ constructable: true });
      rt.observe(document.body, { scan: true });
      await flush();
      expect(rt.getStats().adopted).toBe(true);
      expect(document.querySelectorAll('style').length).toBe(0);
      const sheets = document.adoptedStyleSheets as unknown as MockSheet[];
      expect(sheets).toHaveLength(2);
      expect(sheets[0].text).toMatch(/@layer theme, base, components, utilities/);
      expect(sheets[0].text).toMatch(/(^|[\s,{}])html[\s,{]/); // preflight not shadow-scoped
      document.getElementById('b')!.className = 'sm:p-6';
      await flush();
      const texts = () => sheets[1].cssRules.map(r => r.cssText);
      const i = (s: string) => texts().findIndex(t => t.includes(s));
      expect(i('.p-4')).toBeGreaterThanOrEqual(0);
      expect(i('.p-4')).toBeLessThan(i('sm\\:p-6'));
      expect(i('sm\\:p-6')).toBeLessThan(i('lg\\:p-8'));
      // GC: the class leaves the DOM -> its rule is deleted after the grace period.
      document.getElementById('b')!.className = '';
      await wait(GRACE * 4);
      expect(i('sm\\:p-6')).toBe(-1);
      expect(i('.p-4')).toBeGreaterThanOrEqual(0);
      // destroy un-adopts both sheets.
      rt.destroy();
      expect(document.adoptedStyleSheets).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('keeps foreign adopted sheets and survives reset', async () => {
    const restore = mockDocumentAdoption();
    try {
      const foreign = new MockSheet();
      (document as unknown as { adoptedStyleSheets: unknown[] }).adoptedStyleSheets = [foreign];
      const rt = start({ constructable: true });
      rt.addClass('m-2');
      rt.reset();
      rt.addClass('m-3');
      const sheets = document.adoptedStyleSheets as unknown as MockSheet[];
      expect(sheets).toHaveLength(3);
      expect(sheets[0]).toBe(foreign);
      expect(sheets[2].cssRules.map(r => r.cssText).join('\n')).toMatch(/\.m-3/);
    } finally {
      restore();
    }
  });
});
