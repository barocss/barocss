// --- Transform Utilities ---
import { atRoot, decl, property } from "../core/ast";
import { staticUtility, functionalUtility } from "../core/registry";
import { parseFractionOrNumber, parseNumber } from "../core/utils";

const transformProperties = () => {
  return atRoot(
    [
      property("--baro-translate-x", "0"),
      property("--baro-translate-y", "0"),
      property("--baro-translate-z", "0"),
      property("--baro-rotate-x", "0"),
      property("--baro-rotate-y", "0"),
      property("--baro-rotate-z", "0"),
      property("--baro-skew-x", "0"),
      property("--baro-skew-y", "0"),
      property("--baro-scale-x", "1"),
      property("--baro-scale-y", "1"),
      property("--baro-scale-z", "1"),
    ],
    "transform"
  );
};

// --- Transform  ---
// transform-none: disables all transforms
staticUtility("transform-none", [["transform", "none"]], {
  category: "transform",
});

// transform-gpu: enables GPU acceleration for transforms
// Output: transform: translateZ(0) var(--baro-rotate-x) var(--baro-rotate-y) var(--baro-rotate-z) var(--baro-skew-x) var(--baro-skew-y);
staticUtility(
  "transform-gpu",
  [
    [
      "transform",
      "translateZ(0) var(--baro-rotate-x) var(--baro-rotate-y) var(--baro-rotate-z) var(--baro-skew-x) var(--baro-skew-y)",
    ],
    transformProperties(),
  ],
  { category: "transform" }
);

