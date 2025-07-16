import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import { parseColor, parseNumber } from "../core/utils";

// --- Box Shadow ---
// https://tailwindcss.com/docs/box-shadow

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
  ["inset-shadow-2xs", "var(--inset-shadow-2xs)"],
  ["inset-shadow-xs", "var(--inset-shadow-xs)"],
  ["inset-shadow-sm", "var(--inset-shadow-sm)"],
  ["inset-shadow-md", "var(--inset-shadow-md)"],
  ["inset-shadow-lg", "var(--inset-shadow-lg)"],
  ["inset-shadow-xl", "var(--inset-shadow-xl)"],
  ["inset-shadow-2xl", "var(--inset-shadow-2xl)"],
  ["inset-shadow-none", "0 0 #0000"],
].forEach(([name, value]) => {
  staticUtility(name as string, [["box-shadow", value as string]]);
});

// --- Box Shadow Color (with opacity, custom property, arbitrary) ---
// shadow-red-500, shadow-red-500/50, shadow-[#bada55]/80, shadow-(color:--my-shadow), shadow-inherit, etc.

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
      let colorVar = `var(--color-${realThemeValue})`;
      let colorValue = colorVar;
      if (opacity) {
        colorValue = `color-mix(in oklab, ${colorVar} ${opacity}%, transparent)`;
      }
      return [decl("--tw-shadow-color", colorValue)];
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

    // Theme color: shadow-red-500
    const themeColor = ctx.theme?.("colors", main);
    if (themeColor) {
      if (opacity) {
        return [
          decl(
            "--tw-shadow-color",
            `color-mix(in oklab, var(--color-${main}) ${opacity}%, transparent)`
          ),
        ];
      }
      return [decl("--tw-shadow-color", `var(--color-${main})`)];
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
      let colorVar = `var(--color-${realThemeValue})`;
      let colorValue = colorVar;
      if (opacity) {
        colorValue = `color-mix(in oklab, ${colorVar} ${opacity}%, transparent)`;
      }
      return [decl("--tw-inset-shadow-color", colorValue)];
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
