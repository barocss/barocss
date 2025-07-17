import { describe, it, expect } from "vitest";
import "../../src/index"; // Ensure all utilities are registered
import { applyClassName } from "../../src/core/engine";
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
      expect(applyClassName("rounded-none", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "0px" },
      ]);
      expect(applyClassName("rounded-sm", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-sm)",
        },
      ]);
      expect(applyClassName("rounded", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "var(--border-radius)" },
      ]);
      expect(applyClassName("rounded-md", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-md)",
        },
      ]);
      expect(applyClassName("rounded-lg", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-lg)",
        },
      ]);
      expect(applyClassName("rounded-xl", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-xl)",
        },
      ]);
      expect(applyClassName("rounded-2xl", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-2xl)",
        },
      ]);
      expect(applyClassName("rounded-3xl", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--border-radius-3xl)",
        },
      ]);
      expect(applyClassName("rounded-full", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "9999px" },
      ]);
    });

    it("rounded-* functional utilities", () => {
      expect(applyClassName("rounded-4", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-radius",
          value: "calc(var(--spacing) * 4)",
        },
      ]);
      expect(applyClassName("rounded-[12px]", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "12px" },
      ]);
      expect(applyClassName("rounded-(--my-radius)", ctx)).toEqual([
        { type: "decl", prop: "border-radius", value: "var(--my-radius)" },
      ]);
    });

    it("individual corner radius utilities", () => {
      expect(applyClassName("rounded-t-lg", ctx)).toEqual([
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
      expect(applyClassName("rounded-r-md", ctx)).toEqual([
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
      expect(applyClassName("rounded-tl-sm", ctx)).toEqual([
        {
          type: "decl",
          prop: "border-top-left-radius",
          value: "var(--border-radius-sm)",
        },
      ]);
      expect(applyClassName("rounded-br-full", ctx)).toEqual([
        { type: "decl", prop: "border-bottom-right-radius", value: "9999px" },
      ]);
    });

    it("individual corner radius functional utilities", () => {
      expect(applyClassName("rounded-t-4", ctx)).toEqual([
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
      expect(applyClassName("rounded-tl-[8px]", ctx)).toEqual([
        { type: "decl", prop: "border-top-left-radius", value: "8px" },
      ]);
      expect(applyClassName("rounded-br-(--corner-radius)", ctx)).toEqual([
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
      expect(applyClassName("border-0", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "0px" },
      ]);
      expect(applyClassName("border", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "1px" },
      ]);
      expect(applyClassName("border-2", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "2px" },
      ]);
      expect(applyClassName("border-4", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "4px" },
      ]);
      expect(applyClassName("border-8", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "8px" },
      ]);
    });

    it("border-* functional utilities", () => {
      expect(applyClassName("border-3", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "3px" },
      ]);
      expect(applyClassName("border-[5px]", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "5px" },
      ]);
      expect(applyClassName("border-(length:--my-width)", ctx)).toEqual([
        { type: "decl", prop: "border-width", value: "var(--my-width)" },
      ]);
    });

    it("individual side border width utilities", () => {
      expect(applyClassName("border-x-2", ctx)).toEqual([
        { type: "decl", prop: "border-left-width", value: "2px" },
        { type: "decl", prop: "border-right-width", value: "2px" },
      ]);
      expect(applyClassName("border-y-4", ctx)).toEqual([
        { type: "decl", prop: "border-top-width", value: "4px" },
        { type: "decl", prop: "border-bottom-width", value: "4px" },
      ]);
      expect(applyClassName("border-t", ctx)).toEqual([
        { type: "decl", prop: "border-top-width", value: "1px" },
      ]);
      expect(applyClassName("border-r-0", ctx)).toEqual([
        { type: "decl", prop: "border-right-width", value: "0px" },
      ]);
      expect(applyClassName("border-b-8", ctx)).toEqual([
        { type: "decl", prop: "border-bottom-width", value: "8px" },
      ]);
      expect(applyClassName("border-l-[3px]", ctx)).toEqual([
        { type: "decl", prop: "border-left-width", value: "3px" },
      ]);
    });
  });

  describe("border color utilities", () => {
    it("border-* static color utilities", () => {
      expect(applyClassName("border-inherit", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "inherit" },
      ]);
      expect(applyClassName("border-current", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "currentColor" },
      ]);
      expect(applyClassName("border-transparent", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "transparent" },
      ]);
    });

    it("border-* theme color utilities", () => {
      expect(applyClassName("border-red-500", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "#ef4444" },
      ]);
      expect(applyClassName("border-blue-500", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "#3b82f6" },
      ]);
      expect(applyClassName("border-red-500/50", ctx)).toEqual([
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
      expect(applyClassName("border-[#ff0000]", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "#ff0000" },
      ]);
      expect(applyClassName("border-[rgb(255,0,0)]", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "rgb(255,0,0)" },
      ]);
    });

    it("border-* custom property utilities", () => {
      expect(applyClassName("border-(--my-color)", ctx)).toEqual([
        { type: "decl", prop: "border-color", value: "var(--my-color)" },
      ]);
    });

    it("individual side border color utilities", () => {
      expect(applyClassName("border-x-red-500", ctx)).toEqual([
        { type: "decl", prop: "border-left-color", value: "#ef4444" },
        { type: "decl", prop: "border-right-color", value: "#ef4444" },
      ]);
      expect(applyClassName("border-y-blue-500", ctx)).toEqual([
        { type: "decl", prop: "border-top-color", value: "#3b82f6" },
        { type: "decl", prop: "border-bottom-color", value: "#3b82f6" },
      ]);
      expect(applyClassName("border-t-[#00ff00]", ctx)).toEqual([
        { type: "decl", prop: "border-top-color", value: "#00ff00" },
      ]);
      expect(applyClassName("border-r-(--right-color)", ctx)).toEqual([
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
      expect(applyClassName("border-solid", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "solid" },
      ]);
      expect(applyClassName("border-dashed", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "dashed" },
      ]);
      expect(applyClassName("border-dotted", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "dotted" },
      ]);
      expect(applyClassName("border-double", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "double" },
      ]);
      expect(applyClassName("border-hidden", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "hidden" },
      ]);
      expect(applyClassName("border-none", ctx)).toEqual([
        { type: "decl", prop: "border-style", value: "none" },
      ]);
    });
  });

  describe("outline width utilities", () => {
    it("outline-* static width utilities", () => {
      expect(applyClassName("outline-0", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "0px" },
      ]);
      expect(applyClassName("outline-1", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "1px" },
      ]);
      expect(applyClassName("outline-2", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "2px" },
      ]);
      expect(applyClassName("outline-4", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "4px" },
      ]);
      expect(applyClassName("outline-8", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "8px" },
      ]);
    });

    it("outline-* functional width utilities", () => {
      expect(applyClassName("outline-3", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "3px" },
      ]);
      expect(applyClassName("outline-[5px]", ctx)).toEqual([
        { type: "decl", prop: "outline-width", value: "5px" },
      ]);
      expect(
        applyClassName("outline-(length:--my-outline-width)", ctx)
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
      expect(applyClassName("outline-inherit", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "inherit" },
      ]);
      expect(applyClassName("outline-current", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "currentColor" },
      ]);
      expect(applyClassName("outline-transparent", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "transparent" },
      ]);
    });

    it("outline-* theme color utilities", () => {
      expect(applyClassName("outline-red-500", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "#ef4444" },
      ]);
      expect(applyClassName("outline-blue-500", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "#3b82f6" },
      ]);
    });

    it("outline-* arbitrary color utilities", () => {
      expect(applyClassName("outline-[#ff0000]", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "#ff0000" },
      ]);
      expect(applyClassName("outline-[hsl(120,100%,50%)]", ctx)).toEqual([
        { type: "decl", prop: "outline-color", value: "hsl(120,100%,50%)" },
      ]);
    });

    it("outline-* custom property utilities", () => {
      expect(applyClassName("outline-(--my-outline-color)", ctx)).toEqual([
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
      expect(applyClassName("outline-none", ctx)).toEqual([
        { type: "decl", prop: "outline", value: "2px solid transparent" },
        { type: "decl", prop: "outline-offset", value: "2px" },
      ]);
      expect(applyClassName("outline", ctx)).toEqual([
        { type: "decl", prop: "outline-style", value: "solid" },
      ]);
      expect(applyClassName("outline-dashed", ctx)).toEqual([
        { type: "decl", prop: "outline-style", value: "dashed" },
      ]);
      expect(applyClassName("outline-dotted", ctx)).toEqual([
        { type: "decl", prop: "outline-style", value: "dotted" },
      ]);
      expect(applyClassName("outline-double", ctx)).toEqual([
        { type: "decl", prop: "outline-style", value: "double" },
      ]);
    });
  });

  describe("outline offset utilities", () => {
    it("outline-offset-* static utilities", () => {
      expect(applyClassName("outline-offset-0", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "0px" },
      ]);
      expect(applyClassName("outline-offset-1", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "1px" },
      ]);
      expect(applyClassName("outline-offset-2", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "2px" },
      ]);
      expect(applyClassName("outline-offset-4", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "4px" },
      ]);
      expect(applyClassName("outline-offset-8", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "8px" },
      ]);
    });

    it("outline-offset-* functional utilities", () => {
      expect(applyClassName("outline-offset-3", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "3px" },
      ]);
      expect(applyClassName("outline-offset-[5px]", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "5px" },
      ]);
      expect(applyClassName("outline-offset-(--my-offset)", ctx)).toEqual([
        { type: "decl", prop: "outline-offset", value: "var(--my-offset)" },
      ]);
    });
  });
});
