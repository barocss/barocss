import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import { parseColor, parseLength, parseNumber } from "../core/utils";

// --- Background Attachment ---
staticUtility("bg-fixed", [["background-attachment", "fixed"]]);
staticUtility("bg-local", [["background-attachment", "local"]]);
staticUtility("bg-scroll", [["background-attachment", "scroll"]]);

// --- Background Clip ---
staticUtility("bg-clip-border", [["background-clip", "border-box"]]);
staticUtility("bg-clip-padding", [["background-clip", "padding-box"]]);
staticUtility("bg-clip-content", [["background-clip", "content-box"]]);
staticUtility("bg-clip-text", [["background-clip", "text"]]);

// --- Background Color ---
staticUtility("bg-inherit", [["background-color", "inherit"]]);
staticUtility("bg-current", [["background-color", "currentColor"]]);
staticUtility("bg-transparent", [["background-color", "transparent"]]);

// --- Background Image ---
staticUtility("bg-none", [["background-image", "none"]]);

// --- Background Origin ---
staticUtility("bg-origin-border", [["background-origin", "border-box"]]);
staticUtility("bg-origin-padding", [["background-origin", "padding-box"]]);
staticUtility("bg-origin-content", [["background-origin", "content-box"]]);

// --- Background Position ---
[
  ["bg-bottom", "bottom"],
  ["bg-center", "center"],
  ["bg-left", "left"],
  ["bg-left-bottom", "left bottom"],
  ["bg-left-top", "left top"],
  ["bg-right", "right"],
  ["bg-right-bottom", "right bottom"],
  ["bg-right-top", "right top"],
  ["bg-top", "top"],
].forEach(([name, value]) => {
  staticUtility(name, [["background-position", value]]);
});

/** 
 * background-position utility (arbitrary, custom property 지원)
 * 
 * bg-position-[length] → background-position: [length]
 * bg-position-[length] → background-position: [length]
 */
functionalUtility({
  name: "bg-position",
  prop: "background-position",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "background-position utility (arbitrary, custom property 지원)",
  category: "background",
});

// --- Background Repeat ---
staticUtility("bg-repeat", [["background-repeat", "repeat"]]);
staticUtility("bg-no-repeat", [["background-repeat", "no-repeat"]]);
staticUtility("bg-repeat-x", [["background-repeat", "repeat-x"]]);
staticUtility("bg-repeat-y", [["background-repeat", "repeat-y"]]);
staticUtility("bg-repeat-round", [["background-repeat", "round"]]);
staticUtility("bg-repeat-space", [["background-repeat", "space"]]);

// --- Background Size ---
staticUtility("bg-auto", [["background-size", "auto"]]);
staticUtility("bg-cover", [["background-size", "cover"]]);
staticUtility("bg-contain", [["background-size", "contain"]]);

functionalUtility({
  name: "bg-size",
  prop: "background-size",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "background-size utility (arbitrary, custom property 지원)",
  category: "background",
});

// --- Background Gradients: Linear ---
[
  ["bg-linear-to-t", "linear-gradient(to top, var(--tw-gradient-stops))"],
  ["bg-linear-to-tr", "linear-gradient(to top right, var(--tw-gradient-stops))"],
  ["bg-linear-to-r", "linear-gradient(to right, var(--tw-gradient-stops))"],
  ["bg-linear-to-br", "linear-gradient(to bottom right, var(--tw-gradient-stops))"],
  ["bg-linear-to-b", "linear-gradient(to bottom, var(--tw-gradient-stops))"],
  ["bg-linear-to-bl", "linear-gradient(to bottom left, var(--tw-gradient-stops))"],
  ["bg-linear-to-l", "linear-gradient(to left, var(--tw-gradient-stops))"],
  ["bg-linear-to-tl", "linear-gradient(to top left, var(--tw-gradient-stops))"],
].forEach(([name, value]) => {
  staticUtility(name, [["background-image", value]]);
});
// bg-linear-<angle> (e.g., bg-linear-45)
functionalUtility({
  name: "bg-linear",
  prop: "background-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, context, token) => {
    if (parseNumber(value)) {
      // bg-linear-45 → linear-gradient(45deg in oklab, var(--tw-gradient-stops))
      return [decl("background-image", `linear-gradient(${value}deg in oklab, var(--tw-gradient-stops))`)];
    }
    if (token.arbitrary) {
      // bg-linear-[25deg,red_5%,yellow_60%,lime_90%,teal]
      return [decl("background-image", `linear-gradient(var(--tw-gradient-stops, ${value}))`)];
    }
    if (token.customProperty) {
      // bg-linear-(--my-gradient)
      return [decl("background-image", `linear-gradient(var(--tw-gradient-stops, var(${value})))`)];
    }
    return null;
  },
  handleCustomProperty: (value) => [decl("background-image", `linear-gradient(var(--tw-gradient-stops, var(${value})))`)],
  description: "linear-gradient background-image utility (angle, arbitrary, custom property 지원)",
  category: "background",
});

