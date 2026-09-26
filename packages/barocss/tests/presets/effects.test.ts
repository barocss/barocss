import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({
  theme: {
    colors: {
      red: { 500: "#ef4444" },
      black: "#000",
      white: "#fff",
      indigo: { 500: "#625fff" },
      blue: { 500: "#3080ff" },      
    },
    shadows: {
      md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      "2xs": "0 1px rgb(0 0 0 / 0.05)",
    },
  },
});

// E-010 F1: the parity-correct ring node list. A lone ring now (a) registers the
// box-shadow composition layers via @property initial values so the composed
// box-shadow is valid, and (b) omits the hardcoded v3 blue --baro-ring-color so a
// bare ring defaults to currentColor (via the var() fallback), matching Tailwind 4.
const ringShadowProperty = (name: string, initial = "0 0 #0000", syntax = "*") => ({
  type: "at-rule",
  name: "property",
  params: name,
  nodes: [
    { type: "decl", prop: "syntax", value: `"${syntax}"` },
    { type: "decl", prop: "inherits", value: "false" },
    { type: "decl", prop: "initial-value", value: initial },
  ],
});
const COMPOSITE =
  "var(--baro-inset-shadow), var(--baro-inset-ring-shadow), var(--baro-ring-offset-shadow), var(--baro-ring-shadow), var(--baro-shadow)";
const ringNodes = (px: string) => [
  {
    type: "at-root",
    nodes: [
      ringShadowProperty("--baro-shadow"),
      ringShadowProperty("--baro-inset-shadow"),
      ringShadowProperty("--baro-inset-ring-shadow"),
      ringShadowProperty("--baro-ring-offset-shadow"),
      ringShadowProperty("--baro-ring-shadow"),
      ringShadowProperty("--baro-ring-offset-width", "0px", "<length>"),
      ringShadowProperty("--baro-ring-offset-color", "#fff"),
    ],
  },
  // #225: ring-N sets no offset vars (they come from @property defaults), so ring-offset-* works in any order.
  {
    type: "decl",
    prop: "--baro-ring-shadow",
    value: `var(--baro-ring-inset,) 0 0 0 calc(${px} + var(--baro-ring-offset-width)) var(--baro-ring-color, currentcolor)`,
  },
  {
    type: "decl",
    prop: "box-shadow",
    value:
      "var(--baro-inset-shadow), var(--baro-inset-ring-shadow), var(--baro-ring-offset-shadow), var(--baro-ring-shadow), var(--baro-shadow)",
  },
];
// #205: a plain shadow sets only its layer (--baro-shadow) and the composite box-shadow, so it stacks with ring-*.
const shadowNodes = (value: string) => [
  ringNodes("1px")[0],
  { type: "decl", prop: "--baro-shadow", value },
  ringNodes("1px")[ringNodes("1px").length - 1],
];

// #313: the value of `prop` among the top-level decls, or inside an @supports block when `supported`.
type Node = { type: string; prop?: string; value?: string; name?: string; nodes?: Node[] };
const declOf = (ast: unknown, prop: string, supported = false): string | undefined => {
  const nodes = ast as Node[];
  const pool = supported ? nodes.filter((n) => n.type === "at-rule" && n.name === "supports").flatMap((n) => n.nodes ?? []) : nodes;
  return pool.find((n) => n.type === "decl" && n.prop === prop)?.value;
};

