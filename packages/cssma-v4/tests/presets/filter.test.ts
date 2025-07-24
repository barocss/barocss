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

describe('filter', () => {
  it('filter → filter: var(--tw-filter)', () => {
    expect(parseClassToAst('filter', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'var(--tw-filter)' },
    ]);
  });
  it('filter-none → filter: none', () => {
    expect(parseClassToAst('filter-none', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'none' },
    ]);
  });
  it('filter-[blur(2px)_brightness(0.5)] → filter: blur(2px) brightness(0.5)', () => {
    expect(parseClassToAst('filter-[blur(2px)_brightness(0.5)]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(2px) brightness(0.5)' },
    ]);
  });
  it('filter-(--my-filter) → filter: var(--my-filter)', () => {
    expect(parseClassToAst('filter-(--my-filter)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'var(--my-filter)' },
    ]);
  });
});

describe('blur', () => {
  it('blur-xs → filter: blur(var(--blur-xs))', () => {
    expect(parseClassToAst('blur-xs', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-xs))' },
    ]);
  });
  it('blur-sm → filter: blur(var(--blur-sm))', () => {
    expect(parseClassToAst('blur-sm', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-sm))' },
    ]);
  });
  it('blur-md → filter: blur(var(--blur-md))', () => {
    expect(parseClassToAst('blur-md', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-md))' },
    ]);
  });
  it('blur-lg → filter: blur(var(--blur-lg))', () => {
    expect(parseClassToAst('blur-lg', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-lg))' },
    ]);
  });
  it('blur-xl → filter: blur(var(--blur-xl))', () => {
    expect(parseClassToAst('blur-xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-xl))' },
    ]);
  });
  it('blur-2xl → filter: blur(var(--blur-2xl))', () => {
    expect(parseClassToAst('blur-2xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-2xl))' },
    ]);
  });
  it('blur-3xl → filter: blur(var(--blur-3xl))', () => {
    expect(parseClassToAst('blur-3xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--blur-3xl))' },
    ]);
  });
  it('blur-none → filter: ', () => {
    expect(parseClassToAst('blur-none', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: '' },
    ]);
  });
  it('blur-[2px] → filter: blur(2px)', () => {
    expect(parseClassToAst('blur-[2px]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(2px)' },
    ]);
  });
  it('blur-(--my-blur) → filter: blur(var(--my-blur))', () => {
    expect(parseClassToAst('blur-(--my-blur)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'blur(var(--my-blur))' },
    ]);
  });
});

describe('brightness', () => {
  it('brightness-0 → filter: brightness(0%)', () => {
    expect(parseClassToAst('brightness-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(0%)' },
    ]);
  });
  it('brightness-50 → filter: brightness(50%)', () => {
    expect(parseClassToAst('brightness-50', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(50%)' },
    ]);
  });
  it('brightness-75 → filter: brightness(75%)', () => {
    expect(parseClassToAst('brightness-75', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(75%)' },
    ]);
  });
  it('brightness-90 → filter: brightness(90%)', () => {
    expect(parseClassToAst('brightness-90', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(90%)' },
    ]);
  });
  it('brightness-95 → filter: brightness(95%)', () => {
    expect(parseClassToAst('brightness-95', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(95%)' },
    ]);
  });
  it('brightness-100 → filter: brightness(100%)', () => {
    expect(parseClassToAst('brightness-100', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(100%)' },
    ]);
  });
  it('brightness-105 → filter: brightness(105%)', () => {
    expect(parseClassToAst('brightness-105', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(105%)' },
    ]);
  });
  it('brightness-110 → filter: brightness(110%)', () => {
    expect(parseClassToAst('brightness-110', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(110%)' },
    ]);
  });
  it('brightness-125 → filter: brightness(125%)', () => {
    expect(parseClassToAst('brightness-125', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(125%)' },
    ]);
  });
  it('brightness-150 → filter: brightness(150%)', () => {
    expect(parseClassToAst('brightness-150', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(150%)' },
    ]);
  });
  it('brightness-200 → filter: brightness(200%)', () => {
    expect(parseClassToAst('brightness-200', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(200%)' },
    ]);
  });
  it('brightness-[1.25] → filter: brightness(1.25)', () => {
    expect(parseClassToAst('brightness-[1.25]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(1.25)' },
    ]);
  });
  it('brightness-(--my-brightness) → filter: brightness(var(--my-brightness))', () => {
    expect(parseClassToAst('brightness-(--my-brightness)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'brightness(var(--my-brightness))' },
    ]);
  });
});

