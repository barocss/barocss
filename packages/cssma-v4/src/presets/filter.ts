import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import { parseNumber } from "../core/utils";

// --- Filter ---
staticUtility("filter", [["filter", "var(--tw-filter)"]]);
staticUtility("filter-none", [["filter", "none"]]);

functionalUtility({
  name: "filter",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "filter utility (static, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Blur ---
[
  ["blur-xs", "var(--blur-xs)"],
  ["blur-sm", "var(--blur-sm)"],
  ["blur-md", "var(--blur-md)"],
  ["blur-lg", "var(--blur-lg)"],
  ["blur-xl", "var(--blur-xl)"],
  ["blur-2xl", "var(--blur-2xl)"],
  ["blur-3xl", "var(--blur-3xl)"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["filter", `blur(${value})`]]);
});
staticUtility("blur-none", [["filter", ""]]);

functionalUtility({
  name: "blur",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (token.customProperty) return [decl("filter", `blur(var(${value}))`)];
    return [decl("filter", `blur(${value})`)];
  },
  handleCustomProperty: (value) => [decl("filter", `blur(var(${value}))`)],
  description: "blur filter utility (static, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Brightness ---

functionalUtility({
  name: "brightness",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("filter", `brightness(${value}%)`)];
    }
    if (token.customProperty) return [decl("filter", `brightness(var(${value}))`)];
    return [decl("filter", `brightness(${value})`)];
  },
  handleCustomProperty: (value) => [decl("filter", `brightness(var(${value}))`)],
  description: "brightness filter utility (static, number, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Contrast ---
functionalUtility({
  name: "contrast",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("filter", `contrast(${value}%)`)];
    }
    if (token.customProperty) return [decl("filter", `contrast(var(${value}))`)];
    return [decl("filter", `contrast(${value})`)];
  },
  handleCustomProperty: (value) => [decl("filter", `contrast(var(${value}))`)],
  description: "contrast filter utility (static, number, arbitrary, custom property 지원)",
  category: "effects",
});

export default null; 