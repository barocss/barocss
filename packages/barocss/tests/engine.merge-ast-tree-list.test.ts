import { describe, it, expect } from "vitest";
import { mergeAstTreeList, declPathToAst, DeclPath } from "../src/core/engine";

describe("mergeAstTreeList (merge AstNode[][])", () => {
  it("Merge same variant chain decl (sibling decl)", () => {
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
    expect(ast).toMatchObject([
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          {
            type: "rule", selector: ":hover &", nodes: [
              { type: "decl", prop: "color", value: "#f00" },
            ],
          },
          {
            type: "rule", selector: "&:hover", nodes: [
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
        ],
      },
    ]);
  });

  it("Different variant chains are split into separate trees", () => {
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
    expect(ast).toMatchObject([
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

  it("Completely different variant chains split into sibling trees", () => {
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
    expect(ast).toMatchObject([
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

  it("Multiple decl only (no variant)", () => {
    const declPaths: DeclPath[] = [
      [ { type: "decl", prop: "color", value: "#111" } ],
      [ { type: "decl", prop: "background", value: "#222" } ],
    ];
    const astList = declPaths.map(declPathToAst);
    const ast = mergeAstTreeList(astList);
    expect(ast).toMatchObject([
      {
        type: "rule", selector: "&", nodes: [
          { type: "decl", prop: "color", value: "#111" },
          { type: "decl", prop: "background", value: "#222" },
        ],
      },
    ]);
  });
}); 