describe('contrast', () => {
  it('contrast-0 → filter: contrast(0%)', () => {
    expect(parseClassToAst('contrast-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(0%)' },
    ]);
  });
  it('contrast-50 → filter: contrast(50%)', () => {
    expect(parseClassToAst('contrast-50', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(50%)' },
    ]);
  });
  it('contrast-75 → filter: contrast(75%)', () => {
    expect(parseClassToAst('contrast-75', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(75%)' },
    ]);
  });
  it('contrast-100 → filter: contrast(100%)', () => {
    expect(parseClassToAst('contrast-100', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(100%)' },
    ]);
  });
  it('contrast-125 → filter: contrast(125%)', () => {
    expect(parseClassToAst('contrast-125', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(125%)' },
    ]);
  });
  it('contrast-150 → filter: contrast(150%)', () => {
    expect(parseClassToAst('contrast-150', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(150%)' },
    ]);
  });
  it('contrast-200 → filter: contrast(200%)', () => {
    expect(parseClassToAst('contrast-200', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(200%)' },
    ]);
  });
  it('contrast-120 → filter: contrast(120%)', () => {
    expect(parseClassToAst('contrast-120', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(120%)' },
    ]);
  });
  it('contrast-[1.5] → filter: contrast(1.5)', () => {
    expect(parseClassToAst('contrast-[1.5]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(1.5)' },
    ]);
  });
  it('contrast-(--my-contrast) → filter: contrast(var(--my-contrast))', () => {
    expect(parseClassToAst('contrast-(--my-contrast)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'contrast(var(--my-contrast))' },
    ]);
  });
});

describe('drop-shadow', () => {
  it('drop-shadow-xs → filter: drop-shadow(var(--drop-shadow-xs))', () => {
    expect(parseClassToAst('drop-shadow-xs', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-xs))' },
    ]);
  });
  it('drop-shadow-sm → filter: drop-shadow(var(--drop-shadow-sm))', () => {
    expect(parseClassToAst('drop-shadow-sm', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-sm))' },
    ]);
  });
  it('drop-shadow-md → filter: drop-shadow(var(--drop-shadow-md))', () => {
    expect(parseClassToAst('drop-shadow-md', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-md))' },
    ]);
  });
  it('drop-shadow-lg → filter: drop-shadow(var(--drop-shadow-lg))', () => {
    expect(parseClassToAst('drop-shadow-lg', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-lg))' },
    ]);
  });
  it('drop-shadow-xl → filter: drop-shadow(var(--drop-shadow-xl))', () => {
    expect(parseClassToAst('drop-shadow-xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-xl))' },
    ]);
  });
  it('drop-shadow-2xl → filter: drop-shadow(var(--drop-shadow-2xl))', () => {
    expect(parseClassToAst('drop-shadow-2xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-2xl))' },
    ]);
  });
  it('drop-shadow-3xl → filter: drop-shadow(var(--drop-shadow-3xl))', () => {
    expect(parseClassToAst('drop-shadow-3xl', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--drop-shadow-3xl))' },
    ]);
  });
  it('drop-shadow-none → filter: drop-shadow(0 0 #0000)', () => {
    expect(parseClassToAst('drop-shadow-none', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(0 0 #0000)' },
    ]);
  });
  it('drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] → filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1))', () => {
    expect(parseClassToAst('drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' },
    ]);
  });
  it('drop-shadow-(--my-shadow) → filter: drop-shadow(var(--my-shadow))', () => {
    expect(parseClassToAst('drop-shadow-(--my-shadow)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'drop-shadow(var(--my-shadow))' },
    ]);
  });
});

