import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { ctx } from "./test-utils";

describe("pseudo-elements", () => {
  describe("cross-browser pseudo-element variants", () => {
    it("placeholder:bg-red-500 → ::placeholder only (#335, as Tailwind 4.3.3)", () => {
      const result = parseClassToAst("placeholder:bg-red-500", ctx);
      expect(result).toMatchObject([
        {
          type: "rule",
          selector: "&::placeholder",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it("selection:bg-red-500 → 2 selectors (#335: descendant + self, as Tailwind 4.3.3)", () => {
      const result = parseClassToAst("selection:bg-red-500", ctx);
      expect(result).toMatchObject([
        {
          type: "rule",
          selector: "& *::selection",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
        {
          type: "rule",
          selector: "&::selection",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it("file:bg-red-500 → ::file-selector-button only (#335)", () => {
      const result = parseClassToAst("file:bg-red-500", ctx);
      expect(result).toMatchObject([
        {
          type: "rule",
          selector: "&::file-selector-button",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });
  });

  describe("basic pseudo-elements", () => {
    it("before:bg-red-500 → &::before { ... }", () => {
      expect(parseClassToAst("before:bg-red-500", ctx)).toMatchObject([
        { type: "at-root", nodes: [{ type: "at-rule", name: "property", params: "--baro-content" }] },
        {
          type: "rule",
          selector: "&::before",
          nodes: [
            { type: "decl", prop: "background-color", value: "var(--color-red-500)" },
            { type: "decl", prop: "content", value: "var(--baro-content)" },
          ],
        },
      ]);
    });

    it("after:bg-red-500 → &::after { ... }", () => {
      expect(parseClassToAst("after:bg-red-500", ctx)).toMatchObject([
        { type: "at-root", nodes: [{ type: "at-rule", name: "property", params: "--baro-content" }] },
        {
          type: "rule",
          selector: "&::after",
          nodes: [
            { type: "decl", prop: "background-color", value: "var(--color-red-500)" },
            { type: "decl", prop: "content", value: "var(--baro-content)" },
          ],
        },
      ]);
    });

    it("first-line:bg-red-500 → &::first-line { ... }", () => {
      expect(parseClassToAst("first-line:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&::first-line",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it("first-letter:bg-red-500 → &::first-letter { ... }", () => {
      expect(parseClassToAst("first-letter:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&::first-letter",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it("backdrop:bg-red-500 → &::backdrop { ... }", () => {
      expect(parseClassToAst("backdrop:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&::backdrop",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it("details-content:bg-red-500 → &::details-content { ... }", () => {
      expect(parseClassToAst("details-content:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&::details-content",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });
  });
});
