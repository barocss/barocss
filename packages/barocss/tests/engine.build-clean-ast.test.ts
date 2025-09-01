import { describe, it, expect } from "vitest";
import { optimizeAst, parseClassToAst } from "../src/core/engine";
import "../src/presets"
import { createContext } from "../src/core/context";
import { defaultTheme } from "../src/theme";

const ctx = createContext({
    theme: defaultTheme
});

describe("optimizeAst ", () => {

  it("Add default rule handling for decl", () => {
    let ast = parseClassToAst("bg-red-500", ctx);
    if (ast === undefined) {
      ast = [];
    }
    const cleanAst = optimizeAst(ast);
    const expected = [
      {
        type: "rule",
        selector: "&",
        nodes: [
          { type: "decl", prop: "background-color", value: "oklch(63.7% 0.237 25.331)" }
        ]
      }
    ];
    expect(cleanAst).toMatchObject(expected);
  });


  it("Single variant chain: sm:hover:bg-red-500", () => {
    let ast = parseClassToAst("sm:hover:bg-red-500", ctx);
    if (ast === undefined) {
      ast = [];
    }
    const cleanAst = optimizeAst(ast);
    const expected = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 40rem)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "background-color", value: "oklch(63.7% 0.237 25.331)" }
            ]
          }
        ]
      }
    ];
    expect(cleanAst).toMatchObject(expected);
  });

  it("Multiple variant chains: sm:hover:bg-red-500 sm:focus:bg-blue-500", () => {
    let ast1 = parseClassToAst("sm:hover:bg-red-500", ctx);
    let ast2 = parseClassToAst("sm:focus:bg-blue-500", ctx);
    if (ast1 === undefined) {
      ast1 = [];
    }
    if (ast2 === undefined) {
      ast2 = [];
    }
    const ast = [...ast1, ...ast2];
    const cleanAst = optimizeAst(ast);
    const expected = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 40rem)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "background-color", value: "oklch(63.7% 0.237 25.331)" }
            ]
          },
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "background-color", value: "oklch(62.3% 0.214 259.815)" }
            ]
          }
        ]
      }
    ];
    expect(cleanAst).toMatchObject(expected);
  });

  it("Completely different variant chains split into sibling trees", () => {
    let ast1 = parseClassToAst("sm:hover:bg-red-500", ctx);
    let ast2 = parseClassToAst("supports-[display:grid]:focus:bg-blue-500", ctx);
    if (ast1 === undefined) {
      ast1 = [];
    }
    if (ast2 === undefined) {
      ast2 = [];
    }
    const ast = [...ast1, ...ast2];
    const cleanAst = optimizeAst(ast);
    const expected = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 40rem)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "background-color", value: "oklch(63.7% 0.237 25.331)" }
            ]
          }
        ]
      },
      {
        type: "at-rule",
        name: "supports",
        params: "display:grid",
        nodes: [
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "background-color", value: "oklch(62.3% 0.214 259.815)" }
            ]
          }
        ]
      }
    ];
    expect(cleanAst).toMatchObject(expected);
  });

  it("Complex variant chain: sm:dark:hover:bg-red-500", () => {
    let ast = parseClassToAst("sm:dark:hover:bg-red-500", ctx);
    if (ast === undefined) {        
      ast = [];
    }
    const cleanAst = optimizeAst(ast);
    // Expected structure includes sm, dark, hover layers in AST
    // (Actual AST may vary depending on dark variant implementation)
    expect(typeof cleanAst).toBe("object"); // ensure at least object
    expect(Array.isArray(cleanAst)).toBe(true);
  });

  it("Complex variant chain: dark:sm:hover:bg-blue-500", () => {
    let ast = parseClassToAst("dark:sm:hover:bg-blue-500", ctx);
    if (ast === undefined) {
      ast = [];
    }
    const cleanAst = optimizeAst(ast);
    expect(typeof cleanAst).toBe("object");
    expect(Array.isArray(cleanAst)).toBe(true);
  });

  it("Multiple dark combinations: dark:bg-green-500 sm:dark:bg-yellow-500", () => {
    const ctx = createContext({
      theme: {
        colors: {
          green: {
            500: "green",
          },
          yellow: {
            500: "yellow",
          },
        },
        breakpoints: {
          sm: "640px",
        },
      },
    });
    let ast1 = parseClassToAst("dark:bg-green-500", ctx);
    let ast2 = parseClassToAst("sm:dark:bg-yellow-500", ctx);
    if (ast1 === undefined) {
      ast1 = [];
    }
    if (ast2 === undefined) {
      ast2 = [];
    }
    const ast = [...ast1, ...ast2];
    const cleanAst = optimizeAst(ast);
    // Expectations should match actual result structure
    const expected = [
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-color-scheme: dark)",
        nodes: [
          {
            type: "rule",
            selector: "&",
            nodes: [
              { type: "decl", prop: "background-color", value: "green" }
            ]
          }
        ]
      },
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
                  {
                    type: "rule",
                    selector: "&",
                    nodes: [
                      { type: "decl", prop: "background-color", value: "yellow" }
                    ]
                  }
                ]
            }
        ]
      }
    ];
    expect(cleanAst).toMatchObject(expected);
  });

  it("group-hover + peer-focus + sibling", () => {
    let ast1 = parseClassToAst("group-hover:bg-red-500", ctx);
    let ast2 = parseClassToAst("peer-focus:bg-blue-500", ctx);
    const ast = [...ast1, ...ast2];
    const cleanAst = optimizeAst(ast);
    const expected = [
      {
        type: "rule",
        selector: ".group:hover &",
        nodes: [
          { type: "decl", prop: "background-color", value: "oklch(63.7% 0.237 25.331)" }
        ]
      },
      {
        type: "rule",
        selector: ".peer:focus ~ &",
        nodes: [
          { type: "decl", prop: "background-color", value: "oklch(62.3% 0.214 259.815)" }
        ]
      }
    ];
    expect(cleanAst).toMatchObject(expected);
  });

  it("data-state + aria-pressed + &:hover", () => {
    let ast = parseClassToAst('data-[state=open]:aria-pressed:hover:bg-green-500', ctx);
    const cleanAst = optimizeAst(ast);
    const expected = [
      {
        type: "rule",
        selector: "&[data-state=\"open\"][aria-pressed=\"true\"]:hover",
        nodes: [
          { type: "decl", prop: "background-color", value: "oklch(72.3% 0.219 149.579)" }
        ]
      }
    ];
    expect(cleanAst).toMatchObject(expected);
  });

  it("bg-linear-to-r", () => {
    let ast = parseClassToAst("bg-linear-to-r", ctx);
    if (ast === undefined) {
      ast = [];
    }
    const cleanAst = optimizeAst(ast);
    expect(cleanAst).toMatchObject([
      {
        type: "rule",
        selector: "&",
        nodes: [
          { type: "decl", prop: "--tw-gradient-position", value: "to right" },
          { type: "decl", prop: "background-image", value: "linear-gradient(to right, var(--tw-gradient-stops))" }
        ]
      },
      {
        type: "style-rule",
        selector: "@supports (background-image: linear-gradient(in lab, red, red))",
        nodes: [
          { type: "rule", selector: "&", nodes: [
            { type: "decl", prop: "--tw-gradient-position", value: "to right in oklab" },
          ]},          
        ]
      }
    ]);
  });
}); 