import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import {
  parseNumber,
  parseFraction,
  parseArbitraryValue,
  parseVar,
} from "../core/utils";

// --- Layout: Isolation ---
staticUtility("isolate", [["isolation", "isolate"]]);
staticUtility("isolation-auto", [["isolation", "auto"]]);

// --- Layout: Z-Index ---
staticUtility("z-auto", [["z-index", "auto"]]);
functionalUtility({
  name: "z",
  prop: "z-index",
  themeKey: "zIndex",
  supportsNegative: true,
  supportsArbitrary: true, // z-[999], z-[calc(var(--index)+1)] 등 지원
  supportsCustomProperty: true, // z-(--my-z) supported
  // but actual theme lookup is handled in ctx.theme
  handleBareValue: ({ value }) => parseNumber(value), // only allow integers
  description: "z-index utility",
  category: "layout",
});

// --- Layout: Aspect Ratio ---
staticUtility("aspect-square", [["aspect-ratio", "1 / 1"]]);
staticUtility("aspect-video", [["aspect-ratio", "var(--aspect-ratio-video)"]]);
staticUtility("aspect-auto", [["aspect-ratio", "auto"]]);
functionalUtility({
  name: "aspect",
  prop: "aspect-ratio",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  description:
    "aspect-ratio utility (theme, arbitrary, custom property, fraction supported)",
  category: "layout",
});

// --- Layout: Columns ---
staticUtility("columns-auto", [["columns", "auto"]]);
staticUtility("columns-3xs", [["columns", "var(--container-3xs)"]]);
staticUtility("columns-2xs", [["columns", "var(--container-2xs)"]]);
staticUtility("columns-xs", [["columns", "var(--container-xs)"]]);
staticUtility("columns-sm", [["columns", "var(--container-sm)"]]);
staticUtility("columns-md", [["columns", "var(--container-md)"]]);
staticUtility("columns-lg", [["columns", "var(--container-lg)"]]);
staticUtility("columns-xl", [["columns", "var(--container-xl)"]]);
staticUtility("columns-2xl", [["columns", "var(--container-2xl)"]]);
staticUtility("columns-3xl", [["columns", "var(--container-3xl)"]]);
staticUtility("columns-4xl", [["columns", "var(--container-4xl)"]]);
staticUtility("columns-5xl", [["columns", "var(--container-5xl)"]]);
staticUtility("columns-6xl", [["columns", "var(--container-6xl)"]]);
staticUtility("columns-7xl", [["columns", "var(--container-7xl)"]]);
functionalUtility({
  name: "columns",
  prop: "columns",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => parseNumber(value),
  description:
    "columns utility (theme, arbitrary, custom property, fraction supported)",
  category: "layout",
});

// --- Layout: Break After ---
staticUtility("break-after-auto", [["break-after", "auto"]]);
staticUtility("break-after-avoid", [["break-after", "avoid"]]);
staticUtility("break-after-all", [["break-after", "all"]]);
staticUtility("break-after-avoid-page", [["break-after", "avoid-page"]]);
staticUtility("break-after-page", [["break-after", "page"]]);
staticUtility("break-after-left", [["break-after", "left"]]);
staticUtility("break-after-right", [["break-after", "right"]]);
staticUtility("break-after-column", [["break-after", "column"]]);

// --- Layout: Break Before ---
staticUtility("break-before-auto", [["break-before", "auto"]]);
staticUtility("break-before-avoid", [["break-before", "avoid"]]);
staticUtility("break-before-all", [["break-before", "all"]]);
staticUtility("break-before-avoid-page", [["break-before", "avoid-page"]]);
staticUtility("break-before-page", [["break-before", "page"]]);
staticUtility("break-before-left", [["break-before", "left"]]);
staticUtility("break-before-right", [["break-before", "right"]]);
staticUtility("break-before-column", [["break-before", "column"]]);

// --- Layout: Break Inside ---
staticUtility("break-inside-auto", [["break-inside", "auto"]]);
staticUtility("break-inside-avoid", [["break-inside", "avoid"]]);
staticUtility("break-inside-avoid-page", [["break-inside", "avoid-page"]]);
staticUtility("break-inside-avoid-column", [["break-inside", "avoid-column"]]);

// --- Layout: Box Decoration Break ---
staticUtility("box-decoration-slice", [["box-decoration-break", "slice"]]);
staticUtility("box-decoration-clone", [["box-decoration-break", "clone"]]);

