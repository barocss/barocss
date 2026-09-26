import { decl } from "../core/ast";
import { staticUtility, functionalUtility } from "../core/registry";
import { parseNumber, parseColor } from "../core/utils";

// #303: stroke-[…] / stroke-(…) type hints that mean stroke-width in Tailwind
const STROKE_WIDTH_HINT = /^(length|number|percentage):(.+)$/;
const STROKE_LENGTH = /^(\d*\.)?\d+(px|em|rem|vh|vw|vmin|vmax|%|in|cm|mm|pt|pc|ex|ch|q|lh|rlh|svh|lvh|dvh|cqw|cqh)$/i;

// --- Fill Utilities ---
//  fill documentation

// Static fill values
staticUtility("fill-inherit", [["fill", "inherit"]], { category: 'svg' });
staticUtility("fill-current", [["fill", "currentColor"]], { category: 'svg' });
staticUtility("fill-transparent", [["fill", "transparent"]], { category: 'svg' });
staticUtility("fill-black", [["fill", "#000"]], { category: 'svg' });
staticUtility("fill-white", [["fill", "#fff"]], { category: 'svg' });

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
  description: "fill utility (static, theme, arbitrary, custom property supported)",
  category: "svg",
});

// --- Stroke Utilities ---
//  stroke documentation
staticUtility("stroke-inherit", [["stroke", "inherit"]], { category: 'svg' });
staticUtility("stroke-current", [["stroke", "currentColor"]], { category: 'svg' });
staticUtility("stroke-transparent", [["stroke", "transparent"]], { category: 'svg' });
staticUtility("stroke-black", [["stroke", "#000"]], { category: 'svg' });
staticUtility("stroke-white", [["stroke", "#fff"]], { category: 'svg' });

functionalUtility({
  name: "stroke",
  themeKeys: ["colors", "strokeWidth"], // #338: a key in both is a colour, as in Tailwind
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token, extra) => {

    if (parseNumber(value) || extra?.themeNamespace === "strokeWidth") {
      return [decl("stroke-width", value)];
    }

    // #303: arbitrary lengths, percentages and length/number hints are stroke-width
    if (token.arbitrary) {
      const hint = STROKE_WIDTH_HINT.exec(value);
      if (hint) return [decl("stroke-width", hint[2])];
      if (!parseColor(value) && (STROKE_LENGTH.test(value) || /^calc\(/.test(value))) {
        return [decl("stroke-width", value)];
      }
    }

    if (extra?.realThemeValue) {
      return [decl("stroke", `var(--color-${extra.realThemeValue})`)];
    }
    return [decl("stroke", value)];
  },
  handleCustomProperty: (value) => {
    const hint = STROKE_WIDTH_HINT.exec(value);
    if (hint) return [decl("stroke-width", `var(${hint[2]})`)];
    return [decl("stroke", `var(${value})`)];
  },
  description: "stroke utility (static, theme, arbitrary, custom property supported)",
  category: "svg",
});

