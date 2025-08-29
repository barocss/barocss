import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import {
  parseNumber,
  parseFraction,
  parseArbitraryValue,
  parseVar,
} from "../core/utils";

// --- Layout: Isolation ---
staticUtility("isolate", [["isolation", "isolate"]], { category: 'layout' });
staticUtility("isolation-auto", [["isolation", "auto"]], { category: 'layout' });

// --- Layout: Z-Index ---
staticUtility("z-auto", [["z-index", "auto"]], { category: 'layout' });
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
staticUtility("aspect-square", [["aspect-ratio", "1 / 1"]], { category: 'layout' });
staticUtility("aspect-video", [["aspect-ratio", "var(--aspect-ratio-video)"]], { category: 'layout' });
staticUtility("aspect-auto", [["aspect-ratio", "auto"]], { category: 'layout' });
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
staticUtility("columns-auto", [["columns", "auto"]], { category: 'layout' });
staticUtility("columns-3xs", [["columns", "var(--container-3xs)"]], { category: 'layout' });
staticUtility("columns-2xs", [["columns", "var(--container-2xs)"]], { category: 'layout' });
staticUtility("columns-xs", [["columns", "var(--container-xs)"]], { category: 'layout' });
staticUtility("columns-sm", [["columns", "var(--container-sm)"]], { category: 'layout' });
staticUtility("columns-md", [["columns", "var(--container-md)"]], { category: 'layout' });
staticUtility("columns-lg", [["columns", "var(--container-lg)"]], { category: 'layout' });
staticUtility("columns-xl", [["columns", "var(--container-xl)"]], { category: 'layout' });
staticUtility("columns-2xl", [["columns", "var(--container-2xl)"]], { category: 'layout' });
staticUtility("columns-3xl", [["columns", "var(--container-3xl)"]], { category: 'layout' });
staticUtility("columns-4xl", [["columns", "var(--container-4xl)"]], { category: 'layout' });
staticUtility("columns-5xl", [["columns", "var(--container-5xl)"]], { category: 'layout' });
staticUtility("columns-6xl", [["columns", "var(--container-6xl)"]], { category: 'layout' });
staticUtility("columns-7xl", [["columns", "var(--container-7xl)"]], { category: 'layout' });
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
staticUtility("break-after-auto", [["break-after", "auto"]], { category: 'layout' });
staticUtility("break-after-avoid", [["break-after", "avoid"]], { category: 'layout' });
staticUtility("break-after-all", [["break-after", "all"]], { category: 'layout' });
staticUtility("break-after-avoid-page", [["break-after", "avoid-page"]], { category: 'layout' });
staticUtility("break-after-page", [["break-after", "page"]], { category: 'layout' });
staticUtility("break-after-left", [["break-after", "left"]], { category: 'layout' });
staticUtility("break-after-right", [["break-after", "right"]], { category: 'layout' });
staticUtility("break-after-column", [["break-after", "column"]], { category: 'layout' });

// --- Layout: Break Before ---
staticUtility("break-before-auto", [["break-before", "auto"]], { category: 'layout' });
staticUtility("break-before-avoid", [["break-before", "avoid"]], { category: 'layout' });
staticUtility("break-before-all", [["break-before", "all"]], { category: 'layout' });
staticUtility("break-before-avoid-page", [["break-before", "avoid-page"]], { category: 'layout' });
staticUtility("break-before-page", [["break-before", "page"]], { category: 'layout' });
staticUtility("break-before-left", [["break-before", "left"]], { category: 'layout' });
staticUtility("break-before-right", [["break-before", "right"]], { category: 'layout' });
staticUtility("break-before-column", [["break-before", "column"]], { category: 'layout' });

// --- Layout: Break Inside ---
staticUtility("break-inside-auto", [["break-inside", "auto"]], { category: 'layout' });
staticUtility("break-inside-avoid", [["break-inside", "avoid"]], { category: 'layout' });
staticUtility("break-inside-avoid-page", [["break-inside", "avoid-page"]], { category: 'layout' });
staticUtility("break-inside-avoid-column", [["break-inside", "avoid-column"]], { category: 'layout' });

