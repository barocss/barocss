import { parseWithoutHoverMedia } from '../hover-media-test-utils';
import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";
import { ctx } from "./test-utils";

describe("arbitrary variants", () => {
  describe("basic arbitrary variants", () => {
    it("[&>*]:bg-red-500 → &>* { ... }", () => {
      expect(parseClassToAst("[&>*]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&>*",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it('aria-[pressed=true]:bg-red-500 → [aria-pressed="true"] & { ... }', () => {
      expect(parseClassToAst("aria-[pressed=true]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: '&[aria-pressed="true"]',
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it('data-[state=open]:bg-red-500 → &[data-state="open"] { ... }', () => {
      expect(parseClassToAst("data-[state=open]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: '&[data-state="open"]',
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it("is-[.foo]:bg-red-500 → &:is(.foo) { ... }", () => {
      expect(parseClassToAst("is-[.foo]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:is(.foo)",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it("where-[.bar]:bg-red-500 → &:where(.bar) { ... }", () => {
      expect(parseClassToAst("where-[.bar]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:where(.bar)",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });
  });

  describe("complex arbitrary variants", () => {
    it("[&:hover]:bg-red-500 → &:hover { ... }", () => {
      expect(parseClassToAst("[&:hover]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:hover",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
        },
      ]);
    });

    it("[.foo>.bar]:bg-blue-500 → .foo>.bar { ... }", () => {
      const ctx2 = createContext({
        theme: { colors: { blue: { 500: "#00f" } } },
      });
      expect(parseClassToAst("[.foo>.bar]:bg-blue-500", ctx2)).toMatchObject([
        {
          type: "rule",
          selector: "&:is(.foo>.bar)",
          nodes: [{ type: "decl", prop: "background-color", value: "var(--color-blue-500)" }],
        },
      ]);
    });

    it("group-hover:[&>*]:bg-red-500 → .group:hover &>* { ... }", () => {
      expect(parseWithoutHoverMedia("group-hover:[&>*]:bg-red-500", ctx)).toMatchObject([
        {
          type: "rule",
          selector: "&:is(:where(.group):hover *)",
          nodes: [
            {
              type: "rule",
              selector: "&>*",
              nodes: [{ type: "decl", prop: "background-color", value: "var(--color-red-500)" }],
            },
          ],
        },
      ]);
    });

    it("dark:[.foo]:hover:bg-blue-500 → .dark .foo:hover { ... }", () => {
      const ctx2 = createContext({
        darkMode: "class",
        theme: { colors: { blue: { 500: "#00f" } } },
      });
      expect(parseWithoutHoverMedia("dark:[.foo]:hover:bg-blue-500", ctx2)).toMatchObject([
        {
          type: "rule",
          selector: ".dark",
          nodes: [
            {
              type: "rule",
              selector: "&:is(.foo)",
              nodes: [
                {
                  type: "rule",
                  selector: "&:hover",
                  nodes: [
                    { type: "decl", prop: "background-color", value: "var(--color-blue-500)" },
                  ],
                },
              ],
            },
          ],
        },
      ]);
    });
  });
});
