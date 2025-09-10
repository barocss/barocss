import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { ctx } from "./test-utils";

describe("negation variants", () => {
  describe("basic negation variants", () => {
    it("not-hover:bg-red-500 → &:not(:hover) { ... }", () => {
      expect(parseClassToAst("not-hover:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:not(:hover)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-[open]:bg-red-500 → &:not([open]) { ... }", () => {
      expect(parseClassToAst("not-[open]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:not([open])",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it('not-[aria-pressed=true]:bg-red-500 → &:not([aria-pressed="true"]) { ... }', () => {
      expect(parseClassToAst("not-[aria-pressed=true]:bg-red-500", ctx)).toMatchObject(
        [
          {
            type: "rule",
            selector: "&:not([aria-pressed=true])",
            nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
          },
        ]
      );
    });

    it("group-hover:not-hover:bg-red-500 → .group:hover &:not(:hover) { ... }", () => {
      expect(parseClassToAst("group-hover:not-hover:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:is(:where(.group):hover *)",
          nodes: [
            {
              type: "rule",
              selector: "&:not(:hover)",
              nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
            },
          ],
        },
      ]);
    });
  });

  describe("advanced negation variants", () => {
    it("not-focus:bg-red-500 → &:not(:focus)", () => {
      expect(parseClassToAst("not-focus:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:not(:focus)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-[dir=rtl]:bg-red-500 → &:not([dir=rtl])", () => {
      expect(parseClassToAst("not-[dir=rtl]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:not([dir=rtl])",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-[.foo]:bg-red-500 → &:not(.foo)", () => {
      expect(parseClassToAst("not-[.foo]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:not(.foo)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-[.foo>.bar]:bg-red-500 → &:not(.foo>.bar)", () => {
      expect(parseClassToAst("not-[.foo>.bar]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:not(.foo>.bar)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-hover:focus:bg-red-500 → &:not(:hover):focus", () => {
      expect(parseClassToAst("not-hover:focus:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:not(:hover)",
          nodes: [
            {
              type: "rule",
              selector: "&:focus",
              nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
            },
          ],
        },
      ]);
    });

    it("not-hover:not-focus:bg-red-500 → &:not(:hover):not(:focus)", () => {
      expect(parseClassToAst("not-hover:not-focus:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:not(:hover)",
          nodes: [
            {
              type: "rule",
              selector: "&:not(:focus)",
              nodes: [
                { type: "decl", prop: "background-color", value: "#f00" },
              ],
            },
          ],
        },
      ]);
    });
  });
});