describe("effects.ts (box-shadow utilities)", () => {
  // #313: shadow layers wrap each colour in var(--baro-<layer>-color, …) like Tailwind 4.3.3; colour utilities
  // set that var, mixed with --baro-<layer>-alpha where color-mix is supported.
  it.each([
    ["shadow-md", "0 4px 6px -1px var(--baro-shadow-color, rgb(0 0 0 / 0.1)), 0 2px 4px -2px var(--baro-shadow-color, rgb(0 0 0 / 0.1))"],
    ["shadow", "0 1px 3px 0 var(--baro-shadow-color, rgb(0 0 0 / 0.1)), 0 1px 2px -1px var(--baro-shadow-color, rgb(0 0 0 / 0.1))"],
    ["shadow-inner", "inset 0 2px 4px 0 var(--baro-shadow-color, rgb(0 0 0 / 0.05))"],
    ["shadow-none", "0 0 #0000"],
    ["shadow-(--my-shadow)", "var(--my-shadow)"],
    ["shadow-[0_35px_35px_rgba(0,0,0,0.25)]", "0 35px 35px var(--baro-shadow-color, rgba(0,0,0,0.25))"],
  ])("%s → --baro-shadow", (cls, value) => {
    const ast = parseClassToAst(cls, ctx);
    expect(declOf(ast, "--baro-shadow")).toBe(value);
    expect(declOf(ast, "box-shadow")).toBe(COMPOSITE);
  });
  it.each([
    ["inset-shadow-xs", "inset 0 1px 1px var(--baro-inset-shadow-color, rgb(0 0 0 / 0.05))"],
    ["inset-shadow-sm", "inset 0 2px 4px var(--baro-inset-shadow-color, rgb(0 0 0 / 0.05))"],
    ["inset-shadow-none", "inset 0 0 #0000"],
    ["inset-shadow-(--my-inset-shadow)", "inset var(--my-inset-shadow)"],
    ["inset-shadow-[0_2px_3px_rgba(0,0,0,0.25)]", "inset 0 2px 3px var(--baro-inset-shadow-color, rgba(0,0,0,0.25))"],
  ])("%s → --baro-inset-shadow", (cls, value) => {
    const ast = parseClassToAst(cls, ctx);
    expect(declOf(ast, "--baro-inset-shadow")).toBe(value);
    expect(declOf(ast, "box-shadow")).toBe(COMPOSITE);
  });
  it.each([
    ["shadow-red-500", "--baro-shadow-color", "#ef4444", "color-mix(in oklab, var(--color-red-500) var(--baro-shadow-alpha), transparent)"],
    ["shadow-black", "--baro-shadow-color", "#000", "color-mix(in oklab, var(--color-black) var(--baro-shadow-alpha), transparent)"],
    ["shadow-red-500/50", "--baro-shadow-color", "color-mix(in srgb, #ef4444 50%, transparent)", "color-mix(in oklab, color-mix(in oklab, var(--color-red-500) 50%, transparent) var(--baro-shadow-alpha), transparent)"],
    ["shadow-[#bada55]/80", "--baro-shadow-color", "color-mix(in srgb, #bada55 80%, transparent)", "color-mix(in oklab, color-mix(in oklab, #bada55 80%, transparent) var(--baro-shadow-alpha), transparent)"],
    ["shadow-current", "--baro-shadow-color", "currentcolor", "color-mix(in oklab, currentcolor var(--baro-shadow-alpha), transparent)"],
    ["shadow-transparent", "--baro-shadow-color", "transparent", "color-mix(in oklab, transparent var(--baro-shadow-alpha), transparent)"],
    ["inset-shadow-red-500/60", "--baro-inset-shadow-color", "color-mix(in srgb, #ef4444 60%, transparent)", "color-mix(in oklab, color-mix(in oklab, var(--color-red-500) 60%, transparent) var(--baro-inset-shadow-alpha), transparent)"],
    ["inset-shadow-indigo-500/50", "--baro-inset-shadow-color", "color-mix(in srgb, #625fff 50%, transparent)", "color-mix(in oklab, color-mix(in oklab, var(--color-indigo-500) 50%, transparent) var(--baro-inset-shadow-alpha), transparent)"],
  ])("%s → %s", (cls, prop, fallback, supported) => {
    const ast = parseClassToAst(cls, ctx);
    expect(declOf(ast, prop)).toBe(fallback);
    expect(declOf(ast, prop, true)).toBe(supported);
  });
  it("shadow-inherit → --baro-shadow-color: inherit", () => {
    expect(parseClassToAst("shadow-inherit", ctx)).toEqual([{ type: "decl", prop: "--baro-shadow-color", value: "inherit" }]);
  });

  // --- Ring ---
  it("ring → multi-var box-shadow", () => {
    expect(parseClassToAst("ring", ctx)).toEqual(ringNodes("1px"));
  });
  it("ring-2 → multi-var box-shadow", () => {
    expect(parseClassToAst("ring-2", ctx)).toEqual(ringNodes("2px"));
  });
  it("ring-blue-500 → --baro-ring-color: var(--color-blue-500)", () => {
    expect(parseClassToAst("ring-blue-500", ctx)).toEqual([{type:  "decl", prop:  "--baro-ring-color", value:  "var(--color-blue-500)"}]);
  });
  it("ring-blue-500/50 → --baro-ring-color: color-mix(in oklab, var(--color-blue-500) 50%, transparent)", () => {
    expect(parseClassToAst("ring-blue-500/50", ctx)).toEqual([{type:  "decl", prop:  "--baro-ring-color", value:  "color-mix(in srgb, #3080ff 50%, transparent)"}, {type:  "at-rule", name:  "supports", params:  "(color:color-mix(in lab, red, red))", nodes:  [{type:  "decl", prop:  "--baro-ring-color", value:  "color-mix(in oklab, var(--color-blue-500) 50%, transparent)"}]}]);
  });
  it("ring-[#bada55]/80 → --baro-ring-color: color-mix(in oklab, #bada55 80%, transparent)", () => {
    expect(parseClassToAst("ring-[#bada55]/80", ctx)).toEqual([{type:  "decl", prop:  "--baro-ring-color", value:  "color-mix(in oklab, #bada55 80%, transparent)"}]);
  });
  it("ring-(color:--my-ring) → --baro-ring-color: var(--my-ring)", () => {
    expect(parseClassToAst("ring-(color:--my-ring)", ctx)).toEqual([
      { type: "decl", prop: "--baro-ring-color", value: "var(--my-ring)" },
    ]);
  });
  it("ring-inherit → --baro-ring-color: inherit", () => {
    expect(parseClassToAst("ring-inherit", ctx)).toEqual([{type:  "decl", prop:  "--baro-ring-color", value:  "inherit"}]);
  });
  it("ring-[0_0_0_3px_rgba(0,0,0,0.5)] → box-shadow: 0 0 0 3px rgba(0,0,0,0.5)", () => {
    expect(parseClassToAst("ring-[0_0_0_3px_rgba(0,0,0,0.5)]", ctx)).toEqual([
      { type: "decl", prop: "box-shadow", value: "0 0 0 3px rgba(0,0,0,0.5)" },
    ]);
  });

  // --- Inset Ring ---
  it("inset-ring → multi-var box-shadow", () => {
    expect(parseClassToAst("inset-ring", ctx)).toEqual([
      ringNodes("1px")[0],
      {
        type: "decl",
        prop: "--baro-inset-ring-shadow",
        value: "inset 0 0 0 1px var(--baro-inset-ring-color, currentcolor)",
      },
      { type: "decl", prop: "box-shadow", value: COMPOSITE },
    ]);
  });
  it("inset-ring-2 → multi-var box-shadow", () => {
    expect(parseClassToAst("inset-ring-2", ctx)).toEqual([
      ringNodes("1px")[0],
      {
        type: "decl",
        prop: "--baro-inset-ring-shadow",
        value: "inset 0 0 0 2px var(--baro-inset-ring-color, currentcolor)",
      },
      { type: "decl", prop: "box-shadow", value: COMPOSITE },
    ]);
  });
  it("inset-ring-blue-500/60 → --baro-inset-ring-color: color-mix(in oklab, var(--color-blue-500) 60%, transparent)", () => {
    expect(parseClassToAst("inset-ring-blue-500/60", ctx)).toEqual([{type:  "decl", prop:  "--baro-inset-ring-color", value:  "color-mix(in srgb, #3080ff 60%, transparent)"}, {type:  "at-rule", name:  "supports", params:  "(color:color-mix(in lab, red, red))", nodes:  [{type:  "decl", prop:  "--baro-inset-ring-color", value:  "color-mix(in oklab, var(--color-blue-500) 60%, transparent)"}]}]);
  });
  it("inset-ring-[#bada55]/80 → --baro-inset-ring-color: color-mix(in oklab, #bada55 80%, transparent)", () => {
    expect(parseClassToAst("inset-ring-[#bada55]/80", ctx)).toEqual([{type:  "decl", prop:  "--baro-inset-ring-color", value:  "color-mix(in oklab, #bada55 80%, transparent)"}]);
  });
  it("inset-ring-(color:--my-inset) → --baro-inset-ring-color: var(--my-inset)", () => {
    expect(parseClassToAst("inset-ring-(color:--my-inset)", ctx)).toEqual([
      { type: "decl", prop: "--baro-inset-ring-color", value: "var(--my-inset)" },
    ]);
  });
  it("inset-ring-inherit → --baro-inset-ring-color: inherit", () => {
    expect(parseClassToAst("inset-ring-inherit", ctx)).toEqual([{type:  "decl", prop:  "--baro-inset-ring-color", value:  "inherit"}]);
  });
  it("inset-ring-[0_0_0_3px_rgba(0,0,0,0.5)] → box-shadow: inset 0 0 0 3px rgba(0,0,0,0.5)", () => {
    expect(
      parseClassToAst("inset-ring-[0_0_0_3px_rgba(0,0,0,0.5)]", ctx)
    ).toEqual([
      {
        type: "decl",
        prop: "box-shadow",
        value: "inset 0 0 0 3px rgba(0,0,0,0.5)",
      },
    ]);
  });
  it("ring-blue-500/50 → color-mix, as Tailwind 4.3.3 (#393)", () => {
    expect(parseClassToAst("ring-blue-500/50", ctx)).toEqual([{type:  "decl", prop:  "--baro-ring-color", value:  "color-mix(in srgb, #3080ff 50%, transparent)"}, {type:  "at-rule", name:  "supports", params:  "(color:color-mix(in lab, red, red))", nodes:  [{type:  "decl", prop:  "--baro-ring-color", value:  "color-mix(in oklab, var(--color-blue-500) 50%, transparent)"}]}]);
  });
  it("ring-[#3080ff]/75 → color-mix, as Tailwind 4.3.3 (#393)", () => {
    expect(parseClassToAst("ring-[#3080ff]/75", ctx)).toEqual([{type:  "decl", prop:  "--baro-ring-color", value:  "color-mix(in oklab, #3080ff 75%, transparent)"}]);
  });
  it("ring → box-shadow variable combination", () => {
    expect(parseClassToAst("ring", ctx)).toEqual(ringNodes("1px"));
  });
  it("ring-4 → box-shadow variable combination", () => {
    expect(parseClassToAst("ring-4", ctx)).toEqual(ringNodes("4px"));
  });
  it("ring-inset → --baro-ring-inset: inset", () => {
    expect(parseClassToAst("ring-inset", ctx)).toEqual([
      { type: "decl", prop: "--baro-ring-inset", value: "inset" },
    ]);
  });
});

