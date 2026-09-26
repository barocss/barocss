import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { functionalUtility } from '@barocss/kit';
import { BrowserRuntime } from '../src/browser-runtime';

// #333: a throwing class in a batch contributes nothing; the other classes in the batch still inject.
functionalUtility({ name: 'zz-throws-333', handleBareValue: () => { throw new Error('boom'); } });
const injected = () => Array.from(document.querySelectorAll<HTMLStyleElement>('[data-barocss="partition"]'))
  .flatMap(style => Array.from(style.sheet?.cssRules ?? []).map(rule => rule.cssText)).join('\n');

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

describe('#333 browser batch never throws', () => {
  it('keeps the valid classes of a batch with a throwing and a palette-object class', () => {
    runtime = new BrowserRuntime({ config: { theme: { extend: { colors: { brand: { 500: '#ff0000' } } } } } });
    expect(() => runtime!.addClass(['p-4', 'zz-throws-333-1', 'text-brand', 'underline'])).not.toThrow();
    const css = injected();
    expect(css).toContain('.p-4');
    expect(css).toContain('.underline');
    expect(css).not.toMatch(/zz-throws|\.text-brand/);
  });
});
