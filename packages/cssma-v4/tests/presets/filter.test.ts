import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({
  theme: {},
});

describe('filter', () => {
  it('filter → filter: var(--tw-filter)', () => {
    expect(applyClassName('filter', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'var(--tw-filter)' },
    ]);
  });
  it('filter-none → filter: none', () => {
    expect(applyClassName('filter-none', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'none' },
    ]);
  });
  it('filter-[blur(2px)_brightness(0.5)] → filter: blur(2px) brightness(0.5)', () => {
    expect(applyClassName('filter-[blur(2px)_brightness(0.5)]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(2px) brightness(0.5)' },
    ]);
  });
  it('filter-(--my-filter) → filter: var(--my-filter)', () => {
    expect(applyClassName('filter-(--my-filter)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'var(--my-filter)' },
    ]);
  });
});

describe('blur', () => {
  it('blur-xs → filter: blur(var(--blur-xs))', () => {
    expect(applyClassName('blur-xs', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-xs))' },
    ]);
  });
  it('blur-sm → filter: blur(var(--blur-sm))', () => {
    expect(applyClassName('blur-sm', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-sm))' },
    ]);
  });
  it('blur-md → filter: blur(var(--blur-md))', () => {
    expect(applyClassName('blur-md', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-md))' },
    ]);
  });
  it('blur-lg → filter: blur(var(--blur-lg))', () => {
    expect(applyClassName('blur-lg', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-lg))' },
    ]);
  });
  it('blur-xl → filter: blur(var(--blur-xl))', () => {
    expect(applyClassName('blur-xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-xl))' },
    ]);
  });
  it('blur-2xl → filter: blur(var(--blur-2xl))', () => {
    expect(applyClassName('blur-2xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-2xl))' },
    ]);
  });
  it('blur-3xl → filter: blur(var(--blur-3xl))', () => {
    expect(applyClassName('blur-3xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-3xl))' },
    ]);
  });
  it('blur-none → filter: ', () => {
    expect(applyClassName('blur-none', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: '' },
    ]);
  });
  it('blur-[2px] → filter: blur(2px)', () => {
    expect(applyClassName('blur-[2px]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(2px)' },
    ]);
  });
  it('blur-(--my-blur) → filter: blur(var(--my-blur))', () => {
    expect(applyClassName('blur-(--my-blur)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--my-blur))' },
    ]);
  });
});

describe('brightness', () => {
  it('brightness-0 → filter: brightness(0%)', () => {
    expect(applyClassName('brightness-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(0%)' },
    ]);
  });
  it('brightness-50 → filter: brightness(50%)', () => {
    expect(applyClassName('brightness-50', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(50%)' },
    ]);
  });
  it('brightness-75 → filter: brightness(75%)', () => {
    expect(applyClassName('brightness-75', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(75%)' },
    ]);
  });
  it('brightness-90 → filter: brightness(90%)', () => {
    expect(applyClassName('brightness-90', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(90%)' },
    ]);
  });
  it('brightness-95 → filter: brightness(95%)', () => {
    expect(applyClassName('brightness-95', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(95%)' },
    ]);
  });
  it('brightness-100 → filter: brightness(100%)', () => {
    expect(applyClassName('brightness-100', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(100%)' },
    ]);
  });
  it('brightness-105 → filter: brightness(105%)', () => {
    expect(applyClassName('brightness-105', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(105%)' },
    ]);
  });
  it('brightness-110 → filter: brightness(110%)', () => {
    expect(applyClassName('brightness-110', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(110%)' },
    ]);
  });
  it('brightness-125 → filter: brightness(125%)', () => {
    expect(applyClassName('brightness-125', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(125%)' },
    ]);
  });
  it('brightness-150 → filter: brightness(150%)', () => {
    expect(applyClassName('brightness-150', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(150%)' },
    ]);
  });
  it('brightness-200 → filter: brightness(200%)', () => {
    expect(applyClassName('brightness-200', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(200%)' },
    ]);
  });
  it('brightness-[1.25] → filter: brightness(1.25)', () => {
    expect(applyClassName('brightness-[1.25]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(1.25)' },
    ]);
  });
  it('brightness-(--my-brightness) → filter: brightness(var(--my-brightness))', () => {
    expect(applyClassName('brightness-(--my-brightness)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(var(--my-brightness))' },
    ]);
  });
});