describe('opacity ', () => {
  it('opacity-100 → opacity: 1', () => {
    expect(parseClassToAst('opacity-100', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: '1' },
    ]);
  });
  it('opacity-75 → opacity: 0.75', () => {
    expect(parseClassToAst('opacity-75', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: '0.75' },
    ]);
  });
  it('opacity-50 → opacity: 0.5', () => {
    expect(parseClassToAst('opacity-50', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: '0.5' },
    ]);
  });
  it('opacity-[.67] → opacity: .67', () => {
    expect(parseClassToAst('opacity-[.67]', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: '.67' },
    ]);
  });
  it('opacity-(--my-opacity) → opacity: var(--my-opacity)', () => {
    expect(parseClassToAst('opacity-(--my-opacity)', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: 'var(--my-opacity)' },
    ]);
  });
});

describe('mix-blend-mode ', () => {
  it('mix-blend-normal → mix-blend-mode: normal', () => {
    expect(parseClassToAst('mix-blend-normal', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'normal' },
    ]);
  });
  it('mix-blend-multiply → mix-blend-mode: multiply', () => {
    expect(parseClassToAst('mix-blend-multiply', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'multiply' },
    ]);
  });
  it('mix-blend-screen → mix-blend-mode: screen', () => {
    expect(parseClassToAst('mix-blend-screen', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'screen' },
    ]);
  });
  it('mix-blend-overlay → mix-blend-mode: overlay', () => {
    expect(parseClassToAst('mix-blend-overlay', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'overlay' },
    ]);
  });
  it('mix-blend-darken → mix-blend-mode: darken', () => {
    expect(parseClassToAst('mix-blend-darken', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'darken' },
    ]);
  });
  it('mix-blend-lighten → mix-blend-mode: lighten', () => {
    expect(parseClassToAst('mix-blend-lighten', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'lighten' },
    ]);
  });
  it('mix-blend-color-dodge → mix-blend-mode: color-dodge', () => {
    expect(parseClassToAst('mix-blend-color-dodge', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'color-dodge' },
    ]);
  });
  it('mix-blend-color-burn → mix-blend-mode: color-burn', () => {
    expect(parseClassToAst('mix-blend-color-burn', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'color-burn' },
    ]);
  });
  it('mix-blend-hard-light → mix-blend-mode: hard-light', () => {
    expect(parseClassToAst('mix-blend-hard-light', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'hard-light' },
    ]);
  });
  it('mix-blend-soft-light → mix-blend-mode: soft-light', () => {
    expect(parseClassToAst('mix-blend-soft-light', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'soft-light' },
    ]);
  });
  it('mix-blend-difference → mix-blend-mode: difference', () => {
    expect(parseClassToAst('mix-blend-difference', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'difference' },
    ]);
  });
  it('mix-blend-exclusion → mix-blend-mode: exclusion', () => {
    expect(parseClassToAst('mix-blend-exclusion', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'exclusion' },
    ]);
  });
  it('mix-blend-hue → mix-blend-mode: hue', () => {
    expect(parseClassToAst('mix-blend-hue', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'hue' },
    ]);
  });
  it('mix-blend-saturation → mix-blend-mode: saturation', () => {
    expect(parseClassToAst('mix-blend-saturation', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'saturation' },
    ]);
  });
  it('mix-blend-color → mix-blend-mode: color', () => {
    expect(parseClassToAst('mix-blend-color', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'color' },
    ]);
  });
  it('mix-blend-luminosity → mix-blend-mode: luminosity', () => {
    expect(parseClassToAst('mix-blend-luminosity', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'luminosity' },
    ]);
  });
  it('mix-blend-plus-darker → mix-blend-mode: plus-darker', () => {
    expect(parseClassToAst('mix-blend-plus-darker', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'plus-darker' },
    ]);
  });
  it('mix-blend-plus-lighter → mix-blend-mode: plus-lighter', () => {
    expect(parseClassToAst('mix-blend-plus-lighter', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'plus-lighter' },
    ]);
  });
});

