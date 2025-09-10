import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";
import { decl } from "../../src";

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
  return decl("filter", "var(--baro-blur, ) var(--baro-brightness, ) var(--baro-contrast, ) var(--baro-grayscale, ) var(--baro-hue-rotate, ) var(--baro-invert, ) var(--baro-saturate, ) var(--baro-sepia, ) var(--baro-drop-shadow, )");
}

describe('filter', () => {
  it('filter-none → filter: none', () => {
    expect(parseClassToAst('filter-none', ctx)).toMatchObject([
      { type: 'decl', prop: 'filter', value: 'none' },
    ]);
  });
  it('filter-[blur(2px)_brightness(0.5)] → filter: blur(2px) brightness(0.5)', () => {
    expect(parseClassToAst('filter-[blur(2px)_brightness(0.5)]', ctx)).toMatchObject([
      { type: 'decl', prop: 'filter', value: 'blur(2px) brightness(0.5)' },
    ]);
  });
  it('filter-(--my-filter) → filter: var(--my-filter)', () => {
    expect(parseClassToAst('filter-(--my-filter)', ctx)).toMatchObject([
      { type: 'decl', prop: 'filter', value: 'var(--my-filter)' },
    ]);
  });
});

describe('blur', () => {
  it('blur-xs → filter: blur(var(--blur-xs))', () => {
    expect(parseClassToAst('blur-xs', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: 'blur(var(--blur-xs))' },
      filters(),
    ]);
  });
  it('blur-sm → filter: blur(var(--blur-sm))', () => {
    expect(parseClassToAst('blur-sm', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: 'blur(var(--blur-sm))' },
      filters(),
    ]);
  });
  it('blur-md → filter: blur(var(--blur-md))', () => {
    expect(parseClassToAst('blur-md', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: 'blur(var(--blur-md))' },
      filters(),
    ]);
  });
  it('blur-lg → filter: blur(var(--blur-lg))', () => {
    expect(parseClassToAst('blur-lg', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: 'blur(var(--blur-lg))' },
      filters(),
    ]);
  });
  it('blur-xl → filter: blur(var(--blur-xl))', () => {
    expect(parseClassToAst('blur-xl', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: 'blur(var(--blur-xl))' },
      filters(),
    ]);
  });
  it('blur-2xl → filter: blur(var(--blur-2xl))', () => {
    expect(parseClassToAst('blur-2xl', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: 'blur(var(--blur-2xl))' },
      filters(),
    ]);
  });
  it('blur-3xl → filter: blur(var(--blur-3xl))', () => {
    expect(parseClassToAst('blur-3xl', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: 'blur(var(--blur-3xl))' },
      filters(),
    ]);
  });
  it('blur-none → filter: ', () => {
    expect(parseClassToAst('blur-none', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: '' },
      filters(),
    ]);
  });
  it('blur-[2px] → filter: blur(2px)', () => {
    expect(parseClassToAst('blur-[2px]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: 'blur(2px)' },
      filters(),
    ]);
  });
  it('blur-(--my-blur) → filter: blur(var(--my-blur))', () => {
    expect(parseClassToAst('blur-(--my-blur)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-blur', value: 'blur(var(--my-blur))' },
      filters(),
    ]);
  });
});

