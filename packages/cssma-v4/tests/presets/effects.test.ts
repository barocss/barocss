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
