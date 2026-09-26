import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

// #401: runtime insertion follows Tailwind's property order across categories and partitions, so the
// broad utility precedes the narrow one whichever is used first (border border-l-4, flex-1 grow-0 ...).
const selectors = () => Array.from(document.head.querySelectorAll<HTMLStyleElement>('style'))
  .flatMap(style => Array.from(style.sheet?.cssRules ?? []))
  .map(rule => (rule as CSSStyleRule).selectorText)
  .filter(Boolean);

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

describe('runtime property order (#401)', () => {
  it.each([1, 2, 50])('narrow-first use still puts the broad utility first (maxRulesPerPartition=%i)', (max) => {
    runtime = new BrowserRuntime({ maxRulesPerPartition: max });
    const pairs = [['border', 'border-l-4'], ['flex-1', 'grow-0'], ['truncate', 'overflow-visible'], ['p-4', 'px-2']];
    for (const [, narrow] of pairs) runtime.addClass(narrow);
    for (const [broad] of pairs) runtime.addClass(broad);
    const sel = selectors();
    for (const [broad, narrow] of pairs) expect(sel.indexOf(`.${broad}`)).toBeLessThan(sel.indexOf(`.${narrow}`));
  });

  it('side-border utilities have a category', async () => {
    const { parseClassName } = await import('@barocss/kit');
    for (const c of ['border-l-4', 'border-t-0', 'border-x-0', 'border-y', 'border-s-2']) {
      expect(parseClassName(c).utility?.category).toBe('borders');
    }
  });
});
