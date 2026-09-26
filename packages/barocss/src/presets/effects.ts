import { staticUtility, functionalUtility, registerUtility } from "../core/registry";
import { shadowColorDecls, shadowValueDecls, type ShadowLayer } from "./shadow-color";
import { atRule, atRoot, decl, property } from "../core/ast";
import { parseColor, parseNumber } from "../core/utils";

// --- Box Shadow ---
//  box-shadow documentation

// Tailwind v4 composes every box-shadow layer into one declaration, so shadow-* and ring-* on the same element
// both render: each utility sets only its own layer var and re-emits this composite.
const SHADOW_COMPOSITE =
  "var(--baro-inset-shadow), var(--baro-inset-ring-shadow), var(--baro-ring-offset-shadow), var(--baro-ring-shadow), var(--baro-shadow)";

// Base values for the box-shadow composition layers, registered like Tailwind v4's @property layer so that a lone
// shadow-*/ring-*/inset-ring-* composes a valid box-shadow when the other layers are unset.
// Without these @property initial values the whole box-shadow declaration is invalid and nothing renders.
const ringShadowProperties = () =>
  atRoot([
    property("--baro-shadow", "0 0 #0000"),
    property("--baro-inset-shadow", "0 0 #0000"),
    property("--baro-inset-ring-shadow", "0 0 #0000"),
    property("--baro-ring-offset-shadow", "0 0 #0000"),
    property("--baro-ring-shadow", "0 0 #0000"),
    property("--baro-ring-offset-width", "0px", "<length>"),
    property("--baro-ring-offset-color", "#fff"),
  ]);


// #313: the colour/alpha registrations Tailwind 4.3.3 emits @property rules for, so a colour utility or an
// opacity modifier composes with a size utility on the same element.
const shadowColorProperties = (layer: "shadow" | "inset-shadow") =>
  atRoot([
    property(`--baro-${layer}-color`),
    property(`--baro-${layer}-alpha`, "100%", "<percentage>"),
  ]);

// Tailwind 4.3.3 named box shadows ("" is bare `shadow`, `inner` is the deprecated theme reference).
const NAMED_SHADOWS: Record<string, string> = {
  "": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  "2xs": "0 1px rgb(0 0 0 / 0.05)",
  xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  inner: "inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
};
// Tailwind 4.3.3 named inset shadows; md..2xl are BaroCSS extensions (no opacity modifier).
const NAMED_INSET_SHADOWS: Record<string, string> = {
  "2xs": "inset 0 1px rgb(0 0 0 / 0.05)",
  xs: "inset 0 1px 1px rgb(0 0 0 / 0.05)",
  sm: "inset 0 2px 4px rgb(0 0 0 / 0.05)",
};
const INSET_EXTENSIONS: Record<string, string> = {
  md: "inset 0 4px 6px -1px rgb(0 0 0 / 0.05)",
  lg: "inset 0 10px 15px -3px rgb(0 0 0 / 0.05)",
  xl: "inset 0 20px 25px -5px rgb(0 0 0 / 0.05)",
  "2xl": "inset 0 25px 50px -12px rgb(0 0 0 / 0.05)",
};
const insetEach = (value: string) => value.split(/,(?![^(]*\))/).map((l) => `inset ${l.trim()}`).join(", ");
const own = (table: Record<string, string>, key: string) => Object.prototype.hasOwnProperty.call(table, key);

// A box-shadow layer value (named or arbitrary) with its colour var and opacity modifier.
function boxShadowLayer(layer: "shadow" | "inset-shadow", value: string, opacity: string | undefined) {
  const decls = shadowValueDecls(layer, `--baro-${layer}`, value, opacity);
  if (!decls) return null;
  return [ringShadowProperties(), shadowColorProperties(layer), ...decls, decl("box-shadow", SHADOW_COMPOSITE)];
}

function namedBoxShadow(layer: "shadow" | "inset-shadow", name: string, opacity: string | undefined) {
  if (layer === "shadow") return own(NAMED_SHADOWS, name) ? boxShadowLayer(layer, NAMED_SHADOWS[name], opacity) : null;
  if (own(NAMED_INSET_SHADOWS, name)) return boxShadowLayer(layer, NAMED_INSET_SHADOWS[name], opacity);
  if (!opacity && own(INSET_EXTENSIONS, name)) return boxShadowLayer(layer, INSET_EXTENSIONS[name], undefined);
  return null;
}

