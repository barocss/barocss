import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import {
  parseFractionOrNumber,
  parseNumber,
  parseFraction,
} from "../core/utils";


// --- Flexbox & Grid: flex-basis ---
staticUtility("basis-full", [["flex-basis", "100%"]], { category: 'flex-grid' });
staticUtility("basis-auto", [["flex-basis", "auto"]], { category: 'flex-grid' });
staticUtility("basis-3xs", [["flex-basis", "var(--container-3xs)"]], { category: 'flex-grid' });
staticUtility("basis-2xs", [["flex-basis", "var(--container-2xs)"]], { category: 'flex-grid' });
staticUtility("basis-xs", [["flex-basis", "var(--container-xs)"]], { category: 'flex-grid' });
staticUtility("basis-sm", [["flex-basis", "var(--container-sm)"]], { category: 'flex-grid' });
staticUtility("basis-md", [["flex-basis", "var(--container-md)"]], { category: 'flex-grid' });
staticUtility("basis-lg", [["flex-basis", "var(--container-lg)"]], { category: 'flex-grid' });
staticUtility("basis-xl", [["flex-basis", "var(--container-xl)"]], { category: 'flex-grid' });
staticUtility("basis-2xl", [["flex-basis", "var(--container-2xl)"]], { category: 'flex-grid' });
staticUtility("basis-3xl", [["flex-basis", "var(--container-3xl)"]], { category: 'flex-grid' });
staticUtility("basis-4xl", [["flex-basis", "var(--container-4xl)"]], { category: 'flex-grid' });
staticUtility("basis-5xl", [["flex-basis", "var(--container-5xl)"]], { category: 'flex-grid' });
staticUtility("basis-6xl", [["flex-basis", "var(--container-6xl)"]], { category: 'flex-grid' });
staticUtility("basis-7xl", [["flex-basis", "var(--container-7xl)"]], { category: 'flex-grid' });
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
    "flex-basis utility (theme, arbitrary, custom property, fraction supported)",
  category: "flex-grid",
});

// --- Flexbox & Grid: flex-direction ---
staticUtility("flex-row", [["flex-direction", "row"]], { category: 'flex-grid' });
staticUtility("flex-row-reverse", [["flex-direction", "row-reverse"]], { category: 'flex-grid' });
staticUtility("flex-col", [["flex-direction", "column"]], { category: 'flex-grid' });
staticUtility("flex-col-reverse", [["flex-direction", "column-reverse"]], { category: 'flex-grid' });