describe('contrast', () => {
  it('contrast-0 → filter: contrast(0%)', () => {
    expect(applyClassName('contrast-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(0%)' },
    ]);
  });
  it('contrast-50 → filter: contrast(50%)', () => {
    expect(applyClassName('contrast-50', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(50%)' },
    ]);
  });
  it('contrast-75 → filter: contrast(75%)', () => {
    expect(applyClassName('contrast-75', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(75%)' },
    ]);
  });
  it('contrast-100 → filter: contrast(100%)', () => {
    expect(applyClassName('contrast-100', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(100%)' },
    ]);
  });
  it('contrast-125 → filter: contrast(125%)', () => {
    expect(applyClassName('contrast-125', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(125%)' },
    ]);
  });
  it('contrast-150 → filter: contrast(150%)', () => {
    expect(applyClassName('contrast-150', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(150%)' },
    ]);
  });
  it('contrast-200 → filter: contrast(200%)', () => {
    expect(applyClassName('contrast-200', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(200%)' },
    ]);
  });
  it('contrast-120 → filter: contrast(120%)', () => {
    expect(applyClassName('contrast-120', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(120%)' },
    ]);
  });
  it('contrast-[1.5] → filter: contrast(1.5)', () => {
    expect(applyClassName('contrast-[1.5]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(1.5)' },
    ]);
  });
  it('contrast-(--my-contrast) → filter: contrast(var(--my-contrast))', () => {
    expect(applyClassName('contrast-(--my-contrast)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(var(--my-contrast))' },
    ]);
  });
});

describe('drop-shadow', () => {
  it('drop-shadow-xs → filter: drop-shadow(var(--drop-shadow-xs))', () => {
    expect(applyClassName('drop-shadow-xs', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-xs))' },
    ]);
  });
  it('drop-shadow-sm → filter: drop-shadow(var(--drop-shadow-sm))', () => {
    expect(applyClassName('drop-shadow-sm', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-sm))' },
    ]);
  });
  it('drop-shadow-md → filter: drop-shadow(var(--drop-shadow-md))', () => {
    expect(applyClassName('drop-shadow-md', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-md))' },
    ]);
  });
  it('drop-shadow-lg → filter: drop-shadow(var(--drop-shadow-lg))', () => {
    expect(applyClassName('drop-shadow-lg', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-lg))' },
    ]);
  });
  it('drop-shadow-xl → filter: drop-shadow(var(--drop-shadow-xl))', () => {
    expect(applyClassName('drop-shadow-xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-xl))' },
    ]);
  });
  it('drop-shadow-2xl → filter: drop-shadow(var(--drop-shadow-2xl))', () => {
    expect(applyClassName('drop-shadow-2xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-2xl))' },
    ]);
  });
  it('drop-shadow-3xl → filter: drop-shadow(var(--drop-shadow-3xl))', () => {
    expect(applyClassName('drop-shadow-3xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-3xl))' },
    ]);
  });
  it('drop-shadow-none → filter: drop-shadow(0 0 #0000)', () => {
    expect(applyClassName('drop-shadow-none', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(0 0 #0000)' },
    ]);
  });
  it('drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] → filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1))', () => {
    expect(applyClassName('drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' },
    ]);
  });
  it('drop-shadow-(--my-shadow) → filter: drop-shadow(var(--my-shadow))', () => {
    expect(applyClassName('drop-shadow-(--my-shadow)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--my-shadow))' },
    ]);
  });
}); 