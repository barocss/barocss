import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({
  theme: {
    colors: {
      inherit: "inherit",
      current: "currentColor",
      transparent: "transparent",
      black: "#000",
      white: "#fff",
      blue: { 500: "#0000ff" },
    },
  },
});

describe("fill", () => {
  it("fill-inherit → fill: inherit", () => {
    expect(parseClassToAst("fill-inherit", ctx)).toEqual([
      { type: "decl", prop: "fill", value: "inherit" },
    ]);
  });
  it("fill-current → fill: currentColor", () => {
    expect(parseClassToAst("fill-current", ctx)).toEqual([
      { type: "decl", prop: "fill", value: "currentColor" },
    ]);
  });
  it("fill-transparent → fill: transparent", () => {
    expect(parseClassToAst("fill-transparent", ctx)).toEqual([
      { type: "decl", prop: "fill", value: "transparent" },
    ]);
  });
  it("fill-black → fill: #000", () => {
    expect(parseClassToAst("fill-black", ctx)).toEqual([
      { type: "decl", prop: "fill", value: "#000" },
    ]);
  });
  it("fill-white → fill: #fff", () => {
    expect(parseClassToAst("fill-white", ctx)).toEqual([
      { type: "decl", prop: "fill", value: "#fff" },
    ]);
  });
  it("fill-blue-500 → fill: var(--color-blue-500)", () => {
    expect(parseClassToAst("fill-blue-500", ctx)).toEqual([
      { type: "decl", prop: "fill", value: "var(--color-blue-500)" },
    ]);
  });
  it("fill-[rebeccapurple] → fill: rebeccapurple", () => {
    expect(parseClassToAst("fill-[rebeccapurple]", ctx)).toEqual([
      { type: "decl", prop: "fill", value: "rebeccapurple" },
    ]);
  });
  it("fill-(--my-fill) → fill: var(--my-fill)", () => {
    expect(parseClassToAst("fill-(--my-fill)", ctx)).toEqual([
      { type: "decl", prop: "fill", value: "var(--my-fill)" },
    ]);
  });
});

describe("stroke", () => {
  it("stroke-inherit → stroke: inherit", () => {
    expect(parseClassToAst("stroke-inherit", ctx)).toEqual([
      { type: "decl", prop: "stroke", value: "inherit" },
    ]);
  });
  it("stroke-current → stroke: currentColor", () => {
    expect(parseClassToAst("stroke-current", ctx)).toEqual([
      { type: "decl", prop: "stroke", value: "currentColor" },
    ]);
  });
  it("stroke-transparent → stroke: transparent", () => {
    expect(parseClassToAst("stroke-transparent", ctx)).toEqual([
      { type: "decl", prop: "stroke", value: "transparent" },
    ]);
  });
  it("stroke-black → stroke: #000", () => {
    expect(parseClassToAst("stroke-black", ctx)).toEqual([
      { type: "decl", prop: "stroke", value: "#000" },
    ]);
  });
  it("stroke-white → stroke: #fff", () => {
    expect(parseClassToAst("stroke-white", ctx)).toEqual([
      { type: "decl", prop: "stroke", value: "#fff" },
    ]);
  });
  it("stroke-blue-500 → stroke: var(--color-blue-500)", () => {
    expect(parseClassToAst("stroke-blue-500", ctx)).toEqual([
      { type: "decl", prop: "stroke", value: "var(--color-blue-500)" },
    ]);
  });
  it("stroke-[rebeccapurple] → stroke: rebeccapurple", () => {
    expect(parseClassToAst("stroke-[rebeccapurple]", ctx)).toEqual([
      { type: "decl", prop: "stroke", value: "rebeccapurple" },
    ]);
  });
  it("stroke-(--my-stroke) → stroke: var(--my-stroke)", () => {
    expect(parseClassToAst("stroke-(--my-stroke)", ctx)).toEqual([
      { type: "decl", prop: "stroke", value: "var(--my-stroke)" },
    ]);
  });
});

describe("stroke-width", () => {
  it("stroke-0 → stroke-width: 0", () => {
    expect(parseClassToAst("stroke-0", ctx)).toEqual([
      { type: "decl", prop: "stroke-width", value: "0" },
    ]);
  });
  it("stroke-1 → stroke-width: 1", () => {
    expect(parseClassToAst("stroke-1", ctx)).toEqual([
      { type: "decl", prop: "stroke-width", value: "1" },
    ]);
  });
  it("stroke-2 → stroke-width: 2", () => {
    expect(parseClassToAst("stroke-2", ctx)).toEqual([
      { type: "decl", prop: "stroke-width", value: "2" },
    ]);
  });
  it("stroke-[5] → stroke-width: 5", () => {
    expect(parseClassToAst("stroke-[5]", ctx)).toEqual([
      { type: "decl", prop: "stroke-width", value: "5" },
    ]);
  });
  it("stroke-(length:--my-width) → stroke-width: var(--my-width)", () => {
    expect(parseClassToAst("stroke-(length:--my-width)", ctx)).toEqual([
      { type: "decl", prop: "stroke-width", value: "var(--my-width)" },
    ]);
  });
}); 