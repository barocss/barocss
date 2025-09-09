import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
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

const filters = () => {
  return [
    { type: 'decl', prop: '-webkit-backdrop-filter', value: 'var(--baro-backdrop-blur, ) var(--baro-backdrop-brightness, ) var(--baro-backdrop-contrast, ) var(--baro-backdrop-grayscale, ) var(--baro-backdrop-hue-rotate, ) var(--baro-backdrop-invert, ) var(--baro-backdrop-saturate, ) var(--baro-backdrop-sepia, )' },
    { type: 'decl', prop: 'backdrop-filter', value: 'var(--baro-backdrop-blur, ) var(--baro-backdrop-brightness, ) var(--baro-backdrop-contrast, ) var(--baro-backdrop-grayscale, ) var(--baro-backdrop-hue-rotate, ) var(--baro-backdrop-invert, ) var(--baro-backdrop-saturate, ) var(--baro-backdrop-sepia, )' },
  ]
}

describe('backdrop-filter', () => {
  it('backdrop-filter → backdrop-filter: var(--baro-backdrop-filter)', () => {
    expect(parseClassToAst('backdrop-filter', ctx)).toMatchObject([
      { type: 'decl', prop: 'backdrop-filter', value: 'var(--baro-backdrop-filter)' },
    ]);
  });
  it('backdrop-filter-none → backdrop-filter: none', () => {
    expect(parseClassToAst('backdrop-filter-none', ctx)).toMatchObject([
      { type: 'decl', prop: 'backdrop-filter', value: 'none' },
    ]);
  });
  it('backdrop-filter-[blur(2px)_brightness(0.5)] → backdrop-filter: blur(2px) brightness(0.5)', () => {
    expect(parseClassToAst('backdrop-filter-[blur(2px)_brightness(0.5)]', ctx)).toMatchObject([
      { type: 'decl', prop: 'backdrop-filter', value: 'blur(2px) brightness(0.5)' },
    ]);
  });
  it('backdrop-filter-(--my-filter) → backdrop-filter: var(--my-filter)', () => {
    expect(parseClassToAst('backdrop-filter-(--my-filter)', ctx)).toMatchObject([
      { type: 'decl', prop: 'backdrop-filter', value: 'var(--my-filter)' },
    ]);
  });
});

describe('blur', () => {
  it('backdrop-blur-xs → backdrop-filter: blur(var(--blur-xs))', () => {
    expect(parseClassToAst('backdrop-blur-xs', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: 'blur(var(--blur-xs))' },
      ...filters(),
    ]);
  });
  it('backdrop-blur-sm → backdrop-filter: blur(var(--blur-sm))', () => {
    expect(parseClassToAst('backdrop-blur-sm', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: 'blur(var(--blur-sm))' },
      ...filters(),
    ]);
  });
  it('backdrop-blur-md → backdrop-filter: blur(var(--blur-md))', () => {
    expect(parseClassToAst('backdrop-blur-md', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: 'blur(var(--blur-md))' },
      ...filters(),
    ]);
  });
  it('backdrop-blur-lg → backdrop-filter: blur(var(--blur-lg))', () => {
    expect(parseClassToAst('backdrop-blur-lg', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: 'blur(var(--blur-lg))' },
      ...filters(),
    ]);
  });
  it('backdrop-blur-xl → backdrop-filter: blur(var(--blur-xl))', () => {
    expect(parseClassToAst('backdrop-blur-xl', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: 'blur(var(--blur-xl))' },
      ...filters(),
    ]);
  });
  it('backdrop-blur-2xl → backdrop-filter: blur(var(--blur-2xl))', () => {
    expect(parseClassToAst('backdrop-blur-2xl', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: 'blur(var(--blur-2xl))' },
      ...filters(),
    ]);
  });
  it('backdrop-blur-3xl → backdrop-filter: blur(var(--blur-3xl))', () => {
    expect(parseClassToAst('backdrop-blur-3xl', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: 'blur(var(--blur-3xl))' },
      ...filters(),
    ]);
  });
  it('backdrop-blur-none → backdrop-filter: ', () => {
    expect(parseClassToAst('backdrop-blur-none', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: '' },
      ...filters(),
    ]);
  });
  it('backdrop-blur-[2px] → backdrop-filter: blur(2px)', () => {
    expect(parseClassToAst('backdrop-blur-[2px]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: 'blur(2px)' },
      ...filters(),
    ]);
  });
  it('backdrop-blur-(--my-blur) → backdrop-filter: blur(var(--my-blur))', () => {
    expect(parseClassToAst('backdrop-blur-(--my-blur)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-blur', value: 'blur(var(--my-blur))' },
      ...filters(),
    ]);
  });
});

