import { staticUtility, functionalUtility } from "../core/registry";
import { atRule, decl } from "../core/ast";
import { parseColor, parseNumber } from "../core/utils";

// --- Box Shadow ---
//  box-shadow documentation

// Static shadow levels
[
  ["shadow-2xs", "var(--shadow-2xs)"],
  ["shadow-xs", "var(--shadow-xs)"],
  ["shadow-sm", "var(--shadow-sm)"],
  ["shadow", "var(--shadow-default)"],
  ["shadow-md", "var(--shadow-md)"],
  ["shadow-lg", "var(--shadow-lg)"],
  ["shadow-xl", "var(--shadow-xl)"],
  ["shadow-2xl", "var(--shadow-2xl)"],
  ["shadow-none", "0 0 #0000"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["box-shadow", value as string]]);
});

// Static inset shadow levels
[
  [
    "inset-shadow-2xs",
    "inset 0 1px 2px var(--tw-inset-shadow-color, #0000000d)",
  ],
  [
    "inset-shadow-xs",
    "inset 0 2px 4px var(--tw-inset-shadow-color, #0000000d)",
  ],
  [
    "inset-shadow-sm",
    "inset 0 2px 4px var(--tw-inset-shadow-color, #0000000d)",
  ],
  [
    "inset-shadow-md",
    "inset 0 4px 6px -1px var(--tw-inset-shadow-color, #0000000d)",
  ],
  [
    "inset-shadow-lg",
    "inset 0 10px 15px -3px var(--tw-inset-shadow-color, #0000000d)",
  ],
  [
    "inset-shadow-xl",
    "inset 0 20px 25px -5px var(--tw-inset-shadow-color, #0000000d)",
  ],
  [
    "inset-shadow-2xl",
    "inset 0 25px 50px -12px var(--tw-inset-shadow-color, #0000000d)",
  ],
  ["inset-shadow-none", "0 0 #0000"],
].forEach(([name, value]) => {
  staticUtility(name as string, [
    ["--tw-inset-shadow", value as string],
    [
      "box-shadow",
      "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
    ],
  ]);
});

// --- Box Shadow Color (with opacity, custom property, arbitrary) ---
// shadow-red-500, shadow-red-500/50, shadow-[#bada55]/80, shadow-(color:--my-shadow), shadow-inherit, etc.

function createShadowThemeColor(
  key: string,
  main: string,
  opacity: string | undefined,
  realThemeValue: string
) {
  let fallbackColor = main;
  let colorVar = `var(--color-${realThemeValue})`;
  let colorValue = colorVar;
  if (opacity) {
    colorValue = `color-mix(in oklab, color-mix(in oklab, ${colorVar} ${opacity}%, transparent) var(--tw-shadow-alpha),transparent)`;
    if (parseColor(main)) {
      if (main.startsWith("#")) {
        const opacityValue = Math.round((Number(opacity) / 100) * 255);
        fallbackColor = `${main}${opacityValue.toString(16).padStart(2, "0")}`;
      } else {
        fallbackColor = `color-mix(in oklab, ${main} ${opacity}%, transparent)`;
      }
    }
  }
  return [
    atRule("supports", "(color:color-mix(in lab, red, red))", [
      decl(key, colorValue),
    ]),
    decl(key, fallbackColor),
  ];
}

