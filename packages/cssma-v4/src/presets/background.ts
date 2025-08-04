import { staticUtility, functionalUtility } from "../core/registry";
import { AstNode, atRoot, atRule, decl, property, rule } from "../core/ast";
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
const positionValue = (position: string) => {
  return [
    decl("--tw-gradient-position", position),    
    rule("@supports (background-image:linear-gradient(in lab, red, red))", [
      decl("--tw-gradient-position", `${position} in oklab`),
    ]),
    decl(
      "background-image",
      `linear-gradient(${position}, var(--tw-gradient-stops))`
    ),
  ];
};

[
  ["bg-linear-to-t", positionValue("to top")],
  ["bg-linear-to-tr", positionValue("to top right")],
  ["bg-linear-to-r", positionValue("to right")],
  ["bg-linear-to-br", positionValue("to bottom right")],
  ["bg-linear-to-b", positionValue("to bottom")],
  ["bg-linear-to-bl", positionValue("to bottom left")],
  ["bg-linear-to-l", positionValue("to left")],
  ["bg-linear-to-tl", positionValue("to top left")],
].forEach(([name, value]) => {
  staticUtility(name as string, value as AstNode[]);
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
      return [
        decl(
          "background-image",
          `linear-gradient(${value}deg in oklab, var(--tw-gradient-stops))`
        ),
      ];
    }
    if (token.arbitrary) {
      // bg-linear-[25deg,red_5%,yellow_60%,lime_90%,teal]
      return [
        decl(
          "background-image",
          `linear-gradient(var(--tw-gradient-stops, ${value}))`
        ),
      ];
    }
    if (token.customProperty) {
      // bg-linear-(--my-gradient)
      return [
        decl(
          "background-image",
          `linear-gradient(var(--tw-gradient-stops, var(${value})))`
        ),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => [
    decl(
      "background-image",
      `linear-gradient(var(--tw-gradient-stops, var(${value})))`
    ),
  ],
  description:
    "linear-gradient background-image utility (angle, arbitrary, custom property 지원)",
  category: "background",
});

// --- Background Gradients: Radial ---
staticUtility("bg-radial", [
  ["background-image", "radial-gradient(in oklab, var(--tw-gradient-stops))"],
]);
functionalUtility({
  name: "bg-radial",
  prop: "background-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, context, token) => {
    if (token.arbitrary) {
      // bg-radial-[at_50%_75%]
      return [
        decl(
          "background-image",
          `radial-gradient(var(--tw-gradient-stops, ${value}))`
        ),
      ];
    }
    if (token.customProperty) {
      // bg-radial-(--my-gradient)
      return [
        decl(
          "background-image",
          `radial-gradient(var(--tw-gradient-stops, var(${value})))`
        ),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => [
    decl(
      "background-image",
      `radial-gradient(var(--tw-gradient-stops, var(${value})))`
    ),
  ],
  description:
    "radial-gradient background-image utility (arbitrary, custom property 지원)",
  category: "background",
});

// --- Background Gradients: Conic ---
staticUtility("bg-conic", [
  [
    "background-image",
    "conic-gradient(from 0deg in oklab, var(--tw-gradient-stops))",
  ],
]);
functionalUtility({
  name: "bg-conic",
  prop: "background-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, context, token) => {
    if (parseNumber(value)) {
      // bg-conic-180 → conic-gradient(from 180deg in oklab, var(--tw-gradient-stops))
      return [
        decl(
          "background-image",
          `conic-gradient(from ${value}deg in oklab, var(--tw-gradient-stops))`
        ),
      ];
    }
    if (token.arbitrary) {
      // bg-conic-[at_50%_75%]
      return [decl("background-image", `${value}`)];
    }
    if (token.customProperty) {
      // bg-conic-(--my-gradient)
      return [
        decl(
          "background-image",
          `conic-gradient(var(--tw-gradient-stops, var(${value})))`
        ),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => [decl("background-image", `var(${value})`)],
  description:
    "conic-gradient background-image utility (angle, arbitrary, custom property 지원)",
  category: "background",
});

// --- Gradient Stops ---

const gradientStopProperties = () => {
  return atRoot([
    property('--tw-gradient-position'),
    property('--tw-gradient-from', '#0000', '<color>'),
    property('--tw-gradient-via', '#0000', '<color>'),
    property('--tw-gradient-to', '#0000', '<color>'),
    property('--tw-gradient-stops'),
    property('--tw-gradient-via-stops'),
    property('--tw-gradient-from-position', '0%', '<length-percentage>'),
    property('--tw-gradient-via-position', '50%', '<length-percentage>'),
    property('--tw-gradient-to-position', '100%', '<length-percentage>'),
  ])
}


// from-*, via-*, to-* (color, percentage, custom property, arbitrary)
["from", "via", "to"].forEach((stop) => {
  functionalUtility({
    name: stop,
    themeKeys: ["colors"],
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value, context, token, extra) => {
      if (extra?.realThemeValue) {
        return [
          gradientStopProperties(),
          decl(`--tw-gradient-${stop}`, value),
          decl(
            `--tw-gradient-stops`,
            `var(--tw-gradient-via-stops, var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))`
          ),
        ];
      }

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
        return [
          gradientStopProperties(),
          decl(`--tw-gradient-${stop}`, value),
          decl(
            `--tw-gradient-stops`,
            `var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))`
          ),
        ];
      }
      return null;
    },
    handleCustomProperty: (value) => [
      decl(`--tw-gradient-${stop}`, `var(${value})`),
    ],
    description: `${stop} gradient stop utility (color, percent, custom property, arbitrary 지원)`,
    category: "background",
  });
  // position variant: from-10%, via-30%, to-90%
  functionalUtility({
    name: `${stop}-position`,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value) => [decl(`--tw-gradient-${stop}-position`, value)],
    handleCustomProperty: (value) => [
      decl(`--tw-gradient-${stop}-position`, `var(${value})`),
    ],
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
  themeKeys: ["colors"],
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, context, token, extra) => {
    if (value.startsWith("url(")) {
      return [decl("background-image", value)];
    }

    if (value.startsWith("length:")) {
      return [decl("background-size", value.replace("length:", ""))];
    }

    if (extra?.realThemeValue) {
      if (extra.opacity) {
        return [
          atRule("supports", `(color:color-mix(in lab, red, red))`, [
            decl(
              "background-color",
              `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`
            ),
          ]),
          decl("background-color", value),
        ];
      }
      return [decl("background-color", value)];
    }

    const color = parseColor(value);
    if (color) {
      return [decl("background-color", color)];
    }

    if (parseLength(value)) {
      return [decl("background-size", value)];
    }

    return null;
  },
  handleCustomProperty: (value) => [decl("background-size", `var(${value})`)],
  description: "background-size utility (arbitrary, custom property 지원)",
  category: "background",
});
