import { staticUtility, functionalUtility, registerUtility, themeKeyVar } from "../core/registry";
import { shadowColorDecls, shadowValueDecls } from "./shadow-color";
import { atRoot, decl, property } from "../core/ast";
import { parseNumber } from "../core/utils";
import { parseColor } from "../core/utils";

// --- Filter ---
staticUtility("filter-none", [["filter", "none"]], { category: 'effects' });

functionalUtility({
  name: "filter",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "filter utility (static, arbitrary, custom property supported)",
  category: "effects",
});

const filters = () => {
  return decl("filter", "var(--baro-blur, ) var(--baro-brightness, ) var(--baro-contrast, ) var(--baro-grayscale, ) var(--baro-hue-rotate, ) var(--baro-invert, ) var(--baro-saturate, ) var(--baro-sepia, ) var(--baro-drop-shadow, )");
}

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
  staticUtility(name as string, [
    decl("--baro-blur", `blur(${value})`),
    filters()
  ], { category: 'effects' });
});
staticUtility("blur", [decl("--baro-blur", "blur(8px)"), filters()], { category: 'effects' });
staticUtility("blur-none", [decl("--baro-blur", ""), filters()], { category: 'effects' });

functionalUtility({
  name: "blur",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  // #300: blur-<any theme.blur key> → blur(var(--blur-<key>)); numbers keep the previous pass-through.
  handleBareValue: ({ value, ctx }) => themeKeyVar(ctx, "blur", value, "blur") ?? (/^(\d|\.\d)/.test(value) ? value : null),
  handle: (value, _ctx, token) => {
    if (token.customProperty) return [decl("--baro-blur", `blur(var(${value}))`), filters()];
    return [decl("--baro-blur", `blur(${value})`), filters()];
  },
  handleCustomProperty: (value) => [decl("--baro-blur", `blur(var(${value}))`), filters()],
  description: "blur filter utility (static, arbitrary, custom property supported)",
  category: "effects",
});

// --- Brightness ---

