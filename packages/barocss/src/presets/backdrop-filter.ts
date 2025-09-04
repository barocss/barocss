import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import { parseNumber } from "../core/utils";
import { parseColor } from "../core/utils";

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
  staticUtility(name as string, [["backdrop-filter", `blur(${value})`]], { category: 'effects' });
});
staticUtility("backdrop-blur-none", [["backdrop-filter", ""]], { category: 'effects' });

functionalUtility({
  name: "backdrop-blur",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (token.customProperty) return [decl("backdrop-filter", `blur(var(${value}))`)];
    return [decl("backdrop-filter", `blur(${value})`)];
  },
  handleCustomProperty: (value) => [decl("backdrop-filter", `blur(var(${value}))`)],
  description: "blur filter utility (static, arbitrary, custom property supported)",
  category: "effects",
});

// --- Brightness ---

functionalUtility({
  name: "backdrop-brightness",
  prop: "backdrop-filter",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("backdrop-filter", `brightness(${value}%)`)];
    }
    if (token.customProperty)
      return [decl("backdrop-filter", `brightness(var(${value}))`)];
    return [decl("backdrop-filter", `brightness(${value})`)];
  },
  handleCustomProperty: (value) => [
    decl("backdrop-filter", `brightness(var(${value}))`),
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
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("backdrop-filter", `contrast(${value}%)`)];
    }
    if (token.customProperty)
      return [decl("backdrop-filter", `contrast(var(${value}))`)];
    return [decl("backdrop-filter", `contrast(${value})`)];
  },
  handleCustomProperty: (value) => [decl("backdrop-filter", `contrast(var(${value}))`)],
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
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("backdrop-filter", `grayscale(${value}%)`)];
    }
    return [decl("backdrop-filter", `grayscale(${value})`)];
  },
  handleCustomProperty: (value) => [decl("backdrop-filter", `grayscale(var(${value}))`)],
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
  handle: (value, ctx, token) => {
    if (token.negative && parseNumber(token.value!)) {
      return [decl("backdrop-filter", `hue-rotate(calc(${token.value}deg * -1))`)];
    }
    if (parseNumber(value)) {
      return [decl("backdrop-filter", `hue-rotate(${value}deg)`)]
    }
    return [decl("backdrop-filter", `hue-rotate(${value})`)];
  },
  handleCustomProperty: (value) => [decl("backdrop-filter", `hue-rotate(var(${value}))`)],
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
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("backdrop-filter", `invert(${value}%)`)];
    }

    return [decl("backdrop-filter", `invert(${value})`)];
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
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("backdrop-filter", `saturate(${value}%)`)];
    }
    return [decl("backdrop-filter", `saturate(${value})`)];
  },
  handleCustomProperty: (value) => [decl("backdrop-filter", `saturate(var(${value}))`)],
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
  handle: (value, ctx, token) => {
    if (parseNumber(value)) {
      return [decl("backdrop-filter", `sepia(${value}%)`)];
    }
    return [decl("backdrop-filter", `sepia(${value})`)];
  },
  handleCustomProperty: (value) => [decl("backdrop-filter", `sepia(var(${value}))`)],
  description: "sepia filter utility (static, number, arbitrary, custom property supported)",
  category: "effects",
});
