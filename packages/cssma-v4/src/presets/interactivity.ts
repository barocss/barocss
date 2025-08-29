import { staticUtility, functionalUtility } from "../core/registry";
import { atRule, decl } from "../core/ast";
import { parseNumber } from "../core/utils";

// --- Accent Color Utilities  ---
//  accent-color documentation

// Theme color utilities (e.g. accent-inherit, accent-blue-500)
// (Assume theme color registration is handled elsewhere, or extend as needed)

staticUtility("accent-inherit", [["accent-color", "inherit"]], { category: 'interactivity' });
staticUtility("accent-current", [["accent-color", "currentColor"]], { category: 'interactivity' });
staticUtility("accent-transparent", [["accent-color", "transparent"]], { category: 'interactivity' });

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
  description: "accent-color utility (static, arbitrary, custom property supported)",
  category: "interactivity",
});

// --- Appearance Utilities  ---
//  appearance documentation

// appearance-none: removes native form control styling
staticUtility("appearance-none", [["appearance", "none"]], { category: 'interactivity' });
// appearance-auto: restores default browser styling
staticUtility("appearance-auto", [["appearance", "auto"]], { category: 'interactivity' });

// --- Caret Color Utilities  ---
//  caret-color documentation

// Static caret colors
staticUtility("caret-inherit", [["caret-color", "inherit"]], { category: 'interactivity' });
staticUtility("caret-current", [["caret-color", "currentColor"]], { category: 'interactivity' });
staticUtility("caret-transparent", [["caret-color", "transparent"]], { category: 'interactivity' });

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
    "caret-color utility (static, theme, arbitrary, custom property supported)",
  category: "interactivity",
});

// --- Color Scheme Utilities ---
//  color-scheme documentation

// scheme-normal: color-scheme: normal;
staticUtility("scheme-normal", [["color-scheme", "normal"]], { category: 'interactivity' });
// scheme-dark: color-scheme: dark;
staticUtility("scheme-dark", [["color-scheme", "dark"]], { category: 'interactivity' });
// scheme-light: color-scheme: light;
staticUtility("scheme-light", [["color-scheme", "light"]], { category: 'interactivity' });
// scheme-light-dark: color-scheme: light dark;
staticUtility("scheme-light-dark", [["color-scheme", "light dark"]], { category: 'interactivity' });
// scheme-only-dark: color-scheme: only dark;
staticUtility("scheme-only-dark", [["color-scheme", "only dark"]], { category: 'interactivity' });
// scheme-only-light: color-scheme: only light;
staticUtility("scheme-only-light", [["color-scheme", "only light"]], { category: 'interactivity' });

// --- Cursor Utilities  ---
//  cursor documentation

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
  staticUtility(`cursor-${cursor}`, [["cursor", cursor]], { category: 'interactivity' });
});

// Functional: custom property (cursor-(--my-cursor)) and arbitrary value (cursor-[value])
functionalUtility({
  name: "cursor",
  prop: "cursor",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "cursor utility (static, arbitrary, custom property supported)",
  category: "interactivity",
});

// --- Field Sizing Utilities  ---
//  field-sizing documentation

// field-sizing-fixed: field-sizing: fixed;
staticUtility("field-sizing-fixed", [["field-sizing", "fixed"]], { category: 'interactivity' });
// field-sizing-content: field-sizing: content;
staticUtility("field-sizing-content", [["field-sizing", "content"]], { category: 'interactivity' });

// --- Pointer Events Utilities  ---
//  pointer-events documentation

// pointer-events-auto: pointer-events: auto;
staticUtility("pointer-events-auto", [["pointer-events", "auto"]], { category: 'interactivity' });
// pointer-events-none: pointer-events: none;
staticUtility("pointer-events-none", [["pointer-events", "none"]], { category: 'interactivity' });

// --- Resize Utilities  ---
//  resize documentation

// resize: resize: both;
staticUtility("resize", [["resize", "both"]], { category: 'interactivity' });
// resize-x: resize: horizontal;
staticUtility("resize-x", [["resize", "horizontal"]], { category: 'interactivity' });
// resize-y: resize: vertical;
staticUtility("resize-y", [["resize", "vertical"]], { category: 'interactivity' });
// resize-none: resize: none;
staticUtility("resize-none", [["resize", "none"]], { category: 'interactivity' });