// shadow-color utilities
functionalUtility({
  name: "shadow",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  themeKeys: ["colors", "shadows"],
  handle: (value, ctx, token, extra) => {
    let main = value;
    let opacity = extra?.opacity;
    let realThemeValue = extra?.realThemeValue;

    // 1. Theme color (e.g. shadow-red-500/60)
    if (realThemeValue) {
      return createShadowThemeColor(
        "--tw-shadow-color",
        main,
        opacity,
        realThemeValue
      );
    }

    // Custom property color: shadow-(color:--my-shadow)
    if (main.startsWith("color:")) {
      const cp = main.replace("color:", "");
      if (opacity) {
        return [
          decl(
            "--tw-shadow-color",
            `color-mix(in oklab, var(${cp}) ${opacity}%, transparent)`
          ),
        ];
      }
      return [decl("--tw-shadow-color", `var(${cp})`)];
    }

    // Arbitrary color: shadow-[#bada55] or shadow-[oklch(...)]
    if (token.arbitrary) {
      if (parseColor(main)) {
        if (opacity) {
          return [
            decl(
              "--tw-shadow-color",
              `color-mix(in oklab, ${main} ${opacity}%, transparent)`
            ),
          ];
        }

        return [decl("box-shadow", main)];
      }

      return [decl("box-shadow", main)];
    }

    // Special cases
    if (main === "inherit" || main === "current" || main === "transparent") {
      return [
        decl("--tw-shadow-color", main === "current" ? "currentColor" : main),
      ];
    }

    return null;
  },
  handleCustomProperty: (value) => [decl("box-shadow", `var(${value})`)],
});

// inset-shadow-color utilities
functionalUtility({
  name: "inset-shadow",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  themeKeys: ["colors", "shadows"],
  handle: (value, ctx, token, extra) => {
    let main = value;
    let opacity = extra?.opacity;
    let realThemeValue = extra?.realThemeValue;

    // 1. Theme color (e.g. inset-shadow-red-500/60)
    if (realThemeValue) {
      return createShadowThemeColor(
        "--tw-inset-shadow-color",
        main,
        opacity,
        realThemeValue
      );
    }

    // 2. Custom property color: inset-shadow-(color:--my-shadow)
    if (main.startsWith("color:")) {
      const cp = main.replace("color:", "");
      let colorValue = `var(${cp})`;
      if (opacity) {
        colorValue = `color-mix(in oklab, var(${cp}) ${opacity}%, transparent)`;
      }
      return [decl("--tw-inset-shadow-color", colorValue)];
    }

    // 3. Arbitrary color: inset-shadow-[#bada55] or inset-shadow-[oklch(...)]
    if (token.arbitrary) {
      if (parseColor(main)) {
        let colorValue = main;
        if (opacity) {
          colorValue = `color-mix(in oklab, ${main} ${opacity}%, transparent)`;
        }
        return [decl("--tw-inset-shadow-color", colorValue)];
      }

      return [decl("box-shadow", `inset ${main}`)];
    }

    // 4. Special cases
    if (main === "inherit" || main === "current" || main === "transparent") {
      return [
        decl(
          "--tw-inset-shadow-color",
          main === "current" ? "currentColor" : main
        ),
      ];
    }

    return null;
  },
  handleCustomProperty: (value) => [decl("box-shadow", `var(${value})`)],
});

// --- Ring ( multi-variable) ---
//  ring-width documentation

// Static ring width utilities
[
  ["ring", "1px"],
  ["ring-0", "0px"],
  ["ring-1", "1px"],
  ["ring-2", "2px"],
  ["ring-4", "4px"],
  ["ring-8", "8px"],
].forEach(([name, px]) => {
  staticUtility(name as string, [
    ["--tw-ring-inset", ""],
    ["--tw-ring-offset-width", "0px"],
    ["--tw-ring-offset-color", "#fff"],
    ["--tw-ring-color", "rgb(59 130 246 / 0.5)"], // default blue-500/50
    [
      "--tw-ring-shadow",
      `var(--tw-ring-inset) 0 0 0 calc(${px} + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)`,
    ],
    ["--tw-ring-offset-shadow", `0 0 #0000`],
    [
      "box-shadow",
      "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
    ],
  ]);
});

