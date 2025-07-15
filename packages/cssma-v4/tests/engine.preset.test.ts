import { describe, it, expect } from "vitest";
import "../src/index"; // Ensure all utilities are registered
import { applyClassName } from "../src/core/engine";
import { createContext } from "../src/core/context";

// --- New preset utility structure its ---
describe("preset utilities (staticUtility/functionalUtility)", () => {
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
    expect(applyClassName("aspect-square", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "1 / 1" },
    ]);
    expect(applyClassName("aspect-video", ctx)).toEqual([
      {
        type: "decl",
        prop: "aspect-ratio",
        value: "var(--aspect-ratio-video)",
      },
    ]);
    expect(applyClassName("aspect-auto", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "auto" },
    ]);
  });

  it("aspect-ratio: fraction, arbitrary, custom property", () => {
    // fraction value (fraction 검사)
    expect(applyClassName("aspect-16/9", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "16/9" },
    ]);
    expect(applyClassName("aspect-4/3", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "4/3" },
    ]);
    // arbitrary value (fraction 검사 안함, 대괄호 제거)
    expect(applyClassName("aspect-[4/3]", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "4/3" },
    ]);
    expect(applyClassName("aspect-[calc(16+9)/9]", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "calc(16+9)/9" },
    ]);
    // custom property
    expect(applyClassName("aspect-(--my-ratio)", ctx)).toEqual([
      { type: "decl", prop: "aspect-ratio", value: "var(--my-ratio)" },
    ]);
  });

  // Columns
  it("columns: static utilities", () => {
    expect(applyClassName("columns-auto", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "auto" },
    ]);
    expect(applyClassName("columns-sm", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--container-sm)" },
    ]);
    expect(applyClassName("columns-lg", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--container-lg)" },
    ]);
    expect(applyClassName("columns-xl", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--container-xl)" },
    ]);
    expect(applyClassName("columns-2xl", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--container-2xl)" },
    ]);
  });

  it("columns: dynamic utilities", () => {
    // arbitrary value
    expect(applyClassName("columns-[3]", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "3" },
    ]);
    expect(applyClassName("columns-[30vw]", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "30vw" },
    ]);
    // custom property
    expect(applyClassName("columns-(--my-columns)", ctx)).toEqual([
      { type: "decl", prop: "columns", value: "var(--my-columns)" },
    ]);
  });

  // Break After
  it("break-after: all static utilities", () => {
    expect(applyClassName("break-after-auto", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "auto" },
    ]);
    expect(applyClassName("break-after-avoid", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "avoid" },
    ]);
    expect(applyClassName("break-after-all", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "all" },
    ]);
    expect(applyClassName("break-after-avoid-page", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "avoid-page" },
    ]);
    expect(applyClassName("break-after-page", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "page" },
    ]);
    expect(applyClassName("break-after-left", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "left" },
    ]);
    expect(applyClassName("break-after-right", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "right" },
    ]);
    expect(applyClassName("break-after-column", ctx)).toEqual([
      { type: "decl", prop: "break-after", value: "column" },
    ]);
  });

  // Break Before
  it("break-before: all static utilities", () => {
    expect(applyClassName("break-before-auto", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "auto" },
    ]);
    expect(applyClassName("break-before-avoid", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "avoid" },
    ]);
    expect(applyClassName("break-before-all", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "all" },
    ]);
    expect(applyClassName("break-before-avoid-page", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "avoid-page" },
    ]);
    expect(applyClassName("break-before-page", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "page" },
    ]);
    expect(applyClassName("break-before-left", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "left" },
    ]);
    expect(applyClassName("break-before-right", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "right" },
    ]);
    expect(applyClassName("break-before-column", ctx)).toEqual([
      { type: "decl", prop: "break-before", value: "column" },
    ]);
  });

  // Break Inside
  it("break-inside: all static utilities", () => {
    expect(applyClassName("break-inside-auto", ctx)).toEqual([
      { type: "decl", prop: "break-inside", value: "auto" },
    ]);
    expect(applyClassName("break-inside-avoid", ctx)).toEqual([
      { type: "decl", prop: "break-inside", value: "avoid" },
    ]);
    expect(applyClassName("break-inside-avoid-page", ctx)).toEqual([
      { type: "decl", prop: "break-inside", value: "avoid-page" },
    ]);
    expect(applyClassName("break-inside-avoid-column", ctx)).toEqual([
      { type: "decl", prop: "break-inside", value: "avoid-column" },
    ]);
  });

  // Box Decoration Break
  it("box-decoration-break: static utilities", () => {
    expect(applyClassName("box-decoration-slice", ctx)).toEqual([
      { type: "decl", prop: "box-decoration-break", value: "slice" },
    ]);
    expect(applyClassName("box-decoration-clone", ctx)).toEqual([
      { type: "decl", prop: "box-decoration-break", value: "clone" },
    ]);
  });

  // Box Sizing
  it("box-sizing: static utilities", () => {
    expect(applyClassName("box-border", ctx)).toEqual([
      { type: "decl", prop: "box-sizing", value: "border-box" },
    ]);
    expect(applyClassName("box-content", ctx)).toEqual([
      { type: "decl", prop: "box-sizing", value: "content-box" },
    ]);
  });

  // Z-Index
  it("z-index: theme, arbitrary, negative", () => {
    expect(applyClassName("z-10", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "10" },
    ]);
    expect(applyClassName("z-[999]", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "999" },
    ]);
  });

  it("display: all  utilities", () => {
    expect(applyClassName("block", ctx)).toEqual([
      { type: "decl", prop: "display", value: "block" },
    ]);
    expect(applyClassName("inline", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline" },
    ]);
    expect(applyClassName("inline-block", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline-block" },
    ]);
    expect(applyClassName("flow-root", ctx)).toEqual([
      { type: "decl", prop: "display", value: "flow-root" },
    ]);
    expect(applyClassName("flex", ctx)).toEqual([
      { type: "decl", prop: "display", value: "flex" },
    ]);
    expect(applyClassName("inline-flex", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline-flex" },
    ]);
    expect(applyClassName("grid", ctx)).toEqual([
      { type: "decl", prop: "display", value: "grid" },
    ]);
    expect(applyClassName("inline-grid", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline-grid" },
    ]);
    expect(applyClassName("contents", ctx)).toEqual([
      { type: "decl", prop: "display", value: "contents" },
    ]);
    expect(applyClassName("table", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table" },
    ]);
    expect(applyClassName("inline-table", ctx)).toEqual([
      { type: "decl", prop: "display", value: "inline-table" },
    ]);
    expect(applyClassName("table-caption", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-caption" },
    ]);
    expect(applyClassName("table-cell", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-cell" },
    ]);
    expect(applyClassName("table-column", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-column" },
    ]);
    expect(applyClassName("table-column-group", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-column-group" },
    ]);
    expect(applyClassName("table-footer-group", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-footer-group" },
    ]);
    expect(applyClassName("table-header-group", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-header-group" },
    ]);
    expect(applyClassName("table-row-group", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-row-group" },
    ]);
    expect(applyClassName("table-row", ctx)).toEqual([
      { type: "decl", prop: "display", value: "table-row" },
    ]);
    expect(applyClassName("list-item", ctx)).toEqual([
      { type: "decl", prop: "display", value: "list-item" },
    ]);
    expect(applyClassName("hidden", ctx)).toEqual([
      { type: "decl", prop: "display", value: "none" },
    ]);
  });

  it("float: all  utilities", () => {
    expect(applyClassName("float-right", ctx)).toEqual([
      { type: "decl", prop: "float", value: "right" },
    ]);
    expect(applyClassName("float-left", ctx)).toEqual([
      { type: "decl", prop: "float", value: "left" },
    ]);
    expect(applyClassName("float-start", ctx)).toEqual([
      { type: "decl", prop: "float", value: "inline-start" },
    ]);
    expect(applyClassName("float-end", ctx)).toEqual([
      { type: "decl", prop: "float", value: "inline-end" },
    ]);
    expect(applyClassName("float-none", ctx)).toEqual([
      { type: "decl", prop: "float", value: "none" },
    ]);
  });

  it("clear: all  utilities", () => {
    expect(applyClassName("clear-left", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "left" },
    ]);
    expect(applyClassName("clear-right", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "right" },
    ]);
    expect(applyClassName("clear-both", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "both" },
    ]);
    expect(applyClassName("clear-start", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "inline-start" },
    ]);
    expect(applyClassName("clear-end", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "inline-end" },
    ]);
    expect(applyClassName("clear-none", ctx)).toEqual([
      { type: "decl", prop: "clear", value: "none" },
    ]);
  });

  it("isolation: all utilities", () => {
    expect(applyClassName("isolate", ctx)).toEqual([
      { type: "decl", prop: "isolation", value: "isolate" },
    ]);
    expect(applyClassName("isolation-auto", ctx)).toEqual([
      { type: "decl", prop: "isolation", value: "auto" },
    ]);
  });

  it("object-fit: all utilities", () => {
    expect(applyClassName("object-contain", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "contain" },
    ]);
    expect(applyClassName("object-cover", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "cover" },
    ]);
    expect(applyClassName("object-fill", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "fill" },
    ]);
    expect(applyClassName("object-none", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "none" },
    ]);
    expect(applyClassName("object-scale-down", ctx)).toEqual([
      { type: "decl", prop: "object-fit", value: "scale-down" },
    ]);
  });

  it("object-position: static utilities", () => {
    expect(applyClassName("object-top-left", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "top left" },
    ]);
    expect(applyClassName("object-top", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "top" },
    ]);
    expect(applyClassName("object-top-right", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "top right" },
    ]);
    expect(applyClassName("object-left", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "left" },
    ]);
    expect(applyClassName("object-center", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "center" },
    ]);
    expect(applyClassName("object-right", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "right" },
    ]);
    expect(applyClassName("object-bottom-left", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "bottom left" },
    ]);
    expect(applyClassName("object-bottom", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "bottom" },
    ]);
    expect(applyClassName("object-bottom-right", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "bottom right" },
    ]);
  });

  it("object-position: arbitrary, custom property", () => {
    expect(applyClassName("object-[25%_75%]", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "25% 75%" },
    ]);
    expect(applyClassName("object-(--my-position)", ctx)).toEqual([
      { type: "decl", prop: "object-position", value: "var(--my-position)" },
    ]);
  });

  it("overflow: all utilities", () => {
    expect(applyClassName("overflow-auto", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "auto" },
    ]);
    expect(applyClassName("overflow-hidden", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "hidden" },
    ]);
    expect(applyClassName("overflow-clip", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "clip" },
    ]);
    expect(applyClassName("overflow-visible", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "visible" },
    ]);
    expect(applyClassName("overflow-scroll", ctx)).toEqual([
      { type: "decl", prop: "overflow", value: "scroll" },
    ]);
    expect(applyClassName("overflow-x-auto", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "auto" },
    ]);
    expect(applyClassName("overflow-y-auto", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "auto" },
    ]);
    expect(applyClassName("overflow-x-hidden", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "hidden" },
    ]);
    expect(applyClassName("overflow-y-hidden", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "hidden" },
    ]);
    expect(applyClassName("overflow-x-clip", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "clip" },
    ]);
    expect(applyClassName("overflow-y-clip", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "clip" },
    ]);
    expect(applyClassName("overflow-x-visible", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "visible" },
    ]);
    expect(applyClassName("overflow-y-visible", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "visible" },
    ]);
    expect(applyClassName("overflow-x-scroll", ctx)).toEqual([
      { type: "decl", prop: "overflow-x", value: "scroll" },
    ]);
    expect(applyClassName("overflow-y-scroll", ctx)).toEqual([
      { type: "decl", prop: "overflow-y", value: "scroll" },
    ]);
  });

  it("overscroll-behavior: all utilities", () => {
    expect(applyClassName("overscroll-auto", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior", value: "auto" },
    ]);
    expect(applyClassName("overscroll-contain", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior", value: "contain" },
    ]);
    expect(applyClassName("overscroll-none", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior", value: "none" },
    ]);
    expect(applyClassName("overscroll-x-auto", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-x", value: "auto" },
    ]);
    expect(applyClassName("overscroll-x-contain", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-x", value: "contain" },
    ]);
    expect(applyClassName("overscroll-x-none", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-x", value: "none" },
    ]);
    expect(applyClassName("overscroll-y-auto", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-y", value: "auto" },
    ]);
    expect(applyClassName("overscroll-y-contain", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-y", value: "contain" },
    ]);
    expect(applyClassName("overscroll-y-none", ctx)).toEqual([
      { type: "decl", prop: "overscroll-behavior-y", value: "none" },
    ]);
  });

  it("position: all utilities", () => {
    expect(applyClassName("static", ctx)).toEqual([
      { type: "decl", prop: "position", value: "static" },
    ]);
    expect(applyClassName("fixed", ctx)).toEqual([
      { type: "decl", prop: "position", value: "fixed" },
    ]);
    expect(applyClassName("absolute", ctx)).toEqual([
      { type: "decl", prop: "position", value: "absolute" },
    ]);
    expect(applyClassName("relative", ctx)).toEqual([
      { type: "decl", prop: "position", value: "relative" },
    ]);
    expect(applyClassName("sticky", ctx)).toEqual([
      { type: "decl", prop: "position", value: "sticky" },
    ]);
  });

  it("inset/top/right/bottom/left: all utilities", () => {
    // Inset (all)
    expect(applyClassName("inset-0", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(applyClassName("inset-auto", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "auto" },
    ]);
    expect(applyClassName("inset-full", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "100%" },
    ]);
    expect(applyClassName("inset-px", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "1px" },
    ]);
    expect(applyClassName("-inset-1", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(applyClassName("inset-[2.5rem]", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "2.5rem" },
    ]);
    expect(applyClassName("inset-(--my-inset)", ctx)).toEqual([
      { type: "decl", prop: "inset", value: "var(--my-inset)" },
    ]);
    // Inset X/Y
    expect(applyClassName("inset-x-0", ctx)).toEqual([
      { type: "decl", prop: "inset-inline", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(applyClassName("inset-x-auto", ctx)).toEqual([
      { type: "decl", prop: "inset-inline", value: "auto" },
    ]);
    expect(applyClassName("inset-x-full", ctx)).toEqual([
      { type: "decl", prop: "inset-inline", value: "100%" },
    ]);
    expect(applyClassName("-inset-x-px", ctx)).toEqual([
      { type: "decl", prop: "inset-inline", value: "-1px" },
    ]);
    // Inset Y
    expect(applyClassName("inset-y-0", ctx)).toEqual([
      { type: "decl", prop: "inset-block", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(applyClassName("inset-y-auto", ctx)).toEqual([
      { type: "decl", prop: "inset-block", value: "auto" },
    ]);
    expect(applyClassName("inset-y-full", ctx)).toEqual([
      { type: "decl", prop: "inset-block", value: "100%" },
    ]);
    expect(applyClassName("-inset-y-px", ctx)).toEqual([
      { type: "decl", prop: "inset-block", value: "-1px" },
    ]);
    // Top/Right/Bottom/Left
    expect(applyClassName("top-0", ctx)).toEqual([
      { type: "decl", prop: "top", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(applyClassName("top-auto", ctx)).toEqual([
      { type: "decl", prop: "top", value: "auto" },
    ]);
    expect(applyClassName("top-full", ctx)).toEqual([
      { type: "decl", prop: "top", value: "100%" },
    ]);
    expect(applyClassName("top-px", ctx)).toEqual([
      { type: "decl", prop: "top", value: "1px" },
    ]);
    expect(applyClassName("-top-1", ctx)).toEqual([
      { type: "decl", prop: "top", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(applyClassName("top-[10%]", ctx)).toEqual([
      { type: "decl", prop: "top", value: "10%" },
    ]);
    expect(applyClassName("top-(--my-top)", ctx)).toEqual([
      { type: "decl", prop: "top", value: "var(--my-top)" },
    ]);
    expect(applyClassName("right-0", ctx)).toEqual([
      { type: "decl", prop: "right", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(applyClassName("right-auto", ctx)).toEqual([
      { type: "decl", prop: "right", value: "auto" },
    ]);
    expect(applyClassName("right-full", ctx)).toEqual([
      { type: "decl", prop: "right", value: "100%" },
    ]);
    expect(applyClassName("right-px", ctx)).toEqual([
      { type: "decl", prop: "right", value: "1px" },
    ]);
    expect(applyClassName("-right-1", ctx)).toEqual([
      { type: "decl", prop: "right", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(applyClassName("right-[10%]", ctx)).toEqual([
      { type: "decl", prop: "right", value: "10%" },
    ]);
    expect(applyClassName("right-(--my-right)", ctx)).toEqual([
      { type: "decl", prop: "right", value: "var(--my-right)" },
    ]);
    expect(applyClassName("bottom-0", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(applyClassName("bottom-auto", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "auto" },
    ]);
    expect(applyClassName("bottom-full", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "100%" },
    ]);
    expect(applyClassName("bottom-px", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "1px" },
    ]);
    expect(applyClassName("-bottom-1", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(applyClassName("bottom-[10%]", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "10%" },
    ]);
    expect(applyClassName("bottom-(--my-bottom)", ctx)).toEqual([
      { type: "decl", prop: "bottom", value: "var(--my-bottom)" },
    ]);
    expect(applyClassName("left-0", ctx)).toEqual([
      { type: "decl", prop: "left", value: "calc(var(--spacing) * 0)" },
    ]);
    expect(applyClassName("left-auto", ctx)).toEqual([
      { type: "decl", prop: "left", value: "auto" },
    ]);
    expect(applyClassName("left-full", ctx)).toEqual([
      { type: "decl", prop: "left", value: "100%" },
    ]);
    expect(applyClassName("left-px", ctx)).toEqual([
      { type: "decl", prop: "left", value: "1px" },
    ]);
    expect(applyClassName("-left-1", ctx)).toEqual([
      { type: "decl", prop: "left", value: "calc(var(--spacing) * -1)" },
    ]);
    expect(applyClassName("left-[10%]", ctx)).toEqual([
      { type: "decl", prop: "left", value: "10%" },
    ]);
    expect(applyClassName("left-(--my-left)", ctx)).toEqual([
      { type: "decl", prop: "left", value: "var(--my-left)" },
    ]);
  });

  it("visibility: all utilities", () => {
    expect(applyClassName("visible", ctx)).toEqual([
      { type: "decl", prop: "visibility", value: "visible" },
    ]);
    expect(applyClassName("invisible", ctx)).toEqual([
      { type: "decl", prop: "visibility", value: "hidden" },
    ]);
    expect(applyClassName("collapse", ctx)).toEqual([
      { type: "decl", prop: "visibility", value: "collapse" },
    ]);
  });

  it("z-index: all utilities", () => {
    expect(applyClassName("z-auto", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "auto" },
    ]);
    expect(applyClassName("z-0", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "0" },
    ]);
    expect(applyClassName("z-1", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "1" },
    ]);
    expect(applyClassName("z-2", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "2" },
    ]);
    expect(applyClassName("z-3", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "3" },
    ]);
    expect(applyClassName("z-4", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "4" },
    ]);
    expect(applyClassName("z-5", ctx)).toEqual([
      { type: "decl", prop: "z-index", value: "5" },
    ]);
  });

  it("flex-basis: all utilities", () => {
    expect(applyClassName("basis-full", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "100%" },
    ]);
    expect(applyClassName("basis-auto", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "auto" },
    ]);
    expect(applyClassName("basis-3xs", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-3xs)" },
    ]);
    expect(applyClassName("basis-2xs", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-2xs)" },
    ]);
    expect(applyClassName("basis-xs", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-xs)" },
    ]);
    expect(applyClassName("basis-sm", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-sm)" },
    ]);
    expect(applyClassName("basis-md", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-md)" },
    ]);
    expect(applyClassName("basis-lg", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-lg)" },
    ]);
    expect(applyClassName("basis-xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-xl)" },
    ]);
    expect(applyClassName("basis-2xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-2xl)" },
    ]);
    expect(applyClassName("basis-3xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-3xl)" },
    ]);
    expect(applyClassName("basis-4xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-4xl)" },
    ]);
    expect(applyClassName("basis-5xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-5xl)" },
    ]);
    expect(applyClassName("basis-6xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-6xl)" },
    ]);
    expect(applyClassName("basis-7xl", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "var(--container-7xl)" },
    ]);
    expect(applyClassName("basis-1/2", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "50%" },
    ]);
    expect(applyClassName("basis-1/3", ctx)).toEqual([
      { type: "decl", prop: "flex-basis", value: "33.33333333333333%" },
    ]);
    expect(applyClassName("basis-10", ctx)).toEqual([
      {
        type: "decl",
        prop: "flex-basis",
        value: "calc(var(--container-10) * 1px)",
      },
    ]);
    expect(applyClassName("basis-20", ctx)).toEqual([
      {
        type: "decl",
        prop: "flex-basis",
        value: "calc(var(--container-20) * 1px)",
      },
    ]);
  });

  it("flex-direction: all utilities", () => {
    expect(applyClassName("flex-row", ctx)).toEqual([
      { type: "decl", prop: "flex-direction", value: "row" },
    ]);
    expect(applyClassName("flex-row-reverse", ctx)).toEqual([
      { type: "decl", prop: "flex-direction", value: "row-reverse" },
    ]);
    expect(applyClassName("flex-col", ctx)).toEqual([
      { type: "decl", prop: "flex-direction", value: "column" },
    ]);
    expect(applyClassName("flex-col-reverse", ctx)).toEqual([
      { type: "decl", prop: "flex-direction", value: "column-reverse" },
    ]);
  });

  it("flex-wrap: all utilities", () => {
    expect(applyClassName("flex-wrap", ctx)).toEqual([
      { type: "decl", prop: "flex-wrap", value: "wrap" },
    ]);
    expect(applyClassName("flex-wrap-reverse", ctx)).toEqual([
      { type: "decl", prop: "flex-wrap", value: "wrap-reverse" },
    ]);
    expect(applyClassName("flex-nowrap", ctx)).toEqual([
      { type: "decl", prop: "flex-wrap", value: "nowrap" },
    ]);
  });

  it("flex: static, number, fraction, arbitrary, custom property", () => {
    // static
    expect(applyClassName("flex-auto", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "1 1 auto" },
    ]);
    expect(applyClassName("flex-initial", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "0 1 auto" },
    ]);
    expect(applyClassName("flex-none", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "none" },
    ]);
    // number
    expect(applyClassName("flex-1", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "1" },
    ]);
    expect(applyClassName("flex-2", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "2" },
    ]);
    // fraction
    expect(applyClassName("flex-1/2", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "calc(50%)" },
    ]);
    // arbitrary
    expect(applyClassName("flex-[2_1_0%]", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "2 1 0%" },
    ]);
    // custom property
    expect(applyClassName("flex-(--my-flex)", ctx)).toEqual([
      { type: "decl", prop: "flex", value: "var(--my-flex)" },
    ]);
  });

  it("flex-grow: static, number, arbitrary, custom property", () => {
    // static
    expect(applyClassName("grow", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "1" },
    ]);
    expect(applyClassName("grow-0", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "0" },
    ]);
    // number
    expect(applyClassName("grow-2", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "2" },
    ]);
    // arbitrary
    expect(applyClassName("grow-[2]", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "2" },
    ]);
    // custom property
    expect(applyClassName("grow-(--my-grow)", ctx)).toEqual([
      { type: "decl", prop: "flex-grow", value: "var(--my-grow)" },
    ]);
  });

  it("flex-shrink: static, number, arbitrary, custom property", () => {
    // static
    expect(applyClassName("shrink", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "1" },
    ]);
    expect(applyClassName("shrink-0", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "0" },
    ]);
    // number
    expect(applyClassName("shrink-2", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "2" },
    ]);
    // arbitrary
    expect(applyClassName("shrink-[2]", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "2" },
    ]);
    // custom property
    expect(applyClassName("shrink-(--my-shrink)", ctx)).toEqual([
      { type: "decl", prop: "flex-shrink", value: "var(--my-shrink)" },
    ]);
  });

  it("order: static, number, negative, arbitrary, custom property", () => {
    // static
    expect(applyClassName("order-first", ctx)).toEqual([
      { type: "decl", prop: "order", value: "calc(-infinity)" },
    ]);
    expect(applyClassName("order-last", ctx)).toEqual([
      { type: "decl", prop: "order", value: "calc(infinity)" },
    ]);
    expect(applyClassName("order-none", ctx)).toEqual([
      { type: "decl", prop: "order", value: "0" },
    ]);
    // number
    expect(applyClassName("order-1", ctx)).toEqual([
      { type: "decl", prop: "order", value: "1" },
    ]);
    expect(applyClassName("order-2", ctx)).toEqual([
      { type: "decl", prop: "order", value: "2" },
    ]);
    // negative
    expect(applyClassName("-order-1", ctx)).toEqual([
      { type: "decl", prop: "order", value: "calc(1 * -1)" },
    ]);
    // arbitrary
    expect(applyClassName("order-[min(var(--total-items),10)]", ctx)).toEqual([
      { type: "decl", prop: "order", value: "min(var(--total-items),10)" },
    ]);
    // custom property
    expect(applyClassName("order-(--my-order)", ctx)).toEqual([
      { type: "decl", prop: "order", value: "var(--my-order)" },
    ]);
  });

  it("grid-template-columns: static, number, arbitrary, custom property", () => {
    // static
    expect(applyClassName("grid-cols-none", ctx)).toEqual([
      { type: "decl", prop: "grid-template-columns", value: "none" },
    ]);
    expect(applyClassName("grid-cols-subgrid", ctx)).toEqual([
      { type: "decl", prop: "grid-template-columns", value: "subgrid" },
    ]);
    // number
    expect(applyClassName("grid-cols-1", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-columns",
        value: "repeat(1, minmax(0, 1fr))",
      },
    ]);
    expect(applyClassName("grid-cols-3", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-columns",
        value: "repeat(3, minmax(0, 1fr))",
      },
    ]);
    // arbitrary
    expect(
      applyClassName("grid-cols-[200px_minmax(900px,_1fr)_100px]", ctx)
    ).toEqual([
      {
        type: "decl",
        prop: "grid-template-columns",
        value: "200px minmax(900px, 1fr) 100px",
      },
    ]);
    // custom property
    expect(applyClassName("grid-cols-(--my-grid-cols)", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-columns",
        value: "var(--my-grid-cols)",
      },
    ]);
  });

  it("grid-template-rows: static, number, arbitrary, custom property", () => {
    // static
    expect(applyClassName("grid-rows-none", ctx)).toEqual([
      { type: "decl", prop: "grid-template-rows", value: "none" },
    ]);
    expect(applyClassName("grid-rows-subgrid", ctx)).toEqual([
      { type: "decl", prop: "grid-template-rows", value: "subgrid" },
    ]);
    // number
    expect(applyClassName("grid-rows-1", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-rows",
        value: "repeat(1, minmax(0, 1fr))",
      },
    ]);
    expect(applyClassName("grid-rows-3", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-rows",
        value: "repeat(3, minmax(0, 1fr))",
      },
    ]);
    // arbitrary
    expect(
      applyClassName("grid-rows-[200px_minmax(900px,_1fr)_100px]", ctx)
    ).toEqual([
      {
        type: "decl",
        prop: "grid-template-rows",
        value: "200px minmax(900px, 1fr) 100px",
      },
    ]);
    // custom property
    expect(applyClassName("grid-rows-(--my-grid-rows)", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-template-rows",
        value: "var(--my-grid-rows)",
      },
    ]);
  });

  it("grid-row: row-span, row-start, row-end, row utilities", () => {
    // row-span
    expect(applyClassName("row-span-full", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "1 / -1" },
    ]);
    expect(applyClassName("row-span-2", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "span 2 / span 2" },
    ]);
    expect(applyClassName("row-span-[5]", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "span 5 / span 5" },
    ]);
    expect(applyClassName("row-span-(--my-span)", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-row",
        value: "span var(--my-span) / span var(--my-span)",
      },
    ]);
    // row-start
    expect(applyClassName("row-start-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "auto" },
    ]);
    expect(applyClassName("row-start-3", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "3" },
    ]);
    expect(applyClassName("-row-start-2", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "calc(2 * -1)" },
    ]);
    expect(applyClassName("row-start-(--my-start)", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "var(--my-start)" },
    ]);
    expect(applyClassName("row-start-[7]", ctx)).toEqual([
      { type: "decl", prop: "grid-row-start", value: "7" },
    ]);
    // row-end
    expect(applyClassName("row-end-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "auto" },
    ]);
    expect(applyClassName("row-end-4", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "4" },
    ]);
    expect(applyClassName("-row-end-2", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "calc(2 * -1)" },
    ]);
    expect(applyClassName("row-end-(--my-end)", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "var(--my-end)" },
    ]);
    expect(applyClassName("row-end-[8]", ctx)).toEqual([
      { type: "decl", prop: "grid-row-end", value: "8" },
    ]);
    // row
    expect(applyClassName("row-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "auto" },
    ]);
    expect(applyClassName("row-3", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "3" },
    ]);
    expect(applyClassName("-row-2", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "calc(2 * -1)" },
    ]);
    expect(applyClassName("row-(--my-row)", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "var(--my-row)" },
    ]);
    expect(applyClassName("row-[5]", ctx)).toEqual([
      { type: "decl", prop: "grid-row", value: "5" },
    ]);
  });

  it("grid-auto-flow: static utilities", () => {
    expect(applyClassName("grid-flow-row", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "row" },
    ]);
    expect(applyClassName("grid-flow-col", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "column" },
    ]);
    expect(applyClassName("grid-flow-dense", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "dense" },
    ]);
    expect(applyClassName("grid-flow-row-dense", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "row dense" },
    ]);
    expect(applyClassName("grid-flow-col-dense", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-flow", value: "column dense" },
    ]);
  });

  it("grid-auto-columns: static, arbitrary, custom property", () => {
    // static
    expect(applyClassName("auto-cols-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "auto" },
    ]);
    expect(applyClassName("auto-cols-min", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "min-content" },
    ]);
    expect(applyClassName("auto-cols-max", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "max-content" },
    ]);
    expect(applyClassName("auto-cols-fr", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "minmax(0, 1fr)" },
    ]);
    // arbitrary
    expect(applyClassName("auto-cols-[minmax(0,2fr)]", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "minmax(0,2fr)" },
    ]);
    // custom property
    expect(applyClassName("auto-cols-(--my-auto-cols)", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-columns", value: "var(--my-auto-cols)" },
    ]);
  });

  it("grid-auto-rows: static, arbitrary, custom property", () => {
    // static
    expect(applyClassName("auto-rows-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "auto" },
    ]);
    expect(applyClassName("auto-rows-min", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "min-content" },
    ]);
    expect(applyClassName("auto-rows-max", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "max-content" },
    ]);
    expect(applyClassName("auto-rows-fr", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "minmax(0, 1fr)" },
    ]);
    // arbitrary
    expect(applyClassName("auto-rows-[minmax(0,2fr)]", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "minmax(0,2fr)" },
    ]);
    // custom property
    expect(applyClassName("auto-rows-(--my-auto-rows)", ctx)).toEqual([
      { type: "decl", prop: "grid-auto-rows", value: "var(--my-auto-rows)" },
    ]);
  });

  it("gap: number, arbitrary, custom property", () => {
    // number
    expect(applyClassName("gap-2", ctx)).toEqual([
      { type: "decl", prop: "gap", value: "calc(var(--spacing) * 2)" },
    ]);
    // arbitrary
    expect(applyClassName("gap-[10vw]", ctx)).toEqual([
      { type: "decl", prop: "gap", value: "10vw" },
    ]);
    // custom property
    expect(applyClassName("gap-(--my-gap)", ctx)).toEqual([
      { type: "decl", prop: "gap", value: "var(--my-gap)" },
    ]);
  });
  it("gap-x: number, arbitrary, custom property", () => {
    // number
    expect(applyClassName("gap-x-3", ctx)).toEqual([
      { type: "decl", prop: "column-gap", value: "calc(var(--spacing) * 3)" },
    ]);
    // arbitrary
    expect(applyClassName("gap-x-[5vw]", ctx)).toEqual([
      { type: "decl", prop: "column-gap", value: "5vw" },
    ]);
    // custom property
    expect(applyClassName("gap-x-(--my-gap-x)", ctx)).toEqual([
      { type: "decl", prop: "column-gap", value: "var(--my-gap-x)" },
    ]);
  });
  it("gap-y: number, arbitrary, custom property", () => {
    // number
    expect(applyClassName("gap-y-4", ctx)).toEqual([
      { type: "decl", prop: "row-gap", value: "calc(var(--spacing) * 4)" },
    ]);
    // arbitrary
    expect(applyClassName("gap-y-[2vw]", ctx)).toEqual([
      { type: "decl", prop: "row-gap", value: "2vw" },
    ]);
    // custom property
    expect(applyClassName("gap-y-(--my-gap-y)", ctx)).toEqual([
      { type: "decl", prop: "row-gap", value: "var(--my-gap-y)" },
    ]);
  });

  it("justify-content: static utilities", () => {
    expect(applyClassName("justify-start", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "flex-start" },
    ]);
    expect(applyClassName("justify-end", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "flex-end" },
    ]);
    expect(applyClassName("justify-end-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "safe flex-end" },
    ]);
    expect(applyClassName("justify-center", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "center" },
    ]);
    expect(applyClassName("justify-center-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "safe center" },
    ]);
    expect(applyClassName("justify-between", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "space-between" },
    ]);
    expect(applyClassName("justify-around", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "space-around" },
    ]);
    expect(applyClassName("justify-evenly", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "space-evenly" },
    ]);
    expect(applyClassName("justify-stretch", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "stretch" },
    ]);
    expect(applyClassName("justify-baseline", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "baseline" },
    ]);
    expect(applyClassName("justify-normal", ctx)).toEqual([
      { type: "decl", prop: "justify-content", value: "normal" },
    ]);
  });

  it("justify-items: static utilities", () => {
    expect(applyClassName("justify-items-start", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "start" },
    ]);
    expect(applyClassName("justify-items-end", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "end" },
    ]);
    expect(applyClassName("justify-items-end-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "safe end" },
    ]);
    expect(applyClassName("justify-items-center", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "center" },
    ]);
    expect(applyClassName("justify-items-center-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "safe center" },
    ]);
    expect(applyClassName("justify-items-stretch", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "stretch" },
    ]);
    expect(applyClassName("justify-items-normal", ctx)).toEqual([
      { type: "decl", prop: "justify-items", value: "normal" },
    ]);
  });

  it("justify-self: static utilities", () => {
    expect(applyClassName("justify-self-auto", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "auto" },
    ]);
    expect(applyClassName("justify-self-start", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "start" },
    ]);
    expect(applyClassName("justify-self-center", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "center" },
    ]);
    expect(applyClassName("justify-self-center-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "safe center" },
    ]);
    expect(applyClassName("justify-self-end", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "end" },
    ]);
    expect(applyClassName("justify-self-end-safe", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "safe end" },
    ]);
    expect(applyClassName("justify-self-stretch", ctx)).toEqual([
      { type: "decl", prop: "justify-self", value: "stretch" },
    ]);
  });

  it("align-content: static utilities", () => {
    expect(applyClassName("content-normal", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "normal" },
    ]);
    expect(applyClassName("content-center", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "center" },
    ]);
    expect(applyClassName("content-start", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "flex-start" },
    ]);
    expect(applyClassName("content-end", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "flex-end" },
    ]);
    expect(applyClassName("content-between", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "space-between" },
    ]);
    expect(applyClassName("content-around", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "space-around" },
    ]);
    expect(applyClassName("content-evenly", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "space-evenly" },
    ]);
    expect(applyClassName("content-baseline", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "baseline" },
    ]);
    expect(applyClassName("content-stretch", ctx)).toEqual([
      { type: "decl", prop: "align-content", value: "stretch" },
    ]);
  });

  it("align-items: static utilities", () => {
    expect(applyClassName("items-start", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "flex-start" },
    ]);
    expect(applyClassName("items-end", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "flex-end" },
    ]);
    expect(applyClassName("items-end-safe", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "safe flex-end" },
    ]);
    expect(applyClassName("items-center", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "center" },
    ]);
    expect(applyClassName("items-center-safe", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "safe center" },
    ]);
    expect(applyClassName("items-baseline", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "baseline" },
    ]);
    expect(applyClassName("items-baseline-last", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "last baseline" },
    ]);
    expect(applyClassName("items-stretch", ctx)).toEqual([
      { type: "decl", prop: "align-items", value: "stretch" },
    ]);
  });

  it("align-self: static utilities", () => {
    expect(applyClassName("self-auto", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "auto" },
    ]);
    expect(applyClassName("self-start", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "flex-start" },
    ]);
    expect(applyClassName("self-end", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "flex-end" },
    ]);
    expect(applyClassName("self-end-safe", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "safe flex-end" },
    ]);
    expect(applyClassName("self-center", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "center" },
    ]);
    expect(applyClassName("self-center-safe", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "safe center" },
    ]);
    expect(applyClassName("self-stretch", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "stretch" },
    ]);
    expect(applyClassName("self-baseline", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "baseline" },
    ]);
    expect(applyClassName("self-baseline-last", ctx)).toEqual([
      { type: "decl", prop: "align-self", value: "last baseline" },
    ]);
  });

  it("place-content: static utilities", () => {
    expect(applyClassName("place-content-center", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "center" },
    ]);
    expect(applyClassName("place-content-center-safe", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "safe center" },
    ]);
    expect(applyClassName("place-content-start", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "start" },
    ]);
    expect(applyClassName("place-content-end", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "end" },
    ]);
    expect(applyClassName("place-content-end-safe", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "safe end" },
    ]);
    expect(applyClassName("place-content-between", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "space-between" },
    ]);
    expect(applyClassName("place-content-around", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "space-around" },
    ]);
    expect(applyClassName("place-content-evenly", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "space-evenly" },
    ]);
    expect(applyClassName("place-content-baseline", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "baseline" },
    ]);
    expect(applyClassName("place-content-stretch", ctx)).toEqual([
      { type: "decl", prop: "place-content", value: "stretch" },
    ]);
  });

  it("place-items: static utilities", () => {
    expect(applyClassName("place-items-start", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "start" },
    ]);
    expect(applyClassName("place-items-end", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "end" },
    ]);
    expect(applyClassName("place-items-end-safe", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "safe end" },
    ]);
    expect(applyClassName("place-items-center", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "center" },
    ]);
    expect(applyClassName("place-items-center-safe", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "safe center" },
    ]);
    expect(applyClassName("place-items-baseline", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "baseline" },
    ]);
    expect(applyClassName("place-items-stretch", ctx)).toEqual([
      { type: "decl", prop: "place-items", value: "stretch" },
    ]);
  });

  it("place-self: static utilities", () => {
    expect(applyClassName("place-self-auto", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "auto" },
    ]);
    expect(applyClassName("place-self-start", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "start" },
    ]);
    expect(applyClassName("place-self-end", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "end" },
    ]);
    expect(applyClassName("place-self-end-safe", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "safe end" },
    ]);
    expect(applyClassName("place-self-center", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "center" },
    ]);
    expect(applyClassName("place-self-center-safe", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "safe center" },
    ]);
    expect(applyClassName("place-self-stretch", ctx)).toEqual([
      { type: "decl", prop: "place-self", value: "stretch" },
    ]);
  });

  it("grid-column: col-span, col-start, col-end, col utilities", () => {
    // col-span
    expect(applyClassName("col-span-full", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "1 / -1" },
    ]);
    expect(applyClassName("col-span-2", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "span 2 / span 2" },
    ]);
    expect(applyClassName("col-span-[5]", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "span 5 / span 5" },
    ]);
    expect(applyClassName("col-span-(--my-span)", ctx)).toEqual([
      {
        type: "decl",
        prop: "grid-column",
        value: "span var(--my-span) / span var(--my-span)",
      },
    ]);
    // col-start
    expect(applyClassName("col-start-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-column-start", value: "auto" },
    ]);
    expect(applyClassName("col-start-3", ctx)).toEqual([
      { type: "decl", prop: "grid-column-start", value: "3" },
    ]);
    expect(applyClassName("-col-start-2", ctx)).toEqual([
      { type: "decl", prop: "grid-column-start", value: "calc(2 * -1)" },
    ]);
    expect(applyClassName("col-start-(--my-start)", ctx)).toEqual([
      { type: "decl", prop: "grid-column-start", value: "var(--my-start)" },
    ]);
    // col-end
    expect(applyClassName("col-end-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-column-end", value: "auto" },
    ]);
    expect(applyClassName("col-end-4", ctx)).toEqual([
      { type: "decl", prop: "grid-column-end", value: "4" },
    ]);
    expect(applyClassName("-col-end-2", ctx)).toEqual([
      { type: "decl", prop: "grid-column-end", value: "calc(2 * -1)" },
    ]);
    expect(applyClassName("col-end-(--my-end)", ctx)).toEqual([
      { type: "decl", prop: "grid-column-end", value: "var(--my-end)" },
    ]);
    // col
    expect(applyClassName("col-auto", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "auto" },
    ]);
    expect(applyClassName("col-3", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "3" },
    ]);
    expect(applyClassName("-col-2", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "calc(2 * -1)" },
    ]);
    expect(applyClassName("col-(--my-col)", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "var(--my-col)" },
    ]);
    expect(applyClassName("col-[3]", ctx)).toEqual([
      { type: "decl", prop: "grid-column", value: "3" },
    ]);
  });

  describe("padding utilities", () => {
    it("p-4 → padding: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("p-4", ctx)).toEqual([
        { type: "decl", prop: "padding", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("p-px → padding: 1px", () => {
      expect(applyClassName("p-px", ctx)).toEqual([
        { type: "decl", prop: "padding", value: "1px" },
      ]);
    });
    it("p-[5px] → padding: 5px", () => {
      expect(applyClassName("p-[5px]", ctx)).toEqual([
        { type: "decl", prop: "padding", value: "5px" },
      ]);
    });
    it("p-(--my-padding) → padding: var(--my-padding)", () => {
      expect(applyClassName("p-(--my-padding)", ctx)).toEqual([
        { type: "decl", prop: "padding", value: "var(--my-padding)" },
      ]);
    });

    it("px-2 → padding-inline: calc(var(--spacing) * 2)", () => {
      expect(applyClassName("px-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-inline",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("px-px → padding-inline: 1px", () => {
      expect(applyClassName("px-px", ctx)).toEqual([
        { type: "decl", prop: "padding-inline", value: "1px" },
      ]);
    });
    it("px-[10%] → padding-inline: 10%", () => {
      expect(applyClassName("px-[10%]", ctx)).toEqual([
        { type: "decl", prop: "padding-inline", value: "10%" },
      ]);
    });
    it("px-(--pad-x) → padding-inline: var(--pad-x)", () => {
      expect(applyClassName("px-(--pad-x)", ctx)).toEqual([
        { type: "decl", prop: "padding-inline", value: "var(--pad-x)" },
      ]);
    });

    it("py-3 → padding-block: calc(var(--spacing) * 3)", () => {
      expect(applyClassName("py-3", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-block",
          value: "calc(var(--spacing) * 3)",
        },
      ]);
    });
    it("py-px → padding-block: 1px", () => {
      expect(applyClassName("py-px", ctx)).toEqual([
        { type: "decl", prop: "padding-block", value: "1px" },
      ]);
    });
    it("py-[2em] → padding-block: 2em", () => {
      expect(applyClassName("py-[2em]", ctx)).toEqual([
        { type: "decl", prop: "padding-block", value: "2em" },
      ]);
    });
    it("py-(--pad-y) → padding-block: var(--pad-y)", () => {
      expect(applyClassName("py-(--pad-y)", ctx)).toEqual([
        { type: "decl", prop: "padding-block", value: "var(--pad-y)" },
      ]);
    });

    it("ps-1 → padding-inline-start: calc(var(--spacing) * 1)", () => {
      expect(applyClassName("ps-1", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-inline-start",
          value: "calc(var(--spacing) * 1)",
        },
      ]);
    });
    it("ps-px → padding-inline-start: 1px", () => {
      expect(applyClassName("ps-px", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-start", value: "1px" },
      ]);
    });
    it("ps-[3vw] → padding-inline-start: 3vw", () => {
      expect(applyClassName("ps-[3vw]", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-start", value: "3vw" },
      ]);
    });
    it("ps-(--pad-start) → padding-inline-start: var(--pad-start)", () => {
      expect(applyClassName("ps-(--pad-start)", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-inline-start",
          value: "var(--pad-start)",
        },
      ]);
    });

    it("pe-5 → padding-inline-end: calc(var(--spacing) * 5)", () => {
      expect(applyClassName("pe-5", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-inline-end",
          value: "calc(var(--spacing) * 5)",
        },
      ]);
    });
    it("pe-px → padding-inline-end: 1px", () => {
      expect(applyClassName("pe-px", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-end", value: "1px" },
      ]);
    });
    it("pe-[7rem] → padding-inline-end: 7rem", () => {
      expect(applyClassName("pe-[7rem]", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-end", value: "7rem" },
      ]);
    });
    it("pe-(--pad-end) → padding-inline-end: var(--pad-end)", () => {
      expect(applyClassName("pe-(--pad-end)", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-end", value: "var(--pad-end)" },
      ]);
    });

    it("pt-6 → padding-top: calc(var(--spacing) * 6)", () => {
      expect(applyClassName("pt-6", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-top",
          value: "calc(var(--spacing) * 6)",
        },
      ]);
    });
    it("pt-px → padding-top: 1px", () => {
      expect(applyClassName("pt-px", ctx)).toEqual([
        { type: "decl", prop: "padding-top", value: "1px" },
      ]);
    });
    it("pt-[8px] → padding-top: 8px", () => {
      expect(applyClassName("pt-[8px]", ctx)).toEqual([
        { type: "decl", prop: "padding-top", value: "8px" },
      ]);
    });
    it("pt-(--pad-top) → padding-top: var(--pad-top)", () => {
      expect(applyClassName("pt-(--pad-top)", ctx)).toEqual([
        { type: "decl", prop: "padding-top", value: "var(--pad-top)" },
      ]);
    });

    it("pr-2 → padding-right: calc(var(--spacing) * 2)", () => {
      expect(applyClassName("pr-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-right",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("pr-px → padding-right: 1px", () => {
      expect(applyClassName("pr-px", ctx)).toEqual([
        { type: "decl", prop: "padding-right", value: "1px" },
      ]);
    });
    it("pr-[9px] → padding-right: 9px", () => {
      expect(applyClassName("pr-[9px]", ctx)).toEqual([
        { type: "decl", prop: "padding-right", value: "9px" },
      ]);
    });
    it("pr-(--pad-right) → padding-right: var(--pad-right)", () => {
      expect(applyClassName("pr-(--pad-right)", ctx)).toEqual([
        { type: "decl", prop: "padding-right", value: "var(--pad-right)" },
      ]);
    });

    it("pb-3 → padding-bottom: calc(var(--spacing) * 3)", () => {
      expect(applyClassName("pb-3", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-bottom",
          value: "calc(var(--spacing) * 3)",
        },
      ]);
    });
    it("pb-px → padding-bottom: 1px", () => {
      expect(applyClassName("pb-px", ctx)).toEqual([
        { type: "decl", prop: "padding-bottom", value: "1px" },
      ]);
    });
    it("pb-[11px] → padding-bottom: 11px", () => {
      expect(applyClassName("pb-[11px]", ctx)).toEqual([
        { type: "decl", prop: "padding-bottom", value: "11px" },
      ]);
    });
    it("pb-(--pad-bottom) → padding-bottom: var(--pad-bottom)", () => {
      expect(applyClassName("pb-(--pad-bottom)", ctx)).toEqual([
        { type: "decl", prop: "padding-bottom", value: "var(--pad-bottom)" },
      ]);
    });

    it("pl-4 → padding-left: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("pl-4", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-left",
          value: "calc(var(--spacing) * 4)",
        },
      ]);
    });
    it("pl-px → padding-left: 1px", () => {
      expect(applyClassName("pl-px", ctx)).toEqual([
        { type: "decl", prop: "padding-left", value: "1px" },
      ]);
    });
    it("pl-[13px] → padding-left: 13px", () => {
      expect(applyClassName("pl-[13px]", ctx)).toEqual([
        { type: "decl", prop: "padding-left", value: "13px" },
      ]);
    });
    it("pl-(--pad-left) → padding-left: var(--pad-left)", () => {
      expect(applyClassName("pl-(--pad-left)", ctx)).toEqual([
        { type: "decl", prop: "padding-left", value: "var(--pad-left)" },
      ]);
    });
  });

  describe("margin utilities", () => {
    it("m-4 → margin: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("m-4", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("-m-2 → margin: calc(var(--spacing) * -2)", () => {
      expect(applyClassName("-m-2", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "calc(var(--spacing) * -2)" },
      ]);
    });
    it("m-auto → margin: auto", () => {
      expect(applyClassName("m-auto", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "auto" },
      ]);
    });
    it("m-px → margin: 1px", () => {
      expect(applyClassName("m-px", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "1px" },
      ]);
    });
    it("-m-px → margin: -1px", () => {
      expect(applyClassName("-m-px", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "-1px" },
      ]);
    });
    it("m-[5vw] → margin: 5vw", () => {
      expect(applyClassName("m-[5vw]", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "5vw" },
      ]);
    });
    it("m-(--my-margin) → margin: var(--my-margin)", () => {
      expect(applyClassName("m-(--my-margin)", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "var(--my-margin)" },
      ]);
    });
    it("mx-2 → margin-inline: calc(var(--spacing) * 2)", () => {
      expect(applyClassName("mx-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("-mx-2 → margin-inline: calc(var(--spacing) * -2)", () => {
      expect(applyClassName("-mx-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline",
          value: "calc(var(--spacing) * -2)",
        },
      ]);
    });
    it("mx-auto → margin-inline: auto", () => {
      expect(applyClassName("mx-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "auto" },
      ]);
    });
    it("mx-px → margin-inline: 1px", () => {
      expect(applyClassName("mx-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "1px" },
      ]);
    });
    it("-mx-px → margin-inline: -1px", () => {
      expect(applyClassName("-mx-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "-1px" },
      ]);
    });
    it("mx-[10%] → margin-inline: 10%", () => {
      expect(applyClassName("mx-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "10%" },
      ]);
    });
    it("mx-(--pad-x) → margin-inline: var(--pad-x)", () => {
      expect(applyClassName("mx-(--pad-x)", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "var(--pad-x)" },
      ]);
    });
    it("my-2 → margin-block: calc(var(--spacing) * 2)", () => {
      expect(applyClassName("my-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-block",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("-my-2 → margin-block: calc(var(--spacing) * -2)", () => {
      expect(applyClassName("-my-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-block",
          value: "calc(var(--spacing) * -2)",
        },
      ]);
    });
    it("my-auto → margin-block: auto", () => {
      expect(applyClassName("my-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "auto" },
      ]);
    });
    it("my-px → margin-block: 1px", () => {
      expect(applyClassName("my-px", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "1px" },
      ]);
    });
    it("-my-px → margin-block: -1px", () => {
      expect(applyClassName("-my-px", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "-1px" },
      ]);
    });
    it("my-[10%] → margin-block: 10%", () => {
      expect(applyClassName("my-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "10%" },
      ]);
    });
    it("my-(--pad-y) → margin-block: var(--pad-y)", () => {
      expect(applyClassName("my-(--pad-y)", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "var(--pad-y)" },
      ]);
    });
    it("ms-1 → margin-inline-start: calc(var(--spacing) * 1)", () => {
      expect(applyClassName("ms-1", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-start",
          value: "calc(var(--spacing) * 1)",
        },
      ]);
    });
    it("-ms-1 → margin-inline-start: calc(var(--spacing) * -1)", () => {
      expect(applyClassName("-ms-1", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-start",
          value: "calc(var(--spacing) * -1)",
        },
      ]);
    });
    it("ms-auto → margin-inline-start: auto", () => {
      expect(applyClassName("ms-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-start", value: "auto" },
      ]);
    });
    it("ms-px → margin-inline-start: 1px", () => {
      expect(applyClassName("ms-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-start", value: "1px" },
      ]);
    });
    it("-ms-px → margin-inline-start: -1px", () => {
      expect(applyClassName("-ms-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-start", value: "-1px" },
      ]);
    });
    it("ms-[10%] → margin-inline-start: 10%", () => {
      expect(applyClassName("ms-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-start", value: "10%" },
      ]);
    });
    it("ms-(--pad-start) → margin-inline-start: var(--pad-start)", () => {
      expect(applyClassName("ms-(--pad-start)", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-start",
          value: "var(--pad-start)",
        },
      ]);
    });
    it("me-5 → margin-inline-end: calc(var(--spacing) * 5)", () => {
      expect(applyClassName("me-5", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-end",
          value: "calc(var(--spacing) * 5)",
        },
      ]);
    });
    it("-me-5 → margin-inline-end: calc(var(--spacing) * -5)", () => {
      expect(applyClassName("-me-5", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-end",
          value: "calc(var(--spacing) * -5)",
        },
      ]);
    });
    it("me-auto → margin-inline-end: auto", () => {
      expect(applyClassName("me-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "auto" },
      ]);
    });
    it("me-px → margin-inline-end: 1px", () => {
      expect(applyClassName("me-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "1px" },
      ]);
    });
    it("-me-px → margin-inline-end: -1px", () => {
      expect(applyClassName("-me-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "-1px" },
      ]);
    });
    it("me-[10%] → margin-inline-end: 10%", () => {
      expect(applyClassName("me-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "10%" },
      ]);
    });
    it("me-(--pad-end) → margin-inline-end: var(--pad-end)", () => {
      expect(applyClassName("me-(--pad-end)", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "var(--pad-end)" },
      ]);
    });
    it("mt-6 → margin-top: calc(var(--spacing) * 6)", () => {
      expect(applyClassName("mt-6", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "calc(var(--spacing) * 6)" },
      ]);
    });
    it("-mt-6 → margin-top: calc(var(--spacing) * -6)", () => {
      expect(applyClassName("-mt-6", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-top",
          value: "calc(var(--spacing) * -6)",
        },
      ]);
    });
    it("mt-auto → margin-top: auto", () => {
      expect(applyClassName("mt-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "auto" },
      ]);
    });
    it("mt-px → margin-top: 1px", () => {
      expect(applyClassName("mt-px", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "1px" },
      ]);
    });
    it("-mt-px → margin-top: -1px", () => {
      expect(applyClassName("-mt-px", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "-1px" },
      ]);
    });
    it("mt-[10%] → margin-top: 10%", () => {
      expect(applyClassName("mt-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "10%" },
      ]);
    });
    it("mt-(--pad-top) → margin-top: var(--pad-top)", () => {
      expect(applyClassName("mt-(--pad-top)", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "var(--pad-top)" },
      ]);
    });
    it("mr-2 → margin-right: calc(var(--spacing) * 2)", () => {
      expect(applyClassName("mr-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-right",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("-mr-2 → margin-right: calc(var(--spacing) * -2)", () => {
      expect(applyClassName("-mr-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-right",
          value: "calc(var(--spacing) * -2)",
        },
      ]);
    });
    it("mr-auto → margin-right: auto", () => {
      expect(applyClassName("mr-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "auto" },
      ]);
    });
    it("mr-px → margin-right: 1px", () => {
      expect(applyClassName("mr-px", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "1px" },
      ]);
    });
    it("-mr-px → margin-right: -1px", () => {
      expect(applyClassName("-mr-px", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "-1px" },
      ]);
    });
    it("mr-[10%] → margin-right: 10%", () => {
      expect(applyClassName("mr-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "10%" },
      ]);
    });
    it("mr-(--pad-right) → margin-right: var(--pad-right)", () => {
      expect(applyClassName("mr-(--pad-right)", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "var(--pad-right)" },
      ]);
    });
    it("mb-3 → margin-bottom: calc(var(--spacing) * 3)", () => {
      expect(applyClassName("mb-3", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-bottom",
          value: "calc(var(--spacing) * 3)",
        },
      ]);
    });
    it("-mb-3 → margin-bottom: calc(var(--spacing) * -3)", () => {
      expect(applyClassName("-mb-3", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-bottom",
          value: "calc(var(--spacing) * -3)",
        },
      ]);
    });
    it("mb-auto → margin-bottom: auto", () => {
      expect(applyClassName("mb-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "auto" },
      ]);
    });
    it("mb-px → margin-bottom: 1px", () => {
      expect(applyClassName("mb-px", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "1px" },
      ]);
    });
    it("-mb-px → margin-bottom: -1px", () => {
      expect(applyClassName("-mb-px", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "-1px" },
      ]);
    });
    it("mb-[10%] → margin-bottom: 10%", () => {
      expect(applyClassName("mb-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "10%" },
      ]);
    });
    it("mb-(--pad-bottom) → margin-bottom: var(--pad-bottom)", () => {
      expect(applyClassName("mb-(--pad-bottom)", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "var(--pad-bottom)" },
      ]);
    });
    it("ml-4 → margin-left: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("ml-4", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-left",
          value: "calc(var(--spacing) * 4)",
        },
      ]);
    });
    it("-ml-4 → margin-left: calc(var(--spacing) * -4)", () => {
      expect(applyClassName("-ml-4", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-left",
          value: "calc(var(--spacing) * -4)",
        },
      ]);
    });
    it("ml-auto → margin-left: auto", () => {
      expect(applyClassName("ml-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "auto" },
      ]);
    });
    it("ml-px → margin-left: 1px", () => {
      expect(applyClassName("ml-px", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "1px" },
      ]);
    });
    it("-ml-px → margin-left: -1px", () => {
      expect(applyClassName("-ml-px", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "-1px" },
      ]);
    });
    it("ml-[10%] → margin-left: 10%", () => {
      expect(applyClassName("ml-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "10%" },
      ]);
    });
    it("ml-(--pad-left) → margin-left: var(--pad-left)", () => {
      expect(applyClassName("ml-(--pad-left)", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "var(--pad-left)" },
      ]);
    });
  });

  describe("space utilities", () => {
    it("space-x-4 → correct AST", () => {
      expect(applyClassName("space-x-4", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value:
                "calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value:
                "calc(calc(var(--spacing) * 4) * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("-space-x-2 → correct AST", () => {
      expect(applyClassName("-space-x-2", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value:
                "calc(calc(var(--spacing) * -2) * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value:
                "calc(calc(var(--spacing) * -2) * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-x-px → correct AST", () => {
      expect(applyClassName("space-x-px", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value: "calc(1px * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value: "calc(1px * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("-space-x-px → correct AST", () => {
      expect(applyClassName("-space-x-px", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value: "calc(-1px * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value: "calc(-1px * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-x-reverse → correct AST", () => {
      expect(applyClassName("space-x-reverse", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [{ type: "decl", prop: "--tw-space-x-reverse", value: "1" }],
        },
      ]);
    });
    it("space-x-[5vw] → correct AST", () => {
      expect(applyClassName("space-x-[5vw]", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value: "calc(5vw * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value: "calc(5vw * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-x-(--gap-x) → correct AST", () => {
      expect(applyClassName("space-x-(--gap-x)", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value: "calc(var(--gap-x) * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value: "calc(var(--gap-x) * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    // Repeat for space-y utilities
    it("space-y-3 → correct AST", () => {
      expect(applyClassName("space-y-3", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value:
                "calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value:
                "calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("-space-y-1 → correct AST", () => {
      expect(applyClassName("-space-y-1", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value:
                "calc(calc(var(--spacing) * -1) * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value:
                "calc(calc(var(--spacing) * -1) * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-y-px → correct AST", () => {
      expect(applyClassName("space-y-px", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value: "calc(1px * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value: "calc(1px * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("-space-y-px → correct AST", () => {
      expect(applyClassName("-space-y-px", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value: "calc(-1px * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value: "calc(-1px * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-y-reverse → correct AST", () => {
      expect(applyClassName("space-y-reverse", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [{ type: "decl", prop: "--tw-space-y-reverse", value: "1" }],
        },
      ]);
    });
    it("space-y-[2em] → correct AST", () => {
      expect(applyClassName("space-y-[2em]", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value: "calc(2em * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value: "calc(2em * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-y-(--gap-y) → correct AST", () => {
      expect(applyClassName("space-y-(--gap-y)", ctx)).toEqual([
        {
          type: "rule",
          selector: "& > :not([hidden]) ~ :not([hidden])",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value: "calc(var(--gap-y) * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value: "calc(var(--gap-y) * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
  });

  describe("width utilities", () => {
    it("w-4 → width: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("w-4", ctx)).toEqual([
        { type: "decl", prop: "width", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("w-1/2 → width: calc(1/2 * 100%)", () => {
      expect(applyClassName("w-1/2", ctx)).toEqual([
        { type: "decl", prop: "width", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("w-auto → width: auto", () => {
      expect(applyClassName("w-auto", ctx)).toEqual([
        { type: "decl", prop: "width", value: "auto" },
      ]);
    });
    it("w-px → width: 1px", () => {
      expect(applyClassName("w-px", ctx)).toEqual([
        { type: "decl", prop: "width", value: "1px" },
      ]);
    });
    it("w-full → width: 100%", () => {
      expect(applyClassName("w-full", ctx)).toEqual([
        { type: "decl", prop: "width", value: "100%" },
      ]);
    });
    it("w-screen → width: 100vw", () => {
      expect(applyClassName("w-screen", ctx)).toEqual([
        { type: "decl", prop: "width", value: "100vw" },
      ]);
    });
    it("w-3xs → width: var(--container-3xs)", () => {
      expect(applyClassName("w-3xs", ctx)).toEqual([
        { type: "decl", prop: "width", value: "var(--container-3xs)" },
      ]);
    });
    it("w-[32rem] → width: 32rem", () => {
      expect(applyClassName("w-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "width", value: "32rem" },
      ]);
    });
    it("w-(--my-width) → width: var(--my-width)", () => {
      expect(applyClassName("w-(--my-width)", ctx)).toEqual([
        { type: "decl", prop: "width", value: "var(--my-width)" },
      ]);
    });
  });

  describe("size utilities", () => {
    it("size-4 → width/height: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("size-4", ctx)).toEqual([
        { type: "decl", prop: "width", value: "calc(var(--spacing) * 4)" },
        { type: "decl", prop: "height", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("size-1/2 → width/height: calc(1/2 * 100%)", () => {
      expect(applyClassName("size-1/2", ctx)).toEqual([
        { type: "decl", prop: "width", value: "calc(1/2 * 100%)" },
        { type: "decl", prop: "height", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("size-auto → width/height: auto", () => {
      expect(applyClassName("size-auto", ctx)).toEqual([
        { type: "decl", prop: "width", value: "auto" },
        { type: "decl", prop: "height", value: "auto" },
      ]);
    });
    it("size-px → width/height: 1px", () => {
      expect(applyClassName("size-px", ctx)).toEqual([
        { type: "decl", prop: "width", value: "1px" },
        { type: "decl", prop: "height", value: "1px" },
      ]);
    });
    it("size-full → width/height: 100%", () => {
      expect(applyClassName("size-full", ctx)).toEqual([
        { type: "decl", prop: "width", value: "100%" },
        { type: "decl", prop: "height", value: "100%" },
      ]);
    });
    it("size-[32rem] → width/height: 32rem", () => {
      expect(applyClassName("size-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "width", value: "32rem" },
        { type: "decl", prop: "height", value: "32rem" },
      ]);
    });
    it("size-(--my-size) → width/height: var(--my-size)", () => {
      expect(applyClassName("size-(--my-size)", ctx)).toEqual([
        { type: "decl", prop: "width", value: "var(--my-size)" },
        { type: "decl", prop: "height", value: "var(--my-size)" },
      ]);
    });
  });

  describe("height utilities", () => {
    it("h-4 → height: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("h-4", ctx)).toEqual([
        { type: "decl", prop: "height", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("h-1/2 → height: calc(1/2 * 100%)", () => {
      expect(applyClassName("h-1/2", ctx)).toEqual([
        { type: "decl", prop: "height", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("h-auto → height: auto", () => {
      expect(applyClassName("h-auto", ctx)).toEqual([
        { type: "decl", prop: "height", value: "auto" },
      ]);
    });
    it("h-px → height: 1px", () => {
      expect(applyClassName("h-px", ctx)).toEqual([
        { type: "decl", prop: "height", value: "1px" },
      ]);
    });
    it("h-full → height: 100%", () => {
      expect(applyClassName("h-full", ctx)).toEqual([
        { type: "decl", prop: "height", value: "100%" },
      ]);
    });
    it("h-screen → height: 100vh", () => {
      expect(applyClassName("h-screen", ctx)).toEqual([
        { type: "decl", prop: "height", value: "100vh" },
      ]);
    });
    it("h-dvh → height: 100dvh", () => {
      expect(applyClassName("h-dvh", ctx)).toEqual([
        { type: "decl", prop: "height", value: "100dvh" },
      ]);
    });
    it("h-min → height: min-content", () => {
      expect(applyClassName("h-min", ctx)).toEqual([
        { type: "decl", prop: "height", value: "min-content" },
      ]);
    });
    it("h-max → height: max-content", () => {
      expect(applyClassName("h-max", ctx)).toEqual([
        { type: "decl", prop: "height", value: "max-content" },
      ]);
    });
    it("h-fit → height: fit-content", () => {
      expect(applyClassName("h-fit", ctx)).toEqual([
        { type: "decl", prop: "height", value: "fit-content" },
      ]);
    });
    it("h-[32rem] → height: 32rem", () => {
      expect(applyClassName("h-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "height", value: "32rem" },
      ]);
    });
    it("h-(--my-height) → height: var(--my-height)", () => {
      expect(applyClassName("h-(--my-height)", ctx)).toEqual([
        { type: "decl", prop: "height", value: "var(--my-height)" },
      ]);
    });
  });

  describe("min-height utilities", () => {
    it("min-h-4 → min-height: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("min-h-4", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("min-h-1/2 → min-height: calc(1/2 * 100%)", () => {
      expect(applyClassName("min-h-1/2", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("min-h-0 → min-height: 0px", () => {
      expect(applyClassName("min-h-0", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "0px" },
      ]);
    });
    it("min-h-px → min-height: 1px", () => {
      expect(applyClassName("min-h-px", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "1px" },
      ]);
    });
    it("min-h-full → min-height: 100%", () => {
      expect(applyClassName("min-h-full", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "100%" },
      ]);
    });
    it("min-h-screen → min-height: 100vh", () => {
      expect(applyClassName("min-h-screen", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "100vh" },
      ]);
    });
    it("min-h-dvh → min-height: 100dvh", () => {
      expect(applyClassName("min-h-dvh", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "100dvh" },
      ]);
    });
    it("min-h-min → min-height: min-content", () => {
      expect(applyClassName("min-h-min", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "min-content" },
      ]);
    });
    it("min-h-max → min-height: max-content", () => {
      expect(applyClassName("min-h-max", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "max-content" },
      ]);
    });
    it("min-h-fit → min-height: fit-content", () => {
      expect(applyClassName("min-h-fit", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "fit-content" },
      ]);
    });
    it("min-h-[32rem] → min-height: 32rem", () => {
      expect(applyClassName("min-h-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "32rem" },
      ]);
    });
    it("min-h-(--my-min-height) → min-height: var(--my-min-height)", () => {
      expect(applyClassName("min-h-(--my-min-height)", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "var(--my-min-height)" },
      ]);
    });
  });

  describe("max-height utilities", () => {
    it("max-h-4 → max-height: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("max-h-4", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("max-h-1/2 → max-height: calc(1/2 * 100%)", () => {
      expect(applyClassName("max-h-1/2", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("max-h-px → max-height: 1px", () => {
      expect(applyClassName("max-h-px", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "1px" },
      ]);
    });
    it("max-h-full → max-height: 100%", () => {
      expect(applyClassName("max-h-full", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "100%" },
      ]);
    });
    it("max-h-screen → max-height: 100vh", () => {
      expect(applyClassName("max-h-screen", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "100vh" },
      ]);
    });
    it("max-h-dvh → max-height: 100dvh", () => {
      expect(applyClassName("max-h-dvh", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "100dvh" },
      ]);
    });
    it("max-h-min → max-height: min-content", () => {
      expect(applyClassName("max-h-min", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "min-content" },
      ]);
    });
    it("max-h-max → max-height: max-content", () => {
      expect(applyClassName("max-h-max", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "max-content" },
      ]);
    });
    it("max-h-fit → max-height: fit-content", () => {
      expect(applyClassName("max-h-fit", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "fit-content" },
      ]);
    });
    it("max-h-none → max-height: none", () => {
      expect(applyClassName("max-h-none", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "none" },
      ]);
    });
    it("max-h-[32rem] → max-height: 32rem", () => {
      expect(applyClassName("max-h-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "32rem" },
      ]);
    });
    it("max-h-(--my-max-height) → max-height: var(--my-max-height)", () => {
      expect(applyClassName("max-h-(--my-max-height)", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "var(--my-max-height)" },
      ]);
    });
  });

  describe('min-width utilities', () => {
    it('min-w-4 → min-width: calc(var(--spacing) * 4)', () => {
      expect(applyClassName('min-w-4', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'calc(var(--spacing) * 4)' },
      ]);
    });
    it('min-w-1/2 → min-width: calc(1/2 * 100%)', () => {
      expect(applyClassName('min-w-1/2', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'calc(1/2 * 100%)' },
      ]);
    });
    it('min-w-auto → min-width: auto', () => {
      expect(applyClassName('min-w-auto', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'auto' },
      ]);
    });
    it('min-w-px → min-width: 1px', () => {
      expect(applyClassName('min-w-px', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: '1px' },
      ]);
    });
    it('min-w-full → min-width: 100%', () => {
      expect(applyClassName('min-w-full', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: '100%' },
      ]);
    });
    it('min-w-screen → min-width: 100vw', () => {
      expect(applyClassName('min-w-screen', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: '100vw' },
      ]);
    });
    it('min-w-3xs → min-width: var(--container-3xs)', () => {
      expect(applyClassName('min-w-3xs', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'var(--container-3xs)' },
      ]);
    });
    it('min-w-[32rem] → min-width: 32rem', () => {
      expect(applyClassName('min-w-[32rem]', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: '32rem' },
      ]);
    });
    it('min-w-(--my-min-width) → min-width: var(--my-min-width)', () => {
      expect(applyClassName('min-w-(--my-min-width)', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'var(--my-min-width)' },
      ]);
    });
  });

  describe("typography utilities", () => {
    // Font Family
    it("font-sans → font-family: var(--font-family-sans)", () => {
      expect(applyClassName("font-sans", ctx)).toEqual([
        { type: "decl", prop: "font-family", value: "var(--font-family-sans)" },
      ]);
    });
    it("font-serif → font-family: var(--font-family-serif)", () => {
      expect(applyClassName("font-serif", ctx)).toEqual([
        { type: "decl", prop: "font-family", value: "var(--font-family-serif)" },
      ]);
    });
    it("font-mono → font-family: var(--font-family-mono)", () => {
      expect(applyClassName("font-mono", ctx)).toEqual([
        { type: "decl", prop: "font-family", value: "var(--font-family-mono)" },
      ]);
    });
    it("font-[system-ui] → font-family: system-ui", () => {
      expect(applyClassName("font-[system-ui]", ctx)).toEqual([
        { type: "decl", prop: "font-family", value: "system-ui" },
      ]);
    });
    it("font-(font-name:--my-font) → font-family: var(--my-font)", () => {
      expect(applyClassName("font-(font-name:--my-font)", ctx)).toEqual([
        { type: "decl", prop: "font-family", value: "var(--my-font)" },
      ]);
    });

    // Font Size
    it("text-xs → font-size + line-height", () => {
      expect(applyClassName("text-xs", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-xs)" },
        { type: "decl", prop: "line-height", value: "var(--text-xs--line-height)" },
      ]);
    });
    it("text-sm → font-size + line-height", () => {
      expect(applyClassName("text-sm", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-sm)" },
        { type: "decl", prop: "line-height", value: "var(--text-sm--line-height)" },
      ]);
    });
    it("text-base → font-size + line-height", () => {
      expect(applyClassName("text-base", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-base)" },
        { type: "decl", prop: "line-height", value: "var(--text-base--line-height)" },
      ]);
    });
    it("text-lg → font-size + line-height", () => {
      expect(applyClassName("text-lg", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-lg)" },
        { type: "decl", prop: "line-height", value: "var(--text-lg--line-height)" },
      ]);
    });
    it("text-xl → font-size + line-height", () => {
      expect(applyClassName("text-xl", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-xl)" },
        { type: "decl", prop: "line-height", value: "var(--text-xl--line-height)" },
      ]);
    });
    it("text-2xl → font-size + line-height", () => {
      expect(applyClassName("text-2xl", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-2xl)" },
        { type: "decl", prop: "line-height", value: "var(--text-2xl--line-height)" },
      ]);
    });
    it("text-[14px] → font-size: 14px", () => {
      expect(applyClassName("text-[14px]", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "14px" },
      ]);
    });
    it("text-(--my-size) → font-size: var(--my-size)", () => {
      expect(applyClassName("text-(--my-size)", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--my-size)" },
      ]);
    });

    // Font Weight
    it("font-thin → font-weight: var(--font-weight-thin)", () => {
      expect(applyClassName("font-thin", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--font-weight-thin)" },
      ]);
    });
    it("font-normal → font-weight: var(--font-weight-normal)", () => {
      expect(applyClassName("font-normal", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--font-weight-normal)" },
      ]);
    });
    it("font-medium → font-weight: var(--font-weight-medium)", () => {
      expect(applyClassName("font-medium", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--font-weight-medium)" },
      ]);
    });
    it("font-semibold → font-weight: var(--font-weight-semibold)", () => {
      expect(applyClassName("font-semibold", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--font-weight-semibold)" },
      ]);
    });
    it("font-bold → font-weight: var(--font-weight-bold)", () => {
      expect(applyClassName("font-bold", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--font-weight-bold)" },
      ]);
    });
    it("font-black → font-weight: var(--font-weight-black)", () => {
      expect(applyClassName("font-black", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--font-weight-black)" },
      ]);
    });
    it("font-[450] → font-weight: 450", () => {
      expect(applyClassName("font-[450]", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "450" },
      ]);
    });
    it("font-(--my-weight) → font-weight: var(--my-weight)", () => {
      expect(applyClassName("font-(--my-weight)", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--my-weight)" },
      ]);
    });

    // Font Style
    it("italic → font-style: italic", () => {
      expect(applyClassName("italic", ctx)).toEqual([
        { type: "decl", prop: "font-style", value: "italic" },
      ]);
    });
    it("not-italic → font-style: normal", () => {
      expect(applyClassName("not-italic", ctx)).toEqual([
        { type: "decl", prop: "font-style", value: "normal" },
      ]);
    });

    // Letter Spacing
    it("tracking-tighter → letter-spacing: var(--letter-spacing-tighter)", () => {
      expect(applyClassName("tracking-tighter", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "var(--letter-spacing-tighter)" },
      ]);
    });
    it("tracking-tight → letter-spacing: var(--letter-spacing-tight)", () => {
      expect(applyClassName("tracking-tight", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "var(--letter-spacing-tight)" },
      ]);
    });
    it("tracking-normal → letter-spacing: var(--letter-spacing-normal)", () => {
      expect(applyClassName("tracking-normal", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "var(--letter-spacing-normal)" },
      ]);
    });
    it("tracking-wide → letter-spacing: var(--letter-spacing-wide)", () => {
      expect(applyClassName("tracking-wide", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "var(--letter-spacing-wide)" },
      ]);
    });
    it("tracking-wider → letter-spacing: var(--letter-spacing-wider)", () => {
      expect(applyClassName("tracking-wider", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "var(--letter-spacing-wider)" },
      ]);
    });
    it("tracking-widest → letter-spacing: var(--letter-spacing-widest)", () => {
      expect(applyClassName("tracking-widest", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "var(--letter-spacing-widest)" },
      ]);
    });
    it("tracking-[0.25em] → letter-spacing: 0.25em", () => {
      expect(applyClassName("tracking-[0.25em]", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "0.25em" },
      ]);
    });
    it("tracking-(--my-spacing) → letter-spacing: var(--my-spacing)", () => {
      expect(applyClassName("tracking-(--my-spacing)", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "var(--my-spacing)" },
      ]);
    });

    // Line Height
    it("leading-none → line-height: var(--line-height-none)", () => {
      expect(applyClassName("leading-none", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "var(--line-height-none)" },
      ]);
    });
    it("leading-tight → line-height: var(--line-height-tight)", () => {
      expect(applyClassName("leading-tight", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "var(--line-height-tight)" },
      ]);
    });
    it("leading-normal → line-height: var(--line-height-normal)", () => {
      expect(applyClassName("leading-normal", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "var(--line-height-normal)" },
      ]);
    });
    it("leading-relaxed → line-height: var(--line-height-relaxed)", () => {
      expect(applyClassName("leading-relaxed", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "var(--line-height-relaxed)" },
      ]);
    });
    it("leading-loose → line-height: var(--line-height-loose)", () => {
      expect(applyClassName("leading-loose", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "var(--line-height-loose)" },
      ]);
    });
    it("leading-[1.7] → line-height: 1.7", () => {
      expect(applyClassName("leading-[1.7]", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "1.7" },
      ]);
    });
    it("leading-(--my-leading) → line-height: var(--my-leading)", () => {
      expect(applyClassName("leading-(--my-leading)", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "var(--my-leading)" },
      ]);
    });

    // Text Align
    it("text-left → text-align: left", () => {
      expect(applyClassName("text-left", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "left" },
      ]);
    });
    it("text-center → text-align: center", () => {
      expect(applyClassName("text-center", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "center" },
      ]);
    });
    it("text-right → text-align: right", () => {
      expect(applyClassName("text-right", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "right" },
      ]);
    });
    it("text-justify → text-align: justify", () => {
      expect(applyClassName("text-justify", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "justify" },
      ]);
    });
    it("text-start → text-align: start", () => {
      expect(applyClassName("text-start", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "start" },
      ]);
    });
    it("text-end → text-align: end", () => {
      expect(applyClassName("text-end", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "end" },
      ]);
    });

    // Text Color
    it("text-inherit → color: inherit", () => {
      expect(applyClassName("text-inherit", ctx)).toEqual([
        { type: "decl", prop: "color", value: "inherit" },
      ]);
    });
    it("text-current → color: currentColor", () => {
      expect(applyClassName("text-current", ctx)).toEqual([
        { type: "decl", prop: "color", value: "currentColor" },
      ]);
    });
    it("text-transparent → color: transparent", () => {
      expect(applyClassName("text-transparent", ctx)).toEqual([
        { type: "decl", prop: "color", value: "transparent" },
      ]);
    });
    it("text-[#ff0000] → color: #ff0000", () => {
      expect(applyClassName("text-[#ff0000]", ctx)).toEqual([
        { type: "decl", prop: "color", value: "#ff0000" },
      ]);
    });
    it("text-(--my-font-size) → font-size: var(--my-font-size)", () => {
      expect(applyClassName("text-(--my-font-size)", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--my-font-size)" },
      ]);
    });

    // Text Transform
    it("uppercase → text-transform: uppercase", () => {
      expect(applyClassName("uppercase", ctx)).toEqual([
        { type: "decl", prop: "text-transform", value: "uppercase" },
      ]);
    });
    it("lowercase → text-transform: lowercase", () => {
      expect(applyClassName("lowercase", ctx)).toEqual([
        { type: "decl", prop: "text-transform", value: "lowercase" },
      ]);
    });
    it("capitalize → text-transform: capitalize", () => {
      expect(applyClassName("capitalize", ctx)).toEqual([
        { type: "decl", prop: "text-transform", value: "capitalize" },
      ]);
    });
    it("normal-case → text-transform: none", () => {
      expect(applyClassName("normal-case", ctx)).toEqual([
        { type: "decl", prop: "text-transform", value: "none" },
      ]);
    });

    // Text Decoration
    it("underline → text-decoration-line: underline", () => {
      expect(applyClassName("underline", ctx)).toEqual([
        { type: "decl", prop: "text-decoration-line", value: "underline" },
      ]);
    });
    it("overline → text-decoration-line: overline", () => {
      expect(applyClassName("overline", ctx)).toEqual([
        { type: "decl", prop: "text-decoration-line", value: "overline" },
      ]);
    });
    it("line-through → text-decoration-line: line-through", () => {
      expect(applyClassName("line-through", ctx)).toEqual([
        { type: "decl", prop: "text-decoration-line", value: "line-through" },
      ]);
    });
    it("no-underline → text-decoration-line: none", () => {
      expect(applyClassName("no-underline", ctx)).toEqual([
        { type: "decl", prop: "text-decoration-line", value: "none" },
      ]);
    });

    // Text Overflow
    it("truncate → overflow + text-overflow + white-space", () => {
      expect(applyClassName("truncate", ctx)).toEqual([
        { type: "decl", prop: "overflow", value: "hidden" },
        { type: "decl", prop: "text-overflow", value: "ellipsis" },
        { type: "decl", prop: "white-space", value: "nowrap" },
      ]);
    });
    it("text-ellipsis → text-overflow: ellipsis", () => {
      expect(applyClassName("text-ellipsis", ctx)).toEqual([
        { type: "decl", prop: "text-overflow", value: "ellipsis" },
      ]);
    });
    it("text-clip → text-overflow: clip", () => {
      expect(applyClassName("text-clip", ctx)).toEqual([
        { type: "decl", prop: "text-overflow", value: "clip" },
      ]);
    });

    // Whitespace
    it("whitespace-normal → white-space: normal", () => {
      expect(applyClassName("whitespace-normal", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "normal" },
      ]);
    });
    it("whitespace-nowrap → white-space: nowrap", () => {
      expect(applyClassName("whitespace-nowrap", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "nowrap" },
      ]);
    });
    it("whitespace-pre → white-space: pre", () => {
      expect(applyClassName("whitespace-pre", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "pre" },
      ]);
    });
    it("whitespace-pre-line → white-space: pre-line", () => {
      expect(applyClassName("whitespace-pre-line", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "pre-line" },
      ]);
    });
    it("whitespace-pre-wrap → white-space: pre-wrap", () => {
      expect(applyClassName("whitespace-pre-wrap", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "pre-wrap" },
      ]);
    });
    it("whitespace-break-spaces → white-space: break-spaces", () => {
      expect(applyClassName("whitespace-break-spaces", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "break-spaces" },
      ]);
    });

    // Word Break
    it("break-normal → overflow-wrap + word-break", () => {
      expect(applyClassName("break-normal", ctx)).toEqual([
        { type: "decl", prop: "overflow-wrap", value: "normal" },
        { type: "decl", prop: "word-break", value: "normal" },
      ]);
    });
    it("break-words → overflow-wrap: break-word", () => {
      expect(applyClassName("break-words", ctx)).toEqual([
        { type: "decl", prop: "overflow-wrap", value: "break-word" },
      ]);
    });
    it("break-all → word-break: break-all", () => {
      expect(applyClassName("break-all", ctx)).toEqual([
        { type: "decl", prop: "word-break", value: "break-all" },
      ]);
    });
    it("break-keep → word-break: keep-all", () => {
      expect(applyClassName("break-keep", ctx)).toEqual([
        { type: "decl", prop: "word-break", value: "keep-all" },
      ]);
    });
  });
});