// --- Flexbox & Grid: flex-wrap ---
staticUtility("flex-wrap", [["flex-wrap", "wrap"]], { category: 'flex-grid' });
staticUtility("flex-wrap-reverse", [["flex-wrap", "wrap-reverse"]], { category: 'flex-grid' });
staticUtility("flex-nowrap", [["flex-wrap", "nowrap"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Flex ---
staticUtility("flex-auto", [["flex", "1 1 auto"]], { category: 'flex-grid' });
staticUtility("flex-initial", [["flex", "0 1 auto"]], { category: 'flex-grid' });
staticUtility("flex-none", [["flex", "none"]], { category: 'flex-grid' });

functionalUtility({
  name: "flex",
  supportsArbitrary: true, // flex-[3_1_auto], flex-[2], flex-[0_0_100%], etc.
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
    "flex shorthand utility (number, fraction, arbitrary, custom property supported)",
  category: "flex-grid",
});

// --- Flexbox & Grid: Flex Grow ---
staticUtility("grow", [["flex-grow", "1"]], { category: 'flex-grid' });

functionalUtility({
  name: "grow",
  prop: "flex-grow",
  supportsArbitrary: true, // grow-[25vw], grow-[2], grow-[var(--factor)], etc.
  supportsCustomProperty: true, // grow-(--my-grow)
  handleBareValue: ({ value }) => parseNumber(value),
  handle: (value) => [decl("flex-grow", value)],
  description: "flex-grow utility (number, arbitrary, custom property supported)",
  category: "flex-grid",
});

// --- Flexbox & Grid: Flex Shrink ---
staticUtility("shrink", [["flex-shrink", "1"]], { category: 'flex-grid' });
staticUtility("shrink-0", [["flex-shrink", "0"]], { category: 'flex-grid' });

functionalUtility({
  name: "shrink",
  prop: "flex-shrink",
  supportsArbitrary: true, // shrink-[2], shrink-[calc(100vw-var(--sidebar))], etc.
  supportsCustomProperty: true, // shrink-(--my-shrink)
  handleBareValue: ({ value }) => parseNumber(value),
  description: "flex-shrink utility (number, arbitrary, custom property supported)",
  category: "flex-grid",
});

// --- Flexbox & Grid: Order ---
staticUtility("order-first", [["order", "calc(-infinity)"]], { category: 'flex-grid' });
staticUtility("order-last", [["order", "calc(infinity)"]], { category: 'flex-grid' });
staticUtility("order-none", [["order", "0"]], { category: 'flex-grid' });

functionalUtility({
  name: "order",
  prop: "order",
  supportsNegative: true, // -order-1 → order: calc(1 * -1)
  supportsArbitrary: true, // order-[min(var(--total-items),10)], etc.
  supportsCustomProperty: true, // order-(--my-order)
  handleBareValue: ({ value }) => parseNumber(value),
  handleNegativeBareValue: ({ value }) => {
    if (parseNumber(value)) return `calc(${value} * -1)`;
    return null;
  },
  description:
    "order utility (number, negative, arbitrary, custom property supported)",
  category: "flex-grid",
});

// --- Flexbox & Grid: Grid Template Columns ---
staticUtility("grid-cols-none", [["grid-template-columns", "none"]], { category: 'flex-grid' });
staticUtility("grid-cols-subgrid", [["grid-template-columns", "subgrid"]], { category: 'flex-grid' });

functionalUtility({
  name: "grid-cols",
  prop: "grid-template-columns",
  supportsArbitrary: true, // grid-cols-[200px_minmax(900px,_1fr)_100px], etc.
  supportsCustomProperty: true, // grid-cols-(--my-grid-cols)
  handleBareValue: ({ value }) =>
    parseFractionOrNumber(value, { repeat: true }),
  description:
    "grid-template-columns utility (number, arbitrary, custom property supported)",
  category: "flex-grid",
});

// --- Flexbox & Grid: Grid Template Rows ---
staticUtility("grid-rows-none", [["grid-template-rows", "none"]], { category: 'flex-grid' });
staticUtility("grid-rows-subgrid", [["grid-template-rows", "subgrid"]], { category: 'flex-grid' });

functionalUtility({
  name: "grid-rows",
  prop: "grid-template-rows",
  supportsArbitrary: true, // grid-rows-[200px_minmax(900px,_1fr)_100px], etc.
  supportsCustomProperty: true, // grid-rows-(--my-grid-rows)
  handleBareValue: ({ value }) =>
    parseFractionOrNumber(value, { repeat: true }),
  handle: (value) => {
    // grid-rows-[200px_minmax(900px,_1fr)_100px]
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
    "grid-template-rows utility (number, arbitrary, custom property supported)",
  category: "flex-grid",
});

// --- Flexbox & Grid: Grid Row ---
// row-span utilities
staticUtility("row-span-full", [["grid-row", "1 / -1"]], { category: 'flex-grid' });
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
    "grid-row span utility (number, arbitrary, custom property supported)",
  category: "flex-grid",
});
// row-start utilities
staticUtility("row-start-auto", [["grid-row-start", "auto"]], { category: 'flex-grid' });
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
    "grid-row-start utility (number, negative, arbitrary, custom property supported)",
  category: "flex-grid",
});
// row-end utilities
staticUtility("row-end-auto", [["grid-row-end", "auto"]], { category: 'flex-grid' });
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
    "grid-row-end utility (number, negative, arbitrary, custom property supported)",
  category: "flex-grid",
});
// row-auto, row-<number>, -row-<number>, row-(<custom-property>), row-[value]
staticUtility("row-auto", [["grid-row", "auto"]], { category: 'flex-grid' });
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
    "grid-row utility (number, negative, arbitrary, custom property supported)",
  category: "flex-grid",
});

// --- Flexbox & Grid: Grid Auto Flow ---
  staticUtility("grid-flow-row", [["grid-auto-flow", "row"]], { category: 'flex-grid' });
