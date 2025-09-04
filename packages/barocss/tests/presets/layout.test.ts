import { describe, it, expect } from "vitest";
import "../../src/index"; // Ensure all utilities are registered
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

// --- New preset utility structure its ---
describe("preset layout utilities", () => {
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

  // Aspect Ratio
  it("aspect-ratio: static utilities", () => {
    expect(parseClassToAst("aspect-square", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "1 / 1" },
    ]);
    expect(parseClassToAst("aspect-video", ctx)).toEqual([
      {
        type: "decl",
        prop: "aspect-ratio",
        value: "var(--aspect-ratio-video)",
      },
    ]);
    expect(parseClassToAst("aspect-auto", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "auto" },
    ]);
  });

  it("aspect-ratio: fraction, arbitrary, custom property", () => {
    // fraction value (check fraction)
    expect(parseClassToAst("aspect-16/9", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "16/9" },
    ]);
    expect(parseClassToAst("aspect-4/3", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "4/3" },
    ]);
    // arbitrary value (do not check fraction, strip brackets)
    expect(parseClassToAst("aspect-[4/3]", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "4/3" },
    ]);
    expect(parseClassToAst("aspect-[calc(16+9)/9]", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "calc(16+9)/9" },
    ]);
    // custom property
    expect(parseClassToAst("aspect-(--my-ratio)", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "var(--my-ratio)" },
    ]);
  });

  // Columns
  it("columns: static utilities", () => {
    expect(parseClassToAst("columns-auto", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "auto" },
    ]);
    expect(parseClassToAst("columns-sm", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--container-sm)" },
    ]);
    expect(parseClassToAst("columns-lg", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--container-lg)" },
    ]);
    expect(parseClassToAst("columns-xl", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--container-xl)" },
    ]);
    expect(parseClassToAst("columns-2xl", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--container-2xl)" },
    ]);
  });

  it("columns: dynamic utilities", () => {
    // arbitrary value
    expect(parseClassToAst("columns-[3]", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "3" },
    ]);
    expect(parseClassToAst("columns-[30vw]", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "30vw" },
    ]);
    // custom property
    expect(parseClassToAst("columns-(--my-columns)", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--my-columns)" },
    ]);
  });

  // Break After
  it("break-after: all static utilities", () => {
    expect(parseClassToAst("break-after-auto", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "auto" },
    ]);
    expect(parseClassToAst("break-after-avoid", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "avoid" },
    ]);
    expect(parseClassToAst("break-after-all", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "all" },
    ]);
    expect(parseClassToAst("break-after-avoid-page", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "avoid-page" },
    ]);
    expect(parseClassToAst("break-after-page", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "page" },
    ]);
    expect(parseClassToAst("break-after-left", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "left" },
    ]);
    expect(parseClassToAst("break-after-right", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "right" },
    ]);
    expect(parseClassToAst("break-after-column", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "column" },
    ]);
  });

  // Break Before
  it("break-before: all static utilities", () => {
    expect(parseClassToAst("break-before-auto", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "auto" },
    ]);
    expect(parseClassToAst("break-before-avoid", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "avoid" },
    ]);
    expect(parseClassToAst("break-before-all", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "all" },
    ]);
    expect(parseClassToAst("break-before-avoid-page", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "avoid-page" },
    ]);
    expect(parseClassToAst("break-before-page", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "page" },
    ]);
    expect(parseClassToAst("break-before-left", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "left" },
    ]);
    expect(parseClassToAst("break-before-right", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "right" },
    ]);
    expect(parseClassToAst("break-before-column", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "column" },
    ]);
  });

  // Break Inside
  it("break-inside: all static utilities", () => {
    expect(parseClassToAst("break-inside-auto", ctx)).toEqual([
      { type: "decl", prop: "break-inside", value: "auto" },
    ]);
    expect(parseClassToAst("break-inside-avoid", ctx)).toEqual([
      { type: "decl", prop: "break-inside", value: "avoid" },
    ]);
    expect(parseClassToAst("break-inside-avoid-page", ctx)).toEqual([
      { type: "decl", prop: "break-inside", value: "avoid-page" },
    ]);
    expect(parseClassToAst("break-inside-avoid-column", ctx)).toEqual([
      { type: "decl", prop: "break-inside", value: "avoid-column" },
    ]);
  });

  // Box Decoration Break
  it("box-decoration-break: static utilities", () => {
    expect(parseClassToAst("box-decoration-slice", ctx)).toEqual([
      { type: "decl", prop: "box-decoration-break", value: "slice" },
    ]);
    expect(parseClassToAst("box-decoration-clone", ctx)).toEqual([
      { type: "decl", prop: "box-decoration-break", value: "clone" },
    ]);
  });

  // Box Sizing
  it("box-sizing: static utilities", () => {
    expect(parseClassToAst("box-border", ctx)).toEqual([
      { type: "decl", prop: "box-sizing", value: "border-box" },
    ]);
    expect(parseClassToAst("box-content", ctx)).toEqual([
      { type: "decl", prop: "box-sizing", value: "content-box" },
    ]);
  });

  // Z-Index
  it("z-index: theme, arbitrary, negative", () => {
    expect(parseClassToAst("z-10", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "10" },
    ]);
    expect(parseClassToAst("z-[999]", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "999" },
    ]);
  });

  it("display: all  utilities", () => {
    expect(parseClassToAst("block", ctx)).toEqual([
      { type: "decl", prop: "display", value: "block" },
    ]);
    expect(parseClassToAst("inline", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline" },
    ]);
    expect(parseClassToAst("inline-block", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline-block" },
    ]);
    expect(parseClassToAst("flow-root", ctx)).toEqual([
      { type: "decl", prop: "display", value: "flow-root" },
    ]);
    expect(parseClassToAst("flex", ctx)).toEqual([
      { type: "decl", prop: "display", value: "flex" },
    ]);
    expect(parseClassToAst("inline-flex", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline-flex" },
    ]);
    expect(parseClassToAst("grid", ctx)).toEqual([
      { type: "decl", prop: "display", value: "grid" },
    ]);
    expect(parseClassToAst("inline-grid", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline-grid" },
    ]);
    expect(parseClassToAst("contents", ctx)).toEqual([
      { type: "decl", prop: "display", value: "contents" },
    ]);
    expect(parseClassToAst("table", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table" },
    ]);
    expect(parseClassToAst("inline-table", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline-table" },
    ]);
    expect(parseClassToAst("table-caption", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-caption" },
    ]);
    expect(parseClassToAst("table-cell", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-cell" },
    ]);
    expect(parseClassToAst("table-column", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-column" },
    ]);
    expect(parseClassToAst("table-column-group", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-column-group" },
    ]);
    expect(parseClassToAst("table-footer-group", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-footer-group" },
    ]);
    expect(parseClassToAst("table-header-group", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-header-group" },
    ]);
    expect(parseClassToAst("table-row-group", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-row-group" },
    ]);
    expect(parseClassToAst("table-row", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-row" },
    ]);
    expect(parseClassToAst("list-item", ctx)).toEqual([
      { type: "decl", prop: "display", value: "list-item" },
    ]);
    expect(parseClassToAst("hidden", ctx)).toEqual([
      { type: "decl", prop: "display", value: "none" },
    ]);
  });

  it("float: all  utilities", () => {
    expect(parseClassToAst("float-right", ctx)).toEqual([
      { type: "decl", prop: "float", value: "right" },
    ]);
    expect(parseClassToAst("float-left", ctx)).toEqual([
      { type: "decl", prop: "float", value: "left" },
    ]);
    expect(parseClassToAst("float-start", ctx)).toEqual([
      { type: "decl", prop: "float", value: "inline-start" },
    ]);
    expect(parseClassToAst("float-end", ctx)).toEqual([
      { type: "decl", prop: "float", value: "inline-end" },
    ]);
    expect(parseClassToAst("float-none", ctx)).toEqual([
      { type: "decl", prop: "float", value: "none" },
    ]);
  });

  it("clear: all  utilities", () => {
    expect(parseClassToAst("clear-left", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "left" },
    ]);
    expect(parseClassToAst("clear-right", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "right" },
    ]);
    expect(parseClassToAst("clear-both", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "both" },
    ]);
    expect(parseClassToAst("clear-start", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "inline-start" },
    ]);
    expect(parseClassToAst("clear-end", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "inline-end" },
    ]);
    expect(parseClassToAst("clear-none", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "none" },
    ]);
  });

  it("isolation: all utilities", () => {
    expect(parseClassToAst("isolate", ctx)).toEqual([
      { type: "decl", prop: "isolation", value: "isolate" },
    ]);
    expect(parseClassToAst("isolation-auto", ctx)).toEqual([
      { type: "decl", prop: "isolation", value: "auto" },
    ]);
  });

  it("object-fit: all utilities", () => {
    expect(parseClassToAst("object-contain", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "contain" },
    ]);
    expect(parseClassToAst("object-cover", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "cover" },
    ]);
    expect(parseClassToAst("object-fill", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "fill" },
    ]);
    expect(parseClassToAst("object-none", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "none" },
    ]);
    expect(parseClassToAst("object-scale-down", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "scale-down" },
    ]);
  });

  it("object-position: static utilities", () => {
    expect(parseClassToAst("object-top-left", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "top left" },
    ]);
    expect(parseClassToAst("object-top", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "top" },
    ]);
    expect(parseClassToAst("object-top-right", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "top right" },
    ]);
    expect(parseClassToAst("object-left", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "left" },
    ]);
    expect(parseClassToAst("object-center", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "center" },
    ]);
    expect(parseClassToAst("object-right", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "right" },
    ]);
    expect(parseClassToAst("object-bottom-left", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "bottom left" },
    ]);
    expect(parseClassToAst("object-bottom", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "bottom" },
    ]);
    expect(parseClassToAst("object-bottom-right", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "bottom right" },
    ]);
  });

  it("object-position: arbitrary, custom property", () => {
    expect(parseClassToAst("object-[25%_75%]", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "25% 75%" },
    ]);
    expect(parseClassToAst("object-(--my-position)", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "var(--my-position)" },
    ]);
  });

  it("overflow: all utilities", () => {
    expect(parseClassToAst("overflow-auto", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "auto" },
    ]);
    expect(parseClassToAst("overflow-hidden", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "hidden" },
    ]);
    expect(parseClassToAst("overflow-clip", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "clip" },
    ]);
    expect(parseClassToAst("overflow-visible", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "visible" },
    ]);
    expect(parseClassToAst("overflow-scroll", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "scroll" },
    ]);
    expect(parseClassToAst("overflow-x-auto", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "auto" },
    ]);
    expect(parseClassToAst("overflow-y-auto", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "auto" },
    ]);
    expect(parseClassToAst("overflow-x-hidden", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "hidden" },
    ]);
    expect(parseClassToAst("overflow-y-hidden", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "hidden" },
    ]);
    expect(parseClassToAst("overflow-x-clip", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "clip" },
    ]);
    expect(parseClassToAst("overflow-y-clip", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "clip" },
    ]);
    expect(parseClassToAst("overflow-x-visible", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "visible" },
    ]);
    expect(parseClassToAst("overflow-y-visible", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "visible" },
    ]);
    expect(parseClassToAst("overflow-x-scroll", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "scroll" },
    ]);
    expect(parseClassToAst("overflow-y-scroll", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "scroll" },
    ]);
  });

  it("overscroll-behavior: all utilities", () => {
    expect(parseClassToAst("overscroll-auto", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior", value: "auto" },
    ]);
    expect(parseClassToAst("overscroll-contain", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior", value: "contain" },
    ]);
    expect(parseClassToAst("overscroll-none", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior", value: "none" },
    ]);
    expect(parseClassToAst("overscroll-x-auto", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-x", value: "auto" },
    ]);
    expect(parseClassToAst("overscroll-x-contain", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-x", value: "contain" },
    ]);
    expect(parseClassToAst("overscroll-x-none", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-x", value: "none" },
    ]);
    expect(parseClassToAst("overscroll-y-auto", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-y", value: "auto" },
    ]);
    expect(parseClassToAst("overscroll-y-contain", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-y", value: "contain" },
    ]);
    expect(parseClassToAst("overscroll-y-none", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-y", value: "none" },
    ]);
  });

  it("position: all utilities", () => {
    expect(parseClassToAst("static", ctx)).toEqual([
      { type: "decl", prop: "position", value: "static" },
    ]);
    expect(parseClassToAst("fixed", ctx)).toEqual([
      { type: "decl", prop: "position", value: "fixed" },
    ]);
    expect(parseClassToAst("absolute", ctx)).toEqual([
      { type: "decl", prop: "position", value: "absolute" },
    ]);
    expect(parseClassToAst("relative", ctx)).toEqual([
      { type: "decl", prop: "position", value: "relative" },
    ]);
    expect(parseClassToAst("sticky", ctx)).toEqual([
      { type: "decl", prop: "position", value: "sticky" },
    ]);
  });

  it("inset/top/right/bottom/left: all utilities", () => {
    // Inset (all)
    expect(parseClassToAst("inset-0", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(parseClassToAst("inset-auto", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "auto" },
    ]);
    expect(parseClassToAst("inset-full", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "100%" },
    ]);
    expect(parseClassToAst("inset-px", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "1px" },
    ]);
    expect(parseClassToAst("-inset-1", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(parseClassToAst("inset-[2.5rem]", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "2.5rem" },
    ]);
    expect(parseClassToAst("inset-(--my-inset)", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "var(--my-inset)" },
    ]);
    // Inset X/Y
    expect(parseClassToAst("inset-x-0", ctx)).toEqual([
      { type: "decl", prop: "inset-inline", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(parseClassToAst("inset-x-auto", ctx)).toEqual([
      { type: "decl", prop: "inset-inline", value: "auto" },
    ]);
    expect(parseClassToAst("inset-x-full", ctx)).toEqual([
      { type: "decl", prop: "inset-inline", value: "100%" },
    ]);
    expect(parseClassToAst("-inset-x-px", ctx)).toEqual([
      { type: "decl", prop: "inset-inline", value: "-1px" },
    ]);
    // Inset Y
    expect(parseClassToAst("inset-y-0", ctx)).toEqual([
      { type: "decl", prop: "inset-block", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(parseClassToAst("inset-y-auto", ctx)).toEqual([
      { type: "decl", prop: "inset-block", value: "auto" },
    ]);
    expect(parseClassToAst("inset-y-full", ctx)).toEqual([
      { type: "decl", prop: "inset-block", value: "100%" },
    ]);
    expect(parseClassToAst("-inset-y-px", ctx)).toEqual([
      { type: "decl", prop: "inset-block", value: "-1px" },
    ]);
    // Top/Right/Bottom/Left
    expect(parseClassToAst("top-0", ctx)).toEqual([
      { type: "decl", prop: "top", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(parseClassToAst("top-auto", ctx)).toEqual([
      { type: "decl", prop: "top", value: "auto" },
    ]);
    expect(parseClassToAst("top-full", ctx)).toEqual([
      { type: "decl", prop: "top", value: "100%" },
    ]);
    expect(parseClassToAst("top-px", ctx)).toEqual([
      { type: "decl", prop: "top", value: "1px" },
    ]);
    expect(parseClassToAst("-top-1", ctx)).toEqual([
      { type: "decl", prop: "top", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(parseClassToAst("top-[10%]", ctx)).toEqual([
      { type: "decl", prop: "top", value: "10%" },
    ]);
    expect(parseClassToAst("top-(--my-top)", ctx)).toEqual([
      { type: "decl", prop: "top", value: "var(--my-top)" },
    ]);
    expect(parseClassToAst("right-0", ctx)).toEqual([
      { type: "decl", prop: "right", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(parseClassToAst("right-auto", ctx)).toEqual([
      { type: "decl", prop: "right", value: "auto" },
    ]);
    expect(parseClassToAst("right-full", ctx)).toEqual([
      { type: "decl", prop: "right", value: "100%" },
    ]);
    expect(parseClassToAst("right-px", ctx)).toEqual([
      { type: "decl", prop: "right", value: "1px" },
    ]);
    expect(parseClassToAst("-right-1", ctx)).toEqual([
      { type: "decl", prop: "right", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(parseClassToAst("right-[10%]", ctx)).toEqual([
      { type: "decl", prop: "right", value: "10%" },
    ]);
    expect(parseClassToAst("right-(--my-right)", ctx)).toEqual([
      { type: "decl", prop: "right", value: "var(--my-right)" },
    ]);
    expect(parseClassToAst("bottom-0", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(parseClassToAst("bottom-auto", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "auto" },
    ]);
    expect(parseClassToAst("bottom-full", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "100%" },
    ]);
    expect(parseClassToAst("bottom-px", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "1px" },
    ]);
    expect(parseClassToAst("-bottom-1", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(parseClassToAst("bottom-[10%]", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "10%" },
    ]);
    expect(parseClassToAst("bottom-(--my-bottom)", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "var(--my-bottom)" },
    ]);
    expect(parseClassToAst("left-0", ctx)).toEqual([
      { type: "decl", prop: "left", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(parseClassToAst("left-auto", ctx)).toEqual([
      { type: "decl", prop: "left", value: "auto" },
    ]);
    expect(parseClassToAst("left-full", ctx)).toEqual([
      { type: "decl", prop: "left", value: "100%" },
    ]);
    expect(parseClassToAst("left-px", ctx)).toEqual([
      { type: "decl", prop: "left", value: "1px" },
    ]);
    expect(parseClassToAst("-left-1", ctx)).toEqual([
      { type: "decl", prop: "left", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(parseClassToAst("left-[10%]", ctx)).toEqual([
      { type: "decl", prop: "left", value: "10%" },
    ]);
    expect(parseClassToAst("left-(--my-left)", ctx)).toEqual([
      { type: "decl", prop: "left", value: "var(--my-left)" },
    ]);
  });

  it("visibility: all utilities", () => {
    expect(parseClassToAst("visible", ctx)).toEqual([
      { type: "decl", prop: "visibility", value: "visible" },
    ]);
    expect(parseClassToAst("invisible", ctx)).toEqual([
      { type: "decl", prop: "visibility", value: "hidden" },
    ]);
    expect(parseClassToAst("collapse", ctx)).toEqual([
      { type: "decl", prop: "visibility", value: "collapse" },
    ]);
  });

  it("z-index: all utilities", () => {
    expect(parseClassToAst("z-auto", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "auto" },
    ]);
    expect(parseClassToAst("z-0", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "0" },
    ]);
    expect(parseClassToAst("z-1", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "1" },
    ]);
    expect(parseClassToAst("z-2", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "2" },
    ]);
    expect(parseClassToAst("z-3", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "3" },
    ]);
    expect(parseClassToAst("z-4", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "4" },
    ]);
    expect(parseClassToAst("z-5", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "5" },
    ]);
  });
});
