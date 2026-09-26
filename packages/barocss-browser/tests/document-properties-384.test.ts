import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';
import { getDocumentPropertyRules, propertyFallbackCss, resetDocumentProperties } from '../src/shadow-root-sheet';

// #384: @property is ignored inside shadow roots, so root mode registers it once at document level.
const flush = () => new Promise(r => setTimeout(r, 0));

let runtimes: BrowserRuntime[] = [];
beforeEach(() => {
  resetDocumentProperties();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});
afterEach(() => { runtimes.forEach(r => r.destroy()); runtimes = []; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function widget(html: string): ShadowRoot {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const sr = host.attachShadow({ mode: 'open' });
  sr.innerHTML = html;
  return sr;
}
const start = (opts: ConstructorParameters<typeof BrowserRuntime>[0]) => {
  const rt = new BrowserRuntime({ gcGraceMs: 30, ...opts });
  runtimes.push(rt);
  return rt;
};
const text = (el: Element) => (el as HTMLStyleElement).sheet
  ? Array.from((el as HTMLStyleElement).sheet!.cssRules, r => r.cssText).join('\n') + (el.textContent ?? '')
  : el.textContent ?? '';
const docStyles = () => Array.from(document.head.querySelectorAll('style'));
const rootCss = (sr: ShadowRoot) => Array.from(sr.querySelectorAll('style')).map(text).join('\n');

describe('#384 document-level @property registration in root mode', () => {
  it('writes only @property rules to the document, once, across roots, runtimes and later rules', async () => {
    const a = widget('<div class="shadow-lg p-4">a</div>');
    const b = widget('<div class="shadow-lg translate-x-2">b</div>');
    start({ root: a });
    start({ root: b, config: { theme: { extend: {} } } }); // a second runtime (other config) on the same document
    await flush();
    const styles = docStyles();
    expect(styles).toHaveLength(1);
    expect(styles[0].getAttribute('data-barocss')).toBe('document-properties');
    const rules = getDocumentPropertyRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every(r => /^\s*@property\s/.test(r))).toBe(true);
    expect(new Set(rules).size).toBe(rules.length); // idempotent
    expect(rules.some(r => r.includes('--baro-shadow '))).toBe(true);
    expect(rules.some(r => r.includes('--baro-translate-x'))).toBe(true);
    // no utilities, theme vars or preflight in the document
    expect(text(styles[0])).not.toMatch(/\.(p-4|shadow-lg)|:root|:host|font-family/);
    // a utility that appears later adds its @property rules to the same element
    const before = rules.length;
    a.querySelector('div')!.className = 'bg-gradient-to-b from-red-500';
    await flush();
    expect(docStyles()).toHaveLength(1);
    const after = getDocumentPropertyRules();
    expect(after.length).toBeGreaterThan(before);
    expect(after.some(r => r.includes('--baro-gradient-from'))).toBe(true);
    // utilities still live in the root; no :host fallback is needed
    expect(rootCss(a)).toMatch(/\.shadow-lg/);
    expect(rootCss(a)).not.toMatch(/@layer properties/);
  });

  it('keeps the registrations when every runtime is destroyed (global, harmless)', async () => {
    const rt = start({ root: widget('<div class="ring-2">x</div>') });
    await flush();
    rt.destroy();
    expect(docStyles()).toHaveLength(1);
    expect(getDocumentPropertyRules().length).toBeGreaterThan(0);
  });

  it('sets the nonce on the document <style>', async () => {
    start({ root: widget('<div class="shadow">x</div>'), nonce: 'n-384' });
    await flush();
    const styles = docStyles();
    expect(styles).toHaveLength(1);
    expect(styles[0].getAttribute('nonce')).toBe('n-384');
  });

  it('with constructable, uses one document adopted sheet and no <style> in the document', async () => {
    class MockSheet {
      cssRules: Array<{ cssText: string }> = [];
      replaceSync() {}
      insertRule(r: string, i: number) { this.cssRules.splice(i, 0, { cssText: r }); return i; }
      deleteRule(i: number) { this.cssRules.splice(i, 1); }
    }
    vi.stubGlobal('CSSStyleSheet', MockSheet);
    let adopted: unknown[] = [];
    Object.defineProperty(Document.prototype, 'adoptedStyleSheets', { configurable: true, get: () => adopted, set: (v: unknown[]) => { adopted = v; } });
    try {
      start({ root: widget('<div class="shadow-md">x</div>'), constructable: true });
      start({ root: widget('<div class="ring-1">y</div>'), constructable: true });
      await flush();
      expect(docStyles()).toHaveLength(0);
      expect(adopted).toHaveLength(1);
      const cssTexts = (adopted[0] as MockSheet).cssRules.map(r => r.cssText);
      expect(cssTexts.length).toBeGreaterThan(0);
      expect(cssTexts.every(t => /^\s*@property\s/.test(t))).toBe(true);
      expect(new Set(cssTexts).size).toBe(cssTexts.length);
    } finally {
      delete (Document.prototype as unknown as Record<string, unknown>).adoptedStyleSheets;
    }
  });

  it('falls back to :host initial values in the root when the document cannot take the rules', async () => {
    vi.spyOn(document.head, 'appendChild').mockImplementation(() => { throw new Error('closed'); });
    const sr = widget('<div class="translate-x-2 shadow-sm">x</div>');
    start({ root: sr });
    await flush();
    expect(docStyles()).toHaveLength(0);
    const css = rootCss(sr);
    expect(css).toMatch(/@layer properties/);
    expect(css).toMatch(/--baro-translate-y:\s*0/);
    expect(css).toMatch(/\.translate-x-2/);
    // the fallback layer comes first in the root (lowest layer), before the utilities
    expect(css.indexOf('@layer properties')).toBeLessThan(css.indexOf('.translate-x-2'));
  });

  it('propertyFallbackCss keeps only properties with an initial value', () => {
    const css = propertyFallbackCss([
      '@property --a { syntax: "*"; inherits: false; }',
      '@property --b { syntax: "<length>"; inherits: false; initial-value: 0px; }',
    ]);
    expect(css).toMatch(/--b: 0px/);
    expect(css).not.toMatch(/--a/);
    expect(css).toMatch(/:host, \*, ::before, ::after, ::backdrop/);
  });
});