// --- Scroll Behavior Utilities  ---
//  scroll-behavior documentation

// scroll-auto: scroll-behavior: auto;
staticUtility("scroll-auto", [["scroll-behavior", "auto"]], { category: 'interactivity' });
// scroll-smooth: scroll-behavior: smooth;
staticUtility("scroll-smooth", [["scroll-behavior", "smooth"]], { category: 'interactivity' });

// --- Scroll Snap Align Utilities ---
//  scroll-snap-align documentation
staticUtility("snap-start", [["scroll-snap-align", "start"]], { category: 'interactivity' });
staticUtility("snap-end", [["scroll-snap-align", "end"]], { category: 'interactivity' });
staticUtility("snap-center", [["scroll-snap-align", "center"]], { category: 'interactivity' });
staticUtility("snap-align-none", [["scroll-snap-align", "none"]], { category: 'interactivity' });

// --- Scroll Snap Stop Utilities ---
//  scroll-snap-stop documentation
staticUtility("snap-normal", [["scroll-snap-stop", "normal"]], { category: 'interactivity' });
staticUtility("snap-always", [["scroll-snap-stop", "always"]], { category: 'interactivity' });

// --- Scroll Snap Type Utilities ---
//  scroll-snap-type documentation
staticUtility("snap-none", [["scroll-snap-type", "none"]], { category: 'interactivity' });
staticUtility("snap-x", [["scroll-snap-type", "x var(--tw-scroll-snap-strictness)"]], { category: 'interactivity' });
staticUtility("snap-y", [["scroll-snap-type", "y var(--tw-scroll-snap-strictness)"]], { category: 'interactivity' });
staticUtility("snap-both", [["scroll-snap-type", "both var(--tw-scroll-snap-strictness)"]], { category: 'interactivity' });
staticUtility("snap-mandatory", [["--tw-scroll-snap-strictness", "mandatory"]], { category: 'interactivity' });
staticUtility("snap-proximity", [["--tw-scroll-snap-strictness", "proximity"]], { category: 'interactivity' });


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
    description: `${name} utility (static, arbitrary, custom property supported)`,
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
    description: `scroll-${name} utility (static, arbitrary, custom property supported)`,
    category: "interactivity",
  });
});

// --- Touch Action Utilities ---
//  touch-action documentation
staticUtility("touch-auto", [["touch-action", "auto"]], { category: 'interactivity' });
staticUtility("touch-none", [["touch-action", "none"]], { category: 'interactivity' });
staticUtility("touch-pan-x", [["touch-action", "pan-x"]], { category: 'interactivity' });
staticUtility("touch-pan-left", [["touch-action", "pan-left"]], { category: 'interactivity' });
staticUtility("touch-pan-right", [["touch-action", "pan-right"]], { category: 'interactivity' });
staticUtility("touch-pan-y", [["touch-action", "pan-y"]], { category: 'interactivity' });
staticUtility("touch-pan-up", [["touch-action", "pan-up"]], { category: 'interactivity' });
staticUtility("touch-pan-down", [["touch-action", "pan-down"]], { category: 'interactivity' });
staticUtility("touch-pinch-zoom", [["touch-action", "pinch-zoom"]], { category: 'interactivity' });
staticUtility("touch-manipulation", [["touch-action", "manipulation"]], { category: 'interactivity' });

// --- User Select Utilities ---
//  user-select documentation
staticUtility("select-none", [["user-select", "none"]], { category: 'interactivity' });
staticUtility("select-text", [["user-select", "text"]], { category: 'interactivity' });
staticUtility("select-all", [["user-select", "all"]], { category: 'interactivity' });
staticUtility("select-auto", [["user-select", "auto"]], { category: 'interactivity' });

// --- Will Change Utilities ---
//  will-change documentation
staticUtility("will-change-auto", [["will-change", "auto"]], { category: 'interactivity' });
staticUtility("will-change-scroll", [["will-change", "scroll-position"]], { category: 'interactivity' });
staticUtility("will-change-contents", [["will-change", "contents"]], { category: 'interactivity' });
staticUtility("will-change-transform", [["will-change", "transform"]], { category: 'interactivity' });

// Functional: will-change-[value], will-change-(--custom-property)
functionalUtility({
  name: "will-change",
  prop: "will-change",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "will-change utility (static, arbitrary, custom property supported)",
  category: "interactivity",
});
