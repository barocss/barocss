import { describe, it, expect } from 'vitest';
import { selectorTreeToCssSelector } from '../../src/converter/selector';

const ctx = {} as any;

describe('selectorTreeToCssSelector', () => {
  it('basic class', () => {
    expect(selectorTreeToCssSelector([
      { type: 'class', value: '.text-red-500' }
    ], ctx)).toBe('.text-red-500');
  });

  it('pseudo selector', () => {
    expect(selectorTreeToCssSelector([
      { type: 'class', value: '.hover:text-red-500' },
      { type: 'pseudo', value: ':hover' }
    ], ctx)).toBe('.hover:text-red-500:hover');
  });

  it('group modifier', () => {
    expect(selectorTreeToCssSelector([
      { type: 'group', value: '.group:hover' },
      { type: 'class', value: '.text-blue-500' }
    ], ctx)).toBe('.group:hover .text-blue-500');
  });

  it('peer modifier', () => {
    expect(selectorTreeToCssSelector([
      { type: 'peer', value: '.peer:focus' },
      { type: 'class', value: '.underline' }
    ], ctx)).toBe('.peer:focus ~ .underline');
  });

  it('attribute selector', () => {
    expect(selectorTreeToCssSelector([
      { type: 'attribute', value: '[aria-checked=true]' },
      { type: 'class', value: '.bg-green-500' }
    ], ctx)).toBe('[aria-checked=true] .bg-green-500');
  });

  it('container modifier', () => {
    expect(selectorTreeToCssSelector([
      { type: 'container', value: '.container' },
      { type: 'class', value: '.p-4' }
    ], ctx)).toBe('.container .p-4');
  });

  it('logical selector', () => {
    expect(selectorTreeToCssSelector([
      { type: 'logical', value: ':is(section,article)' },
      { type: 'class', value: '.mb-2' }
    ], ctx)).toBe(':is(section,article) .mb-2');
  });

  it('theme selector', () => {
    expect(selectorTreeToCssSelector([
      { type: 'theme', value: '.dark' },
      { type: 'class', value: '.text-white' }
    ], ctx)).toBe('.dark .text-white');
  });

  it('media query', () => {
    expect(selectorTreeToCssSelector([
      { type: 'media', value: '@media (min-width: 640px)' },
      { type: 'class', value: '.sm:text-lg' }
    ], ctx)).toBe('@media (min-width: 640px) { .sm:text-lg }');
  });

  it('complex: group + peer + attr + theme + container + logical + pseudo', () => {
    expect(selectorTreeToCssSelector([
      { type: 'group', value: '.group:focus' },
      { type: 'peer', value: '.peer:active' },
      { type: 'attribute', value: '[data-state=open]' },
      { type: 'theme', value: '.dark' },
      { type: 'container', value: '.container' },
      { type: 'logical', value: ':is(nav,aside)' },
      { type: 'class', value: '.text-xl' },
      { type: 'pseudo', value: ':hover' }
    ], ctx)).toBe('.group:focus .peer:active ~ [data-state=open] .dark .container :is(nav,aside) .text-xl:hover');
  });

  it('media + everything', () => {
    expect(selectorTreeToCssSelector([
      { type: 'media', value: '@media (min-width: 1024px)' },
      { type: 'group', value: '.group:active' },
      { type: 'peer', value: '.peer:checked' },
      { type: 'attribute', value: '[role=tab]' },
      { type: 'theme', value: '.light' },
      { type: 'container', value: '.container' },
      { type: 'logical', value: ':is(header,footer)' },
      { type: 'class', value: '.font-bold' },
      { type: 'pseudo', value: ':focus' }
    ], ctx)).toBe('@media (min-width: 1024px) { .group:active .peer:checked ~ [role=tab] .light .container :is(header,footer) .font-bold:focus }');
  });

  it('placeholder modifier', () => {
    expect(selectorTreeToCssSelector([
      { type: 'pseudo', value: '::placeholder' },
      { type: 'class', value: '.text-blue-500' }
    ], ctx)).toBe('.text-blue-500::placeholder');
  });
}); 