// --- Layout: Box Decoration Break ---
staticUtility("box-decoration-slice", [["box-decoration-break", "slice"]], { category: 'layout' });
staticUtility("box-decoration-clone", [["box-decoration-break", "clone"]], { category: 'layout' });

// --- Layout: Box Sizing ---
  staticUtility("box-border", [["box-sizing", "border-box"]], { category: 'layout' });
staticUtility("box-content", [["box-sizing", "content-box"]], { category: 'layout' });

// --- Layout: Display ---
staticUtility("block", [["display", "block"]], { category: 'layout' });
staticUtility("inline", [["display", "inline"]], { category: 'layout' });
staticUtility("inline-block", [["display", "inline-block"]], { category: 'layout' });
staticUtility("flow-root", [["display", "flow-root"]], { category: 'layout' });
staticUtility("flex", [["display", "flex"]], { category: 'layout' });
staticUtility("inline-flex", [["display", "inline-flex"]], { category: 'layout' });
staticUtility("grid", [["display", "grid"]], { category: 'layout' });
staticUtility("inline-grid", [["display", "inline-grid"]], { category: 'layout' });
staticUtility("contents", [["display", "contents"]], { category: 'layout' });
staticUtility("table", [["display", "table"]], { category: 'layout' });
staticUtility("inline-table", [["display", "inline-table"]], { category: 'layout' });
staticUtility("table-caption", [["display", "table-caption"]], { category: 'layout' });
staticUtility("table-cell", [["display", "table-cell"]], { category: 'layout' });
staticUtility("table-column", [["display", "table-column"]], { category: 'layout' });
staticUtility("table-column-group", [["display", "table-column-group"]], { category: 'layout' });
staticUtility("table-footer-group", [["display", "table-footer-group"]], { category: 'layout' });
staticUtility("table-header-group", [["display", "table-header-group"]], { category: 'layout' });
staticUtility("table-row-group", [["display", "table-row-group"]], { category: 'layout' });
staticUtility("table-row", [["display", "table-row"]], { category: 'layout' });
staticUtility("list-item", [["display", "list-item"]], { category: 'layout' });
staticUtility("hidden", [["display", "none"]], { category: 'layout' });

// --- Layout: Float ---
staticUtility("float-right", [["float", "right"]], { category: 'layout' });
staticUtility("float-left", [["float", "left"]], { category: 'layout' });
staticUtility("float-start", [["float", "inline-start"]], { category: 'layout' });
staticUtility("float-end", [["float", "inline-end"]], { category: 'layout' });
staticUtility("float-none", [["float", "none"]], { category: 'layout' });

// --- Layout: Clear ---
staticUtility("clear-left", [["clear", "left"]], { category: 'layout' });
staticUtility("clear-right", [["clear", "right"]], { category: 'layout' });
staticUtility("clear-both", [["clear", "both"]], { category: 'layout' });
staticUtility("clear-start", [["clear", "inline-start"]], { category: 'layout' });
staticUtility("clear-end", [["clear", "inline-end"]], { category: 'layout' });
staticUtility("clear-none", [["clear", "none"]], { category: 'layout' });

// --- Layout: Object Fit ---
staticUtility("object-contain", [["object-fit", "contain"]], { category: 'layout' });
staticUtility("object-cover", [["object-fit", "cover"]], { category: 'layout' });
staticUtility("object-fill", [["object-fit", "fill"]], { category: 'layout' });
staticUtility("object-none", [["object-fit", "none"]], { category: 'layout' });
staticUtility("object-scale-down", [["object-fit", "scale-down"]], { category: 'layout' });

// --- Layout: Object Position ---
staticUtility("object-top-left", [["object-position", "top left"]], { category: 'layout' });
staticUtility("object-top", [["object-position", "top"]], { category: 'layout' });
staticUtility("object-top-right", [["object-position", "top right"]], { category: 'layout' });
staticUtility("object-left", [["object-position", "left"]], { category: 'layout' });
staticUtility("object-center", [["object-position", "center"]], { category: 'layout' });
staticUtility("object-right", [["object-position", "right"]], { category: 'layout' });
staticUtility("object-bottom-left", [["object-position", "bottom left"]], { category: 'layout' });
staticUtility("object-bottom", [["object-position", "bottom"]], { category: 'layout' });
staticUtility("object-bottom-right", [["object-position", "bottom right"]], { category: 'layout' });

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
  staticUtility("overflow-auto", [["overflow", "auto"]], { category: 'layout' });