describe('background-blend-mode ', () => {
  it('bg-blend-normal → background-blend-mode: normal', () => {
    expect(parseClassToAst('bg-blend-normal', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'normal' },
    ]);
  });
  it('bg-blend-multiply → background-blend-mode: multiply', () => {
    expect(parseClassToAst('bg-blend-multiply', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'multiply' },
    ]);
  });
  it('bg-blend-screen → background-blend-mode: screen', () => {
    expect(parseClassToAst('bg-blend-screen', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'screen' },
    ]);
  });
  it('bg-blend-overlay → background-blend-mode: overlay', () => {
    expect(parseClassToAst('bg-blend-overlay', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'overlay' },
    ]);
  });
  it('bg-blend-darken → background-blend-mode: darken', () => {
    expect(parseClassToAst('bg-blend-darken', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'darken' },
    ]);
  });
  it('bg-blend-lighten → background-blend-mode: lighten', () => {
    expect(parseClassToAst('bg-blend-lighten', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'lighten' },
    ]);
  });
  it('bg-blend-color-dodge → background-blend-mode: color-dodge', () => {
    expect(parseClassToAst('bg-blend-color-dodge', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'color-dodge' },
    ]);
  });
  it('bg-blend-color-burn → background-blend-mode: color-burn', () => {
    expect(parseClassToAst('bg-blend-color-burn', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'color-burn' },
    ]);
  });
  it('bg-blend-hard-light → background-blend-mode: hard-light', () => {
    expect(parseClassToAst('bg-blend-hard-light', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'hard-light' },
    ]);
  });
  it('bg-blend-soft-light → background-blend-mode: soft-light', () => {
    expect(parseClassToAst('bg-blend-soft-light', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'soft-light' },
    ]);
  });
  it('bg-blend-difference → background-blend-mode: difference', () => {
    expect(parseClassToAst('bg-blend-difference', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'difference' },
    ]);
  });
  it('bg-blend-exclusion → background-blend-mode: exclusion', () => {
    expect(parseClassToAst('bg-blend-exclusion', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'exclusion' },
    ]);
  });
  it('bg-blend-hue → background-blend-mode: hue', () => {
    expect(parseClassToAst('bg-blend-hue', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'hue' },
    ]);
  });
  it('bg-blend-saturation → background-blend-mode: saturation', () => {
    expect(parseClassToAst('bg-blend-saturation', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'saturation' },
    ]);
  });
  it('bg-blend-color → background-blend-mode: color', () => {
    expect(parseClassToAst('bg-blend-color', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'color' },
    ]);
  });
  it('bg-blend-luminosity → background-blend-mode: luminosity', () => {
    expect(parseClassToAst('bg-blend-luminosity', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'luminosity' },
    ]);
  });
});

