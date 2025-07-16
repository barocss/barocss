import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({
  theme: {
    colors: {
      red: {
        500: '#bada55',
      },
    },
  },
});

describe('backdrop-filter', () => {
  it('backdrop-filter → backdrop-filter: var(--tw-backdrop-filter)', () => {
    expect(applyClassName('backdrop-filter', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'var(--tw-backdrop-filter)' },
    ]);
  });
  it('backdrop-filter-none → backdrop-filter: none', () => {
    expect(applyClassName('backdrop-filter-none', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'none' },
    ]);
  });
  it('backdrop-filter-[blur(2px)_brightness(0.5)] → backdrop-filter: blur(2px) brightness(0.5)', () => {
    expect(applyClassName('backdrop-filter-[blur(2px)_brightness(0.5)]', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(2px) brightness(0.5)' },
    ]);
  });
  it('backdrop-filter-(--my-filter) → backdrop-filter: var(--my-filter)', () => {
    expect(applyClassName('backdrop-filter-(--my-filter)', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'var(--my-filter)' },
    ]);
  });
});

describe('blur', () => {
  it('backdrop-blur-xs → backdrop-filter: blur(var(--blur-xs))', () => {
    expect(applyClassName('backdrop-blur-xs', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(var(--blur-xs))' },
    ]);
  });
  it('backdrop-blur-sm → backdrop-filter: blur(var(--blur-sm))', () => {
    expect(applyClassName('backdrop-blur-sm', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(var(--blur-sm))' },
    ]);
  });
  it('backdrop-blur-md → backdrop-filter: blur(var(--blur-md))', () => {
    expect(applyClassName('backdrop-blur-md', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(var(--blur-md))' },
    ]);
  });
  it('backdrop-blur-lg → backdrop-filter: blur(var(--blur-lg))', () => {
    expect(applyClassName('backdrop-blur-lg', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(var(--blur-lg))' },
    ]);
  });
  it('backdrop-blur-xl → backdrop-filter: blur(var(--blur-xl))', () => {
    expect(applyClassName('backdrop-blur-xl', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(var(--blur-xl))' },
    ]);
  });
  it('backdrop-blur-2xl → backdrop-filter: blur(var(--blur-2xl))', () => {
    expect(applyClassName('backdrop-blur-2xl', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(var(--blur-2xl))' },
    ]);
  });
  it('backdrop-blur-3xl → backdrop-filter: blur(var(--blur-3xl))', () => {
    expect(applyClassName('backdrop-blur-3xl', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(var(--blur-3xl))' },
    ]);
  });
  it('backdrop-blur-none → backdrop-filter: ', () => {
    expect(applyClassName('backdrop-blur-none', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: '' },
    ]);
  });
  it('backdrop-blur-[2px] → backdrop-filter: blur(2px)', () => {
    expect(applyClassName('backdrop-blur-[2px]', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(2px)' },
    ]);
  });
  it('backdrop-blur-(--my-blur) → backdrop-filter: blur(var(--my-blur))', () => {
    expect(applyClassName('backdrop-blur-(--my-blur)', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(var(--my-blur))' },
    ]);
  });
});