// --- Layout: Box Sizing ---
staticUtility("box-border", [["box-sizing", "border-box"]]);
staticUtility("box-content", [["box-sizing", "content-box"]]);

// --- Layout: Display ---
staticUtility("block", [["display", "block"]]);
staticUtility("inline", [["display", "inline"]]);
staticUtility("inline-block", [["display", "inline-block"]]);
staticUtility("flow-root", [["display", "flow-root"]]);
staticUtility("flex", [["display", "flex"]]);
staticUtility("inline-flex", [["display", "inline-flex"]]);
staticUtility("grid", [["display", "grid"]]);
staticUtility("inline-grid", [["display", "inline-grid"]]);
staticUtility("contents", [["display", "contents"]]);
staticUtility("table", [["display", "table"]]);
staticUtility("inline-table", [["display", "inline-table"]]);
staticUtility("table-caption", [["display", "table-caption"]]);
staticUtility("table-cell", [["display", "table-cell"]]);
staticUtility("table-column", [["display", "table-column"]]);
staticUtility("table-column-group", [["display", "table-column-group"]]);
staticUtility("table-footer-group", [["display", "table-footer-group"]]);
staticUtility("table-header-group", [["display", "table-header-group"]]);
staticUtility("table-row-group", [["display", "table-row-group"]]);
staticUtility("table-row", [["display", "table-row"]]);
staticUtility("list-item", [["display", "list-item"]]);
staticUtility("hidden", [["display", "none"]]);

// --- Layout: Float ---
staticUtility("float-right", [["float", "right"]]);
staticUtility("float-left", [["float", "left"]]);
staticUtility("float-start", [["float", "inline-start"]]);
staticUtility("float-end", [["float", "inline-end"]]);
staticUtility("float-none", [["float", "none"]]);

// --- Layout: Clear ---
staticUtility("clear-left", [["clear", "left"]]);
staticUtility("clear-right", [["clear", "right"]]);
staticUtility("clear-both", [["clear", "both"]]);
staticUtility("clear-start", [["clear", "inline-start"]]);
staticUtility("clear-end", [["clear", "inline-end"]]);
staticUtility("clear-none", [["clear", "none"]]);

// --- Layout: Object Fit ---
staticUtility("object-contain", [["object-fit", "contain"]]);
staticUtility("object-cover", [["object-fit", "cover"]]);
staticUtility("object-fill", [["object-fit", "fill"]]);
staticUtility("object-none", [["object-fit", "none"]]);
staticUtility("object-scale-down", [["object-fit", "scale-down"]]);

// --- Layout: Object Position ---
staticUtility("object-top-left", [["object-position", "top left"]]);
staticUtility("object-top", [["object-position", "top"]]);
staticUtility("object-top-right", [["object-position", "top right"]]);
staticUtility("object-left", [["object-position", "left"]]);
staticUtility("object-center", [["object-position", "center"]]);
staticUtility("object-right", [["object-position", "right"]]);
staticUtility("object-bottom-left", [["object-position", "bottom left"]]);
staticUtility("object-bottom", [["object-position", "bottom"]]);
staticUtility("object-bottom-right", [["object-position", "bottom right"]]);

functionalUtility({
  name: "object",
  prop: "object-position",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description:
    "object-position utility (arbitrary value, custom property supported)",
  category: "layout",
});

// --- Layout: Overflow ---
staticUtility("overflow-auto", [["overflow", "auto"]]);
staticUtility("overflow-hidden", [["overflow", "hidden"]]);
staticUtility("overflow-clip", [["overflow", "clip"]]);
staticUtility("overflow-visible", [["overflow", "visible"]]);
staticUtility("overflow-scroll", [["overflow", "scroll"]]);
staticUtility("overflow-x-auto", [["overflow-x", "auto"]]);
staticUtility("overflow-y-auto", [["overflow-y", "auto"]]);
staticUtility("overflow-x-hidden", [["overflow-x", "hidden"]]);
staticUtility("overflow-y-hidden", [["overflow-y", "hidden"]]);
staticUtility("overflow-x-clip", [["overflow-x", "clip"]]);
staticUtility("overflow-y-clip", [["overflow-y", "clip"]]);
staticUtility("overflow-x-visible", [["overflow-x", "visible"]]);
staticUtility("overflow-y-visible", [["overflow-y", "visible"]]);
staticUtility("overflow-x-scroll", [["overflow-x", "scroll"]]);
staticUtility("overflow-y-scroll", [["overflow-y", "scroll"]]);