describe('brightness', () => {
  it('backdrop-brightness-0 → backdrop-filter: brightness(0%)', () => {
    expect(parseClassToAst('backdrop-brightness-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(0%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-50 → backdrop-filter: brightness(50%)', () => {
    expect(parseClassToAst('backdrop-brightness-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(50%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-75 → backdrop-filter: brightness(75%)', () => {
    expect(parseClassToAst('backdrop-brightness-75', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(75%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-90 → backdrop-filter: brightness(90%)', () => {
    expect(parseClassToAst('backdrop-brightness-90', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(90%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-95 → backdrop-filter: brightness(95%)', () => {
    expect(parseClassToAst('backdrop-brightness-95', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(95%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-100 → backdrop-filter: brightness(100%)', () => {
    expect(parseClassToAst('backdrop-brightness-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(100%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-105 → backdrop-filter: brightness(105%)', () => {
    expect(parseClassToAst('backdrop-brightness-105', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(105%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-110 → backdrop-filter: brightness(110%)', () => {
    expect(parseClassToAst('backdrop-brightness-110', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(110%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-125 → backdrop-filter: brightness(125%)', () => {
    expect(parseClassToAst('backdrop-brightness-125', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(125%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-150 → backdrop-filter: brightness(150%)', () => {
    expect(parseClassToAst('backdrop-brightness-150', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(150%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-200 → backdrop-filter: brightness(200%)', () => {
    expect(parseClassToAst('backdrop-brightness-200', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(200%)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-[1.25] → backdrop-filter: brightness(1.25)', () => {
    expect(parseClassToAst('backdrop-brightness-[1.25]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(1.25)' },
      ...filters(),
    ]);
  });
  it('backdrop-brightness-(--my-brightness) → backdrop-filter: brightness(var(--my-brightness))', () => {
    expect(parseClassToAst('backdrop-brightness-(--my-brightness)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-brightness', value: 'brightness(var(--my-brightness))' },
      ...filters(),
    ]);
  });
});

describe('contrast', () => {
  it('backdrop-contrast-0 → backdrop-filter: contrast(0%)', () => {
    expect(parseClassToAst('backdrop-contrast-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(0%)' },
      ...filters(),
    ]);
  });
  it('backdrop-contrast-50 → backdrop-filter: contrast(50%)', () => {
    expect(parseClassToAst('backdrop-contrast-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(50%)' },
      ...filters(),
    ]);
  });
  it('backdrop-contrast-75 → backdrop-filter: contrast(75%)', () => {
    expect(parseClassToAst('backdrop-contrast-75', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(75%)' },
      ...filters(),
    ]);
  });
  it('backdrop-contrast-100 → backdrop-filter: contrast(100%)', () => {
    expect(parseClassToAst('backdrop-contrast-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(100%)' },
      ...filters(),
    ]);
  });
  it('backdrop-contrast-125 → backdrop-filter: contrast(125%)', () => {
    expect(parseClassToAst('backdrop-contrast-125', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(125%)' },
      ...filters(),
    ]);
  });
  it('backdrop-contrast-150 → backdrop-filter: contrast(150%)', () => {
    expect(parseClassToAst('backdrop-contrast-150', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(150%)' },
      ...filters(),
    ]);
  });
  it('backdrop-contrast-200 → backdrop-filter: contrast(200%)', () => {
    expect(parseClassToAst('backdrop-contrast-200', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(200%)' },
      ...filters(),
    ]);
  });
  it.only('backdrop-contrast-120 → backdrop-filter: contrast(120%)', () => {
    expect(parseClassToAst('backdrop-contrast-120', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(120%)' },
      ...filters(),
    ]);
  });
  it('backdrop-contrast-[1.5] → backdrop-filter: contrast(1.5)', () => {
    expect(parseClassToAst('backdrop-contrast-[1.5]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(1.5%)' },
      ...filters(),
    ]);
  });
  it('backdrop-contrast-(--my-contrast) → backdrop-filter: contrast(var(--my-contrast))', () => {
    expect(parseClassToAst('backdrop-contrast-(--my-contrast)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-contrast', value: 'contrast(var(--my-contrast))' },
      ...filters(),
    ]);
  });
});

describe('grayscale', () => {
  it('backdrop-grayscale → backdrop-filter: grayscale(100%)', () => {
    expect(parseClassToAst('backdrop-grayscale', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-grayscale', value: 'grayscale(100%)' },
      ...filters(),
    ]);
  });
  it('backdrop-grayscale-0 → backdrop-filter: grayscale(0%)', () => {
    expect(parseClassToAst('backdrop-grayscale-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-grayscale', value: 'grayscale(0%)' },
      ...filters(),
    ]);
  });
  it('backdrop-grayscale-25 → backdrop-filter: grayscale(25%)', () => {
    expect(parseClassToAst('backdrop-grayscale-25', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-grayscale', value: 'grayscale(25%)' },
      ...filters(),
    ]);
  });
  it('backdrop-grayscale-50 → backdrop-filter: grayscale(50%)', () => {
    expect(parseClassToAst('backdrop-grayscale-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-grayscale', value: 'grayscale(50%)' },
      ...filters(),
    ]);
  });
  it('backdrop-grayscale-75 → backdrop-filter: grayscale(75%)', () => {
    expect(parseClassToAst('backdrop-grayscale-75', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-grayscale', value: 'grayscale(75%)' },
      ...filters(),
    ]);
  });
  it('backdrop-grayscale-100 → backdrop-filter: grayscale(100%)', () => {
    expect(parseClassToAst('backdrop-grayscale-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-grayscale', value: 'grayscale(100%)' },
      ...filters(),
    ]);
  });
  it('backdrop-grayscale-60 → backdrop-filter: grayscale(60%)', () => {
    expect(parseClassToAst('backdrop-grayscale-60', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-grayscale', value: 'grayscale(60%)' },
      ...filters(),
    ]);
  });
  it('backdrop-grayscale-[.33] → backdrop-filter: grayscale(.33)', () => {
    expect(parseClassToAst('backdrop-grayscale-[.33]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-grayscale', value: 'grayscale(.33)' },
      ...filters(),
    ]);
  });
  it('backdrop-grayscale-(--my-gray) → backdrop-filter: grayscale(var(--my-gray))', () => {
    expect(parseClassToAst('backdrop-grayscale-(--my-gray)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-grayscale', value: 'grayscale(var(--my-gray))' },
      ...filters(),
    ]);
  });
});

describe('hue-rotate', () => {
  it('backdrop-hue-rotate-0 → backdrop-filter: hue-rotate(0deg)', () => {
    expect(parseClassToAst('backdrop-hue-rotate-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(0deg)' },
      ...filters(),
    ]);
  });
  it('backdrop-hue-rotate-15 → backdrop-filter: hue-rotate(15deg)', () => {
    expect(parseClassToAst('backdrop-hue-rotate-15', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(15deg)' },
      ...filters(),
    ]);
  });
  it('backdrop-hue-rotate-30 → backdrop-filter: hue-rotate(30deg)', () => {
    expect(parseClassToAst('backdrop-hue-rotate-30', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(30deg)' },
      ...filters(),
    ]);
  });
  it('backdrop-hue-rotate-60 → backdrop-filter: hue-rotate(60deg)', () => {
    expect(parseClassToAst('backdrop-hue-rotate-60', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(60deg)' },
      ...filters(),
    ]);
  });
  it('backdrop-hue-rotate-90 → backdrop-filter: hue-rotate(90deg)', () => {
    expect(parseClassToAst('backdrop-hue-rotate-90', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(90deg)' },
      ...filters(),
    ]);
  });
  it('backdrop-hue-rotate-180 → backdrop-filter: hue-rotate(180deg)', () => {
    expect(parseClassToAst('backdrop-hue-rotate-180', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(180deg)' },
      ...filters(),
    ]);
  });
  it('-backdrop-hue-rotate-0 → backdrop-filter: hue-rotate(calc(0deg * -1))', () => {
    expect(parseClassToAst('-backdrop-hue-rotate-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(calc(0deg * -1))' },
      ...filters(),
    ]);
  });
  it('-backdrop-hue-rotate-15 → backdrop-filter: hue-rotate(calc(15deg * -1))', () => {
    expect(parseClassToAst('-backdrop-hue-rotate-15', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(calc(15deg * -1))' },
      ...filters(),
    ]);
  });
  it('-backdrop-hue-rotate-30 → backdrop-filter: hue-rotate(calc(30deg * -1))', () => {
    expect(parseClassToAst('-backdrop-hue-rotate-30', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(calc(30deg * -1))' },
      ...filters(),
    ]);
  });
  it('-backdrop-hue-rotate-60 → backdrop-filter: hue-rotate(calc(60deg * -1))', () => {
    expect(parseClassToAst('-backdrop-hue-rotate-60', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(calc(60deg * -1))' },
      ...filters(),
    ]);
  });
  it('-backdrop-hue-rotate-90 → backdrop-filter: hue-rotate(calc(90deg * -1))', () => {
    expect(parseClassToAst('-backdrop-hue-rotate-90', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(calc(90deg * -1))' },
      ...filters(),
    ]);
  });
  it('-backdrop-hue-rotate-180 → backdrop-filter: hue-rotate(calc(180deg * -1))', () => {
    expect(parseClassToAst('-backdrop-hue-rotate-180', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(calc(180deg * -1))' },
      ...filters(),
    ]);
  });
  it('backdrop-hue-rotate-45 → backdrop-filter: hue-rotate(45deg)', () => {
    expect(parseClassToAst('backdrop-hue-rotate-45', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(45deg)' },
      ...filters(),
    ]);
  });
  it('-backdrop-hue-rotate-45 → backdrop-filter: hue-rotate(calc(45deg * -1))', () => {
    expect(parseClassToAst('-backdrop-hue-rotate-45', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(calc(45deg * -1))' },
      ...filters(),
    ]);
  });
  it('backdrop-hue-rotate-[77deg] → backdrop-filter: hue-rotate(77deg)', () => {
    expect(parseClassToAst('backdrop-hue-rotate-[77deg]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(77deg)' },
      ...filters(),
    ]);
  });
  it('backdrop-hue-rotate-(--my-hue) → backdrop-filter: hue-rotate(var(--my-hue))', () => {
    expect(parseClassToAst('backdrop-hue-rotate-(--my-hue)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-hue-rotate', value: 'hue-rotate(var(--my-hue))' },
      ...filters(),
    ]);
  });
});

describe('invert', () => {
  it('backdrop-invert → backdrop-filter: invert(100%)', () => {
    expect(parseClassToAst('backdrop-invert', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-invert', value: 'invert(100%)' },
      ...filters(),
    ]);
  });
  it('backdrop-invert-0 → backdrop-filter: invert(0%)', () => {
    expect(parseClassToAst('backdrop-invert-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-invert', value: 'invert(0%)' },
      ...filters(),
    ]);
  });
  it('backdrop-invert-20 → backdrop-filter: invert(20%)', () => {
    expect(parseClassToAst('backdrop-invert-20', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-invert', value: 'invert(20%)' },
      ...filters(),
    ]);
  });
  it('backdrop-invert-[.25] → backdrop-filter: invert(.25)', () => {
    expect(parseClassToAst('backdrop-invert-[.25]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-invert', value: 'invert(.25)' },
      ...filters(),
    ]);
  });
  it('backdrop-invert-(--my-inversion) → backdrop-filter: invert(var(--my-inversion))', () => {
    expect(parseClassToAst('backdrop-invert-(--my-inversion)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-invert', value: 'invert(var(--my-inversion))' },
      ...filters(),
    ]);
  });
});

describe('saturate', () => {
  it('backdrop-saturate-0 → backdrop-filter: saturate(0%)', () => {
    expect(parseClassToAst('backdrop-saturate-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-saturate', value: 'saturate(0%)' },
      ...filters(),
    ]);
  });
  it('backdrop-saturate-50 → backdrop-filter: saturate(50%)', () => {
    expect(parseClassToAst('backdrop-saturate-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-saturate', value: 'saturate(50%)' },
      ...filters(),
    ]);
  });
  it('backdrop-saturate-100 → backdrop-filter: saturate(100%)', () => {
    expect(parseClassToAst('backdrop-saturate-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-saturate', value: 'saturate(100%)' },
      ...filters(),
    ]);
  });
  it('backdrop-saturate-150 → backdrop-filter: saturate(150%)', () => {
    expect(parseClassToAst('backdrop-saturate-150', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-saturate', value: 'saturate(150%)' },
      ...filters(),
    ]);
  });
  it('backdrop-saturate-200 → backdrop-filter: saturate(200%)', () => {
    expect(parseClassToAst('backdrop-saturate-200', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-saturate', value: 'saturate(200%)' },
      ...filters(),
    ]);
  });
  it('backdrop-saturate-[.33] → backdrop-filter: saturate(.33)', () => {
    expect(parseClassToAst('backdrop-saturate-[.33]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-saturate', value: 'saturate(.33)' },
      ...filters(),
    ]);
  });
  it('backdrop-saturate-(--my-saturate) → backdrop-filter: saturate(var(--my-saturate))', () => {
    expect(parseClassToAst('backdrop-saturate-(--my-saturate)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-saturate', value: 'saturate(var(--my-saturate))' },
      ...filters(),
    ]);
  });
});

describe('sepia', () => {
  it('backdrop-sepia → backdrop-filter: sepia(100%)', () => {
    expect(parseClassToAst('backdrop-sepia', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-sepia', value: 'sepia(100%)' },
      ...filters(),
    ]);
  });
  it('backdrop-sepia-0 → backdrop-filter: sepia(0%)', () => {
    expect(parseClassToAst('backdrop-sepia-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-sepia', value: 'sepia(0%)' },
      ...filters(),
    ]);
  });
  it('backdrop-sepia-50 → backdrop-filter: sepia(50%)', () => {
    expect(parseClassToAst('backdrop-sepia-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-sepia', value: 'sepia(50%)' },
      ...filters(),
    ]);
  });
  it('backdrop-sepia-100 → backdrop-filter: sepia(100%)', () => {
    expect(parseClassToAst('backdrop-sepia-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-sepia', value: 'sepia(100%)' },
      ...filters(),
    ]);
  });
  it('backdrop-sepia-[.33] → backdrop-filter: sepia(.33)', () => {
    expect(parseClassToAst('backdrop-sepia-[.33]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-sepia', value: 'sepia(.33)' },
      ...filters(),
    ]);
  });
  it('backdrop-sepia-(--my-sepia) → backdrop-filter: sepia(var(--my-sepia))', () => {
    expect(parseClassToAst('backdrop-sepia-(--my-sepia)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-backdrop-sepia', value: 'sepia(var(--my-sepia))' },
      ...filters(),
    ]);
  });
}); 