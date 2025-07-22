import { describe, it, expect } from "vitest";
import { buildCleanAst, applyClassName } from "../src/core/engine";
import "../src/presets"
import { createContext } from "../src/core/context";
import { defaultTheme } from "../src/theme";

const ctx = createContext({
    theme: defaultTheme
});

console.log('applyClassName:', applyClassName);
console.log('ctx:', ctx);

describe("buildCleanAst (applyClassName → clean AST)", () => {
  it.only("단일 variant chain: sm:hover:bg-red-500", () => {
    let ast = applyClassName("sm:hover:bg-red-500", ctx);
    if (ast === undefined) {
      console.log('ast is undefined!');
      ast = [];
    }
    console.log('ast:', JSON.stringify(ast, null, 2));
    const cleanAst = buildCleanAst(ast);
    console.log('cleanAst:', cleanAst);
    expect(Array.isArray(cleanAst)).toBe(true);
  });

  it("여러 variant chain: sm:hover:bg-red-500 sm:focus:bg-blue-500", () => {
    let ast1 = applyClassName("sm:hover:bg-red-500", ctx);
    let ast2 = applyClassName("sm:focus:bg-blue-500", ctx);
    if (ast1 === undefined) {
      console.log('ast1 is undefined!');
      ast1 = [];
    }
    if (ast2 === undefined) {
      console.log('ast2 is undefined!');
      ast2 = [];
    }
    console.log('ast1:', ast1);
    console.log('ast2:', ast2);
    const ast = [...ast1, ...ast2];
    const cleanAst = buildCleanAst(ast);
    console.log('cleanAst:', cleanAst);
    expect(Array.isArray(cleanAst)).toBe(true);
  });

  it("variant chain이 완전히 다르면 sibling 트리로 분리", () => {
    let ast1 = applyClassName("sm:hover:bg-red-500", ctx);
    let ast2 = applyClassName("supports-[display:grid]:focus:bg-blue-500", ctx);
    if (ast1 === undefined) {
      console.log('ast1 is undefined!');
      ast1 = [];
    }
    if (ast2 === undefined) {
      console.log('ast2 is undefined!');
      ast2 = [];
    }
    console.log('ast1:', ast1);
    console.log('ast2:', ast2);
    const ast = [...ast1, ...ast2];
    const cleanAst = buildCleanAst(ast);
    console.log('cleanAst:', cleanAst);
    expect(Array.isArray(cleanAst)).toBe(true);
  });
}); 