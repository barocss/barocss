import { staticUtility, functionalUtility } from "../core/registry";
import { atRule, decl } from "../core/ast";
import {
  parseNumber,
  parseLength,
} from "../core/utils";

// --- Typography: Font Family ---
staticUtility("font-sans", [["font-family", "var(--font-family-sans)"]]);
staticUtility("font-serif", [["font-family", "var(--font-family-serif)"]]);
staticUtility("font-mono", [["font-family", "var(--font-family-mono)"]]);

// --- Typography: Font Size ---
staticUtility("text-xs", [["font-size", "var(--text-xs)"], ["line-height", "var(--text-xs--line-height)"]]);
staticUtility("text-sm", [["font-size", "var(--text-sm)"], ["line-height", "var(--text-sm--line-height)"]]);
staticUtility("text-base", [["font-size", "var(--text-base)"], ["line-height", "var(--text-base--line-height)"]]);
staticUtility("text-lg", [["font-size", "var(--text-lg)"], ["line-height", "var(--text-lg--line-height)"]]);
staticUtility("text-xl", [["font-size", "var(--text-xl)"], ["line-height", "var(--text-xl--line-height)"]]);
staticUtility("text-2xl", [["font-size", "var(--text-2xl)"], ["line-height", "var(--text-2xl--line-height)"]]);
staticUtility("text-3xl", [["font-size", "var(--text-3xl)"], ["line-height", "var(--text-3xl--line-height)"]]);
staticUtility("text-4xl", [["font-size", "var(--text-4xl)"], ["line-height", "var(--text-4xl--line-height)"]]);
staticUtility("text-5xl", [["font-size", "var(--text-5xl)"], ["line-height", "var(--text-5xl--line-height)"]]);
staticUtility("text-6xl", [["font-size", "var(--text-6xl)"], ["line-height", "var(--text-6xl--line-height)"]]);
staticUtility("text-7xl", [["font-size", "var(--text-7xl)"], ["line-height", "var(--text-7xl--line-height)"]]);
staticUtility("text-8xl", [["font-size", "var(--text-8xl)"], ["line-height", "var(--text-8xl--line-height)"]]);
staticUtility("text-9xl", [["font-size", "var(--text-9xl)"], ["line-height", "var(--text-9xl--line-height)"]]);


// --- Typography: Font Weight ---
staticUtility("font-thin", [["font-weight", "var(--font-weight-thin)"]]);
staticUtility("font-extralight", [["font-weight", "var(--font-weight-extralight)"]]);
staticUtility("font-light", [["font-weight", "var(--font-weight-light)"]]);
staticUtility("font-normal", [["font-weight", "var(--font-weight-normal)"]]);
staticUtility("font-medium", [["font-weight", "var(--font-weight-medium)"]]);
staticUtility("font-semibold", [["font-weight", "var(--font-weight-semibold)"]]);
staticUtility("font-bold", [["font-weight", "var(--font-weight-bold)"]]);
staticUtility("font-extrabold", [["font-weight", "var(--font-weight-extrabold)"]]);
staticUtility("font-black", [["font-weight", "var(--font-weight-black)"]]);

