import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({});

describe("table utilities", () => {
  it("border-collapse → border-collapse: collapse", () => {
    expect(parseClassToAst("border-collapse", ctx)).toEqual([
      { type: "decl", prop: "border-collapse", value: "collapse" },
    ]);
  });
  it("border-separate → border-collapse: separate", () => {
    expect(parseClassToAst("border-separate", ctx)).toEqual([
      { type: "decl", prop: "border-collapse", value: "separate" },
    ]);
  });
});

// #314: each axis is a --baro-border-spacing-x/y var; border-spacing composes both (Tailwind 4.3.3).
const decls = (cls: string) =>
  (parseClassToAst(cls, ctx) as { type: string; prop?: string; value?: string }[])
    .filter((n) => n.type === "decl")
    .map((n) => [n.prop, n.value]);
const BS = ["border-spacing", "var(--baro-border-spacing-x) var(--baro-border-spacing-y)"];

describe("border-spacing", () => {
  ([
    ["border-spacing-0", ["x", "y"], "calc(var(--spacing) * 0)"],
    ["border-spacing-2", ["x", "y"], "calc(var(--spacing) * 2)"],
    ["border-spacing-px", ["x", "y"], "1px"],
    ["border-spacing-[5px]", ["x", "y"], "5px"],
    ["border-spacing-(--my-spacing)", ["x", "y"], "var(--my-spacing)"],
    ["border-spacing-x-4", ["x"], "calc(var(--spacing) * 4)"],
    ["border-spacing-x-[8px]", ["x"], "8px"],
    ["border-spacing-x-(--my-x)", ["x"], "var(--my-x)"],
    ["border-spacing-y-3", ["y"], "calc(var(--spacing) * 3)"],
    ["border-spacing-y-[12px]", ["y"], "12px"],
    ["border-spacing-y-(--my-y)", ["y"], "var(--my-y)"],
  ] as [string, string[], string][]).forEach(([cls, axes, v]) => {
    it(`${cls} → ${axes.map((a) => `--baro-border-spacing-${a}`).join(", ")}: ${v}`, () => {
      expect(decls(cls)).toEqual([...axes.map((a) => [`--baro-border-spacing-${a}`, v]), BS]);
    });
  });
});

describe("table-layout", () => {
  it("table-auto → table-layout: auto", () => {
    expect(parseClassToAst("table-auto", ctx)).toEqual([
      { type: "decl", prop: "table-layout", value: "auto" },
    ]);
  });
  it("table-fixed → table-layout: fixed", () => {
    expect(parseClassToAst("table-fixed", ctx)).toEqual([
      { type: "decl", prop: "table-layout", value: "fixed" },
    ]);
  });
});

describe("caption-side", () => {
  it("caption-top → caption-side: top", () => {
    expect(parseClassToAst("caption-top", ctx)).toEqual([
      { type: "decl", prop: "caption-side", value: "top" },
    ]);
  });
  it("caption-bottom → caption-side: bottom", () => {
    expect(parseClassToAst("caption-bottom", ctx)).toEqual([
      { type: "decl", prop: "caption-side", value: "bottom" },
    ]);
  });
}); 