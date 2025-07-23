import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { ctx } from "./test-utils";

describe("negation variants", () => {
  describe("basic negation variants", () => {
    it("not-hover:bg-red-500 → &:not(:hover) { ... }", () => {
      expect(applyClassName("not-hover:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector: "&:not(:hover)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-[open]:bg-red-500 → &:not([open]) { ... }", () => {
      expect(applyClassName("not-[open]:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector: "&:not([open])",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it('not-[aria-pressed=true]:bg-red-500 → &:not([aria-pressed="true"]) { ... }', () => {
      expect(applyClassName("not-[aria-pressed=true]:bg-red-500", ctx)).toEqual(
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
      expect(applyClassName("group-hover:not-hover:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector: ".group:hover &",
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
      expect(applyClassName("not-focus:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector: "&:not(:focus)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-[dir=rtl]:bg-red-500 → &:not([dir=rtl])", () => {
      expect(applyClassName("not-[dir=rtl]:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector: "&:not([dir=rtl])",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-[.foo]:bg-red-500 → &:not(.foo)", () => {
      expect(applyClassName("not-[.foo]:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector: "&:not(.foo)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-[.foo>.bar]:bg-red-500 → &:not(.foo>.bar)", () => {
      expect(applyClassName("not-[.foo>.bar]:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector: "&:not(.foo>.bar)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("not-hover:focus:bg-red-500 → &:not(:hover):focus", () => {
      expect(applyClassName("not-hover:focus:bg-red-500", ctx)).toEqual([
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
      expect(applyClassName("not-hover:not-focus:bg-red-500", ctx)).toEqual([
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
