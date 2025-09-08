import { staticUtility, functionalUtility } from "../core/registry";
import { AstNode, atRoot, atRule, decl, property, styleRule } from "../core/ast";
import { parseColor, parseLength, parseNumber } from "../core/utils";

const gradientStopProperties = () => {
  return atRoot([
    property('--baro-gradient-position'),
    property('--baro-gradient-from', '#0000', '<color>'),
    property('--baro-gradient-via', '#0000', '<color>'),
    property('--baro-gradient-to', '#0000', '<color>'),
    property('--baro-gradient-stops', "transparent"),
    property('--baro-gradient-from-position', '0%', '<length-percentage>'),
    property('--baro-gradient-via-position', '50%', '<length-percentage>'),
    property('--baro-gradient-to-position', '100%', '<length-percentage>'),
  ], "background")
}


// --- Background Attachment ---
staticUtility("bg-fixed", [["background-attachment", "fixed"]], { category: 'background' });
staticUtility("bg-local", [["background-attachment", "local"]], { category: 'background' });
staticUtility("bg-scroll", [["background-attachment", "scroll"]], { category: 'background' });

// --- Background Clip ---
staticUtility("bg-clip-border", [["background-clip", "border-box"]], { category: 'background' });
staticUtility("bg-clip-padding", [["background-clip", "padding-box"]], { category: 'background' });
staticUtility("bg-clip-content", [["background-clip", "content-box"]], { category: 'background' });
staticUtility("bg-clip-text", [["background-clip", "text"]], { category: 'background' });

// --- Background Color ---
staticUtility("bg-inherit", [["background-color", "inherit"]], { category: 'background' });
staticUtility("bg-current", [["background-color", "currentColor"]], { category: 'background' });
staticUtility("bg-transparent", [["background-color", "transparent"]], { category: 'background' });

// --- Background Image ---
staticUtility("bg-none", [["background-image", "none"]], { category: 'background' });

// --- Background Origin ---
staticUtility("bg-origin-border", [["background-origin", "border-box"]], { category: 'background' });
staticUtility("bg-origin-padding", [["background-origin", "padding-box"]], { category: 'background' });
staticUtility("bg-origin-content", [["background-origin", "content-box"]], { category: 'background' });

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
  staticUtility(name, [["background-position", value]], { category: 'background' });
});

/**
 * background-position utility (arbitrary, custom property supported)
 *
 * bg-position-[length] → background-position: [length]
 * bg-position-[length] → background-position: [length]
 */
functionalUtility({
  name: "bg-position",
  prop: "background-position",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "background-position utility (arbitrary, custom property supported)",
  category: "background",
});

// --- Background Repeat ---
staticUtility("bg-repeat", [["background-repeat", "repeat"]], { category: 'background' });
staticUtility("bg-no-repeat", [["background-repeat", "no-repeat"]], { category: 'background' });
staticUtility("bg-repeat-x", [["background-repeat", "repeat-x"]], { category: 'background' });
staticUtility("bg-repeat-y", [["background-repeat", "repeat-y"]], { category: 'background' });
staticUtility("bg-repeat-round", [["background-repeat", "round"]], { category: 'background' });
staticUtility("bg-repeat-space", [["background-repeat", "space"]], { category: 'background' });

// --- Background Size ---
staticUtility("bg-auto", [["background-size", "auto"]], { category: 'background' });
staticUtility("bg-cover", [["background-size", "cover"]], { category: 'background' });
staticUtility("bg-contain", [["background-size", "contain"]], { category: 'background' });

functionalUtility({
  name: "bg-size",
  prop: "background-size",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "background-size utility (arbitrary, custom property supported)",
  category: "background",
});

