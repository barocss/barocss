import { staticUtility } from "../core/registry";
import { functionalUtility } from "../core/registry";
import { atRoot, decl, property } from "../core/ast";
import { parseNumber } from "../core/utils";

// --- Table Layout Utilities (border-collapse, border-separate) ---
staticUtility("border-collapse", [["border-collapse", "collapse"]], { category: 'table' });
staticUtility("border-separate", [["border-collapse", "separate"]], { category: 'table' });

// --- Table Layout ---
staticUtility("table-auto", [["table-layout", "auto"]], { category: 'table' });
staticUtility("table-fixed", [["table-layout", "fixed"]], { category: 'table' });

// --- Border Spacing ---
// #314: as Tailwind 4.3.3, each axis lives in --baro-border-spacing-x/y (with @property defaults) and
// border-spacing composes both, so border-spacing-x-* and border-spacing-y-* combine on one element.
const borderSpacingProperties = () =>
  atRoot([
    property("--baro-border-spacing-x", "0", "<length>"),
    property("--baro-border-spacing-y", "0", "<length>"),
  ]);
const BORDER_SPACING = "var(--baro-border-spacing-x) var(--baro-border-spacing-y)";
const borderSpacing = (axes: string[], v: string) => [
  borderSpacingProperties(),
  ...axes.map((a) => decl(`--baro-border-spacing-${a}`, v)),
  decl("border-spacing", BORDER_SPACING),
];

([
  ["border-spacing-x", ["x"]],
  ["border-spacing-y", ["y"]],
  ["border-spacing", ["x", "y"]],
] as [string, string[]][]).forEach(([name, axes]) => {
  staticUtility(`${name}-px`, [
    borderSpacingProperties,
    ...axes.map((a) => [`--baro-border-spacing-${a}`, "1px"] as [string, string]),
    ["border-spacing", BORDER_SPACING],
  ], { category: "table" });
  functionalUtility({
    name,
    prop: "border-spacing",
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value) =>
      borderSpacing(axes, parseNumber(value) ? `calc(var(--spacing) * ${value})` : value),
    handleCustomProperty: (value) => borderSpacing(axes, `var(${value})`),
    description: `${name} utility (number, px, arbitrary, custom property supported)`,
    category: "table",
  });
});

// --- Caption Side ---
staticUtility("caption-top", [["caption-side", "top"]], { category: 'table' });
staticUtility("caption-bottom", [["caption-side", "bottom"]], { category: 'table' });