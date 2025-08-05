import { describe, it, expect } from "vitest";
import { mergeAstTreeList, declPathToAst, DeclPath } from "../src/core/engine";

describe("mergeAstTreeList (AstNode[][] 병합)", () => {
  it("동일 variant chain decl 병합 (sibling decl)", () => {
    const declPaths: DeclPath[] = [
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "rule", selector: ":hover" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "rule", selector: "&:hover" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
    ];
    const astList = declPaths.map(declPathToAst);
    const ast = mergeAstTreeList(astList);
    expect(ast).toEqual([
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          {
            type: "rule", selector: "&:hover", nodes: [
              { type: "decl", prop: "color", value: "#f00" },
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
        ],
      },
    ]);
  });

  it("variant chain 다르면 별도 트리로 분리", () => {
    const declPaths: DeclPath[] = [
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "rule", selector: "&:hover" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "rule", selector: "&:focus" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
    ];
    const astList = declPaths.map(declPathToAst);
    const ast = mergeAstTreeList(astList);
    expect(ast).toEqual([
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          {
            type: "rule", selector: "&:hover", nodes: [
              { type: "decl", prop: "color", value: "#f00" },
            ],
          },
          {
            type: "rule", selector: "&:focus", nodes: [
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
        ],
      },
    ]);
  });

  it("variant chain이 완전히 다르면 sibling 트리로 분리", () => {
    const declPaths: DeclPath[] = [
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "rule", selector: "&:hover" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "at-rule", name: "supports", params: "(display: grid)" },
        { type: "rule", selector: "&:focus" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
    ];
    const astList = declPaths.map(declPathToAst);
    const ast = mergeAstTreeList(astList);
    expect(ast).toEqual([
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          {
            type: "rule", selector: "&:hover", nodes: [
              { type: "decl", prop: "color", value: "#f00" },
            ],
          },
        ],
      },
      {
        type: "at-rule", name: "supports", params: "(display: grid)", nodes: [
          {
            type: "rule", selector: "&:focus", nodes: [
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
        ],
      },
    ]);
  });

  it("decl만 여러 개 (variant 없음)", () => {
    const declPaths: DeclPath[] = [
      [ { type: "decl", prop: "color", value: "#111" } ],
      [ { type: "decl", prop: "background", value: "#222" } ],
    ];
    const astList = declPaths.map(declPathToAst);
    const ast = mergeAstTreeList(astList);
    expect(ast).toEqual([
      {
        type: "rule", selector: "&", nodes: [
          { type: "decl", prop: "color", value: "#111" },
          { type: "decl", prop: "background", value: "#222" },
        ],
      },
    ]);
  });
}); 