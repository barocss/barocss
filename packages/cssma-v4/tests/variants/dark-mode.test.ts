import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";
import { ctx } from "./test-utils";

describe("dark mode", () => {
  describe("dark mode config", () => {
    it("darkMode: media (default)", () => {
      const ctx = createContext({
        darkMode: "media",
        theme: { colors: { red: { 500: "#f00" } } },
      });
      expect(parseClassToAst("dark:bg-red-500", ctx)).toEqual([
        {
          type: "at-rule",
          name: "media",
          params: "(prefers-color-scheme: dark)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("darkMode: class", () => {
      const ctx = createContext({
        darkMode: "class",
        theme: { colors: { red: { 500: "#f00" } } },
      });
      expect(parseClassToAst("dark:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector: ".dark",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("darkMode: custom selector", () => {
      const ctx = createContext({
        darkMode: "class",
        darkModeSelector: [
          ":where([data-theme=dark], [data-theme=dark] *)",
          ":where(.dark, .dark *)",
        ],
        theme: { colors: { red: { 500: "#f00" } } },
      });
      expect(parseClassToAst("dark:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector:
            ":where([data-theme=dark], [data-theme=dark] *), :where(.dark, .dark *)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("darkMode: [class, custom]", () => {
      const ctx = createContext({
        darkMode: "class",
        darkModeSelector: [
          ":where([data-theme=dark], [data-theme=dark] *)",
          ":where(.dark, .dark *)",
        ],
        theme: { colors: { red: { 500: "#f00" } } },
      });
      expect(parseClassToAst("dark:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector:
            ":where([data-theme=dark], [data-theme=dark] *), :where(.dark, .dark *)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });

    it("darkMode: [media, class]", () => {
      const ctx = createContext({
        darkMode: "media",
        darkModeSelector: [".dark"],
        theme: { colors: { red: { 500: "#f00" } } },
      });
      expect(parseClassToAst("dark:bg-red-500", ctx)).toEqual([
        {
          type: "at-rule",
          name: "media",
          params: "(prefers-color-scheme: dark)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
        {
          type: "rule",
          selector: ".dark",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });
  });

  describe("dark mode advanced scenarios", () => {
    it("dark:sm:bg-red-500 with darkMode: class", () => {
      const ctx = createContext({
        darkMode: "class",
        theme: {
          colors: { red: { 500: "#f00" } },
          breakpoints: { sm: "(min-width: 640px)" },
        },
      });
      expect(parseClassToAst("dark:sm:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector: ".dark",
          nodes: [
            {
              type: "at-rule",
              name: "media",
              params: "(min-width: 640px)",
              nodes: [
                { type: "decl", prop: "background-color", value: "#f00" },
              ],
            },
          ],
        },
      ]);
    });

    it("sm:dark:bg-red-500 with darkMode: media", () => {
      const ctx = createContext({
        darkMode: "media",
        theme: {
          colors: { red: { 500: "#f00" } },
          breakpoints: { sm: "(min-width: 640px)" },
        },
      });
      expect(parseClassToAst("sm:dark:bg-red-500", ctx)).toEqual([
        {
          type: "at-rule",
          name: "media",
          params: "(min-width: 640px)",
          nodes: [
            {
              type: "at-rule",
              name: "media",
              params: "(prefers-color-scheme: dark)",
              nodes: [
                { type: "decl", prop: "background-color", value: "#f00" },
              ],
            },
          ],
        },
      ]);
    });
  });

  describe("dark mode", () => {
    it('dark:bg-red-500 with darkModeSelector: [":where([data-theme=dark], [data-theme=dark] *)", ":where(.dark, .dark *)"]', () => {
      const ctx = createContext({
        darkMode: "class",
        darkModeSelector: [
          ":where([data-theme=dark], [data-theme=dark] *)",
          ":where(.dark, .dark *)",
        ],
        theme: { colors: { red: { 500: "#f00" } } },
      });
      expect(parseClassToAst("dark:bg-red-500", ctx)).toEqual([
        {
          type: "rule",
          selector:
            ":where([data-theme=dark], [data-theme=dark] *), :where(.dark, .dark *)",
          nodes: [{ type: "decl", prop: "background-color", value: "#f00" }],
        },
      ]);
    });
  });
});
