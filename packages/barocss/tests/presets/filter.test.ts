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

// #313: Tailwind 4.3.3 drop-shadow sizes, colours and opacity modifiers.
type Node = { type: string; prop?: string; value?: string; name?: string; nodes?: Node[] };
const declOf = (ast: unknown, prop: string, supported = false): string | undefined => {
  const nodes = ast as Node[];
  const pool = supported ? nodes.filter((n) => n.type === 'at-rule' && n.name === 'supports').flatMap((n) => n.nodes ?? []) : nodes;
  return pool.find((n) => n.type === 'decl' && n.prop === prop)?.value;
};

describe('drop-shadow', () => {
  it.each([
    ['xs', '0 1px 1px', '0.05'], ['sm', '0 1px 2px', '0.15'], ['md', '0 3px 3px', '0.12'],
    ['lg', '0 4px 4px', '0.15'], ['xl', '0 9px 7px', '0.1'], ['2xl', '0 25px 25px', '0.15'],
  ])('drop-shadow-%s → drop-shadow(var(--drop-shadow-%s))', (size, geometry, alpha) => {
    const ast = parseClassToAst(`drop-shadow-${size}`, ctx);
    expect(declOf(ast, '--baro-drop-shadow-size')).toBe(`drop-shadow(${geometry} var(--baro-drop-shadow-color, rgb(0 0 0 / ${alpha})))`);
    expect(declOf(ast, '--baro-drop-shadow')).toBe(`drop-shadow(var(--drop-shadow-${size}))`);
    expect(declOf(ast, 'filter')).toBe((filters() as { value: string }).value);
  });
  it('drop-shadow-lg/50 fades the default colour', () => {
    const ast = parseClassToAst('drop-shadow-lg/50', ctx);
    expect(declOf(ast, '--baro-drop-shadow-alpha')).toBe('50%');
    expect(declOf(ast, '--baro-drop-shadow-size')).toBe('drop-shadow(0 4px 4px var(--baro-drop-shadow-color, oklab(from rgb(0 0 0 / 0.15) l a b / 50%)))');
    expect(declOf(ast, '--baro-drop-shadow')).toBe('var(--baro-drop-shadow-size)');
  });
  it('drop-shadow-none → empty --baro-drop-shadow', () => {
    expect(declOf(parseClassToAst('drop-shadow-none', ctx), '--baro-drop-shadow')).toBe(' ');
  });
  it.each([
    ['drop-shadow-[0_2px_4px_rgba(0,0,0,0.1)]', 'drop-shadow(0 2px 4px var(--baro-drop-shadow-color, rgba(0,0,0,0.1)))'],
    ['drop-shadow-(--my-shadow)', 'drop-shadow(var(--my-shadow))'],
  ])('%s → --baro-drop-shadow-size', (cls, value) => {
    const ast = parseClassToAst(cls, ctx);
    expect(declOf(ast, '--baro-drop-shadow-size')).toBe(value);
    expect(declOf(ast, '--baro-drop-shadow')).toBe('var(--baro-drop-shadow-size)');
  });
});

describe('drop-shadow color', () => {
  it('drop-shadow-inherit → --baro-drop-shadow-color: inherit', () => {
    expect(declOf(parseClassToAst('drop-shadow-inherit', ctx), '--baro-drop-shadow-color')).toBe('inherit');
  });
  it.each([
    ['drop-shadow-current', 'currentcolor', 'currentcolor'],
    ['drop-shadow-transparent', 'transparent', 'transparent'],
    ['drop-shadow-black', '#000', 'var(--color-black)'],
    ['drop-shadow-red-500', '#bada55', 'var(--color-red-500)'],
    ['drop-shadow-(color:--my-color)', 'var(--my-color)', 'var(--my-color)'],
    ['drop-shadow-[#bada55]', '#bada55', '#bada55'],
  ])('%s → --baro-drop-shadow-color', (cls, fallback, ref) => {
    const ast = parseClassToAst(cls, ctx);
    expect(declOf(ast, '--baro-drop-shadow-color')).toBe(fallback);
    expect(declOf(ast, '--baro-drop-shadow-color', true)).toBe(`color-mix(in oklab, ${ref} var(--baro-drop-shadow-alpha), transparent)`);
    expect(declOf(ast, '--baro-drop-shadow')).toBe('var(--baro-drop-shadow-size)');
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