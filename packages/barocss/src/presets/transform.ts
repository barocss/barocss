// --- Transform Utilities ---
import { atRoot, decl, property } from "../core/ast";
import { staticUtility, functionalUtility } from "../core/registry";
import { parseFractionOrNumber, parseNumber } from "../core/utils";

// Like Tailwind v4, the per-axis rotate/scale/translate utilities set only their own --baro-* var and a shared composite
// declaration reads all axes: rotate/skew with empty fallbacks, scale/translate through @property-registered defaults.
// A lone rotate-x-*/scale-y-*/translate-x-* therefore never references an undefined var, and axes combine.
const ROTATE_SKEW =
  "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)";
const rotateAxis = (axis: string, fn: string) => [decl(`--baro-rotate-${axis}`, fn), decl("transform", ROTATE_SKEW)];
const skewAxis = (axis: string, fn: string) => [decl(`--baro-skew-${axis}`, fn), decl("transform", ROTATE_SKEW)];

const scaleProperties = () =>
  atRoot([
    property("--baro-scale-x", "1"),
    property("--baro-scale-y", "1"),
    property("--baro-scale-z", "1"),
  ]);
const scaleAxis = (axis: string, v: string) => [
  scaleProperties(),
  decl(`--baro-scale-${axis}`, v),
  decl("scale", axis === "z" ? "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)" : "var(--baro-scale-x) var(--baro-scale-y)"),
];

// --- Transform  ---
// transform-none: disables all transforms
staticUtility("transform-none", [["transform", "none"]], {
  category: "transform",
});

// transform-gpu: enables GPU acceleration for transforms
// Output: transform: translateZ(0) <ROTATE_SKEW>
staticUtility(
  "transform-gpu",
  [
    [
      "transform",
      `translateZ(0) ${ROTATE_SKEW}`,
    ],
  ],
  { category: "transform" }
);

// transform-cpu: disables GPU acceleration, uses only CPU transforms
// Output: transform: <ROTATE_SKEW>
staticUtility("transform-cpu", [
  [
    "transform",
    ROTATE_SKEW,
  ],
]);

// --- Transform Style  ---
//  transform-style documentation

// transform-3d: transform-style: preserve-3d;
staticUtility("transform-3d", [["transform-style", "preserve-3d"]], {
  category: "transform",
});
// transform-flat: transform-style: flat;
staticUtility("transform-flat", [["transform-style", "flat"]], {
  category: "transform",
});

// transform-(<custom-property>): sets transform to a CSS custom property value
// Example: transform-(--my-transform) → transform: var(--my-transform);
functionalUtility({
  name: "transform",
  prop: "transform",
  supportsCustomProperty: true,
  handleCustomProperty: (value) => [decl("transform", `var(${value})`)],
  description:
    "transform utility for custom property (transform-(--my-transform))",
  category: "transform",
});

// transform-[<value>]: sets transform to an arbitrary value
// Example: transform-[matrix(1,2,3,4,5,6)] → transform: matrix(1,2,3,4,5,6);
functionalUtility({
  name: "transform",
  prop: "transform",
  supportsArbitrary: true,
  handle: (value) => [decl("transform", value)],
  description: "transform utility for arbitrary value (transform-[...])",
  category: "transform",
});

// --- Backface Visibility ---
//  backface-visibility documentation
staticUtility("backface-hidden", [["backface-visibility", "hidden"]], {
  category: "transform",
});
staticUtility("backface-visible", [["backface-visibility", "visible"]], {
  category: "transform",
});