describe('brightness', () => {
  it('brightness-0 → filter: brightness(0%)', () => {
    expect(parseClassToAst('brightness-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(0%)' },
      filters(),
    ]);
  });
  it('brightness-50 → filter: brightness(50%)', () => {
    expect(parseClassToAst('brightness-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(50%)' },
      filters(),
    ]);
  });
  it('brightness-75 → filter: brightness(75%)', () => {
    expect(parseClassToAst('brightness-75', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(75%)' },
      filters(),
    ]);
  });
  it('brightness-90 → filter: brightness(90%)', () => {
    expect(parseClassToAst('brightness-90', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(90%)' },
      filters(),
    ]);
  });
  it('brightness-95 → filter: brightness(95%)', () => {
    expect(parseClassToAst('brightness-95', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(95%)' },
      filters(),
    ]);
  });
  it('brightness-100 → filter: brightness(100%)', () => {
    expect(parseClassToAst('brightness-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(100%)' },
      filters(),
    ]);
  });
  it('brightness-105 → filter: brightness(105%)', () => {
    expect(parseClassToAst('brightness-105', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(105%)' },
      filters(),
    ]);
  });
  it('brightness-110 → filter: brightness(110%)', () => {
    expect(parseClassToAst('brightness-110', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(110%)' },
      filters(),
    ]);
  });
  it('brightness-125 → filter: brightness(125%)', () => {
    expect(parseClassToAst('brightness-125', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(125%)' },
      filters(),
    ]);
  });
  it('brightness-150 → filter: brightness(150%)', () => {
    expect(parseClassToAst('brightness-150', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(150%)' },
      filters(),
    ]);
  });
  it('brightness-200 → filter: brightness(200%)', () => {
    expect(parseClassToAst('brightness-200', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(200%)' },
      filters(),
    ]);
  });
  it('brightness-[1.25] → filter: brightness(1.25)', () => {
    expect(parseClassToAst('brightness-[1.25]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(1.25)' },
      filters(),
    ]);
  });
  it('brightness-(--my-brightness) → filter: brightness(var(--my-brightness))', () => {
    expect(parseClassToAst('brightness-(--my-brightness)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-brightness', value: 'brightness(var(--my-brightness))' },
      filters(),
    ]);
  });
});

describe('contrast', () => {
  it('contrast-0 → filter: contrast(0%)', () => {
    expect(parseClassToAst('contrast-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(0%)' },
      filters(),
    ]);
  });
  it('contrast-50 → filter: contrast(50%)', () => {
    expect(parseClassToAst('contrast-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(50%)' },
      filters(),
    ]);
  });
  it('contrast-75 → filter: contrast(75%)', () => {
    expect(parseClassToAst('contrast-75', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(75%)' },
      filters(),
    ]);
  });
  it('contrast-100 → filter: contrast(100%)', () => {
    expect(parseClassToAst('contrast-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(100%)' },
      filters(),
    ]);
  });
  it('contrast-125 → filter: contrast(125%)', () => {
    expect(parseClassToAst('contrast-125', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(125%)' },
      filters(),
    ]);
  });
  it('contrast-150 → filter: contrast(150%)', () => {
    expect(parseClassToAst('contrast-150', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(150%)' },
      filters(),
    ]);
  });
  it('contrast-200 → filter: contrast(200%)', () => {
    expect(parseClassToAst('contrast-200', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(200%)' },
      filters(),
    ]);
  });
  it('contrast-120 → filter: contrast(120%)', () => {
    expect(parseClassToAst('contrast-120', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(120%)' },
      filters(),
    ]);
  });
  it('contrast-[1.5] → filter: contrast(1.5)', () => {
    expect(parseClassToAst('contrast-[1.5]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(1.5)' },
      filters(),
    ]);
  });
  it('contrast-(--my-contrast) → filter: contrast(var(--my-contrast))', () => {
    expect(parseClassToAst('contrast-(--my-contrast)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-contrast', value: 'contrast(var(--my-contrast))' },
      filters(),
    ]);
  });
});