describe('brightness', () => {
  it('backdrop-brightness-0 → backdrop-filter: brightness(0%)', () => {
    expect(applyClassName('backdrop-brightness-0', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(0%)' },
    ]);
  });
  it('backdrop-brightness-50 → backdrop-filter: brightness(50%)', () => {
    expect(applyClassName('backdrop-brightness-50', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(50%)' },
    ]);
  });
  it('backdrop-brightness-75 → backdrop-filter: brightness(75%)', () => {
    expect(applyClassName('backdrop-brightness-75', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(75%)' },
    ]);
  });
  it('backdrop-brightness-90 → backdrop-filter: brightness(90%)', () => {
    expect(applyClassName('backdrop-brightness-90', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(90%)' },
    ]);
  });
  it('backdrop-brightness-95 → backdrop-filter: brightness(95%)', () => {
    expect(applyClassName('backdrop-brightness-95', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(95%)' },
    ]);
  });
  it('backdrop-brightness-100 → backdrop-filter: brightness(100%)', () => {
    expect(applyClassName('backdrop-brightness-100', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(100%)' },
    ]);
  });
  it('backdrop-brightness-105 → backdrop-filter: brightness(105%)', () => {
    expect(applyClassName('backdrop-brightness-105', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(105%)' },
    ]);
  });
  it('backdrop-brightness-110 → backdrop-filter: brightness(110%)', () => {
    expect(applyClassName('backdrop-brightness-110', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(110%)' },
    ]);
  });
  it('backdrop-brightness-125 → backdrop-filter: brightness(125%)', () => {
    expect(applyClassName('backdrop-brightness-125', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(125%)' },
    ]);
  });
  it('backdrop-brightness-150 → backdrop-filter: brightness(150%)', () => {
    expect(applyClassName('backdrop-brightness-150', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(150%)' },
    ]);
  });
  it('backdrop-brightness-200 → backdrop-filter: brightness(200%)', () => {
    expect(applyClassName('backdrop-brightness-200', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(200%)' },
    ]);
  });
  it('backdrop-brightness-[1.25] → backdrop-filter: brightness(1.25)', () => {
    expect(applyClassName('backdrop-brightness-[1.25]', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(1.25)' },
    ]);
  });
  it('backdrop-brightness-(--my-brightness) → backdrop-filter: brightness(var(--my-brightness))', () => {
    expect(applyClassName('backdrop-brightness-(--my-brightness)', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'brightness(var(--my-brightness))' },
    ]);
  });
});

describe('contrast', () => {
  it('backdrop-contrast-0 → backdrop-filter: contrast(0%)', () => {
    expect(applyClassName('backdrop-contrast-0', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(0%)' },
    ]);
  });
  it('backdrop-contrast-50 → backdrop-filter: contrast(50%)', () => {
    expect(applyClassName('backdrop-contrast-50', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(50%)' },
    ]);
  });
  it('backdrop-contrast-75 → backdrop-filter: contrast(75%)', () => {
    expect(applyClassName('backdrop-contrast-75', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(75%)' },
    ]);
  });
  it('backdrop-contrast-100 → backdrop-filter: contrast(100%)', () => {
    expect(applyClassName('backdrop-contrast-100', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(100%)' },
    ]);
  });
  it('backdrop-contrast-125 → backdrop-filter: contrast(125%)', () => {
    expect(applyClassName('backdrop-contrast-125', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(125%)' },
    ]);
  });
  it('backdrop-contrast-150 → backdrop-filter: contrast(150%)', () => {
    expect(applyClassName('backdrop-contrast-150', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(150%)' },
    ]);
  });
  it('backdrop-contrast-200 → backdrop-filter: contrast(200%)', () => {
    expect(applyClassName('backdrop-contrast-200', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(200%)' },
    ]);
  });
  it('backdrop-contrast-120 → backdrop-filter: contrast(120%)', () => {
    expect(applyClassName('backdrop-contrast-120', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(120%)' },
    ]);
  });
  it('backdrop-contrast-[1.5] → backdrop-filter: contrast(1.5)', () => {
    expect(applyClassName('backdrop-contrast-[1.5]', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(1.5)' },
    ]);
  });
  it('backdrop-contrast-(--my-contrast) → backdrop-filter: contrast(var(--my-contrast))', () => {
    expect(applyClassName('backdrop-contrast-(--my-contrast)', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'contrast(var(--my-contrast))' },
    ]);
  });
});