functionalUtility({
  name: "brightness",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (token.arbitrary) {
      return [decl("--baro-brightness", `brightness(${value})`), filters()];
    }
    if (parseNumber(value)) {
      return [decl("--baro-brightness", `brightness(${value}%)`), filters()];
    }
    if (token.customProperty)
      return [decl("--baro-brightness", `brightness(var(${value}))`), filters()];
    return [decl("--baro-brightness", `brightness(${value})`), filters()];
  },
  handleCustomProperty: (value) => [
    decl("--baro-brightness", `brightness(var(${value}))`),
    filters()
  ],
  description:
    "brightness filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Contrast ---
functionalUtility({
  name: "contrast",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, token) => {
    if (token.arbitrary) {
      return [decl("--baro-contrast", `contrast(${value})`), filters()];
    }
    if (parseNumber(value)) {
      return [decl("--baro-contrast", `contrast(${value}%)`), filters()];
    }
    if (token.customProperty)
      return [decl("--baro-contrast", `contrast(var(${value}))`), filters()];
    return [decl("--baro-contrast", `contrast(${value})`), filters()];
  },
  handleCustomProperty: (value) => [decl("--baro-contrast", `contrast(var(${value}))`), filters()],
  description:
    "contrast filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Drop Shadow (#313: Tailwind 4.3.3 sizes, colours and opacity modifiers) ---
const dropShadowProperties = () =>
  atRoot([
    property("--baro-drop-shadow"),
    property("--baro-drop-shadow-color"),
    property("--baro-drop-shadow-alpha", "100%", "<percentage>"),
    property("--baro-drop-shadow-size"),
  ]);
const wrapDropShadow = (layers: string[]) => layers.map((l) => `drop-shadow(${l})`).join(" ");
// Bare `drop-shadow` is the deprecated two-layer theme reference.
const DROP_SHADOW_DEFAULT = "0 1px 2px rgb(0 0 0 / 0.1), 0 1px 1px rgb(0 0 0 / 0.06)";
const namedDropShadow = (ctx: { theme: (...k: string[]) => unknown }, name: string) => {
  const v = ctx.theme("dropShadow", name);
  return typeof v === "string" && /^[\w.-]+$/.test(name) ? v : null;
};

// A drop-shadow value: `named` keeps Tailwind's drop-shadow(var(--drop-shadow-<name>)) when unfaded.
function dropShadowValue(value: string, opacity: string | undefined, named?: string, keepNamed = false) {
  const decls = shadowValueDecls("drop-shadow", "--baro-drop-shadow-size", value, opacity, wrapDropShadow);
  if (!decls) return null;
  const composed = named !== undefined && (!opacity || keepNamed) ? named : "var(--baro-drop-shadow-size)";
  return [dropShadowProperties(), ...decls, decl("--baro-drop-shadow", composed), filters()];
}

staticUtility("drop-shadow-none", [decl("--baro-drop-shadow", " "), filters()]);
registerUtility({
  name: "drop-shadow",
  match: (className: string) => /^drop-shadow(\/.+)?$/.test(className),
  handler: (value, _ctx, token) => {
    const full = value ? `${token.prefix}-${value}` : token.prefix;
    const cut = full.indexOf("/");
    const opacity = cut < 0 ? undefined : full.slice(cut + 1);
    const literal = "drop-shadow(0 1px 2px rgb(0 0 0 / 0.1)) drop-shadow( 0 1px 1px rgb(0 0 0 / 0.06))";
    return dropShadowValue(DROP_SHADOW_DEFAULT, opacity, literal, true) ?? [];
  },
  category: "effects",
});

const dropShadowColor = (color: string, opacity: string | undefined, ref?: string) => {
  const decls = shadowColorDecls("drop-shadow", color, opacity, ref);
  return decls && [dropShadowProperties(), ...decls, decl("--baro-drop-shadow", "var(--baro-drop-shadow-size)")];
};

functionalUtility({
  name: "drop-shadow",
  themeKeys: ['colors'],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handleBareValue: ({ value, ctx }) => (namedDropShadow(ctx, value) ? value : null),
  handle: (value, ctx, token, extra) => {
    const opacity = extra?.opacity;
    const keyword = token.arbitrary ? undefined : ({ inherit: "inherit", current: "currentcolor", transparent: "transparent" } as Record<string, string>)[extra?.realThemeValue ?? value];
    if (keyword) return dropShadowColor(keyword, opacity);
    // #338: a key that is both a drop shadow and a colour is the drop shadow, as in Tailwind 4.3.3.
    const key = extra?.realThemeValue ?? value;
    const named = token.arbitrary ? null : namedDropShadow(ctx, key);
    if (named) return dropShadowValue(named, opacity, `drop-shadow(var(--drop-shadow-${key}))`);
    if (extra?.realThemeValue) return dropShadowColor(value, opacity, `var(--color-${extra.realThemeValue})`);
    if (token.arbitrary) {
      if (parseColor(value)) return dropShadowColor(value, opacity);
      return dropShadowValue(value, opacity);
    }
    return null;
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("color:")) return dropShadowColor(`var(${value.slice(6)})`, undefined) ?? [];
    return [
      dropShadowProperties(),
      decl("--baro-drop-shadow-size", `drop-shadow(var(${value}))`),
      decl("--baro-drop-shadow", `var(--baro-drop-shadow-size)`),
      filters(),
    ];
  },
  description:
    "drop-shadow filter utility (static, arbitrary, custom property supported)",
  category: "effects",
});

// --- Grayscale ---
staticUtility("grayscale", [decl("--baro-grayscale", "grayscale(100%)"), filters()], { category: "effects" });

functionalUtility({
  name: "grayscale",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value) => {
    if (parseNumber(value)) {
        return [decl("--baro-grayscale", `grayscale(${value}%)`), filters()];
    }
    return [decl("--baro-grayscale", `grayscale(${value})`), filters()];
  },
  handleCustomProperty: (value) => [decl("--baro-grayscale", `grayscale(var(${value}))`), filters()],
  description: "grayscale filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Hue Rotate ---

functionalUtility({
  name: "hue-rotate",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, _ctx, token) => {
    if (token.negative && parseNumber(token.value!)) {
      return [decl("--baro-hue-rotate", `hue-rotate(calc(${token.value}deg * -1))`), filters()];
    }
    if (parseNumber(value)) {
      return [decl("--baro-hue-rotate", `hue-rotate(${value}deg)`), filters()];
    }
    if (token.customProperty) return [decl("--baro-hue-rotate", `hue-rotate(var(${value}))`), filters()];
    return [decl("--baro-hue-rotate", `hue-rotate(${value})`), filters()];
  },
  handleCustomProperty: (value) => [decl("--baro-hue-rotate", `hue-rotate(var(${value}))`), filters()],
  description: "hue-rotate filter utility (static, negative, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Invert ---
staticUtility("invert", [decl("--baro-invert", "invert(100%)"), filters()], { category: "effects" });

functionalUtility({
  name: "invert",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value) => {
    if (parseNumber(value)) {
      return [decl("--baro-invert", `invert(${value}%)`), filters()];
    }

    return [decl("--baro-invert", `invert(${value})`), filters()];
  },
  description: "invert filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Saturate ---
functionalUtility({
  name: "saturate",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value) => {
    if (parseNumber(value)) {
      return [decl("--baro-saturate", `saturate(${value}%)`), filters()];
    }
    return [decl("--baro-saturate", `saturate(${value})`), filters()];
  },
  handleCustomProperty: (value) => [decl("--baro-saturate", `saturate(var(${value}))`), filters()],
  description: "saturate filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Sepia ---
staticUtility("sepia", [decl("--baro-sepia", "sepia(100%)"), filters()], { category: "effects" });

functionalUtility({
  name: "sepia",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value) => {
    if (parseNumber(value)) {
      return [decl("--baro-sepia", `sepia(${value}%)`), filters()];
    }
    return [decl("--baro-sepia", `sepia(${value})`), filters()];
  },
  handleCustomProperty: (value) => [decl("--baro-sepia", `sepia(var(${value}))`), filters()],
  description: "sepia filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});
