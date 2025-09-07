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

describe("border-spacing", () => {
  it("border-spacing-0 → border-spacing: calc(var(--spacing) * 0)", () => {
    expect(parseClassToAst("border-spacing-0", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "calc(var(--spacing) * 0)" },
    ]);
  });
  it("border-spacing-2 → border-spacing: calc(var(--spacing) * 2)", () => {
    expect(parseClassToAst("border-spacing-2", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "calc(var(--spacing) * 2)" },
    ]);
  });
  it("border-spacing-[5px] → border-spacing: 5px", () => {
    expect(parseClassToAst("border-spacing-[5px]", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "5px" },
    ]);
  });
  it("border-spacing-(--my-spacing) → border-spacing: var(--my-spacing)", () => {
    expect(parseClassToAst("border-spacing-(--my-spacing)", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "var(--my-spacing)" },
    ]);
  });
});

describe("border-spacing-x", () => {
  it("border-spacing-x-4 → border-spacing: calc(var(--spacing) * 4) var(--baro-border-spacing-y)", () => {
    expect(parseClassToAst("border-spacing-x-4", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "calc(var(--spacing) * 4) var(--baro-border-spacing-y)" },
    ]);
  });
  it("border-spacing-x-[8px] → border-spacing: 8px var(--baro-border-spacing-y)", () => {
    expect(parseClassToAst("border-spacing-x-[8px]", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "8px var(--baro-border-spacing-y)" },
    ]);
  });
  it("border-spacing-x-(--my-x) → border-spacing: var(--my-x) var(--baro-border-spacing-y)", () => {
    expect(parseClassToAst("border-spacing-x-(--my-x)", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "var(--my-x) var(--baro-border-spacing-y)" },
    ]);
  });
});

describe("border-spacing-y", () => {
  it("border-spacing-y-3 → border-spacing: var(--baro-border-spacing-x) calc(var(--spacing) * 3)", () => {
    expect(parseClassToAst("border-spacing-y-3", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "var(--baro-border-spacing-x) calc(var(--spacing) * 3)" },
    ]);
  });
  it("border-spacing-y-[12px] → border-spacing: var(--baro-border-spacing-x) 12px", () => {
    expect(parseClassToAst("border-spacing-y-[12px]", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "var(--baro-border-spacing-x) 12px" },
    ]);
  });
  it("border-spacing-y-(--my-y) → border-spacing: var(--baro-border-spacing-x) var(--my-y)", () => {
    expect(parseClassToAst("border-spacing-y-(--my-y)", ctx)).toEqual([
      { type: "decl", prop: "border-spacing", value: "var(--baro-border-spacing-x) var(--my-y)" },
    ]);
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