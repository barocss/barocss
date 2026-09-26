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
    expect(parseClassToAst("bg-fixed", ctx)).toMatchObject([
      { type: "decl", prop: "background-attachment", value: "fixed" },
    ]);
  });
  it("bg-local → background-attachment: local", () => {
    expect(parseClassToAst("bg-local", ctx)).toMatchObject([
      { type: "decl", prop: "background-attachment", value: "local" },
    ]);
  });
  it("bg-scroll → background-attachment: scroll", () => {
    expect(parseClassToAst("bg-scroll", ctx)).toMatchObject([
      { type: "decl", prop: "background-attachment", value: "scroll" },
    ]);
  });

  // background-clip
  it("bg-clip-border → background-clip: border-box", () => {
    expect(parseClassToAst("bg-clip-border", ctx)).toMatchObject([
      { type: "decl", prop: "background-clip", value: "border-box" },
    ]);
  });
  it("bg-clip-padding → background-clip: padding-box", () => {
    expect(parseClassToAst("bg-clip-padding", ctx)).toMatchObject([
      { type: "decl", prop: "background-clip", value: "padding-box" },
    ]);
  });
  it("bg-clip-content → background-clip: content-box", () => {
    expect(parseClassToAst("bg-clip-content", ctx)).toMatchObject([
      { type: "decl", prop: "background-clip", value: "content-box" },
    ]);
  });
  it("bg-clip-text → background-clip: text", () => {
    expect(parseClassToAst("bg-clip-text", ctx)).toMatchObject([
      { type: "decl", prop: "background-clip", value: "text" },
    ]);
  });

  // background-color
  it("bg-inherit → background-color: inherit", () => {
    expect(parseClassToAst("bg-inherit", ctx)).toMatchObject([
      { type: "decl", prop: "background-color", value: "inherit" },
    ]);
  });
  it("bg-current → background-color: currentColor", () => {
    expect(parseClassToAst("bg-current", ctx)).toMatchObject([
      { type: "decl", prop: "background-color", value: "currentColor" },
    ]);
  });
  it("bg-transparent → background-color: transparent", () => {
    expect(parseClassToAst("bg-transparent", ctx)).toMatchObject([
      { type: "decl", prop: "background-color", value: "transparent" },
    ]);
  });
  it("bg-red-500/75 → background-color: color-mix(in lab, red-500 75%, transparent)", () => {
    expect(parseClassToAst("bg-red-500/75", ctx)).toMatchObject([
      { type: "decl", prop: "background-color", value: "color-mix(in srgb, red 75%, transparent)" },
      {
        type: "at-rule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [{ type: "decl", prop: "background-color", value: "color-mix(in oklab, var(--color-red-500) 75%, transparent)" }],
      },
    ]);
  });
  it("bg-[#bada55] → background-color: #bada55", () => {
    expect(parseClassToAst("bg-[#bada55]", ctx)).toMatchObject([
      { type: "decl", prop: "background-color", value: "#bada55" },
    ]);
  });

  // background-image
  it("bg-none → background-image: none", () => {
    expect(parseClassToAst("bg-none", ctx)).toMatchObject([
      { type: "decl", prop: "background-image", value: "none" },
    ]);
  });
  it("bg-[url(/img/bg.png)] → background-image: url(/img/bg.png)", () => {
    expect(parseClassToAst("bg-[url(/img/bg.png)]", ctx)).toMatchObject([
      { type: "decl", prop: "background-image", value: "url(/img/bg.png)" },
    ]);
  });

  // background-origin
  it("bg-origin-border → background-origin: border-box", () => {
    expect(parseClassToAst("bg-origin-border", ctx)).toMatchObject([
      { type: "decl", prop: "background-origin", value: "border-box" },
    ]);
  });
  it("bg-origin-padding → background-origin: padding-box", () => {
    expect(parseClassToAst("bg-origin-padding", ctx)).toMatchObject([
      { type: "decl", prop: "background-origin", value: "padding-box" },
    ]);
  });
  it("bg-origin-content → background-origin: content-box", () => {
    expect(parseClassToAst("bg-origin-content", ctx)).toMatchObject([
      { type: "decl", prop: "background-origin", value: "content-box" },
    ]);
  });

  // background-position
  it("bg-bottom → background-position: bottom", () => {
    expect(parseClassToAst("bg-bottom", ctx)).toMatchObject([
      { type: "decl", prop: "background-position", value: "bottom" },
    ]);
  });
  it("bg-center → background-position: center", () => {
    expect(parseClassToAst("bg-center", ctx)).toMatchObject([
      { type: "decl", prop: "background-position", value: "center" },
    ]);
  });
  it("bg-left → background-position: left", () => {
    expect(parseClassToAst("bg-left", ctx)).toMatchObject([
      { type: "decl", prop: "background-position", value: "left" },
    ]);
  });
  it("bg-position-[right_20px_top_10px] → background-position: right 20px top 10px", () => {
    expect(parseClassToAst("bg-position-[right_20px_top_10px]", ctx)).toMatchObject([
      {
        type: "decl",
        prop: "background-position",
        value: "right 20px top 10px",
      },
    ]);
  });
  it("bg-position-(--my-bg-pos) → background-position: var(--my-bg-pos)", () => {
    expect(parseClassToAst("bg-position-(--my-bg-pos)", ctx)).toMatchObject([
      { type: "decl", prop: "background-position", value: "var(--my-bg-pos)" },
    ]);
  });

  // background-repeat
  it("bg-repeat → background-repeat: repeat", () => {
    expect(parseClassToAst("bg-repeat", ctx)).toMatchObject([
      { type: "decl", prop: "background-repeat", value: "repeat" },
    ]);
  });
  it("bg-no-repeat → background-repeat: no-repeat", () => {
    expect(parseClassToAst("bg-no-repeat", ctx)).toMatchObject([
      { type: "decl", prop: "background-repeat", value: "no-repeat" },
    ]);
  });
  it("bg-repeat-x → background-repeat: repeat-x", () => {
    expect(parseClassToAst("bg-repeat-x", ctx)).toMatchObject([
      { type: "decl", prop: "background-repeat", value: "repeat-x" },
    ]);
  });
  it("bg-repeat-y → background-repeat: repeat-y", () => {
    expect(parseClassToAst("bg-repeat-y", ctx)).toMatchObject([
      { type: "decl", prop: "background-repeat", value: "repeat-y" },
    ]);
  });
  it("bg-repeat-round → background-repeat: round", () => {
    expect(parseClassToAst("bg-repeat-round", ctx)).toMatchObject([
      { type: "decl", prop: "background-repeat", value: "round" },
    ]);
  });
  it("bg-repeat-space → background-repeat: space", () => {
    expect(parseClassToAst("bg-repeat-space", ctx)).toMatchObject([
      { type: "decl", prop: "background-repeat", value: "space" },
    ]);
  });

  // background-size
  it("bg-auto → background-size: auto", () => {
    expect(parseClassToAst("bg-auto", ctx)).toMatchObject([
      { type: "decl", prop: "background-size", value: "auto" },
    ]);
  });
  it("bg-cover → background-size: cover", () => {
    expect(parseClassToAst("bg-cover", ctx)).toMatchObject([
      { type: "decl", prop: "background-size", value: "cover" },
    ]);
  });
  it("bg-contain → background-size: contain", () => {
    expect(parseClassToAst("bg-contain", ctx)).toMatchObject([
      { type: "decl", prop: "background-size", value: "contain" },
    ]);
  });
  it("bg-[length:32px_100%] → background-size: 32px 100%", () => {
    expect(parseClassToAst("bg-[length:32px_100%]", ctx)).toMatchObject([
      { type: "decl", prop: "background-size", value: "32px 100%" },
    ]);
  });
  it("bg-size-(--my-bg-size) → background-size: var(--my-bg-size)", () => {
    expect(parseClassToAst("bg-size-(--my-bg-size)", ctx)).toMatchObject([
      { type: "decl", prop: "background-size", value: "var(--my-bg-size)" },
    ]);
  });

  // --- Gradient background-image utilities ---
  // Tailwind 4 structure: position var (+ oklab under @supports), stops carry the position
  const decls = (cls: string) => (parseClassToAst(cls, ctx) ?? []).filter((n: any) => n.type === "decl").map((n: any) => [n.prop, n.value]);
  const supports = (cls: string) => (parseClassToAst(cls, ctx) ?? []).filter((n: any) => n.type === "at-rule" && n.name === "supports");
  it.each([["bg-linear-to-t", "to top"], ["bg-linear-to-br", "to bottom right"], ["bg-linear-45", "45deg"]])("%s → --baro-gradient-position: %s", (cls, pos) => {
    expect(decls(cls)).toEqual([["--baro-gradient-position", pos], ["background-image", "linear-gradient(var(--baro-gradient-stops))"]]);
    expect(supports(cls)).toMatchObject([{ params: "(background-image: linear-gradient(in lab, red, red))", nodes: [{ prop: "--baro-gradient-position", value: `${pos} in oklab` }] }]);
  });
  it("bg-gradient-to-br (legacy) → oklab position, no @supports", () => {
    expect(decls("bg-gradient-to-br")).toEqual([["--baro-gradient-position", "to bottom right in oklab"], ["background-image", "linear-gradient(var(--baro-gradient-stops))"]]);
    expect(supports("bg-gradient-to-br")).toEqual([]);
  });
  it("bg-linear-[25deg,red_5%,yellow_60%] → background-image: linear-gradient(var(--baro-gradient-stops, 25deg,red 5%,yellow 60%))", () => {
    expect(parseClassToAst("bg-linear-[25deg,red_5%,yellow_60%]", ctx)).toMatchObject([
      {
        type: "decl",
        prop: "background-image",
        value:
          "linear-gradient(var(--baro-gradient-stops, 25deg,red 5%,yellow 60%))",
      },
    ]);
  });
  it("bg-linear-(--my-gradient) → background-image: linear-gradient(var(--baro-gradient-stops, var(--my-gradient)))", () => {
    expect(parseClassToAst("bg-linear-(--my-gradient)", ctx)).toMatchObject([
      {
        type: "decl",
        prop: "background-image",
        value: "linear-gradient(var(--baro-gradient-stops, var(--my-gradient)))",
      },
    ]);
  });

  // Radial / conic gradients: Tailwind 4.1.13 shape (position var + <fn>(var(--baro-gradient-stops)))
  it.each([
    ["bg-radial", "in oklab", "radial-gradient(var(--baro-gradient-stops))"],
    ["bg-radial-[at_50%_75%]", "at 50% 75%", "radial-gradient(var(--baro-gradient-stops,at 50% 75%))"],
    ["bg-radial-(--my-gradient)", "var(--my-gradient)", "radial-gradient(var(--baro-gradient-stops,var(--my-gradient)))"],
    ["bg-conic", "in oklab", "conic-gradient(var(--baro-gradient-stops))"],
    ["bg-conic-180", "from 180deg in oklab", "conic-gradient(var(--baro-gradient-stops))"],
    ["bg-conic-[at_50%_75%]", "at 50% 75%", "conic-gradient(var(--baro-gradient-stops,at 50% 75%))"],
    ["bg-conic-(--my-gradient)", "var(--my-gradient)", "conic-gradient(var(--baro-gradient-stops,var(--my-gradient)))"],
  ])("%s → --baro-gradient-position: %s; background-image: %s", (cls, position, image) => {
    expect(parseClassToAst(cls, ctx)).toMatchObject([
      { type: "decl", prop: "--baro-gradient-position", value: position },
      { type: "decl", prop: "background-image", value: image },
    ]);
  });

  // Gradient stops
  const stops = "var(--baro-gradient-via-stops, var(--baro-gradient-position), var(--baro-gradient-from) var(--baro-gradient-from-position), var(--baro-gradient-to) var(--baro-gradient-to-position))";
  it("from-red-500 → --baro-gradient-from + composed stops", () => {
    expect(parseClassToAst("from-red-500", ctx)?.[0]).toMatchObject({ type: "at-root" });
    expect(decls("from-red-500")).toEqual([["--baro-gradient-from", expect.any(String)], ["--baro-gradient-stops", stops]]);
  });
  it("from-[rgba(0,0,0,0.5)] → --baro-gradient-from: rgba(0,0,0,0.5)", () => {
    expect(decls("from-[rgba(0,0,0,0.5)]")).toEqual([["--baro-gradient-from", "rgba(0,0,0,0.5)"], ["--baro-gradient-stops", stops]]);
  });
  it("from-(--my-color) → --baro-gradient-from: var(--my-color)", () => {
    expect(parseClassToAst("from-(--my-color)", ctx)).toMatchObject([
      { type: "decl", prop: "--baro-gradient-from", value: "var(--my-color)" },
    ]);
  });
  it.each([["from-10%", "from", "10%"], ["from-position-10%", "from", "10%"], ["via-30%", "via", "30%"], ["to-90%", "to", "90%"]])("%s → --baro-gradient-%s-position: %s", (cls, stop, pos) => {
    expect(decls(cls)).toEqual([[`--baro-gradient-${stop}-position`, pos]]);
  });
  it("from-(--my-pos) → --baro-gradient-from: var(--my-pos)", () => {
    expect(parseClassToAst("from-(--my-pos)", ctx)).toMatchObject([
      { type: "decl", prop: "--baro-gradient-from", value: "var(--my-pos)" },
    ]);
  });
  it("via-blue-500 → --baro-gradient-via + via-stops", () => {
    expect(decls("via-blue-500")).toEqual([
      ["--baro-gradient-via", expect.any(String)],
      ["--baro-gradient-via-stops", "var(--baro-gradient-position), var(--baro-gradient-from) var(--baro-gradient-from-position), var(--baro-gradient-via) var(--baro-gradient-via-position), var(--baro-gradient-to) var(--baro-gradient-to-position)"],
      ["--baro-gradient-stops", "var(--baro-gradient-via-stops)"],
    ]);
  });
  it("to-green-700 → --baro-gradient-to + composed stops", () => {
    expect(decls("to-green-700")).toEqual([["--baro-gradient-to", expect.any(String)], ["--baro-gradient-stops", stops]]);
  });
});
