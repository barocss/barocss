import { describe, it, expect } from "vitest";
import "../../src/index";
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({
  theme: {
    colors: {
      red: {
        500: "red",
      },
    },
  },
});

describe("background utilities", () => {
  // background-attachment
  it("bg-fixed → background-attachment: fixed", () => {
    expect(applyClassName("bg-fixed", ctx)).toEqual([
      { type: "decl", prop: "background-attachment", value: "fixed" },
    ]);
  });
  it("bg-local → background-attachment: local", () => {
    expect(applyClassName("bg-local", ctx)).toEqual([
      { type: "decl", prop: "background-attachment", value: "local" },
    ]);
  });
  it("bg-scroll → background-attachment: scroll", () => {
    expect(applyClassName("bg-scroll", ctx)).toEqual([
      { type: "decl", prop: "background-attachment", value: "scroll" },
    ]);
  });

  // background-clip
  it("bg-clip-border → background-clip: border-box", () => {
    expect(applyClassName("bg-clip-border", ctx)).toEqual([
      { type: "decl", prop: "background-clip", value: "border-box" },
    ]);
  });
  it("bg-clip-padding → background-clip: padding-box", () => {
    expect(applyClassName("bg-clip-padding", ctx)).toEqual([
      { type: "decl", prop: "background-clip", value: "padding-box" },
    ]);
  });
  it("bg-clip-content → background-clip: content-box", () => {
    expect(applyClassName("bg-clip-content", ctx)).toEqual([
      { type: "decl", prop: "background-clip", value: "content-box" },
    ]);
  });
  it("bg-clip-text → background-clip: text", () => {
    expect(applyClassName("bg-clip-text", ctx)).toEqual([
      { type: "decl", prop: "background-clip", value: "text" },
    ]);
  });

  // background-color
  it("bg-inherit → background-color: inherit", () => {
    expect(applyClassName("bg-inherit", ctx)).toEqual([
      { type: "decl", prop: "background-color", value: "inherit" },
    ]);
  });
  it("bg-current → background-color: currentColor", () => {
    expect(applyClassName("bg-current", ctx)).toEqual([
      { type: "decl", prop: "background-color", value: "currentColor" },
    ]);
  });
  it("bg-transparent → background-color: transparent", () => {
    expect(applyClassName("bg-transparent", ctx)).toEqual([
      { type: "decl", prop: "background-color", value: "transparent" },
    ]);
  });
  it("bg-red-500/75 → background-color: color-mix(in lab, red-500 75%, transparent)", () => {
    expect(applyClassName("bg-red-500/75", ctx)).toEqual([
      {
        type: "atrule",
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
    ]);
  });
  it("bg-[#bada55] → background-color: #bada55", () => {
    expect(applyClassName("bg-[#bada55]", ctx)).toEqual([
      { type: "decl", prop: "background-color", value: "#bada55" },
    ]);
  });

  // background-image
  it("bg-none → background-image: none", () => {
    expect(applyClassName("bg-none", ctx)).toEqual([
      { type: "decl", prop: "background-image", value: "none" },
    ]);
  });
  it("bg-[url(/img/bg.png)] → background-image: url(/img/bg.png)", () => {
    expect(applyClassName("bg-[url(/img/bg.png)]", ctx)).toEqual([
      { type: "decl", prop: "background-image", value: "url(/img/bg.png)" },
    ]);
  });

  // background-origin
  it("bg-origin-border → background-origin: border-box", () => {
    expect(applyClassName("bg-origin-border", ctx)).toEqual([
      { type: "decl", prop: "background-origin", value: "border-box" },
    ]);
  });
  it("bg-origin-padding → background-origin: padding-box", () => {
    expect(applyClassName("bg-origin-padding", ctx)).toEqual([
      { type: "decl", prop: "background-origin", value: "padding-box" },
    ]);
  });
  it("bg-origin-content → background-origin: content-box", () => {
    expect(applyClassName("bg-origin-content", ctx)).toEqual([
      { type: "decl", prop: "background-origin", value: "content-box" },
    ]);
  });

  // background-position
  it("bg-bottom → background-position: bottom", () => {
    expect(applyClassName("bg-bottom", ctx)).toEqual([
      { type: "decl", prop: "background-position", value: "bottom" },
    ]);
  });
  it("bg-center → background-position: center", () => {
    expect(applyClassName("bg-center", ctx)).toEqual([
      { type: "decl", prop: "background-position", value: "center" },
    ]);
  });
  it("bg-left → background-position: left", () => {
    expect(applyClassName("bg-left", ctx)).toEqual([
      { type: "decl", prop: "background-position", value: "left" },
    ]);
  });
  it("bg-position-[right_20px_top_10px] → background-position: right 20px top 10px", () => {
    expect(applyClassName("bg-position-[right_20px_top_10px]", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-position",
        value: "right 20px top 10px",
      },
    ]);
  });
  it("bg-position-(--my-bg-pos) → background-position: var(--my-bg-pos)", () => {
    expect(applyClassName("bg-position-(--my-bg-pos)", ctx)).toEqual([
      { type: "decl", prop: "background-position", value: "var(--my-bg-pos)" },
    ]);
  });

  // background-repeat
  it("bg-repeat → background-repeat: repeat", () => {
    expect(applyClassName("bg-repeat", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "repeat" },
    ]);
  });
  it("bg-no-repeat → background-repeat: no-repeat", () => {
    expect(applyClassName("bg-no-repeat", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "no-repeat" },
    ]);
  });
  it("bg-repeat-x → background-repeat: repeat-x", () => {
    expect(applyClassName("bg-repeat-x", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "repeat-x" },
    ]);
  });
  it("bg-repeat-y → background-repeat: repeat-y", () => {
    expect(applyClassName("bg-repeat-y", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "repeat-y" },
    ]);
  });
  it("bg-repeat-round → background-repeat: round", () => {
    expect(applyClassName("bg-repeat-round", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "round" },
    ]);
  });
  it("bg-repeat-space → background-repeat: space", () => {
    expect(applyClassName("bg-repeat-space", ctx)).toEqual([
      { type: "decl", prop: "background-repeat", value: "space" },
    ]);
  });

  // background-size
  it("bg-auto → background-size: auto", () => {
    expect(applyClassName("bg-auto", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "auto" },
    ]);
  });
  it("bg-cover → background-size: cover", () => {
    expect(applyClassName("bg-cover", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "cover" },
    ]);
  });
  it("bg-contain → background-size: contain", () => {
    expect(applyClassName("bg-contain", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "contain" },
    ]);
  });
  it("bg-[length:32px_100%] → background-size: 32px 100%", () => {
    expect(applyClassName("bg-[length:32px_100%]", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "32px 100%" },
    ]);
  });
  it("bg-size-(--my-bg-size) → background-size: var(--my-bg-size)", () => {
    expect(applyClassName("bg-size-(--my-bg-size)", ctx)).toEqual([
      { type: "decl", prop: "background-size", value: "var(--my-bg-size)" },
    ]);
  });

  // --- Gradient background-image utilities ---
  it("bg-linear-to-t → background-image: linear-gradient(to top, var(--tw-gradient-stops))", () => {
    expect(applyClassName("bg-linear-to-t", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "linear-gradient(to top, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-linear-to-br → background-image: linear-gradient(to bottom right, var(--tw-gradient-stops))", () => {
    expect(applyClassName("bg-linear-to-br", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "linear-gradient(to bottom right, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-linear-45 → background-image: linear-gradient(45deg in oklab, var(--tw-gradient-stops))", () => {
    expect(applyClassName("bg-linear-45", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "linear-gradient(45deg in oklab, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-linear-[25deg,red_5%,yellow_60%] → background-image: linear-gradient(var(--tw-gradient-stops, 25deg,red 5%,yellow 60%))", () => {
    expect(applyClassName("bg-linear-[25deg,red_5%,yellow_60%]", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value:
          "linear-gradient(var(--tw-gradient-stops, 25deg,red 5%,yellow 60%))",
      },
    ]);
  });
  it("bg-linear-(--my-gradient) → background-image: linear-gradient(var(--tw-gradient-stops, var(--my-gradient)))", () => {
    expect(applyClassName("bg-linear-(--my-gradient)", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "linear-gradient(var(--tw-gradient-stops, var(--my-gradient)))",
      },
    ]);
  });

  // Radial gradient
  it("bg-radial → background-image: radial-gradient(in oklab, var(--tw-gradient-stops))", () => {
    expect(applyClassName("bg-radial", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "radial-gradient(in oklab, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-radial-[at_50%_75%] → background-image: radial-gradient(var(--tw-gradient-stops, at 50% 75%))", () => {
    expect(applyClassName("bg-radial-[at_50%_75%]", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "radial-gradient(var(--tw-gradient-stops, at 50% 75%))",
      },
    ]);
  });
  it("bg-radial-(--my-gradient) → background-image: radial-gradient(var(--tw-gradient-stops, var(--my-gradient)))", () => {
    expect(applyClassName("bg-radial-(--my-gradient)", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "radial-gradient(var(--tw-gradient-stops, var(--my-gradient)))",
      },
    ]);
  });

  // Conic gradient
  it("bg-conic → background-image: conic-gradient(from 0deg in oklab, var(--tw-gradient-stops))", () => {
    expect(applyClassName("bg-conic", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "conic-gradient(from 0deg in oklab, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-conic-180 → background-image: conic-gradient(from 180deg in oklab, var(--tw-gradient-stops))", () => {
    expect(applyClassName("bg-conic-180", ctx)).toEqual([
      {
        type: "decl",
        prop: "background-image",
        value: "conic-gradient(from 180deg in oklab, var(--tw-gradient-stops))",
      },
    ]);
  });
  it("bg-conic-[at_50%_75%] → background-image: at 50% 75%", () => {
    expect(applyClassName("bg-conic-[at_50%_75%]", ctx)).toEqual([
      { type: "decl", prop: "background-image", value: "at 50% 75%" },
    ]);
  });
  it("bg-conic-(--my-gradient) → background-image: var(--my-gradient)", () => {
    expect(applyClassName("bg-conic-(--my-gradient)", ctx)).toEqual([
      { type: "decl", prop: "background-image", value: "var(--my-gradient)" },
    ]);
  });

  // Gradient stops
  it("from-red-500 → --tw-gradient-from: red-500", () => {
    expect(applyClassName("from-red-500", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-from", value: "red" },
    ]);
  });
  it("from-[rgba(0,0,0,0.5)] → --tw-gradient-from: rgba(0,0,0,0.5)", () => {
    expect(applyClassName("from-[rgba(0,0,0,0.5)]", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-from", value: "rgba(0,0,0,0.5)" },
    ]);
  });
  it("from-(--my-color) → --tw-gradient-from: var(--my-color)", () => {
    expect(applyClassName("from-(--my-color)", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-from", value: "var(--my-color)" },
    ]);
  });
  it("from-position-10% → --tw-gradient-from-position: 10%", () => {
    expect(applyClassName("from-position-10%", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-from-position", value: "10%" },
    ]);
  });
  it("from-(--my-pos) → --tw-gradient-from: var(--my-pos)", () => {
    expect(applyClassName("from-(--my-pos)", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-from", value: "var(--my-pos)" },
    ]);
  });
  it("via-blue-500 → --tw-gradient-via: blue-500", () => {
    expect(applyClassName("via-blue-500", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-via", value: "blue-500" },
    ]);
  });
  it("via-position-30% → --tw-gradient-via-position: 30%", () => {
    expect(applyClassName("via-position-30%", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-via-position", value: "30%" },
    ]);
  });
  it("to-green-700 → --tw-gradient-to: green-700", () => {
    expect(applyClassName("to-green-700", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-to", value: "green-700" },
    ]);
  });
  it("to-position-90% → --tw-gradient-to-position: 90%", () => {
    expect(applyClassName("to-position-90%", ctx)).toEqual([
      { type: "decl", prop: "--tw-gradient-to-position", value: "90%" },
    ]);
  });
});