// --- Perspective ---
//  perspective documentation
staticUtility(
  "perspective-dramatic",
  [["perspective", "var(--perspective-dramatic)"]],
  { category: "transform" }
); // 100px
staticUtility(
  "perspective-near",
  [["perspective", "var(--perspective-near)"]],
  { category: "transform" }
); // 300px
staticUtility(
  "perspective-normal",
  [["perspective", "var(--perspective-normal)"]],
  { category: "transform" }
); // 500px
staticUtility(
  "perspective-midrange",
  [["perspective", "var(--perspective-midrange)"]],
  { category: "transform" }
); // 800px
staticUtility(
  "perspective-distant",
  [["perspective", "var(--perspective-distant)"]],
  { category: "transform" }
); // 1200px
staticUtility("perspective-none", [["perspective", "none"]], {
  category: "transform",
});

// --- Perspective Origin ---
//  perspective-origin documentation
staticUtility("perspective-origin-center", [["perspective-origin", "center"]], {
  category: "transform",
});
staticUtility("perspective-origin-top", [["perspective-origin", "top"]], {
  category: "transform",
});
staticUtility(
  "perspective-origin-top-right",
  [["perspective-origin", "top right"]],
  { category: "transform" }
);
staticUtility("perspective-origin-right", [["perspective-origin", "right"]], {
  category: "transform",
});
staticUtility(
  "perspective-origin-bottom-right",
  [["perspective-origin", "bottom right"]],
  { category: "transform" }
);
staticUtility("perspective-origin-bottom", [["perspective-origin", "bottom"]], {
  category: "transform",
});
staticUtility(
  "perspective-origin-bottom-left",
  [["perspective-origin", "bottom left"]],
  { category: "transform" }
);
staticUtility("perspective-origin-left", [["perspective-origin", "left"]], {
  category: "transform",
});
staticUtility(
  "perspective-origin-top-left",
  [["perspective-origin", "top left"]],
  { category: "transform" }
);

functionalUtility({
  name: "perspective-origin",
  prop: "perspective-origin",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value) => [decl("perspective-origin", value)],
  handleCustomProperty: (value) => [
    decl("perspective-origin", `var(${value})`),
  ],
  description:
    "perspective-origin utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// perspective-(<custom-property>) → perspective: var(--custom-property)
functionalUtility({
  name: "perspective",
  prop: "perspective",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value) => {
    // perspective-[750px] → perspective: 750px
    return [decl("perspective", value)];
  },
  handleCustomProperty: (value) => [decl("perspective", `var(${value})`)],
  description:
    "perspective utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// --- Rotate ---
//  rotate documentation

// rotate-none
staticUtility("rotate-none", [["rotate", "none"]], { category: "transform" });

// rotate-x-<number>, -rotate-x-<number>, rotate-x-(<custom-property>), rotate-x-[<value>]
functionalUtility({
  name: "rotate-x",
  prop: "transform",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative }) => {
    // rotate-x-45 → --baro-rotate-x: rotateX(45deg); transform: ROTATE_SKEW
    // -rotate-x-45 → --baro-rotate-x: rotateX(-45deg); transform: ROTATE_SKEW
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return rotateAxis("x", `rotateX(${sign}${deg})`);
    }
    // rotate-x-[3.142rad] → --baro-rotate-x: rotateX(3.142rad); transform: ROTATE_SKEW
    return rotateAxis("x", `rotateX(${value})`);
  },
  handleCustomProperty: (value) => rotateAxis("x", `rotateX(var(${value}))`),
  description: "rotate-x utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// rotate-y-<number>, -rotate-y-<number>, rotate-y-(<custom-property>), rotate-y-[<value>]
functionalUtility({
  name: "rotate-y",
  prop: "transform",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative }) => {
    // rotate-y-45 → --baro-rotate-y: rotateY(45deg); transform: ROTATE_SKEW
    // -rotate-y-45 → --baro-rotate-y: rotateY(-45deg); transform: ROTATE_SKEW
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return rotateAxis("y", `rotateY(${sign}${deg})`);
    }
    // rotate-y-[3.142rad] → --baro-rotate-y: rotateY(3.142rad); transform: ROTATE_SKEW
    return rotateAxis("y", `rotateY(${value})`);
  },
  handleCustomProperty: (value) => rotateAxis("y", `rotateY(var(${value}))`),
  description: "rotate-y utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// rotate-z-<number>, -rotate-z-<number>, rotate-z-(<custom-property>), rotate-z-[<value>]