// --- Background Gradients: Linear ---
const positionValue = (position: string) => {
  return [
    decl("--baro-gradient-position", position),    
    styleRule("@supports (background-image: linear-gradient(in lab, red, red))", [
      decl("--baro-gradient-position", `${position} in oklab`),
    ]),
    decl(
      "background-image",
      `linear-gradient(${position}, var(--baro-gradient-stops))`
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

  // fallback , legacy CSS compatibility
  ["bg-gradient-to-t", positionValue("to top")],
  ["bg-gradient-to-tr", positionValue("to top right")],
  ["bg-gradient-to-r", positionValue("to right")],
  ["bg-gradient-to-br", positionValue("to bottom right")],
  ["bg-gradient-to-b", positionValue("to bottom")],
  ["bg-gradient-to-bl", positionValue("to bottom left")],
  ["bg-gradient-to-l", positionValue("to left")],
  ["bg-gradient-to-tl", positionValue("to top left")],
].forEach(([name, value]) => {
  staticUtility(name as string, value as AstNode[], { category: 'background', priority: 1000 });
});
// bg-linear-<angle> (e.g., bg-linear-45)
functionalUtility({
  name: "bg-linear",
  prop: "background-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, context, token) => {
    if (parseNumber(value)) {
      // bg-linear-45 → linear-gradient(45deg in oklab, var(--baro-gradient-stops))
      return [
        decl(
          "background-image",
          `linear-gradient(${value}deg in oklab, var(--baro-gradient-stops))`
        ),
      ];
    }
    if (token.arbitrary) {
      // bg-linear-[25deg,red_5%,yellow_60%,lime_90%,teal]
      return [
        decl(
          "background-image",
          `linear-gradient(var(--baro-gradient-stops, ${value}))`
        ),
      ];
    }
    if (token.customProperty) {
      // bg-linear-(--my-gradient)
      return [
        decl(
          "background-image",
          `linear-gradient(var(--baro-gradient-stops, var(${value})))`
        ),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => [
    decl(
      "background-image",
      `linear-gradient(var(--baro-gradient-stops, var(${value})))`
    ),
  ],
  description:
    "linear-gradient background-image utility (angle, arbitrary, custom property supported)",
  category: "background",
});

// --- Background Gradients: Radial ---
staticUtility("bg-radial", [
  ["background-image", "radial-gradient(in oklab, var(--baro-gradient-stops))"],
], { category: 'background' });
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
          `radial-gradient(var(--baro-gradient-stops, ${value}))`
        ),
      ];
    }
    if (token.customProperty) {
      // bg-radial-(--my-gradient)
      return [
        decl(
          "background-image",
          `radial-gradient(var(--baro-gradient-stops, var(${value})))`
        ),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => [
    decl(
      "background-image",
      `radial-gradient(var(--baro-gradient-stops, var(${value})))`
    ),
  ],
  description:
    "radial-gradient background-image utility (arbitrary, custom property supported)",
  category: "background",
});

// --- Background Gradients: Conic ---
staticUtility("bg-conic", [
  [
    "background-image",
    "conic-gradient(from 0deg in oklab, var(--baro-gradient-stops))",
  ],
], { category: 'background' });
functionalUtility({
  name: "bg-conic",
  prop: "background-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, context, token) => {
    if (parseNumber(value)) {
      // bg-conic-180 → conic-gradient(from 180deg in oklab, var(--baro-gradient-stops))
      return [
        decl(
          "background-image",
          `conic-gradient(from ${value}deg in oklab, var(--baro-gradient-stops))`
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
          `conic-gradient(var(--baro-gradient-stops, var(${value})))`
        ),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => [decl("background-image", `var(${value})`)],
  description:
    "conic-gradient background-image utility (angle, arbitrary, custom property supported)",
  category: "background",
});

// --- Gradient Stops ---



// from-*, via-*, to-* (color, percentage, custom property, arbitrary)
["from", "via", "to"].forEach((stop) => {
  functionalUtility({
    name: stop,
    themeKeys: ["colors"],
    supportsArbitrary: true,
    supportsCustomProperty: true,
    supportsOpacity: true,
    handle: (value, context, token, extra) => {
      // console.log('[gradient stop] value', value, context, token, extra);
      if (extra?.realThemeValue) {
        if (stop === "from") {

          let color = value; 
          if (extra?.opacity) {
            color = `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`;
          }

          return [
            gradientStopProperties(),
            decl(`--baro-gradient-from`, color),
            // decl(`--baro-gradient-to`, "var(--baro-gradient-to, transparent)"),
            decl(`--baro-gradient-stops`, "var(--baro-gradient-from),var(--baro-gradient-to)")
          ];
        }

        if (stop === "via") {
          let color = value; 
          if (extra?.opacity) {
            color = `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`;
          }
          return [
            gradientStopProperties(),
            decl(`--baro-gradient-to`, color),
            decl(`--baro-gradient-stops`, `var(--baro-gradient-from), ${value} var(--baro-gradient-via-position), var(--baro-gradient-to)`)  // via 포함 stops
          ];
        }

        if (stop === "to") {
          let color = value; 
          if (extra?.opacity) {
            color = `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`;
          }
          return [
            gradientStopProperties(),
            decl(`--baro-gradient-to`, color),
          ];
        }
      }

      // to-50% → --baro-gradient-to-position: 50%
      if (parseLength(value)) {
        return [decl(`--baro-gradient-${stop}-position`, value)];
      }

      // to-50% → --baro-gradient-to-position: 50%
      if (parseNumber(value)) {
        return [decl(`--baro-gradient-${stop}-position`, `${value}%`)];
      }

      // to-red-500 → --baro-gradient-to: red-500
      if (parseColor(value)) {

        if (stop === "from") {
          return [
            gradientStopProperties(),
            decl(`--baro-gradient-from`, value),
            decl(`--baro-gradient-to`, "transparent"),
            decl(`--baro-gradient-stops`, "var(--baro-gradient-from),var(--baro-gradient-to)")
          ];
        }

        if (stop === "via") {
          return [
            gradientStopProperties(),
            decl(`--baro-gradient-to`, value),
            decl(`--baro-gradient-stops`, `var(--baro-gradient-from), ${value} var(--baro-gradient-via-position), var(--baro-gradient-to)`)  // via 포함 stops
          ];
        }

        if (stop === "to") {
          return [
            gradientStopProperties(),
            decl(`--baro-gradient-to`, value),
          ];
        }
      }
      return null;
    },
    handleCustomProperty: (value) => [
      decl(`--baro-gradient-${stop}`, `var(${value})`),
    ],
    description: `${stop} gradient stop utility (color, percent, custom property, arbitrary supported)`,
    category: "background",
  });
  // position variant: from-10%, via-30%, to-90%
  functionalUtility({
    name: `${stop}-position`,
    supportsArbitrary: true,
    supportsCustomProperty: true,
    handle: (value) => [decl(`--baro-gradient-${stop}-position`, value)],
    handleCustomProperty: (value) => [
      decl(`--baro-gradient-${stop}-position`, `var(${value})`),
    ],
    description: `${stop}-position gradient stop position utility (percent, custom property, arbitrary supported)`,
    category: "background",
  });
});

/**
 * background-size utility (arbitrary, custom property supported)
 * bg-[length] → background-size: [length]
 * bg-[length] → background-size: [length]
 * bg-[color] → background-color: [color]
 * bg-[url] → background-image: [url]
 * bg-[radial-gradient()] → background-image: radial-gradient(var(--baro-gradient-stops))
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

    // if (value.startsWith("radial-gradient(")) {
    //   return [decl("background-image", value)];
    // }

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
          decl("background-color", `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`),
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
  description: "background-size utility (arbitrary, custom property supported)",
  category: "background",
});