describe('grayscale', () => {
  it('backdrop-grayscale → backdrop-filter: grayscale(100%)', () => {
    expect(applyClassName('backdrop-grayscale', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'grayscale(100%)' },
    ]);
  });
  it('backdrop-grayscale-0 → backdrop-filter: grayscale(0%)', () => {
    expect(applyClassName('backdrop-grayscale-0', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'grayscale(0%)' },
    ]);
  });
  it('backdrop-grayscale-25 → backdrop-filter: grayscale(25%)', () => {
    expect(applyClassName('backdrop-grayscale-25', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'grayscale(25%)' },
    ]);
  });
  it('backdrop-grayscale-50 → backdrop-filter: grayscale(50%)', () => {
    expect(applyClassName('backdrop-grayscale-50', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'grayscale(50%)' },
    ]);
  });
  it('backdrop-grayscale-75 → backdrop-filter: grayscale(75%)', () => {
    expect(applyClassName('backdrop-grayscale-75', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'grayscale(75%)' },
    ]);
  });
  it('backdrop-grayscale-100 → backdrop-filter: grayscale(100%)', () => {
    expect(applyClassName('backdrop-grayscale-100', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'grayscale(100%)' },
    ]);
  });
  it('backdrop-grayscale-60 → backdrop-filter: grayscale(60%)', () => {
    expect(applyClassName('backdrop-grayscale-60', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'grayscale(60%)' },
    ]);
  });
  it('backdrop-grayscale-[.33] → backdrop-filter: grayscale(.33)', () => {
    expect(applyClassName('backdrop-grayscale-[.33]', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'grayscale(.33)' },
    ]);
  });
  it('backdrop-grayscale-(--my-gray) → backdrop-filter: grayscale(var(--my-gray))', () => {
    expect(applyClassName('backdrop-grayscale-(--my-gray)', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'grayscale(var(--my-gray))' },
    ]);
  });
});

describe('hue-rotate', () => {
  it('backdrop-hue-rotate-0 → backdrop-filter: hue-rotate(0deg)', () => {
    expect(applyClassName('backdrop-hue-rotate-0', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(0deg)' },
    ]);
  });
  it('backdrop-hue-rotate-15 → backdrop-filter: hue-rotate(15deg)', () => {
    expect(applyClassName('backdrop-hue-rotate-15', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(15deg)' },
    ]);
  });
  it('backdrop-hue-rotate-30 → backdrop-filter: hue-rotate(30deg)', () => {
    expect(applyClassName('backdrop-hue-rotate-30', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(30deg)' },
    ]);
  });
  it('backdrop-hue-rotate-60 → backdrop-filter: hue-rotate(60deg)', () => {
    expect(applyClassName('backdrop-hue-rotate-60', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(60deg)' },
    ]);
  });
  it('backdrop-hue-rotate-90 → backdrop-filter: hue-rotate(90deg)', () => {
    expect(applyClassName('backdrop-hue-rotate-90', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(90deg)' },
    ]);
  });
  it('backdrop-hue-rotate-180 → backdrop-filter: hue-rotate(180deg)', () => {
    expect(applyClassName('backdrop-hue-rotate-180', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(180deg)' },
    ]);
  });
  it('-backdrop-hue-rotate-0 → backdrop-filter: hue-rotate(calc(0deg * -1))', () => {
    expect(applyClassName('-backdrop-hue-rotate-0', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(calc(0deg * -1))' },
    ]);
  });
  it('-backdrop-hue-rotate-15 → backdrop-filter: hue-rotate(calc(15deg * -1))', () => {
    expect(applyClassName('-backdrop-hue-rotate-15', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(calc(15deg * -1))' },
    ]);
  });
  it('-backdrop-hue-rotate-30 → backdrop-filter: hue-rotate(calc(30deg * -1))', () => {
    expect(applyClassName('-backdrop-hue-rotate-30', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(calc(30deg * -1))' },
    ]);
  });
  it('-backdrop-hue-rotate-60 → backdrop-filter: hue-rotate(calc(60deg * -1))', () => {
    expect(applyClassName('-backdrop-hue-rotate-60', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(calc(60deg * -1))' },
    ]);
  });
  it('-backdrop-hue-rotate-90 → backdrop-filter: hue-rotate(calc(90deg * -1))', () => {
    expect(applyClassName('-backdrop-hue-rotate-90', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(calc(90deg * -1))' },
    ]);
  });
  it('-backdrop-hue-rotate-180 → backdrop-filter: hue-rotate(calc(180deg * -1))', () => {
    expect(applyClassName('-backdrop-hue-rotate-180', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(calc(180deg * -1))' },
    ]);
  });
  it('backdrop-hue-rotate-45 → backdrop-filter: hue-rotate(45deg)', () => {
    expect(applyClassName('backdrop-hue-rotate-45', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(45deg)' },
    ]);
  });
  it('-backdrop-hue-rotate-45 → backdrop-filter: hue-rotate(calc(45deg * -1))', () => {
    expect(applyClassName('-backdrop-hue-rotate-45', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(calc(45deg * -1))' },
    ]);
  });
  it('backdrop-hue-rotate-[77deg] → backdrop-filter: hue-rotate(77deg)', () => {
    expect(applyClassName('backdrop-hue-rotate-[77deg]', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(77deg)' },
    ]);
  });
  it('backdrop-hue-rotate-(--my-hue) → backdrop-filter: hue-rotate(var(--my-hue))', () => {
    expect(applyClassName('backdrop-hue-rotate-(--my-hue)', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'hue-rotate(var(--my-hue))' },
    ]);
  });
});