staticUtility("grid-flow-col", [["grid-auto-flow", "column"]], { category: 'flex-grid' });
staticUtility("grid-flow-dense", [["grid-auto-flow", "dense"]], { category: 'flex-grid' });
staticUtility("grid-flow-row-dense", [["grid-auto-flow", "row dense"]], { category: 'flex-grid' });
staticUtility("grid-flow-col-dense", [["grid-auto-flow", "column dense"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Grid Auto Columns ---
staticUtility("auto-cols-auto", [["grid-auto-columns", "auto"]], { category: 'flex-grid' });
staticUtility("auto-cols-min", [["grid-auto-columns", "min-content"]], { category: 'flex-grid' });
staticUtility("auto-cols-max", [["grid-auto-columns", "max-content"]], { category: 'flex-grid' });
staticUtility("auto-cols-fr", [["grid-auto-columns", "minmax(0, 1fr)"]], { category: 'flex-grid' });

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
    "grid-auto-columns utility (static, arbitrary, custom property supported)",
  category: "flex-grid",
});

// --- Flexbox & Grid: Grid Auto Rows ---
staticUtility("auto-rows-auto", [["grid-auto-rows", "auto"]], { category: 'flex-grid' });
staticUtility("auto-rows-min", [["grid-auto-rows", "min-content"]], { category: 'flex-grid' });
staticUtility("auto-rows-max", [["grid-auto-rows", "max-content"]], { category: 'flex-grid' });
staticUtility("auto-rows-fr", [["grid-auto-rows", "minmax(0, 1fr)"]], { category: 'flex-grid' });

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
    "grid-auto-rows utility (static, arbitrary, custom property supported)",
  category: "flex-grid",
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

// --- Flexbox & Grid: Justify Content ---
staticUtility("justify-start", [["justify-content", "flex-start"]], { category: 'flex-grid' });
staticUtility("justify-end", [["justify-content", "flex-end"]], { category: 'flex-grid' });
staticUtility("justify-end-safe", [["justify-content", "safe flex-end"]], { category: 'flex-grid' });
staticUtility("justify-center", [["justify-content", "center"]], { category: 'flex-grid' });
staticUtility("justify-center-safe", [["justify-content", "safe center"]], { category: 'flex-grid' });
staticUtility("justify-between", [["justify-content", "space-between"]], { category: 'flex-grid' });
staticUtility("justify-around", [["justify-content", "space-around"]], { category: 'flex-grid' });
staticUtility("justify-evenly", [["justify-content", "space-evenly"]], { category: 'flex-grid' });
  staticUtility("justify-stretch", [["justify-content", "stretch"]], { category: 'flex-grid' });
staticUtility("justify-baseline", [["justify-content", "baseline"]], { category: 'flex-grid' });
staticUtility("justify-normal", [["justify-content", "normal"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Justify Items ---
staticUtility("justify-items-start", [["justify-items", "start"]], { category: 'flex-grid' });
staticUtility("justify-items-end", [["justify-items", "end"]], { category: 'flex-grid' });
staticUtility("justify-items-end-safe", [["justify-items", "safe end"]], { category: 'flex-grid' });
staticUtility("justify-items-center", [["justify-items", "center"]], { category: 'flex-grid' });
staticUtility("justify-items-center-safe", [["justify-items", "safe center"]], { category: 'flex-grid' });
staticUtility("justify-items-stretch", [["justify-items", "stretch"]], { category: 'flex-grid' });
staticUtility("justify-items-normal", [["justify-items", "normal"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Justify Self ---
staticUtility("justify-self-auto", [["justify-self", "auto"]], { category: 'flex-grid' });
staticUtility("justify-self-start", [["justify-self", "start"]], { category: 'flex-grid' });
staticUtility("justify-self-center", [["justify-self", "center"]], { category: 'flex-grid' });
staticUtility("justify-self-center-safe", [["justify-self", "safe center"]], { category: 'flex-grid' });
staticUtility("justify-self-end", [["justify-self", "end"]], { category: 'flex-grid' });
staticUtility("justify-self-end-safe", [["justify-self", "safe end"]], { category: 'flex-grid' });
staticUtility("justify-self-stretch", [["justify-self", "stretch"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Align Content ---
  staticUtility("content-normal", [["align-content", "normal"]], { category: 'flex-grid' });
staticUtility("content-center", [["align-content", "center"]], { category: 'flex-grid' });
staticUtility("content-start", [["align-content", "flex-start"]], { category: 'flex-grid' });
staticUtility("content-end", [["align-content", "flex-end"]], { category: 'flex-grid' });
staticUtility("content-between", [["align-content", "space-between"]], { category: 'flex-grid' });
staticUtility("content-around", [["align-content", "space-around"]], { category: 'flex-grid' });
staticUtility("content-evenly", [["align-content", "space-evenly"]], { category: 'flex-grid' });
staticUtility("content-baseline", [["align-content", "baseline"]], { category: 'flex-grid' });
staticUtility("content-stretch", [["align-content", "stretch"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Align Items ---
staticUtility("items-start", [["align-items", "flex-start"]], { category: 'flex-grid' });
staticUtility("items-end", [["align-items", "flex-end"]], { category: 'flex-grid' });
staticUtility("items-end-safe", [["align-items", "safe flex-end"]], { category: 'flex-grid' });
staticUtility("items-center", [["align-items", "center"]], { category: 'flex-grid' });
staticUtility("items-center-safe", [["align-items", "safe center"]], { category: 'flex-grid' });
staticUtility("items-baseline", [["align-items", "baseline"]], { category: 'flex-grid' });
staticUtility("items-baseline-last", [["align-items", "last baseline"]], { category: 'flex-grid' });
staticUtility("items-stretch", [["align-items", "stretch"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Align Self ---
staticUtility("self-auto", [["align-self", "auto"]], { category: 'flex-grid' });
staticUtility("self-start", [["align-self", "flex-start"]], { category: 'flex-grid' });
staticUtility("self-end", [["align-self", "flex-end"]], { category: 'flex-grid' });
staticUtility("self-end-safe", [["align-self", "safe flex-end"]], { category: 'flex-grid' });
staticUtility("self-center", [["align-self", "center"]], { category: 'flex-grid' });
staticUtility("self-center-safe", [["align-self", "safe center"]], { category: 'flex-grid' });
staticUtility("self-stretch", [["align-self", "stretch"]], { category: 'flex-grid' });
staticUtility("self-baseline", [["align-self", "baseline"]], { category: 'flex-grid' });
staticUtility("self-baseline-last", [["align-self", "last baseline"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Place Content ---
staticUtility("place-content-center", [["place-content", "center"]], { category: 'flex-grid' });
staticUtility("place-content-center-safe", [["place-content", "safe center"]], { category: 'flex-grid' });
staticUtility("place-content-start", [["place-content", "start"]], { category: 'flex-grid' });
staticUtility("place-content-end", [["place-content", "end"]], { category: 'flex-grid' });
staticUtility("place-content-end-safe", [["place-content", "safe end"]], { category: 'flex-grid' });
staticUtility("place-content-between", [["place-content", "space-between"]], { category: 'flex-grid' });
staticUtility("place-content-around", [["place-content", "space-around"]], { category: 'flex-grid' });
staticUtility("place-content-evenly", [["place-content", "space-evenly"]], { category: 'flex-grid' });
staticUtility("place-content-baseline", [["place-content", "baseline"]], { category: 'flex-grid' });
staticUtility("place-content-stretch", [["place-content", "stretch"]], { category: 'flex-grid' }  );

// --- Flexbox & Grid: Place Items ---
staticUtility("place-items-start", [["place-items", "start"]], { category: 'flex-grid' });
staticUtility("place-items-end", [["place-items", "end"]], { category: 'flex-grid' });
staticUtility("place-items-end-safe", [["place-items", "safe end"]], { category: 'flex-grid' });
staticUtility("place-items-center", [["place-items", "center"]], { category: 'flex-grid' });
staticUtility("place-items-center-safe", [["place-items", "safe center"]], { category: 'flex-grid' });
staticUtility("place-items-baseline", [["place-items", "baseline"]], { category: 'flex-grid' });
staticUtility("place-items-stretch", [["place-items", "stretch"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Place Self ---
staticUtility("place-self-auto", [["place-self", "auto"]], { category: 'flex-grid' });
staticUtility("place-self-start", [["place-self", "start"]], { category: 'flex-grid' });
staticUtility("place-self-end", [["place-self", "end"]], { category: 'flex-grid' });
staticUtility("place-self-end-safe", [["place-self", "safe end"]], { category: 'flex-grid' });
staticUtility("place-self-center", [["place-self", "center"]], { category: 'flex-grid' });
staticUtility("place-self-center-safe", [["place-self", "safe center"]], { category: 'flex-grid' });
staticUtility("place-self-stretch", [["place-self", "stretch"]], { category: 'flex-grid' });

// --- Flexbox & Grid: Grid Column ---
// col-span utilities
staticUtility("col-span-full", [["grid-column", "1 / -1"]], { category: 'flex-grid' });
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
    "grid-column span utility (number, arbitrary, custom property supported)",
  category: "grid",
});

// col-start utilities
staticUtility("col-start-auto", [["grid-column-start", "auto"]], { category: 'flex-grid' });
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
    "grid-column-start utility (number, negative, arbitrary, custom property supported)",
  category: "grid",
});

// col-end utilities
staticUtility("col-end-auto", [["grid-column-end", "auto"]], { category: 'flex-grid' });
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
    "grid-column-end utility (number, negative, arbitrary, custom property supported)",
  category: "grid",
});

// col-auto, col-<number>, -col-<number>, col-(<custom-property>), col-[value]
staticUtility("col-auto", [["grid-column", "auto"]], { category: 'flex-grid' });
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
    "grid-column utility (number, negative, arbitrary, custom property supported)",
  category: "flex-grid",
});