functionalUtility({
  name: "font",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value) => {
    if (parseNumber(value)) {
      return [decl("font-weight", value)];
    }
    return [decl("font-family", value)];
  },
  handleCustomProperty: (value) => {

    if (value.startsWith("font-name:")) {
      return [decl("font-family", `var(${value.replace("font-name:", "")})`)];
    }
    return [decl("font-weight", `var(${value})`)];
  },
  description: "font-weight utility (theme, number, arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Font Style ---
staticUtility("italic", [["font-style", "italic"]]);
staticUtility("not-italic", [["font-style", "normal"]]);

// --- Typography: Letter Spacing ---
staticUtility("tracking-tighter", [["letter-spacing", "var(--letter-spacing-tighter)"]]);
staticUtility("tracking-tight", [["letter-spacing", "var(--letter-spacing-tight)"]]);
staticUtility("tracking-normal", [["letter-spacing", "var(--letter-spacing-normal)"]]);
staticUtility("tracking-wide", [["letter-spacing", "var(--letter-spacing-wide)"]]);
staticUtility("tracking-wider", [["letter-spacing", "var(--letter-spacing-wider)"]]);
staticUtility("tracking-widest", [["letter-spacing", "var(--letter-spacing-widest)"]]);

functionalUtility({
  name: "tracking",
  prop: "letter-spacing",
  themeKey: "letterSpacing",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "letter-spacing utility (theme, arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Line Height ---
staticUtility("leading-none", [["line-height", "var(--line-height-none)"]]);
staticUtility("leading-tight", [["line-height", "var(--line-height-tight)"]]);
staticUtility("leading-snug", [["line-height", "var(--line-height-snug)"]]);
staticUtility("leading-normal", [["line-height", "var(--line-height-normal)"]]);
staticUtility("leading-relaxed", [["line-height", "var(--line-height-relaxed)"]]);
staticUtility("leading-loose", [["line-height", "var(--line-height-loose)"]]);

functionalUtility({
  name: "leading",
  prop: "line-height",
  themeKey: "lineHeight",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => parseNumber(value),
  description: "line-height utility (theme, number, arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Text Align ---
staticUtility("text-left", [["text-align", "left"]]);
staticUtility("text-center", [["text-align", "center"]]);
staticUtility("text-right", [["text-align", "right"]]);
staticUtility("text-justify", [["text-align", "justify"]]);
staticUtility("text-start", [["text-align", "start"]]);
staticUtility("text-end", [["text-align", "end"]]);

// --- Typography: Text Color ---
staticUtility("text-inherit", [["color", "inherit"]]);
staticUtility("text-current", [["color", "currentColor"]]);
staticUtility("text-transparent", [["color", "transparent"]]);

// --- Typography: Text Overflow ---
staticUtility("truncate", [["overflow", "hidden"], ["text-overflow", "ellipsis"], ["white-space", "nowrap"]]);
staticUtility("text-ellipsis", [["text-overflow", "ellipsis"]]);
staticUtility("text-clip", [["text-overflow", "clip"]]);

functionalUtility({
  name: "text",  
  themeKey: "colors",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, ctx, token, extra) => {
    
    if (extra?.realThemeValue) {
      if (extra.opacity) {
        return [
          atRule("supports", `(color:color-mix(in lab, red, red))`, [
            decl("color", `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`),
          ]),
          decl("color", value),
        ];
      }
      return [decl("color", value)];
    }

    if (parseLength(value)) {
      return [decl("font-size", value)];
    }
    return [decl("color", value)];
  },
  handleCustomProperty: (value) => {
    if (value.startsWith("color:")) {
      return [decl("color", `var(${value.replace("color:", "")})`)];
    }
    return [decl("font-size", `var(${value})`)];
  },
  description: "text color utility (theme, arbitrary, custom property supported)",
  category: "typography",
});


functionalUtility({
  name: "text",
  themeKey: "fontSize",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    // Check if it's a theme value first
    const themeValue = ctx.theme("fontSize", value);
    if (themeValue) {
      if (Array.isArray(themeValue)) {
        // [fontSize, lineHeight] format
        return [
          decl("font-size", themeValue[0]),
          decl("line-height", themeValue[1])
        ];
      } else {
        return [decl("font-size", themeValue)];
      }
    }

    // Handle arbitrary values
    if (token.arbitrary) {
      return [decl("font-size", value)];
    }

    return null;
  },
  handleCustomProperty: (value) => [decl("font-size", `var(${value})`)],
  description: "font-size utility (theme, arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Text Transform ---
staticUtility("uppercase", [["text-transform", "uppercase"]]);
staticUtility("lowercase", [["text-transform", "lowercase"]]);
staticUtility("capitalize", [["text-transform", "capitalize"]]);
staticUtility("normal-case", [["text-transform", "none"]]);

// --- Typography: Text Decoration ---
staticUtility("underline", [["text-decoration-line", "underline"]]);
staticUtility("overline", [["text-decoration-line", "overline"]]);
staticUtility("line-through", [["text-decoration-line", "line-through"]]);
staticUtility("no-underline", [["text-decoration-line", "none"]]);



// --- Typography: Whitespace ---
staticUtility("whitespace-normal", [["white-space", "normal"]]);
staticUtility("whitespace-nowrap", [["white-space", "nowrap"]]);
staticUtility("whitespace-pre", [["white-space", "pre"]]);
staticUtility("whitespace-pre-line", [["white-space", "pre-line"]]);
staticUtility("whitespace-pre-wrap", [["white-space", "pre-wrap"]]);
staticUtility("whitespace-break-spaces", [["white-space", "break-spaces"]]);

// --- Typography: Word Break ---
staticUtility("break-normal", [["overflow-wrap", "normal"], ["word-break", "normal"]]);
staticUtility("break-words", [["overflow-wrap", "break-word"]]);
staticUtility("break-all", [["word-break", "break-all"]]);
staticUtility("break-keep", [["word-break", "keep-all"]]);

// --- Typography: Font Smoothing ---
staticUtility("antialiased", [["-webkit-font-smoothing", "antialiased"], ["-moz-osx-font-smoothing", "grayscale"]]);
staticUtility("subpixel-antialiased", [["-webkit-font-smoothing", "auto"], ["-moz-osx-font-smoothing", "auto"]]);

// --- Typography: Font Stretch ---
staticUtility("font-stretch-normal", [["font-stretch", "normal"]]);
staticUtility("font-stretch-ultra-condensed", [["font-stretch", "ultra-condensed"]]);
staticUtility("font-stretch-extra-condensed", [["font-stretch", "extra-condensed"]]);
staticUtility("font-stretch-condensed", [["font-stretch", "condensed"]]);
staticUtility("font-stretch-semi-condensed", [["font-stretch", "semi-condensed"]]);
staticUtility("font-stretch-semi-expanded", [["font-stretch", "semi-expanded"]]);
staticUtility("font-stretch-expanded", [["font-stretch", "expanded"]]);
staticUtility("font-stretch-extra-expanded", [["font-stretch", "extra-expanded"]]);
staticUtility("font-stretch-ultra-expanded", [["font-stretch", "ultra-expanded"]]);

functionalUtility({
  name: "font-stretch",
  prop: "font-stretch",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "font-stretch utility (arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Font Variant Numeric ---
staticUtility("normal-nums", [["font-variant-numeric", "normal"]]);
staticUtility("ordinal", [["font-variant-numeric", "ordinal"]]);
staticUtility("slashed-zero", [["font-variant-numeric", "slashed-zero"]]);
staticUtility("lining-nums", [["font-variant-numeric", "lining-nums"]]);
staticUtility("oldstyle-nums", [["font-variant-numeric", "oldstyle-nums"]]);
staticUtility("proportional-nums", [["font-variant-numeric", "proportional-nums"]]);
staticUtility("tabular-nums", [["font-variant-numeric", "tabular-nums"]]);
staticUtility("diagonal-fractions", [["font-variant-numeric", "diagonal-fractions"]]);
staticUtility("stacked-fractions", [["font-variant-numeric", "stacked-fractions"]]);

// --- Typography: Line Clamp ---
staticUtility("line-clamp-none", [["-webkit-line-clamp", "none"]]);
functionalUtility({
  name: "line-clamp",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => parseNumber(value),
  handle: (value) => [
    decl("overflow", "hidden"),
    decl("display", "-webkit-box"),
    decl("-webkit-box-orient", "vertical"),
    decl("-webkit-line-clamp", value)
  ],
  handleCustomProperty: (value) => [
    decl("overflow", "hidden"),
    decl("display", "-webkit-box"),
    decl("-webkit-box-orient", "vertical"),
    decl("-webkit-line-clamp", `var(${value})`)
  ],
  description: "line-clamp utility (number, arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: List Style Type ---
staticUtility("list-none", [["list-style-type", "none"]]);
staticUtility("list-disc", [["list-style-type", "disc"]]);
staticUtility("list-decimal", [["list-style-type", "decimal"]]);

functionalUtility({
  name: "list",
  prop: "list-style-type",
  themeKey: "listStyleType",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "list-style-type utility (theme, arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: List Style Position ---
staticUtility("list-inside", [["list-style-position", "inside"]]);
staticUtility("list-outside", [["list-style-position", "outside"]]);

// --- Typography: List Style Image ---
staticUtility("list-image-none", [["list-style-image", "none"]]);

functionalUtility({
  name: "list-image",
  prop: "list-style-image",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value) => [decl("list-style-image", `url(${value})`)],
  handleCustomProperty: (value) => [decl("list-style-image", `var(${value})`)],
  description: "list-style-image utility (arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Text Decoration Color ---
functionalUtility({
  name: "decoration",
  themeKey: "colors",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  supportsOpacity: true,
  handle: (value, ctx, token, extra) => {
    if (extra?.realThemeValue) {
      if (extra.opacity) {
        return [
          atRule("supports", `(color:color-mix(in lab, red, red))`, [
            decl("text-decoration-color", `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`),
          ]),
          decl("text-decoration-color", value),
        ];
      }
      return [decl("text-decoration-color", value)];
    }
    return [decl("text-decoration-color", value)];
  },
  handleCustomProperty: (value) => [decl("text-decoration-color", `var(${value})`)],
  description: "text-decoration-color utility (theme, arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Text Decoration Style ---
staticUtility("decoration-solid", [["text-decoration-style", "solid"]]);
staticUtility("decoration-double", [["text-decoration-style", "double"]]);
staticUtility("decoration-dotted", [["text-decoration-style", "dotted"]]);
staticUtility("decoration-dashed", [["text-decoration-style", "dashed"]]);
staticUtility("decoration-wavy", [["text-decoration-style", "wavy"]]);

// --- Typography: Text Decoration Thickness ---
staticUtility("decoration-auto", [["text-decoration-thickness", "auto"]]);
staticUtility("decoration-from-font", [["text-decoration-thickness", "from-font"]]);
staticUtility("decoration-0", [["text-decoration-thickness", "0px"]]);
staticUtility("decoration-1", [["text-decoration-thickness", "1px"]]);
staticUtility("decoration-2", [["text-decoration-thickness", "2px"]]);
staticUtility("decoration-4", [["text-decoration-thickness", "4px"]]);
staticUtility("decoration-8", [["text-decoration-thickness", "8px"]]);

functionalUtility({
  name: "decoration",
  prop: "text-decoration-thickness",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => `${value}px`,
  description: "text-decoration-thickness utility (arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Text Underline Offset ---
staticUtility("underline-offset-auto", [["text-underline-offset", "auto"]]);
staticUtility("underline-offset-0", [["text-underline-offset", "0px"]]);
staticUtility("underline-offset-1", [["text-underline-offset", "1px"]]);
staticUtility("underline-offset-2", [["text-underline-offset", "2px"]]);
staticUtility("underline-offset-4", [["text-underline-offset", "4px"]]);
staticUtility("underline-offset-8", [["text-underline-offset", "8px"]]);

functionalUtility({
  name: "underline-offset",
  prop: "text-underline-offset",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => `${value}px`,
  description: "text-underline-offset utility (arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Text Wrap ---
staticUtility("text-wrap", [["text-wrap", "wrap"]]);
staticUtility("text-nowrap", [["text-wrap", "nowrap"]]);
staticUtility("text-balance", [["text-wrap", "balance"]]);
staticUtility("text-pretty", [["text-wrap", "pretty"]]);

// --- Typography: Text Indent ---
functionalUtility({
  name: "indent",
  prop: "text-indent",
  supportsNegative: true,
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handleBareValue: ({ value }) => `calc(var(--spacing) * ${value})`,
  handleNegativeBareValue: ({ value }) => `calc(var(--spacing) * -${value})`,
  description: "text-indent utility (spacing, negative, arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Vertical Align ---
staticUtility("align-baseline", [["vertical-align", "baseline"]]);
staticUtility("align-top", [["vertical-align", "top"]]);
staticUtility("align-middle", [["vertical-align", "middle"]]);
staticUtility("align-bottom", [["vertical-align", "bottom"]]);
staticUtility("align-text-top", [["vertical-align", "text-top"]]);
staticUtility("align-text-bottom", [["vertical-align", "text-bottom"]]);
staticUtility("align-sub", [["vertical-align", "sub"]]);
staticUtility("align-super", [["vertical-align", "super"]]);

functionalUtility({
  name: "align",
  prop: "vertical-align",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "vertical-align utility (arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Hyphens ---
staticUtility("hyphens-none", [["hyphens", "none"]]);
staticUtility("hyphens-manual", [["hyphens", "manual"]]);
staticUtility("hyphens-auto", [["hyphens", "auto"]]);

// --- Typography: Content ---
staticUtility("content-none", [["content", "none"]]);

functionalUtility({
  name: "content",
  prop: "content",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value) => [decl("content", `"${value}"`)],
  handleCustomProperty: (value) => [decl("content", `var(${value})`)],
  description: "content utility (arbitrary, custom property supported)",
  category: "typography",
});
