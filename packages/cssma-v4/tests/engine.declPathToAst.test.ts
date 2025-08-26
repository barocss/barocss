import { describe, it, expect } from "vitest";
import { DeclPath, declPathToAst } from "../src/core/engine";

// DeclPath type: Array<{ type: 'rule', selector: string } | { type: 'decl', ... }>

describe("declPathToAst selector composition", () => {
  it("Single rule: &:hover", () => {
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

  it("Nested rule: group:hover & → &:hover", () => {
    const declPath = [
      { type: "rule", selector: "group:hover &" },
      { type: "rule", selector: "&:hover" },
      { type: "decl", prop: "color", value: "red" }
    ];
    // Expect: group:hover &:hover
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

  it("3 nested: group:hover & → &:hover → &:focus", () => {
    const declPath = [
      { type: "rule", selector: "group:hover &", source: 'group' },
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "rule", selector: "&:focus", source: 'pseudo' },
      { type: "decl", prop: "color", value: "red" }
    ];
    // Expect: group:hover &:hover:focus
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

  it("rule + at-rule nesting: @media + &:hover", () => {
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

  it("4 nested rules: group:active & → group:hover & → &:focus → &:hover", () => {
    const declPath = [
      { type: "rule", selector: ".group:active &", source: 'group' },
      { type: "rule", selector: ".group:hover &", source: 'group' },
      { type: "rule", selector: "&:focus", source: 'pseudo' },
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "decl", prop: "color", value: "blue" }
    ];
    // Expect: group:active group:hover &:focus:hover
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

  it("at-rule + 3 nested rules: @media + group:hover & → &:focus → &:hover", () => {
    const declPath = [
      { type: "at-rule", name: "media", params: "(min-width: 40rem)", source: 'responsive' },
      { type: "rule", selector: "group:hover &", source: 'group' },
      { type: "rule", selector: "&:focus", source: 'pseudo' },
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "decl", prop: "color", value: "green" }
    ];
    // Expect: @media { group:hover &:focus:hover }
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

  it("Selector with multiple & occurrences", () => {
    const declPath = [
      { type: "rule", selector: ".foo .bar &", source: 'base' },
      { type: "rule", selector: "&:hover", source: 'pseudo' },
      { type: "decl", prop: "color", value: "purple" }
    ];
    // Expect: &.foo &.bar:hover
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

  it("Combination without spaces: .foo&:hover", () => {
    const declPath = [
      { type: "rule", selector: ".foo&:hover" },
      { type: "decl", prop: "color", value: "orange" }
    ];
    // Expect: .foo&:hover
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
    // Expect: .group:hover &:focus:hover
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
    // Expect: .peer:hover ~ &:focus
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
    // Expect: &[aria-pressed="true"] .group:hover &:hover
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
    // Expect: :is(.group-hover\:\*\:rounded-full > *) .group:hover &:hover
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
    // Expect: &:not(:hover) .group:hover &:focus
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