// --- Layout: Overscroll Behavior ---
staticUtility("overscroll-auto", [["overscroll-behavior", "auto"]]);
staticUtility("overscroll-contain", [["overscroll-behavior", "contain"]]);
staticUtility("overscroll-none", [["overscroll-behavior", "none"]]);
staticUtility("overscroll-x-auto", [["overscroll-behavior-x", "auto"]]);
staticUtility("overscroll-x-contain", [["overscroll-behavior-x", "contain"]]);
staticUtility("overscroll-x-none", [["overscroll-behavior-x", "none"]]);
staticUtility("overscroll-y-auto", [["overscroll-behavior-y", "auto"]]);
staticUtility("overscroll-y-contain", [["overscroll-behavior-y", "contain"]]);
staticUtility("overscroll-y-none", [["overscroll-behavior-y", "none"]]);

// --- Layout: Position ---
staticUtility("static", [["position", "static"]]);
staticUtility("fixed", [["position", "fixed"]]);
staticUtility("absolute", [["position", "absolute"]]);
staticUtility("relative", [["position", "relative"]]);
staticUtility("sticky", [["position", "sticky"]]);

// --- Layout: Inset/Top/Right/Bottom/Left ---
[
  ["inset-x", "inset-inline"],
  ["inset-y", "inset-block"],
  ["inset", "inset"],
  ["start", "inset-inline-start"],
  ["end", "inset-inline-end"],
  ["top", "top"],
  ["right", "right"],
  ["bottom", "bottom"],
  ["left", "left"],
].forEach(([name, prop]) => {
  // inset
  staticUtility(`${name}-auto`, [[prop, "auto"]]);
  staticUtility(`${name}-full`, [[prop, "100%"]]);
  staticUtility(`-${name}-full`, [[prop, "-100%"]]);
  staticUtility(`${name}-px`, [[prop, "1px"]]);
  staticUtility(`-${name}-px`, [[prop, "-1px"]]);
  functionalUtility({
    name: name,
    prop: prop,
    supportsNegative: true,
    supportsFraction: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => {
      if (parseNumber(value)) {
        return `calc(var(--spacing) * ${value})`;
      }
      const frac = parseFraction(value);
      if (frac) return frac;
      return null;
    },
    handleNegativeBareValue: ({ value }) => {
      if (parseNumber(value)) {
        return `calc(var(--spacing) * -${value})`;
      }
      const frac = parseFraction(value);
      if (frac) return `-${frac}`;
      return null;
    },
    description: `${name} utility (spacing, fraction, px, full, auto, custom property, arbitrary, negative 지원)`,
    category: "layout",
  });
});

// --- Layout: Visibility ---
staticUtility("visible", [["visibility", "visible"]]);
staticUtility("invisible", [["visibility", "hidden"]]);
staticUtility("collapse", [["visibility", "collapse"]]);

// --- Layout: Gap ---
functionalUtility({
  name: "gap-x",
  prop: "column-gap",
  supportsArbitrary: true, // gap-x-[10vw]
  supportsCustomProperty: true, // gap-x-(--my-gap-x)
  handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
  handle: (value) => {
    if (typeof value === "string") return [decl("column-gap", value)];
    return null;
  },
  handleCustomProperty: (value) => [decl("column-gap", `var(${value})`)],
  description: "gap-x utility (number, arbitrary, custom property supported)",
  category: "layout",
});
functionalUtility({
  name: "gap-y",
  prop: "row-gap",
  supportsArbitrary: true, // gap-y-[10vw]
  supportsCustomProperty: true, // gap-y-(--my-gap-y)
  handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
  handle: (value) => {
    if (typeof value === "string") return [decl("row-gap", value)];
    return null;
  },
  handleCustomProperty: (value) => [decl("row-gap", `var(${value})`)],
  description: "gap-y utility (number, arbitrary, custom property supported)",
  category: "layout",
});
functionalUtility({
  name: "gap",
  prop: "gap",
  supportsArbitrary: true, // gap-[10vw]
  supportsCustomProperty: true, // gap-(--my-gap)
  handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
  handle: (value) => {
    if (typeof value === "string") return [decl("gap", value)];
    return null;
  },
  handleCustomProperty: (value) => [decl("gap", `var(${value})`)],
  description: "gap utility (number, arbitrary, custom property supported)",
  category: "layout",
});
