import { staticUtility, functionalUtility } from "../core/registry";
import { atRule, decl } from "../core/ast";
import {
  parseNumber,
  parseLength,
} from "../core/utils";

// --- Typography: Font Family ---
staticUtility("font-sans", [["font-family", "var(--font-family-sans)"]], { category: 'typography' });
staticUtility("font-serif", [["font-family", "var(--font-family-serif)"]], { category: 'typography' });
staticUtility("font-mono", [["font-family", "var(--font-family-mono)"]], { category: 'typography' });

// --- Typography: Font Size ---
staticUtility("text-xs", [["font-size", "var(--text-xs)"], ["line-height", "var(--text-xs--line-height)"]], { category: 'typography' });
staticUtility("text-sm", [["font-size", "var(--text-sm)"], ["line-height", "var(--text-sm--line-height)"]], { category: 'typography' });
staticUtility("text-base", [["font-size", "var(--text-base)"], ["line-height", "var(--text-base--line-height)"]], { category: 'typography' });
staticUtility("text-lg", [["font-size", "var(--text-lg)"], ["line-height", "var(--text-lg--line-height)"]], { category: 'typography' });
staticUtility("text-xl", [["font-size", "var(--text-xl)"], ["line-height", "var(--text-xl--line-height)"]], { category: 'typography' });
staticUtility("text-2xl", [["font-size", "var(--text-2xl)"], ["line-height", "var(--text-2xl--line-height)"]], { category: 'typography' });
staticUtility("text-3xl", [["font-size", "var(--text-3xl)"], ["line-height", "var(--text-3xl--line-height)"]], { category: 'typography' });
staticUtility("text-4xl", [["font-size", "var(--text-4xl)"], ["line-height", "var(--text-4xl--line-height)"]], { category: 'typography' });
staticUtility("text-5xl", [["font-size", "var(--text-5xl)"], ["line-height", "var(--text-5xl--line-height)"]], { category: 'typography' });
staticUtility("text-6xl", [["font-size", "var(--text-6xl)"], ["line-height", "var(--text-6xl--line-height)"]], { category: 'typography' });
staticUtility("text-7xl", [["font-size", "var(--text-7xl)"], ["line-height", "var(--text-7xl--line-height)"]], { category: 'typography' });
staticUtility("text-8xl", [["font-size", "var(--text-8xl)"], ["line-height", "var(--text-8xl--line-height)"]], { category: 'typography' });
staticUtility("text-9xl", [["font-size", "var(--text-9xl)"], ["line-height", "var(--text-9xl--line-height)"]], { category: 'typography' });


// --- Typography: Font Weight ---
staticUtility("font-thin", [["font-weight", "var(--font-weight-thin)"]], { category: 'typography' });
staticUtility("font-extralight", [["font-weight", "var(--font-weight-extralight)"]], { category: 'typography' });
staticUtility("font-light", [["font-weight", "var(--font-weight-light)"]], { category: 'typography' });
staticUtility("font-normal", [["font-weight", "var(--font-weight-normal)"]], { category: 'typography' });
staticUtility("font-medium", [["font-weight", "var(--font-weight-medium)"]], { category: 'typography' });
staticUtility("font-semibold", [["font-weight", "var(--font-weight-semibold)"]], { category: 'typography' });
staticUtility("font-bold", [["font-weight", "var(--font-weight-bold)"]], { category: 'typography' });
staticUtility("font-extrabold", [["font-weight", "var(--font-weight-extrabold)"]], { category: 'typography' });
staticUtility("font-black", [["font-weight", "var(--font-weight-black)"]], { category: 'typography' });

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
staticUtility("italic", [["font-style", "italic"]], { category: 'typography' });
staticUtility("not-italic", [["font-style", "normal"]], { category: 'typography' });