functionalUtility({
  name: "rotate-z",
  prop: "transform",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative }) => {
    // rotate-z-45 → --baro-rotate-z: rotateZ(45deg); transform: ROTATE_SKEW
    // -rotate-z-45 → --baro-rotate-z: rotateZ(-45deg); transform: ROTATE_SKEW
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return rotateAxis("z", `rotateZ(${sign}${deg})`);
    }
    // rotate-z-[3.142rad] → --baro-rotate-z: rotateZ(3.142rad); transform: ROTATE_SKEW
    return rotateAxis("z", `rotateZ(${value})`);
  },
  handleCustomProperty: (value) => rotateAxis("z", `rotateZ(var(${value}))`),
  description: "rotate-z utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// rotate-<number>, -rotate-<number>, rotate-(<custom-property>), rotate-[<value>]
functionalUtility({
  name: "rotate",
  prop: "rotate",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative }) => {
    // rotate-45 → rotate: 45deg
    // -rotate-45 → rotate: calc(45deg * -1)
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      if (negative || String(value).startsWith("-")) {
        return [decl("rotate", `calc(${deg} * -1)`)];
      }

      return [decl("rotate", deg)];
    }
    // rotate-[3.142rad] → rotate: 3.142rad
    return [decl("rotate", value)];
  },
  handleCustomProperty: (value) => [decl("rotate", `var(${value})`)],
  description: "rotate utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// --- Scale ---
//  scale documentation

// scale-none
staticUtility("scale-none", [["scale", "none"]], { category: "transform" });
// scale-3d
staticUtility(
  "scale-3d",
  [scaleProperties, ["scale", "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)"]],
  { category: "transform" }
);

// scale-x-<number>, -scale-x-<number>, scale-x-(<custom-property>), scale-x-[<value>]
functionalUtility({
  name: "scale-x",
  prop: "scale",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative, arbitrary }) => {
    if (arbitrary) {
      return scaleAxis("x", value);
    }

    // scale-x-75 → --baro-scale-x: 75%; scale reads all axes
    // -scale-x-75 → --baro-scale-x: calc(75% * -1); scale reads all axes
    if (parseNumber(value) || negative) {
      const pct = `${Math.abs(Number(value))}%`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return scaleAxis("x", `calc(${pct} * ${sign}1)`);
    }
    // scale-x-[1.7] → --baro-scale-x: 1.7; scale reads all axes
    return scaleAxis("x", value);
  },
  handleCustomProperty: (value) => scaleAxis("x", `var(${value})`),
  description: "scale-x utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// scale-y-<number>, -scale-y-<number>, scale-y-(<custom-property>), scale-y-[<value>]
functionalUtility({
  name: "scale-y",
  prop: "scale",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative, arbitrary }) => {
    if (arbitrary) {
      return scaleAxis("y", value);
    }

    // scale-y-75 → --baro-scale-y: 75%; scale reads all axes
    // -scale-y-75 → --baro-scale-y: calc(75% * -1); scale reads all axes
    if (parseNumber(value) || negative) {
      const pct = `${Math.abs(Number(value))}%`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return scaleAxis("y", `calc(${pct} * ${sign}1)`);
    }
    // scale-y-[1.7] → --baro-scale-y: 1.7; scale reads all axes
    return scaleAxis("y", value);
  },
  handleCustomProperty: (value) => scaleAxis("y", `var(${value})`),
  description: "scale-y utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// scale-z-<number>, -scale-z-<number>, scale-z-(<custom-property>), scale-z-[<value>]
