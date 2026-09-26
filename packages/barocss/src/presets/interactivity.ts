import { staticUtility, functionalUtility } from "../core/registry";
import { atRoot, decl, property, type AstNode } from "../core/ast";
import { parseNumber, themeColorDecls } from "../core/utils";

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
  handle: (value, _ctx, _token, extra) => {
    if (extra?.realThemeValue) return themeColorDecls("accent-color", value, extra);

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
    if (extra?.realThemeValue) return themeColorDecls("caret-color", value, extra);
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
staticUtility("snap-x", [["scroll-snap-type", "x var(--baro-scroll-snap-strictness)"]], { category: 'interactivity' });
staticUtility("snap-y", [["scroll-snap-type", "y var(--baro-scroll-snap-strictness)"]], { category: 'interactivity' });
staticUtility("snap-both", [["scroll-snap-type", "both var(--baro-scroll-snap-strictness)"]], { category: 'interactivity' });
staticUtility("snap-mandatory", [["--baro-scroll-snap-strictness", "mandatory"]], { category: 'interactivity' });
staticUtility("snap-proximity", [["--baro-scroll-snap-strictness", "proximity"]], { category: 'interactivity' });


[
  ["mbs", "scroll-margin-block-start"], // #311 (Tailwind 4.3), before `mb`
  ["mbe", "scroll-margin-block-end"],
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
  // #314: 1px keyword, as Tailwind 4.3.3 (negative too, for margin only).
  staticUtility(`scroll-${name}-px`, [[prop, "1px"]], { category: 'interactivity' });
  staticUtility(`-scroll-${name}-px`, [[prop, "-1px"]], { category: 'interactivity' });
  functionalUtility({
    name: `scroll-${name}`,
    spacingKeys: true,
    prop,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value, _ctx, token, _extra) => {
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
  ["pbs", "scroll-padding-block-start"], // #311 (Tailwind 4.3), before `pb`
  ["pbe", "scroll-padding-block-end"],
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
    spacingKeys: true,
    prop,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handleBareValue: ({ value }) => (value === "px" ? "1px" : /^(\d|\.\d)/.test(value) ? value : null),
    handle: (value, _ctx, token, _extra) => {
      // #314: Tailwind 4.3.3 has no negative scroll-padding; `px` is 1px.
      if (token.negative) return [];
      if (parseNumber(value)) {
        return [decl(prop, `calc(var(--spacing) * ${value})`)];
      }
      return [decl(prop, value)];
    },
    handleCustomProperty: (value, _ctx, token) => (token.negative ? [] : [decl(prop, `var(${value})`)]),
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
staticUtility("select-none", [["-webkit-user-select", "none"], ["user-select", "none"]], { category: 'interactivity' });
staticUtility("select-text", [["-webkit-user-select", "text"], ["user-select", "text"]], { category: 'interactivity' });
staticUtility("select-all", [["-webkit-user-select", "all"], ["user-select", "all"]], { category: 'interactivity' });
staticUtility("select-auto", [["-webkit-user-select", "auto"], ["user-select", "auto"]], { category: 'interactivity' });

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

// --- Scrollbar Utilities (#309, Tailwind 4.3) ---
staticUtility("scrollbar-auto", [["scrollbar-width", "auto"]], { category: 'interactivity' });
staticUtility("scrollbar-thin", [["scrollbar-width", "thin"]], { category: 'interactivity' });
staticUtility("scrollbar-none", [["scrollbar-width", "none"]], { category: 'interactivity' });
staticUtility("scrollbar-gutter-auto", [["scrollbar-gutter", "auto"]], { category: 'interactivity' });
staticUtility("scrollbar-gutter-stable", [["scrollbar-gutter", "stable"]], { category: 'interactivity' });
staticUtility("scrollbar-gutter-both", [["scrollbar-gutter", "stable both-edges"]], { category: 'interactivity' });

// scrollbar-thumb-*/scrollbar-track-* set one half and re-emit the composite, with @property defaults (#0000)
// so a lone thumb or track still yields a valid scrollbar-color.
const SCROLLBAR_COLOR = "var(--baro-scrollbar-thumb) var(--baro-scrollbar-track)";
const scrollbarProperties = () =>
  atRoot([
    property("--baro-scrollbar-thumb", "#0000", "<color>"),
    property("--baro-scrollbar-track", "#0000", "<color>"),
  ]);
const stripColorHint = (v: string) => v.replace(/^color:/, "");

for (const part of ["thumb", "track"] as const) {
  const key = `--baro-scrollbar-${part}`;
  const compose = (inner: AstNode[]) => [scrollbarProperties(), ...inner, decl("scrollbar-color", SCROLLBAR_COLOR)];
  const withOpacity = (color: string, opacity?: string) =>
    opacity
      ? [decl(key, `color-mix(in oklab, ${color} ${opacity.replace(/^\[(.*)\]$/, "$1").replace(/%$/, "")}%, transparent)`)]
      : [decl(key, color)];
  functionalUtility({
    name: `scrollbar-${part}`,
    themeKeys: ["colors"],
    supportsOpacity: true,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value, _ctx, token, extra) => {
      if (extra?.realThemeValue) return compose(withOpacity(`var(--color-${extra.realThemeValue})`, extra.opacity));
      if (token.arbitrary) return compose(withOpacity(stripColorHint(value), extra?.opacity));
      if (value === "inherit" || value === "transparent") return compose([decl(key, value)]);
      if (value === "current") return compose(withOpacity("currentcolor", extra?.opacity));
      return null;
    },
    handleCustomProperty: (value, _ctx, _token, extra) =>
      compose(withOpacity(`var(${stripColorHint(value)})`, extra?.opacity)),
    description: `scrollbar-color ${part} utility (theme, arbitrary, custom property, opacity)`,
    category: "interactivity",
  });
}