describe('drop-shadow color', () => {
  it('drop-shadow-inherit → --tw-drop-shadow-color: inherit', () => {
    expect(parseClassToAst('drop-shadow-inherit', ctx)).toEqual([
      { type: 'decl', prop: '--tw-drop-shadow-color', value: 'inherit' },
    ]);
  });
  it('drop-shadow-current → --tw-drop-shadow-color: currentColor', () => {
    expect(parseClassToAst('drop-shadow-current', ctx)).toEqual([
      { type: 'decl', prop: '--tw-drop-shadow-color', value: 'currentColor' },
    ]);
  });
  it('drop-shadow-transparent → --tw-drop-shadow-color: transparent', () => {
    expect(parseClassToAst('drop-shadow-transparent', ctx)).toEqual([
      { type: 'decl', prop: '--tw-drop-shadow-color', value: 'transparent' },
    ]);
  });
  it('drop-shadow-black → --tw-drop-shadow-color: var(--color-black)', () => {
    expect(parseClassToAst('drop-shadow-black', ctx)).toEqual([
      { type: 'decl', prop: '--tw-drop-shadow-color', value: 'var(--color-black)' },
    ]);
  });
  it('drop-shadow-white → --tw-drop-shadow-color: var(--color-white)', () => {
    expect(parseClassToAst('drop-shadow-white', ctx)).toEqual([
      { type: 'decl', prop: '--tw-drop-shadow-color', value: 'var(--color-white)' },
    ]);
  });
  it('drop-shadow-red-500 → --tw-drop-shadow-color: var(--color-red-500)', () => {
    expect(parseClassToAst('drop-shadow-red-500', ctx)).toEqual([
      { type: 'decl', prop: '--tw-drop-shadow-color', value: 'var(--color-red-500)' },
    ]);
  });
  it('drop-shadow-(color:--my-color) → --tw-drop-shadow-color: var(--my-color)', () => {
    expect(parseClassToAst('drop-shadow-(color:--my-color)', ctx)).toEqual([
      { type: 'decl', prop: '--tw-drop-shadow-color', value: 'var(--my-color)' },
    ]);
  });
  it('drop-shadow-[#bada55] → --tw-drop-shadow-color: #bada55', () => {
    expect(parseClassToAst('drop-shadow-[#bada55]', ctx)).toEqual([
      { type: 'decl', prop: '--tw-drop-shadow-color', value: '#bada55' },
    ]);
  });
});

describe('grayscale', () => {
  it('grayscale → filter: grayscale(100%)', () => {
    expect(parseClassToAst('grayscale', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'grayscale(100%)' },
    ]);
  });
  it('grayscale-0 → filter: grayscale(0%)', () => {
    expect(parseClassToAst('grayscale-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'grayscale(0%)' },
    ]);
  });
  it('grayscale-25 → filter: grayscale(25%)', () => {
    expect(parseClassToAst('grayscale-25', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'grayscale(25%)' },
    ]);
  });
  it('grayscale-50 → filter: grayscale(50%)', () => {
    expect(parseClassToAst('grayscale-50', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'grayscale(50%)' },
    ]);
  });
  it('grayscale-75 → filter: grayscale(75%)', () => {
    expect(parseClassToAst('grayscale-75', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'grayscale(75%)' },
    ]);
  });
  it('grayscale-100 → filter: grayscale(100%)', () => {
    expect(parseClassToAst('grayscale-100', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'grayscale(100%)' },
    ]);
  });
  it('grayscale-60 → filter: grayscale(60%)', () => {
    expect(parseClassToAst('grayscale-60', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'grayscale(60%)' },
    ]);
  });
  it('grayscale-[.33] → filter: grayscale(.33)', () => {
    expect(parseClassToAst('grayscale-[.33]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'grayscale(.33)' },
    ]);
  });
  it('grayscale-(--my-gray) → filter: grayscale(var(--my-gray))', () => {
    expect(parseClassToAst('grayscale-(--my-gray)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'grayscale(var(--my-gray))' },
    ]);
  });
});

