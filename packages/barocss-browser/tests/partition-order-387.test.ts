import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

// #387: with small partitions, an overflow chunk (<style> partition-N) used to be appended after the
// category partitions created since partition-0, so its rules beat category rules they precede in a
// one-partition sheet (shadow-[…var(--x)] vs shadow-md in the effects partition).
const ruleTexts = () => Array.from(document.head.querySelectorAll<HTMLStyleElement>('style'))
  .flatMap(style => Array.from(style.sheet?.cssRules ?? []).map(rule => rule.cssText));

const corpus = [
  'shadow-md', 'px-4', 'sm:px-6', 'lg:px-8', 'text-sm', 'bg-red-500', 'flex', 'grid-cols-2', 'rounded-md',
  'border', 'p-2', 'hover:bg-blue-500', 'md:flex', 'w-full', 'h-4', 'opacity-50', 'transition',
  'shadow-[0_0_0_1px_var(--sidebar-border)]', 'shadow-[0_1px_2px_var(--x)]', 'ring-2', 'ring-red-500',
  'translate-x-1', 'gap-2', 'mt-4', 'font-bold', 'focus:shadow-lg', 'data-[state=open]:shadow-md',
];

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

function orderWith(maxRulesPerPartition: number) {
  document.head.innerHTML = '';
  runtime = new BrowserRuntime({ maxRulesPerPartition });
  for (const c of corpus) runtime.addClass(c);
  const texts = ruleTexts();
  runtime.destroy(); runtime = undefined;
  return texts;
}

describe('rule order across partitions matches the single-sheet order (#387)', () => {
  it.each([1, 2, 3, 50])('maxRulesPerPartition=%i gives the one-partition order', (size) => {
    const single = orderWith(100000);
    expect(orderWith(size)).toEqual(single);
  });

  it('shadow-[…var(--x)] keeps its place relative to shadow-md across a boundary', () => {
    const at = (texts: string[], needle: string) => texts.findIndex(t => t.startsWith(needle));
    for (const size of [1, 2, 50, 100000]) {
      const texts = orderWith(size);
      const md = at(texts, '.shadow-md');
      const arb = at(texts, '.shadow-\\[0_0_0_1px');
      expect(md, `size ${size}`).toBeGreaterThanOrEqual(0);
      expect(arb, `size ${size}`).toBeGreaterThanOrEqual(0);
      expect(arb < md, `size ${size}`).toBe(at(orderWith(100000), '.shadow-\\[0_0_0_1px') < at(orderWith(100000), '.shadow-md'));
    }
  });
});