// Inset ring width utilities
[
  ["inset-ring", "1px"],
  ["inset-ring-0", "0px"],
  ["inset-ring-1", "1px"],
  ["inset-ring-2", "2px"],
  ["inset-ring-4", "4px"],
  ["inset-ring-8", "8px"],
].forEach(([name, px]) => {
  staticUtility(name as string, [
    ["--tw-ring-inset", "inset"],
    ["--tw-ring-offset-width", "0px"],
    ["--tw-ring-offset-color", "#fff"],
    ["--tw-inset-ring-color", "rgb(59 130 246 / 0.5)"],
    [
      "--tw-inset-ring-shadow",
      `var(--tw-ring-inset) 0 0 0 calc(${px} + var(--tw-ring-offset-width)) var(--tw-inset-ring-color, currentcolor)`,
    ],
    ["--tw-ring-offset-shadow", `0 0 #0000`],
    [
      "box-shadow",
      "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)",
    ],
  ]);
});

// Ring inset
staticUtility("ring-inset", [["--tw-ring-inset", "inset"]]);

// --- Ring color/opacity/arbitrary/custom property ( supports+fallback) ---
function createRingColorDecls(
  key: string,
  main: string,
  opacity: string | undefined,
  realThemeValue: string
) {
  let colorVar = `var(--color-${realThemeValue})`;
  let colorMix = colorVar;
  let fallback = colorVar;
  if (opacity) {
    colorMix = `color-mix(in oklab, ${colorVar} ${opacity}%, transparent)`;
    if (parseColor(main) && main.startsWith("#")) {
      const opacityValue = Math.round((Number(opacity) / 100) * 255);
      fallback = `${main}${opacityValue.toString(16).padStart(2, "0")}`;
    } else {
      fallback = colorMix;
    }
  }
  return [
    atRule("supports", "(color:color-mix(in lab, red, red))", [
      decl(key, colorMix),
    ]),
    decl(key, fallback),
  ];
}

// Ring color/opacity/arbitrary/custom property
functionalUtility({
  name: "ring",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  themeKeys: ["colors"],
  handle: (value, ctx, token, extra) => {
    let main = value;
    let opacity = extra?.opacity;
    let realThemeValue = extra?.realThemeValue;
    if (realThemeValue) {
      return createRingColorDecls(
        "--tw-ring-color",
        main,
        opacity,
        realThemeValue
      );
    }
    if (main.startsWith("color:")) {
      const cp = main.replace("color:", "");
      let colorMix = `var(${cp})`;
      let fallback = colorMix;
      if (opacity) {
        colorMix = `color-mix(in oklab, var(${cp}) ${opacity}%, transparent)`;
        fallback = colorMix;
      }
      return [
        atRule("supports", "(color:color-mix(in lab, red, red))", [
          decl("--tw-ring-color", colorMix),
        ]),
        decl("--tw-ring-color", fallback),
      ];
    }
    if (token.arbitrary) {
      let colorMix = main;
      let fallback = main;
      if (opacity) {
        colorMix = `color-mix(in oklab, ${main} ${opacity}%, transparent)`;
        if (parseColor(main) && main.startsWith("#")) {
          const opacityValue = Math.round((Number(opacity) / 100) * 255);
          fallback = `${main}${opacityValue.toString(16).padStart(2, "0")}`;
        } else {
          fallback = colorMix;
        }

        return [
          atRule("supports", "(color:color-mix(in lab, red, red))", [
            decl("--tw-ring-color", colorMix),
          ]),
          decl("--tw-ring-color", fallback),
        ];
      }

      return [decl("box-shadow", main)];
    }
    if (main === "inherit" || main === "current" || main === "transparent") {
      return [
        decl("--tw-ring-color", main === "current" ? "currentColor" : main),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("color:")) {
      const cp = value.replace("color:", "");
      return [decl("--tw-ring-color", `var(${cp})`)];
    }
    return [decl("--tw-ring-color", `var(${value})`)];
  },
});

// Inset ring color/opacity/arbitrary/custom property ( supports+fallback)
functionalUtility({
  name: "inset-ring",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  themeKeys: ["colors", "shadows"],
  handle: (value, ctx, token, extra) => {
    let main = value;
    let opacity = extra?.opacity;
    let realThemeValue = extra?.realThemeValue;
    if (realThemeValue) {
      return createRingColorDecls(
        "--tw-inset-ring-color",
        main,
        opacity,
        realThemeValue
      );
    }
    if (main.startsWith("color:")) {
      const cp = main.replace("color:", "");
      let colorMix = `var(${cp})`;
      let fallback = colorMix;
      if (opacity) {
        colorMix = `color-mix(in oklab, var(${cp}) ${opacity}%, transparent)`;
        fallback = colorMix;
      }
      return [
        atRule("supports", "(color:color-mix(in lab, red, red))", [
          decl("--tw-inset-ring-color", colorMix),
        ]),
        decl("--tw-inset-ring-color", fallback),
      ];
    }
    if (token.arbitrary) {
      let colorMix = main;
      let fallback = main;
      if (opacity) {
        colorMix = `color-mix(in oklab, ${main} ${opacity}%, transparent)`;
        if (parseColor(main) && main.startsWith("#")) {
          const opacityValue = Math.round((Number(opacity) / 100) * 255);
          fallback = `${main}${opacityValue.toString(16).padStart(2, "0")}`;
        } else {
          fallback = colorMix;
        }

        return [
          atRule("supports", "(color:color-mix(in lab, red, red))", [
            decl("--tw-inset-ring-color", colorMix),
          ]),
          decl("--tw-inset-ring-color", fallback),
        ];
      }

      return [decl("box-shadow", `inset ${main}`)];
    }

    if (main === "inherit" || main === "current" || main === "transparent") {
      return [
        decl(
          "--tw-inset-ring-color",
          main === "current" ? "currentColor" : main
        ),
      ];
    }
    return null;
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("color:")) {
      const cp = value.replace("color:", "");
      return [decl("--tw-inset-ring-color", `var(${cp})`)];
    }
    return [decl("--tw-inset-ring-color", `var(${value})`)];
  },
});