staticUtility("shadow-none", [ringShadowProperties, ["--baro-shadow", "0 0 #0000"], ["box-shadow", SHADOW_COMPOSITE]], { category: 'effects' });
staticUtility("inset-shadow-none", [ringShadowProperties, ["--baro-inset-shadow", "inset 0 0 #0000"], ["box-shadow", SHADOW_COMPOSITE]], { category: 'effects' });

// Bare `shadow` and `shadow/<alpha>` (no dash, so the functional utility below never sees them).
registerUtility({
  name: "shadow",
  match: (className: string) => /^shadow(\/.+)?$/.test(className),
  handler: (value, _ctx, token) => {
    const full = value ? `${token.prefix}-${value}` : token.prefix;
    const cut = full.indexOf("/");
    return namedBoxShadow("shadow", "", cut < 0 ? undefined : full.slice(cut + 1)) ?? [];
  },
  category: 'effects',
});

const KEYWORD_COLORS: Record<string, string> = { inherit: "inherit", current: "currentcolor", transparent: "transparent" };

// Colour for a shadow layer: theme colour, (color:--x), arbitrary colour, or a keyword.
function layerColor(layer: ShadowLayer, main: string, opacity: string | undefined, token: { arbitrary?: boolean }, realThemeValue?: string) {
  const keyword = token.arbitrary ? undefined : KEYWORD_COLORS[realThemeValue ?? main];
  if (keyword) return shadowColorDecls(layer, keyword, opacity);
  if (realThemeValue) return shadowColorDecls(layer, main, opacity, `var(--color-${realThemeValue})`);
  if (main.startsWith("color:")) return shadowColorDecls(layer, `var(${main.slice(6)})`, opacity);
  if (token.arbitrary && parseColor(main)) return shadowColorDecls(layer, main, opacity);
  return undefined;
}

// shadow-<size>[/alpha], shadow-<color>[/alpha], shadow-[<shadow>][/alpha], shadow-(--x)
for (const layer of ["shadow", "inset-shadow"] as const) {
  functionalUtility({
    name: layer,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    supportsOpacity: true,
    themeKeys: ["colors"],
    handleBareValue: ({ value, extra }) => (namedBoxShadow(layer, value, extra?.opacity) ? value : null),
    handle: (value, _ctx, token, extra) => {
      const opacity = extra?.opacity;
      const named = !extra?.realThemeValue && !token.arbitrary ? namedBoxShadow(layer, value, opacity) : null;
      if (named) return named;
      const color = layerColor(layer, value, opacity, token, extra?.realThemeValue);
      if (color !== undefined) return color;
      // Tailwind prefixes every layer of an arbitrary inset shadow with `inset`.
      if (token.arbitrary) return boxShadowLayer(layer, layer === "inset-shadow" ? insetEach(value) : value, opacity);
      return null;
    },
    handleCustomProperty: (value) =>
      value.startsWith("color:") ? shadowColorDecls(layer, `var(${value.slice(6)})`, undefined) ?? [] : [ringShadowProperties(), decl(`--baro-${layer}`, layer === "inset-shadow" ? `inset var(${value})` : `var(${value})`), decl("box-shadow", SHADOW_COMPOSITE)],
  });
}

// --- Text Shadow (#313, Tailwind 4.3.3) ---
const textShadowProperties = () =>
  atRoot([
    property("--baro-text-shadow-color"),
    property("--baro-text-shadow-alpha", "100%", "<percentage>"),
  ]);
