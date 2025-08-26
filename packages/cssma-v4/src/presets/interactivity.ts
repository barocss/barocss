import { staticUtility, functionalUtility } from "../core/registry";
import { atRule, decl } from "../core/ast";
import { parseNumber } from "../core/utils";

// --- Accent Color Utilities  ---
// Modern CSS accent-color documentation

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
// Modern CSS appearance documentation

// appearance-none: removes native form control styling
staticUtility("appearance-none", [["appearance", "none"]]);
// appearance-auto: restores default browser styling
staticUtility("appearance-auto", [["appearance", "auto"]]);

// --- Caret Color Utilities  ---
// Modern CSS caret-color documentation

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
// Modern CSS color-scheme documentation

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
// Modern CSS cursor documentation

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
// Modern CSS field-sizing documentation

// field-sizing-fixed: field-sizing: fixed;
staticUtility("field-sizing-fixed", [["field-sizing", "fixed"]]);
// field-sizing-content: field-sizing: content;
staticUtility("field-sizing-content", [["field-sizing", "content"]]);

// --- Pointer Events Utilities  ---
// Modern CSS pointer-events documentation

// pointer-events-auto: pointer-events: auto;
staticUtility("pointer-events-auto", [["pointer-events", "auto"]]);
// pointer-events-none: pointer-events: none;
staticUtility("pointer-events-none", [["pointer-events", "none"]]);

// --- Resize Utilities  ---
// Modern CSS resize documentation

// resize: resize: both;
staticUtility("resize", [["resize", "both"]]);
// resize-x: resize: horizontal;
staticUtility("resize-x", [["resize", "horizontal"]]);
// resize-y: resize: vertical;
staticUtility("resize-y", [["resize", "vertical"]]);
// resize-none: resize: none;
staticUtility("resize-none", [["resize", "none"]]);

// --- Scroll Behavior Utilities  ---
// Modern CSS scroll-behavior documentation

// scroll-auto: scroll-behavior: auto;
staticUtility("scroll-auto", [["scroll-behavior", "auto"]]);
// scroll-smooth: scroll-behavior: smooth;
staticUtility("scroll-smooth", [["scroll-behavior", "smooth"]]);

// --- Scroll Snap Align Utilities ---
// Modern CSS scroll-snap-align documentation
staticUtility("snap-start", [["scroll-snap-align", "start"]]);
staticUtility("snap-end", [["scroll-snap-align", "end"]]);
staticUtility("snap-center", [["scroll-snap-align", "center"]]);
staticUtility("snap-align-none", [["scroll-snap-align", "none"]]);

// --- Scroll Snap Stop Utilities ---
// Modern CSS scroll-snap-stop documentation
staticUtility("snap-normal", [["scroll-snap-stop", "normal"]]);
staticUtility("snap-always", [["scroll-snap-stop", "always"]]);

// --- Scroll Snap Type Utilities ---
// Modern CSS scroll-snap-type documentation
staticUtility("snap-none", [["scroll-snap-type", "none"]]);
staticUtility("snap-x", [["scroll-snap-type", "x var(--tw-scroll-snap-strictness)"]]);
staticUtility("snap-y", [["scroll-snap-type", "y var(--tw-scroll-snap-strictness)"]]);
staticUtility("snap-both", [["scroll-snap-type", "both var(--tw-scroll-snap-strictness)"]]);
staticUtility("snap-mandatory", [["--tw-scroll-snap-strictness", "mandatory"]]);
staticUtility("snap-proximity", [["--tw-scroll-snap-strictness", "proximity"]]);


[
  ["mt", "scroll-margin-top"],
  ["mr", "scroll-margin-right"],
  ["mb", "scroll-margin-bottom"],
  ["ml", "scroll-margin-left"],
  ["mx", "scroll-margin-inline"],
  ["my", "scroll-margin-block"],
  ["ms", "scroll-margin-inline-start"],
  ["me", "scroll-margin-inline-end"],
  ["m", "scroll-margin"],
].forEach(([name, prop]) => {
  functionalUtility({
    name: `scroll-${name}`,
    prop,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value, ctx, token, extra) => {
      if (parseNumber(value) || token.negative) {
        return [decl(prop, `calc(var(--spacing) * ${value})`)];
      }
      return [decl(prop, value)];
    },
    handleCustomProperty: (value) => [decl(prop, `var(${value})`)],
    description: `${name} utility (static, arbitrary, custom property 지원)`,
    category: "interactivity",
  });
});





[
  ["pt", "scroll-padding-top"],
  ["pr", "scroll-padding-right"],
  ["pb", "scroll-padding-bottom"],
  ["pl", "scroll-padding-left"],
  ["px", "scroll-padding-inline"],
  ["py", "scroll-padding-block"],
  ["ps", "scroll-padding-inline-start"],
  ["pe", "scroll-padding-inline-end"],
  ["p", "scroll-padding"],
].forEach(([name, prop]) => {
  functionalUtility({
    name: `scroll-${name}`,
    prop,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value, ctx, token, extra) => {
      if (parseNumber(value) || token.negative) {
        return [decl(prop, `calc(var(--spacing) * ${value})`)];
      }
      return [decl(prop, value)];
    },
    handleCustomProperty: (value) => [decl(prop, `var(${value})`)],
    description: `scroll-${name} utility (static, arbitrary, custom property 지원)`,
    category: "interactivity",
  });
});

// --- Touch Action Utilities ---
// Modern CSS touch-action documentation
staticUtility("touch-auto", [["touch-action", "auto"]]);
staticUtility("touch-none", [["touch-action", "none"]]);
staticUtility("touch-pan-x", [["touch-action", "pan-x"]]);
staticUtility("touch-pan-left", [["touch-action", "pan-left"]]);
staticUtility("touch-pan-right", [["touch-action", "pan-right"]]);
staticUtility("touch-pan-y", [["touch-action", "pan-y"]]);
staticUtility("touch-pan-up", [["touch-action", "pan-up"]]);
staticUtility("touch-pan-down", [["touch-action", "pan-down"]]);
staticUtility("touch-pinch-zoom", [["touch-action", "pinch-zoom"]]);
staticUtility("touch-manipulation", [["touch-action", "manipulation"]]);

// --- User Select Utilities ---
// Modern CSS user-select documentation
staticUtility("select-none", [["user-select", "none"]]);
staticUtility("select-text", [["user-select", "text"]]);
staticUtility("select-all", [["user-select", "all"]]);
staticUtility("select-auto", [["user-select", "auto"]]);

// --- Will Change Utilities ---
// Modern CSS will-change documentation
staticUtility("will-change-auto", [["will-change", "auto"]]);
staticUtility("will-change-scroll", [["will-change", "scroll-position"]]);
staticUtility("will-change-contents", [["will-change", "contents"]]);
staticUtility("will-change-transform", [["will-change", "transform"]]);

// Functional: will-change-[value], will-change-(--custom-property)
functionalUtility({
  name: "will-change",
  prop: "will-change",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "will-change utility (static, arbitrary, custom property 지원)",
  category: "interactivity",
});
