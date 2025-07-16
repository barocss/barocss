import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
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
describe("effects.ts (box-shadow utilities)", () => {
  // Static shadow levels
  it("shadow-md → box-shadow: var(--shadow-md)", () => {
    expect(applyClassName("shadow-md", ctx)).toEqual([
      { type: "decl", prop: "box-shadow", value: "var(--shadow-md)" },
    ]);
  });
  it("shadow → box-shadow: var(--shadow-default)", () => {
    expect(applyClassName("shadow", ctx)).toEqual([
      { type: "decl", prop: "box-shadow", value: "var(--shadow-default)" },
    ]);
  });
  it("shadow-none → box-shadow: 0 0 #0000", () => {
    expect(applyClassName("shadow-none", ctx)).toEqual([
      { type: "decl", prop: "box-shadow", value: "0 0 #0000" },
    ]);
  });
  // Static inset shadow levels
  it("inset-shadow-xs → box-shadow: var(--inset-shadow-xs)", () => {
    expect(applyClassName("inset-shadow-xs", ctx)).toEqual([
      { type: "decl", prop: "--tw-inset-shadow", value: "inset 0 2px 4px var(--tw-inset-shadow-color, #0000000d)" },
      { type: "decl", prop: "box-shadow", value: "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)" },
    ]);
  });
  it("inset-shadow-none → box-shadow: 0 0 #0000", () => {
    expect(applyClassName("inset-shadow-none", ctx)).toEqual([
      { type: "decl", prop: "--tw-inset-shadow", value: "0 0 #0000" },
      { type: "decl", prop: "box-shadow", value: "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)" },
    ]);
  });
  // Custom property
  it("shadow-(--my-shadow) → box-shadow: var(--my-shadow)", () => {
    expect(applyClassName("shadow-(--my-shadow)", ctx)).toEqual([
      { type: "decl", prop: "box-shadow", value: "var(--my-shadow)" },
    ]);
  });
  // Arbitrary value
  it("shadow-[0_35px_35px_rgba(0,0,0,0.25)] → box-shadow: 0 35px 35px rgba(0,0,0,0.25)", () => {
    expect(
      applyClassName("shadow-[0_35px_35px_rgba(0,0,0,0.25)]", ctx)
    ).toEqual([
      {
        type: "decl",
        prop: "box-shadow",
        value: "0 35px 35px rgba(0,0,0,0.25)",
      },
    ]);
  });
  // Shadow color
  it("shadow-red-500 → --tw-shadow-color: var(--color-red-500)", () => {
    expect(applyClassName("shadow-red-500", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-shadow-color",
            value: "var(--color-red-500)",
          },
        ],
      },
      { type: "decl", prop: "--tw-shadow-color", value: "#ef4444" },
    ]);
  });
  it("shadow-black → --tw-shadow-color: #000", () => {
    expect(applyClassName("shadow-black", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-shadow-color",
            value: "var(--color-black)",
          },
        ],
      },
      { type: "decl", prop: "--tw-shadow-color", value: "#000" },
    ]);
  });
  it("shadow-white → --tw-shadow-color: var(--color-white)", () => {
    expect(applyClassName("shadow-white", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-shadow-color",
            value: "var(--color-white)",
          },
        ],
      },
      { type: "decl", prop: "--tw-shadow-color", value: "#fff" },
    ]);
  });
  // Shadow color with opacity
  it("shadow-red-500/50 → --tw-shadow-color: color-mix(in oklab, var(--color-red-500) 50%, transparent)", () => {
    expect(applyClassName("shadow-red-500/50", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-shadow-color",
            value: "color-mix(in oklab, color-mix(in oklab, var(--color-red-500) 50%, transparent) var(--tw-shadow-alpha),transparent)",
          },
        ],
      },
      {
        type: "decl",
        prop: "--tw-shadow-color",
        value: "#ef444480",
      },
    ]);
  });
  it("shadow-[#bada55]/80 → --tw-shadow-color: color-mix(in oklab, #bada55 80%, transparent)", () => {
    expect(applyClassName("shadow-[#bada55]/80", ctx)).toEqual([
      {
        type: "decl",
        prop: "--tw-shadow-color",
        value: "color-mix(in oklab, #bada55 80%, transparent)",
      },
    ]);
  });
  // Special cases
  it("shadow-inherit → --tw-shadow-color: inherit", () => {
    expect(applyClassName("shadow-inherit", ctx)).toEqual([
      { type: "decl", prop: "--tw-shadow-color", value: "inherit" },
    ]);
  });
  it("shadow-current → --tw-shadow-color: currentColor", () => {
    expect(applyClassName("shadow-current", ctx)).toEqual([
      { type: "decl", prop: "--tw-shadow-color", value: "currentColor" },
    ]);
  });
  it("shadow-transparent → --tw-shadow-color: transparent", () => {
    expect(applyClassName("shadow-transparent", ctx)).toEqual([
      { type: "decl", prop: "--tw-shadow-color", value: "transparent" },
    ]);
  });
  // Inset shadow color and opacity
  it("inset-shadow-red-500/60 → --tw-inset-shadow-color: color-mix(in oklab, var(--color-red-500) 60%, transparent)", () => {
    expect(applyClassName("inset-shadow-red-500/60", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-inset-shadow-color",
            value: "color-mix(in oklab, color-mix(in oklab, var(--color-red-500) 60%, transparent) var(--tw-shadow-alpha),transparent)",
          },
        ],
      },
      {
        type: "decl",
        prop: "--tw-inset-shadow-color",
        value: "#ef444499",
      },
    ]);
  });
  // Inset shadow custom property
  it("inset-shadow-(--my-inset-shadow) → box-shadow: var(--my-inset-shadow)", () => {
    expect(applyClassName("inset-shadow-(--my-inset-shadow)", ctx)).toEqual([
      { type: "decl", prop: "box-shadow", value: "var(--my-inset-shadow)" },
    ]);
  });
  // Inset shadow arbitrary value
  it("inset-shadow-[0_2px_3px_rgba(0,0,0,0.25)] → box-shadow: inset 0 2px 3px rgba(0,0,0,0.25)", () => {
    expect(
      applyClassName("inset-shadow-[0_2px_3px_rgba(0,0,0,0.25)]", ctx)
    ).toEqual([
      {
        type: "decl",
        prop: "box-shadow",
        value: "inset 0 2px 3px rgba(0,0,0,0.25)",
      },
    ]);
  });

  // --- Ring ---
  it("ring → Tailwind multi-var box-shadow", () => {
    expect(applyClassName("ring", ctx)).toEqual([
      { type: "decl", prop: "--tw-ring-inset", value: "" },
      { type: "decl", prop: "--tw-ring-offset-width", value: "0px" },
      { type: "decl", prop: "--tw-ring-offset-color", value: "#fff" },
      { type: "decl", prop: "--tw-ring-color", value: "rgb(59 130 246 / 0.5)" },
      {
        type: "decl",
        prop: "--tw-ring-shadow",
        value:
          "var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)",
      },
      { type: "decl", prop: "--tw-ring-offset-shadow", value: "0 0 #0000" },
      {
        type: "decl",
        prop: "box-shadow",
        value:
          "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
      },
    ]);
  });
  it("ring-2 → Tailwind multi-var box-shadow", () => {
    expect(applyClassName("ring-2", ctx)).toEqual([
      { type: "decl", prop: "--tw-ring-inset", value: "" },
      { type: "decl", prop: "--tw-ring-offset-width", value: "0px" },
      { type: "decl", prop: "--tw-ring-offset-color", value: "#fff" },
      { type: "decl", prop: "--tw-ring-color", value: "rgb(59 130 246 / 0.5)" },
      {
        type: "decl",
        prop: "--tw-ring-shadow",
        value:
          "var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)",
      },
      { type: "decl", prop: "--tw-ring-offset-shadow", value: "0 0 #0000" },
      {
        type: "decl",
        prop: "box-shadow",
        value:
          "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
      },
    ]);
  });
  it("ring-blue-500 → --tw-ring-color: var(--color-blue-500)", () => {
    expect(applyClassName("ring-blue-500", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-ring-color",
            value: "var(--color-blue-500)",
          },
        ],
      },
      { type: "decl", prop: "--tw-ring-color", value: "var(--color-blue-500)" },
    ]);
  });
  it("ring-blue-500/50 → --tw-ring-color: color-mix(in oklab, var(--color-blue-500) 50%, transparent)", () => {
    expect(applyClassName("ring-blue-500/50", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-ring-color",
            value: "color-mix(in oklab, var(--color-blue-500) 50%, transparent)",
          },
        ],
      },
      {
        type: "decl",
        prop: "--tw-ring-color",
        value: "#3080ff80",
      },
    ]);
  });
  it("ring-[#bada55]/80 → --tw-ring-color: color-mix(in oklab, #bada55 80%, transparent)", () => {
    expect(applyClassName("ring-[#bada55]/80", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-ring-color",
            value: "color-mix(in oklab, #bada55 80%, transparent)",
          },
        ],
      },
      {
        type: "decl",
        prop: "--tw-ring-color",
        value: "#bada55cc",
      },
    ]);
  });
  it("ring-(color:--my-ring) → --tw-ring-color: var(--my-ring)", () => {
    expect(applyClassName("ring-(color:--my-ring)", ctx)).toEqual([
      { type: "decl", prop: "--tw-ring-color", value: "var(--my-ring)" },
    ]);
  });
  it("ring-inherit → --tw-ring-color: inherit", () => {
    expect(applyClassName("ring-inherit", ctx)).toEqual([
      { type: "decl", prop: "--tw-ring-color", value: "inherit" },
    ]);
  });
  it("ring-[0_0_0_3px_rgba(0,0,0,0.5)] → box-shadow: 0 0 0 3px rgba(0,0,0,0.5)", () => {
    expect(applyClassName("ring-[0_0_0_3px_rgba(0,0,0,0.5)]", ctx)).toEqual([
      { type: "decl", prop: "box-shadow", value: "0 0 0 3px rgba(0,0,0,0.5)" },
    ]);
  });

  // --- Inset Ring ---
  it("inset-ring → Tailwind multi-var box-shadow", () => {
    expect(applyClassName("inset-ring", ctx)).toEqual([
      { type: "decl", prop: "--tw-ring-inset", value: "inset" },
      { type: "decl", prop: "--tw-ring-offset-width", value: "0px" },
      { type: "decl", prop: "--tw-ring-offset-color", value: "#fff" },
      {
        type: "decl",
        prop: "--tw-inset-ring-color",
        value: "rgb(59 130 246 / 0.5)",
      },
      {
        type: "decl",
        prop: "--tw-inset-ring-shadow",
        value:
          "var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-inset-ring-color, currentcolor)",
      },
      { type: "decl", prop: "--tw-ring-offset-shadow", value: "0 0 #0000" },
      {
        type: "decl",
        prop: "box-shadow",
        value:
          "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
      },
    ]);
  });
  it("inset-ring-2 → Tailwind multi-var box-shadow", () => {
    expect(applyClassName("inset-ring-2", ctx)).toEqual([
      { type: "decl", prop: "--tw-ring-inset", value: "inset" },
      { type: "decl", prop: "--tw-ring-offset-width", value: "0px" },
      { type: "decl", prop: "--tw-ring-offset-color", value: "#fff" },
      {
        type: "decl",
        prop: "--tw-inset-ring-color",
        value: "rgb(59 130 246 / 0.5)",
      },
      {
        type: "decl",
        prop: "--tw-inset-ring-shadow",
        value:
          "var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-inset-ring-color, currentcolor)",
      },
      { type: "decl", prop: "--tw-ring-offset-shadow", value: "0 0 #0000" },
      {
        type: "decl",
        prop: "box-shadow",
        value:
          "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
      },
    ]);
  });
  it("inset-ring-blue-500/60 → --tw-inset-ring-color: color-mix(in oklab, var(--color-blue-500) 60%, transparent)", () => {
    expect(applyClassName("inset-ring-blue-500/60", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-inset-ring-color",
            value: "color-mix(in oklab, var(--color-blue-500) 60%, transparent)",
          },
        ],
      },
      {
        type: "decl",
        prop: "--tw-inset-ring-color",
        value: "#3080ff99",
      },
    ]);
  });
  it("inset-ring-[#bada55]/80 → --tw-inset-ring-color: color-mix(in oklab, #bada55 80%, transparent)", () => {
    expect(applyClassName("inset-ring-[#bada55]/80", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-inset-ring-color",
            value: "color-mix(in oklab, #bada55 80%, transparent)",
          },
        ],
      },
      {
        type: "decl",
        prop: "--tw-inset-ring-color",
        value: "#bada55cc",
      },
    ]);
  });
  it("inset-ring-(color:--my-inset) → --tw-inset-ring-color: var(--my-inset)", () => {
    expect(applyClassName("inset-ring-(color:--my-inset)", ctx)).toEqual([
      { type: "decl", prop: "--tw-inset-ring-color", value: "var(--my-inset)" },
    ]);
  });
  it("inset-ring-inherit → --tw-inset-ring-color: inherit", () => {
    expect(applyClassName("inset-ring-inherit", ctx)).toEqual([
      { type: "decl", prop: "--tw-inset-ring-color", value: "inherit" },
    ]);
  });
  it("inset-ring-[0_0_0_3px_rgba(0,0,0,0.5)] → box-shadow: inset 0 0 0 3px rgba(0,0,0,0.5)", () => {
    expect(
      applyClassName("inset-ring-[0_0_0_3px_rgba(0,0,0,0.5)]", ctx)
    ).toEqual([
      {
        type: "decl",
        prop: "box-shadow",
        value: "inset 0 0 0 3px rgba(0,0,0,0.5)",
      },
    ]);
  });
  it("ring-blue-500/50 → color-mix + hex fallback", () => {
    expect(applyClassName("ring-blue-500/50", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-ring-color",
            value: "color-mix(in oklab, var(--color-blue-500) 50%, transparent)",
          },
        ],
      },
      { type: "decl", prop: "--tw-ring-color", value: "#3080ff80" },
    ]);
  });
  it("ring-[#3080ff]/75 → color-mix + hex fallback", () => {
    expect(applyClassName("ring-[#3080ff]/75", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-ring-color",
            value: "color-mix(in oklab, #3080ff 75%, transparent)",
          },
        ],
      },
      { type: "decl", prop: "--tw-ring-color", value: "#3080ffbf" },
    ]);
  });
  it("inset-shadow-indigo-500/50 → color-mix + hex fallback", () => {
    expect(applyClassName("inset-shadow-indigo-500/50", ctx)).toEqual([
      {
        type: "atrule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "--tw-inset-shadow-color",
            value:
              "color-mix(in oklab, color-mix(in oklab, var(--color-indigo-500) 50%, transparent) var(--tw-shadow-alpha),transparent)",
          },
        ],
      },
      { type: "decl", prop: "--tw-inset-shadow-color", value: "#625fff80" },
    ]);
  });
  it("ring → box-shadow 변수 조합", () => {
    expect(applyClassName("ring", ctx)).toEqual([
      { type: "decl", prop: "--tw-ring-inset", value: "" },
      { type: "decl", prop: "--tw-ring-offset-width", value: "0px" },
      { type: "decl", prop: "--tw-ring-offset-color", value: "#fff" },
      { type: "decl", prop: "--tw-ring-color", value: "rgb(59 130 246 / 0.5)" },
      {
        type: "decl",
        prop: "--tw-ring-shadow",
        value:
          "var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)",
      },
      { type: "decl", prop: "--tw-ring-offset-shadow", value: "0 0 #0000" },
      {
        type: "decl",
        prop: "box-shadow",
        value:
          "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
      },
    ]);
  });
  it("ring-4 → box-shadow 변수 조합", () => {
    expect(applyClassName("ring-4", ctx)).toEqual([
      { type: "decl", prop: "--tw-ring-inset", value: "" },
      { type: "decl", prop: "--tw-ring-offset-width", value: "0px" },
      { type: "decl", prop: "--tw-ring-offset-color", value: "#fff" },
      { type: "decl", prop: "--tw-ring-color", value: "rgb(59 130 246 / 0.5)" },
      {
        type: "decl",
        prop: "--tw-ring-shadow",
        value:
          "var(--tw-ring-inset) 0 0 0 calc(4px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)",
      },
      { type: "decl", prop: "--tw-ring-offset-shadow", value: "0 0 #0000" },
      {
        type: "decl",
        prop: "box-shadow",
        value:
          "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
      },
    ]);
  });
  it("ring-inset → --tw-ring-inset: inset", () => {
    expect(applyClassName("ring-inset", ctx)).toEqual([
      { type: "decl", prop: "--tw-ring-inset", value: "inset" },
    ]);
  });
  it("inset-shadow-sm → box-shadow 변수 조합", () => {
    expect(applyClassName("inset-shadow-sm", ctx)).toEqual([
      {
        type: "decl",
        prop: "--tw-inset-shadow",
        value: "inset 0 2px 4px var(--tw-inset-shadow-color, #0000000d)",
      },
      {
        type: "decl",
        prop: "box-shadow",
        value:
          "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
      },
    ]);
  });
});

