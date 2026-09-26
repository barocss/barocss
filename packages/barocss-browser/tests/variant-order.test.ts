import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';
import { StylePartitionManager } from '../src/style-partition-manager';
import { ruleSortKey, compareKeys } from '../src/rule-order';

const ruleTexts = () => Array.from(document.querySelectorAll<HTMLStyleElement>('[data-barocss="partition"]'))
  .flatMap(style => Array.from(style.sheet?.cssRules ?? []).map(rule => rule.cssText));

/** Index of the first injected rule whose text contains `needle`. */
const pos = (needle: string) => {
  const i = ruleTexts().findIndex(t => t.includes(needle));
  expect(i, needle).toBeGreaterThanOrEqual(0);
  return i;
};

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

describe('runtime keeps Tailwind variant order (#254)', () => {
  it('lg: seen before sm: and base still lands after them', () => {
    runtime = new BrowserRuntime();
    runtime.addClass('lg:px-8');
    runtime.addClass('sm:px-6');
    runtime.addClass('px-4');
    expect(pos('.px-4')).toBeLessThan(pos('.sm\\:px-6'));
    expect(pos('.sm\\:px-6')).toBeLessThan(pos('.lg\\:px-8'));
    // Winner at >= 1024px is the last matching rule: lg.
    const last = ruleTexts().filter(t => t.includes('padding-inline')).pop()!;
    expect(last).toContain('.lg\\:px-8');
  });

  it('orders the full min-width ladder regardless of discovery order', () => {
    runtime = new BrowserRuntime();
    for (const c of ['2xl:p-6', 'md:p-3', 'xl:p-5', 'p-1', 'lg:p-4', 'sm:p-2']) runtime.addClass(c);
    const order = ['.p-1', '.sm\\:p-2', '.md\\:p-3', '.lg\\:p-4', '.xl\\:p-5', 'xl\\:p-6 {'].map(pos);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('max-* sorts larger widths first, before min-width breakpoints', () => {
    runtime = new BrowserRuntime();
    for (const c of ['sm:m-4', 'max-sm:m-1', 'max-lg:m-2', 'm-3']) runtime.addClass(c);
    expect(pos('.m-3')).toBeLessThan(pos('.max-lg\\:m-2'));
    expect(pos('.max-lg\\:m-2')).toBeLessThan(pos('.max-sm\\:m-1'));
    expect(pos('.max-sm\\:m-1')).toBeLessThan(pos('.sm\\:m-4'));
  });

  it('@container queries: @max larger first, then @min ascending, after media', () => {
    runtime = new BrowserRuntime();
    for (const c of ['@lg:gap-4', '@md:gap-3', '@max-md:gap-1', '@max-lg:gap-2', 'lg:gap-5', 'gap-0']) runtime.addClass(c);
    const order = ['.gap-0', '.lg\\:gap-5', '.\\@max-lg\\:gap-2', '.\\@max-md\\:gap-1', '.\\@md\\:gap-3', '.\\@lg\\:gap-4'].map(pos);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('dark: (media) follows breakpoints; hover stays with base; nested sm:dark: sits between sm: and md:', () => {
    runtime = new BrowserRuntime();
    for (const c of ['dark:text-white', 'md:dark:text-red-500', 'hover:text-blue-500', 'sm:text-black', 'text-gray-500', 'md:text-green-500']) runtime.addClass(c);
    expect(pos('.text-gray-500')).toBeLessThan(pos('.hover\\:text-blue-500'));
    expect(pos('.hover\\:text-blue-500')).toBeLessThan(pos('.sm\\:text-black'));
    expect(pos('.md\\:text-green-500')).toBeLessThan(pos('.md\\:dark\\:text-red-500'));
    expect(pos('.md\\:text-green-500')).toBeLessThan(pos('.dark\\:text-white'));
  });

  it('uncategorised chunked partitions keep global order across <style> elements', () => {
    const mgr = new StylePartitionManager(document.head, 2, 'x-', () => undefined);
    const rules = [
      '@media (min-width: 64rem) { .a { color: red; } }',
      '@media (min-width: 64rem) { .b { color: red; } }',
      '@media (min-width: 64rem) { .c { color: red; } }',
      '@media (min-width: 40rem) { .d { color: red; } }',
      '.e { color: red; }',
    ];
    for (const r of rules) mgr.addRule(r);
    const texts = ruleTexts();
    const keys = texts.map(ruleSortKey);
    for (let i = 1; i < keys.length; i++) expect(compareKeys(keys[i - 1], keys[i])).toBeLessThanOrEqual(0);
    expect(texts.findIndex(t => t.includes('.e'))).toBe(0);
    expect(texts).toHaveLength(5);
    mgr.cleanup();
  });

  it('parses both media syntaxes and units', () => {
    expect(ruleSortKey('.x{}')).toEqual([]);
    expect(ruleSortKey('@media (min-width: 40rem){.x{}}')).toEqual([2, 640]);
    expect(ruleSortKey('@media (width >= 900px){.x{}}')).toEqual([2, 900]);
    expect(ruleSortKey('@media (width < 64rem){.x{}}')).toEqual([1, -1024]);
    expect(ruleSortKey('@container (width >= 28rem){.x{}}')).toEqual([4, 448]);
    expect(ruleSortKey('@media print{.x{}}')).toEqual([5, 0]);
    expect(ruleSortKey('@media (hover: hover){.x{}}')).toEqual([0, 0]);
    // #352: negated media sorts with base, before every breakpoint, as Tailwind 4.3.3 orders not-* variants
    expect(ruleSortKey('@media not (min-width: 48rem){.x{}}')).toEqual([0, 0]);
    expect(ruleSortKey('@media not (width < 48rem){.x{}}')).toEqual([0, 0]);
    expect(ruleSortKey('@media not print{.x{}}')).toEqual([0, 0]);
  });
});