describe('drop-shadow', () => {
  it('drop-shadow-xs → filter: drop-shadow(var(--drop-shadow-xs))', () => {
    expect(parseClassToAst('drop-shadow-xs', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-size', value: 'drop-shadow(0 1px 1px var(--baro-drop-shadow-color, #0000001a))' },
      { type: 'decl', prop: '--baro-drop-shadow', value: 'var(--drop-shadow-xs)' },
      filters(),
    ]);
  });
  it('drop-shadow-sm → filter: drop-shadow(var(--drop-shadow-sm))', () => {
    expect(parseClassToAst('drop-shadow-sm', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-size', value: 'drop-shadow(0 1px 2px var(--baro-drop-shadow-color, #0000001a))' },
      { type: 'decl', prop: '--baro-drop-shadow', value: 'var(--drop-shadow-sm)' },
      filters(),
    ]);
  });
  it('drop-shadow-md → filter: drop-shadow(var(--drop-shadow-md))', () => {
    expect(parseClassToAst('drop-shadow-md', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-size', value: 'drop-shadow(0 3px 3px var(--baro-drop-shadow-color, #0000001a))' },
      { type: 'decl', prop: '--baro-drop-shadow', value: 'var(--drop-shadow-md)' },
      filters(),
    ]);
  });
  it('drop-shadow-lg → filter: drop-shadow(var(--drop-shadow-lg))', () => {
    expect(parseClassToAst('drop-shadow-lg', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-size', value: 'drop-shadow(0 4px 4px var(--baro-drop-shadow-color, #0000001a))' },
      { type: 'decl', prop: '--baro-drop-shadow', value: 'var(--drop-shadow-lg)' },
      filters(),
    ]);
  });
  it('drop-shadow-xl → filter: drop-shadow(var(--drop-shadow-xl))', () => {
    expect(parseClassToAst('drop-shadow-xl', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-size', value: 'drop-shadow(0 9px 7px var(--baro-drop-shadow-color, #0000001a))' },
      { type: 'decl', prop: '--baro-drop-shadow', value: 'var(--drop-shadow-xl)' },
      filters(),
    ]);
  });
  it('drop-shadow-2xl → filter: drop-shadow(var(--drop-shadow-2xl))', () => {
    expect(parseClassToAst('drop-shadow-2xl', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-size', value: 'drop-shadow(0 25px 25px var(--baro-drop-shadow-color, #0000001a))' },
      { type: 'decl', prop: '--baro-drop-shadow', value: 'var(--drop-shadow-2xl)' },
      filters(),
    ]);
  });
  it('drop-shadow-none → filter: drop-shadow(0 0 #0000)', () => {
    expect(parseClassToAst('drop-shadow-none', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow', value: 'drop-shadow(0 0 #0000)' },
      filters(),
    ]);
  });
  it('drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)] → filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1))', () => {
    expect(parseClassToAst('drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-size', value: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' },
      { type: 'decl', prop: '--baro-drop-shadow', value: 'var(--baro-drop-shadow-size)' },
    ]);
  });
  it('drop-shadow-(--my-shadow) → filter: drop-shadow(var(--my-shadow))', () => {
    expect(parseClassToAst('drop-shadow-(--my-shadow)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-size', value: 'drop-shadow(var(--my-shadow))' },
      { type: 'decl', prop: '--baro-drop-shadow', value: 'var(--baro-drop-shadow-size)' },
    ]);
  });
});

describe('drop-shadow color', () => {
  it('drop-shadow-inherit → --baro-drop-shadow-color: inherit', () => {
    expect(parseClassToAst('drop-shadow-inherit', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-color', value: 'inherit' },
    ]);
  });
  it('drop-shadow-current → --baro-drop-shadow-color: currentColor', () => {
    expect(parseClassToAst('drop-shadow-current', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-color', value: 'currentColor' },
    ]);
  });
  it('drop-shadow-transparent → --baro-drop-shadow-color: transparent', () => {
    expect(parseClassToAst('drop-shadow-transparent', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-color', value: 'transparent' },
    ]);
  });
  it('drop-shadow-black → --baro-drop-shadow-color: var(--color-black)', () => {
    expect(parseClassToAst('drop-shadow-black', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-color', value: 'var(--color-black)' },
    ]);
  });
  it('drop-shadow-white → --baro-drop-shadow-color: var(--color-white)', () => {
    expect(parseClassToAst('drop-shadow-white', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-color', value: 'var(--color-white)' },
    ]);
  });
  it('drop-shadow-red-500 → --baro-drop-shadow-color: var(--color-red-500)', () => {
    expect(parseClassToAst('drop-shadow-red-500', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-color', value: 'var(--color-red-500)' },
    ]);
  });
  it('drop-shadow-(color:--my-color) → --baro-drop-shadow-color: var(--my-color)', () => {
    expect(parseClassToAst('drop-shadow-(color:--my-color)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-color', value: 'var(--my-color)' },
    ]);
  });
  it('drop-shadow-[#bada55] → --baro-drop-shadow-color: #bada55', () => {
    expect(parseClassToAst('drop-shadow-[#bada55]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-drop-shadow-color', value: '#bada55' },
    ]);
  });
});

describe('grayscale', () => {
  it('grayscale → filter: grayscale(100%)', () => {
    expect(parseClassToAst('grayscale', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-grayscale', value: 'grayscale(100%)' },
      filters(),
    ]);
  });
  it('grayscale-0 → filter: grayscale(0%)', () => {
    expect(parseClassToAst('grayscale-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-grayscale', value: 'grayscale(0%)' },
      filters(),
    ]);
  });
  it('grayscale-25 → filter: grayscale(25%)', () => {
    expect(parseClassToAst('grayscale-25', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-grayscale', value: 'grayscale(25%)' },
      filters(),
    ]);
  });
  it('grayscale-50 → filter: grayscale(50%)', () => {
    expect(parseClassToAst('grayscale-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-grayscale', value: 'grayscale(50%)' },
      filters(),
    ]);
  });
  it('grayscale-75 → filter: grayscale(75%)', () => {
    expect(parseClassToAst('grayscale-75', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-grayscale', value: 'grayscale(75%)' },
      filters(),
    ]);
  });
  it('grayscale-100 → filter: grayscale(100%)', () => {
    expect(parseClassToAst('grayscale-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-grayscale', value: 'grayscale(100%)' },
      filters(),
    ]);
  });
  it('grayscale-60 → filter: grayscale(60%)', () => {
    expect(parseClassToAst('grayscale-60', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-grayscale', value: 'grayscale(60%)' },
      filters(),
    ]);
  });
  it('grayscale-[.33] → filter: grayscale(.33)', () => {
    expect(parseClassToAst('grayscale-[.33]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-grayscale', value: 'grayscale(.33)' },
      filters(),
    ]);
  });
  it('grayscale-(--my-gray) → filter: grayscale(var(--my-gray))', () => {
    expect(parseClassToAst('grayscale-(--my-gray)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-grayscale', value: 'grayscale(var(--my-gray))' },
      filters(),
    ]);
  });
});

describe('hue-rotate', () => {
  it('hue-rotate-0 → filter: hue-rotate(0deg)', () => {
    expect(parseClassToAst('hue-rotate-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(0deg)' },
      filters(),
    ]);
  });
  it('hue-rotate-15 → filter: hue-rotate(15deg)', () => {
    expect(parseClassToAst('hue-rotate-15', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(15deg)' },
      filters(),
    ]);
  });
  it('hue-rotate-30 → filter: hue-rotate(30deg)', () => {
    expect(parseClassToAst('hue-rotate-30', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(30deg)' },
      filters(),
    ]);
  });
  it('hue-rotate-60 → filter: hue-rotate(60deg)', () => {
    expect(parseClassToAst('hue-rotate-60', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(60deg)' },
      filters(),
    ]);
  });
  it('hue-rotate-90 → filter: hue-rotate(90deg)', () => {
    expect(parseClassToAst('hue-rotate-90', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(90deg)' },
      filters(),
    ]);
  });
  it('hue-rotate-180 → filter: hue-rotate(180deg)', () => {
    expect(parseClassToAst('hue-rotate-180', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(180deg)' },
      filters(),
    ]);
  });
  it('-hue-rotate-0 → filter: hue-rotate(calc(0deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(calc(0deg * -1))' },
      filters(),
    ]);
  });
  it('-hue-rotate-15 → filter: hue-rotate(calc(15deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-15', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(calc(15deg * -1))' },
      filters(),
    ]);
  });
  it('-hue-rotate-30 → filter: hue-rotate(calc(30deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-30', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(calc(30deg * -1))' },
      filters(),
    ]);
  });
  it('-hue-rotate-60 → filter: hue-rotate(calc(60deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-60', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(calc(60deg * -1))' },
      filters(),
    ]);
  });
  it('-hue-rotate-90 → filter: hue-rotate(calc(90deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-90', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(calc(90deg * -1))' },
      filters(),
    ]);
  });
  it('-hue-rotate-180 → filter: hue-rotate(calc(180deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-180', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(calc(180deg * -1))' },
      filters(),
    ]);
  });
  it('hue-rotate-45 → filter: hue-rotate(45deg)', () => {
    expect(parseClassToAst('hue-rotate-45', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(45deg)' },
      filters(),
    ]);
  });
  it('-hue-rotate-45 → filter: hue-rotate(calc(45deg * -1))', () => {
    expect(parseClassToAst('-hue-rotate-45', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(calc(45deg * -1))' },
      filters(),
    ]);
  });
  it('hue-rotate-[77deg] → filter: hue-rotate(77deg)', () => {
    expect(parseClassToAst('hue-rotate-[77deg]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(77deg)' },
      filters(),
    ]);
  });
  it('hue-rotate-(--my-hue) → filter: hue-rotate(var(--my-hue))', () => {
    expect(parseClassToAst('hue-rotate-(--my-hue)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-hue-rotate', value: 'hue-rotate(var(--my-hue))' },
      filters(),
    ]);
  });
});