describe('hue-rotate', () => {
  it('hue-rotate-0 → filter: hue-rotate(0deg)', () => {
    expect(parseClassToAst('hue-rotate-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(0deg)' },
    ]);
  });
  it('hue-rotate-15 → filter: hue-rotate(15deg)', () => {
    expect(parseClassToAst('hue-rotate-15', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(15deg)' },
    ]);
  });
  it('hue-rotate-30 → filter: hue-rotate(30deg)', () => {
    expect(parseClassToAst('hue-rotate-30', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(30deg)' },
    ]);
  });
  it('hue-rotate-60 → filter: hue-rotate(60deg)', () => {
    expect(parseClassToAst('hue-rotate-60', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(60deg)' },
    ]);
  });
  it('hue-rotate-90 → filter: hue-rotate(90deg)', () => {
    expect(parseClassToAst('hue-rotate-90', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(90deg)' },
    ]);
  });
  it('hue-rotate-180 → filter: hue-rotate(180deg)', () => {
    expect(parseClassToAst('hue-rotate-180', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(180deg)' },
    ]);
  });
  it('-hue-rotate-0 → filter: hue-rotate(calc(0deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(calc(0deg * -1))' },
    ]);
  });
  it('-hue-rotate-15 → filter: hue-rotate(calc(15deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-15', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(calc(15deg * -1))' },
    ]);
  });
  it('-hue-rotate-30 → filter: hue-rotate(calc(30deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-30', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(calc(30deg * -1))' },
    ]);
  });
  it('-hue-rotate-60 → filter: hue-rotate(calc(60deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-60', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(calc(60deg * -1))' },
    ]);
  });
  it('-hue-rotate-90 → filter: hue-rotate(calc(90deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-90', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(calc(90deg * -1))' },
    ]);
  });
  it('-hue-rotate-180 → filter: hue-rotate(calc(180deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-180', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(calc(180deg * -1))' },
    ]);
  });
  it('hue-rotate-45 → filter: hue-rotate(45deg)', () => {
    expect(parseClassToAst('hue-rotate-45', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(45deg)' },
    ]);
  });
  it('-hue-rotate-45 → filter: hue-rotate(calc(45deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-45', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(calc(45deg * -1))' },
    ]);
  });
  it('hue-rotate-[77deg] → filter: hue-rotate(77deg)', () => {
    expect(parseClassToAst('hue-rotate-[77deg]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(77deg)' },
    ]);
  });
  it('hue-rotate-(--my-hue) → filter: hue-rotate(var(--my-hue))', () => {
    expect(parseClassToAst('hue-rotate-(--my-hue)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'hue-rotate(var(--my-hue))' },
    ]);
  });
});

describe('invert', () => {
  it('invert → filter: invert(100%)', () => {
    expect(parseClassToAst('invert', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'invert(100%)' },
    ]);
  });
  it('invert-0 → filter: invert(0%)', () => {
    expect(parseClassToAst('invert-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'invert(0%)' },
    ]);
  });
  it('invert-20 → filter: invert(20%)', () => {
    expect(parseClassToAst('invert-20', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'invert(20%)' },
    ]);
  });
  it('invert-[.25] → filter: invert(.25)', () => {
    expect(parseClassToAst('invert-[.25]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'invert(.25)' },
    ]);
  });
  it('invert-(--my-inversion) → filter: invert(var(--my-inversion))', () => {
    expect(parseClassToAst('invert-(--my-inversion)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'invert(var(--my-inversion))' },
    ]);
  });
});

describe('saturate', () => {
  it('saturate-0 → filter: saturate(0%)', () => {
    expect(parseClassToAst('saturate-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'saturate(0%)' },
    ]);
  });
  it('saturate-50 → filter: saturate(50%)', () => {
    expect(parseClassToAst('saturate-50', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'saturate(50%)' },
    ]);
  });
  it('saturate-100 → filter: saturate(100%)', () => {
    expect(parseClassToAst('saturate-100', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'saturate(100%)' },
    ]);
  });
  it('saturate-150 → filter: saturate(150%)', () => {
    expect(parseClassToAst('saturate-150', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'saturate(150%)' },
    ]);
  });
  it('saturate-200 → filter: saturate(200%)', () => {
    expect(parseClassToAst('saturate-200', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'saturate(200%)' },
    ]);
  });
  it('saturate-[.33] → filter: saturate(.33)', () => {
    expect(parseClassToAst('saturate-[.33]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'saturate(.33)' },
    ]);
  });
  it('saturate-(--my-saturate) → filter: saturate(var(--my-saturate))', () => {
    expect(parseClassToAst('saturate-(--my-saturate)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'saturate(var(--my-saturate))' },
    ]);
  });
});

describe('sepia', () => {
  it('sepia → filter: sepia(100%)', () => {
    expect(parseClassToAst('sepia', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'sepia(100%)' },
    ]);
  });
  it('sepia-0 → filter: sepia(0%)', () => {
    expect(parseClassToAst('sepia-0', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'sepia(0%)' },
    ]);
  });
  it('sepia-50 → filter: sepia(50%)', () => {
    expect(parseClassToAst('sepia-50', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'sepia(50%)' },
    ]);
  });
  it('sepia-100 → filter: sepia(100%)', () => {
    expect(parseClassToAst('sepia-100', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'sepia(100%)' },
    ]);
  });
  it('sepia-[.33] → filter: sepia(.33)', () => {
    expect(parseClassToAst('sepia-[.33]', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'sepia(.33)' },
    ]);
  });
  it('sepia-(--my-sepia) → filter: sepia(var(--my-sepia))', () => {
    expect(parseClassToAst('sepia-(--my-sepia)', ctx)).toEqual([
      { type: 'decl', prop: 'filter', value: 'sepia(var(--my-sepia))' },
    ]);
  });
}); 