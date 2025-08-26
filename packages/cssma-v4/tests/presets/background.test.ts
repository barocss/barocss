import { describe, it, expect } from "vitest";
import "../../src/index";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({
  theme: {
    colors: {
      red: {
        500: "red",
      },
      blue: {
        500: "blue-500",
      },
      green: {
        500: "green",
        700: "green-700",
      },
    },
  },
});

describe("background utilities", () => {
  // background-attachment
  it("bg-fixed → background-attachment: fixed", () => {
    expect(parseClassToAst("bg-fixed", ctx)).toEqual([
      { type: "decl", prop: "background-attachment", value: "fixed" },
    ]);
  });
  it("bg-local → background-attachment: local", () => {
    expect(parseClassToAst("bg-local", ctx)).toEqual([
      { type: "decl", prop: "background-attachment", value: "local" },
    ]);
  });
  it("bg-scroll → background-attachment: scroll", () => {
    expect(parseClassToAst("bg-scroll", ctx)).toEqual([
      { type: "decl", prop: "background-attachment", value: "scroll" },
    ]);
  });

  // background-clip
  it("bg-clip-border → background-clip: border-box", () => {
    expect(parseClassToAst("bg-clip-border", ctx)).toEqual([
      { type: "decl", prop: "background-clip", value: "border-box" },
    ]);
  });
  it("bg-clip-padding → background-clip: padding-box", () => {
    expect(parseClassToAst("bg-clip-padding", ctx)).toEqual([
      { type: "decl", prop: "background-clip", value: "padding-box" },
    ]);
  });
  it("bg-clip-content → background-clip: content-box", () => {
    expect(parseClassToAst("bg-clip-content", ctx)).toEqual([
      { type: "decl", prop: "background-clip", value: "content-box" },
    ]);
  });
  it("bg-clip-text → background-clip: text", () => {
    expect(parseClassToAst("bg-clip-text", ctx)).toEqual([
      { type: "decl", prop: "background-clip", value: "text" },
    ]);
  });

  // background-color
  it("bg-inherit → background-color: inherit", () => {
    expect(parseClassToAst("bg-inherit", ctx)).toEqual([
      { type: "decl", prop: "background-color", value: "inherit" },
    ]);
  });
  it("bg-current → background-color: currentColor", () => {
    expect(parseClassToAst("bg-current", ctx)).toEqual([
      { type: "decl", prop: "background-color", value: "currentColor" },
    ]);
  });
  it("bg-transparent → background-color: transparent", () => {
    expect(parseClassToAst("bg-transparent", ctx)).toEqual([
      { type: "decl", prop: "background-color", value: "transparent" },
    ]);
  });
  it("bg-red-500/75 → background-color: color-mix(in lab, red-500 75%, transparent)", () => {
    expect(parseClassToAst("bg-red-500/75", ctx)).toEqual([
      {
        type: "at-rule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "background-color",
            value: "color-mix(in lab, red 75%, transparent)",
          },
        ],
      },
      { type: "decl", prop: "background-color", value: "red" },
    ]);
  });
  it("bg-[#bada55] → background-color: #bada55", () => {
    expect(parseClassToAst("bg-[#bada55]", ctx)).toEqual([
      { type: "decl", prop: "background-color", value: "#bada55" },
    ]);
  });

  // background-image
  it("bg-none → background-image: none", () => {
    expect(parseClassToAst("bg-none", ctx)).toEqual([
      { type: "decl", prop: "background-image", value: "none" },
    ]);
  });
  it("bg-[url(/img/bg.png)] → background-image: url(/img/bg.png)", () => {
    expect(parseClassToAst("bg-[url(/img/bg.png)]", ctx)).toEqual([
      { type: "decl", prop: "background-image", value: "url(/img/bg.png)" },
    ]);
  });

  // background-origin
  it("bg-origin-border → background-origin: border-box", () => {
    expect(parseClassToAst("bg-origin-border", ctx)).toEqual([
      { type: "decl", prop: "background-origin", value: "border-box" },
    ]);
  });
  it("bg-origin-padding → background-origin: padding-box", () => {
    expect(parseClassToAst("bg-origin-padding", ctx)).toEqual([
      { type: "decl", prop: "background-origin", value: "padding-box" },
    ]);
  });
  it("bg-origin-content → background-origin: content-box", () => {
    expect(parseClassToAst("bg-origin-content", ctx)).toEqual([
      { type: "decl", prop: "background-origin", value: "content-box" },
    ]);
  });

  // background-position
  it("bg-bottom → background-position: bottom", () => {
    expect(parseClassToAst("bg-bottom", ctx)).toEqual([
      { type: "decl", prop: "background-position", value: "bottom" },
    ]);
  });
  it("bg-center → background-position: center", () => {
    expect(parseClassToAst("bg-center", ctx)).toEqual([
      { type: "decl", prop: "background-position", value: "center" },
    ]);
  });
  it("bg-left → background-position: left", () => {
    expect(parseClassToAst("bg-left", ctx)).toEqual([
      { type: "decl", prop: "background-position", value: "left" },
    ]);
  });
  it("bg-position-[right_20px_top_10px] → background-position: right 20px top 10px", () => {
    expect(parseClassToAst("bg-position-[right_20px_top_10px]", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-position",
        value: "right 20px top 10px",
      },
    ]);
  });
  it("bg-position-(--my-bg-pos) → background-position: var(--my-bg-pos)", () => {
    expect(parseClassToAst("bg-position-(--my-bg-pos)", ctx)).toEqual([
      { type: "decl", prop: "background-position", value: "var(--my-bg-pos)" },
    ]);
  });

  // background-repeat
  it("bg-repeat → background-repeat: repeat", () => {
    expect(parseClassToAst("bg-repeat", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "repeat" },
    ]);
  });
  it("bg-no-repeat → background-repeat: no-repeat", () => {
    expect(parseClassToAst("bg-no-repeat", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "no-repeat" },
    ]);
  });
  it("bg-repeat-x → background-repeat: repeat-x", () => {
    expect(parseClassToAst("bg-repeat-x", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "repeat-x" },
    ]);
  });
  it("bg-repeat-y → background-repeat: repeat-y", () => {
    expect(parseClassToAst("bg-repeat-y", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "repeat-y" },
    ]);
  });
  it("bg-repeat-round → background-repeat: round", () => {
    expect(parseClassToAst("bg-repeat-round", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "round" },
    ]);
  });
  it("bg-repeat-space → background-repeat: space", () => {
    expect(parseClassToAst("bg-repeat-space", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "space" },
    ]);
  });

  // background-size
  it("bg-auto → background-size: auto", () => {
    expect(parseClassToAst("bg-auto", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "auto" },
    ]);
  });
  it("bg-cover → background-size: cover", () => {
    expect(parseClassToAst("bg-cover", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "cover" },
    ]);
  });
  it("bg-contain → background-size: contain", () => {
    expect(parseClassToAst("bg-contain", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "contain" },
    ]);
  });
  it("bg-[length:32px_100%] → background-size: 32px 100%", () => {
    expect(parseClassToAst("bg-[length:32px_100%]", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "32px 100%" },
    ]);
  });
  it("bg-size-(--my-bg-size) → background-size: var(--my-bg-size)", () => {
    expect(parseClassToAst("bg-size-(--my-bg-size)", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "var(--my-bg-size)" },
    ]);
  });

  // --- Gradient background-image utilities ---
  it("bg-linear-to-t → background-image: linear-gradient(to top, var(--tw-gradient-stops))", () => {
    expect(parseClassToAst("bg-linear-to-t", ctx)).toEqual([
      {
        type: "decl",
        prop: "--tw-gradient-position",
        value: "to top",
      },
      {
        type: "rule",
        selector: "@supports (background-image: linear-gradient(in lab, red, red))",
        nodes: [
          { type: "decl", prop: "--tw-gradient-position", value: "to top in oklab" },
        ],
      },
      {
        type: "decl",
        prop: "background-image",
        value: "linear-gradient(to top, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-linear-to-br → background-image: linear-gradient(to bottom right, var(--tw-gradient-stops))", () => {
    expect(parseClassToAst("bg-linear-to-br", ctx)).toMatchObject([
      {
        type: "decl",
        prop: "--tw-gradient-position",
        value: "to bottom right",
      },
      {
        type: "rule",
        selector: "@supports (background-image: linear-gradient(in lab, red, red))",
        nodes: [
          { type: "decl", prop: "--tw-gradient-position", value: "to bottom right in oklab" },
        ],
      },
      {
        type: "decl",
        prop: "background-image",
        value: "linear-gradient(to bottom right, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-linear-45 → background-image: linear-gradient(45deg in oklab, var(--tw-gradient-stops))", () => {
    expect(parseClassToAst("bg-linear-45", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "linear-gradient(45deg in oklab, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-linear-[25deg,red_5%,yellow_60%] → background-image: linear-gradient(var(--tw-gradient-stops, 25deg,red 5%,yellow 60%))", () => {
    expect(parseClassToAst("bg-linear-[25deg,red_5%,yellow_60%]", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value:
          "linear-gradient(var(--tw-gradient-stops, 25deg,red 5%,yellow 60%))",
      },
    ]);
  });
  it("bg-linear-(--my-gradient) → background-image: linear-gradient(var(--tw-gradient-stops, var(--my-gradient)))", () => {
    expect(parseClassToAst("bg-linear-(--my-gradient)", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "linear-gradient(var(--tw-gradient-stops, var(--my-gradient)))",
      },
    ]);
  });

  // Radial gradient
  it("bg-radial → background-image: radial-gradient(in oklab, var(--tw-gradient-stops))", () => {
    expect(parseClassToAst("bg-radial", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "radial-gradient(in oklab, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-radial-[at_50%_75%] → background-image: radial-gradient(var(--tw-gradient-stops, at 50% 75%))", () => {
    expect(parseClassToAst("bg-radial-[at_50%_75%]", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "radial-gradient(var(--tw-gradient-stops, at 50% 75%))",
      },
    ]);
  });
  it("bg-radial-(--my-gradient) → background-image: radial-gradient(var(--tw-gradient-stops, var(--my-gradient)))", () => {
    expect(parseClassToAst("bg-radial-(--my-gradient)", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "radial-gradient(var(--tw-gradient-stops, var(--my-gradient)))",
      },
    ]);
  });

  // Conic gradient
  it("bg-conic → background-image: conic-gradient(from 0deg in oklab, var(--tw-gradient-stops))", () => {
    expect(parseClassToAst("bg-conic", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "conic-gradient(from 0deg in oklab, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-conic-180 → background-image: conic-gradient(from 180deg in oklab, var(--tw-gradient-stops))", () => {
    expect(parseClassToAst("bg-conic-180", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "conic-gradient(from 180deg in oklab, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-conic-[at_50%_75%] → background-image: at 50% 75%", () => {
    expect(parseClassToAst("bg-conic-[at_50%_75%]", ctx)).toEqual([
      { type: "decl", prop: "background-image", value: "at 50% 75%" },
    ]);
  });
  it("bg-conic-(--my-gradient) → background-image: var(--my-gradient)", () => {
    expect(parseClassToAst("bg-conic-(--my-gradient)", ctx)).toEqual([
      { type: "decl", prop: "background-image", value: "var(--my-gradient)" },
    ]);
  });

  // Gradient stops
  it("from-red-500 → --tw-gradient-from: red-500", () => {
    const result = parseClassToAst("from-red-500", ctx);
    
    // Remove source properties for comparison
    const cleanResult = result.map(node => {
      if (node.type === 'at-root') {
        return {
          ...node,
          nodes: node.nodes.map(n => {
            if (n.type === 'at-rule') {
              return {
                ...n,
                nodes: n.nodes.map(d => {
                  if (d.type === 'decl') {
                    const { source, ...rest } = d;
                    return rest;
                  }
                  return d;
                })
              };
            }
            return n;
          })
        };
      }
      if (node.type === 'decl') {
        const { source, ...rest } = node;
        return rest;
      }
      return node;
    });
    
    expect(cleanResult).toEqual([
      {
        type: "at-root",
        nodes: [
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-from",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-via",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-to",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-stops",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-via-stops",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "0%",
              },
            ],
            params: "--tw-gradient-from-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "50%",
              },
            ],
            params: "--tw-gradient-via-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "100%",
              },
            ],
            params: "--tw-gradient-to-position",
            type: "at-rule",
          },
        ],
      },
      {
        prop: "--tw-gradient-from",
        type: "decl",
        value: "red",
      },
      {
        prop: "--tw-gradient-stops",
        type: "decl",
        value: "var(--tw-gradient-via-stops, var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))",
      },
    ]);
  });
  it("from-[rgba(0,0,0,0.5)] → --tw-gradient-from: rgba(0,0,0,0.5)", () => {
    expect(parseClassToAst("from-[rgba(0,0,0,0.5)]", ctx)).toEqual([
      {
        type: "at-root",
        nodes: [
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-from",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-via",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-to",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-stops",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-via-stops",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "0%",
              },
            ],
            params: "--tw-gradient-from-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "50%",
              },
            ],
            params: "--tw-gradient-via-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "100%",
              },
            ],
            params: "--tw-gradient-to-position",
            type: "at-rule",
          },
        ],
      },
      {
        prop: "--tw-gradient-from",
        type: "decl",
        value: "rgba(0,0,0,0.5)",
      },
      {
        prop: "--tw-gradient-stops",
        type: "decl",
        value: "var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))",
      },
    ]);
  });
  it("from-(--my-color) → --tw-gradient-from: var(--my-color)", () => {
    expect(parseClassToAst("from-(--my-color)", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-from", value: "var(--my-color)" },
    ]);
  });
  it("from-position-10% → --tw-gradient-from-position: 10%", () => {
    expect(parseClassToAst("from-position-10%", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-from-position", value: "10%" },
    ]);
  });
  it("from-(--my-pos) → --tw-gradient-from: var(--my-pos)", () => {
    expect(parseClassToAst("from-(--my-pos)", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-from", value: "var(--my-pos)" },
    ]);
  });
  it("via-blue-500 → --tw-gradient-via: blue-500", () => {
    expect(parseClassToAst("via-blue-500", ctx)).toEqual([
      {
        type: "at-root",
        nodes: [
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-from",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-via",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-to",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-stops",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-via-stops",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "0%",
              },
            ],
            params: "--tw-gradient-from-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "50%",
              },
            ],
            params: "--tw-gradient-via-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "100%",
              },
            ],
            params: "--tw-gradient-to-position",
            type: "at-rule",
          },
        ],
      },
      {
        prop: "--tw-gradient-via",
        type: "decl",
        value: "blue-500",
      },
      {
        prop: "--tw-gradient-stops",
        type: "decl",
        value: "var(--tw-gradient-via-stops, var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))",
      },
    ]);
  });
  it("via-position-30% → --tw-gradient-via-position: 30%", () => {
    expect(parseClassToAst("via-position-30%", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-via-position", value: "30%" },
    ]);
  });
  it("to-green-700 → --tw-gradient-to: green-700", () => {
    expect(parseClassToAst("to-green-700", ctx)).toEqual([
      {
        type: "at-root",
        nodes: [
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-from",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-via",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<color>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "#0000",
              },
            ],
            params: "--tw-gradient-to",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-stops",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"*"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
            ],
            params: "--tw-gradient-via-stops",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "0%",
              },
            ],
            params: "--tw-gradient-from-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "50%",
              },
            ],
            params: "--tw-gradient-via-position",
            type: "at-rule",
          },
          {
            name: "property",
            nodes: [
              {
                prop: "syntax",
                type: "decl",
                value: '"<length-percentage>"',
              },
              {
                prop: "inherits",
                type: "decl",
                value: "false",
              },
              {
                prop: "initial-value",
                type: "decl",
                value: "100%",
              },
            ],
            params: "--tw-gradient-to-position",
            type: "at-rule",
          },
        ],
      },
      {
        prop: "--tw-gradient-to",
        type: "decl",
        value: "green-700",
      },
      {
        prop: "--tw-gradient-stops",
        type: "decl",
        value: "var(--tw-gradient-via-stops, var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))",
      },
    ]);
  });
  it("to-position-90% → --tw-gradient-to-position: 90%", () => {
    expect(parseClassToAst("to-position-90%", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-to-position", value: "90%" },
    ]);
  });
});
