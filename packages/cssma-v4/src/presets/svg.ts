import { decl } from "../core/ast";
import { staticUtility, functionalUtility } from "../core/registry";
import { parseNumber } from "../core/utils";

// --- Fill Utilities ---
// Modern CSS fill documentation

// Static fill values
staticUtility("fill-inherit", [["fill", "inherit"]]);
staticUtility("fill-current", [["fill", "currentColor"]]);
staticUtility("fill-transparent", [["fill", "transparent"]]);
staticUtility("fill-black", [["fill", "#000"]]);
staticUtility("fill-white", [["fill", "#fff"]]);

// Functional: theme color, arbitrary, custom property
functionalUtility({
  name: "fill",
  themeKeys: ["colors"],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token, extra) => {
    if (extra?.realThemeValue) {
      return [decl("fill", `var(--color-${extra.realThemeValue})`)];
    }
    return [decl("fill", value)];
  },
  description: "fill utility (static, theme, arbitrary, custom property 지원)",
  category: "svg",
});

// --- Stroke Utilities ---
// Modern CSS stroke documentation
staticUtility("stroke-inherit", [["stroke", "inherit"]]);
staticUtility("stroke-current", [["stroke", "currentColor"]]);
staticUtility("stroke-transparent", [["stroke", "transparent"]]);
staticUtility("stroke-black", [["stroke", "#000"]]);
staticUtility("stroke-white", [["stroke", "#fff"]]);

functionalUtility({
  name: "stroke",
  themeKeys: ["colors"],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token, extra) => {

    if (parseNumber(value)) {
      return [decl("stroke-width", value)];
    }

    if (extra?.realThemeValue) {
      return [decl("stroke", `var(--color-${extra.realThemeValue})`)];
    }
    return [decl("stroke", value)];
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("length:")) {
      const cp = value.replace("length:", "");
      return [decl("stroke-width", `var(${cp})`)];
    }
    return [decl("stroke", `var(${value})`)];
  },
  description: "stroke utility (static, theme, arbitrary, custom property 지원)",
  category: "svg",
});

