import { describe, it, expect } from "vitest";
import "../../src/index"; // Ensure all utilities are registered
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

// --- New preset utility structure its ---
describe("preset spacing utilities", () => {
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

  describe("padding utilities", () => {
    it("p-4 → padding: calc(var(--spacing) * 4)", () => {
      expect(parseClassToAst("p-4", ctx)).toEqual([
        { type: "decl", prop: "padding", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("p-px → padding: 1px", () => {
      expect(parseClassToAst("p-px", ctx)).toEqual([
        { type: "decl", prop: "padding", value: "1px" },
      ]);
    });
    it("p-[5px] → padding: 5px", () => {
      expect(parseClassToAst("p-[5px]", ctx)).toEqual([
        { type: "decl", prop: "padding", value: "5px" },
      ]);
    });
    it("p-(--my-padding) → padding: var(--my-padding)", () => {
      expect(parseClassToAst("p-(--my-padding)", ctx)).toEqual([
        { type: "decl", prop: "padding", value: "var(--my-padding)" },
      ]);
    });

    it("px-2 → padding-inline: calc(var(--spacing) * 2)", () => {
      expect(parseClassToAst("px-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-inline",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("px-px → padding-inline: 1px", () => {
      expect(parseClassToAst("px-px", ctx)).toEqual([
        { type: "decl", prop: "padding-inline", value: "1px" },
      ]);
    });
    it("px-[10%] → padding-inline: 10%", () => {
      expect(parseClassToAst("px-[10%]", ctx)).toEqual([
        { type: "decl", prop: "padding-inline", value: "10%" },
      ]);
    });
    it("px-(--pad-x) → padding-inline: var(--pad-x)", () => {
      expect(parseClassToAst("px-(--pad-x)", ctx)).toEqual([
        { type: "decl", prop: "padding-inline", value: "var(--pad-x)" },
      ]);
    });

    it("py-3 → padding-block: calc(var(--spacing) * 3)", () => {
      expect(parseClassToAst("py-3", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-block",
          value: "calc(var(--spacing) * 3)",
        },
      ]);
    });
    it("py-px → padding-block: 1px", () => {
      expect(parseClassToAst("py-px", ctx)).toEqual([
        { type: "decl", prop: "padding-block", value: "1px" },
      ]);
    });
    it("py-[2em] → padding-block: 2em", () => {
      expect(parseClassToAst("py-[2em]", ctx)).toEqual([
        { type: "decl", prop: "padding-block", value: "2em" },
      ]);
    });
    it("py-(--pad-y) → padding-block: var(--pad-y)", () => {
      expect(parseClassToAst("py-(--pad-y)", ctx)).toEqual([
        { type: "decl", prop: "padding-block", value: "var(--pad-y)" },
      ]);
    });

    it("ps-1 → padding-inline-start: calc(var(--spacing) * 1)", () => {
      expect(parseClassToAst("ps-1", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-inline-start",
          value: "calc(var(--spacing) * 1)",
        },
      ]);
    });
    it("ps-px → padding-inline-start: 1px", () => {
      expect(parseClassToAst("ps-px", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-start", value: "1px" },
      ]);
    });
    it("ps-[3vw] → padding-inline-start: 3vw", () => {
      expect(parseClassToAst("ps-[3vw]", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-start", value: "3vw" },
      ]);
    });
    it("ps-(--pad-start) → padding-inline-start: var(--pad-start)", () => {
      expect(parseClassToAst("ps-(--pad-start)", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-inline-start",
          value: "var(--pad-start)",
        },
      ]);
    });

    it("pe-5 → padding-inline-end: calc(var(--spacing) * 5)", () => {
      expect(parseClassToAst("pe-5", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-inline-end",
          value: "calc(var(--spacing) * 5)",
        },
      ]);
    });
    it("pe-px → padding-inline-end: 1px", () => {
      expect(parseClassToAst("pe-px", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-end", value: "1px" },
      ]);
    });
    it("pe-[7rem] → padding-inline-end: 7rem", () => {
      expect(parseClassToAst("pe-[7rem]", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-end", value: "7rem" },
      ]);
    });
    it("pe-(--pad-end) → padding-inline-end: var(--pad-end)", () => {
      expect(parseClassToAst("pe-(--pad-end)", ctx)).toEqual([
        { type: "decl", prop: "padding-inline-end", value: "var(--pad-end)" },
      ]);
    });

    it("pt-6 → padding-top: calc(var(--spacing) * 6)", () => {
      expect(parseClassToAst("pt-6", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-top",
          value: "calc(var(--spacing) * 6)",
        },
      ]);
    });
    it("pt-px → padding-top: 1px", () => {
      expect(parseClassToAst("pt-px", ctx)).toEqual([
        { type: "decl", prop: "padding-top", value: "1px" },
      ]);
    });
    it("pt-[8px] → padding-top: 8px", () => {
      expect(parseClassToAst("pt-[8px]", ctx)).toEqual([
        { type: "decl", prop: "padding-top", value: "8px" },
      ]);
    });
    it("pt-(--pad-top) → padding-top: var(--pad-top)", () => {
      expect(parseClassToAst("pt-(--pad-top)", ctx)).toEqual([
        { type: "decl", prop: "padding-top", value: "var(--pad-top)" },
      ]);
    });

    it("pr-2 → padding-right: calc(var(--spacing) * 2)", () => {
      expect(parseClassToAst("pr-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-right",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("pr-px → padding-right: 1px", () => {
      expect(parseClassToAst("pr-px", ctx)).toEqual([
        { type: "decl", prop: "padding-right", value: "1px" },
      ]);
    });
    it("pr-[9px] → padding-right: 9px", () => {
      expect(parseClassToAst("pr-[9px]", ctx)).toEqual([
        { type: "decl", prop: "padding-right", value: "9px" },
      ]);
    });
    it("pr-(--pad-right) → padding-right: var(--pad-right)", () => {
      expect(parseClassToAst("pr-(--pad-right)", ctx)).toEqual([
        { type: "decl", prop: "padding-right", value: "var(--pad-right)" },
      ]);
    });

    it("pb-3 → padding-bottom: calc(var(--spacing) * 3)", () => {
      expect(parseClassToAst("pb-3", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-bottom",
          value: "calc(var(--spacing) * 3)",
        },
      ]);
    });
    it("pb-px → padding-bottom: 1px", () => {
      expect(parseClassToAst("pb-px", ctx)).toEqual([
        { type: "decl", prop: "padding-bottom", value: "1px" },
      ]);
    });
    it("pb-[11px] → padding-bottom: 11px", () => {
      expect(parseClassToAst("pb-[11px]", ctx)).toEqual([
        { type: "decl", prop: "padding-bottom", value: "11px" },
      ]);
    });
    it("pb-(--pad-bottom) → padding-bottom: var(--pad-bottom)", () => {
      expect(parseClassToAst("pb-(--pad-bottom)", ctx)).toEqual([
        { type: "decl", prop: "padding-bottom", value: "var(--pad-bottom)" },
      ]);
    });

    it("pl-4 → padding-left: calc(var(--spacing) * 4)", () => {
      expect(parseClassToAst("pl-4", ctx)).toEqual([
        {
          type: "decl",
          prop: "padding-left",
          value: "calc(var(--spacing) * 4)",
        },
      ]);
    });
    it("pl-px → padding-left: 1px", () => {
      expect(parseClassToAst("pl-px", ctx)).toEqual([
        { type: "decl", prop: "padding-left", value: "1px" },
      ]);
    });
    it("pl-[13px] → padding-left: 13px", () => {
      expect(parseClassToAst("pl-[13px]", ctx)).toEqual([
        { type: "decl", prop: "padding-left", value: "13px" },
      ]);
    });
    it("pl-(--pad-left) → padding-left: var(--pad-left)", () => {
      expect(parseClassToAst("pl-(--pad-left)", ctx)).toEqual([
        { type: "decl", prop: "padding-left", value: "var(--pad-left)" },
      ]);
    });
  });

  describe("margin utilities", () => {
    it("m-4 → margin: calc(var(--spacing) * 4)", () => {
      expect(parseClassToAst("m-4", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("-m-2 → margin: calc(var(--spacing) * -2)", () => {
      expect(parseClassToAst("-m-2", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "calc(var(--spacing) * -2)" },
      ]);
    });
    it("m-auto → margin: auto", () => {
      expect(parseClassToAst("m-auto", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "auto" },
      ]);
    });
    it("m-px → margin: 1px", () => {
      expect(parseClassToAst("m-px", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "1px" },
      ]);
    });
    it("-m-px → margin: -1px", () => {
      expect(parseClassToAst("-m-px", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "-1px" },
      ]);
    });
    it("m-[5vw] → margin: 5vw", () => {
      expect(parseClassToAst("m-[5vw]", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "5vw" },
      ]);
    });
    it("m-(--my-margin) → margin: var(--my-margin)", () => {
      expect(parseClassToAst("m-(--my-margin)", ctx)).toEqual([
        { type: "decl", prop: "margin", value: "var(--my-margin)" },
      ]);
    });
    it("mx-2 → margin-inline: calc(var(--spacing) * 2)", () => {
      expect(parseClassToAst("mx-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("-mx-2 → margin-inline: calc(var(--spacing) * -2)", () => {
      expect(parseClassToAst("-mx-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline",
          value: "calc(var(--spacing) * -2)",
        },
      ]);
    });
    it("mx-auto → margin-inline: auto", () => {
      expect(parseClassToAst("mx-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "auto" },
      ]);
    });
    it("mx-px → margin-inline: 1px", () => {
      expect(parseClassToAst("mx-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "1px" },
      ]);
    });
    it("-mx-px → margin-inline: -1px", () => {
      expect(parseClassToAst("-mx-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "-1px" },
      ]);
    });
    it("mx-[10%] → margin-inline: 10%", () => {
      expect(parseClassToAst("mx-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "10%" },
      ]);
    });
    it("mx-(--pad-x) → margin-inline: var(--pad-x)", () => {
      expect(parseClassToAst("mx-(--pad-x)", ctx)).toEqual([
        { type: "decl", prop: "margin-inline", value: "var(--pad-x)" },
      ]);
    });
    it("my-2 → margin-block: calc(var(--spacing) * 2)", () => {
      expect(parseClassToAst("my-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-block",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("-my-2 → margin-block: calc(var(--spacing) * -2)", () => {
      expect(parseClassToAst("-my-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-block",
          value: "calc(var(--spacing) * -2)",
        },
      ]);
    });
    it("my-auto → margin-block: auto", () => {
      expect(parseClassToAst("my-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "auto" },
      ]);
    });
    it("my-px → margin-block: 1px", () => {
      expect(parseClassToAst("my-px", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "1px" },
      ]);
    });
    it("-my-px → margin-block: -1px", () => {
      expect(parseClassToAst("-my-px", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "-1px" },
      ]);
    });
    it("my-[10%] → margin-block: 10%", () => {
      expect(parseClassToAst("my-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "10%" },
      ]);
    });
    it("my-(--pad-y) → margin-block: var(--pad-y)", () => {
      expect(parseClassToAst("my-(--pad-y)", ctx)).toEqual([
        { type: "decl", prop: "margin-block", value: "var(--pad-y)" },
      ]);
    });
    it("ms-1 → margin-inline-start: calc(var(--spacing) * 1)", () => {
      expect(parseClassToAst("ms-1", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-start",
          value: "calc(var(--spacing) * 1)",
        },
      ]);
    });
    it("-ms-1 → margin-inline-start: calc(var(--spacing) * -1)", () => {
      expect(parseClassToAst("-ms-1", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-start",
          value: "calc(var(--spacing) * -1)",
        },
      ]);
    });
    it("ms-auto → margin-inline-start: auto", () => {
      expect(parseClassToAst("ms-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-start", value: "auto" },
      ]);
    });
    it("ms-px → margin-inline-start: 1px", () => {
      expect(parseClassToAst("ms-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-start", value: "1px" },
      ]);
    });
    it("-ms-px → margin-inline-start: -1px", () => {
      expect(parseClassToAst("-ms-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-start", value: "-1px" },
      ]);
    });
    it("ms-[10%] → margin-inline-start: 10%", () => {
      expect(parseClassToAst("ms-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-start", value: "10%" },
      ]);
    });
    it("ms-(--pad-start) → margin-inline-start: var(--pad-start)", () => {
      expect(parseClassToAst("ms-(--pad-start)", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-start",
          value: "var(--pad-start)",
        },
      ]);
    });
    it("me-5 → margin-inline-end: calc(var(--spacing) * 5)", () => {
      expect(parseClassToAst("me-5", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-end",
          value: "calc(var(--spacing) * 5)",
        },
      ]);
    });
    it("-me-5 → margin-inline-end: calc(var(--spacing) * -5)", () => {
      expect(parseClassToAst("-me-5", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-inline-end",
          value: "calc(var(--spacing) * -5)",
        },
      ]);
    });
    it("me-auto → margin-inline-end: auto", () => {
      expect(parseClassToAst("me-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "auto" },
      ]);
    });
    it("me-px → margin-inline-end: 1px", () => {
      expect(parseClassToAst("me-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "1px" },
      ]);
    });
    it("-me-px → margin-inline-end: -1px", () => {
      expect(parseClassToAst("-me-px", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "-1px" },
      ]);
    });
    it("me-[10%] → margin-inline-end: 10%", () => {
      expect(parseClassToAst("me-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "10%" },
      ]);
    });
    it("me-(--pad-end) → margin-inline-end: var(--pad-end)", () => {
      expect(parseClassToAst("me-(--pad-end)", ctx)).toEqual([
        { type: "decl", prop: "margin-inline-end", value: "var(--pad-end)" },
      ]);
    });
    it("mt-6 → margin-top: calc(var(--spacing) * 6)", () => {
      expect(parseClassToAst("mt-6", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "calc(var(--spacing) * 6)" },
      ]);
    });
    it("-mt-6 → margin-top: calc(var(--spacing) * -6)", () => {
      expect(parseClassToAst("-mt-6", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-top",
          value: "calc(var(--spacing) * -6)",
        },
      ]);
    });
    it("mt-auto → margin-top: auto", () => {
      expect(parseClassToAst("mt-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "auto" },
      ]);
    });
    it("mt-px → margin-top: 1px", () => {
      expect(parseClassToAst("mt-px", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "1px" },
      ]);
    });
    it("-mt-px → margin-top: -1px", () => {
      expect(parseClassToAst("-mt-px", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "-1px" },
      ]);
    });
    it("mt-[10%] → margin-top: 10%", () => {
      expect(parseClassToAst("mt-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "10%" },
      ]);
    });
    it("mt-(--pad-top) → margin-top: var(--pad-top)", () => {
      expect(parseClassToAst("mt-(--pad-top)", ctx)).toEqual([
        { type: "decl", prop: "margin-top", value: "var(--pad-top)" },
      ]);
    });
    it("mr-2 → margin-right: calc(var(--spacing) * 2)", () => {
      expect(parseClassToAst("mr-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-right",
          value: "calc(var(--spacing) * 2)",
        },
      ]);
    });
    it("-mr-2 → margin-right: calc(var(--spacing) * -2)", () => {
      expect(parseClassToAst("-mr-2", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-right",
          value: "calc(var(--spacing) * -2)",
        },
      ]);
    });
    it("mr-auto → margin-right: auto", () => {
      expect(parseClassToAst("mr-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "auto" },
      ]);
    });
    it("mr-px → margin-right: 1px", () => {
      expect(parseClassToAst("mr-px", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "1px" },
      ]);
    });
    it("-mr-px → margin-right: -1px", () => {
      expect(parseClassToAst("-mr-px", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "-1px" },
      ]);
    });
    it("mr-[10%] → margin-right: 10%", () => {
      expect(parseClassToAst("mr-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "10%" },
      ]);
    });
    it("mr-(--pad-right) → margin-right: var(--pad-right)", () => {
      expect(parseClassToAst("mr-(--pad-right)", ctx)).toEqual([
        { type: "decl", prop: "margin-right", value: "var(--pad-right)" },
      ]);
    });
    it("mb-3 → margin-bottom: calc(var(--spacing) * 3)", () => {
      expect(parseClassToAst("mb-3", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-bottom",
          value: "calc(var(--spacing) * 3)",
        },
      ]);
    });
    it("-mb-3 → margin-bottom: calc(var(--spacing) * -3)", () => {
      expect(parseClassToAst("-mb-3", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-bottom",
          value: "calc(var(--spacing) * -3)",
        },
      ]);
    });
    it("mb-auto → margin-bottom: auto", () => {
      expect(parseClassToAst("mb-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "auto" },
      ]);
    });
    it("mb-px → margin-bottom: 1px", () => {
      expect(parseClassToAst("mb-px", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "1px" },
      ]);
    });
    it("-mb-px → margin-bottom: -1px", () => {
      expect(parseClassToAst("-mb-px", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "-1px" },
      ]);
    });
    it("mb-[10%] → margin-bottom: 10%", () => {
      expect(parseClassToAst("mb-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "10%" },
      ]);
    });
    it("mb-(--pad-bottom) → margin-bottom: var(--pad-bottom)", () => {
      expect(parseClassToAst("mb-(--pad-bottom)", ctx)).toEqual([
        { type: "decl", prop: "margin-bottom", value: "var(--pad-bottom)" },
      ]);
    });
    it("ml-4 → margin-left: calc(var(--spacing) * 4)", () => {
      expect(parseClassToAst("ml-4", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-left",
          value: "calc(var(--spacing) * 4)",
        },
      ]);
    });
    it("-ml-4 → margin-left: calc(var(--spacing) * -4)", () => {
      expect(parseClassToAst("-ml-4", ctx)).toEqual([
        {
          type: "decl",
          prop: "margin-left",
          value: "calc(var(--spacing) * -4)",
        },
      ]);
    });
    it("ml-auto → margin-left: auto", () => {
      expect(parseClassToAst("ml-auto", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "auto" },
      ]);
    });
    it("ml-px → margin-left: 1px", () => {
      expect(parseClassToAst("ml-px", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "1px" },
      ]);
    });
    it("-ml-px → margin-left: -1px", () => {
      expect(parseClassToAst("-ml-px", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "-1px" },
      ]);
    });
    it("ml-[10%] → margin-left: 10%", () => {
      expect(parseClassToAst("ml-[10%]", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "10%" },
      ]);
    });
    it("ml-(--pad-left) → margin-left: var(--pad-left)", () => {
      expect(parseClassToAst("ml-(--pad-left)", ctx)).toEqual([
        { type: "decl", prop: "margin-left", value: "var(--pad-left)" },
      ]);
    });
  });

  describe("space utilities", () => {
    it("space-x-4 → correct AST", () => {
      expect(parseClassToAst("space-x-4", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value:
                "calc(calc(var(--spacing) * 4) * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value:
                "calc(calc(var(--spacing) * 4) * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("-space-x-2 → correct AST", () => {
      expect(parseClassToAst("-space-x-2", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value:
                "calc(calc(var(--spacing) * -2) * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value:
                "calc(calc(var(--spacing) * -2) * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-x-px → correct AST", () => {
      expect(parseClassToAst("space-x-px", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value: "calc(1px * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value: "calc(1px * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("-space-x-px → correct AST", () => {
      expect(parseClassToAst("-space-x-px", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value: "calc(-1px * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value: "calc(-1px * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-x-reverse → correct AST", () => {
      expect(parseClassToAst("space-x-reverse", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [{ type: "decl", prop: "--tw-space-x-reverse", value: "1" }],
        },
      ]);
    });
    it("space-x-[5vw] → correct AST", () => {
      expect(parseClassToAst("space-x-[5vw]", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value: "calc(5vw * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value: "calc(5vw * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-x-(--gap-x) → correct AST", () => {
      expect(parseClassToAst("space-x-(--gap-x)", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-x-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-inline-start",
              value: "calc(var(--gap-x) * calc(1 - var(--tw-space-x-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-inline-end",
              value: "calc(var(--gap-x) * var(--tw-space-x-reverse))",
            },
          ],
        },
      ]);
    });
    // Repeat for space-y utilities
    it("space-y-3 → correct AST", () => {
      expect(parseClassToAst("space-y-3", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value:
                "calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value:
                "calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("-space-y-1 → correct AST", () => {
      expect(parseClassToAst("-space-y-1", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value:
                "calc(calc(var(--spacing) * -1) * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value:
                "calc(calc(var(--spacing) * -1) * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-y-px → correct AST", () => {
      expect(parseClassToAst("space-y-px", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value: "calc(1px * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value: "calc(1px * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("-space-y-px → correct AST", () => {
      expect(parseClassToAst("-space-y-px", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value: "calc(-1px * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value: "calc(-1px * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-y-reverse → correct AST", () => {
      expect(parseClassToAst("space-y-reverse", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            {
              type: "decl",
              prop: "--tw-space-y-reverse",
              value: "1",
            },
          ],
        },
      ]);
    });
    it("space-y-[2em] → correct AST", () => {
      expect(parseClassToAst("space-y-[2em]", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value: "calc(2em * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value: "calc(2em * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
    it("space-y-(--gap-y) → correct AST", () => {
      expect(parseClassToAst("space-y-(--gap-y)", ctx)).toMatchObject([
        {
          selector: "& > :not([hidden]) ~ :not([hidden])",
          type: "rule",
          nodes: [
            { type: "decl", prop: "--tw-space-y-reverse", value: "0" },
            {
              type: "decl",
              prop: "margin-block-start",
              value: "calc(var(--gap-y) * calc(1 - var(--tw-space-y-reverse)))",
            },
            {
              type: "decl",
              prop: "margin-block-end",
              value: "calc(var(--gap-y) * var(--tw-space-y-reverse))",
            },
          ],
        },
      ]);
    });
  });
});
