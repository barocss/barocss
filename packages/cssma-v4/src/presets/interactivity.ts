import { staticUtility, functionalUtility } from "../core/registry";
import { atRule, decl } from "../core/ast";

// --- Accent Color Utilities  ---
// https://tailwindcss.com/docs/accent-color

// Theme color utilities (e.g. accent-inherit, accent-blue-500)
// (Assume theme color registration is handled elsewhere, or extend as needed)

staticUtility("accent-inherit", [["accent-color", "inherit"]]);
staticUtility("accent-current", [["accent-color", "currentColor"]]);
staticUtility("accent-transparent", [["accent-color", "transparent"]]);

// Functional: arbitrary value (accent-[value])
functionalUtility({
  name: "accent",
  themeKeys: ["colors"],
  supportsOpacity: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token, extra) => {
    if (extra?.realThemeValue) {
      if (extra.opacity) {
        return [
          atRule("supports", `(color:color-mix(in lab, red, red))`, [
            decl(
              "accent-color",
              `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`
            ),
          ]),
          decl("accent-color", value),
        ];
      }

      return [decl("accent-color", `var(--color-${extra.realThemeValue})`)];
    }

    return [decl("accent-color", value)];
  },
  handleCustomProperty: (value) => [decl("accent-color", `var(${value})`)],
  description: "accent-color utility (static, arbitrary, custom property 지원)",
  category: "interactivity",
});

// --- Appearance Utilities  ---
// https://tailwindcss.com/docs/appearance

// appearance-none: removes native form control styling
staticUtility("appearance-none", [["appearance", "none"]]);
// appearance-auto: restores default browser styling
staticUtility("appearance-auto", [["appearance", "auto"]]);

// --- Caret Color Utilities  ---
// https://tailwindcss.com/docs/caret-color

// Static caret colors
staticUtility("caret-inherit", [["caret-color", "inherit"]]);
staticUtility("caret-current", [["caret-color", "currentColor"]]);
staticUtility("caret-transparent", [["caret-color", "transparent"]]);

// Theme color utilities (e.g. caret-blue-500)
// (Assume theme color registration is handled elsewhere)

// Functional: arbitrary value (caret-[value]) and custom property (caret-(--my-caret))
functionalUtility({
  name: "caret",
  themeKeys: ["colors"],
  supportsOpacity: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token, extra) => {
    console.log(extra, 'extra', value, 'value', ctx, 'ctx', token, 'token');
    if (extra?.realThemeValue) {
      if (extra.opacity) {
        return [
          atRule("supports", `(color:color-mix(in lab, red, red))`, [
            decl(
              "caret-color",
              `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`
            ),
          ]),
          decl("caret-color", value),
        ];
      }

      return [decl("caret-color", `var(--color-${extra.realThemeValue})`)];
    }
    return [decl("caret-color", value)];
  },
  handleCustomProperty: (value) => [decl("caret-color", `var(${value})`)],
  description:
    "caret-color utility (static, theme, arbitrary, custom property 지원)",
  category: "interactivity",
});
