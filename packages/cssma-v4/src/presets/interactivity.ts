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
    console.log(extra, "extra", value, "value", ctx, "ctx", token, "token");
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

// --- Color Scheme Utilities ---
// https://tailwindcss.com/docs/color-scheme

// scheme-normal: color-scheme: normal;
staticUtility("scheme-normal", [["color-scheme", "normal"]]);
// scheme-dark: color-scheme: dark;
staticUtility("scheme-dark", [["color-scheme", "dark"]]);
// scheme-light: color-scheme: light;
staticUtility("scheme-light", [["color-scheme", "light"]]);
// scheme-light-dark: color-scheme: light dark;
staticUtility("scheme-light-dark", [["color-scheme", "light dark"]]);
// scheme-only-dark: color-scheme: only dark;
staticUtility("scheme-only-dark", [["color-scheme", "only dark"]]);
// scheme-only-light: color-scheme: only light;
staticUtility("scheme-only-light", [["color-scheme", "only light"]]);

// --- Cursor Utilities  ---
// https://tailwindcss.com/docs/cursor

// Static cursor values
[
  "auto",
  "default",
  "pointer",
  "wait",
  "text",
  "move",
  "help",
  "not-allowed",
  "none",
  "context-menu",
  "progress",
  "cell",
  "crosshair",
  "vertical-text",
  "alias",
  "copy",
  "no-drop",
  "grab",
  "grabbing",
  "all-scroll",
  "col-resize",
  "row-resize",
  "n-resize",
  "e-resize",
  "s-resize",
  "w-resize",
  "ne-resize",
  "nw-resize",
  "se-resize",
  "sw-resize",
  "ew-resize",
  "ns-resize",
  "nesw-resize",
  "nwse-resize",
  "zoom-in",
  "zoom-out",
].forEach((cursor) => {
  staticUtility(`cursor-${cursor}`, [["cursor", cursor]]);
});

// Functional: custom property (cursor-(--my-cursor)) and arbitrary value (cursor-[value])
functionalUtility({
  name: "cursor",
  prop: "cursor",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "cursor utility (static, arbitrary, custom property 지원)",
  category: "interactivity",
});

// --- Field Sizing Utilities  ---
// https://tailwindcss.com/docs/field-sizing

// field-sizing-fixed: field-sizing: fixed;
staticUtility("field-sizing-fixed", [["field-sizing", "fixed"]]);
// field-sizing-content: field-sizing: content;
staticUtility("field-sizing-content", [["field-sizing", "content"]]);

// --- Pointer Events Utilities  ---
// https://tailwindcss.com/docs/pointer-events

// pointer-events-auto: pointer-events: auto;
staticUtility("pointer-events-auto", [["pointer-events", "auto"]]);
// pointer-events-none: pointer-events: none;
staticUtility("pointer-events-none", [["pointer-events", "none"]]);

// --- Resize Utilities  ---
// https://tailwindcss.com/docs/resize

// resize: resize: both;
staticUtility("resize", [["resize", "both"]]);
// resize-x: resize: horizontal;
staticUtility("resize-x", [["resize", "horizontal"]]);
// resize-y: resize: vertical;
staticUtility("resize-y", [["resize", "vertical"]]);
// resize-none: resize: none;
staticUtility("resize-none", [["resize", "none"]]);

// --- Scroll Behavior Utilities  ---
// https://tailwindcss.com/docs/scroll-behavior

// scroll-auto: scroll-behavior: auto;
staticUtility("scroll-auto", [["scroll-behavior", "auto"]]);
// scroll-smooth: scroll-behavior: smooth;
staticUtility("scroll-smooth", [["scroll-behavior", "smooth"]]);