// --- Opacity  ---

functionalUtility({
  name: "opacity",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    // opacity-100, opacity-75, etc.
    if (parseNumber(value)) {
      let num = Number(value);
      if (num > 1) num = num / 100;
      return [decl("opacity", String(num))];
    }
    // opacity-[.67] → .67
    if (token.arbitrary) {
      return [decl("opacity", value)];
    }
    return null;
  },
  handleCustomProperty: (value) => [decl("opacity", `var(${value})`)],
  description: "opacity utility (number, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Mix Blend Mode  ---
[
  ["mix-blend-normal", "normal"],
  ["mix-blend-multiply", "multiply"],
  ["mix-blend-screen", "screen"],
  ["mix-blend-overlay", "overlay"],
  ["mix-blend-darken", "darken"],
  ["mix-blend-lighten", "lighten"],
  ["mix-blend-color-dodge", "color-dodge"],
  ["mix-blend-color-burn", "color-burn"],
  ["mix-blend-hard-light", "hard-light"],
  ["mix-blend-soft-light", "soft-light"],
  ["mix-blend-difference", "difference"],
  ["mix-blend-exclusion", "exclusion"],
  ["mix-blend-hue", "hue"],
  ["mix-blend-saturation", "saturation"],
  ["mix-blend-color", "color"],
  ["mix-blend-luminosity", "luminosity"],
  ["mix-blend-plus-darker", "plus-darker"],
  ["mix-blend-plus-lighter", "plus-lighter"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mix-blend-mode", value as string]]);
});

// --- Background Blend Mode  ---
[
  ["bg-blend-normal", "normal"],
  ["bg-blend-multiply", "multiply"],
  ["bg-blend-screen", "screen"],
  ["bg-blend-overlay", "overlay"],
  ["bg-blend-darken", "darken"],
  ["bg-blend-lighten", "lighten"],
  ["bg-blend-color-dodge", "color-dodge"],
  ["bg-blend-color-burn", "color-burn"],
  ["bg-blend-hard-light", "hard-light"],
  ["bg-blend-soft-light", "soft-light"],
  ["bg-blend-difference", "difference"],
  ["bg-blend-exclusion", "exclusion"],
  ["bg-blend-hue", "hue"],
  ["bg-blend-saturation", "saturation"],
  ["bg-blend-color", "color"],
  ["bg-blend-luminosity", "luminosity"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["background-blend-mode", value as string]]);
});