describe('opacity ', () => {
  it('opacity-100 → opacity: 1', () => {
    expect(applyClassName('opacity-100', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: '1' },
    ]);
  });
  it('opacity-75 → opacity: 0.75', () => {
    expect(applyClassName('opacity-75', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: '0.75' },
    ]);
  });
  it('opacity-50 → opacity: 0.5', () => {
    expect(applyClassName('opacity-50', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: '0.5' },
    ]);
  });
  it('opacity-[.67] → opacity: .67', () => {
    expect(applyClassName('opacity-[.67]', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: '.67' },
    ]);
  });
  it('opacity-(--my-opacity) → opacity: var(--my-opacity)', () => {
    expect(applyClassName('opacity-(--my-opacity)', ctx)).toEqual([
      { type: 'decl', prop: 'opacity', value: 'var(--my-opacity)' },
    ]);
  });
});

describe('mix-blend-mode ', () => {
  it('mix-blend-normal → mix-blend-mode: normal', () => {
    expect(applyClassName('mix-blend-normal', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'normal' },
    ]);
  });
  it('mix-blend-multiply → mix-blend-mode: multiply', () => {
    expect(applyClassName('mix-blend-multiply', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'multiply' },
    ]);
  });
  it('mix-blend-screen → mix-blend-mode: screen', () => {
    expect(applyClassName('mix-blend-screen', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'screen' },
    ]);
  });
  it('mix-blend-overlay → mix-blend-mode: overlay', () => {
    expect(applyClassName('mix-blend-overlay', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'overlay' },
    ]);
  });
  it('mix-blend-darken → mix-blend-mode: darken', () => {
    expect(applyClassName('mix-blend-darken', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'darken' },
    ]);
  });
  it('mix-blend-lighten → mix-blend-mode: lighten', () => {
    expect(applyClassName('mix-blend-lighten', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'lighten' },
    ]);
  });
  it('mix-blend-color-dodge → mix-blend-mode: color-dodge', () => {
    expect(applyClassName('mix-blend-color-dodge', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'color-dodge' },
    ]);
  });
  it('mix-blend-color-burn → mix-blend-mode: color-burn', () => {
    expect(applyClassName('mix-blend-color-burn', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'color-burn' },
    ]);
  });
  it('mix-blend-hard-light → mix-blend-mode: hard-light', () => {
    expect(applyClassName('mix-blend-hard-light', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'hard-light' },
    ]);
  });
  it('mix-blend-soft-light → mix-blend-mode: soft-light', () => {
    expect(applyClassName('mix-blend-soft-light', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'soft-light' },
    ]);
  });
  it('mix-blend-difference → mix-blend-mode: difference', () => {
    expect(applyClassName('mix-blend-difference', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'difference' },
    ]);
  });
  it('mix-blend-exclusion → mix-blend-mode: exclusion', () => {
    expect(applyClassName('mix-blend-exclusion', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'exclusion' },
    ]);
  });
  it('mix-blend-hue → mix-blend-mode: hue', () => {
    expect(applyClassName('mix-blend-hue', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'hue' },
    ]);
  });
  it('mix-blend-saturation → mix-blend-mode: saturation', () => {
    expect(applyClassName('mix-blend-saturation', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'saturation' },
    ]);
  });
  it('mix-blend-color → mix-blend-mode: color', () => {
    expect(applyClassName('mix-blend-color', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'color' },
    ]);
  });
  it('mix-blend-luminosity → mix-blend-mode: luminosity', () => {
    expect(applyClassName('mix-blend-luminosity', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'luminosity' },
    ]);
  });
  it('mix-blend-plus-darker → mix-blend-mode: plus-darker', () => {
    expect(applyClassName('mix-blend-plus-darker', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'plus-darker' },
    ]);
  });
  it('mix-blend-plus-lighter → mix-blend-mode: plus-lighter', () => {
    expect(applyClassName('mix-blend-plus-lighter', ctx)).toEqual([
      { type: 'decl', prop: 'mix-blend-mode', value: 'plus-lighter' },
    ]);
  });
});

