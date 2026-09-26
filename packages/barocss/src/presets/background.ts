import { staticUtility, functionalUtility } from "../core/registry";
import { AstNode, atRoot, atRule, decl, property } from "../core/ast";
import { parseColor, parseLength, parseNumber, themeColorDecls } from "../core/utils";

const gradientStopProperties = () => {
  return atRoot([
    property('--baro-gradient-position'),
    property('--baro-gradient-from', '#0000', '<color>'),
    property('--baro-gradient-via', '#0000', '<color>'),
    property('--baro-gradient-to', '#0000', '<color>'),
    property('--baro-gradient-stops'),
    property('--baro-gradient-via-stops'),
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
const positionValue = (position: string) => [
  decl("--baro-gradient-position", position),
  atRule("supports", "(background-image: linear-gradient(in lab, red, red))", [
    decl("--baro-gradient-position", `${position} in oklab`),
  ]),
  decl("background-image", "linear-gradient(var(--baro-gradient-stops))"),
];
// Tailwind 4 emits the legacy bg-gradient-to-* with the interpolation space baked in, no @supports.
const legacyPositionValue = (position: string) => [
  decl("--baro-gradient-position", `${position} in oklab`),
  decl("background-image", "linear-gradient(var(--baro-gradient-stops))"),
];

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
  ["bg-gradient-to-t", legacyPositionValue("to top")],
  ["bg-gradient-to-tr", legacyPositionValue("to top right")],
  ["bg-gradient-to-r", legacyPositionValue("to right")],
  ["bg-gradient-to-br", legacyPositionValue("to bottom right")],
  ["bg-gradient-to-b", legacyPositionValue("to bottom")],
  ["bg-gradient-to-bl", legacyPositionValue("to bottom left")],
  ["bg-gradient-to-l", legacyPositionValue("to left")],
  ["bg-gradient-to-tl", legacyPositionValue("to top left")],
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
      // bg-linear-45 → --baro-gradient-position: 45deg (in oklab when supported)
      return positionValue(`${value}deg`);
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

// --- Background Gradients: Radial / Conic ---
// Tailwind 4 shape: the utility sets --baro-gradient-position (the stops composite starts with it,
// and it is registered without an initial value) and the image is just <fn>(var(--baro-gradient-stops)).
const gradientImage = (fn: string, position: string, fallback?: string): AstNode[] => [
  decl("--baro-gradient-position", position),
  decl("background-image", `${fn}(var(--baro-gradient-stops${fallback ? `,${fallback}` : ""}))`),
];
staticUtility("bg-radial", gradientImage("radial-gradient", "in oklab"), { category: 'background' });
functionalUtility({
  name: "bg-radial",
  prop: "background-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _context, token) => {
    // bg-radial-[at_50%_75%]
    if (token.arbitrary) return gradientImage("radial-gradient", value, value);
    if (token.customProperty) return gradientImage("radial-gradient", `var(${value})`, `var(${value})`);
    return null;
  },
  handleCustomProperty: (value) => gradientImage("radial-gradient", `var(${value})`, `var(${value})`),
  description:
    "radial-gradient background-image utility (arbitrary, custom property supported)",
  category: "background",
});

staticUtility("bg-conic", gradientImage("conic-gradient", "in oklab"), { category: 'background' });
functionalUtility({
  name: "bg-conic",
  prop: "background-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _context, token) => {
    // bg-conic-180 → --baro-gradient-position: from 180deg in oklab
    if (!token.arbitrary && !token.customProperty && parseNumber(value)) {
      return gradientImage("conic-gradient", `from ${value}deg in oklab`);
    }
    // bg-conic-[from_45deg]
    if (token.arbitrary) return gradientImage("conic-gradient", value, value);
    if (token.customProperty) return gradientImage("conic-gradient", `var(${value})`, `var(${value})`);
    return null;
  },
  handleCustomProperty: (value) => gradientImage("conic-gradient", `var(${value})`, `var(${value})`),
  description:
    "conic-gradient background-image utility (angle, arbitrary, custom property supported)",
  category: "background",
});

// --- Gradient Stops ---



// from-*, via-*, to-* (color, percentage, custom property, arbitrary), Tailwind 4 stop composition
const G = "--baro-gradient";
const stopsDecls = (stop: string, color: string | AstNode[]): AstNode[] => {
  const colorDecls = typeof color === "string" ? [decl(`${G}-${stop}`, color)] : color;
  if (stop === "via") {
    return [
      gradientStopProperties(),
      ...colorDecls,
      decl(`${G}-via-stops`, `var(${G}-position), var(${G}-from) var(${G}-from-position), var(${G}-via) var(${G}-via-position), var(${G}-to) var(${G}-to-position)`),
      decl(`${G}-stops`, `var(${G}-via-stops)`),
    ];
  }
  return [
    gradientStopProperties(),
    ...colorDecls,
    decl(`${G}-stops`, `var(${G}-via-stops, var(${G}-position), var(${G}-from) var(${G}-from-position), var(${G}-to) var(${G}-to-position))`),
  ];
};
["from", "via", "to"].forEach((stop) => {
  functionalUtility({
    name: stop,
    themeKeys: ["colors"],
    supportsArbitrary: true,
    supportsCustomProperty: true,
    supportsOpacity: true,
    handle: (value, _context, _token, extra) => {
      if (extra?.realThemeValue) {
        return stopsDecls(stop, themeColorDecls(`${G}-${stop}`, value, extra));
      }
      // from-10% → --baro-gradient-from-position: 10%
      if (parseLength(value)) {
        return [gradientStopProperties(), decl(`${G}-${stop}-position`, value)];
      }
      if (parseNumber(value)) {
        return [gradientStopProperties(), decl(`${G}-${stop}-position`, `${value}%`)];
      }
      if (parseColor(value)) {
        return stopsDecls(stop, value);
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

    if (extra?.realThemeValue) return themeColorDecls("background-color", value, extra);

    if (parseColor(value)) {
      const parsedColor = parseColor(value);

      if (value.startsWith("color:")) {
        return [decl("background-color", parsedColor || value)];
      }

      return [decl("background-color", value)];
    }

    if (parseLength(value)) {
      return [decl("background-size", value)];
    }

    return null;
  },
  handleCustomProperty: (value) =>
    value.startsWith("length:")
      ? [decl("background-size", `var(${value.slice(7)})`)]
      : [decl("background-color", `var(${value})`)],
  description: "background-size utility (arbitrary, custom property supported)",
  category: "background",
});
