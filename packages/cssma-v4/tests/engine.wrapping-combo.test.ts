import { describe, it, expect } from "vitest";
import { normalizeWrappers } from "../src/core/engine";
import { AstNode } from "../src/core/ast";

describe("normalizeWrappers ", () => {
  it("중첩 at-rule(@media) 조건이 같으면 하나로 병합", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(min-width: 640px)",
            nodes: [
              { type: "decl", prop: "color", value: "red" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          { type: "decl", prop: "color", value: "red" },
        ],
      },
    ]);
  });

  it("중첩 at-rule(@media) 조건이 다르면 병합하지 않음", () => {
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
              { type: "decl", prop: "color", value: "red" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast); // 그대로 유지
  });

  it("중첩 at-rule이 하나 건너뛰어 등장: flatten은 건너뛰지 않고 구조 유지", () => {
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
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
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
        ],
      },
    ]);
  });

  it("중첩 style-rule selector가 같으면 병합", () => {
    const ast: AstNode[] = [
      {
        type: "style-rule",
        selector: ".foo",
        nodes: [
          {
            type: "style-rule",
            selector: ".foo",
            nodes: [
              { type: "decl", prop: "color", value: "blue" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "style-rule",
        selector: ".foo",
        nodes: [
          { type: "decl", prop: "color", value: "blue" },
        ],
      },
    ]);
  });

  it("중첩 rule selector가 다르면 병합하지 않음", () => {
    const ast: AstNode[] = [
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast); // 그대로 유지
  });

  it("복합 중첩 구조: at-rule + style-rule + decl", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "style-rule",
            selector: ".bar",
            nodes: [
              {
                type: "style-rule",
                selector: ".bar",
                nodes: [
                  { type: "decl", prop: "font-size", value: "2rem" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "style-rule",
            selector: ".bar",
            nodes: [
              { type: "decl", prop: "font-size", value: "2rem" },
            ],
          },
        ],
      },
    ]);
  });

  it("decl만 여러 개면 flatten하지 않고 그대로 유지", () => {
    const ast: AstNode[] = [
      { type: "decl", prop: "color", value: "red" },
      { type: "decl", prop: "background", value: "#fff" },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("복수 하위 노드: at-rule 내부에 decl 2개", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          { type: "decl", prop: "color", value: "red" },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("깊은 중첩: at-rule > style-rule > rule > decl", () => {
    const ast: AstNode[] = [
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
                nodes: [
                  { type: "decl", prop: "color", value: "red" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("불변성: 입력 AST를 변형하지 않는다", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(min-width: 640px)",
            nodes: [
              { type: "decl", prop: "color", value: "red" },
            ],
          },
        ],
      },
    ];
    const astCopy = JSON.parse(JSON.stringify(ast));
    normalizeWrappers(ast);
    expect(ast).toEqual(astCopy);
  });

  it("빈 nodes: at-rule의 nodes가 빈 배열이면 그대로 유지", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("실제 Tailwind 스타일: sm:dark:hover:bg-red-500 구조 병합", () => {
    const ast: AstNode[] = [
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
                type: "style-rule",
                selector: ".sm\\:dark\\:hover\\:bg-red-500:hover",
                nodes: [
                  { type: "decl", prop: "background-color", value: "#f00" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast); // 병합될 부분 없음
  });

  it("중첩 at-rule이 3단계 이상일 때 동일 조건만 병합", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(min-width: 640px)",
            nodes: [
              {
                type: "at-rule",
                name: "media",
                params: "(min-width: 640px)",
                nodes: [
                  { type: "decl", prop: "color", value: "red" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          { type: "decl", prop: "color", value: "red" },
        ],
      },
    ]);
  });

  it("복합 구조: at-rule > style-rule > decl + rule", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "style-rule",
            selector: ".foo",
            nodes: [
              { type: "decl", prop: "color", value: "red" },
              {
                type: "rule",
                selector: "&:hover",
                nodes: [
                  { type: "decl", prop: "background", value: "#fff" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("여러 sibling(형제) 노드: at-rule 내부에 style-rule 2개", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "style-rule",
            selector: ".foo",
            nodes: [
              { type: "decl", prop: "color", value: "red" },
            ],
          },
          {
            type: "style-rule",
            selector: ".bar",
            nodes: [
              { type: "decl", prop: "color", value: "blue" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("selector/params가 일부만 다르면 병합하지 않음", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(min-width: 768px)", // 다름
            nodes: [
              { type: "decl", prop: "color", value: "red" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("decl과 rule이 섞인 경우: rule만 flatten, decl은 그대로", () => {
    const ast: AstNode[] = [
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "color", value: "red" },
            ],
          },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          { type: "decl", prop: "color", value: "red" },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
    ]);
  });

  it("deeply nested + sibling: at-rule > style-rule > (rule + decl)", () => {
    const ast: AstNode[] = [
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
                nodes: [
                  { type: "decl", prop: "color", value: "red" },
                ],
              },
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("flatten 후에도 일부 중첩이 남아야 하는 경우: at-rule 조건 다름", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(hover: hover)", // 다름
            nodes: [
              {
                type: "decl",
                prop: "color",
                value: "red",
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("hover + focus + active 중첩 flatten", () => {
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
                type: "rule",
                selector: "&:active",
                nodes: [
                  { type: "decl", prop: "color", value: "red" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              {
                type: "rule",
                selector: "&:active",
                nodes: [
                  { type: "decl", prop: "color", value: "red" },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("responsive + dark + hover flatten", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 768px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(prefers-color-scheme: dark)",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [
                  { type: "decl", prop: "background-color", value: "#333" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 768px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(prefers-color-scheme: dark)",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [
                  { type: "decl", prop: "background-color", value: "#333" },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("group-hover + peer-checked + before flatten", () => {
    const ast: AstNode[] = [
      {
        type: "style-rule",
        selector: ".group:hover .group-hover\\:peer-checked\\:before:checked::before",
        nodes: [
          { type: "decl", prop: "content", value: "'✔'" },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("arbitrary variant + hover flatten", () => {
    const ast: AstNode[] = [
      {
        type: "rule",
        selector: "&[data-state='open']",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "background", value: "#f00" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "rule",
        selector: "&[data-state='open']",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "background", value: "#f00" },
            ],
          },
        ],
      },
    ]);
  });

  it("media query + attribute selector flatten", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(pointer: fine)",
        nodes: [
          {
            type: "rule",
            selector: "&[dir='rtl']",
            nodes: [
              { type: "decl", prop: "color", value: "blue" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("child selector + pseudo-element flatten", () => {
    const ast: AstNode[] = [
      {
        type: "style-rule",
        selector: ".parent > .child::after",
        nodes: [
          { type: "decl", prop: "content", value: "'after'" },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("visited + focus-visible + dark + responsive flatten", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 1024px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(prefers-color-scheme: dark)",
            nodes: [
              {
                type: "rule",
                selector: "&:visited",
                nodes: [
                  {
                    type: "rule",
                    selector: "&:focus-visible",
                    nodes: [
                      { type: "decl", prop: "outline", value: "2px solid #fff" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 1024px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(prefers-color-scheme: dark)",
            nodes: [
              {
                type: "rule",
                selector: "&:visited",
                nodes: [
                  {
                    type: "rule",
                    selector: "&:focus-visible",
                    nodes: [
                      { type: "decl", prop: "outline", value: "2px solid #fff" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("nth-child, first-of-type, only-of-type, disabled, checked, required, placeholder-shown flatten", () => {
    const selectors = [
      '&:nth-child(2n)', '&:first-of-type', '&:only-of-type', '&:disabled', '&:checked', '&:required', '&:placeholder-shown'
    ];
    selectors.forEach(sel => {
      const ast: AstNode[] = [
        {
          type: "rule",
          selector: sel,
          nodes: [
            { type: "decl", prop: "color", value: "#abc" },
          ],
        },
      ];
      const result = normalizeWrappers(ast);
      expect(result).toEqual(ast);
    });
  });

  it("before + after + hover + focus 중첩 flatten", () => {
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
                type: "rule",
                selector: "&::before",
                nodes: [
                  {
                    type: "rule",
                    selector: "&::after",
                    nodes: [
                      { type: "decl", prop: "content", value: "'!'" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              {
                type: "rule",
                selector: "&::before",
                nodes: [
                  {
                    type: "rule",
                    selector: "&::after",
                    nodes: [
                      { type: "decl", prop: "content", value: "'!'" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("복수 media query + 복수 at-rule flatten", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(orientation: landscape)",
            nodes: [
              {
                type: "at-rule",
                name: "supports",
                params: "(display: grid)",
                nodes: [
                  { type: "decl", prop: "display", value: "grid" },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "at-rule",
        name: "media",
        params: "print",
        nodes: [
          { type: "decl", prop: "color", value: "black" },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("복수 attribute selector + 복수 pseudo-class flatten", () => {
    const ast: AstNode[] = [
      {
        type: "rule",
        selector: "&[aria-checked='true']",
        nodes: [
          {
            type: "rule",
            selector: "&[data-state='open']",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [
                  {
                    type: "rule",
                    selector: "&:active",
                    nodes: [
                      { type: "decl", prop: "color", value: "#f00" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "rule",
        selector: "&[aria-checked='true']",
        nodes: [
          {
            type: "rule",
            selector: "&[data-state='open']",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [
                  {
                    type: "rule",
                    selector: "&:active",
                    nodes: [
                      { type: "decl", prop: "color", value: "#f00" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("복수 group/peer + deeply nested flatten", () => {
    const ast: AstNode[] = [
      {
        type: "style-rule",
        selector: ".group:focus .peer:checked .group-hover\:peer-checked\:before:checked::before",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              {
                type: "rule",
                selector: "&:focus-visible",
                nodes: [
                  { type: "decl", prop: "outline", value: "2px solid #0f0" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("arbitrary variant + group + peer + pseudo flatten", () => {
    const ast: AstNode[] = [
      {
        type: "style-rule",
        selector: ".group[data-theme='dark'] .peer[aria-selected='true'] .group-hover\:peer-checked\:before:checked::before",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              {
                type: "rule",
                selector: "&:active",
                nodes: [
                  { type: "decl", prop: "background", value: "#222" },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("empty nodes, invalid 구조도 flatten에서 무시/유지", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [],
      },
      {
        type: "rule",
        selector: "&:hover",
        nodes: [],
      },
      {
        type: "decl",
        prop: "color",
        value: "#000",
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("flatten 후 decl 병합: 중복 decl은 그대로 유지", () => {
    const ast: AstNode[] = [
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "color", value: "#f00" },
              { type: "decl", prop: "color", value: "#0f0" },
            ],
          },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          { type: "decl", prop: "color", value: "#f00" },
          { type: "decl", prop: "color", value: "#0f0" },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
    ]);
  });

  it("복수 sibling + 중첩 flatten: at-rule > (rule + rule) + decl", () => {
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
                type: "rule",
                selector: "&:hover",
                nodes: [
                  { type: "decl", prop: "color", value: "#f00" },
                ],
              },
              {
                type: "rule",
                selector: "&:focus",
                nodes: [
                  { type: "decl", prop: "color", value: "#0f0" },
                ],
              },
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "outline", value: "2px solid #000" },
            ],
          },
          { type: "decl", prop: "border", value: "1px solid #000" },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "color", value: "#f00" },
              {
                type: "rule",
                selector: "&:focus",
                nodes: [
                  { type: "decl", prop: "color", value: "#0f0" },
                ],
              },
              { type: "decl", prop: "background", value: "#fff" },
            ],
          },
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "outline", value: "2px solid #000" },
            ],
          },
          { type: "decl", prop: "border", value: "1px solid #000" },
        ],
      },
    ]);
  });

  it("복수 media + 복수 sibling + deeply nested flatten", () => {
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
                type: "rule",
                selector: "&:focus",
                nodes: [
                  { type: "decl", prop: "color", value: "#f00" },
                  {
                    type: "rule",
                    selector: "&:active",
                    nodes: [
                      { type: "decl", prop: "background", value: "#fff" },
                    ],
                  },
                ],
              },
              { type: "decl", prop: "border", value: "1px solid #000" },
            ],
          },
        ],
      },
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 1024px)",
        nodes: [
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "outline", value: "2px solid #000" },
            ],
          },
        ],
      },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual(ast);
  });

  it("복수 sibling + deeply nested + flatten 후 decl 병합", () => {
    const ast: AstNode[] = [
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "color", value: "#f00" },
              { type: "decl", prop: "color", value: "#0f0" },
            ],
          },
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "color", value: "#00f" },
            ],
          },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
      {
        type: "rule",
        selector: "&:focus",
        nodes: [
          { type: "decl", prop: "outline", value: "2px solid #000" },
        ],
      },
      { type: "decl", prop: "border", value: "1px solid #000" },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          { type: "decl", prop: "color", value: "#f00" },
          { type: "decl", prop: "color", value: "#0f0" },
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "color", value: "#00f" },
            ],
          },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
      {
        type: "rule",
        selector: "&:focus",
        nodes: [
          { type: "decl", prop: "outline", value: "2px solid #000" },
        ],
      },
      { type: "decl", prop: "border", value: "1px solid #000" },
    ]);
  });

  it("복수 sibling + deeply nested + flatten 후 decl 병합 + branch", () => {
    const ast: AstNode[] = [
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "color", value: "#f00" },
              { type: "decl", prop: "color", value: "#0f0" },
            ],
          },
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "color", value: "#00f" },
              {
                type: "rule",
                selector: "&:active",
                nodes: [
                  { type: "decl", prop: "background", value: "#fff" },
                ],
              },
            ],
          },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
      {
        type: "rule",
        selector: "&:focus",
        nodes: [
          { type: "decl", prop: "outline", value: "2px solid #000" },
        ],
      },
      { type: "decl", prop: "border", value: "1px solid #000" },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          { type: "decl", prop: "color", value: "#f00" },
          { type: "decl", prop: "color", value: "#0f0" },
          {
            type: "rule",
            selector: "&:focus",
            nodes: [
              { type: "decl", prop: "color", value: "#00f" },
              {
                type: "rule",
                selector: "&:active",
                nodes: [
                  { type: "decl", prop: "background", value: "#fff" },
                ],
              },
            ],
          },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
      {
        type: "rule",
        selector: "&:focus",
        nodes: [
          { type: "decl", prop: "outline", value: "2px solid #000" },
        ],
      },
      { type: "decl", prop: "border", value: "1px solid #000" },
    ]);
  });

  it("복수 media(min/max) + deeply nested + sibling + branch + flatten", () => {
    const ast: AstNode[] = [
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(max-width: 1024px)",
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
                      {
                        type: "rule",
                        selector: "&:active",
                        nodes: [
                          { type: "decl", prop: "background", value: "#fff" },
                        ],
                      },
                    ],
                  },
                  { type: "decl", prop: "border", value: "1px solid #000" },
                ],
              },
              {
                type: "rule",
                selector: "&:focus",
                nodes: [
                  { type: "decl", prop: "outline", value: "2px solid #000" },
                  {
                    type: "rule",
                    selector: "&:active",
                    nodes: [
                      { type: "decl", prop: "background", value: "#eee" },
                    ],
                  },
                ],
              },
              { type: "decl", prop: "background", value: "#ccc" },
            ],
          },
          {
            type: "at-rule",
            name: "media",
            params: "(min-width: 1280px)",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [
                  { type: "decl", prop: "color", value: "#0ff" },
                ],
              },
              { type: "decl", prop: "background", value: "#000" },
            ],
          },
        ],
      },
      {
        type: "at-rule",
        name: "media",
        params: "(max-width: 480px)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "color", value: "#ff0" },
            ],
          },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
      { type: "decl", prop: "border", value: "2px solid #f00" },
    ];
    const result = normalizeWrappers(ast);
    expect(result).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 640px)",
        nodes: [
          {
            type: "at-rule",
            name: "media",
            params: "(max-width: 1024px)",
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
                      {
                        type: "rule",
                        selector: "&:active",
                        nodes: [
                          { type: "decl", prop: "background", value: "#fff" },
                        ],
                      },
                    ],
                  },
                  { type: "decl", prop: "border", value: "1px solid #000" },
                ],
              },
              {
                type: "rule",
                selector: "&:focus",
                nodes: [
                  { type: "decl", prop: "outline", value: "2px solid #000" },
                  {
                    type: "rule",
                    selector: "&:active",
                    nodes: [
                      { type: "decl", prop: "background", value: "#eee" },
                    ],
                  },
                ],
              },
              { type: "decl", prop: "background", value: "#ccc" },
            ],
          },
          {
            type: "at-rule",
            name: "media",
            params: "(min-width: 1280px)",
            nodes: [
              {
                type: "rule",
                selector: "&:hover",
                nodes: [
                  { type: "decl", prop: "color", value: "#0ff" },
                ],
              },
              { type: "decl", prop: "background", value: "#000" },
            ],
          },
        ],
      },
      {
        type: "at-rule",
        name: "media",
        params: "(max-width: 480px)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "color", value: "#ff0" },
            ],
          },
          { type: "decl", prop: "background", value: "#fff" },
        ],
      },
      { type: "decl", prop: "border", value: "2px solid #f00" },
    ]);
  });
});