// transform-cpu: disables GPU acceleration, uses only CPU transforms
// Output: transform: var(--baro-rotate-x) var(--baro-rotate-y) var(--baro-rotate-z) var(--baro-skew-x) var(--baro-skew-y);
staticUtility("transform-cpu", [
  [
    "transform",
    "var(--baro-rotate-x) var(--baro-rotate-y) var(--baro-rotate-z) var(--baro-skew-x) var(--baro-skew-y)",
  ],
  transformProperties(),
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
    // rotate-x-45 → --baro-rotate-x: rotateX(45deg); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    // -rotate-x-45 → --baro-rotate-x: rotateX(-45deg); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return [
        decl("--baro-rotate-x", `rotateX(${sign}${deg})`),
        decl(
          "transform",
          "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"
        ),
        transformProperties(),
      ];
    }
    // rotate-x-[3.142rad] → --baro-rotate-x: rotateX(3.142rad); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    return [
      decl("--baro-rotate-x", `rotateX(${value})`),
      decl(
        "transform",
        "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"
      ),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-rotate-x", `rotateX(var(${value}))`),
    decl(
      "transform",
      "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"
    ),
    transformProperties(),
  ],
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
    // rotate-y-45 → --baro-rotate-y: rotateY(45deg); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    // -rotate-y-45 → --baro-rotate-y: rotateY(-45deg); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return [
        decl("--baro-rotate-y", `rotateY(${sign}${deg})`),
        decl(
          "transform",
          "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"
        ),
        transformProperties(),
      ];
    }
    // rotate-y-[3.142rad] → --baro-rotate-y: rotateY(3.142rad); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    return [
      decl("--baro-rotate-y", `rotateY(${value})`),
      decl(
        "transform",
        "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"
      ),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-rotate-y", `rotateY(var(${value}))`),
    decl(
      "transform",
      "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"
    ),
    transformProperties(),
  ],
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
    // rotate-z-45 → --baro-rotate-z: rotateZ(45deg); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    // -rotate-z-45 → --baro-rotate-z: rotateZ(-45deg); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return [
        decl("--baro-rotate-z", `rotateZ(${sign}${deg})`),
        decl(
          "transform",
          "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"
        ),
        transformProperties(),
      ];
    }
    // rotate-z-[3.142rad] → --baro-rotate-z: rotateZ(3.142rad); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    return [
      decl("--baro-rotate-z", `rotateZ(${value})`),
      decl(
        "transform",
        "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"
      ),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-rotate-z", `rotateZ(var(${value}))`),
    decl(
      "transform",
      "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"
    ),
    transformProperties(),
  ],
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
  handleCustomProperty: (value) => [
    decl("rotate", `var(${value})`),
  ],
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
  [
    ["scale", "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)"],
    transformProperties(),
  ],
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
      return [
        decl("--baro-scale-x", value),
        decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
        transformProperties(),
      ];
    }

    // scale-x-75 → scale: 75% var(--baro-scale-y)
    // -scale-x-75 → scale: calc(75% * -1) var(--baro-scale-y)
    if (parseNumber(value) || negative) {
      const pct = `${Math.abs(Number(value))}%`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return [
        decl("--baro-scale-x", `calc(${pct} * ${sign}1)`),
        decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
        transformProperties(),
      ];
    }
    // scale-x-[1.7] → scale: 1.7 var(--baro-scale-y)
    return [
      decl("--baro-scale-x", value),
      decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-scale-x", `var(${value})`),
    decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
    transformProperties(),
  ],
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
      return [
        decl("--baro-scale-y", value),
        decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
        transformProperties(),
      ];
    }

    // scale-y-75 → scale: var(--baro-scale-x) 75%
    // -scale-y-75 → scale: var(--baro-scale-x) calc(75% * -1)
    if (parseNumber(value) || negative) {
      const pct = `${Math.abs(Number(value))}%`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return [
        decl("--baro-scale-y", `calc(${pct} * ${sign}1)`),
        decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
        transformProperties(),
      ];
    }
    // scale-y-[1.7] → scale: var(--baro-scale-x) 1.7
    return [
      decl("--baro-scale-y", value),
      decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-scale-y", `var(${value})`),
    decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
    transformProperties(),
  ],
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
      return [
        decl("--baro-scale-z", value),
        decl(
          "scale",
          "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)"
        ),
        transformProperties(),
      ];
    }

    // scale-z-75 → scale: var(--baro-scale-x) var(--baro-scale-y) 75%
    // -scale-z-75 → scale: var(--baro-scale-x) var(--baro-scale-y) calc(75% * -1)
    if (parseNumber(value) || negative) {
      const pct = `${Math.abs(Number(value))}%`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return [
        decl("--baro-scale-z", `calc(${pct} * ${sign}1)`),
        decl(
          "scale",
          `var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)`
        ),
        transformProperties(),
      ];
    }
    // scale-z-[1.7] → scale: var(--baro-scale-x) var(--baro-scale-y) 1.7
    return [
      decl("--baro-scale-z", value),
      decl(
        "scale",
        "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)"
      ),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-scale-z", `var(${value})`),
    decl(
      "scale",
      "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)"
    ),
    transformProperties(),
  ],
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
      return [
        decl("--baro-scale-x", value),
        decl("--baro-scale-y", value),
        decl("--baro-scale-z", value),
        decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
      ];
    }

    // scale-125 → --baro-scale-x: 125%; --baro-scale-y: 125%; --baro-scale-z: 125%; scale: var(--baro-scale-x) var(--baro-scale-y);
    // -scale-125 → --baro-scale-x: calc(125% * -1); --baro-scale-y: calc(125% * -1); --baro-scale-z: calc(125% * -1); scale: var(--baro-scale-x) var(--baro-scale-y);
    if (parseNumber(value) || negative) {
      const pct = `${Math.abs(Number(value))}%`;
      if (negative || String(value).startsWith("-")) {
        return [
          decl("--baro-scale-x", `calc(${pct} * -1)`),
          decl("--baro-scale-y", `calc(${pct} * -1)`),
          decl("--baro-scale-z", `calc(${pct} * -1)`),
          decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
          transformProperties(),
        ];
      }
      return [
        decl("--baro-scale-x", pct),
        decl("--baro-scale-y", pct),
        decl("--baro-scale-z", pct),
        decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
        transformProperties(),
      ];
    }
    // scale-[1.7] → --baro-scale-x: 1.7; --baro-scale-y: 1.7; --baro-scale-z: 1.7; scale: var(--baro-scale-x) var(--baro-scale-y);
    return [
      decl("--baro-scale-x", value),
      decl("--baro-scale-y", value),
      decl("--baro-scale-z", value),
      decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-scale-x", `var(${value})`),
    decl("--baro-scale-y", `var(${value})`),
    decl("--baro-scale-z", `var(${value})`),
    decl("scale", "var(--baro-scale-x) var(--baro-scale-y)"),
    transformProperties(),
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
      return [
        decl("--baro-skew-x", `skewX(${sign}${deg})`),
        decl("transform", "var(--baro-skew-x, ) var(--baro-skew-y, )"),
        transformProperties(),
      ];
    }
    // skew-x-[3.142rad] → --baro-skew-x: skewX(3.142rad); transform: var(--baro-skew-x, ) var(--baro-skew-y, );
    return [
      decl("--baro-skew-x", `skewX(${value})`),
      decl("transform", "var(--baro-skew-x, ) var(--baro-skew-y, )"),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-skew-x", `skewX(var(${value}))`),
    decl("transform", "var(--baro-skew-x, ) var(--baro-skew-y, )"),
    transformProperties(),
  ],
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
    // skew-y-4 → --baro-skew-y: skewY(4deg); transform: var(--baro-skew-x, ) var(--baro-skew-y, );
    // -skew-y-4 → --baro-skew-y: skewY(-4deg); transform: var(--baro-skew-x, ) var(--baro-skew-y, );
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return [
        decl("--baro-skew-y", `skewY(${sign}${deg})`),
        decl("transform", "var(--baro-skew-x, ) var(--baro-skew-y, )"),
        transformProperties(),
      ];
    }
    // skew-y-[3.142rad] → --baro-skew-y: skewY(3.142rad); transform: var(--baro-skew-x, ) var(--baro-skew-y, );
    return [
      decl("--baro-skew-y", `skewY(${value})`),
      decl("transform", "var(--baro-skew-x, ) var(--baro-skew-y, )"),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-skew-y", `skewY(var(${value}))`),
    decl("transform", "var(--baro-skew-x, ) var(--baro-skew-y, )"),
    transformProperties(),
  ],
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
    // skew-12 → --baro-skew-x: skewX(12deg); --baro-skew-y: skewY(12deg); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    // -skew-12 → --baro-skew-x: skewX(-12deg); --baro-skew-y: skewY(-12deg); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    if (parseNumber(value) || negative) {
      const deg = `${Math.abs(Number(value))}deg`;
      const sign = negative || String(value).startsWith("-") ? "-" : "";
      return [
        decl("--baro-skew-x", `skewX(${sign}${deg})`),
        decl("--baro-skew-y", `skewY(${sign}${deg})`),
        decl("transform", "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"),
        transformProperties(),
      ];
    }
    // skew-[3.142rad] → --baro-skew-x: skewX(3.142rad); --baro-skew-y: skewY(3.142rad); transform: var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, );
    return [
      decl("--baro-skew-x", `skewX(${value})`),
      decl("--baro-skew-y", `skewY(${value})`),
      decl("transform", "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-skew-x", `skewX(var(${value}))`),
    decl("--baro-skew-y", `skewY(var(${value}))`),
    decl("transform", "var(--baro-rotate-x, ) var(--baro-rotate-y, ) var(--baro-rotate-z, ) var(--baro-skew-x, ) var(--baro-skew-y, )"),
    transformProperties(),
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
    transformProperties(),
    ["--baro-translate-x", "100%"],
    ["--baro-translate-y", "100%"],
    ["translate", "var(--baro-translate-x) var(--baro-translate-y)"],
  ],
  { category: "transform" }
);
staticUtility(
  "-translate-full",
  [
    transformProperties(),
    ["--baro-translate-x", "-100%"],
    ["--baro-translate-y", "-100%"],
    ["translate", "var(--baro-translate-x) var(--baro-translate-y)"],
  ],
  { category: "transform" }
);