describe('background-blend-mode ', () => {
  it('bg-blend-normal → background-blend-mode: normal', () => {
    expect(applyClassName('bg-blend-normal', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'normal' },
    ]);
  });
  it('bg-blend-multiply → background-blend-mode: multiply', () => {
    expect(applyClassName('bg-blend-multiply', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'multiply' },
    ]);
  });
  it('bg-blend-screen → background-blend-mode: screen', () => {
    expect(applyClassName('bg-blend-screen', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'screen' },
    ]);
  });
  it('bg-blend-overlay → background-blend-mode: overlay', () => {
    expect(applyClassName('bg-blend-overlay', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'overlay' },
    ]);
  });
  it('bg-blend-darken → background-blend-mode: darken', () => {
    expect(applyClassName('bg-blend-darken', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'darken' },
    ]);
  });
  it('bg-blend-lighten → background-blend-mode: lighten', () => {
    expect(applyClassName('bg-blend-lighten', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'lighten' },
    ]);
  });
  it('bg-blend-color-dodge → background-blend-mode: color-dodge', () => {
    expect(applyClassName('bg-blend-color-dodge', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'color-dodge' },
    ]);
  });
  it('bg-blend-color-burn → background-blend-mode: color-burn', () => {
    expect(applyClassName('bg-blend-color-burn', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'color-burn' },
    ]);
  });
  it('bg-blend-hard-light → background-blend-mode: hard-light', () => {
    expect(applyClassName('bg-blend-hard-light', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'hard-light' },
    ]);
  });
  it('bg-blend-soft-light → background-blend-mode: soft-light', () => {
    expect(applyClassName('bg-blend-soft-light', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'soft-light' },
    ]);
  });
  it('bg-blend-difference → background-blend-mode: difference', () => {
    expect(applyClassName('bg-blend-difference', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'difference' },
    ]);
  });
  it('bg-blend-exclusion → background-blend-mode: exclusion', () => {
    expect(applyClassName('bg-blend-exclusion', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'exclusion' },
    ]);
  });
  it('bg-blend-hue → background-blend-mode: hue', () => {
    expect(applyClassName('bg-blend-hue', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'hue' },
    ]);
  });
  it('bg-blend-saturation → background-blend-mode: saturation', () => {
    expect(applyClassName('bg-blend-saturation', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'saturation' },
    ]);
  });
  it('bg-blend-color → background-blend-mode: color', () => {
    expect(applyClassName('bg-blend-color', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'color' },
    ]);
  });
  it('bg-blend-luminosity → background-blend-mode: luminosity', () => {
    expect(applyClassName('bg-blend-luminosity', ctx)).toEqual([
      { type: 'decl', prop: 'background-blend-mode', value: 'luminosity' },
    ]);
  });
});

