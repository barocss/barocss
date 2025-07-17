import { describe, it, expect } from "vitest";
import "../../src/index"; // Ensure all utilities are registered
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

// --- New preset utility structure its ---
describe("preset typography utilities", () => {
  const ctx = createContext({
    theme: {
      colors: { red: { 500: "#f00" }, blue: { 500: "#00f" } },
      "--z-index": { "10": "10", "20": "20" },
      "--order": { "1": "1", "2": "2" },
      "--grid-column": { "2": "2", "3": "3" },
      "--grid-column-start": { "1": "1" },
      "--grid-column-end": { "2": "2" },
    },
  });

  describe("typography utilities", () => {
    // Font Family
    it("font-sans → font-family: var(--font-family-sans)", () => {
      expect(applyClassName("font-sans", ctx)).toEqual([
        { type: "decl", prop: "font-family", value: "var(--font-family-sans)" },
      ]);
    });
    it("font-serif → font-family: var(--font-family-serif)", () => {
      expect(applyClassName("font-serif", ctx)).toEqual([
        {
          type: "decl",
          prop: "font-family",
          value: "var(--font-family-serif)",
        },
      ]);
    });
    it("font-mono → font-family: var(--font-family-mono)", () => {
      expect(applyClassName("font-mono", ctx)).toEqual([
        { type: "decl", prop: "font-family", value: "var(--font-family-mono)" },
      ]);
    });
    it("font-[system-ui] → font-family: system-ui", () => {
      expect(applyClassName("font-[system-ui]", ctx)).toEqual([
        { type: "decl", prop: "font-family", value: "system-ui" },
      ]);
    });
    it("font-(font-name:--my-font) → font-family: var(--my-font)", () => {
      expect(applyClassName("font-(font-name:--my-font)", ctx)).toEqual([
        { type: "decl", prop: "font-family", value: "var(--my-font)" },
      ]);
    });

    // Font Size
    it("text-xs → font-size + line-height", () => {
      expect(applyClassName("text-xs", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-xs)" },
        {
          type: "decl",
          prop: "line-height",
          value: "var(--text-xs--line-height)",
        },
      ]);
    });
    it("text-sm → font-size + line-height", () => {
      expect(applyClassName("text-sm", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-sm)" },
        {
          type: "decl",
          prop: "line-height",
          value: "var(--text-sm--line-height)",
        },
      ]);
    });
    it("text-base → font-size + line-height", () => {
      expect(applyClassName("text-base", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-base)" },
        {
          type: "decl",
          prop: "line-height",
          value: "var(--text-base--line-height)",
        },
      ]);
    });
    it("text-lg → font-size + line-height", () => {
      expect(applyClassName("text-lg", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-lg)" },
        {
          type: "decl",
          prop: "line-height",
          value: "var(--text-lg--line-height)",
        },
      ]);
    });
    it("text-xl → font-size + line-height", () => {
      expect(applyClassName("text-xl", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-xl)" },
        {
          type: "decl",
          prop: "line-height",
          value: "var(--text-xl--line-height)",
        },
      ]);
    });
    it("text-2xl → font-size + line-height", () => {
      expect(applyClassName("text-2xl", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--text-2xl)" },
        {
          type: "decl",
          prop: "line-height",
          value: "var(--text-2xl--line-height)",
        },
      ]);
    });
    it("text-[14px] → font-size: 14px", () => {
      expect(applyClassName("text-[14px]", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "14px" },
      ]);
    });
    it("text-(--my-size) → font-size: var(--my-size)", () => {
      expect(applyClassName("text-(--my-size)", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--my-size)" },
      ]);
    });
    it("text-red-500/75 → color: color-mix(in lab, red-500 75%, transparent)", () => {
      expect(applyClassName("text-red-500/75", ctx)).toEqual([
        {
          type: "at-rule",
          name: "supports",
          params: "(color:color-mix(in lab, red, red))",
          nodes: [
            {
              type: "decl",
              prop: "color",
              value: "color-mix(in lab, #f00 75%, transparent)",
            },
          ],
        },
        { type: "decl", prop: "color", value: "#f00" },
      ]);
    });

    // Font Weight
    it("font-thin → font-weight: var(--font-weight-thin)", () => {
      expect(applyClassName("font-thin", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--font-weight-thin)" },
      ]);
    });
    it("font-normal → font-weight: var(--font-weight-normal)", () => {
      expect(applyClassName("font-normal", ctx)).toEqual([
        {
          type: "decl",
          prop: "font-weight",
          value: "var(--font-weight-normal)",
        },
      ]);
    });
    it("font-medium → font-weight: var(--font-weight-medium)", () => {
      expect(applyClassName("font-medium", ctx)).toEqual([
        {
          type: "decl",
          prop: "font-weight",
          value: "var(--font-weight-medium)",
        },
      ]);
    });
    it("font-semibold → font-weight: var(--font-weight-semibold)", () => {
      expect(applyClassName("font-semibold", ctx)).toEqual([
        {
          type: "decl",
          prop: "font-weight",
          value: "var(--font-weight-semibold)",
        },
      ]);
    });
    it("font-bold → font-weight: var(--font-weight-bold)", () => {
      expect(applyClassName("font-bold", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--font-weight-bold)" },
      ]);
    });
    it("font-black → font-weight: var(--font-weight-black)", () => {
      expect(applyClassName("font-black", ctx)).toEqual([
        {
          type: "decl",
          prop: "font-weight",
          value: "var(--font-weight-black)",
        },
      ]);
    });
    it("font-[450] → font-weight: 450", () => {
      expect(applyClassName("font-[450]", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "450" },
      ]);
    });
    it("font-(--my-weight) → font-weight: var(--my-weight)", () => {
      expect(applyClassName("font-(--my-weight)", ctx)).toEqual([
        { type: "decl", prop: "font-weight", value: "var(--my-weight)" },
      ]);
    });

    // Font Style
    it("italic → font-style: italic", () => {
      expect(applyClassName("italic", ctx)).toEqual([
        { type: "decl", prop: "font-style", value: "italic" },
      ]);
    });
    it("not-italic → font-style: normal", () => {
      expect(applyClassName("not-italic", ctx)).toEqual([
        { type: "decl", prop: "font-style", value: "normal" },
      ]);
    });

    // Letter Spacing
    it("tracking-tighter → letter-spacing: var(--letter-spacing-tighter)", () => {
      expect(applyClassName("tracking-tighter", ctx)).toEqual([
        {
          type: "decl",
          prop: "letter-spacing",
          value: "var(--letter-spacing-tighter)",
        },
      ]);
    });
    it("tracking-tight → letter-spacing: var(--letter-spacing-tight)", () => {
      expect(applyClassName("tracking-tight", ctx)).toEqual([
        {
          type: "decl",
          prop: "letter-spacing",
          value: "var(--letter-spacing-tight)",
        },
      ]);
    });
    it("tracking-normal → letter-spacing: var(--letter-spacing-normal)", () => {
      expect(applyClassName("tracking-normal", ctx)).toEqual([
        {
          type: "decl",
          prop: "letter-spacing",
          value: "var(--letter-spacing-normal)",
        },
      ]);
    });
    it("tracking-wide → letter-spacing: var(--letter-spacing-wide)", () => {
      expect(applyClassName("tracking-wide", ctx)).toEqual([
        {
          type: "decl",
          prop: "letter-spacing",
          value: "var(--letter-spacing-wide)",
        },
      ]);
    });
    it("tracking-wider → letter-spacing: var(--letter-spacing-wider)", () => {
      expect(applyClassName("tracking-wider", ctx)).toEqual([
        {
          type: "decl",
          prop: "letter-spacing",
          value: "var(--letter-spacing-wider)",
        },
      ]);
    });
    it("tracking-widest → letter-spacing: var(--letter-spacing-widest)", () => {
      expect(applyClassName("tracking-widest", ctx)).toEqual([
        {
          type: "decl",
          prop: "letter-spacing",
          value: "var(--letter-spacing-widest)",
        },
      ]);
    });
    it("tracking-[0.25em] → letter-spacing: 0.25em", () => {
      expect(applyClassName("tracking-[0.25em]", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "0.25em" },
      ]);
    });
    it("tracking-(--my-spacing) → letter-spacing: var(--my-spacing)", () => {
      expect(applyClassName("tracking-(--my-spacing)", ctx)).toEqual([
        { type: "decl", prop: "letter-spacing", value: "var(--my-spacing)" },
      ]);
    });

    // Line Height
    it("leading-none → line-height: var(--line-height-none)", () => {
      expect(applyClassName("leading-none", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "var(--line-height-none)" },
      ]);
    });
    it("leading-tight → line-height: var(--line-height-tight)", () => {
      expect(applyClassName("leading-tight", ctx)).toEqual([
        {
          type: "decl",
          prop: "line-height",
          value: "var(--line-height-tight)",
        },
      ]);
    });
    it("leading-normal → line-height: var(--line-height-normal)", () => {
      expect(applyClassName("leading-normal", ctx)).toEqual([
        {
          type: "decl",
          prop: "line-height",
          value: "var(--line-height-normal)",
        },
      ]);
    });
    it("leading-relaxed → line-height: var(--line-height-relaxed)", () => {
      expect(applyClassName("leading-relaxed", ctx)).toEqual([
        {
          type: "decl",
          prop: "line-height",
          value: "var(--line-height-relaxed)",
        },
      ]);
    });
    it("leading-loose → line-height: var(--line-height-loose)", () => {
      expect(applyClassName("leading-loose", ctx)).toEqual([
        {
          type: "decl",
          prop: "line-height",
          value: "var(--line-height-loose)",
        },
      ]);
    });
    it("leading-[1.7] → line-height: 1.7", () => {
      expect(applyClassName("leading-[1.7]", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "1.7" },
      ]);
    });
    it("leading-(--my-leading) → line-height: var(--my-leading)", () => {
      expect(applyClassName("leading-(--my-leading)", ctx)).toEqual([
        { type: "decl", prop: "line-height", value: "var(--my-leading)" },
      ]);
    });

    // Text Align
    it("text-left → text-align: left", () => {
      expect(applyClassName("text-left", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "left" },
      ]);
    });
    it("text-center → text-align: center", () => {
      expect(applyClassName("text-center", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "center" },
      ]);
    });
    it("text-right → text-align: right", () => {
      expect(applyClassName("text-right", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "right" },
      ]);
    });
    it("text-justify → text-align: justify", () => {
      expect(applyClassName("text-justify", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "justify" },
      ]);
    });
    it("text-start → text-align: start", () => {
      expect(applyClassName("text-start", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "start" },
      ]);
    });
    it("text-end → text-align: end", () => {
      expect(applyClassName("text-end", ctx)).toEqual([
        { type: "decl", prop: "text-align", value: "end" },
      ]);
    });

    // Text Color
    it("text-inherit → color: inherit", () => {
      expect(applyClassName("text-inherit", ctx)).toEqual([
        { type: "decl", prop: "color", value: "inherit" },
      ]);
    });
    it("text-current → color: currentColor", () => {
      expect(applyClassName("text-current", ctx)).toEqual([
        { type: "decl", prop: "color", value: "currentColor" },
      ]);
    });
    it("text-transparent → color: transparent", () => {
      expect(applyClassName("text-transparent", ctx)).toEqual([
        { type: "decl", prop: "color", value: "transparent" },
      ]);
    });
    it("text-[#ff0000] → color: #ff0000", () => {
      expect(applyClassName("text-[#ff0000]", ctx)).toEqual([
        { type: "decl", prop: "color", value: "#ff0000" },
      ]);
    });
    it("text-(--my-font-size) → font-size: var(--my-font-size)", () => {
      expect(applyClassName("text-(--my-font-size)", ctx)).toEqual([
        { type: "decl", prop: "font-size", value: "var(--my-font-size)" },
      ]);
    });

    // Text Transform
    it("uppercase → text-transform: uppercase", () => {
      expect(applyClassName("uppercase", ctx)).toEqual([
        { type: "decl", prop: "text-transform", value: "uppercase" },
      ]);
    });
    it("lowercase → text-transform: lowercase", () => {
      expect(applyClassName("lowercase", ctx)).toEqual([
        { type: "decl", prop: "text-transform", value: "lowercase" },
      ]);
    });
    it("capitalize → text-transform: capitalize", () => {
      expect(applyClassName("capitalize", ctx)).toEqual([
        { type: "decl", prop: "text-transform", value: "capitalize" },
      ]);
    });
    it("normal-case → text-transform: none", () => {
      expect(applyClassName("normal-case", ctx)).toEqual([
        { type: "decl", prop: "text-transform", value: "none" },
      ]);
    });

    // Text Decoration
    it("underline → text-decoration-line: underline", () => {
      expect(applyClassName("underline", ctx)).toEqual([
        { type: "decl", prop: "text-decoration-line", value: "underline" },
      ]);
    });
    it("overline → text-decoration-line: overline", () => {
      expect(applyClassName("overline", ctx)).toEqual([
        { type: "decl", prop: "text-decoration-line", value: "overline" },
      ]);
    });
    it("line-through → text-decoration-line: line-through", () => {
      expect(applyClassName("line-through", ctx)).toEqual([
        { type: "decl", prop: "text-decoration-line", value: "line-through" },
      ]);
    });
    it("no-underline → text-decoration-line: none", () => {
      expect(applyClassName("no-underline", ctx)).toEqual([
        { type: "decl", prop: "text-decoration-line", value: "none" },
      ]);
    });

    it("decoration-red-500/75 → text-decoration-color: color-mix(in lab, red-500 75%, transparent)", () => {
      expect(applyClassName("decoration-red-500/75", ctx)).toEqual([
        {
          type: "at-rule",
          name: "supports",
          params: "(color:color-mix(in lab, red, red))",
          nodes: [{ type: "decl", prop: "text-decoration-color", value: "color-mix(in lab, #f00 75%, transparent)" }],
        },
        { type: "decl", prop: "text-decoration-color", value: "#f00" },
      ]);
    });

    // Text Overflow
    it("truncate → overflow + text-overflow + white-space", () => {
      expect(applyClassName("truncate", ctx)).toEqual([
        { type: "decl", prop: "overflow", value: "hidden" },
        { type: "decl", prop: "text-overflow", value: "ellipsis" },
        { type: "decl", prop: "white-space", value: "nowrap" },
      ]);
    });
    it("text-ellipsis → text-overflow: ellipsis", () => {
      expect(applyClassName("text-ellipsis", ctx)).toEqual([
        { type: "decl", prop: "text-overflow", value: "ellipsis" },
      ]);
    });
    it("text-clip → text-overflow: clip", () => {
      expect(applyClassName("text-clip", ctx)).toEqual([
        { type: "decl", prop: "text-overflow", value: "clip" },
      ]);
    });

    // Whitespace
    it("whitespace-normal → white-space: normal", () => {
      expect(applyClassName("whitespace-normal", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "normal" },
      ]);
    });
    it("whitespace-nowrap → white-space: nowrap", () => {
      expect(applyClassName("whitespace-nowrap", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "nowrap" },
      ]);
    });
    it("whitespace-pre → white-space: pre", () => {
      expect(applyClassName("whitespace-pre", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "pre" },
      ]);
    });
    it("whitespace-pre-line → white-space: pre-line", () => {
      expect(applyClassName("whitespace-pre-line", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "pre-line" },
      ]);
    });
    it("whitespace-pre-wrap → white-space: pre-wrap", () => {
      expect(applyClassName("whitespace-pre-wrap", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "pre-wrap" },
      ]);
    });
    it("whitespace-break-spaces → white-space: break-spaces", () => {
      expect(applyClassName("whitespace-break-spaces", ctx)).toEqual([
        { type: "decl", prop: "white-space", value: "break-spaces" },
      ]);
    });

    // Word Break
    it("break-normal → overflow-wrap + word-break", () => {
      expect(applyClassName("break-normal", ctx)).toEqual([
        { type: "decl", prop: "overflow-wrap", value: "normal" },
        { type: "decl", prop: "word-break", value: "normal" },
      ]);
    });
    it("break-words → overflow-wrap: break-word", () => {
      expect(applyClassName("break-words", ctx)).toEqual([
        { type: "decl", prop: "overflow-wrap", value: "break-word" },
      ]);
    });
    it("break-all → word-break: break-all", () => {
      expect(applyClassName("break-all", ctx)).toEqual([
        { type: "decl", prop: "word-break", value: "break-all" },
      ]);
    });
    it("break-keep → word-break: keep-all", () => {
      expect(applyClassName("break-keep", ctx)).toEqual([
        { type: "decl", prop: "word-break", value: "keep-all" },
      ]);
    });
  });
});