// --- Mask Clip  ---
[
  ["mask-clip-border", "border-box"],
  ["mask-clip-padding", "padding-box"],
  ["mask-clip-content", "content-box"],
  ["mask-clip-fill", "fill-box"],
  ["mask-clip-stroke", "stroke-box"],
  ["mask-clip-view", "view-box"],
  ["mask-no-clip", "no-clip"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-clip", value as string]]);
});

// --- Mask Composite  ---
[
  ["mask-add", "add"],
  ["mask-subtract", "subtract"],
  ["mask-intersect", "intersect"],
  ["mask-exclude", "exclude"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-composite", value as string]]);
});

// --- Mask Mode  ---
[
  ["mask-alpha", "alpha"],
  ["mask-luminance", "luminance"],
  ["mask-match", "match-source"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-mode", value as string]]);
});

// --- Mask Origin  ---
[
  ["mask-origin-border", "border-box"],
  ["mask-origin-padding", "padding-box"],
  ["mask-origin-content", "content-box"],
  ["mask-origin-fill", "fill-box"],
  ["mask-origin-stroke", "stroke-box"],
  ["mask-origin-view", "view-box"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-origin", value as string]]);
});

// --- Mask Position  ---
[
  ["mask-top-left", "top left"],
  ["mask-top", "top"],
  ["mask-top-right", "top right"],
  ["mask-left", "left"],
  ["mask-center", "center"],
  ["mask-right", "right"],
  ["mask-bottom-left", "bottom left"],
  ["mask-bottom", "bottom"],
  ["mask-bottom-right", "bottom right"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-position", value as string]]);
});
functionalUtility({
  name: "mask-position",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (token.arbitrary) return [decl("mask-position", value)];
    if (token.customProperty) return [decl("mask-position", `var(${value})`)];
    return null;
  },
  handleCustomProperty: (value) => [decl("mask-position", `var(${value})`)],
  description:
    "mask-position utility (static, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Mask Repeat  ---
[
  ["mask-repeat", "repeat"],
  ["mask-no-repeat", "no-repeat"],
  ["mask-repeat-x", "repeat-x"],
  ["mask-repeat-y", "repeat-y"],
  ["mask-repeat-space", "space"],
  ["mask-repeat-round", "round"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-repeat", value as string]]);
});

// --- Mask Size  ---
[
  ["mask-auto", "auto"],
  ["mask-cover", "cover"],
  ["mask-contain", "contain"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["mask-size", value as string]]);
});


// --- Mask Type  ---
[
    ["mask-type-alpha", "alpha"],
    ["mask-type-luminance", "luminance"],
  ].forEach(([name, value]) => {
    staticUtility(name as string, [["mask-type", value as string]]);
  });

// mask-size-[value] (arbitrary) & mask-size-(--custom-property)
functionalUtility({
  name: "mask-size",
  prop: "mask-size",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "mask-size utility (static, arbitrary, custom property 지원)",
  category: "effects",
});

// --- Mask Image  ---
functionalUtility({
  name: "mask",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (value === "none") return [decl("mask-image", "none")];
    if (token.arbitrary) return [decl("mask-image", value)];
    if (token.customProperty) return [decl("mask-image", `var(${value})`)];
    return null;
  },
  handleCustomProperty: (value) => [decl("mask-image", `var(${value})`)],
  description: "mask-image utility (arbitrary, custom property 지원)",
  category: "effects",
});

