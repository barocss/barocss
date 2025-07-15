import { staticUtility, functionalUtility } from "../core/registry";
import { decl, rule } from "../core/ast";
import {
  parseFractionOrNumber,
  parseNumber,
  parseFraction,
  parseNegative,
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
  supportsNegative: true,
  supportsArbitrary: true, // z-[999], z-[calc(var(--index)+1)] 등 지원
  supportsCustomProperty: true, // z-(--my-z) 지원
  // Tailwind는 themeKey: 'zIndex'이나, 실제 theme lookup은 ctx.theme에서 처리됨
  handleBareValue: ({ value }) => parseNumber(value), // 정수만 허용
  handle: (value) => [decl("z-index", value)],
  description: "z-index utility (Tailwind CSS 호환)",
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
    "aspect-ratio utility (theme, arbitrary, custom property, fraction 지원)",
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
    "columns utility (theme, arbitrary, custom property, fraction 지원)",
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
    "object-position utility (arbitrary value, custom property 지원)",
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

// --- Layout: z-index ---
staticUtility("z-auto", [["z-index", "auto"]]);
functionalUtility({
  name: "z",
  prop: "z-index",
  supportsFraction: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "z-index utility (fraction, arbitrary, custom property 지원)",
  category: "layout",
});

// --- Flexbox & Grid: flex-basis ---
staticUtility("basis-full", [["flex-basis", "100%"]]);
staticUtility("basis-auto", [["flex-basis", "auto"]]);
staticUtility("basis-3xs", [["flex-basis", "var(--container-3xs)"]]);
staticUtility("basis-2xs", [["flex-basis", "var(--container-2xs)"]]);
staticUtility("basis-xs", [["flex-basis", "var(--container-xs)"]]);
staticUtility("basis-sm", [["flex-basis", "var(--container-sm)"]]);
staticUtility("basis-md", [["flex-basis", "var(--container-md)"]]);
staticUtility("basis-lg", [["flex-basis", "var(--container-lg)"]]);
staticUtility("basis-xl", [["flex-basis", "var(--container-xl)"]]);
staticUtility("basis-2xl", [["flex-basis", "var(--container-2xl)"]]);
staticUtility("basis-3xl", [["flex-basis", "var(--container-3xl)"]]);
staticUtility("basis-4xl", [["flex-basis", "var(--container-4xl)"]]);
staticUtility("basis-5xl", [["flex-basis", "var(--container-5xl)"]]);
staticUtility("basis-6xl", [["flex-basis", "var(--container-6xl)"]]);
staticUtility("basis-7xl", [["flex-basis", "var(--container-7xl)"]]);
functionalUtility({
  name: "basis",
  prop: "flex-basis",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsFraction: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--container-${value}) * 1px)`;
    }
    const frac = parseFraction(value);
    if (frac) return frac;
    return null;
  },
  handleNegativeBareValue: ({ value }) => {
    if (parseNumber(value)) {
      return `calc(var(--container-${value}) * -1px)`;
    }
    const frac = parseFraction(value);
    if (frac) return `-${frac}`;
    return null;
  },
  description:
    "flex-basis utility (theme, arbitrary, custom property, fraction 지원)",
  category: "layout",
});

// --- Flexbox & Grid: flex-direction ---
staticUtility("flex-row", [["flex-direction", "row"]]);
staticUtility("flex-row-reverse", [["flex-direction", "row-reverse"]]);
staticUtility("flex-col", [["flex-direction", "column"]]);
staticUtility("flex-col-reverse", [["flex-direction", "column-reverse"]]);

// --- Flexbox & Grid: flex-wrap ---
staticUtility("flex-wrap", [["flex-wrap", "wrap"]]);
staticUtility("flex-wrap-reverse", [["flex-wrap", "wrap-reverse"]]);
staticUtility("flex-nowrap", [["flex-wrap", "nowrap"]]);

// --- Flexbox & Grid: Flex ---
staticUtility("flex-auto", [["flex", "1 1 auto"]]);
staticUtility("flex-initial", [["flex", "0 1 auto"]]);
staticUtility("flex-none", [["flex", "none"]]);

functionalUtility({
  name: "flex",
  supportsArbitrary: true, // flex-[3_1_auto], flex-[2], flex-[0_0_100%] 등
  supportsCustomProperty: true, // flex-(--my-flex)
  supportsFraction: true, // flex-1/2 → flex: 50%;
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) return value;
    const frac = parseFraction(value);
    if (frac) return `calc(${frac})`;
    return null;
  },
  handle: (value) => [decl("flex", value)],
  description:
    "flex shorthand utility (number, fraction, arbitrary, custom property 지원)",
  category: "flex",
});

// --- Flexbox & Grid: Flex Grow ---
staticUtility("grow", [["flex-grow", "1"]]);

functionalUtility({
  name: "grow",
  prop: "flex-grow",
  supportsArbitrary: true, // grow-[25vw], grow-[2], grow-[var(--factor)] 등
  supportsCustomProperty: true, // grow-(--my-grow)
  handleBareValue: ({ value }) => parseNumber(value),
  handle: (value) => [decl("flex-grow", value)],
  description: "flex-grow utility (number, arbitrary, custom property 지원)",
  category: "flex",
});

// --- Flexbox & Grid: Flex Shrink ---
staticUtility("shrink", [["flex-shrink", "1"]]);
staticUtility("shrink-0", [["flex-shrink", "0"]]);

functionalUtility({
  name: "shrink",
  prop: "flex-shrink",
  supportsArbitrary: true, // shrink-[2], shrink-[calc(100vw-var(--sidebar))] 등
  supportsCustomProperty: true, // shrink-(--my-shrink)
  handleBareValue: ({ value }) => parseNumber(value),
  description: "flex-shrink utility (number, arbitrary, custom property 지원)",
  category: "flex",
});

// --- Flexbox & Grid: Order ---
staticUtility("order-first", [["order", "calc(-infinity)"]]);
staticUtility("order-last", [["order", "calc(infinity)"]]);
staticUtility("order-none", [["order", "0"]]);

functionalUtility({
  name: "order",
  prop: "order",
  supportsNegative: true, // -order-1 → order: calc(1 * -1)
  supportsArbitrary: true, // order-[min(var(--total-items),10)] 등
  supportsCustomProperty: true, // order-(--my-order)
  handleBareValue: ({ value }) => parseNumber(value),
  handleNegativeBareValue: ({ value }) => {
    if (parseNumber(value)) return `calc(${value} * -1)`;
    return null;
  },
  description:
    "order utility (number, negative, arbitrary, custom property 지원)",
  category: "flex",
});

// --- Flexbox & Grid: Grid Template Columns ---
staticUtility("grid-cols-none", [["grid-template-columns", "none"]]);
staticUtility("grid-cols-subgrid", [["grid-template-columns", "subgrid"]]);

functionalUtility({
  name: "grid-cols",
  prop: "grid-template-columns",
  supportsArbitrary: true, // grid-cols-[200px_minmax(900px,_1fr)_100px] 등
  supportsCustomProperty: true, // grid-cols-(--my-grid-cols)
  handleBareValue: ({ value }) =>
    parseFractionOrNumber(value, { repeat: true }),
  description:
    "grid-template-columns utility (number, arbitrary, custom property 지원)",
  category: "grid",
});

// --- Flexbox & Grid: Grid Template Rows ---
staticUtility("grid-rows-none", [["grid-template-rows", "none"]]);
staticUtility("grid-rows-subgrid", [["grid-template-rows", "subgrid"]]);

functionalUtility({
  name: "grid-rows",
  prop: "grid-template-rows",
  supportsArbitrary: true, // grid-rows-[200px_minmax(900px,_1fr)_100px] 등
  supportsCustomProperty: true, // grid-rows-(--my-grid-rows)
  handleBareValue: ({ value }) =>
    parseFractionOrNumber(value, { repeat: true }),
  handle: (value) => {
    // Tailwind arbitrary: grid-rows-[200px_minmax(900px,_1fr)_100px]
    // Just output as-is (spaces instead of underscores)
    if (typeof value === "string") {
      return [decl("grid-template-rows", value.replace(/_/g, " "))];
    }
    return null;
  },
  handleCustomProperty: (value) => [
    decl("grid-template-rows", `var(${value})`),
  ],
  description:
    "grid-template-rows utility (number, arbitrary, custom property 지원)",
  category: "grid",
});

// --- Flexbox & Grid: Grid Row ---
// row-span utilities
staticUtility("row-span-full", [["grid-row", "1 / -1"]]);
functionalUtility({
  name: "row-span",
  prop: "grid-row",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) return `span ${value} / span ${value}`;
    return null;
  },
  handleCustomProperty: (value) => [
    decl("grid-row", `span var(${value}) / span var(${value})`),
  ],
  handle: (value) => {
    if (parseNumber(value))
      return [decl("grid-row", `span ${value} / span ${value}`)];
    // arbitrary value: row-span-[5] → span 5 / span 5
    return null;
  },
  description:
    "grid-row span utility (number, arbitrary, custom property 지원)",
  category: "grid",
});
// row-start utilities
staticUtility("row-start-auto", [["grid-row-start", "auto"]]);
functionalUtility({
  name: "row-start",
  prop: "grid-row-start",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => parseNumber(value),
  handleNegativeBareValue: ({ value }) => {
    if (parseNumber(value)) return `calc(${value} * -1)`;
    return null;
  },
  handleCustomProperty: (value) => [decl("grid-row-start", `var(${value})`)],
  handle: (value) => {
    if (parseNumber(value)) return [decl("grid-row-start", value)];
    if (typeof value === "string") return [decl("grid-row-start", value)];
    return null;
  },
  description:
    "grid-row-start utility (number, negative, arbitrary, custom property 지원)",
  category: "grid",
});
// row-end utilities
staticUtility("row-end-auto", [["grid-row-end", "auto"]]);
functionalUtility({
  name: "row-end",
  prop: "grid-row-end",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => parseNumber(value),
  handleNegativeBareValue: ({ value }) => {
    if (parseNumber(value)) return `calc(${value} * -1)`;
    return null;
  },
  handleCustomProperty: (value) => [decl("grid-row-end", `var(${value})`)],
  handle: (value) => {
    if (parseNumber(value)) return [decl("grid-row-end", value)];
    if (typeof value === "string") return [decl("grid-row-end", value)];
    return null;
  },
  description:
    "grid-row-end utility (number, negative, arbitrary, custom property 지원)",
  category: "grid",
});
// row-auto, row-<number>, -row-<number>, row-(<custom-property>), row-[value]
staticUtility("row-auto", [["grid-row", "auto"]]);
functionalUtility({
  name: "row",
  prop: "grid-row",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => parseNumber(value),
  handleNegativeBareValue: ({ value }) => {
    if (parseNumber(value)) return `calc(${value} * -1)`;
    return null;
  },
  handleCustomProperty: (value) => [decl("grid-row", `var(${value})`)],
  handle: (value) => {
    if (parseNumber(value)) return [decl("grid-row", value)];
    if (typeof value === "string") return [decl("grid-row", value)];
    return null;
  },
  description:
    "grid-row utility (number, negative, arbitrary, custom property 지원)",
  category: "grid",
});

// --- Flexbox & Grid: Grid Auto Flow ---
staticUtility("grid-flow-row", [["grid-auto-flow", "row"]]);
staticUtility("grid-flow-col", [["grid-auto-flow", "column"]]);
staticUtility("grid-flow-dense", [["grid-auto-flow", "dense"]]);
staticUtility("grid-flow-row-dense", [["grid-auto-flow", "row dense"]]);
staticUtility("grid-flow-col-dense", [["grid-auto-flow", "column dense"]]);

// --- Flexbox & Grid: Grid Auto Columns ---
staticUtility("auto-cols-auto", [["grid-auto-columns", "auto"]]);
staticUtility("auto-cols-min", [["grid-auto-columns", "min-content"]]);
staticUtility("auto-cols-max", [["grid-auto-columns", "max-content"]]);
staticUtility("auto-cols-fr", [["grid-auto-columns", "minmax(0, 1fr)"]]);

functionalUtility({
  name: "auto-cols",
  prop: "grid-auto-columns",
  supportsArbitrary: true, // auto-cols-[minmax(0,2fr)]
  supportsCustomProperty: true, // auto-cols-(--my-auto-cols)
  handle: (value) => {
    if (typeof value === "string") return [decl("grid-auto-columns", value)];
    return null;
  },
  handleCustomProperty: (value) => [decl("grid-auto-columns", `var(${value})`)],
  description:
    "grid-auto-columns utility (static, arbitrary, custom property 지원)",
  category: "grid",
});

// --- Flexbox & Grid: Grid Auto Rows ---
staticUtility("auto-rows-auto", [["grid-auto-rows", "auto"]]);
staticUtility("auto-rows-min", [["grid-auto-rows", "min-content"]]);
staticUtility("auto-rows-max", [["grid-auto-rows", "max-content"]]);
staticUtility("auto-rows-fr", [["grid-auto-rows", "minmax(0, 1fr)"]]);

functionalUtility({
  name: "auto-rows",
  prop: "grid-auto-rows",
  supportsArbitrary: true, // auto-rows-[minmax(0,2fr)]
  supportsCustomProperty: true, // auto-rows-(--my-auto-rows)
  handle: (value) => {
    if (typeof value === "string") return [decl("grid-auto-rows", value)];
    return null;
  },
  handleCustomProperty: (value) => [decl("grid-auto-rows", `var(${value})`)],
  description:
    "grid-auto-rows utility (static, arbitrary, custom property 지원)",
  category: "grid",
});

// --- Flexbox & Grid: Gap ---
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
  description: "gap-x utility (number, arbitrary, custom property 지원)",
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
  description: "gap-y utility (number, arbitrary, custom property 지원)",
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
  description: "gap utility (number, arbitrary, custom property 지원)",
  category: "layout",
});

// --- Flexbox & Grid: Justify Content ---
staticUtility("justify-start", [["justify-content", "flex-start"]]);
staticUtility("justify-end", [["justify-content", "flex-end"]]);
staticUtility("justify-end-safe", [["justify-content", "safe flex-end"]]);
staticUtility("justify-center", [["justify-content", "center"]]);
staticUtility("justify-center-safe", [["justify-content", "safe center"]]);
staticUtility("justify-between", [["justify-content", "space-between"]]);
staticUtility("justify-around", [["justify-content", "space-around"]]);
staticUtility("justify-evenly", [["justify-content", "space-evenly"]]);
staticUtility("justify-stretch", [["justify-content", "stretch"]]);
staticUtility("justify-baseline", [["justify-content", "baseline"]]);
staticUtility("justify-normal", [["justify-content", "normal"]]);

// --- Flexbox & Grid: Justify Items ---
staticUtility("justify-items-start", [["justify-items", "start"]]);
staticUtility("justify-items-end", [["justify-items", "end"]]);
staticUtility("justify-items-end-safe", [["justify-items", "safe end"]]);
staticUtility("justify-items-center", [["justify-items", "center"]]);
staticUtility("justify-items-center-safe", [["justify-items", "safe center"]]);
staticUtility("justify-items-stretch", [["justify-items", "stretch"]]);
staticUtility("justify-items-normal", [["justify-items", "normal"]]);

// --- Flexbox & Grid: Justify Self ---
staticUtility("justify-self-auto", [["justify-self", "auto"]]);
staticUtility("justify-self-start", [["justify-self", "start"]]);
staticUtility("justify-self-center", [["justify-self", "center"]]);
staticUtility("justify-self-center-safe", [["justify-self", "safe center"]]);
staticUtility("justify-self-end", [["justify-self", "end"]]);
staticUtility("justify-self-end-safe", [["justify-self", "safe end"]]);
staticUtility("justify-self-stretch", [["justify-self", "stretch"]]);

// --- Flexbox & Grid: Align Content ---
staticUtility("content-normal", [["align-content", "normal"]]);
staticUtility("content-center", [["align-content", "center"]]);
staticUtility("content-start", [["align-content", "flex-start"]]);
staticUtility("content-end", [["align-content", "flex-end"]]);
staticUtility("content-between", [["align-content", "space-between"]]);
staticUtility("content-around", [["align-content", "space-around"]]);
staticUtility("content-evenly", [["align-content", "space-evenly"]]);
staticUtility("content-baseline", [["align-content", "baseline"]]);
staticUtility("content-stretch", [["align-content", "stretch"]]);

// --- Flexbox & Grid: Align Items ---
staticUtility("items-start", [["align-items", "flex-start"]]);
staticUtility("items-end", [["align-items", "flex-end"]]);
staticUtility("items-end-safe", [["align-items", "safe flex-end"]]);
staticUtility("items-center", [["align-items", "center"]]);
staticUtility("items-center-safe", [["align-items", "safe center"]]);
staticUtility("items-baseline", [["align-items", "baseline"]]);
staticUtility("items-baseline-last", [["align-items", "last baseline"]]);
staticUtility("items-stretch", [["align-items", "stretch"]]);

// --- Flexbox & Grid: Align Self ---
staticUtility("self-auto", [["align-self", "auto"]]);
staticUtility("self-start", [["align-self", "flex-start"]]);
staticUtility("self-end", [["align-self", "flex-end"]]);
staticUtility("self-end-safe", [["align-self", "safe flex-end"]]);
staticUtility("self-center", [["align-self", "center"]]);
staticUtility("self-center-safe", [["align-self", "safe center"]]);
staticUtility("self-stretch", [["align-self", "stretch"]]);
staticUtility("self-baseline", [["align-self", "baseline"]]);
staticUtility("self-baseline-last", [["align-self", "last baseline"]]);

// --- Flexbox & Grid: Place Content ---
staticUtility("place-content-center", [["place-content", "center"]]);
staticUtility("place-content-center-safe", [["place-content", "safe center"]]);
staticUtility("place-content-start", [["place-content", "start"]]);
staticUtility("place-content-end", [["place-content", "end"]]);
staticUtility("place-content-end-safe", [["place-content", "safe end"]]);
staticUtility("place-content-between", [["place-content", "space-between"]]);
staticUtility("place-content-around", [["place-content", "space-around"]]);
staticUtility("place-content-evenly", [["place-content", "space-evenly"]]);
staticUtility("place-content-baseline", [["place-content", "baseline"]]);
staticUtility("place-content-stretch", [["place-content", "stretch"]]);

// --- Flexbox & Grid: Place Items ---
staticUtility("place-items-start", [["place-items", "start"]]);
staticUtility("place-items-end", [["place-items", "end"]]);
staticUtility("place-items-end-safe", [["place-items", "safe end"]]);
staticUtility("place-items-center", [["place-items", "center"]]);
staticUtility("place-items-center-safe", [["place-items", "safe center"]]);
staticUtility("place-items-baseline", [["place-items", "baseline"]]);
staticUtility("place-items-stretch", [["place-items", "stretch"]]);

// --- Flexbox & Grid: Place Self ---
staticUtility("place-self-auto", [["place-self", "auto"]]);
staticUtility("place-self-start", [["place-self", "start"]]);
staticUtility("place-self-end", [["place-self", "end"]]);
staticUtility("place-self-end-safe", [["place-self", "safe end"]]);
staticUtility("place-self-center", [["place-self", "center"]]);
staticUtility("place-self-center-safe", [["place-self", "safe center"]]);
staticUtility("place-self-stretch", [["place-self", "stretch"]]);

// --- Flexbox & Grid: Grid Column ---
// col-span utilities
staticUtility("col-span-full", [["grid-column", "1 / -1"]]);
functionalUtility({
  name: "col-span",
  prop: "grid-column",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => {
    if (parseNumber(value)) return `span ${value} / span ${value}`;
    return null;
  },
  handleCustomProperty: (value, ctx, token) => {
    return [decl("grid-column", `span var(${value}) / span var(${value})`)];
  },
  handle: (value, ctx, token) => {
    if (parseNumber(value))
      return [decl("grid-column", `span ${value} / span ${value}`)];
    return null;
  },
  description:
    "grid-column span utility (number, arbitrary, custom property 지원)",
  category: "grid",
});

// col-start utilities
staticUtility("col-start-auto", [["grid-column-start", "auto"]]);
functionalUtility({
  name: "col-start",
  prop: "grid-column-start",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => parseNumber(value),
  handleNegativeBareValue: ({ value }) => {
    if (parseNumber(value)) return `calc(${value} * -1)`;
    return null;
  },
  description:
    "grid-column-start utility (number, negative, arbitrary, custom property 지원)",
  category: "grid",
});

// col-end utilities
staticUtility("col-end-auto", [["grid-column-end", "auto"]]);
functionalUtility({
  name: "col-end",
  prop: "grid-column-end",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => parseNumber(value),
  handleNegativeBareValue: ({ value }) => {
    if (parseNumber(value)) return `calc(${value} * -1)`;
    return null;
  },
  description:
    "grid-column-end utility (number, negative, arbitrary, custom property 지원)",
  category: "grid",
});

// col-auto, col-<number>, -col-<number>, col-(<custom-property>), col-[value]
staticUtility("col-auto", [["grid-column", "auto"]]);
functionalUtility({
  name: "col",
  prop: "grid-column",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => parseNumber(value),
  handleNegativeBareValue: ({ value }) => {
    if (parseNumber(value)) return `calc(${value} * -1)`;
    return null;
  },
  description:
    "grid-column utility (number, negative, arbitrary, custom property 지원)",
  category: "grid",
});

// Padding utilities (p-*, px-*, py-*, ps-*, pe-*, pt-*, pr-*, pb-*, pl-*)
[
  ["px", "padding-inline"],
  ["py", "padding-block"],
  ["ps", "padding-inline-start"],
  ["pe", "padding-inline-end"],
  ["pt", "padding-top"],
  ["pr", "padding-right"],
  ["pb", "padding-bottom"],
  ["pl", "padding-left"],
  ["p", "padding"],
].forEach(([name, prop]) => {
  staticUtility(`${name}-px`, [[prop, "1px"]]);
  functionalUtility({
    name,
    prop,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
    description: `${name} utility (number, arbitrary, custom property 지원)`,
    category: "layout",
  });
});

// Margin utilities (m-*, mx-*, my-*, ms-*, me-*, mt-*, mr-*, mb-*, ml-*)
[
  ["mx", "margin-inline"],
  ["my", "margin-block"],
  ["ms", "margin-inline-start"],
  ["me", "margin-inline-end"],
  ["mt", "margin-top"],
  ["mr", "margin-right"],
  ["mb", "margin-bottom"],
  ["ml", "margin-left"],
  ["m", "margin"],
].forEach(([name, prop]) => {
  staticUtility(`${name}-auto`, [[prop, "auto"]]);
  staticUtility(`${name}-px`, [[prop, "1px"]]);
  staticUtility(`-${name}-px`, [[prop, "-1px"]]);
  functionalUtility({
    name,
    prop,
    supportsNegative: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
    handleNegativeBareValue: ({ value }) => `calc(var(--spacing) * -${value})`,
    description: `${name} margin utility (number, negative, arbitrary, custom property, auto, px 지원)`,
    category: "layout",
  });
});

// --- Spacing: space-x, space-y, space-x-reverse, space-y-reverse ---
// Tailwind: https://github.com/tailwindlabs/tailwindcss/blob/main/packages/tailwindcss/src/utilities.ts

// space-x-*, -space-x-*, space-x-px, -space-x-px, space-x-[...], space-x-(...)

staticUtility("space-x-px", [
  [
    "& > :not([hidden]) ~ :not([hidden])",
    [
      ["--tw-space-x-reverse", "0"],
      [
        "margin-inline-start",
        "calc(1px * calc(1 - var(--tw-space-x-reverse)))",
      ],
      ["margin-inline-end", "calc(1px * var(--tw-space-x-reverse))"],
    ],
  ],
]);
staticUtility("-space-x-px", [
  [
    "& > :not([hidden]) ~ :not([hidden])",
    [
      ["--tw-space-x-reverse", "0"],
      [
        "margin-inline-start",
        "calc(-1px * calc(1 - var(--tw-space-x-reverse)))",
      ],
      ["margin-inline-end", "calc(-1px * var(--tw-space-x-reverse))"],
    ],
  ],
]);
staticUtility("space-x-reverse", [
  ["& > :not([hidden]) ~ :not([hidden])", [["--tw-space-x-reverse", "1"]]],
]);

functionalUtility({
  name: "space-x",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
  handleNegativeBareValue: ({ value }) => `calc(var(--spacing) * -${value})`,
  handle: (value, ctx, token) => {
    let v = value;
    if (typeof v === "number" || /^-?\d+(\.\d+)?$/.test(v)) {
      v = `calc(var(--spacing) * ${token.negative ? "-" : ""}${v})`;
    }
    return [
      rule("& > :not([hidden]) ~ :not([hidden])", [
        decl("--tw-space-x-reverse", "0"),
        decl(
          "margin-inline-start",
          `calc(${v} * calc(1 - var(--tw-space-x-reverse)))`
        ),
        decl("margin-inline-end", `calc(${v} * var(--tw-space-x-reverse))`),
      ]),
    ];
  },
  handleCustomProperty: (value) => [
    rule("& > :not([hidden]) ~ :not([hidden])", [
      decl("--tw-space-x-reverse", "0"),
      decl(
        "margin-inline-start",
        `calc(var(${value}) * calc(1 - var(--tw-space-x-reverse)))`
      ),
      decl(
        "margin-inline-end",
        `calc(var(${value}) * var(--tw-space-x-reverse))`
      ),
    ]),
  ],
  description:
    "space-x utility (number, negative, px, arbitrary, custom property, reverse 지원)",
  category: "layout",
});

// space-y-*, -space-y-*, space-y-px, -space-y-px, space-y-[...], space-y-(...)

staticUtility("space-y-px", [
  [
    "& > :not([hidden]) ~ :not([hidden])",
    [
      ["--tw-space-y-reverse", "0"],
      ["margin-block-start", "calc(1px * calc(1 - var(--tw-space-y-reverse)))"],
      ["margin-block-end", "calc(1px * var(--tw-space-y-reverse))"],
    ],
  ],
]);
staticUtility("-space-y-px", [
  [
    "& > :not([hidden]) ~ :not([hidden])",
    [
      ["--tw-space-y-reverse", "0"],
      [
        "margin-block-start",
        "calc(-1px * calc(1 - var(--tw-space-y-reverse)))",
      ],
      ["margin-block-end", "calc(-1px * var(--tw-space-y-reverse))"],
    ],
  ],
]);
staticUtility("space-y-reverse", [
  ["& > :not([hidden]) ~ :not([hidden])", [["--tw-space-y-reverse", "1"]]],
]);

functionalUtility({
  name: "space-y",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
  handleNegativeBareValue: ({ value }) => `calc(var(--spacing) * -${value})`,
  handle: (value, ctx, token) => {
    let v = value;
    if (typeof v === "number" || /^-?\d+(\.\d+)?$/.test(v)) {
      v = `calc(var(--spacing) * ${token.negative ? "-" : ""}${v})`;
    }
    return [
      rule("& > :not([hidden]) ~ :not([hidden])", [
        decl("--tw-space-y-reverse", "0"),
        decl(
          "margin-block-start",
          `calc(${v} * calc(1 - var(--tw-space-y-reverse)))`
        ),
        decl("margin-block-end", `calc(${v} * var(--tw-space-y-reverse))`),
      ]),
    ];
  },
  handleCustomProperty: (value) => [
    rule("& > :not([hidden]) ~ :not([hidden])", [
      decl("--tw-space-y-reverse", "0"),
      decl(
        "margin-block-start",
        `calc(var(${value}) * calc(1 - var(--tw-space-y-reverse)))`
      ),
      decl(
        "margin-block-end",
        `calc(var(${value}) * var(--tw-space-y-reverse))`
      ),
    ]),
  ],
  description:
    "space-y utility (number, negative, px, arbitrary, custom property, reverse 지원)",
  category: "layout",
});
