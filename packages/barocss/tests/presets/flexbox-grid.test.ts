import { describe, it, expect } from "vitest";
import "../../src/index"; // Ensure all utilities are registered
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

// --- New preset utility structure its ---
describe("preset flexbox-grid utilities", () => {
  const ctx = createContext({
    theme: {
      colors: { red: { 500: "#f00" }, blue: { 500: "#00f" } },
      "--z-index": { "10": "10", "20": "20" },
      "--order": { "1": "1", "2": "2" },
      "--grid-column": { "2": "2", "3": "3" },
      "--grid-column-start": { "1": "1" },
      "--grid-column-end": { "2": "2" },
    },
  });

  it("flex-basis: all utilities", () => {
    expect(parseClassToAst("basis-full", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "100%" },
    ]);
    expect(parseClassToAst("basis-auto", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "auto" },
    ]);
    expect(parseClassToAst("basis-3xs", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-3xs)" },
    ]);
    expect(parseClassToAst("basis-2xs", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-2xs)" },
    ]);
    expect(parseClassToAst("basis-xs", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-xs)" },
    ]);
    expect(parseClassToAst("basis-sm", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-sm)" },
    ]);
    expect(parseClassToAst("basis-md", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-md)" },
    ]);
    expect(parseClassToAst("basis-lg", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-lg)" },
    ]);
    expect(parseClassToAst("basis-xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-xl)" },
    ]);
    expect(parseClassToAst("basis-2xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-2xl)" },
    ]);
    expect(parseClassToAst("basis-3xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-3xl)" },
    ]);
    expect(parseClassToAst("basis-4xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-4xl)" },
    ]);
    expect(parseClassToAst("basis-5xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-5xl)" },
    ]);
    expect(parseClassToAst("basis-6xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-6xl)" },
    ]);
    expect(parseClassToAst("basis-7xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-7xl)" },
    ]);
    expect(parseClassToAst("basis-1/2", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "50%" },
    ]);
    expect(parseClassToAst("basis-1/3", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "33.33333333333333%" },
    ]);
    expect(parseClassToAst("basis-10", ctx)).toEqual([
      {
        type: "decl",
        prop: "flex-basis",
        value: "calc(var(--container-10) * 1px)",
      },
    ]);
    expect(parseClassToAst("basis-20", ctx)).toEqual([
      {
        type: "decl",
        prop: "flex-basis",
        value: "calc(var(--container-20) * 1px)",
      },
    ]);
  });

  it("flex-direction: all utilities", () => {
    expect(parseClassToAst("flex-row", ctx)).toEqual([
      { type: "decl", prop: "flex-direction", value: "row" },
    ]);
    expect(parseClassToAst("flex-row-reverse", ctx)).toEqual([
      { type: "decl", prop: "flex-direction", value: "row-reverse" },
    ]);
    expect(parseClassToAst("flex-col", ctx)).toEqual([
      { type: "decl", prop: "flex-direction", value: "column" },
    ]);
    expect(parseClassToAst("flex-col-reverse", ctx)).toEqual([
      { type: "decl", prop: "flex-direction", value: "column-reverse" },
    ]);
  });

  it("flex-wrap: all utilities", () => {
    expect(parseClassToAst("flex-wrap", ctx)).toEqual([
      { type: "decl", prop: "flex-wrap", value: "wrap" },
    ]);
    expect(parseClassToAst("flex-wrap-reverse", ctx)).toEqual([
      { type: "decl", prop: "flex-wrap", value: "wrap-reverse" },
    ]);
    expect(parseClassToAst("flex-nowrap", ctx)).toEqual([
      { type: "decl", prop: "flex-wrap", value: "nowrap" },
    ]);
  });

  it("flex: static, number, fraction, arbitrary, custom property", () => {
    // static
    expect(parseClassToAst("flex-auto", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "1 1 auto" },
    ]);
    expect(parseClassToAst("flex-initial", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "0 1 auto" },
    ]);
    expect(parseClassToAst("flex-none", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "none" },
    ]);
    // number
    expect(parseClassToAst("flex-1", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "1" },
    ]);
    expect(parseClassToAst("flex-2", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "2" },
    ]);
    // fraction
    expect(parseClassToAst("flex-1/2", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "calc(50%)" },
    ]);
    // arbitrary
    expect(parseClassToAst("flex-[2_1_0%]", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "2 1 0%" },
    ]);
    // custom property
    expect(parseClassToAst("flex-(--my-flex)", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "var(--my-flex)" },
    ]);
  });

  it("flex-grow: static, number, arbitrary, custom property", () => {
    // static
    expect(parseClassToAst("grow", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "1" },
    ]);
    expect(parseClassToAst("grow-0", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "0" },
    ]);
    // number
    expect(parseClassToAst("grow-2", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "2" },
    ]);
    // arbitrary
    expect(parseClassToAst("grow-[2]", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "2" },
    ]);
    // custom property
    expect(parseClassToAst("grow-(--my-grow)", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "var(--my-grow)" },
    ]);
  });

  it("flex-shrink: static, number, arbitrary, custom property", () => {
    // static
    expect(parseClassToAst("shrink", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "1" },
    ]);
    expect(parseClassToAst("shrink-0", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "0" },
    ]);
    // number
    expect(parseClassToAst("shrink-2", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "2" },
    ]);
    // arbitrary
    expect(parseClassToAst("shrink-[2]", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "2" },
    ]);
    // custom property
    expect(parseClassToAst("shrink-(--my-shrink)", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "var(--my-shrink)" },
    ]);
  });

  it("order: static, number, negative, arbitrary, custom property", () => {
    // static
    expect(parseClassToAst("order-first", ctx)).toEqual([
      { type: "decl", prop: "order", value: "calc(-infinity)" },
    ]);
    expect(parseClassToAst("order-last", ctx)).toEqual([
      { type: "decl", prop: "order", value: "calc(infinity)" },
    ]);
    expect(parseClassToAst("order-none", ctx)).toEqual([
      { type: "decl", prop: "order", value: "0" },
    ]);
    // number
    expect(parseClassToAst("order-1", ctx)).toEqual([
      { type: "decl", prop: "order", value: "1" },
    ]);
    expect(parseClassToAst("order-2", ctx)).toEqual([
      { type: "decl", prop: "order", value: "2" },
    ]);
    // negative
    expect(parseClassToAst("-order-1", ctx)).toEqual([
      { type: "decl", prop: "order", value: "calc(1 * -1)" },
    ]);
    // arbitrary
    expect(parseClassToAst("order-[min(var(--total-items),10)]", ctx)).toEqual([
      { type: "decl", prop: "order", value: "min(var(--total-items),10)" },
    ]);
    // custom property
    expect(parseClassToAst("order-(--my-order)", ctx)).toEqual([
      { type: "decl", prop: "order", value: "var(--my-order)" },
    ]);
  });

  it("grid-template-columns: static, number, arbitrary, custom property", () => {
    // static
    expect(parseClassToAst("grid-cols-none", ctx)).toEqual([
      { type: "decl", prop: "grid-template-columns", value: "none" },
    ]);
    expect(parseClassToAst("grid-cols-subgrid", ctx)).toEqual([
      { type: "decl", prop: "grid-template-columns", value: "subgrid" },
    ]);
    // number
    expect(parseClassToAst("grid-cols-1", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-columns",
        value: "repeat(1, minmax(0, 1fr))",
      },
    ]);
    expect(parseClassToAst("grid-cols-3", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-columns",
        value: "repeat(3, minmax(0, 1fr))",
      },
    ]);
    // arbitrary
    expect(
      parseClassToAst("grid-cols-[200px_minmax(900px,_1fr)_100px]", ctx)
    ).toEqual([
      {
        type: "decl",
        prop: "grid-template-columns",
        value: "200px minmax(900px, 1fr) 100px",
      },
    ]);
    // custom property
    expect(parseClassToAst("grid-cols-(--my-grid-cols)", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-columns",
        value: "var(--my-grid-cols)",
      },
    ]);
  });

  it("grid-template-rows: static, number, arbitrary, custom property", () => {
    // static
    expect(parseClassToAst("grid-rows-none", ctx)).toEqual([
      { type: "decl", prop: "grid-template-rows", value: "none" },
    ]);
    expect(parseClassToAst("grid-rows-subgrid", ctx)).toEqual([
      { type: "decl", prop: "grid-template-rows", value: "subgrid" },
    ]);
    // number
    expect(parseClassToAst("grid-rows-1", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-rows",
        value: "repeat(1, minmax(0, 1fr))",
      },
    ]);
    expect(parseClassToAst("grid-rows-3", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-rows",
        value: "repeat(3, minmax(0, 1fr))",
      },
    ]);
    // arbitrary
    expect(
      parseClassToAst("grid-rows-[200px_minmax(900px,_1fr)_100px]", ctx)
    ).toEqual([
      {
        type: "decl",
        prop: "grid-template-rows",
        value: "200px minmax(900px, 1fr) 100px",
      },
    ]);
    // custom property
    expect(parseClassToAst("grid-rows-(--my-grid-rows)", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-rows",
        value: "var(--my-grid-rows)",
      },
    ]);
  });

  it("grid-row: row-span, row-start, row-end, row utilities", () => {
    // row-span
    expect(parseClassToAst("row-span-full", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "1 / -1" },
    ]);
    expect(parseClassToAst("row-span-2", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "span 2 / span 2" },
    ]);
    expect(parseClassToAst("row-span-[5]", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "span 5 / span 5" },
    ]);
    expect(parseClassToAst("row-span-(--my-span)", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-row",
        value: "span var(--my-span) / span var(--my-span)",
      },
    ]);
    // row-start
    expect(parseClassToAst("row-start-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "auto" },
    ]);
    expect(parseClassToAst("row-start-3", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "3" },
    ]);
    expect(parseClassToAst("-row-start-2", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "calc(2 * -1)" },
    ]);
    expect(parseClassToAst("row-start-(--my-start)", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "var(--my-start)" },
    ]);
    expect(parseClassToAst("row-start-[7]", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "7" },
    ]);
    // row-end
    expect(parseClassToAst("row-end-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "auto" },
    ]);
    expect(parseClassToAst("row-end-4", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "4" },
    ]);
    expect(parseClassToAst("-row-end-2", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "calc(2 * -1)" },
    ]);
    expect(parseClassToAst("row-end-(--my-end)", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "var(--my-end)" },
    ]);
    expect(parseClassToAst("row-end-[8]", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "8" },
    ]);
    // row
    expect(parseClassToAst("row-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "auto" },
    ]);
    expect(parseClassToAst("row-3", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "3" },
    ]);
    expect(parseClassToAst("-row-2", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "calc(2 * -1)" },
    ]);
    expect(parseClassToAst("row-(--my-row)", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "var(--my-row)" },
    ]);
    expect(parseClassToAst("row-[5]", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "5" },
    ]);
  });

  it("grid-auto-flow: static utilities", () => {
    expect(parseClassToAst("grid-flow-row", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "row" },
    ]);
    expect(parseClassToAst("grid-flow-col", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "column" },
    ]);
    expect(parseClassToAst("grid-flow-dense", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "dense" },
    ]);
    expect(parseClassToAst("grid-flow-row-dense", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "row dense" },
    ]);
    expect(parseClassToAst("grid-flow-col-dense", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "column dense" },
    ]);
  });

  it("grid-auto-columns: static, arbitrary, custom property", () => {
    // static
    expect(parseClassToAst("auto-cols-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "auto" },
    ]);
    expect(parseClassToAst("auto-cols-min", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "min-content" },
    ]);
    expect(parseClassToAst("auto-cols-max", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "max-content" },
    ]);
    expect(parseClassToAst("auto-cols-fr", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "minmax(0, 1fr)" },
    ]);
    // arbitrary
    expect(parseClassToAst("auto-cols-[minmax(0,2fr)]", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "minmax(0,2fr)" },
    ]);
    // custom property
    expect(parseClassToAst("auto-cols-(--my-auto-cols)", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "var(--my-auto-cols)" },
    ]);
  });

  it("grid-auto-rows: static, arbitrary, custom property", () => {
    // static
    expect(parseClassToAst("auto-rows-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "auto" },
    ]);
    expect(parseClassToAst("auto-rows-min", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "min-content" },
    ]);
    expect(parseClassToAst("auto-rows-max", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "max-content" },
    ]);
    expect(parseClassToAst("auto-rows-fr", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "minmax(0, 1fr)" },
    ]);
    // arbitrary
    expect(parseClassToAst("auto-rows-[minmax(0,2fr)]", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "minmax(0,2fr)" },
    ]);
    // custom property
    expect(parseClassToAst("auto-rows-(--my-auto-rows)", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "var(--my-auto-rows)" },
    ]);
  });

  it("gap: number, arbitrary, custom property", () => {
    // number
    expect(parseClassToAst("gap-2", ctx)).toEqual([
      { type: "decl", prop: "gap", value: "calc(var(--spacing) * 2)" },
    ]);
    // arbitrary
    expect(parseClassToAst("gap-[10vw]", ctx)).toEqual([
      { type: "decl", prop: "gap", value: "10vw" },
    ]);
    // custom property
    expect(parseClassToAst("gap-(--my-gap)", ctx)).toEqual([
      { type: "decl", prop: "gap", value: "var(--my-gap)" },
    ]);
  });
  it("gap-x: number, arbitrary, custom property", () => {
    // number
    expect(parseClassToAst("gap-x-3", ctx)).toEqual([
      { type: "decl", prop: "column-gap", value: "calc(var(--spacing) * 3)" },
    ]);
    // arbitrary
    expect(parseClassToAst("gap-x-[5vw]", ctx)).toEqual([
      { type: "decl", prop: "column-gap", value: "5vw" },
    ]);
    // custom property
    expect(parseClassToAst("gap-x-(--my-gap-x)", ctx)).toEqual([
      { type: "decl", prop: "column-gap", value: "var(--my-gap-x)" },
    ]);
  });
  it("gap-y: number, arbitrary, custom property", () => {
    // number
    expect(parseClassToAst("gap-y-4", ctx)).toEqual([
      { type: "decl", prop: "row-gap", value: "calc(var(--spacing) * 4)" },
    ]);
    // arbitrary
    expect(parseClassToAst("gap-y-[2vw]", ctx)).toEqual([
      { type: "decl", prop: "row-gap", value: "2vw" },
    ]);
    // custom property
    expect(parseClassToAst("gap-y-(--my-gap-y)", ctx)).toEqual([
      { type: "decl", prop: "row-gap", value: "var(--my-gap-y)" },
    ]);
  });

  it("justify-content: static utilities", () => {
    expect(parseClassToAst("justify-start", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "flex-start" },
    ]);
    expect(parseClassToAst("justify-end", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "flex-end" },
    ]);
    expect(parseClassToAst("justify-end-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "safe flex-end" },
    ]);
    expect(parseClassToAst("justify-center", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "center" },
    ]);
    expect(parseClassToAst("justify-center-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "safe center" },
    ]);
    expect(parseClassToAst("justify-between", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "space-between" },
    ]);
    expect(parseClassToAst("justify-around", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "space-around" },
    ]);
    expect(parseClassToAst("justify-evenly", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "space-evenly" },
    ]);
    expect(parseClassToAst("justify-stretch", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "stretch" },
    ]);
    expect(parseClassToAst("justify-baseline", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "baseline" },
    ]);
    expect(parseClassToAst("justify-normal", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "normal" },
    ]);
  });

  it("justify-items: static utilities", () => {
    expect(parseClassToAst("justify-items-start", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "start" },
    ]);
    expect(parseClassToAst("justify-items-end", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "end" },
    ]);
    expect(parseClassToAst("justify-items-end-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "safe end" },
    ]);
    expect(parseClassToAst("justify-items-center", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "center" },
    ]);
    expect(parseClassToAst("justify-items-center-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "safe center" },
    ]);
    expect(parseClassToAst("justify-items-stretch", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "stretch" },
    ]);
    expect(parseClassToAst("justify-items-normal", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "normal" },
    ]);
  });

  it("justify-self: static utilities", () => {
    expect(parseClassToAst("justify-self-auto", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "auto" },
    ]);
    expect(parseClassToAst("justify-self-start", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "start" },
    ]);
    expect(parseClassToAst("justify-self-center", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "center" },
    ]);
    expect(parseClassToAst("justify-self-center-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "safe center" },
    ]);
    expect(parseClassToAst("justify-self-end", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "end" },
    ]);
    expect(parseClassToAst("justify-self-end-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "safe end" },
    ]);
    expect(parseClassToAst("justify-self-stretch", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "stretch" },
    ]);
  });

  it("align-content: static utilities", () => {
    expect(parseClassToAst("content-normal", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "normal" },
    ]);
    expect(parseClassToAst("content-center", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "center" },
    ]);
    expect(parseClassToAst("content-start", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "flex-start" },
    ]);
    expect(parseClassToAst("content-end", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "flex-end" },
    ]);
    expect(parseClassToAst("content-between", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "space-between" },
    ]);
    expect(parseClassToAst("content-around", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "space-around" },
    ]);
    expect(parseClassToAst("content-evenly", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "space-evenly" },
    ]);
    expect(parseClassToAst("content-baseline", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "baseline" },
    ]);
    expect(parseClassToAst("content-stretch", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "stretch" },
    ]);
  });

  it("align-items: static utilities", () => {
    expect(parseClassToAst("items-start", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "flex-start" },
    ]);
    expect(parseClassToAst("items-end", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "flex-end" },
    ]);
    expect(parseClassToAst("items-end-safe", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "safe flex-end" },
    ]);
    expect(parseClassToAst("items-center", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "center" },
    ]);
    expect(parseClassToAst("items-center-safe", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "safe center" },
    ]);
    expect(parseClassToAst("items-baseline", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "baseline" },
    ]);
    expect(parseClassToAst("items-baseline-last", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "last baseline" },
    ]);
    expect(parseClassToAst("items-stretch", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "stretch" },
    ]);
  });

  it("align-self: static utilities", () => {
    expect(parseClassToAst("self-auto", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "auto" },
    ]);
    expect(parseClassToAst("self-start", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "flex-start" },
    ]);
    expect(parseClassToAst("self-end", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "flex-end" },
    ]);
    expect(parseClassToAst("self-end-safe", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "safe flex-end" },
    ]);
    expect(parseClassToAst("self-center", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "center" },
    ]);
    expect(parseClassToAst("self-center-safe", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "safe center" },
    ]);
    expect(parseClassToAst("self-stretch", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "stretch" },
    ]);
    expect(parseClassToAst("self-baseline", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "baseline" },
    ]);
    expect(parseClassToAst("self-baseline-last", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "last baseline" },
    ]);
  });

  it("place-content: static utilities", () => {
    expect(parseClassToAst("place-content-center", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "center" },
    ]);
    expect(parseClassToAst("place-content-center-safe", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "safe center" },
    ]);
    expect(parseClassToAst("place-content-start", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "start" },
    ]);
    expect(parseClassToAst("place-content-end", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "end" },
    ]);
    expect(parseClassToAst("place-content-end-safe", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "safe end" },
    ]);
    expect(parseClassToAst("place-content-between", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "space-between" },
    ]);
    expect(parseClassToAst("place-content-around", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "space-around" },
    ]);
    expect(parseClassToAst("place-content-evenly", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "space-evenly" },
    ]);
    expect(parseClassToAst("place-content-baseline", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "baseline" },
    ]);
    expect(parseClassToAst("place-content-stretch", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "stretch" },
    ]);
  });

  it("place-items: static utilities", () => {
    expect(parseClassToAst("place-items-start", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "start" },
    ]);
    expect(parseClassToAst("place-items-end", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "end" },
    ]);
    expect(parseClassToAst("place-items-end-safe", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "safe end" },
    ]);
    expect(parseClassToAst("place-items-center", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "center" },
    ]);
    expect(parseClassToAst("place-items-center-safe", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "safe center" },
    ]);
    expect(parseClassToAst("place-items-baseline", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "baseline" },
    ]);
    expect(parseClassToAst("place-items-stretch", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "stretch" },
    ]);
  });

  it("place-self: static utilities", () => {
    expect(parseClassToAst("place-self-auto", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "auto" },
    ]);
    expect(parseClassToAst("place-self-start", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "start" },
    ]);
    expect(parseClassToAst("place-self-end", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "end" },
    ]);
    expect(parseClassToAst("place-self-end-safe", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "safe end" },
    ]);
    expect(parseClassToAst("place-self-center", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "center" },
    ]);
    expect(parseClassToAst("place-self-center-safe", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "safe center" },
    ]);
    expect(parseClassToAst("place-self-stretch", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "stretch" },
    ]);
  });

  it("grid-column: col-span, col-start, col-end, col utilities", () => {
    // col-span
    expect(parseClassToAst("col-span-full", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "1 / -1" },
    ]);
    expect(parseClassToAst("col-span-2", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "span 2 / span 2" },
    ]);
    expect(parseClassToAst("col-span-[5]", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "span 5 / span 5" },
    ]);
    expect(parseClassToAst("col-span-(--my-span)", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-column",
        value: "span var(--my-span) / span var(--my-span)",
      },
    ]);
    // col-start
    expect(parseClassToAst("col-start-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-column-start", value: "auto" },
    ]);
    expect(parseClassToAst("col-start-3", ctx)).toEqual([
      { type: "decl", prop: "grid-column-start", value: "3" },
    ]);
    expect(parseClassToAst("-col-start-2", ctx)).toEqual([
      { type: "decl", prop: "grid-column-start", value: "calc(2 * -1)" },
    ]);
    expect(parseClassToAst("col-start-(--my-start)", ctx)).toEqual([
      { type: "decl", prop: "grid-column-start", value: "var(--my-start)" },
    ]);
    // col-end
    expect(parseClassToAst("col-end-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-column-end", value: "auto" },
    ]);
    expect(parseClassToAst("col-end-4", ctx)).toEqual([
      { type: "decl", prop: "grid-column-end", value: "4" },
    ]);
    expect(parseClassToAst("-col-end-2", ctx)).toEqual([
      { type: "decl", prop: "grid-column-end", value: "calc(2 * -1)" },
    ]);
    expect(parseClassToAst("col-end-(--my-end)", ctx)).toEqual([
      { type: "decl", prop: "grid-column-end", value: "var(--my-end)" },
    ]);
    // col
    expect(parseClassToAst("col-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "auto" },
    ]);
    expect(parseClassToAst("col-3", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "3" },
    ]);
    expect(parseClassToAst("-col-2", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "calc(2 * -1)" },
    ]);
    expect(parseClassToAst("col-(--my-col)", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "var(--my-col)" },
    ]);
    expect(parseClassToAst("col-[3]", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "3" },
    ]);
  });
});