// --- Background Gradients: Radial ---
staticUtility("bg-radial", [["background-image", "radial-gradient(in oklab, var(--tw-gradient-stops))"]]);
functionalUtility({
  name: "bg-radial",
  prop: "background-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, context, token) => {
    if (token.arbitrary) {
      // bg-radial-[at_50%_75%]
      return [decl("background-image", `radial-gradient(var(--tw-gradient-stops, ${value}))`)];
    }
    if (token.customProperty) {
      // bg-radial-(--my-gradient)
      return [decl("background-image", `radial-gradient(var(--tw-gradient-stops, var(${value})))`)];
    }
    return null;
  },
  handleCustomProperty: (value) => [decl("background-image", `radial-gradient(var(--tw-gradient-stops, var(${value})))`)],
  description: "radial-gradient background-image utility (arbitrary, custom property 지원)",
  category: "background",
});

// --- Background Gradients: Conic ---
staticUtility("bg-conic", [["background-image", "conic-gradient(from 0deg in oklab, var(--tw-gradient-stops))"]]);
functionalUtility({
  name: "bg-conic",
  prop: "background-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, context, token) => {
    if (parseNumber(value)) {
      // bg-conic-180 → conic-gradient(from 180deg in oklab, var(--tw-gradient-stops))
      return [decl("background-image", `conic-gradient(from ${value}deg in oklab, var(--tw-gradient-stops))`)];
    }
    if (token.arbitrary) {
      // bg-conic-[at_50%_75%]
      return [decl("background-image", `${value}`)];
    }
    if (token.customProperty) {
      // bg-conic-(--my-gradient)
      return [decl("background-image", `conic-gradient(var(--tw-gradient-stops, var(${value})))`)];
    }
    return null;
  },
  handleCustomProperty: (value) => [decl("background-image", `var(${value})`)],
  description: "conic-gradient background-image utility (angle, arbitrary, custom property 지원)",
  category: "background",
});

// --- Gradient Stops ---
// from-*, via-*, to-* (color, percentage, custom property, arbitrary)
["from", "via", "to"].forEach((stop) => {
  functionalUtility({
    name: stop,
    prop: `--tw-gradient-${stop}`,
    themeKeys: ['colors'],
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value) => {
      // to-50% → --tw-gradient-to-position: 50%
      if (parseLength(value)) {
        return [decl(`--tw-gradient-${stop}-position`, value)];
      }

      // to-50% → --tw-gradient-to: 50%
      if (parseNumber(value)) {
        return [decl(`--tw-gradient-${stop}`, `${value}%`)];
      }

      // to-red-500 → --tw-gradient-to: red-500
      if (parseColor(value)) {
        return [decl(`--tw-gradient-${stop}`, value)];
      }
      return null;
    },
    handleCustomProperty: (value) => [decl(`--tw-gradient-${stop}`, `var(${value})`)],
    description: `${stop} gradient stop utility (color, percent, custom property, arbitrary 지원)`,
    category: "background",
  });
  // position variant: from-10%, via-30%, to-90%
  functionalUtility({
    name: `${stop}-position`,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value) => [decl(`--tw-gradient-${stop}-position`, value)],
    handleCustomProperty: (value) => [decl(`--tw-gradient-${stop}-position`, `var(${value})`)],
    description: `${stop}-position gradient stop position utility (percent, custom property, arbitrary 지원)`,
    category: "background",
  });
});


/**
 * background-size utility (arbitrary, custom property 지원)
 * bg-[length] → background-size: [length]
 * bg-[length] → background-size: [length]
 * bg-[color] → background-color: [color]
 * bg-[url] → background-image: [url]
 * bg-red-500 → background-color: var(--color-red-500)
 */
functionalUtility({
  name: "bg",
  themeKeys: ['colors'],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, context) => {
    if (value.startsWith("url(")) {
      return [decl("background-image", value)];
    }

    if (value.startsWith("length:")) {
      return [decl("background-size", value.replace("length:", ""))];
    }

    const color = parseColor(value);
    if (color) {
      return [decl("background-color", color)];
    }

    return [decl("background-size", value)];
  },
  handleCustomProperty: (value) => [decl("background-size", `var(${value})`)],
  description: "background-size utility (arbitrary, custom property 지원)",
  category: "background",
});

