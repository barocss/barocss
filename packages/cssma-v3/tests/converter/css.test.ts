import { describe, it, expect } from "vitest";
import { cssConverter, SelectorNode } from "../../src/converter/css";
import { selectorTreeToCssSelector } from "../../src/converter/selector";
import type { CssmaContext } from "../../src/theme-types";
import type { ParsedClass } from "../../src/types";
import { theme as themeGetter } from "../../src/config/theme-getter";

const mockTheme = {
  colors: {
    "red-500": "#ef4444",
    "green-500": "#22c55e",
    "blue-500": "#3b82f6",
    white: "#fff",
  },
  spacing: {
    "0": "0px",
    "1": "0.25rem",
    "2": "0.5rem",
    "4": "1rem",
    "8": "2rem",
  },
};

// Mock CssmaContext
const mockContext: CssmaContext = {
  theme: (...args) => {
    return themeGetter(mockTheme, ...args);
  },
  config: () => undefined,
  plugins: [],
};

describe("cssConverter", () => {
  it("converts bg-red-500, text-white, p-4", () => {
    const parsed: ParsedClass[] = [
      {
        original: "bg-red-500",
        utility: {
          type: "utility",
          prefix: "bg",
          value: "red-500",
          preset: false,
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          slash: undefined,
          raw: "bg-red-500",
        },
        modifiers: [],
      },
      {
        original: "text-white",
        utility: {
          type: "utility",
          prefix: "text",
          value: "white",
          preset: false,
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          slash: undefined,
          raw: "text-white",
        },
        modifiers: [],
      },
      {
        original: "p-4",
        utility: {
          type: "utility",
          prefix: "p",
          value: "4",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          slash: undefined,
          raw: "p-4",
        },
        modifiers: [],
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules).toEqual([
      {
        className: "bg-red-500",
        selectorTree: [{ type: "class", value: ".bg-red-500" }],
        css: "background-color: #ef4444;",
      },
      {
        className: "text-white",
        selectorTree: [{ type: "class", value: ".text-white" }],
        css: "color: #fff;",
      },
      {
        className: "p-4",
        selectorTree: [{ type: "class", value: ".p-4" }],
        css: "padding: 1rem;",
      },
    ]);
  });

  it("converts sm:hover:bg-green-500", () => {
    const parsed: ParsedClass[] = [
      {
        original: "sm:hover:bg-green-500",
        utility: {
          type: "utility",
          prefix: "bg",
          value: "green-500",
          preset: false,
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          slash: undefined,
          raw: "bg-green-500",
        },
        modifiers: [
          {
            type: "modifier",
            raw: "sm",
            prefix: "sm",
            preset: true,
            value: "",
            customProperty: false,
            arbitrary: false,
            important: false,
            negative: false,
            numeric: false,
            slash: undefined,
          },
          {
            type: "modifier",
            raw: "hover",
            prefix: "hover",
            preset: false,
            value: "",
            customProperty: false,
            arbitrary: false,
            important: false,
            negative: false,
            numeric: false,
            slash: undefined,
          },
        ],
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].className).toBe("sm:hover:bg-green-500");
    expect(rules[0].selectorTree).toEqual([
      { type: "media", value: "@media (min-width: 640px)" },
      { type: "pseudo", value: ":hover" },
      { type: "class", value: ".sm:hover:bg-green-500" },
    ]);
    expect(rules[0].css).toBe("background-color: #22c55e;");
    // selectorTreeToCssSelector 조합
    const selector = selectorTreeToCssSelector(
      rules[0].selectorTree,
      mockContext
    );
    expect(selector).toBe(
      "@media (min-width: 640px) { .sm:hover:bg-green-500:hover }"
    );
  });

  it("converts dark:focus:text-white", () => {
    const parsed: ParsedClass[] = [
      {
        original: "dark:focus:text-white",
        utility: {
          prefix: "text",
          value: "white",
          preset: false,
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          slash: undefined,
          raw: "text-white",
          type: "utility",
        },
        modifiers: [
          {
            type: "modifier",
            raw: "dark",
            preset: true,
            value: "",
            customProperty: false,
            arbitrary: false,
            important: false,
            negative: false,
            numeric: false,
            slash: undefined,
            prefix: "dark",
          },
          {
            type: "modifier",
            raw: "focus",
            preset: false,
            value: "",
            customProperty: false,
            arbitrary: false,
            important: false,
            negative: false,
            numeric: false,
            slash: undefined,
            prefix: "focus",
          },
        ],
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].className).toBe("dark:focus:text-white");
    expect(rules[0].selectorTree).toEqual([
      { type: "theme", value: ".dark" },
      { type: "pseudo", value: ":focus" },
      { type: "class", value: ".dark:focus:text-white" },
    ]);
    expect(rules[0].css).toBe("color: #fff;");
    const selector = selectorTreeToCssSelector(
      rules[0].selectorTree,
      mockContext
    );
    expect(selector).toBe(".dark .dark:focus:text-white:focus");
  });
});

describe("cssConverter selector integration", () => {
  it("basic class", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [],
        utility: { prefix: "text", value: "red", raw: "text-red" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".text-red");
  });

  it("pseudo selector", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "modifier", raw: "hover" }],
        utility: { prefix: "text", value: "blue", raw: "text-blue" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".hover:text-blue:hover");
  });

  it("group modifier", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "modifier", raw: "group-hover" }],
        utility: { prefix: "bg", value: "green", raw: "bg-green" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".group:hover .bg-green");
  });

  it("peer modifier", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "modifier", raw: "peer-focus" }],
        utility: { prefix: "underline", value: "", raw: "underline" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".peer:focus ~ .underline");
  });

  it("attribute selector", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "modifier", raw: "aria-checked=true" }],
        utility: { prefix: "bg", value: "white", raw: "bg-white" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe("[aria-checked=true] .bg-white");
  });

  it("container modifier", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "modifier", raw: "@container" }],
        utility: { prefix: "p", value: "4", raw: "p-4" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe("@container .p-4");
  });

  it("logical selector", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "modifier", raw: "not" }],
        utility: { prefix: "mb", value: "2", raw: "mb-2" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(":not .mb-2");
  });

  it("theme selector", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "modifier", raw: "dark" }],
        utility: { prefix: "text", value: "white", raw: "text-white" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".dark .text-white");
  });

  it("media query", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "modifier", raw: "sm" }],
        utility: { prefix: "text", value: "lg", raw: "text-lg" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe("@media (min-width: 640px) { .sm:text-lg }");
  });

  it("complex: group + peer + attr + theme + container + logical + pseudo", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [
          { type: "modifier", raw: "group-focus" },
          { type: "modifier", raw: "peer-active" },
          { type: "modifier", raw: "data-state=open" },
          { type: "modifier", raw: "dark" },
          { type: "modifier", raw: "@container" },
          { type: "modifier", raw: "not" },
          { type: "modifier", raw: "hover" },
        ],
        utility: { prefix: "text", value: "xl", raw: "text-xl" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(
      ".group:focus .peer:active ~ [data-state=open] .dark @container :not .text-xl:hover"
    );
  });

  it("media + everything", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [
          { type: "modifier", raw: "md" },
          { type: "modifier", raw: "group-active" },
          { type: "modifier", raw: "peer-checked" },
          { type: "modifier", raw: "aria-selected=true" },
          { type: "modifier", raw: "light" },
          { type: "modifier", raw: "@container" },
          { type: "modifier", raw: "has" },
          { type: "modifier", raw: "focus" },
        ],
        utility: { prefix: "font", value: "bold", raw: "font-bold" } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(
      "@media (min-width: 768px) { .group:active .peer:checked ~ [aria-selected=true] .light @container :has .font-bold:focus }"
    );
  });

  it("placeholder modifier + text color", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "pseudo", value: "::placeholder" }],
        utility: {
          prefix: "text",
          value: "blue-500",
          raw: "text-blue-500",
          type: "utility",
          preset: false,
        } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".text-blue-500::placeholder");
    expect(rules[0].css).toContain("color: #00f");
  });

  it("group + bg + important", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "group", value: ".group:hover" }],
        utility: {
          prefix: "bg",
          value: "green",
          raw: "bg-green",
          type: "utility",
          preset: false,
          important: true,
        } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".group:hover .bg-green");
    expect(rules[0].css).toContain("background-color: #0f0");
    expect(rules[0].css).toContain("!important");
  });

  it("peer + text + negative", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "peer", value: ".peer:focus" }],
        utility: {
          prefix: "text",
          value: "red",
          raw: "text-red",
          type: "utility",
          preset: false,
          negative: true,
        } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".peer:focus ~ .text-red");
    expect(rules[0].css).toContain("color: #f00");
  });

  it("attribute + border", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "attribute", value: "[aria-checked=true]" }],
        utility: {
          prefix: "border",
          value: "white",
          raw: "border-white",
          type: "utility",
          preset: false,
        } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe("[aria-checked=true] .border-white");
    expect(rules[0].css).toContain("border-color: #fff");
  });

  it("container + p", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "container", value: ".container" }],
        utility: {
          prefix: "p",
          value: "4",
          raw: "p-4",
          type: "utility",
          preset: false,
        } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".container .p-4");
    expect(rules[0].css).toContain("padding: 1rem");
  });

  it("logical + bg", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [{ type: "logical", value: ":not" }],
        utility: {
          prefix: "bg",
          value: "blue",
          raw: "bg-blue",
          type: "utility",
          preset: false,
        } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(":not .bg-blue");
    expect(rules[0].css).toContain("background-color: #00f");
  });

  it("arbitrary value + text", () => {
    const parsed: ParsedClass[] = [
      {
        modifiers: [],
        utility: {
          prefix: "text",
          value: "oklch(0.6 0.2 120)",
          raw: "text-[oklch(0.6_0.2_120)]",
          type: "utility",
          preset: false,
          arbitrary: true,
        } as any,
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].selector).toBe(".text-[oklch(0.6_0.2_120)]");
    expect(rules[0].css).toContain("color: oklch(0.6 0.2 120)");
  });

  it("converts negative margin and arbitrary value", () => {
    const parsed: ParsedClass[] = [
      {
        original: "-mx-2",
        utility: {
          type: "utility",
          prefix: "mx",
          value: "2",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: true,
          numeric: true,
          raw: "-mx-2",
        },
        modifiers: [],
      },
      {
        original: "w-[300px]",
        utility: {
          type: "utility",
          prefix: "w",
          value: "[300px]",
          arbitrary: true,
          arbitraryValue: "300px",
          customProperty: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "w-[300px]",
        },
        modifiers: [],
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].css).toBe("margin-left: -0.5rem; margin-right: -0.5rem;");
    expect(rules[1].css).toBe("width: 300px;");
  });

  it("converts important and arbitrary color", () => {
    const parsed: ParsedClass[] = [
      {
        original: "text-center!",
        utility: {
          type: "utility",
          prefix: "text",
          value: "center",
          customProperty: false,
          arbitrary: false,
          important: true,
          negative: false,
          numeric: false,
          raw: "text-center!",
        },
        modifiers: [],
      },
      {
        original: "bg-[#123456]",
        utility: {
          type: "utility",
          prefix: "bg",
          value: "[#123456]",
          arbitrary: true,
          arbitraryValue: "#123456",
          customProperty: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "bg-[#123456]",
        },
        modifiers: [],
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].css).toBe("text-align: center !important;");
    expect(rules[1].css).toBe("background-color: #123456;");
  });

  it("converts font, leading, tracking, line-clamp", () => {
    const parsed: ParsedClass[] = [
      {
        original: "font-bold",
        utility: {
          type: "utility",
          prefix: "font",
          value: "bold",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "font-bold",
        },
        modifiers: [],
      },
      {
        original: "leading-tight",
        utility: {
          type: "utility",
          prefix: "leading",
          value: "tight",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "leading-tight",
        },
        modifiers: [],
      },
      {
        original: "tracking-wide",
        utility: {
          type: "utility",
          prefix: "tracking",
          value: "wide",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "tracking-wide",
        },
        modifiers: [],
      },
      {
        original: "line-clamp-3",
        utility: {
          type: "utility",
          prefix: "line-clamp",
          value: "3",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "line-clamp-3",
        },
        modifiers: [],
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].css).toContain("font-weight");
    expect(rules[1].css).toContain("line-height");
    expect(rules[2].css).toContain("letter-spacing");
    expect(rules[3].css).toContain("webkit-line-clamp");
  });

  it("converts shadow, opacity, scale, duration, animate", () => {
    const parsed: ParsedClass[] = [
      {
        original: "shadow-lg",
        utility: {
          type: "utility",
          prefix: "shadow",
          value: "lg",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "shadow-lg",
        },
        modifiers: [],
      },
      {
        original: "opacity-50",
        utility: {
          type: "utility",
          prefix: "opacity",
          value: "50",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "opacity-50",
        },
        modifiers: [],
      },
      {
        original: "scale-110",
        utility: {
          type: "utility",
          prefix: "scale",
          value: "110",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "scale-110",
        },
        modifiers: [],
      },
      {
        original: "duration-300",
        utility: {
          type: "utility",
          prefix: "duration",
          value: "300",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "duration-300",
        },
        modifiers: [],
      },
      {
        original: "animate-spin",
        utility: {
          type: "utility",
          prefix: "animate",
          value: "spin",
          customProperty: false,
          arbitrary: false,
          important: false,
          negative: false,
          numeric: false,
          raw: "animate-spin",
        },
        modifiers: [],
      },
    ];
    const rules = cssConverter(parsed, mockContext);
    expect(rules[0].css).toContain("box-shadow");
    expect(rules[1].css).toContain("opacity");
    expect(rules[2].css).toContain("scale");
    expect(rules[3].css).toContain("transition-duration");
    expect(rules[4].css).toContain("animation");
  });
});