// --- Typography: Letter Spacing ---
staticUtility("tracking-tighter", [["letter-spacing", "var(--letter-spacing-tighter)"]], { category: 'typography' });
staticUtility("tracking-tight", [["letter-spacing", "var(--letter-spacing-tight)"]], { category: 'typography' });
staticUtility("tracking-normal", [["letter-spacing", "var(--letter-spacing-normal)"]], { category: 'typography' });
staticUtility("tracking-wide", [["letter-spacing", "var(--letter-spacing-wide)"]], { category: 'typography' });
staticUtility("tracking-wider", [["letter-spacing", "var(--letter-spacing-wider)"]], { category: 'typography' });
staticUtility("tracking-widest", [["letter-spacing", "var(--letter-spacing-widest)"]], { category: 'typography' });

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
staticUtility("leading-none", [["line-height", "var(--line-height-none)"]], { category: 'typography' });
staticUtility("leading-tight", [["line-height", "var(--line-height-tight)"]], { category: 'typography' });
staticUtility("leading-snug", [["line-height", "var(--line-height-snug)"]], { category: 'typography' });
staticUtility("leading-normal", [["line-height", "var(--line-height-normal)"]], { category: 'typography' });
staticUtility("leading-relaxed", [["line-height", "var(--line-height-relaxed)"]], { category: 'typography' });
staticUtility("leading-loose", [["line-height", "var(--line-height-loose)"]], { category: 'typography' });

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
staticUtility("text-left", [["text-align", "left"]], { category: 'typography' });
staticUtility("text-center", [["text-align", "center"]], { category: 'typography' });
staticUtility("text-right", [["text-align", "right"]], { category: 'typography' });
staticUtility("text-justify", [["text-align", "justify"]], { category: 'typography' });
staticUtility("text-start", [["text-align", "start"]], { category: 'typography' });
staticUtility("text-end", [["text-align", "end"]], { category: 'typography' });

// --- Typography: Text Color ---
staticUtility("text-inherit", [["color", "inherit"]], { category: 'typography' });
staticUtility("text-current", [["color", "currentColor"]], { category: 'typography' });
staticUtility("text-transparent", [["color", "transparent"]], { category: 'typography' });