describe('mask-clip ', () => {
  it('mask-clip-border → mask-clip: border-box', () => {
    expect(parseClassToAst('mask-clip-border', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'border-box' },
    ]);
  });
  it('mask-clip-padding → mask-clip: padding-box', () => {
    expect(parseClassToAst('mask-clip-padding', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'padding-box' },
    ]);
  });
  it('mask-clip-content → mask-clip: content-box', () => {
    expect(parseClassToAst('mask-clip-content', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'content-box' },
    ]);
  });
  it('mask-clip-fill → mask-clip: fill-box', () => {
    expect(parseClassToAst('mask-clip-fill', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'fill-box' },
    ]);
  });
  it('mask-clip-stroke → mask-clip: stroke-box', () => {
    expect(parseClassToAst('mask-clip-stroke', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'stroke-box' },
    ]);
  });
  it('mask-clip-view → mask-clip: view-box', () => {
    expect(parseClassToAst('mask-clip-view', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'view-box' },
    ]);
  });
  it('mask-no-clip → mask-clip: no-clip', () => {
    expect(parseClassToAst('mask-no-clip', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'no-clip' },
    ]);
  });
});

describe('mask-composite ', () => {
  it('mask-add → mask-composite: add', () => {
    expect(parseClassToAst('mask-add', ctx)).toEqual([
      { type: 'decl', prop: 'mask-composite', value: 'add' },
    ]);
  });
  it('mask-subtract → mask-composite: subtract', () => {
    expect(parseClassToAst('mask-subtract', ctx)).toEqual([
      { type: 'decl', prop: 'mask-composite', value: 'subtract' },
    ]);
  });
  it('mask-intersect → mask-composite: intersect', () => {
    expect(parseClassToAst('mask-intersect', ctx)).toEqual([
      { type: 'decl', prop: 'mask-composite', value: 'intersect' },
    ]);
  });
  it('mask-exclude → mask-composite: exclude', () => {
    expect(parseClassToAst('mask-exclude', ctx)).toEqual([
      { type: 'decl', prop: 'mask-composite', value: 'exclude' },
    ]);
  });
});