const namedTextShadow = (ctx: { theme: (...k: string[]) => unknown }, name: string) => {
  const v = ctx.theme("textShadow", name);
  return typeof v === "string" && /^[\w.-]+$/.test(name) ? v : null;
};
const textShadowValue = (value: string, opacity: string | undefined) => {
  const decls = shadowValueDecls("text-shadow", "text-shadow", value, opacity);
  return decls ? [textShadowProperties(), ...decls] : null;
};
staticUtility("text-shadow-none", [textShadowProperties, ["text-shadow", "none"]], { category: 'effects' });
functionalUtility({
  name: "text-shadow",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  themeKeys: ["colors"],
  handleBareValue: ({ value, ctx }) => (namedTextShadow(ctx, value) ? value : null),
  handle: (value, ctx, token, extra) => {
    const opacity = extra?.opacity;
    if (!extra?.realThemeValue && !token.arbitrary) {
      const named = namedTextShadow(ctx, value);
      if (named) return textShadowValue(named, opacity);
    }
    const color = layerColor("text-shadow", value, opacity, token, extra?.realThemeValue);
    if (color !== undefined) return color && [textShadowProperties(), ...color];
    if (token.arbitrary) return textShadowValue(value, opacity);
    return null;
  },
  handleCustomProperty: (value) =>
    value.startsWith("color:")
      ? [textShadowProperties(), ...(shadowColorDecls("text-shadow", `var(${value.slice(6)})`, undefined) ?? [])]
      : [textShadowProperties(), decl("text-shadow", `var(${value})`)],
  category: "effects",
});

// --- Ring ( multi-variable) ---
//  ring-width documentation

// Static ring width utilities
[
  ["ring", "1px"],
  ["ring-0", "0px"],
  ["ring-1", "1px"],
  ["ring-2", "2px"],
  ["ring-4", "4px"],
  ["ring-8", "8px"],
].forEach(([name, px]) => {
  staticUtility(name as string, [
    ringShadowProperties,
    // Like Tailwind, ring-N does not set the offset vars (they come from @property defaults and ring-offset-*),
    // so `ring-N ring-offset-M` composes the same in either rule order.
    // No hardcoded ring color: Tailwind v4's default ring color is currentColor (via the var() fallback below).
    [
      "--baro-ring-shadow",
      ringShadowValue(px as string),
    ],
    [
      "box-shadow",
      "var(--baro-inset-shadow), var(--baro-inset-ring-shadow), var(--baro-ring-offset-shadow), var(--baro-ring-shadow), var(--baro-shadow)",
    ],
  ]);
});

function ringShadowValue(width: string) {
  return `var(--baro-ring-inset,) 0 0 0 calc(${width} + var(--baro-ring-offset-width)) var(--baro-ring-color, currentcolor)`;
}

// Ring offset width utilities (ring-offset-<n>). Matches Tailwind's .ring-offset-N: sets the offset width and the
// offset shadow; it renders a visible offset ring only when combined with a ring-* utility, exactly like Tailwind.
[
  ["ring-offset-0", "0px"],
  ["ring-offset-1", "1px"],
  ["ring-offset-2", "2px"],
  ["ring-offset-4", "4px"],
  ["ring-offset-8", "8px"],
].forEach(([name, px]) => {
  staticUtility(name as string, [
    ["--baro-ring-offset-width", px as string],
    ["--baro-ring-offset-color", "#fff"],
    [
      "--baro-ring-offset-shadow",
      `var(--baro-ring-inset,) 0 0 0 var(--baro-ring-offset-width) var(--baro-ring-offset-color)`,
    ],
  ], { category: 'effects' });
});

// Inset ring width utilities
[
  ["inset-ring", "1px"],
  ["inset-ring-0", "0px"],
  ["inset-ring-1", "1px"],
  ["inset-ring-2", "2px"],
  ["inset-ring-4", "4px"],
  ["inset-ring-8", "8px"],
].forEach(([name, px]) => {
  staticUtility(name as string, [
    // Tailwind 4.1.13: only the inset-ring layer; the colour defaults to currentcolor via the var() fallback.
    ringShadowProperties,
    ["--baro-inset-ring-shadow", `inset 0 0 0 ${px} var(--baro-inset-ring-color, currentcolor)`],
    ["box-shadow", SHADOW_COMPOSITE],
  ], { category: 'effects' });
});

// Ring inset
staticUtility("ring-inset", [["--baro-ring-inset", "inset"]], { category: 'effects' });

// --- Ring color/opacity/arbitrary/custom property ( supports+fallback) ---
function createRingColorDecls(
  key: string,
  main: string,
  opacity: string | undefined,
  realThemeValue: string
) {
  const colorVar = `var(--color-${realThemeValue})`;
  let colorMix = colorVar;
  let fallback = colorVar;
  if (opacity) {
    colorMix = `color-mix(in oklab, ${colorVar} ${opacity}%, transparent)`;
    if (parseColor(main) && main.startsWith("#")) {
      const opacityValue = Math.round((Number(opacity) / 100) * 255);
      fallback = `${main}${opacityValue.toString(16).padStart(2, "0")}`;
    } else {
      fallback = colorMix;
    }
  }
  return [
    atRule("supports", "(color:color-mix(in lab, red, red))", [
      decl(key, colorMix),
    ]),
    decl(key, fallback),
  ];
}