describe('invert', () => {
  it('invert → filter: invert(100%)', () => {
    expect(parseClassToAst('invert', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-invert', value: 'invert(100%)' },
      filters(),
    ]);
  });
  it('invert-0 → filter: invert(0%)', () => {
    expect(parseClassToAst('invert-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-invert', value: 'invert(0%)' },
      filters(),
    ]);
  });
  it('invert-20 → filter: invert(20%)', () => {
    expect(parseClassToAst('invert-20', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-invert', value: 'invert(20%)' },
      filters(),
    ]);
  });
  it('invert-[.25] → filter: invert(.25)', () => {
    expect(parseClassToAst('invert-[.25]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-invert', value: 'invert(.25)' },
      filters(),
    ]);
  });
  it('invert-(--my-inversion) → filter: invert(var(--my-inversion))', () => {
    expect(parseClassToAst('invert-(--my-inversion)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-invert', value: 'invert(var(--my-inversion))' },
      filters(),
    ]);
  });
});

describe('saturate', () => {
  it('saturate-0 → filter: saturate(0%)', () => {
    expect(parseClassToAst('saturate-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-saturate', value: 'saturate(0%)' },
      filters(),
    ]);
  });
  it('saturate-50 → filter: saturate(50%)', () => {
    expect(parseClassToAst('saturate-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-saturate', value: 'saturate(50%)' },
      filters(),
    ]);
  });
  it('saturate-100 → filter: saturate(100%)', () => {
    expect(parseClassToAst('saturate-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-saturate', value: 'saturate(100%)' },
      filters(),
    ]);
  });
  it('saturate-150 → filter: saturate(150%)', () => {
    expect(parseClassToAst('saturate-150', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-saturate', value: 'saturate(150%)' },
      filters(),
    ]);
  });
  it('saturate-200 → filter: saturate(200%)', () => {
    expect(parseClassToAst('saturate-200', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-saturate', value: 'saturate(200%)' },
      filters(),
    ]);
  });
  it('saturate-[.33] → filter: saturate(.33)', () => {
    expect(parseClassToAst('saturate-[.33]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-saturate', value: 'saturate(.33)' },
      filters(),
    ]);
  });
  it('saturate-(--my-saturate) → filter: saturate(var(--my-saturate))', () => {
    expect(parseClassToAst('saturate-(--my-saturate)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-saturate', value: 'saturate(var(--my-saturate))' },
      filters(),
    ]);
  });
});