describe('mask-image ', () => {
  it('mask-[url(/img/circle.png)] → mask-image: url(/img/circle.png)', () => {
    expect(parseClassToAst('mask-[url(/img/circle.png)]', ctx)).toEqual([
      { type: 'decl', prop: 'mask-image', value: 'url(/img/circle.png)' },
    ]);
  });
  it('mask-(--my-mask) → mask-image: var(--my-mask)', () => {
    expect(parseClassToAst('mask-(--my-mask)', ctx)).toEqual([
      { type: 'decl', prop: 'mask-image', value: 'var(--my-mask)' },
    ]);
  });
  it('mask-none → mask-image: none', () => {
    expect(parseClassToAst('mask-none', ctx)).toEqual([
      { type: 'decl', prop: 'mask-image', value: 'none' },
    ]);
  });
});

describe('mask-mode ', () => {
  it('mask-alpha → mask-mode: alpha', () => {
    expect(parseClassToAst('mask-alpha', ctx)).toEqual([
      { type: 'decl', prop: 'mask-mode', value: 'alpha' },
    ]);
  });
  it('mask-luminance → mask-mode: luminance', () => {
    expect(parseClassToAst('mask-luminance', ctx)).toEqual([
      { type: 'decl', prop: 'mask-mode', value: 'luminance' },
    ]);
  });
  it('mask-match → mask-mode: match-source', () => {
    expect(parseClassToAst('mask-match', ctx)).toEqual([
      { type: 'decl', prop: 'mask-mode', value: 'match-source' },
    ]);
  });
});

