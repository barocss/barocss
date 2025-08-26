import { describe, it, expect } from "vitest";
import { DeclPath, declPathToAst } from "../src/core/engine";

describe("declPathToAst (decl path 단일 변환)", () => {
  it("단일 path: at-rule > rule > decl", () => {
    const path: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "color", value: "#f00" },
    ];
    const ast = declPathToAst(path);
    expect(ast).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [{ type: "decl", prop: "color", value: "#f00" }],
          },
        ],
      },
    ]);
  });

  it("공통 prefix hoist 및 sibling decl 병합 (불가, 단일 path)", () => {
    const path: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "background", value: "#fff" },
    ];
    const ast = declPathToAst(path);
    expect(ast).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [{ type: "decl", prop: "background", value: "#fff" }],
          },
        ],
      },
    ]);
  });

  it("공통 prefix 없는 path (decl만)", () => {
    const path: DeclPath = [{ type: "decl", prop: "color", value: "#111" }];
    const ast = declPathToAst(path);
    expect(ast).toEqual([{ type: "rule", selector: "&", nodes: [{ type: "decl", prop: "color", value: "#111" }] }]);
  });

      it("복잡한 중첩/branch 구조 (실제 Modern CSS variant chain, 단일 path)", () => {
    const path: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "rule", selector: "&:hover" },
      { type: "at-rule", name: "supports", params: "(display: grid)" },
      { type: "decl", prop: "color", value: "#f00" },
    ];
    const ast = declPathToAst(path);
    expect(ast).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "supports",
            params: "(display: grid)",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [{ type: "decl", prop: "color", value: "#f00" }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("복수 at-rule + 복수 rule + decl", () => {
    const path: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "at-rule", name: "supports", params: "(display: grid)" },
      { type: "rule", selector: "&:hover" },
      { type: "rule", selector: "&:focus" },
      { type: "decl", prop: "color", value: "#f00" },
    ];
    const ast = declPathToAst(path);
    expect(ast).toMatchObject([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "supports",
            params: "(display: grid)",
            nodes: [
              {
                type: "rule",
                selector: "&:focus:hover",
                nodes: [
                  { type: "decl", prop: "color", value: "#f00" },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("style-rule + rule + at-rule + decl (variant 순서 뒤섞임)", () => {
    const path: DeclPath = [
      { type: "style-rule", selector: ".foo" },
      { type: "rule", selector: "&:hover" },
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "decl", prop: "color", value: "#f00" },
    ];
    const ast = declPathToAst(path);
    expect(ast).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",

        nodes: [
          {
            type: "style-rule",
            selector: ".foo",

            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [{ type: "decl", prop: "color", value: "#f00" }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("중복 at-rule/rule/style-rule 병합(hoist)", () => {
    const path: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "rule", selector: "&:hover" },
      { type: "rule", selector: "&:hover" },
      { type: "style-rule", selector: ".foo" },
      { type: "style-rule", selector: ".foo" },
      { type: "decl", prop: "color", value: "#f00" },
    ];
    const ast = declPathToAst(path);
    expect(ast).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "style-rule",
            selector: ".foo",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [{ type: "decl", prop: "color", value: "#f00" }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("decl만 (variant 없음)", () => {
    const path: DeclPath = [
      { type: "decl", prop: "border", value: "1px solid #000" },
    ];
    const ast = declPathToAst(path);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: "&",
        nodes: [{ type: "decl", prop: "border", value: "1px solid #000" }],
      },
    ]);
  });

  it("at-rule만 (decl 없음, 비정상)", () => {
    const path: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
    ];
    const ast = declPathToAst(path);
    expect(ast).toEqual([
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
    ]);
  });

  it("rule만 (decl 없음, 비정상)", () => {
    const path: DeclPath = [{ type: "rule", selector: ":hover" }];
    const ast = declPathToAst(path);
    expect(ast).toEqual([{ type: "rule", selector: ":hover" }]);
  });

  it("style-rule만 (decl 없음, 비정상)", () => {
    const path: DeclPath = [{ type: "style-rule", selector: ".foo" }];
    const ast = declPathToAst(path);
    expect(ast).toEqual([{ type: "style-rule", selector: ".foo" }]);
  });

  it("빈 path (비정상)", () => {
    const path: DeclPath = [];
    const ast = declPathToAst(path);
    expect(ast).toEqual([]);
  });

      it("실전 Modern CSS variant chain: sm:dark:hover:bg-red-500", () => {
    const path: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" }, // sm
      {
        type: "at-rule",
        name: "media",
        params: "(prefers-color-scheme: dark)",
      }, // dark
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "background", value: "#f00" },
    ];
    const ast = declPathToAst(path);
    expect(ast).toEqual([
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
                selector: "&:hover",
                nodes: [{ type: "decl", prop: "background", value: "#f00" }],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("arbitrary variant (type: 'arbitrary-variant')", () => {
    const path: DeclPath = [
      { type: "arbitrary-variant", value: "[&>*]" },
      { type: "decl", prop: "color", value: "#f00" },
    ] as any;
    const ast = declPathToAst(path);
    expect(ast).toMatchObject([
      {
        type: "arbitrary-variant", value: "[&>*]", nodes: [
          { type: "decl", prop: "color", value: "#f00" },
        ],
      },
    ]);
  });

  it("negative variant (type: 'rule', negative: true)", () => {
    const path: DeclPath = [
      { type: "rule", selector: "&:hover", negative: true },
      { type: "decl", prop: "color", value: "#f00" },
    ] as any;
    const ast = declPathToAst(path);
    expect(ast).toMatchObject([
      {
        type: "rule", selector: "&:hover", nodes: [
          { type: "decl", prop: "color", value: "#f00" },
        ],
      },
    ]);
  });

  it("복수 decl (동일 variant chain, decl만 다름)", () => {
    const path1: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "color", value: "#f00" },
    ];
    const path2: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "background", value: "#fff" },
    ];
    const ast1 = declPathToAst(path1);
    const ast2 = declPathToAst(path2);
    expect(ast1).toMatchObject([
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          {
            type: "rule", selector: "&:hover", nodes: [
              { type: "decl", prop: "color", value: "#f00" },
            ],
          },
        ],
      },
    ]);
    expect(ast2).toMatchObject([
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          {
            type: "rule", selector: "&:hover", nodes: [
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
        ],
      },
    ]);
  });

  it("comment 노드 포함", () => {
    const path: DeclPath = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)" },
      { type: "comment", text: "hello" },
      { type: "decl", prop: "color", value: "#f00" },
    ] as any;
    const ast = declPathToAst(path);
    expect(ast).toMatchObject([
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          {
            type: "comment", text: "hello", nodes: [
              { type: "decl", prop: "color", value: "#f00" },
            ],
          },
        ],
      },
    ]);
  });

  it("unknown/custom type variant", () => {
    const path: DeclPath = [
      { type: "custom-variant", foo: "bar" },
      { type: "decl", prop: "color", value: "#f00" },
    ] as any;
    const ast = declPathToAst(path);
    expect(ast).toMatchObject([
      {
        type: "custom-variant", foo: "bar", nodes: [
          { type: "decl", prop: "color", value: "#f00" },
        ],
      },
    ]);
  });
});