describe('invert', () => {
  it('backdrop-invert → backdrop-filter: invert(100%)', () => {
    expect(applyClassName('backdrop-invert', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'invert(100%)' },
    ]);
  });
  it('backdrop-invert-0 → backdrop-filter: invert(0%)', () => {
    expect(applyClassName('backdrop-invert-0', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'invert(0%)' },
    ]);
  });
  it('backdrop-invert-20 → backdrop-filter: invert(20%)', () => {
    expect(applyClassName('backdrop-invert-20', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'invert(20%)' },
    ]);
  });
  it('backdrop-invert-[.25] → backdrop-filter: invert(.25)', () => {
    expect(applyClassName('backdrop-invert-[.25]', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'invert(.25)' },
    ]);
  });
  it('backdrop-invert-(--my-inversion) → backdrop-filter: invert(var(--my-inversion))', () => {
    expect(applyClassName('backdrop-invert-(--my-inversion)', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'invert(var(--my-inversion))' },
    ]);
  });
});

describe('saturate', () => {
  it('backdrop-saturate-0 → backdrop-filter: saturate(0%)', () => {
    expect(applyClassName('backdrop-saturate-0', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'saturate(0%)' },
    ]);
  });
  it('backdrop-saturate-50 → backdrop-filter: saturate(50%)', () => {
    expect(applyClassName('backdrop-saturate-50', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'saturate(50%)' },
    ]);
  });
  it('backdrop-saturate-100 → backdrop-filter: saturate(100%)', () => {
    expect(applyClassName('backdrop-saturate-100', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'saturate(100%)' },
    ]);
  });
  it('backdrop-saturate-150 → backdrop-filter: saturate(150%)', () => {
    expect(applyClassName('backdrop-saturate-150', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'saturate(150%)' },
    ]);
  });
  it('backdrop-saturate-200 → backdrop-filter: saturate(200%)', () => {
    expect(applyClassName('backdrop-saturate-200', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'saturate(200%)' },
    ]);
  });
  it('backdrop-saturate-[.33] → backdrop-filter: saturate(.33)', () => {
    expect(applyClassName('backdrop-saturate-[.33]', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'saturate(.33)' },
    ]);
  });
  it('backdrop-saturate-(--my-saturate) → backdrop-filter: saturate(var(--my-saturate))', () => {
    expect(applyClassName('backdrop-saturate-(--my-saturate)', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'saturate(var(--my-saturate))' },
    ]);
  });
});

describe('sepia', () => {
  it('backdrop-sepia → backdrop-filter: sepia(100%)', () => {
    expect(applyClassName('backdrop-sepia', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'sepia(100%)' },
    ]);
  });
  it('backdrop-sepia-0 → backdrop-filter: sepia(0%)', () => {
    expect(applyClassName('backdrop-sepia-0', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'sepia(0%)' },
    ]);
  });
  it('backdrop-sepia-50 → backdrop-filter: sepia(50%)', () => {
    expect(applyClassName('backdrop-sepia-50', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'sepia(50%)' },
    ]);
  });
  it('backdrop-sepia-100 → backdrop-filter: sepia(100%)', () => {
    expect(applyClassName('backdrop-sepia-100', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'sepia(100%)' },
    ]);
  });
  it('backdrop-sepia-[.33] → backdrop-filter: sepia(.33)', () => {
    expect(applyClassName('backdrop-sepia-[.33]', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'sepia(.33)' },
    ]);
  });
  it('backdrop-sepia-(--my-sepia) → backdrop-filter: sepia(var(--my-sepia))', () => {
    expect(applyClassName('backdrop-sepia-(--my-sepia)', ctx)).toEqual([
      { type: 'decl', prop: 'backdrop-filter', value: 'sepia(var(--my-sepia))' },
    ]);
  });
}); 