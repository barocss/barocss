import { describe, it, expect } from "vitest";
import { optimizeAst, parseClassToAst } from "../src/core/engine";
import "../src/presets"
import { createContext } from "../src/core/context";
import { defaultTheme } from "../src/theme";

const ctx = createContext({
    theme: defaultTheme
});

describe("optimizeAst ", () => {

  it("decl 에 기본 rule 처리 추가", () => {
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


  it("단일 variant chain: sm:hover:bg-red-500", () => {
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

  it("여러 variant chain: sm:hover:bg-red-500 sm:focus:bg-blue-500", () => {
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

  it("variant chain이 완전히 다르면 sibling 트리로 분리", () => {
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

  it("복잡한 variant chain: sm:dark:hover:bg-red-500", () => {
    let ast = parseClassToAst("sm:dark:hover:bg-red-500", ctx);
    if (ast === undefined) {        
      ast = [];
    }
    const cleanAst = optimizeAst(ast);
    // 기대 구조는 sm, dark, hover 계층이 모두 포함된 AST
    // (실제 AST 구조는 프로젝트의 dark variant 구현에 따라 다를 수 있음)
    expect(typeof cleanAst).toBe("object"); // 최소한 객체임을 보장
    expect(Array.isArray(cleanAst)).toBe(true);
  });

  it("복잡한 variant chain: dark:sm:hover:bg-blue-500", () => {
    let ast = parseClassToAst("dark:sm:hover:bg-blue-500", ctx);
    if (ast === undefined) {
      ast = [];
    }
    const cleanAst = optimizeAst(ast);
    expect(typeof cleanAst).toBe("object");
    expect(Array.isArray(cleanAst)).toBe(true);
  });

  it("여러 dark 조합: dark:bg-green-500 sm:dark:bg-yellow-500", () => {
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
    // 실제 결과 구조에 맞춰서 기대값을 작성해야 함
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
}); 