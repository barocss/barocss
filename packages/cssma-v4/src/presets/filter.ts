import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import { parseNumber } from "../core/utils";
import { parseColor } from "../core/utils";

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
    if (token.customProperty)
      return [decl("filter", `brightness(var(${value}))`)];
    return [decl("filter", `brightness(${value})`)];
  },
  handleCustomProperty: (value) => [
    decl("filter", `brightness(var(${value}))`),
  ],
  description:
    "brightness filter utility (static, number, arbitrary, custom property 지원)",
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
    if (token.customProperty)
      return [decl("filter", `contrast(var(${value}))`)];
    return [decl("filter", `contrast(${value})`)];
  },
  handleCustomProperty: (value) => [decl("filter", `contrast(var(${value}))`)],
  description:
    "contrast filter utility (static, number, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Drop Shadow ---
[
  ["drop-shadow-xs", "var(--drop-shadow-xs)"],
  ["drop-shadow-sm", "var(--drop-shadow-sm)"],
  ["drop-shadow-md", "var(--drop-shadow-md)"],
  ["drop-shadow-lg", "var(--drop-shadow-lg)"],
  ["drop-shadow-xl", "var(--drop-shadow-xl)"],
  ["drop-shadow-2xl", "var(--drop-shadow-2xl)"],
  ["drop-shadow-3xl", "var(--drop-shadow-3xl)"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["filter", `drop-shadow(${value})`]]);
});
staticUtility("drop-shadow-none", [["filter", "drop-shadow(0 0 #0000)"]]);

// --- Drop Shadow Color ---
// drop-shadow-inherit, drop-shadow-current, drop-shadow-transparent
["inherit", "current", "transparent"].forEach((name) => {
  staticUtility(`drop-shadow-${name}`, [
    ["--tw-drop-shadow-color", name === "current" ? "currentColor" : name],
  ]);
});

// drop-shadow-black, drop-shadow-white, drop-shadow-{color}-{shade}
["black", "white"].forEach((name) => {
  staticUtility(`drop-shadow-${name}`, [
    ["--tw-drop-shadow-color", `var(--color-${name})`],
  ]);
});

// drop-shadow-(color:--my-color)
functionalUtility({
  name: "drop-shadow",
  themeKeys: ['colors'],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token, extra) => {
    console.log(extra, 'extra', value, 'value', ctx, 'ctx', token, 'token');
    if (extra?.realThemeValue) {
        console.log(extra.realThemeValue, 'extra.realThemeValue');
      return [decl("--tw-drop-shadow-color", `var(--color-${extra.realThemeValue})`)];
    }

    if (parseColor(value)) {
      return [decl("--tw-drop-shadow-color", value)];
    }

    return [decl("filter", `drop-shadow(${value})`)];
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("color:")) {
      return [
        decl("--tw-drop-shadow-color", `var(${value.replace("color:", "")})`),
      ];
    }

    return [decl("filter", `drop-shadow(var(${value}))`)];
  },
  description:
    "drop-shadow filter utility (static, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Grayscale ---
staticUtility("grayscale", [["filter", "grayscale(100%)"]]);

functionalUtility({
  name: "grayscale",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("filter", `grayscale(${value}%)`)];
    }
    return [decl("filter", `grayscale(${value})`)];
  },
  handleCustomProperty: (value) => [decl("filter", `grayscale(var(${value}))`)],
  description: "grayscale filter utility (static, number, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Hue Rotate ---

functionalUtility({
  name: "hue-rotate",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, token) => {
    if (token.negative && parseNumber(token.value!)) {
      return [decl("filter", `hue-rotate(calc(${token.value}deg * -1))`)];
    }
    if (parseNumber(value)) {
      return [decl("filter", `hue-rotate(${value}deg)`)]
    }
    if (token.customProperty) return [decl("filter", `hue-rotate(var(${value}))`)];
    return [decl("filter", `hue-rotate(${value})`)];
  },
  handleCustomProperty: (value) => [decl("filter", `hue-rotate(var(${value}))`)],
  description: "hue-rotate filter utility (static, negative, number, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Invert ---
staticUtility("invert", [["filter", "invert(100%)"]]);

functionalUtility({
  name: "invert",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("filter", `invert(${value}%)`)];
    }

    return [decl("filter", `invert(${value})`)];
  },
  description: "invert filter utility (static, number, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Saturate ---
functionalUtility({
  name: "saturate",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("filter", `saturate(${value}%)`)];
    }
    return [decl("filter", `saturate(${value})`)];
  },
  handleCustomProperty: (value) => [decl("filter", `saturate(var(${value}))`)],
  description: "saturate filter utility (static, number, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Sepia ---
staticUtility("sepia", [["filter", "sepia(100%)"]]);

functionalUtility({
  name: "sepia",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("filter", `sepia(${value}%)`)];
    }
    return [decl("filter", `sepia(${value})`)];
  },
  handleCustomProperty: (value) => [decl("filter", `sepia(var(${value}))`)],
  description: "sepia filter utility (static, number, arbitrary, custom property 지원)",
  category: "effects",
});
