import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
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
staticUtility("blur-none", [decl("--baro-blur", ""), filters()], { category: 'effects' });

functionalUtility({
  name: "blur",
  prop: "filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
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

// --- Drop Shadow ---
[
  ["drop-shadow-xs", "xs", '0 1px 1px var(--baro-drop-shadow-color, #0000001a)'],
  ["drop-shadow-sm", "sm", '0 1px 2px var(--baro-drop-shadow-color, #0000001a)'],
  ["drop-shadow-md", "md", '0 3px 3px var(--baro-drop-shadow-color, #0000001a)'],
  ["drop-shadow-lg", "lg", '0 4px 4px var(--baro-drop-shadow-color, #0000001a)'],
  ["drop-shadow-xl", "xl", '0 9px 7px var(--baro-drop-shadow-color, #0000001a)'],
  ["drop-shadow-2xl", "2xl", '0 25px 25px var(--baro-drop-shadow-color, #0000001a)'],
].forEach(([name, size, sizeValue]) => {
  staticUtility(name as string, [
    decl("--baro-drop-shadow-size", `drop-shadow(${sizeValue})`),
    decl("--baro-drop-shadow", `var(--drop-shadow-${size})`),
    filters()
  ]);
});
staticUtility("drop-shadow-none", [decl("--baro-drop-shadow", "drop-shadow(0 0 #0000)"), filters()]);

// --- Drop Shadow Color ---
// drop-shadow-inherit, drop-shadow-current, drop-shadow-transparent
["inherit", "current", "transparent"].forEach((name) => {
  staticUtility(`drop-shadow-${name}`, [
    decl("--baro-drop-shadow-color", name === "current" ? "currentColor" : name),
  ]);
});

// drop-shadow-black, drop-shadow-white, drop-shadow-{color}-{shade}
["black", "white"].forEach((name) => {
  staticUtility(`drop-shadow-${name}`, [
    decl("--baro-drop-shadow-color", `var(--color-${name})`),
  ]);
});

// drop-shadow-(color:--my-color)
functionalUtility({
  name: "drop-shadow",
  themeKeys: ['colors'],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token, extra) => {
    if (extra?.realThemeValue) {
      return [decl("--baro-drop-shadow-color", `var(--color-${extra.realThemeValue})`)];
    }

    if (parseColor(value)) {
      return [decl("--baro-drop-shadow-color", value)];
    }

    return [
      decl("--baro-drop-shadow-size", `drop-shadow(${value})`),
      decl("--baro-drop-shadow", `var(--baro-drop-shadow-size)`),
    ];
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("color:")) {
      return [
        decl("--baro-drop-shadow-color", `var(${value.replace("color:", "")})`),
      ];
    }

    return [
      decl("--baro-drop-shadow-size", `drop-shadow(var(${value}))`),
      decl("--baro-drop-shadow", `var(--baro-drop-shadow-size)`),
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