describe('mask-clip ', () => {
  it('mask-clip-border → mask-clip: border-box', () => {
    expect(applyClassName('mask-clip-border', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'border-box' },
    ]);
  });
  it('mask-clip-padding → mask-clip: padding-box', () => {
    expect(applyClassName('mask-clip-padding', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'padding-box' },
    ]);
  });
  it('mask-clip-content → mask-clip: content-box', () => {
    expect(applyClassName('mask-clip-content', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'content-box' },
    ]);
  });
  it('mask-clip-fill → mask-clip: fill-box', () => {
    expect(applyClassName('mask-clip-fill', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'fill-box' },
    ]);
  });
  it('mask-clip-stroke → mask-clip: stroke-box', () => {
    expect(applyClassName('mask-clip-stroke', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'stroke-box' },
    ]);
  });
  it('mask-clip-view → mask-clip: view-box', () => {
    expect(applyClassName('mask-clip-view', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'view-box' },
    ]);
  });
  it('mask-no-clip → mask-clip: no-clip', () => {
    expect(applyClassName('mask-no-clip', ctx)).toEqual([
      { type: 'decl', prop: 'mask-clip', value: 'no-clip' },
    ]);
  });
});

describe('mask-composite ', () => {
  it('mask-add → mask-composite: add', () => {
    expect(applyClassName('mask-add', ctx)).toEqual([
      { type: 'decl', prop: 'mask-composite', value: 'add' },
    ]);
  });
  it('mask-subtract → mask-composite: subtract', () => {
    expect(applyClassName('mask-subtract', ctx)).toEqual([
      { type: 'decl', prop: 'mask-composite', value: 'subtract' },
    ]);
  });
  it('mask-intersect → mask-composite: intersect', () => {
    expect(applyClassName('mask-intersect', ctx)).toEqual([
      { type: 'decl', prop: 'mask-composite', value: 'intersect' },
    ]);
  });
  it('mask-exclude → mask-composite: exclude', () => {
    expect(applyClassName('mask-exclude', ctx)).toEqual([
      { type: 'decl', prop: 'mask-composite', value: 'exclude' },
    ]);
  });
});