describe('mask-origin ', () => {
  it('mask-origin-border → mask-origin: border-box', () => {
    expect(parseClassToAst('mask-origin-border', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'border-box' },
    ]);
  });
  it('mask-origin-padding → mask-origin: padding-box', () => {
    expect(parseClassToAst('mask-origin-padding', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'padding-box' },
    ]);
  });
  it('mask-origin-content → mask-origin: content-box', () => {
    expect(parseClassToAst('mask-origin-content', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'content-box' },
    ]);
  });
  it('mask-origin-fill → mask-origin: fill-box', () => {
    expect(parseClassToAst('mask-origin-fill', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'fill-box' },
    ]);
  });
  it('mask-origin-stroke → mask-origin: stroke-box', () => {
    expect(parseClassToAst('mask-origin-stroke', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'stroke-box' },
    ]);
  });
  it('mask-origin-view → mask-origin: view-box', () => {
    expect(parseClassToAst('mask-origin-view', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'view-box' },
    ]);
  });
});

describe('mask-position ', () => {
  it('mask-top-left → mask-position: top left', () => {
    expect(parseClassToAst('mask-top-left', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'top left' },
    ]);
  });
  it('mask-top → mask-position: top', () => {
    expect(parseClassToAst('mask-top', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'top' },
    ]);
  });
  it('mask-top-right → mask-position: top right', () => {
    expect(parseClassToAst('mask-top-right', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'top right' },
    ]);
  });
  it('mask-left → mask-position: left', () => {
    expect(parseClassToAst('mask-left', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'left' },
    ]);
  });
  it('mask-center → mask-position: center', () => {
    expect(parseClassToAst('mask-center', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'center' },
    ]);
  });
  it('mask-right → mask-position: right', () => {
    expect(parseClassToAst('mask-right', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'right' },
    ]);
  });
  it('mask-bottom-left → mask-position: bottom left', () => {
    expect(parseClassToAst('mask-bottom-left', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'bottom left' },
    ]);
  });
  it('mask-bottom → mask-position: bottom', () => {
    expect(parseClassToAst('mask-bottom', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'bottom' },
    ]);
  });
  it('mask-bottom-right → mask-position: bottom right', () => {
    expect(parseClassToAst('mask-bottom-right', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'bottom right' },
    ]);
  });
  it('mask-position-(--my-mask-position) → mask-position: var(--my-mask-position)', () => {
    expect(parseClassToAst('mask-position-(--my-mask-position)', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'var(--my-mask-position)' },
    ]);
  });
  it('mask-position-[center_top_1rem] → mask-position: center_top_1rem', () => {
    expect(parseClassToAst('mask-position-[center_top_1rem]', ctx)).toEqual([
      { type: 'decl', prop: 'mask-position', value: 'center top 1rem' },
    ]);
  });
});