staticUtility("overflow-hidden", [["overflow", "hidden"]], { category: 'layout' });
staticUtility("overflow-clip", [["overflow", "clip"]], { category: 'layout' });
staticUtility("overflow-visible", [["overflow", "visible"]], { category: 'layout' });
staticUtility("overflow-scroll", [["overflow", "scroll"]], { category: 'layout' });
staticUtility("overflow-x-auto", [["overflow-x", "auto"]], { category: 'layout' });
staticUtility("overflow-y-auto", [["overflow-y", "auto"]], { category: 'layout' });
staticUtility("overflow-x-hidden", [["overflow-x", "hidden"]], { category: 'layout' });
staticUtility("overflow-y-hidden", [["overflow-y", "hidden"]], { category: 'layout' });
staticUtility("overflow-x-clip", [["overflow-x", "clip"]], { category: 'layout' });
staticUtility("overflow-y-clip", [["overflow-y", "clip"]], { category: 'layout' });
staticUtility("overflow-x-visible", [["overflow-x", "visible"]], { category: 'layout' });
staticUtility("overflow-y-visible", [["overflow-y", "visible"]], { category: 'layout' });
staticUtility("overflow-x-scroll", [["overflow-x", "scroll"]], { category: 'layout' });
staticUtility("overflow-y-scroll", [["overflow-y", "scroll"]], { category: 'layout' });

// --- Layout: Overscroll Behavior ---
staticUtility("overscroll-auto", [["overscroll-behavior", "auto"]], { category: 'layout' });
staticUtility("overscroll-contain", [["overscroll-behavior", "contain"]], { category: 'layout' });
staticUtility("overscroll-none", [["overscroll-behavior", "none"]], { category: 'layout' });
staticUtility("overscroll-x-auto", [["overscroll-behavior-x", "auto"]], { category: 'layout' });
staticUtility("overscroll-x-contain", [["overscroll-behavior-x", "contain"]], { category: 'layout' });
staticUtility("overscroll-x-none", [["overscroll-behavior-x", "none"]], { category: 'layout' });
staticUtility("overscroll-y-auto", [["overscroll-behavior-y", "auto"]], { category: 'layout' });
staticUtility("overscroll-y-contain", [["overscroll-behavior-y", "contain"]], { category: 'layout' });
staticUtility("overscroll-y-none", [["overscroll-behavior-y", "none"]], { category: 'layout' });

// --- Layout: Position ---
staticUtility("static", [["position", "static"]], { category: 'layout' });
staticUtility("fixed", [["position", "fixed"]], { category: 'layout' });
staticUtility("absolute", [["position", "absolute"]], { category: 'layout' });
staticUtility("relative", [["position", "relative"]], { category: 'layout' });
staticUtility("sticky", [["position", "sticky"]], { category: 'layout' });

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
  staticUtility(`${name}-auto`, [[prop, "auto"]], { category: 'layout' });
  staticUtility(`${name}-full`, [[prop, "100%"]], { category: 'layout' });
  staticUtility(`-${name}-full`, [[prop, "-100%"]], { category: 'layout' });
  staticUtility(`${name}-px`, [[prop, "1px"]], { category: 'layout' });
  staticUtility(`-${name}-px`, [[prop, "-1px"]], { category: 'layout' });
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
    description: `${name} utility (spacing, fraction, px, full, auto, custom property, arbitrary, negative supported)`,
    category: "layout",
  });
});

// --- Layout: Visibility ---
staticUtility("visible", [["visibility", "visible"]], { category: 'layout' });
staticUtility("invisible", [["visibility", "hidden"]], { category: 'layout' });
staticUtility("collapse", [["visibility", "collapse"]], { category: 'layout' });

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
