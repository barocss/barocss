import { describe, it, expect } from "vitest";
import { DeclPath, declPathToAst } from "../src/core/engine";

// DeclPath 타입: Array<{ type: 'rule', selector: string } | { type: 'decl', ... }>

describe("declPathToAst selector 합성 ", () => {
  it("단일 rule: &:hover", () => {
    const declPath = [
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "color", value: "red" }
    ];
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: "&:hover",
        nodes: [
          { type: "decl", prop: "color", value: "red" }
        ]
      }
    ]);
  });

  it("중첩 rule: group:hover & → &:hover", () => {
    const declPath = [
      { type: "rule", selector: "group:hover &" },
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "color", value: "red" }
    ];
    // 기대: group:hover &:hover
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: "group:hover &:hover",
        nodes: [
          { type: "decl", prop: "color", value: "red" }
        ]
      }
    ]);
  });

  it("3중첩: group:hover & → &:hover → &:focus", () => {
    const declPath = [
      { type: "rule", selector: "group:hover &", source: 'group' },
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "rule", selector: "&:focus", source: 'pseudo' },
      { type: "decl", prop: "color", value: "red" }
    ];
    // 기대: group:hover &:hover:focus
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: "group:hover &:hover:focus",
        nodes: [
          { type: "decl", prop: "color", value: "red" }
        ]
      }
    ]);
  });

  it("rule + at-rule 중첩: @media + &:hover", () => {
    const declPath = [
      { type: "at-rule", name: "media", params: "(min-width: 40rem)" },
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "color", value: "red" }
    ];
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 40rem)",
        nodes: [
          {
            type: "rule",
            selector: "&:hover",
            nodes: [
              { type: "decl", prop: "color", value: "red" }
            ]
          }
        ]
      }
    ]);
  });

  it("4중 rule: group:active & → group:hover & → &:focus → &:hover", () => {
    const declPath = [
      { type: "rule", selector: ".group:active &", source: 'group' },
      { type: "rule", selector: ".group:hover &", source: 'group' },
      { type: "rule", selector: "&:focus", source: 'pseudo' },
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "decl", prop: "color", value: "blue" }
    ];
    // 기대: group:active group:hover &:focus:hover
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: ".group:active .group:hover &:focus:hover",
        nodes: [
          { type: "decl", prop: "color", value: "blue" }
        ]
      }
    ]);
  });

  it("at-rule + 3중첩 rule: @media + group:hover & → &:focus → &:hover", () => {
    const declPath = [
      { type: "at-rule", name: "media", params: "(min-width: 40rem)", source: 'responsive' },
      { type: "rule", selector: "group:hover &", source: 'group' },
      { type: "rule", selector: "&:focus", source: 'pseudo' },
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "decl", prop: "color", value: "green" }
    ];
    // 기대: @media { group:hover &:focus:hover }
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "at-rule",
        name: "media",
        params: "(min-width: 40rem)",
        source: 'responsive',
        nodes: [
          {
            type: "rule",
            selector: "group:hover &:focus:hover",
            nodes: [
              { type: "decl", prop: "color", value: "green" }
            ]
          }
        ]
      }
    ]);
  });

  it("&가 여러 번 등장하는 selector", () => {
    const declPath = [
      { type: "rule", selector: ".foo .bar &", source: 'base' },
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "decl", prop: "color", value: "purple" }
    ];
    // 기대: &.foo &.bar:hover
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: ".foo .bar &:hover",
        nodes: [
          { type: "decl", prop: "color", value: "purple" }
        ]
      }
    ]);
  });

  it("공백 없는 조합: .foo&:hover", () => {
    const declPath = [
      { type: "rule", selector: ".foo&:hover" },
      { type: "decl", prop: "color", value: "orange" }
    ];
    // 기대: .foo&:hover
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: ".foo&:hover",
        nodes: [
          { type: "decl", prop: "color", value: "orange" }
        ]
      }
    ]);
  });

  it("group-hover & + &:focus + &:hover", () => {
    const declPath = [
      { type: "rule", selector: ".group:hover &", source: 'group' },
      { type: "rule", selector: "&:focus", source: 'pseudo' },
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "decl", prop: "color", value: "red" }
    ];
    // 기대: .group:hover &:focus:hover
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: ".group:hover &:focus:hover",
        nodes: [
          { type: "decl", prop: "color", value: "red" }
        ]
      }
    ]);
  });

  it("peer-hover & + &:focus", () => {
    const declPath = [
      { type: "rule", selector: ".peer:hover ~ &" },
      { type: "rule", selector: "&:focus" },
      { type: "decl", prop: "color", value: "blue" }
    ];
    // 기대: .peer:hover ~ &:focus
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: ".peer:hover ~ &:focus",
        nodes: [
          { type: "decl", prop: "color", value: "blue" }
        ]
      }
    ]);
  });

  it("aria-pressed + group-hover & + &:hover", () => {
    const declPath = [
      { type: "rule", selector: ".group:hover &", source: 'group' },
      { type: "rule", selector: '&[aria-pressed="true"]', source: 'attribute' },      
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "decl", prop: "color", value: "green" }
    ];
    // 기대: &[aria-pressed="true"] .group:hover &:hover
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: '.group:hover &[aria-pressed="true"]:hover',
        nodes: [
          { type: "decl", prop: "color", value: "green" }
        ]
      }
    ]);
  });

  it("universal selector + group-hover & + &:hover", () => {
    const declPath = [
      { type: "style-rule", selector: ':is(.group-hover\:\*\:rounded-full > *)' },
      { type: "rule", selector: ".group:hover &" },
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "border-radius", value: "9999px" }
    ];
    // 기대: :is(.group-hover\:\*\:rounded-full > *) .group:hover &:hover
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "style-rule",
        selector: ':is(.group-hover\:\*\:rounded-full > *)',
        nodes: [
          {
            type: "rule",
            selector: ".group:hover &:hover",
            nodes: [
              { type: "decl", prop: "border-radius", value: "9999px" }
            ]
          }
        ]
      }
    ]);
  });

  it("not-hover + group-hover & + &:focus", () => {
    const declPath = [
      { type: "rule", selector: ".group:hover &", source: 'group' },        
      { type: "rule", selector: '&:not(:hover)', source: 'attribute' },
      { type: "rule", selector: "&:focus", source: 'pseudo' },
      { type: "decl", prop: "color", value: "purple" }
    ];
    // 기대: &:not(:hover) .group:hover &:focus
    const ast = declPathToAst(declPath as DeclPath);
    expect(ast).toEqual([
      {
        type: "rule",
        selector: '.group:hover &:not(:hover):focus',
        nodes: [
          { type: "decl", prop: "color", value: "purple" }
        ]
      }
    ]);
  });
}); 