import { staticUtility } from "../core/registry";
import { functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import { parseNumber } from "../core/utils";

// --- Table Layout Utilities (border-collapse, border-separate) ---
staticUtility("border-collapse", [["border-collapse", "collapse"]], { category: 'table' });
staticUtility("border-separate", [["border-collapse", "separate"]], { category: 'table' });

// --- Table Layout ---
staticUtility("table-auto", [["table-layout", "auto"]], { category: 'table' });
staticUtility("table-fixed", [["table-layout", "fixed"]], { category: 'table' });

// --- Border Spacing ---
functionalUtility({
  name: "border-spacing-x",
  prop: "border-spacing",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    if (parseNumber(value)) {
      return [decl("border-spacing", `calc(var(--spacing) * ${value}) var(--baro-border-spacing-y)`)]
    }
    return [decl("border-spacing", `${value} var(--baro-border-spacing-y)`)]
  },
  handleCustomProperty: (value) => [decl("border-spacing", `var(${value}) var(--baro-border-spacing-y)`)],
  description: "border-spacing-x utility (static, number, arbitrary, custom property supported)",
  category: "table",
});

functionalUtility({
  name: "border-spacing-y",
  prop: "border-spacing",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    if (parseNumber(value)) {
      return [decl("border-spacing", `var(--baro-border-spacing-x) calc(var(--spacing) * ${value})`)]
    }
    return [decl("border-spacing", `var(--baro-border-spacing-x) ${value}`)]
  },
  handleCustomProperty: (value) => [decl("border-spacing", `var(--baro-border-spacing-x) var(${value})`)],
  description: "border-spacing-y utility (static, number, arbitrary, custom property supported)",
  category: "table",
}); 

functionalUtility({
    name: "border-spacing",
    prop: "border-spacing",
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value, _ctx, _token) => {
      if (parseNumber(value)) {
        return [decl("border-spacing", `calc(var(--spacing) * ${value})`)];
      }
      return [decl("border-spacing", value)];
    },
    handleCustomProperty: (value) => [decl("border-spacing", `var(${value})`)],
    description: "border-spacing utility (static, number, arbitrary, custom property supported)",
    category: "table",
  });

// --- Caption Side ---
staticUtility("caption-top", [["caption-side", "top"]], { category: 'table' });
staticUtility("caption-bottom", [["caption-side", "bottom"]], { category: 'table' });