describe('mask-repeat', () => {
  it('mask-repeat → mask-repeat: repeat', () => {
    expect(parseClassToAst('mask-repeat', ctx)).toEqual([
      { type: 'decl', prop: 'mask-repeat', value: 'repeat' },
    ]);
  });
  it('mask-no-repeat → mask-repeat: no-repeat', () => {
    expect(parseClassToAst('mask-no-repeat', ctx)).toEqual([
      { type: 'decl', prop: 'mask-repeat', value: 'no-repeat' },
    ]);
  });
  it('mask-repeat-x → mask-repeat: repeat-x', () => {
    expect(parseClassToAst('mask-repeat-x', ctx)).toEqual([
      { type: 'decl', prop: 'mask-repeat', value: 'repeat-x' },
    ]);
  });
  it('mask-repeat-y → mask-repeat: repeat-y', () => {
    expect(parseClassToAst('mask-repeat-y', ctx)).toEqual([
      { type: 'decl', prop: 'mask-repeat', value: 'repeat-y' },
    ]);
  });
  it('mask-repeat-space → mask-repeat: space', () => {
    expect(parseClassToAst('mask-repeat-space', ctx)).toEqual([
      { type: 'decl', prop: 'mask-repeat', value: 'space' },
    ]);
  });
  it('mask-repeat-round → mask-repeat: round', () => {
    expect(parseClassToAst('mask-repeat-round', ctx)).toEqual([
      { type: 'decl', prop: 'mask-repeat', value: 'round' },
    ]);
  });
});

describe('mask-size', () => {
  it('mask-auto → mask-size: auto', () => {
    expect(parseClassToAst('mask-auto', ctx)).toEqual([
      { type: 'decl', prop: 'mask-size', value: 'auto' },
    ]);
  });
  it('mask-cover → mask-size: cover', () => {
    expect(parseClassToAst('mask-cover', ctx)).toEqual([
      { type: 'decl', prop: 'mask-size', value: 'cover' },
    ]);
  });
  it('mask-contain → mask-size: contain', () => {
    expect(parseClassToAst('mask-contain', ctx)).toEqual([
      { type: 'decl', prop: 'mask-size', value: 'contain' },
    ]);
  });
  it('mask-size-[50px_50px] → mask-size: 50px 50px', () => {
    expect(parseClassToAst('mask-size-[50px_50px]', ctx)).toEqual([
      { type: 'decl', prop: 'mask-size', value: '50px 50px' },
    ]);
  });
  it('mask-size-(--my-mask-size) → mask-size: var(--my-mask-size)', () => {
    expect(parseClassToAst('mask-size-(--my-mask-size)', ctx)).toEqual([
      { type: 'decl', prop: 'mask-size', value: 'var(--my-mask-size)' },
    ]);
  });
});

describe('mask-type', () => {
  it('mask-type-alpha → mask-type: alpha', () => {
    expect(parseClassToAst('mask-type-alpha', ctx)).toEqual([
      { type: 'decl', prop: 'mask-type', value: 'alpha' },
    ]);
  });
  it('mask-type-luminance → mask-type: luminance', () => {
    expect(parseClassToAst('mask-type-luminance', ctx)).toEqual([
      { type: 'decl', prop: 'mask-type', value: 'luminance' },
    ]);
  });
});

describe("default shadow scale (Tailwind 4.1.13 values)", () => {
  const vars = createContext({}).themeToCssVars();
  it.each([
    ["2xs", "0 1px rgb(0 0 0 / 0.05)"],
    ["xs", "0 1px 2px 0 rgb(0 0 0 / 0.05)"],
    ["sm", "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)"],
    ["md", "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)"],
    ["lg", "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"],
    ["xl", "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"],
    ["2xl", "0 25px 50px -12px rgb(0 0 0 / 0.25)"],
  ])("--shadow-%s is defined with the v4 value", (key, value) => {
    expect(vars).toContain(`--shadow-${key}: ${value};`);
  });
});