functionalUtility({
  name: "scale-z",
  prop: "scale",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative, arbitrary }) => {
    if (arbitrary) {
      return scaleAxis("z", value);
    }

    // scale-z-75 → --baro-scale-z: 75%; scale reads all axes
    // -scale-z-75 → --baro-scale-z: calc(75% * -1); scale reads all axes
    if (parseNumber(value) || negative) {
      const pct = `${Math.abs(Number(value))}%`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return scaleAxis("z", `calc(${pct} * ${sign}1)`);
    }
    // scale-z-[1.7] → --baro-scale-z: 1.7; scale reads all axes
    return scaleAxis("z", value);
  },
  handleCustomProperty: (value) => scaleAxis("z", `var(${value})`),
  description: "scale-z utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// scale-<number>, -scale-<number>, scale-(<custom-property>), scale-[<value>]
functionalUtility({
  name: "scale",
  prop: "scale",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative, arbitrary }) => {
    if (arbitrary) {
      return [decl("scale", `${value}`)];
    }

    // scale-75 → scale: 75% 75%
    // -scale-75 → scale: calc(75% * -1) calc(75% * -1)
    if (parseNumber(value) || negative) {
      const pct = `${Math.abs(Number(value))}%`;
      if (negative || String(value).startsWith("-")) {
        return [decl("scale", `calc(${pct} * -1) calc(${pct} * -1)`)];
      }
      return [decl("scale", `${pct} ${pct}`)];
    }
    // scale-[1.7] → scale: 1.7
    return [decl("scale", value)];
  },
  handleCustomProperty: (value) => [
    decl("scale", `var(${value}) var(${value})`),
  ],
  description: "scale utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// --- Skew ---
//  skew documentation

// skew-x-<number>, -skew-x-<number>, skew-x-(<custom-property>), skew-x-[<value>]
functionalUtility({
  name: "skew-x",
  prop: "transform",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative }) => {
    // skew-x-4 → transform: skewX(4deg)
    // -skew-x-4 → transform: skewX(-4deg)
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return skewAxis("x", `skewX(${sign}${deg})`);
    }
    // skew-x-[3.142rad] → transform: skewX(3.142rad)
    return skewAxis("x", `skewX(${value})`);
  },
  handleCustomProperty: (value) => skewAxis("x", `skewX(var(${value}))`),
  description: "skew-x utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// skew-y-<number>, -skew-y-<number>, skew-y-(<custom-property>), skew-y-[<value>]
functionalUtility({
  name: "skew-y",
  prop: "transform",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative }) => {
    // skew-y-4 → transform: skewY(4deg)
    // -skew-y-4 → transform: skewY(-4deg)
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return skewAxis("y", `skewY(${sign}${deg})`);
    }
    // skew-y-[3.142rad] → transform: skewY(3.142rad)
    return skewAxis("y", `skewY(${value})`);
  },
  handleCustomProperty: (value) => skewAxis("y", `skewY(var(${value}))`),
  description: "skew-y utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// skew-<number>, -skew-<number>, skew-(<custom-property>), skew-[<value>]
functionalUtility({
  name: "skew",
  prop: "transform",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsNegative: true,
  handle: (value, ctx, { negative }) => {
    // skew-4 → transform: skewX(4deg) skewY(4deg)
    // -skew-4 → transform: skewX(-4deg) skewY(-4deg)
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return [decl("--baro-skew-x", `skewX(${sign}${deg})`), decl("--baro-skew-y", `skewY(${sign}${deg})`), decl("transform", ROTATE_SKEW)];
    }
    // skew-[3.142rad] → transform: skewX(3.142rad) skewY(3.142rad)
    return [decl("--baro-skew-x", `skewX(${value})`), decl("--baro-skew-y", `skewY(${value})`), decl("transform", ROTATE_SKEW)];
  },
  handleCustomProperty: (value) => [
    decl("--baro-skew-x", `skewX(var(${value}))`),
    decl("--baro-skew-y", `skewY(var(${value}))`),
    decl("transform", ROTATE_SKEW),
  ],
  description: "skew utility (named, arbitrary, custom property supported)",
  category: "transform",
});