// Ring color/opacity/arbitrary/custom property
functionalUtility({
  name: "ring",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  themeKeys: ["colors"],
  handle: (value, ctx, token, extra) => {
    const main = value;
    const opacity = extra?.opacity;
    const realThemeValue = extra?.realThemeValue;
    if (realThemeValue) {
      return createRingColorDecls(
        "--baro-ring-color",
        main,
        opacity,
        realThemeValue
      );
    }
    if (main.startsWith("color:")) {
      const cp = main.replace("color:", "");
      let colorMix = `var(${cp})`;
      let fallback = colorMix;
      if (opacity) {
        colorMix = `color-mix(in oklab, var(${cp}) ${opacity}%, transparent)`;
        fallback = colorMix;
      }
      return [
        atRule("supports", "(color:color-mix(in lab, red, red))", [
          decl("--baro-ring-color", colorMix),
        ]),
        decl("--baro-ring-color", fallback),
      ];
    }
    if (token.arbitrary) {
      let colorMix = main;
      let fallback = main;
      if (opacity) {
        colorMix = `color-mix(in oklab, ${main} ${opacity}%, transparent)`;
        if (parseColor(main) && main.startsWith("#")) {
          const opacityValue = Math.round((Number(opacity) / 100) * 255);
          fallback = `${main}${opacityValue.toString(16).padStart(2, "0")}`;
        } else {
          fallback = colorMix;
        }

        return [
          atRule("supports", "(color:color-mix(in lab, red, red))", [
            decl("--baro-ring-color", colorMix),
          ]),
          decl("--baro-ring-color", fallback),
        ];
      }

      // ring-[3px]: an arbitrary length is a ring width (Tailwind's ring-[<length>]); anything else is a colour.
      if (!parseColor(main) && /^(-?(\d+\.?\d*|\.\d+)(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt|cm|mm|in|pc)|0|(length:.+)|calc\(.+\))$/i.test(main)) {
        const width = main.startsWith("length:") ? main.slice(7) : main;
        return [
          ringShadowProperties(),
          decl("--baro-ring-shadow", ringShadowValue(width)),
          decl("box-shadow", SHADOW_COMPOSITE),
        ];
      }
      return [parseColor(main) ? decl("--baro-ring-color", main) : decl("box-shadow", main)];
    }
    if (main === "inherit" || main === "current" || main === "transparent") {
      return [
        decl("--baro-ring-color", main === "current" ? "currentColor" : main),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("color:")) {
      const cp = value.replace("color:", "");
      return [decl("--baro-ring-color", `var(${cp})`)];
    }
    return [decl("--baro-ring-color", `var(${value})`)];
  },
});

// Inset ring color/opacity/arbitrary/custom property ( supports+fallback)
functionalUtility({
  name: "inset-ring",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  themeKeys: ["colors", "shadows"],
  handle: (value, ctx, token, extra) => {
    const main = value;
    const opacity = extra?.opacity;
    const realThemeValue = extra?.realThemeValue;
    if (realThemeValue) {
      return createRingColorDecls(
        "--baro-inset-ring-color",
        main,
        opacity,
        realThemeValue
      );
    }
    if (main.startsWith("color:")) {
      const cp = main.replace("color:", "");
      let colorMix = `var(${cp})`;
      let fallback = colorMix;
      if (opacity) {
        colorMix = `color-mix(in oklab, var(${cp}) ${opacity}%, transparent)`;
        fallback = colorMix;
      }
      return [
        atRule("supports", "(color:color-mix(in lab, red, red))", [
          decl("--baro-inset-ring-color", colorMix),
        ]),
        decl("--baro-inset-ring-color", fallback),
      ];
    }
    if (token.arbitrary) {
      let colorMix = main;
      let fallback = main;
      if (opacity) {
        colorMix = `color-mix(in oklab, ${main} ${opacity}%, transparent)`;
        if (parseColor(main) && main.startsWith("#")) {
          const opacityValue = Math.round((Number(opacity) / 100) * 255);
          fallback = `${main}${opacityValue.toString(16).padStart(2, "0")}`;
        } else {
          fallback = colorMix;
        }

        return [
          atRule("supports", "(color:color-mix(in lab, red, red))", [
            decl("--baro-inset-ring-color", colorMix),
          ]),
          decl("--baro-inset-ring-color", fallback),
        ];
      }

      return [decl("box-shadow", `inset ${main}`)];
    }

    if (main === "inherit" || main === "current" || main === "transparent") {
      return [
        decl(
          "--baro-inset-ring-color",
          main === "current" ? "currentColor" : main
        ),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("color:")) {
      const cp = value.replace("color:", "");
      return [decl("--baro-inset-ring-color", `var(${cp})`)];
    }
    return [decl("--baro-inset-ring-color", `var(${value})`)];
  },
});

// --- Opacity  ---

functionalUtility({
  name: "opacity",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    // opacity-100, opacity-75, etc.
    if (parseNumber(value)) {
      let num = Number(value);
      if (num > 1) num = num / 100;
      return [decl("opacity", String(num))];
    }
    // opacity-[.67] → .67
    if (token.arbitrary) {
      return [decl("opacity", value)];
    }
    return null;
  },
  handleCustomProperty: (value) => [decl("opacity", `var(${value})`)],
  description: "opacity utility (number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Mix Blend Mode  ---
[
  ["mix-blend-normal", "normal"],
  ["mix-blend-multiply", "multiply"],
  ["mix-blend-screen", "screen"],
  ["mix-blend-overlay", "overlay"],
  ["mix-blend-darken", "darken"],
  ["mix-blend-lighten", "lighten"],
  ["mix-blend-color-dodge", "color-dodge"],
  ["mix-blend-color-burn", "color-burn"],
  ["mix-blend-hard-light", "hard-light"],
  ["mix-blend-soft-light", "soft-light"],
  ["mix-blend-difference", "difference"],
  ["mix-blend-exclusion", "exclusion"],
  ["mix-blend-hue", "hue"],
  ["mix-blend-saturation", "saturation"],
  ["mix-blend-color", "color"],
  ["mix-blend-luminosity", "luminosity"],
  ["mix-blend-plus-darker", "plus-darker"],
  ["mix-blend-plus-lighter", "plus-lighter"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mix-blend-mode", value as string]]);
});

// --- Background Blend Mode  ---
[
  ["bg-blend-normal", "normal"],
  ["bg-blend-multiply", "multiply"],
  ["bg-blend-screen", "screen"],
  ["bg-blend-overlay", "overlay"],
  ["bg-blend-darken", "darken"],
  ["bg-blend-lighten", "lighten"],
  ["bg-blend-color-dodge", "color-dodge"],
  ["bg-blend-color-burn", "color-burn"],
  ["bg-blend-hard-light", "hard-light"],
  ["bg-blend-soft-light", "soft-light"],
  ["bg-blend-difference", "difference"],
  ["bg-blend-exclusion", "exclusion"],
  ["bg-blend-hue", "hue"],
  ["bg-blend-saturation", "saturation"],
  ["bg-blend-color", "color"],
  ["bg-blend-luminosity", "luminosity"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["background-blend-mode", value as string]], { category: 'effects' });
});

// --- Mask Clip  ---
[
  ["mask-clip-border", "border-box"],
  ["mask-clip-padding", "padding-box"],
  ["mask-clip-content", "content-box"],
  ["mask-clip-fill", "fill-box"],
  ["mask-clip-stroke", "stroke-box"],
  ["mask-clip-view", "view-box"],
  ["mask-no-clip", "no-clip"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-clip", value as string]], { category: 'effects' });
});

// --- Mask Composite  ---
[
  ["mask-add", "add"],
  ["mask-subtract", "subtract"],
  ["mask-intersect", "intersect"],
  ["mask-exclude", "exclude"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-composite", value as string]], { category: 'effects' });
});

// --- Mask Mode  ---
[
  ["mask-alpha", "alpha"],
  ["mask-luminance", "luminance"],
  ["mask-match", "match-source"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-mode", value as string]], { category: 'effects' });
});

// --- Mask Origin  ---
[
  ["mask-origin-border", "border-box"],
  ["mask-origin-padding", "padding-box"],
  ["mask-origin-content", "content-box"],
  ["mask-origin-fill", "fill-box"],
  ["mask-origin-stroke", "stroke-box"],
  ["mask-origin-view", "view-box"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-origin", value as string]], { category: 'effects' });
});

// --- Mask Position  ---
[
  ["mask-top-left", "top left"],
  ["mask-top", "top"],
  ["mask-top-right", "top right"],
  ["mask-left", "left"],
  ["mask-center", "center"],
  ["mask-right", "right"],
  ["mask-bottom-left", "bottom left"],
  ["mask-bottom", "bottom"],
  ["mask-bottom-right", "bottom right"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-position", value as string]], { category: 'effects' });
});
functionalUtility({
  name: "mask-position",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (token.arbitrary) return [decl("mask-position", value)];
    if (token.customProperty) return [decl("mask-position", `var(${value})`)];
    return null;
  },
  handleCustomProperty: (value) => [decl("mask-position", `var(${value})`)],
  description:
    "mask-position utility (static, arbitrary, custom property supported)",
  category: "effects",
});

