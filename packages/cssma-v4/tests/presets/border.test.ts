import { describe, it, expect } from "vitest";
import "../../src/index"; // Ensure all utilities are registered
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

describe("border utilities", () => {
  const ctx = createContext({
    theme: {
      colors: {
        red: { 500: "#ef4444" },
        blue: { 500: "#3b82f6" },
        transparent: "transparent",
      },
    },
  });

  describe("border radius utilities", () => {
    it("rounded-* static utilities", () => {
      expect(parseClassToAst("rounded-none", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "0px" },
      ]);
      expect(parseClassToAst("rounded-sm", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-sm)",
        },
      ]);
      expect(parseClassToAst("rounded", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "var(--border-radius)" },
      ]);
      expect(parseClassToAst("rounded-md", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-md)",
        },
      ]);
      expect(parseClassToAst("rounded-lg", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-lg)",
        },
      ]);
      expect(parseClassToAst("rounded-xl", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-xl)",
        },
      ]);
      expect(parseClassToAst("rounded-2xl", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-2xl)",
        },
      ]);
      expect(parseClassToAst("rounded-3xl", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-3xl)",
        },
      ]);
      expect(parseClassToAst("rounded-full", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "9999px" },
      ]);
    });

    it("rounded-* functional utilities", () => {
      expect(parseClassToAst("rounded-4", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "calc(var(--spacing) * 4)",
        },
      ]);
      expect(parseClassToAst("rounded-[12px]", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "12px" },
      ]);
      expect(parseClassToAst("rounded-(--my-radius)", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "var(--my-radius)" },
      ]);
    });

    it("individual corner radius utilities", () => {
      expect(parseClassToAst("rounded-t-lg", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-top-left-radius",
          value: "var(--border-radius-lg)",
        },
        {
          type: "decl",
          prop: "border-top-right-radius",
          value: "var(--border-radius-lg)",
        },
      ]);
      expect(parseClassToAst("rounded-r-md", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-top-right-radius",
          value: "var(--border-radius-md)",
        },
        {
          type: "decl",
          prop: "border-bottom-right-radius",
          value: "var(--border-radius-md)",
        },
      ]);
      expect(parseClassToAst("rounded-tl-sm", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-top-left-radius",
          value: "var(--border-radius-sm)",
        },
      ]);
      expect(parseClassToAst("rounded-br-full", ctx)).toEqual([
        { type: "decl", prop: "border-bottom-right-radius", value: "9999px" },
      ]);
    });

    it("individual corner radius functional utilities", () => {
      expect(parseClassToAst("rounded-t-4", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-top-left-radius",
          value: "calc(var(--spacing) * 4)",
        },
        {
          type: "decl",
          prop: "border-top-right-radius",
          value: "calc(var(--spacing) * 4)",
        },
      ]);
      expect(parseClassToAst("rounded-tl-[8px]", ctx)).toEqual([
        { type: "decl", prop: "border-top-left-radius", value: "8px" },
      ]);
      expect(parseClassToAst("rounded-br-(--corner-radius)", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-bottom-right-radius",
          value: "var(--corner-radius)",
        },
      ]);
    });
  });

  describe("border width utilities", () => {
    it("border-* static utilities", () => {
      expect(parseClassToAst("border-0", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "0px" },
      ]);
      expect(parseClassToAst("border", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "1px" },
      ]);
      expect(parseClassToAst("border-2", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "2px" },
      ]);
      expect(parseClassToAst("border-4", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "4px" },
      ]);
      expect(parseClassToAst("border-8", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "8px" },
      ]);
    });

    it("border-* functional utilities", () => {
      expect(parseClassToAst("border-3", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "3px" },
      ]);
      expect(parseClassToAst("border-[5px]", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "5px" },
      ]);
      expect(parseClassToAst("border-(length:--my-width)", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "var(--my-width)" },
      ]);
    });

    it("individual side border width utilities", () => {
      expect(parseClassToAst("border-x-2", ctx)).toEqual([
        { type: "decl", prop: "border-left-width", value: "2px" },
        { type: "decl", prop: "border-right-width", value: "2px" },
      ]);
      expect(parseClassToAst("border-y-4", ctx)).toEqual([
        { type: "decl", prop: "border-top-width", value: "4px" },
        { type: "decl", prop: "border-bottom-width", value: "4px" },
      ]);
      expect(parseClassToAst("border-t", ctx)).toEqual([
        { type: "decl", prop: "border-top-width", value: "1px" },
      ]);
      expect(parseClassToAst("border-r-0", ctx)).toEqual([
        { type: "decl", prop: "border-right-width", value: "0px" },
      ]);
      expect(parseClassToAst("border-b-8", ctx)).toEqual([
        { type: "decl", prop: "border-bottom-width", value: "8px" },
      ]);
      expect(parseClassToAst("border-l-[3px]", ctx)).toEqual([
        { type: "decl", prop: "border-left-width", value: "3px" },
      ]);
    });
  });

  describe("border color utilities", () => {
    it("border-* static color utilities", () => {
      expect(parseClassToAst("border-inherit", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "inherit" },
      ]);
      expect(parseClassToAst("border-current", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "currentColor" },
      ]);
      expect(parseClassToAst("border-transparent", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "transparent" },
      ]);
    });

    it("border-* theme color utilities", () => {
      expect(parseClassToAst("border-red-500", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "#ef4444" },
      ]);
      expect(parseClassToAst("border-blue-500", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "#3b82f6" },
      ]);
      expect(parseClassToAst("border-red-500/50", ctx)).toEqual([
        {
          type: "at-rule",
          name: "supports",
          params: "(color:color-mix(in lab, red, red))",
          nodes: [
            {
              type: "decl",
              prop: "border-color",
              value: "color-mix(in lab, #ef4444 50%, transparent)",
            },
          ],
        },
        { type: "decl", prop: "border-color", value: "#ef4444" },
      ]);
    });

    it("border-* arbitrary color utilities", () => {
      expect(parseClassToAst("border-[#ff0000]", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "#ff0000" },
      ]);
      expect(parseClassToAst("border-[rgb(255,0,0)]", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "rgb(255,0,0)" },
      ]);
    });

    it("border-* custom property utilities", () => {
      expect(parseClassToAst("border-(--my-color)", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "var(--my-color)" },
      ]);
    });

    it("individual side border color utilities", () => {
      expect(parseClassToAst("border-x-red-500", ctx)).toEqual([
        { type: "decl", prop: "border-left-color", value: "#ef4444" },
        { type: "decl", prop: "border-right-color", value: "#ef4444" },
      ]);
      expect(parseClassToAst("border-y-blue-500", ctx)).toEqual([
        { type: "decl", prop: "border-top-color", value: "#3b82f6" },
        { type: "decl", prop: "border-bottom-color", value: "#3b82f6" },
      ]);
      expect(parseClassToAst("border-t-[#00ff00]", ctx)).toEqual([
        { type: "decl", prop: "border-top-color", value: "#00ff00" },
      ]);
      expect(parseClassToAst("border-r-(--right-color)", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-right-color",
          value: "var(--right-color)",
        },
      ]);
    });
  });

  describe("border style utilities", () => {
    it("border-* style utilities", () => {
      expect(parseClassToAst("border-solid", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "solid" },
      ]);
      expect(parseClassToAst("border-dashed", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "dashed" },
      ]);
      expect(parseClassToAst("border-dotted", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "dotted" },
      ]);
      expect(parseClassToAst("border-double", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "double" },
      ]);
      expect(parseClassToAst("border-hidden", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "hidden" },
      ]);
      expect(parseClassToAst("border-none", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "none" },
      ]);
    });
  });

  describe("outline width utilities", () => {
    it("outline-* static width utilities", () => {
      expect(parseClassToAst("outline-0", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "0px" },
      ]);
      expect(parseClassToAst("outline-1", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "1px" },
      ]);
      expect(parseClassToAst("outline-2", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "2px" },
      ]);
      expect(parseClassToAst("outline-4", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "4px" },
      ]);
      expect(parseClassToAst("outline-8", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "8px" },
      ]);
    });

    it("outline-* functional width utilities", () => {
      expect(parseClassToAst("outline-3", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "3px" },
      ]);
      expect(parseClassToAst("outline-[5px]", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "5px" },
      ]);
      expect(
        parseClassToAst("outline-(length:--my-outline-width)", ctx)
      ).toEqual([
        {
          type: "decl",
          prop: "outline-width",
          value: "var(--my-outline-width)",
        },
      ]);
    });
  });

  describe("outline color utilities", () => {
    it("outline-* static color utilities", () => {
      expect(parseClassToAst("outline-inherit", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "inherit" },
      ]);
      expect(parseClassToAst("outline-current", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "currentColor" },
      ]);
      expect(parseClassToAst("outline-transparent", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "transparent" },
      ]);
    });

    it("outline-* theme color utilities", () => {
      expect(parseClassToAst("outline-red-500", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "#ef4444" },
      ]);
      expect(parseClassToAst("outline-blue-500", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "#3b82f6" },
      ]);
    });

    it("outline-* arbitrary color utilities", () => {
      expect(parseClassToAst("outline-[#ff0000]", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "#ff0000" },
      ]);
      expect(parseClassToAst("outline-[hsl(120,100%,50%)]", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "hsl(120,100%,50%)" },
      ]);
    });

    it("outline-* custom property utilities", () => {
      expect(parseClassToAst("outline-(--my-outline-color)", ctx)).toEqual([
        {
          type: "decl",
          prop: "outline-color",
          value: "var(--my-outline-color)",
        },
      ]);
    });
  });

  describe("outline style utilities", () => {
    it("outline-* style utilities", () => {
      expect(parseClassToAst("outline-none", ctx)).toEqual([
        { type: "decl", prop: "outline", value: "2px solid transparent" },
        { type: "decl", prop: "outline-offset", value: "2px" },
      ]);
      expect(parseClassToAst("outline", ctx)).toEqual([
        { type: "decl", prop: "outline-style", value: "solid" },
      ]);
      expect(parseClassToAst("outline-dashed", ctx)).toEqual([
        { type: "decl", prop: "outline-style", value: "dashed" },
      ]);
      expect(parseClassToAst("outline-dotted", ctx)).toEqual([
        { type: "decl", prop: "outline-style", value: "dotted" },
      ]);
      expect(parseClassToAst("outline-double", ctx)).toEqual([
        { type: "decl", prop: "outline-style", value: "double" },
      ]);
    });
  });

  describe("outline offset utilities", () => {
    it("outline-offset-* static utilities", () => {
      expect(parseClassToAst("outline-offset-0", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "0px" },
      ]);
      expect(parseClassToAst("outline-offset-1", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "1px" },
      ]);
      expect(parseClassToAst("outline-offset-2", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "2px" },
      ]);
      expect(parseClassToAst("outline-offset-4", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "4px" },
      ]);
      expect(parseClassToAst("outline-offset-8", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "8px" },
      ]);
    });

    it("outline-offset-* functional utilities", () => {
      expect(parseClassToAst("outline-offset-3", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "3px" },
      ]);
      expect(parseClassToAst("outline-offset-[5px]", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "5px" },
      ]);
      expect(parseClassToAst("outline-offset-(--my-offset)", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "var(--my-offset)" },
      ]);
    });
  });
});
