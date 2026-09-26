import { describe, it, expect } from "vitest";
import "../../src/index"; // Ensure all utilities are registered
import { generateCss, parseClassToAst } from "../../src/core/engine";
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
      expect(parseClassToAst("rounded-none", ctx)).toMatchObject([
        { type: "decl", prop: "border-radius", value: "0px" },
      ]);
      expect(parseClassToAst("rounded-sm", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--radius-sm)",
        },
      ]);
      expect(parseClassToAst("rounded", ctx)).toMatchObject([
        { type: "decl", prop: "border-radius", value: "0.25rem" },
      ]);
      expect(parseClassToAst("rounded-md", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--radius-md)",
        },
      ]);
      expect(parseClassToAst("rounded-lg", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--radius-lg)",
        },
      ]);
      expect(parseClassToAst("rounded-xl", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--radius-xl)",
        },
      ]);
      expect(parseClassToAst("rounded-2xl", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--radius-2xl)",
        },
      ]);
      expect(parseClassToAst("rounded-3xl", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-radius",
          value: "var(--radius-3xl)",
        },
      ]);
      expect(parseClassToAst("rounded-full", ctx)).toMatchObject([
        { type: "decl", prop: "border-radius", value: "9999px" },
      ]);
    });

    it("rounded-* functional utilities", () => {
      expect(parseClassToAst("rounded-4", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-radius",
          value: "calc(var(--spacing) * 4)",
        },
      ]);
      expect(parseClassToAst("rounded-[12px]", ctx)).toMatchObject([
        { type: "decl", prop: "border-radius", value: "12px" },
      ]);
      expect(parseClassToAst("rounded-(--my-radius)", ctx)).toMatchObject([
        { type: "decl", prop: "border-radius", value: "var(--my-radius)" },
      ]);
    });

    it("individual corner radius utilities", () => {
      expect(parseClassToAst("rounded-t-lg", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-top-left-radius",
          value: "var(--radius-lg)",
        },
        {
          type: "decl",
          prop: "border-top-right-radius",
          value: "var(--radius-lg)",
        },
      ]);
      expect(parseClassToAst("rounded-r-md", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-top-right-radius",
          value: "var(--radius-md)",
        },
        {
          type: "decl",
          prop: "border-bottom-right-radius",
          value: "var(--radius-md)",
        },
      ]);
      expect(parseClassToAst("rounded-tl-sm", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-top-left-radius",
          value: "var(--radius-sm)",
        },
      ]);
      expect(parseClassToAst("rounded-br-full", ctx)).toMatchObject([
        { type: "decl", prop: "border-bottom-right-radius", value: "9999px" },
      ]);
    });

    it("individual corner radius functional utilities", () => {
      expect(parseClassToAst("rounded-t-4", ctx)).toMatchObject([
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
      expect(parseClassToAst("rounded-tl-[8px]", ctx)).toMatchObject([
        { type: "decl", prop: "border-top-left-radius", value: "8px" },
      ]);
      expect(parseClassToAst("rounded-br-(--corner-radius)", ctx)).toMatchObject([
        {
          type: "decl",
          prop: "border-bottom-right-radius",
          value: "var(--corner-radius)",
        },
      ]);
    });
  });

  // Declarations only; width utilities also carry an at-root @property --baro-border-style node.
  const decls = (cls: string) => parseClassToAst(cls, ctx).filter((n) => n.type === "decl");

  describe("border width utilities", () => {
    it("border-* static utilities", () => {
      expect(decls("border-0")).toMatchObject([
      { type: "decl", prop: "border-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-width", value: "0px" },
      ]);
      expect(decls("border")).toMatchObject([
      { type: "decl", prop: "border-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-width", value: "1px" },
      ]);
      expect(decls("border-2")).toMatchObject([
      { type: "decl", prop: "border-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-width", value: "2px" },
      ]);
      expect(decls("border-4")).toMatchObject([
      { type: "decl", prop: "border-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-width", value: "4px" },
      ]);
      expect(decls("border-8")).toMatchObject([
      { type: "decl", prop: "border-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-width", value: "8px" },
      ]);
    });

    it("border-* functional utilities", () => {
      expect(decls("border-3")).toMatchObject([
      { type: "decl", prop: "border-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-width", value: "3px" },
      ]);
      expect(decls("border-[5px]")).toMatchObject([
      { type: "decl", prop: "border-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-width", value: "5px" },
      ]);
      expect(decls("border-(length:--my-width)")).toMatchObject([
      { type: "decl", prop: "border-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-width", value: "var(--my-width)" },
      ]);
    });

    it("individual side border width utilities", () => {
      expect(decls("border-x-2")).toMatchObject([
      { type: "decl", prop: "border-left-style", value: "var(--baro-border-style)" },
      { type: "decl", prop: "border-right-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-left-width", value: "2px" },
        { type: "decl", prop: "border-right-width", value: "2px" },
      ]);
      expect(decls("border-y-4")).toMatchObject([
      { type: "decl", prop: "border-top-style", value: "var(--baro-border-style)" },
      { type: "decl", prop: "border-bottom-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-top-width", value: "4px" },
        { type: "decl", prop: "border-bottom-width", value: "4px" },
      ]);
      expect(decls("border-t")).toMatchObject([
      { type: "decl", prop: "border-top-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-top-width", value: "1px" },
      ]);
      expect(decls("border-r-0")).toMatchObject([
      { type: "decl", prop: "border-right-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-right-width", value: "0px" },
      ]);
      expect(decls("border-b-8")).toMatchObject([
      { type: "decl", prop: "border-bottom-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-bottom-width", value: "8px" },
      ]);
      expect(decls("border-l-[3px]")).toMatchObject([
      { type: "decl", prop: "border-left-style", value: "var(--baro-border-style)" },
        { type: "decl", prop: "border-left-width", value: "3px" },
      ]);
    });

    it("border width utilities register --baro-border-style with a solid initial value", () => {
      const css = generateCss("border-t", ctx);
      expect(css).toContain("@property --baro-border-style");
      expect(css).toContain("initial-value: solid");
      expect(css).toContain("border-top-style: var(--baro-border-style)");
    });
  });

  describe("border color utilities", () => {
    it("border-* static color utilities", () => {
      expect(parseClassToAst("border-inherit", ctx)).toMatchObject([
        { type: "decl", prop: "border-color", value: "inherit" },
      ]);
      expect(parseClassToAst("border-current", ctx)).toMatchObject([
        { type: "decl", prop: "border-color", value: "currentColor" },
      ]);
      expect(parseClassToAst("border-transparent", ctx)).toMatchObject([
        { type: "decl", prop: "border-color", value: "transparent" },
      ]);
    });

    it("border-* theme color utilities", () => {
      expect(parseClassToAst("border-red-500", ctx)).toMatchObject([
        { type: "decl", prop: "border-color", value: "var(--color-red-500)" },
      ]);
      expect(parseClassToAst("border-blue-500", ctx)).toMatchObject([
        { type: "decl", prop: "border-color", value: "var(--color-blue-500)" },
      ]);
      expect(parseClassToAst("border-red-500/50", ctx)).toMatchObject([
        { type: "decl", prop: "border-color", value: "color-mix(in srgb, #ef4444 50%, transparent)" },
        {
          type: "at-rule",
          name: "supports",
          params: "(color:color-mix(in lab, red, red))",
          nodes: [{ type: "decl", prop: "border-color", value: "color-mix(in oklab, var(--color-red-500) 50%, transparent)" }],
        },
      ]);
    });

    it("border-* arbitrary color utilities", () => {
      expect(parseClassToAst("border-[#ff0000]", ctx)).toMatchObject([
        { type: "decl", prop: "border-color", value: "#ff0000" },
      ]);
      expect(parseClassToAst("border-[rgb(255,0,0)]", ctx)).toMatchObject([
        { type: "decl", prop: "border-color", value: "rgb(255,0,0)" },
      ]);
    });

    it("border-* custom property utilities", () => {
      expect(parseClassToAst("border-(--my-color)", ctx)).toMatchObject([
        { type: "decl", prop: "border-color", value: "var(--my-color)" },
      ]);
    });

    it("individual side border color utilities", () => {
      expect(parseClassToAst("border-x-red-500", ctx)).toMatchObject([
        { type: "decl", prop: "border-left-color", value: "var(--color-red-500)" },
        { type: "decl", prop: "border-right-color", value: "var(--color-red-500)" },
      ]);
      expect(parseClassToAst("border-y-blue-500", ctx)).toMatchObject([
        { type: "decl", prop: "border-top-color", value: "var(--color-blue-500)" },
        { type: "decl", prop: "border-bottom-color", value: "var(--color-blue-500)" },
      ]);
      expect(parseClassToAst("border-t-[#00ff00]", ctx)).toMatchObject([
        { type: "decl", prop: "border-top-color", value: "#00ff00" },
      ]);
      expect(parseClassToAst("border-r-(--right-color)", ctx)).toMatchObject([
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
      expect(parseClassToAst("border-solid", ctx)).toMatchObject([
        { type: "decl", prop: "--baro-border-style", value: "solid" },
        { type: "decl", prop: "border-style", value: "solid" },
      ]);
      expect(parseClassToAst("border-dashed", ctx)).toMatchObject([
        { type: "decl", prop: "--baro-border-style", value: "dashed" },
        { type: "decl", prop: "border-style", value: "dashed" },
      ]);
      expect(parseClassToAst("border-dotted", ctx)).toMatchObject([
        { type: "decl", prop: "--baro-border-style", value: "dotted" },
        { type: "decl", prop: "border-style", value: "dotted" },
      ]);
      expect(parseClassToAst("border-double", ctx)).toMatchObject([
        { type: "decl", prop: "--baro-border-style", value: "double" },
        { type: "decl", prop: "border-style", value: "double" },
      ]);
      expect(parseClassToAst("border-hidden", ctx)).toMatchObject([
        { type: "decl", prop: "--baro-border-style", value: "hidden" },
        { type: "decl", prop: "border-style", value: "hidden" },
      ]);
      expect(parseClassToAst("border-none", ctx)).toMatchObject([
        { type: "decl", prop: "--baro-border-style", value: "none" },
        { type: "decl", prop: "border-style", value: "none" },
      ]);
    });
  });

  describe("outline width utilities", () => {
    it("outline-* static width utilities", () => {
      expect(decls("outline-0")).toEqual([
        { type: "decl", prop: "outline-style", value: "var(--baro-outline-style)" },
        { type: "decl", prop: "outline-width", value: "0px" },
      ]);
      expect(decls("outline-1")).toEqual([
        { type: "decl", prop: "outline-style", value: "var(--baro-outline-style)" },
        { type: "decl", prop: "outline-width", value: "1px" },
      ]);
      expect(decls("outline-2")).toEqual([
        { type: "decl", prop: "outline-style", value: "var(--baro-outline-style)" },
        { type: "decl", prop: "outline-width", value: "2px" },
      ]);
      expect(decls("outline-4")).toEqual([
        { type: "decl", prop: "outline-style", value: "var(--baro-outline-style)" },
        { type: "decl", prop: "outline-width", value: "4px" },
      ]);
      expect(decls("outline-8")).toEqual([
        { type: "decl", prop: "outline-style", value: "var(--baro-outline-style)" },
        { type: "decl", prop: "outline-width", value: "8px" },
      ]);
    });

    it("outline-* functional width utilities", () => {
      expect(decls("outline-3")).toEqual([
        { type: "decl", prop: "outline-style", value: "var(--baro-outline-style)" },
        { type: "decl", prop: "outline-width", value: "3px" },
      ]);
      expect(decls("outline-[5px]")).toEqual([
        { type: "decl", prop: "outline-style", value: "var(--baro-outline-style)" },
        { type: "decl", prop: "outline-width", value: "5px" },
      ]);
      expect(decls("outline-(length:--my-outline-width)")).toEqual([
        { type: "decl", prop: "outline-style", value: "var(--baro-outline-style)" },
        { type: "decl", prop: "outline-width", value: "var(--my-outline-width)" },
      ]);
    });

    it("outline width utilities register --baro-outline-style with a solid initial value", () => {
      const css = generateCss("outline-2", ctx);
      expect(css).toContain("@property --baro-outline-style");
      expect(css).toContain("initial-value: solid");
    });
  });

  describe("outline color utilities", () => {
    it("outline-* static color utilities", () => {
      expect(parseClassToAst("outline-inherit", ctx)).toMatchObject([
        { type: "decl", prop: "outline-color", value: "inherit" },
      ]);
      expect(parseClassToAst("outline-current", ctx)).toMatchObject([
        { type: "decl", prop: "outline-color", value: "currentColor" },
      ]);
      expect(parseClassToAst("outline-transparent", ctx)).toMatchObject([
        { type: "decl", prop: "outline-color", value: "transparent" },
      ]);
    });

    it("outline-* theme color utilities", () => {
      expect(parseClassToAst("outline-red-500", ctx)).toMatchObject([
        { type: "decl", prop: "outline-color", value: "var(--color-red-500)" },
      ]);
      expect(parseClassToAst("outline-blue-500", ctx)).toMatchObject([
        { type: "decl", prop: "outline-color", value: "var(--color-blue-500)" },
      ]);
    });

    it("outline-* arbitrary color utilities", () => {
      expect(parseClassToAst("outline-[#ff0000]", ctx)).toMatchObject([
        { type: "decl", prop: "outline-color", value: "#ff0000" },
      ]);
      expect(parseClassToAst("outline-[hsl(120,100%,50%)]", ctx)).toMatchObject([
        { type: "decl", prop: "outline-color", value: "hsl(120,100%,50%)" },
      ]);
    });

    it("outline-* custom property utilities", () => {
      expect(parseClassToAst("outline-(--my-outline-color)", ctx)).toMatchObject([
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
      expect(decls("outline")).toEqual([
        { type: "decl", prop: "outline-style", value: "var(--baro-outline-style)" },
        { type: "decl", prop: "outline-width", value: "1px" },
      ]);
      expect(decls("outline-none")).toEqual([
        { type: "decl", prop: "--baro-outline-style", value: "none" },
        { type: "decl", prop: "outline-style", value: "none" },
      ]);
      expect(decls("outline-solid")).toEqual([
        { type: "decl", prop: "--baro-outline-style", value: "solid" },
        { type: "decl", prop: "outline-style", value: "solid" },
      ]);
      expect(decls("outline-dashed")).toEqual([
        { type: "decl", prop: "--baro-outline-style", value: "dashed" },
        { type: "decl", prop: "outline-style", value: "dashed" },
      ]);
      expect(decls("outline-dotted")).toEqual([
        { type: "decl", prop: "--baro-outline-style", value: "dotted" },
        { type: "decl", prop: "outline-style", value: "dotted" },
      ]);
      expect(decls("outline-double")).toEqual([
        { type: "decl", prop: "--baro-outline-style", value: "double" },
        { type: "decl", prop: "outline-style", value: "double" },
      ]);
    });

    it("outline-hidden keeps a transparent outline in forced-colors mode", () => {
      const css = generateCss("outline-hidden", ctx);
      expect(css).toContain("outline-style: none");
      expect(css).toMatch(/@media \(forced-colors: active\)[^}]*outline: 2px solid transparent/);
    });
  });

  describe("outline offset utilities", () => {
    it("outline-offset-* static utilities", () => {
      expect(parseClassToAst("outline-offset-0", ctx)).toMatchObject([
        { type: "decl", prop: "outline-offset", value: "0px" },
      ]);
      expect(parseClassToAst("outline-offset-1", ctx)).toMatchObject([
        { type: "decl", prop: "outline-offset", value: "1px" },
      ]);
      expect(parseClassToAst("outline-offset-2", ctx)).toMatchObject([
        { type: "decl", prop: "outline-offset", value: "2px" },
      ]);
      expect(parseClassToAst("outline-offset-4", ctx)).toMatchObject([
        { type: "decl", prop: "outline-offset", value: "4px" },
      ]);
      expect(parseClassToAst("outline-offset-8", ctx)).toMatchObject([
        { type: "decl", prop: "outline-offset", value: "8px" },
      ]);
    });

    it("outline-offset-* functional utilities", () => {
      expect(parseClassToAst("outline-offset-3", ctx)).toMatchObject([
        { type: "decl", prop: "outline-offset", value: "3px" },
      ]);
      expect(parseClassToAst("outline-offset-[5px]", ctx)).toMatchObject([
        { type: "decl", prop: "outline-offset", value: "5px" },
      ]);
      expect(parseClassToAst("outline-offset-(--my-offset)", ctx)).toMatchObject([
        { type: "decl", prop: "outline-offset", value: "var(--my-offset)" },
      ]);
    });
  });
});