// --- Mask Repeat  ---
[
  ["mask-repeat", "repeat"],
  ["mask-no-repeat", "no-repeat"],
  ["mask-repeat-x", "repeat-x"],
  ["mask-repeat-y", "repeat-y"],
  ["mask-repeat-space", "space"],
  ["mask-repeat-round", "round"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-repeat", value as string]], { category: 'effects' });
});

// --- Mask Size  ---
[
  ["mask-auto", "auto"],
  ["mask-cover", "cover"],
  ["mask-contain", "contain"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-size", value as string]], { category: 'effects' });
});


// --- Mask Type  ---
[
    ["mask-type-alpha", "alpha"],
    ["mask-type-luminance", "luminance"],
  ].forEach(([name, value]) => {
    staticUtility(name as string, [["mask-type", value as string]], { category: 'effects' });
  });

// mask-size-[value] (arbitrary) & mask-size-(--custom-property)
functionalUtility({
  name: "mask-size",
  prop: "mask-size",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "mask-size utility (static, arbitrary, custom property supported)",
  category: "effects",
});

// --- Mask Image  ---
// Tailwind v4.1.13 registers these mask gradient vars with @property initial values, so a lone
// mask-linear-from-* composes a valid mask-image without inline var() fallbacks.
const maskProperties = () =>
  atRoot([
    property("--baro-mask-linear", "linear-gradient(#fff, #fff)"),
    property("--baro-mask-radial", "linear-gradient(#fff, #fff)"),
    property("--baro-mask-conic", "linear-gradient(#fff, #fff)"),
    property("--baro-mask-linear-position", "0deg"),
    property("--baro-mask-linear-from-position", "0%"),
    property("--baro-mask-linear-to-position", "100%"),
    property("--baro-mask-linear-from-color", "black"),
    property("--baro-mask-linear-to-color", "transparent"),
  ]);