describe('sepia', () => {
  it('sepia → filter: sepia(100%)', () => {
    expect(parseClassToAst('sepia', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-sepia', value: 'sepia(100%)' },
      filters(),
    ]);
  });
  it('sepia-0 → filter: sepia(0%)', () => {
    expect(parseClassToAst('sepia-0', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-sepia', value: 'sepia(0%)' },
      filters(),
    ]);
  });
  it('sepia-50 → filter: sepia(50%)', () => {
    expect(parseClassToAst('sepia-50', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-sepia', value: 'sepia(50%)' },
      filters(),
    ]);
  });
  it('sepia-100 → filter: sepia(100%)', () => {
    expect(parseClassToAst('sepia-100', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-sepia', value: 'sepia(100%)' },
      filters(),
    ]);
  });
  it('sepia-[.33] → filter: sepia(.33)', () => {
    expect(parseClassToAst('sepia-[.33]', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-sepia', value: 'sepia(.33)' },
      filters(),
    ]);
  });
  it('sepia-(--my-sepia) → filter: sepia(var(--my-sepia))', () => {
    expect(parseClassToAst('sepia-(--my-sepia)', ctx)).toMatchObject([
      { type: 'decl', prop: '--baro-sepia', value: 'sepia(var(--my-sepia))' },
      filters(),
    ]);
  });
}); 