// --- Transform Origin  ---
//  transform-origin documentation

// origin-center: transform-origin: center;
staticUtility("origin-center", [["transform-origin", "center"]], {
  category: "transform",
});
// origin-top: transform-origin: top;
staticUtility("origin-top", [["transform-origin", "top"]], {
  category: "transform",
});
// origin-top-right: transform-origin: top right;
staticUtility("origin-top-right", [["transform-origin", "top right"]], {
  category: "transform",
});
// origin-right: transform-origin: right;
staticUtility("origin-right", [["transform-origin", "right"]], {
  category: "transform",
});
// origin-bottom-right: transform-origin: bottom right;
staticUtility("origin-bottom-right", [["transform-origin", "bottom right"]], {
  category: "transform",
});
// origin-bottom: transform-origin: bottom;
staticUtility("origin-bottom", [["transform-origin", "bottom"]], {
  category: "transform",
});
// origin-bottom-left: transform-origin: bottom left;
staticUtility("origin-bottom-left", [["transform-origin", "bottom left"]], {
  category: "transform",
});
// origin-left: transform-origin: left;
staticUtility("origin-left", [["transform-origin", "left"]], {
  category: "transform",
});
// origin-top-left: transform-origin: top left;
staticUtility("origin-top-left", [["transform-origin", "top left"]], {
  category: "transform",
});

// origin-(<custom-property>): transform-origin: var(--custom-property);
functionalUtility({
  name: "origin",
  prop: "transform-origin",
  supportsCustomProperty: true,
  supportsArbitrary: true,
  description:
    "transform-origin utility for custom property (origin-(--my-transform-origin))",
  category: "transform",
});

// --- Translate  ---
//  translate documentation

const translateProperties = () =>
  atRoot([
    property("--baro-translate-x", "0"),
    property("--baro-translate-y", "0"),
    property("--baro-translate-z", "0"),
  ]);

const translateAxis = (axis: string, v: string) => [
  translateProperties(),
  decl(`--baro-translate-${axis}`, v),
  decl(
    "translate",
    axis === "z"
      ? "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
      : "var(--baro-translate-x) var(--baro-translate-y)"
  ),
];
const staticTranslateAxis = (axis: string, v: string) => [
  translateProperties,
  [`--baro-translate-${axis}`, v] as [string, string],
  [
    "translate",
    axis === "z"
      ? "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
      : "var(--baro-translate-x) var(--baro-translate-y)",
  ] as [string, string],
];

// --- Static translate utilities ---
// translate-none: disables all translation
staticUtility("translate-none", [["translate", "none"]], {
  category: "transform",
});

// translate-px, -translate-px, translate-full, -translate-full
staticUtility("translate-px", [["translate", "1px 1px"]], {
  category: "transform",
});
staticUtility("-translate-px", [["translate", "-1px -1px"]], {
  category: "transform",
});
staticUtility(
  "translate-full",
  [
    translateProperties,
    ["--baro-translate-x", "100%"],
    ["--baro-translate-y", "100%"],
    ["translate", "var(--baro-translate-x) var(--baro-translate-y)"],
  ],
  { category: "transform" }
);
staticUtility(
  "-translate-full",
  [
    translateProperties,
    ["--baro-translate-x", "-100%"],
    ["--baro-translate-y", "-100%"],
    ["translate", "var(--baro-translate-x) var(--baro-translate-y)"],
  ],
  { category: "transform" }
);

// translate-x-px, -translate-x-px, translate-x-full, -translate-x-full
staticUtility(
  "translate-x-px",
  staticTranslateAxis("x", "1px"),
  { category: "transform" }
);
staticUtility(
  "-translate-x-px",
  staticTranslateAxis("x", "-1px"),
  { category: "transform" }
);
staticUtility(
  "translate-x-full",
  staticTranslateAxis("x", "100%"),
  { category: "transform" }
);
staticUtility(
  "-translate-x-full",
  staticTranslateAxis("x", "-100%"),
  { category: "transform" }
);