functionalUtility({
  name: "mask-linear-from",
  handleBareValue: ({ value }) => /^(?:100|[1-9]?\d)%$/.test(value) ? value : null,
  handle: (value) => [
    decl("mask-image", "var(--baro-mask-linear), var(--baro-mask-radial), var(--baro-mask-conic)"),
    decl("mask-composite", "intersect"),
    decl("--baro-mask-linear-stops", "var(--baro-mask-linear-position), var(--baro-mask-linear-from-color) var(--baro-mask-linear-from-position), var(--baro-mask-linear-to-color) var(--baro-mask-linear-to-position)"),
    decl("--baro-mask-linear", "linear-gradient(var(--baro-mask-linear-stops))"),
    decl("--baro-mask-linear-from-position", value),
    maskProperties(),
  ],
  category: "effects",
});

staticUtility("mask-none", [["mask-image", "none"]], { category: "effects" });
functionalUtility({
  name: "mask",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (value === "none") return [decl("mask-image", "none")];
    if (token.arbitrary) return [decl("mask-image", value)];
    if (token.customProperty) return [decl("mask-image", `var(${value})`)];
    return null;
  },
  handleCustomProperty: (value) => [decl("mask-image", `var(${value})`)],
  description: "mask-image utility (arbitrary, custom property supported)",
  category: "effects",
});