// --- Typography: Text Overflow ---
staticUtility("truncate", [["overflow", "hidden"], ["text-overflow", "ellipsis"], ["white-space", "nowrap"]], { category: 'typography' });
staticUtility("text-ellipsis", [["text-overflow", "ellipsis"]], { category: 'typography' });
staticUtility("text-clip", [["text-overflow", "clip"]], { category: 'typography' });

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
          decl("color", `color-mix(in lab, ${value} ${extra.opacity}%, transparent)`),
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
    const themeValue = ctx.theme("fontSize", value) as string | [string, string];
    if (themeValue) {
      if (Array.isArray(themeValue)) {
        // [fontSize, lineHeight] format
        return [
          decl("font-size", themeValue[0]),
          decl("line-height", themeValue[1])
        ];
      } else {
        return [decl("font-size", themeValue as string)];
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
staticUtility("uppercase", [["text-transform", "uppercase"]], { category: 'typography' });
staticUtility("lowercase", [["text-transform", "lowercase"]], { category: 'typography' });
staticUtility("capitalize", [["text-transform", "capitalize"]], { category: 'typography' });
staticUtility("normal-case", [["text-transform", "none"]], { category: 'typography' });

// --- Typography: Text Decoration ---
staticUtility("underline", [["text-decoration-line", "underline"]], { category: 'typography' });
staticUtility("overline", [["text-decoration-line", "overline"]], { category: 'typography' });
staticUtility("line-through", [["text-decoration-line", "line-through"]], { category: 'typography' });
staticUtility("no-underline", [["text-decoration-line", "none"]], { category: 'typography' });



// --- Typography: Whitespace ---
staticUtility("whitespace-normal", [["white-space", "normal"]], { category: 'typography' });
staticUtility("whitespace-nowrap", [["white-space", "nowrap"]], { category: 'typography' });
staticUtility("whitespace-pre", [["white-space", "pre"]], { category: 'typography' });
staticUtility("whitespace-pre-line", [["white-space", "pre-line"]], { category: 'typography' });
staticUtility("whitespace-pre-wrap", [["white-space", "pre-wrap"]], { category: 'typography' });
staticUtility("whitespace-break-spaces", [["white-space", "break-spaces"]], { category: 'typography' });

// --- Typography: Word Break ---
staticUtility("break-normal", [["overflow-wrap", "normal"], ["word-break", "normal"]], { category: 'typography' });
staticUtility("break-words", [["overflow-wrap", "break-word"]], { category: 'typography' });
staticUtility("break-all", [["word-break", "break-all"]], { category: 'typography' });
staticUtility("break-keep", [["word-break", "keep-all"]], { category: 'typography' });

// --- Typography: Font Smoothing ---
staticUtility("antialiased", [["-webkit-font-smoothing", "antialiased"], ["-moz-osx-font-smoothing", "grayscale"]], { category: 'typography' });
staticUtility("subpixel-antialiased", [["-webkit-font-smoothing", "auto"], ["-moz-osx-font-smoothing", "auto"]], { category: 'typography' });

// --- Typography: Font Stretch ---
staticUtility("font-stretch-normal", [["font-stretch", "normal"]], { category: 'typography' });
staticUtility("font-stretch-ultra-condensed", [["font-stretch", "ultra-condensed"]], { category: 'typography' });
staticUtility("font-stretch-extra-condensed", [["font-stretch", "extra-condensed"]], { category: 'typography' });
staticUtility("font-stretch-condensed", [["font-stretch", "condensed"]], { category: 'typography' });
staticUtility("font-stretch-semi-condensed", [["font-stretch", "semi-condensed"]], { category: 'typography' });
staticUtility("font-stretch-semi-expanded", [["font-stretch", "semi-expanded"]], { category: 'typography' });
staticUtility("font-stretch-expanded", [["font-stretch", "expanded"]], { category: 'typography' });
staticUtility("font-stretch-extra-expanded", [["font-stretch", "extra-expanded"]], { category: 'typography' });
staticUtility("font-stretch-ultra-expanded", [["font-stretch", "ultra-expanded"]], { category: 'typography' });

functionalUtility({
  name: "font-stretch",
  prop: "font-stretch",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "font-stretch utility (arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Font Variant Numeric ---
staticUtility("normal-nums", [["font-variant-numeric", "normal"]], { category: 'typography' });
staticUtility("ordinal", [["font-variant-numeric", "ordinal"]], { category: 'typography' });
staticUtility("slashed-zero", [["font-variant-numeric", "slashed-zero"]], { category: 'typography' });
staticUtility("lining-nums", [["font-variant-numeric", "lining-nums"]], { category: 'typography' });
staticUtility("oldstyle-nums", [["font-variant-numeric", "oldstyle-nums"]], { category: 'typography' });
staticUtility("proportional-nums", [["font-variant-numeric", "proportional-nums"]], { category: 'typography' });
staticUtility("tabular-nums", [["font-variant-numeric", "tabular-nums"]], { category: 'typography' });
staticUtility("diagonal-fractions", [["font-variant-numeric", "diagonal-fractions"]], { category: 'typography' });
staticUtility("stacked-fractions", [["font-variant-numeric", "stacked-fractions"]], { category: 'typography' });

// --- Typography: Line Clamp ---
staticUtility("line-clamp-none", [["-webkit-line-clamp", "none"]], { category: 'typography' });
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
staticUtility("list-none", [["list-style-type", "none"]], { category: 'typography' });
staticUtility("list-disc", [["list-style-type", "disc"]], { category: 'typography' });
staticUtility("list-decimal", [["list-style-type", "decimal"]], { category: 'typography' });

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
staticUtility("list-inside", [["list-style-position", "inside"]], { category: 'typography' });
staticUtility("list-outside", [["list-style-position", "outside"]], { category: 'typography' });

// --- Typography: List Style Image ---
staticUtility("list-image-none", [["list-style-image", "none"]], { category: 'typography' });

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
  staticUtility("decoration-solid", [["text-decoration-style", "solid"]], { category: 'typography' });
staticUtility("decoration-double", [["text-decoration-style", "double"]], { category: 'typography' });
staticUtility("decoration-dotted", [["text-decoration-style", "dotted"]], { category: 'typography' });
staticUtility("decoration-dashed", [["text-decoration-style", "dashed"]], { category: 'typography' });
staticUtility("decoration-wavy", [["text-decoration-style", "wavy"]], { category: 'typography' });

// --- Typography: Text Decoration Thickness ---
staticUtility("decoration-auto", [["text-decoration-thickness", "auto"]], { category: 'typography' });
staticUtility("decoration-from-font", [["text-decoration-thickness", "from-font"]], { category: 'typography' });
staticUtility("decoration-0", [["text-decoration-thickness", "0px"]], { category: 'typography' });
staticUtility("decoration-1", [["text-decoration-thickness", "1px"]], { category: 'typography' });
staticUtility("decoration-2", [["text-decoration-thickness", "2px"]], { category: 'typography' });
staticUtility("decoration-4", [["text-decoration-thickness", "4px"]], { category: 'typography' });
staticUtility("decoration-8", [["text-decoration-thickness", "8px"]], { category: 'typography' });

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
staticUtility("underline-offset-auto", [["text-underline-offset", "auto"]], { category: 'typography' });
staticUtility("underline-offset-0", [["text-underline-offset", "0px"]], { category: 'typography' });
staticUtility("underline-offset-1", [["text-underline-offset", "1px"]], { category: 'typography' });
staticUtility("underline-offset-2", [["text-underline-offset", "2px"]], { category: 'typography' });
staticUtility("underline-offset-4", [["text-underline-offset", "4px"]], { category: 'typography' });
staticUtility("underline-offset-8", [["text-underline-offset", "8px"]], { category: 'typography' });

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
staticUtility("text-wrap", [["text-wrap", "wrap"]], { category: 'typography' });
staticUtility("text-nowrap", [["text-wrap", "nowrap"]], { category: 'typography' });
staticUtility("text-balance", [["text-wrap", "balance"]], { category: 'typography' });
staticUtility("text-pretty", [["text-wrap", "pretty"]], { category: 'typography' });

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
staticUtility("align-baseline", [["vertical-align", "baseline"]], { category: 'typography' });
staticUtility("align-top", [["vertical-align", "top"]], { category: 'typography' });
staticUtility("align-middle", [["vertical-align", "middle"]], { category: 'typography' });
staticUtility("align-bottom", [["vertical-align", "bottom"]], { category: 'typography' });
staticUtility("align-text-top", [["vertical-align", "text-top"]], { category: 'typography' });
staticUtility("align-text-bottom", [["vertical-align", "text-bottom"]], { category: 'typography' });
staticUtility("align-sub", [["vertical-align", "sub"]], { category: 'typography' });
staticUtility("align-super", [["vertical-align", "super"]], { category: 'typography' });

functionalUtility({
  name: "align",
  prop: "vertical-align",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  description: "vertical-align utility (arbitrary, custom property supported)",
  category: "typography",
});

// --- Typography: Hyphens ---
staticUtility("hyphens-none", [["hyphens", "none"]], { category: 'typography' });
staticUtility("hyphens-manual", [["hyphens", "manual"]], { category: 'typography' });
staticUtility("hyphens-auto", [["hyphens", "auto"]], { category: 'typography' });

// --- Typography: Content ---
staticUtility("content-none", [["content", "none"]], { category: 'typography' });

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