// translate-y-px, -translate-y-px, translate-y-full, -translate-y-full
staticUtility(
  "translate-y-px",
  staticTranslateAxis("y", "1px"),
  { category: "transform" }
);
staticUtility(
  "-translate-y-px",
  staticTranslateAxis("y", "-1px"),
  { category: "transform" }
);
staticUtility(
  "translate-y-full",
  staticTranslateAxis("y", "100%"),
  { category: "transform" }
);
staticUtility(
  "-translate-y-full",
  staticTranslateAxis("y", "-100%"),
  { category: "transform" }
);

// translate-z-px, -translate-z-px
staticUtility(
  "translate-z-px",
  staticTranslateAxis("z", "1px"),
  { category: "transform" }
);
staticUtility(
  "-translate-z-px",
  staticTranslateAxis("z", "-1px"),
  { category: "transform" }
);

// --- Functional translate utilities ---

// translate-x-<number|fraction|arbitrary|custom>, negative supported
functionalUtility({
  name: "translate-x",
  prop: "translate",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, { negative }) => {
    if (value.includes("/") && parseFractionOrNumber(value)) {
      const v = `calc(${value} * 100%)`;
      return translateAxis("x", v);
    }
    if (parseNumber(value) || negative) {
      const v = `calc(var(--spacing) * ${value})`;
      return translateAxis("x", v);
    }
    return translateAxis("x", value);
  },
  handleCustomProperty: (value) => translateAxis("x", `var(${value})`),
  description:
    "translate-x utility (spacing, fraction, arbitrary, custom property, negative)",
  category: "transform",
});

// translate-y-<number|fraction|arbitrary|custom>, negative supported
functionalUtility({
  name: "translate-y",
  prop: "translate",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, { negative }) => {
    if (value.includes("/") && parseFractionOrNumber(value)) {
      const v = `calc(${value} * 100%)`;
      return translateAxis("y", v);
    }
    if (parseNumber(value) || negative) {
      const v = `calc(var(--spacing) * ${value})`;
      return translateAxis("y", v);
    }
    return translateAxis("y", value);
  },
  handleCustomProperty: (value) => translateAxis("y", `var(${value})`),
  description:
    "translate-y utility (spacing, fraction, arbitrary, custom property, negative)",
  category: "transform",
});

// translate-z-<number|fraction|arbitrary|custom>, negative supported
functionalUtility({
  name: "translate-z",
  prop: "translate",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, { negative }) => {
    if (value.includes("/") && parseFractionOrNumber(value)) {
      const v = `calc(${value} * 100%)`;
      return translateAxis("z", v);
    }

    if (parseNumber(value) || negative) {
      const v = `calc(var(--spacing) * ${value})`;
      return translateAxis("z", v);
    }

    return translateAxis("z", value);
  },
  handleCustomProperty: (value) => translateAxis("z", `var(${value})`),
  description:
    "translate-z utility (spacing, fraction, arbitrary, custom property, negative)",
  category: "transform",
});

// translate-<number|fraction|arbitrary|custom>, negative supported
functionalUtility({
  name: "translate",
  prop: "translate",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, { negative }) => {
    // Fraction
    if (value.includes("/") && parseFractionOrNumber(value)) {
      const v = `calc(${value} * 100%)`;
      return [decl("translate", `${v} ${v}`)];
    }
    // Number (spacing scale)
    if (parseNumber(value) || negative) {
      const v = `calc(var(--spacing) * ${value})`;
      return [decl("translate", `${v} ${v}`)];
    }
    // Arbitrary value
    return [decl("translate", `${value} ${value}`)];
  },
  handleCustomProperty: (value) => [
    decl("translate", `var(${value}) var(${value})`),
  ],
  description:
    "translate utility (spacing, fraction, arbitrary, custom property, negative)",
  category: "transform",
});