describe('mask-image ', () => {
  it('mask-[url(/img/circle.png)] → mask-image: url(/img/circle.png)', () => {
    expect(applyClassName('mask-[url(/img/circle.png)]', ctx)).toEqual([
      { type: 'decl', prop: 'mask-image', value: 'url(/img/circle.png)' },
    ]);
  });
  it('mask-(--my-mask) → mask-image: var(--my-mask)', () => {
    expect(applyClassName('mask-(--my-mask)', ctx)).toEqual([
      { type: 'decl', prop: 'mask-image', value: 'var(--my-mask)' },
    ]);
  });
  it('mask-none → mask-image: none', () => {
    expect(applyClassName('mask-none', ctx)).toEqual([
      { type: 'decl', prop: 'mask-image', value: 'none' },
    ]);
  });
});

describe('mask-mode ', () => {
  it('mask-alpha → mask-mode: alpha', () => {
    expect(applyClassName('mask-alpha', ctx)).toEqual([
      { type: 'decl', prop: 'mask-mode', value: 'alpha' },
    ]);
  });
  it('mask-luminance → mask-mode: luminance', () => {
    expect(applyClassName('mask-luminance', ctx)).toEqual([
      { type: 'decl', prop: 'mask-mode', value: 'luminance' },
    ]);
  });
  it('mask-match → mask-mode: match-source', () => {
    expect(applyClassName('mask-match', ctx)).toEqual([
      { type: 'decl', prop: 'mask-mode', value: 'match-source' },
    ]);
  });
});

describe('mask-origin ', () => {
  it('mask-origin-border → mask-origin: border-box', () => {
    expect(applyClassName('mask-origin-border', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'border-box' },
    ]);
  });
  it('mask-origin-padding → mask-origin: padding-box', () => {
    expect(applyClassName('mask-origin-padding', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'padding-box' },
    ]);
  });
  it('mask-origin-content → mask-origin: content-box', () => {
    expect(applyClassName('mask-origin-content', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'content-box' },
    ]);
  });
  it('mask-origin-fill → mask-origin: fill-box', () => {
    expect(applyClassName('mask-origin-fill', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'fill-box' },
    ]);
  });
  it('mask-origin-stroke → mask-origin: stroke-box', () => {
    expect(applyClassName('mask-origin-stroke', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'stroke-box' },
    ]);
  });
  it('mask-origin-view → mask-origin: view-box', () => {
    expect(applyClassName('mask-origin-view', ctx)).toEqual([
      { type: 'decl', prop: 'mask-origin', value: 'view-box' },
    ]);
  });
});
