import { describe, it, expect } from "vitest";
import { collectDeclPaths } from "../src/core/engine";
import { AstNode } from "../src/core/ast";

describe("collectDeclPaths ", () => {
  it("기본 중첩/branch 구조", () => {
    const ast: AstNode[] = [
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(hover: hover)",
            nodes: [
              { type: "decl", prop: "color", value: "#f00" },
            ],
          },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
      {
        type: "style-rule",
        selector: ".foo",
        nodes: [
          { type: "decl", prop: "color", value: "#0f0" },
        ],
      },
      { type: "decl", prop: "border", value: "1px solid #000" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
        [
            { type: "rule", selector: "&:hover" },
            { type: "at-rule", name: "media", params: "(hover: hover)" },
            { type: "decl", prop: "color", value: "#f00" },
        ],
        [
            { type: "rule", selector: "&:hover" },
            { type: "decl", prop: "background", value: "#fff" },
        ],
        [
            { type: "style-rule", selector: ".foo" },
            { type: "decl", prop: "color", value: "#0f0" },
        ],
        [
            { type: "decl", prop: "border", value: "1px solid #000" },
        ]
    ]);
  });

  it("복잡한 sibling/branch 구조", () => {
    const ast: AstNode[] = [
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              {
                type: "at-rule",
                name: "media",
                params: "(hover: hover)",
                nodes: [
                  { type: "decl", prop: "color", value: "#f00" },
                ],
              },
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
          {
            type: "style-rule",
            selector: ".foo",
            nodes: [
              { type: "decl", prop: "color", value: "#0f0" },
            ],
          },
        ],
      },
      { type: "decl", prop: "border", value: "1px solid #000" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "rule", selector: "&:hover" },
        { type: "rule", selector: "&:focus" },
        { type: "at-rule", name: "media", params: "(hover: hover)" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "rule", selector: "&:hover" },
        { type: "rule", selector: "&:focus" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
      [
        { type: "rule", selector: "&:hover" },
        { type: "style-rule", selector: ".foo" },
        { type: "decl", prop: "color", value: "#0f0" },
      ],
      [
        { type: "decl", prop: "border", value: "1px solid #000" },
      ]
    ]);
  });

  it("복수 at-rule + deeply nested + sibling/branch", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              {
                type: "at-rule",
                name: "media",
                params: "(hover: hover)",
                nodes: [
                  { type: "decl", prop: "color", value: "#f00" },
                ],
              },
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
          { type: "decl", prop: "border", value: "1px solid #000" },
        ],
      },
      {
        type: "at-rule",
        name: "media",
        params: "(max-width: 1024px)",
        nodes: [
          {
            type: "style-rule",
            selector: ".foo",
            nodes: [
              { type: "decl", prop: "color", value: "#0f0" },
            ],
          },
        ],
      },
      { type: "decl", prop: "z-index", value: "10" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "rule", selector: "&:hover" },
        { type: "at-rule", name: "media", params: "(hover: hover)" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "rule", selector: "&:hover" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "decl", prop: "border", value: "1px solid #000" },
      ],
      [
        { type: "at-rule", name: "media", params: "(max-width: 1024px)" },
        { type: "style-rule", selector: ".foo" },
        { type: "decl", prop: "color", value: "#0f0" },
      ],
      [
        { type: "decl", prop: "z-index", value: "10" },
      ],
    ]);
  });

  it("중첩 style-rule + 중첩 rule + deeply nested decl", () => {
    const ast: AstNode[] = [
      {
        type: "style-rule",
        selector: ".foo",
        nodes: [
          {
            type: "style-rule",
            selector: ".bar",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [
                  {
                    type: "rule",
                    selector: "&:focus",
                    nodes: [
                      { type: "decl", prop: "color", value: "#f00" },
                    ],
                  },
                  { type: "decl", prop: "background", value: "#fff" },
                ],
              },
            ],
          },
        ],
      },
      { type: "decl", prop: "opacity", value: "0.5" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "style-rule", selector: ".foo" },
        { type: "style-rule", selector: ".bar" },
        { type: "rule", selector: "&:hover" },
        { type: "rule", selector: "&:focus" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "style-rule", selector: ".foo" },
        { type: "style-rule", selector: ".bar" },
        { type: "rule", selector: "&:hover" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
      [
        { type: "decl", prop: "opacity", value: "0.5" },
      ],
    ]);
  });

  it("중첩 at-rule + sibling decl + branch", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(hover: hover)",
            nodes: [
              { type: "decl", prop: "color", value: "#f00" },
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
          { type: "decl", prop: "border", value: "1px solid #000" },
        ],
      },
      { type: "decl", prop: "z-index", value: "10" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "at-rule", name: "media", params: "(hover: hover)" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "at-rule", name: "media", params: "(hover: hover)" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "decl", prop: "border", value: "1px solid #000" },
      ],
      [
        { type: "decl", prop: "z-index", value: "10" },
      ],
    ]);
  });

  it("root decl만 여러 개", () => {
    const ast: AstNode[] = [
      { type: "decl", prop: "color", value: "#111" },
      { type: "decl", prop: "background", value: "#222" },
      { type: "decl", prop: "border", value: "1px solid #333" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [{ type: "decl", prop: "color", value: "#111" }],
      [{ type: "decl", prop: "background", value: "#222" }],
      [{ type: "decl", prop: "border", value: "1px solid #333" }],
    ]);
  });

  it("at-rule, style-rule, rule, decl이 한 레벨에 모두 혼합", () => {
    const ast: AstNode[] = [
      { type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [{ type: "decl", prop: "color", value: "#f00" }] },
      { type: "style-rule", selector: ".foo", nodes: [{ type: "decl", prop: "background", value: "#fff" }] },
      { type: "rule", selector: "&:hover", nodes: [{ type: "decl", prop: "border", value: "1px solid #000" }] },
      { type: "decl", prop: "opacity", value: "0.5" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [ { type: "at-rule", name: "media", params: "(min-width: 640px)" }, { type: "decl", prop: "color", value: "#f00" } ],
      [ { type: "style-rule", selector: ".foo" }, { type: "decl", prop: "background", value: "#fff" } ],
      [ { type: "rule", selector: "&:hover" }, { type: "decl", prop: "border", value: "1px solid #000" } ],
      [ { type: "decl", prop: "opacity", value: "0.5" } ],
    ]);
  });

  it("3중 이상 deeply nested 구조", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          { type: "style-rule", selector: ".foo", nodes: [
            { type: "rule", selector: "&:hover", nodes: [
              { type: "at-rule", name: "supports", params: "(display: grid)", nodes: [
                { type: "decl", prop: "color", value: "#f00" },
              ] },
              { type: "decl", prop: "background", value: "#fff" },
            ] },
          ] },
        ] },
      { type: "decl", prop: "opacity", value: "0.5" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "style-rule", selector: ".foo" },
        { type: "rule", selector: "&:hover" },
        { type: "at-rule", name: "supports", params: "(display: grid)" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "style-rule", selector: ".foo" },
        { type: "rule", selector: "&:hover" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
      [ { type: "decl", prop: "opacity", value: "0.5" } ],
    ]);
  });

  it("빈 nodes, 빈 배열, decl만 있는 경우", () => {
    const ast: AstNode[] = [
      { type: "style-rule", selector: ".foo", nodes: [] },
      { type: "rule", selector: "&:hover", nodes: [] },
      { type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [] },
      { type: "decl", prop: "color", value: "#111" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [ { type: "decl", prop: "color", value: "#111" } ],
    ]);
  });

  it("at-rule/decl이 반복적으로 교차", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          { type: "decl", prop: "color", value: "#f00" },
          { type: "at-rule", name: "supports", params: "(display: grid)", nodes: [
            { type: "decl", prop: "background", value: "#fff" },
          ] },
        ] },
      { type: "decl", prop: "opacity", value: "0.5" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "at-rule", name: "supports", params: "(display: grid)" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
      [ { type: "decl", prop: "opacity", value: "0.5" } ],
    ]);
  });

  it("style-rule, rule, at-rule이 branch로 여러 개", () => {
    const ast: AstNode[] = [
      {
        type: "style-rule", selector: ".foo", nodes: [
          { type: "rule", selector: "&:hover", nodes: [
            { type: "decl", prop: "color", value: "#f00" },
          ] },
          { type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
            { type: "decl", prop: "background", value: "#fff" },
          ] },
          { type: "decl", prop: "border", value: "1px solid #000" },
        ] },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "style-rule", selector: ".foo" },
        { type: "rule", selector: "&:hover" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "style-rule", selector: ".foo" },
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
      [
        { type: "style-rule", selector: ".foo" },
        { type: "decl", prop: "border", value: "1px solid #000" },
      ],
    ]);
  });

  it("실제 Tailwind variant chain 예시", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          {
            type: "rule", selector: ":hover", nodes: [
              {
                type: "at-rule", name: "supports", params: "(display: grid)", nodes: [
                  { type: "decl", prop: "color", value: "#f00" },
                ] },
              { type: "decl", prop: "background", value: "#fff" },
            ] },
        ] },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "rule", selector: ":hover" },
        { type: "at-rule", name: "supports", params: "(display: grid)" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "rule", selector: ":hover" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
    ]);
  });

  it("style-rule, rule, at-rule이 모두 중첩 + sibling decl", () => {
    const ast: AstNode[] = [
      {
        type: "style-rule", selector: ".foo", nodes: [
          {
            type: "rule", selector: "&:hover", nodes: [
              {
                type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
                  { type: "decl", prop: "color", value: "#f00" },
                ] },
              { type: "decl", prop: "background", value: "#fff" },
            ] },
          { type: "decl", prop: "border", value: "1px solid #000" },
        ] },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "style-rule", selector: ".foo" },
        { type: "rule", selector: "&:hover" },
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "style-rule", selector: ".foo" },
        { type: "rule", selector: "&:hover" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
      [
        { type: "style-rule", selector: ".foo" },
        { type: "decl", prop: "border", value: "1px solid #000" },
      ],
    ]);
  });

  it("decl이 없는 branch (decl 없는 노드)", () => {
    const ast: AstNode[] = [
      {
        type: "style-rule", selector: ".foo", nodes: [
          { type: "rule", selector: "&:hover", nodes: [] },
          { type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [] },
        ] },
      { type: "decl", prop: "color", value: "#111" },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [ { type: "decl", prop: "color", value: "#111" } ],
    ]);
  });

  it("매우 깊은 중첩(5~6단계)", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule", name: "media", params: "(min-width: 640px)", nodes: [
          {
            type: "at-rule", name: "supports", params: "(display: grid)", nodes: [
              {
                type: "style-rule", selector: ".foo", nodes: [
                  {
                    type: "rule", selector: "&:hover", nodes: [
                      {
                        type: "at-rule", name: "media", params: "(hover: hover)", nodes: [
                          { type: "decl", prop: "color", value: "#f00" },
                        ] },
                      { type: "decl", prop: "background", value: "#fff" },
                    ] },
                ] },
            ] },
        ] },
    ];
    const declPaths = collectDeclPaths(ast);
    expect(declPaths).toEqual([
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "at-rule", name: "supports", params: "(display: grid)" },
        { type: "style-rule", selector: ".foo" },
        { type: "rule", selector: "&:hover" },
        { type: "at-rule", name: "media", params: "(hover: hover)" },
        { type: "decl", prop: "color", value: "#f00" },
      ],
      [
        { type: "at-rule", name: "media", params: "(min-width: 640px)" },
        { type: "at-rule", name: "supports", params: "(display: grid)" },
        { type: "style-rule", selector: ".foo" },
        { type: "rule", selector: "&:hover" },
        { type: "decl", prop: "background", value: "#fff" },
      ],
    ]);
  });
});