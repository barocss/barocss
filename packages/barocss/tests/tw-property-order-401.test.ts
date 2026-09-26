import { describe, expect, it } from 'vitest';
import { createContext, generateCss, ruleSortKey, compareKeys } from '../src/index';
import { rulePropertySort, compareCandidates } from '../src/core/rule-order';
import { TW_PROPERTY_ORDER, TW_PROPERTY_ORDER_VERSION } from '../src/core/tw-property-order';

// #401: output follows Tailwind 4.3.3's candidate sort: variant order, then property order, then name.
const order = (classes: string) => {
  const css = generateCss(classes, createContext({}));
  return [...css.matchAll(/^\.([\w-]+)\s*\{/gm)].map((m) => m[1]);
};

describe('Tailwind property order (#401)', () => {
  it('ships the generated table with its provenance', () => {
    expect(TW_PROPERTY_ORDER_VERSION).toBe('4.3.3');
    expect(TW_PROPERTY_ORDER[0]).toBe('container-type');
    expect(TW_PROPERTY_ORDER.indexOf('padding')).toBeLessThan(TW_PROPERTY_ORDER.indexOf('padding-inline'));
  });

  it.each([
    ['p-4', 'px-2'], ['border', 'border-l-4'], ['size-4', 'w-8'], ['flex-1', 'grow-0'], ['truncate', 'overflow-visible'],
    ['rounded-lg', 'rounded-tl-none'], ['bg-blue-500', 'bg-red-500'], ['text-lg', 'text-sm'],
  ])('%s sorts before %s whatever the input order', (a, b) => {
    expect(order(`${a} ${b}`)).toEqual([a, b]);
    expect(order(`${b} ${a}`)).toEqual([a, b]);
  });

  it('keeps variant order primary', () => {
    expect(order('md:p-4 px-2 p-4').slice(0, 2)).toEqual(['p-4', 'px-2']);
    expect(ruleSortKey('@media (min-width: 40rem){.sm\\:p-4{padding:1rem}}', 'sm:p-4').slice(0, 2)).toEqual([2, 640]);
  });

  it('breaks equal property sets by declaration count (more first), then by name', () => {
    const one = rulePropertySort('.a{overflow:hidden}');
    const three = rulePropertySort('.b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}');
    expect(three.order[0]).toBe(one.order[0]);
    expect(compareKeys(ruleSortKey('.x{--tw-a:1;color:red}', 'x'), ruleSortKey('.y{color:red}', 'y'))).toBeLessThan(0);
    expect(compareCandidates('p-2', 'p-10')).toBeLessThan(0);
  });
});
