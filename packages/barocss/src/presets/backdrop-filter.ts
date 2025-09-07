import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import { parseNumber } from "../core/utils";



const filters = () => {
  return [
    decl("-webkit-backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"),
    decl("backdrop-filter", "var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, )"),
  ]
}

// --- Backdrop Filter ---
staticUtility("backdrop-filter", [["backdrop-filter", "var(--tw-backdrop-filter)"]], { category: 'effects' });
staticUtility("backdrop-filter-none", [["backdrop-filter", "none"]], { category: 'effects' });

functionalUtility({
  name: "backdrop-filter",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "filter utility (static, arbitrary, custom property supported)",
  category: "effects",
});

// --- Blur ---
[
  ["backdrop-blur-xs", "var(--blur-xs)"],
  ["backdrop-blur-sm", "var(--blur-sm)"],
  ["backdrop-blur-md", "var(--blur-md)"],
  ["backdrop-blur-lg", "var(--blur-lg)"],
  ["backdrop-blur-xl", "var(--blur-xl)"],
  ["backdrop-blur-2xl", "var(--blur-2xl)"],
  ["backdrop-blur-3xl", "var(--blur-3xl)"],
].forEach(([name, value]) => {
  staticUtility(name as string, [
    decl("--tw-backdrop-blur", `blur(${value})`),
    ...filters()
  ], { category: 'effects' });
});
staticUtility("backdrop-blur-none", [decl("--tw-backdrop-blur", ""), ...filters()], { category: 'effects' });

functionalUtility({
  name: "backdrop-blur",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, token) => {
    if (token.customProperty) return [decl("--tw-backdrop-blur", `blur(var(${value}))`), ...filters()];
    return [decl("--tw-backdrop-blur", `blur(${value})`), ...filters()];
  },
  handleCustomProperty: (value) => [decl("--tw-backdrop-blur", `blur(var(${value}))`), ...filters()],
  description: "blur filter utility (static, arbitrary, custom property supported)",
  category: "effects",
});

// --- Brightness ---

functionalUtility({
  name: "backdrop-brightness",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, token) => {
    if (parseNumber(value)) {
        return [decl("--tw-backdrop-brightness", `brightness(${value}%)`), ...filters()];
    }
    if (token.customProperty)
      return [decl("--tw-backdrop-brightness", `brightness(var(${value}))`), ...filters()];
    return [decl("--tw-backdrop-brightness", `brightness(${value})`), ...filters()];
  },
  handleCustomProperty: (value) => [
    decl("--tw-backdrop-brightness", `brightness(var(${value}))`),
    ...filters()
  ],
  description:
    "brightness filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Contrast ---
functionalUtility({
  name: "backdrop-contrast",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, token) => {
    if (parseNumber(value)) {
      return [decl("--tw-backdrop-contrast", `contrast(${value}%)`), ...filters()];
    }
    if (token.customProperty)
      return [decl("--tw-backdrop-contrast", `contrast(var(${value}))`), ...filters()];
    return [decl("--tw-backdrop-contrast", `contrast(${value})`), ...filters()];
  },
  handleCustomProperty: (value) => [decl("--tw-backdrop-contrast", `contrast(var(${value}))`), ...filters()],
  description:
    "contrast filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Grayscale ---
staticUtility("backdrop-grayscale", [["backdrop-filter", "grayscale(100%)"]], { category: 'effects' });

functionalUtility({
  name: "backdrop-grayscale",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    if (parseNumber(value)) {
      return [decl("--tw-backdrop-grayscale", `grayscale(${value}%)`), ...filters()];
    }
    return [decl("--tw-backdrop-grayscale", `grayscale(${value})`), ...filters()];
  },
  handleCustomProperty: (value) => [decl("--tw-backdrop-grayscale", `grayscale(var(${value}))`), ...filters()],
  description: "grayscale filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Hue Rotate ---

functionalUtility({
  name: "backdrop-hue-rotate",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, _ctx, token) => {
    if (token.negative && parseNumber(token.value!)) {
        return [decl("--tw-backdrop-hue-rotate", `hue-rotate(calc(${token.value}deg * -1))`), ...filters()];
    }
    if (parseNumber(value)) {
      return [decl("--tw-backdrop-hue-rotate", `hue-rotate(${value}deg)`), ...filters()];
    }
    return [decl("--tw-backdrop-hue-rotate", `hue-rotate(${value})`), ...filters()];
  },
  handleCustomProperty: (value) => [decl("--tw-backdrop-hue-rotate", `hue-rotate(var(${value}))`), ...filters()],
  description: "hue-rotate filter utility (static, negative, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Invert ---
staticUtility("backdrop-invert", [["backdrop-filter", "invert(100%)"]], { category: 'effects' });

functionalUtility({
  name: "backdrop-invert",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    if (parseNumber(value)) {
      return [decl("--tw-backdrop-invert", `invert(${value}%)`), ...filters()];
    }

    return [decl("--tw-backdrop-invert", `invert(${value})`), ...filters()];
  },
  description: "invert filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Saturate ---
functionalUtility({
  name: "backdrop-saturate",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    if (parseNumber(value)) {
      return [decl("--tw-backdrop-saturate", `saturate(${value}%)`), ...filters()];
    }
    return [decl("--tw-backdrop-saturate", `saturate(${value})`), ...filters()];
  },
  handleCustomProperty: (value) => [decl("--tw-backdrop-saturate", `saturate(var(${value}))`), ...filters()],
  description: "saturate filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});

// --- Sepia ---
staticUtility("backdrop-sepia", [["backdrop-filter", "sepia(100%)"]], {category: "effects"});

functionalUtility({
  name: "backdrop-sepia",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    if (parseNumber(value)) {
      return [decl("--tw-backdrop-sepia", `sepia(${value}%)`), ...filters()];
    }
    return [decl("--tw-backdrop-sepia", `sepia(${value})`), ...filters()];
  },
  handleCustomProperty: (value) => [decl("--tw-backdrop-sepia", `sepia(var(${value}))`), ...filters()],
  description: "sepia filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});