// translate-x-px, -translate-x-px, translate-x-full, -translate-x-full
staticUtility(
  "translate-x-px",
  [["translate", "1px var(--baro-translate-y)"]],
  { category: "transform" }
);
staticUtility(
  "-translate-x-px",
  [["translate", "-1px var(--baro-translate-y)"]],
  { category: "transform" }
);
staticUtility(
  "translate-x-full",
  [["translate", "100% var(--baro-translate-y)"]],
  { category: "transform" }
);
staticUtility(
  "-translate-x-full",
  [["translate", "-100% var(--baro-translate-y)"]],
  { category: "transform" }
);

// translate-y-px, -translate-y-px, translate-y-full, -translate-y-full
staticUtility(
  "translate-y-px",
  [["translate", "var(--baro-translate-x) 1px"]],
  { category: "transform" }
);
staticUtility(
  "-translate-y-px",
  [["translate", "var(--baro-translate-x) -1px"]],
  { category: "transform" }
);
staticUtility(
  "translate-y-full",
  [["translate", "var(--baro-translate-x) 100%"]],
  { category: "transform" }
);
staticUtility(
  "-translate-y-full",
  [["translate", "var(--baro-translate-x) -100%"]],
  { category: "transform" }
);

// translate-z-px, -translate-z-px
staticUtility(
  "translate-z-px",
  [["translate", "var(--baro-translate-x) var(--baro-translate-y) 1px"]],
  { category: "transform" }
);
staticUtility(
  "-translate-z-px",
  [["translate", "var(--baro-translate-x) var(--baro-translate-y) -1px"]],
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
    if (parseFractionOrNumber(value)) {
      const v = `calc(${value} * 100%)`;
      return [
        decl("--baro-translate-x", v),
        decl(
          "translate",
          "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
        ),
      ];
    }
    if (parseNumber(value) || negative) {
      const v = `calc(var(--spacing) * ${value})`;
      return [
        decl("--baro-translate-x", v),
        decl(
          "translate",
          "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
        ),
        transformProperties(),
      ];
    }
    return [
      decl("--baro-translate-x", value),
      decl(
        "translate",
        "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
      ),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-translate-x", `var(${value})`),
    decl(
      "translate",
      "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
    ),
    transformProperties(),
  ],
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
    if (parseFractionOrNumber(value)) {
      const v = `calc(${value} * 100%)`;
      return [
        decl("--baro-translate-y", v),
        decl(
          "translate",
          "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
        ),
        transformProperties(),
      ];
    }
    if (parseNumber(value) || negative) {
      const v = `calc(var(--spacing) * ${value})`;
      return [
        decl("--baro-translate-y", v),
        decl(
          "translate",
          "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
        ),
        transformProperties(),
      ];
    }
    return [
      decl("--baro-translate-y", value),
      decl(
        "translate",
        "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
      ),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-translate-y", `var(${value})`),
    decl(
      "translate",
      "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
    ),
    transformProperties(),
  ],
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
    if (parseFractionOrNumber(value)) {
      const v = `calc(${value} * 100%)`;
      return [
        decl("--baro-translate-z", v),
        decl(
          "translate",
          "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
        ),
        transformProperties(),
      ];
    }

    if (parseNumber(value) || negative) {
      const v = `calc(var(--spacing) * ${value})`;
      return [
        decl("--baro-translate-z", v),
        decl(
          "translate",
          "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
        ),
        transformProperties(),
      ];
    }

    return [
      decl("--baro-translate-z", value),
      decl(
        "translate",
        "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
      ),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-translate-z", `var(${value})`),
    decl(
      "translate",
      "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
    ),
    transformProperties(),
  ],
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
    if (parseFractionOrNumber(value)) {
      const v = `calc(${value} * 100%)`;
      return [
        decl("--baro-translate-x", v),
        decl("--baro-translate-y", v),
        decl(
          "translate",
          "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
        ),
        transformProperties(),
      ];
    }
    // Number (spacing scale)
    if (parseNumber(value) || negative) {
      const v = `calc(var(--spacing) * ${value})`;
      return [
        decl("--baro-translate-x", v),
        decl("--baro-translate-y", v),
        decl(
          "translate",
          "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
        ),
        transformProperties(),
      ];
    }
    // Arbitrary value
    return [
      decl("--baro-translate-x", value),
      decl("--baro-translate-y", value),
      decl(
        "translate",
        "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
      ),
      transformProperties(),
    ];
  },
  handleCustomProperty: (value) => [
    decl("--baro-translate-x", `var(${value})`),
    decl("--baro-translate-y", `var(${value})`),
    decl(
      "translate",
      "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)"
    ),
    transformProperties(),
  ],
  description:
    "translate utility (spacing, fraction, arbitrary, custom property, negative)",
  category: "transform",
});
