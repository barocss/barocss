import { describe, it, expect } from "vitest";
import { bg } from "../../../src/converter/cssmaps/bg";
import { bgGradient, bgGradientTo } from "../../../src/converter/cssmaps/etc";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";
import type { ParsedClassToken } from "../../../src/parser/utils";
import { bgBlend } from "../../../src/converter/cssmaps/bg-blend";
import { bgClip } from "../../../src/converter/cssmaps/bg-clip";
import { bgConic } from "../../../src/converter/cssmaps/bg-conic";
import { bgFixed } from "../../../src/converter/cssmaps/bg-fixed";
import { bgLinear } from "../../../src/converter/cssmaps/bg-linear";
import { bgLocal } from "../../../src/converter/cssmaps/bg-local";
import { bgNoRepeat } from "../../../src/converter/cssmaps/bg-no-repeat";
import { bgOrigin } from "../../../src/converter/cssmaps/bg-origin";
import { bgPosition } from "../../../src/converter/cssmaps/bg-position";
import { bgRadial } from "../../../src/converter/cssmaps/bg-radial";
import { bgRepeat } from "../../../src/converter/cssmaps/bg-repeat";
import { bgScroll } from "../../../src/converter/cssmaps/bg-scroll";
import { bgSize } from "../../../src/converter/cssmaps/bg-size";

const mockTheme = {
  colors: {
    red: {
      "500": "#f56565",
    },
    blue: {
      "100": "#bfdbfe",
    },
  },
};
const mockContext: CssmaContext = {
  theme: (...args) => themeGetter(mockTheme, ...args),
  config: () => undefined,
  plugins: [],
};

describe("bg (background-color, background-image, etc)", () => {
  it("should convert bg-red-500", () => {
    const token = { prefix: "bg", value: "red-500" } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: "#f56565" });
  });
  it("should convert bg-blue-100", () => {
    const token = { prefix: "bg", value: "blue-100" } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: "#bfdbfe" });
  });
  it("should handle arbitrary hex", () => {
    const token = {
      prefix: "bg",
      arbitrary: true,
      arbitraryValue: "#123456",
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: "#123456" });
  });
  it("should handle arbitrary oklch (as backgroundColor)", () => {
    const token = {
      prefix: "bg",
      arbitrary: true,
      arbitraryValue: "oklch(0.5 0.2 30)",
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({
      backgroundColor: "oklch(0.5 0.2 30)",
    });
  });
  it("should handle arbitrary url (as backgroundImage)", () => {
    const token = {
      prefix: "bg",
      arbitrary: true,
      arbitraryValue: "url('/img/foo.png')",
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({
      backgroundImage: "url('/img/foo.png')",
    });
  });
  it("should return undefined for arbitrary non-color non-url", () => {
    const token = {
      prefix: "bg",
      arbitrary: true,
      arbitraryValue: "foo",
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toBeUndefined();
  });
  it("should handle bg-none", () => {
    const token = { prefix: "bg-none" } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundImage: "none" });
  });
  it("should handle bg-none with important", () => {
    const token = { prefix: "bg-none", important: true } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({
      backgroundImage: "none !important",
    });
  });
  it("should handle customProperty", () => {
    const token = {
      prefix: "bg",
      customProperty: true,
      value: "--my-bg",
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: "var(--my-bg)" });
  });
  it("should handle customProperty with important", () => {
    const token = {
      prefix: "bg",
      customProperty: true,
      value: "--my-bg",
      important: true,
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({
      backgroundColor: "var(--my-bg) !important",
    });
  });
  it("should handle !important", () => {
    const token = {
      prefix: "bg",
      value: "red-500",
      important: true,
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({
      backgroundColor: "#f56565 !important",
    });
  });
  it("should handle negative (should be ignored)", () => {
    const token = {
      prefix: "bg",
      value: "red-500",
      negative: true,
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: "#f56565" });
  });
  it("should handle missing value (unknown)", () => {
    const token = { prefix: "bg" } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: undefined });
  });
  it("should handle unknown value (not in theme)", () => {
    const token = { prefix: "bg", value: "not-in-theme" } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: "not.in.theme" });
  });
});

describe("bg prefix별 변환 함수", () => {
  it("should handle bg-blend-multiply", () => {
    const token = { prefix: "bg-blend", value: "multiply" } as ParsedClassToken;
    expect(bgBlend(token)).toEqual({ backgroundBlendMode: "multiply" });
  });
  it("should handle bg-clip-border", () => {
    const token = { prefix: "bg-clip", value: "border" } as ParsedClassToken;
    expect(bgClip(token)).toEqual({ backgroundClip: "border-box" });
  });
  it("should handle bg-origin-padding", () => {
    const token = { prefix: "bg-origin", value: "padding" } as ParsedClassToken;
    expect(bgOrigin(token)).toEqual({ backgroundOrigin: "padding-box" });
  });
  it("should handle bg-repeat-x", () => {
    const token = { prefix: "bg-repeat", value: "x" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "repeat-x" });
  });
  it("should handle bg-no-repeat", () => {
    expect(bgNoRepeat()).toEqual({ backgroundRepeat: "no-repeat" });
  });
  it("should handle bg-size-contain", () => {
    const token = { prefix: "bg-size", value: "contain" } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "contain" });
  });
 
  it("should handle bg-position-top", () => {
    const token = { prefix: "bg-position", value: "top" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "top" });
  });
 
  it("should handle bg-fixed", () => {
    expect(bgFixed()).toEqual({ backgroundAttachment: "fixed" });
  });
  it("should handle bg-local", () => {
    expect(bgLocal()).toEqual({ backgroundAttachment: "local" });
  });
  it("should handle bg-scroll", () => {
    expect(bgScroll()).toEqual({ backgroundAttachment: "scroll" });
  });
});

describe("bg etc", () => {
  it("should handle bg-blend-luminosity", () => {
    const token = {
      prefix: "bg-blend",
      value: "luminosity",
    } as ParsedClassToken;
    expect(bgBlend(token)).toEqual({ backgroundBlendMode: "luminosity" });
  });
  it("should handle bg-clip-text", () => {
    const token = { prefix: "bg-clip", value: "text" } as ParsedClassToken;
    expect(bgClip(token)).toEqual({ backgroundClip: "text" });
  });
  it("should handle bg-repeat-y", () => {
    const token = { prefix: "bg-repeat", value: "y" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "repeat-y" });
  });
  it("should handle bg-size-[50px_100px]", () => {
    const token = {
      prefix: "bg-size",
      value: "50px 100px",
      arbitrary: true,
      arbitraryValue: "50px 100px",
    } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "50px 100px" });
  });
});

describe("bg-repeat variations", () => {
  it("should handle bg-repeat", () => {
    const token = { prefix: "bg-repeat", value: "" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "repeat" });
  });
  it("should handle bg-repeat-x", () => {
    const token = { prefix: "bg-repeat", value: "x" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "repeat-x" });
  });
  it("should handle bg-repeat-y", () => {
    const token = { prefix: "bg-repeat", value: "y" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "repeat-y" });
  });
  it("should handle bg-no-repeat", () => {
    expect(bgNoRepeat()).toEqual({ backgroundRepeat: "no-repeat" });
  });
});

describe("bg-size variations", () => {
  it("should handle bg-size-auto", () => {
    const token = { prefix: "bg-size", value: "auto" } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "auto" });
  });
  it("should handle bg-size-cover", () => {
    const token = { prefix: "bg-size", value: "cover" } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "cover" });
  });
  it("should handle bg-size-contain", () => {
    const token = { prefix: "bg-size", value: "contain" } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "contain" });
  });
  it("should handle bg-size-[50px_100px] (arbitrary)", () => {
    const token = {
      prefix: "bg-size",
      value: "50px 100px",
      arbitrary: true,
      arbitraryValue: "50px 100px",
    } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "50px 100px" });
  });
});

describe("bg-position variations", () => {
  it("should handle bg-top", () => {
    const token = { prefix: "bg", value: "top" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "top" });
  });
  it("should handle bg-bottom", () => {
    const token = {
      prefix: "bg",
      value: "bottom",
    } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "bottom" });
  });
  it("should handle bg-center", () => {
    const token = {
      prefix: "bg",
      value: "center",
    } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "center" });
  });
  it("should handle bg-left", () => {
    const token = { prefix: "bg", value: "left" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "left" });
  });
  it("should handle bg-top-left", () => {
    const token = {
      prefix: "bg",
      value: "top-left",
    } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "top left" });
  });
  it("should handle bg-right", () => {
    const token = { prefix: "bg", value: "right" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "right" });
  });
  it("should handle bg-position-[10px_20px] (arbitrary)", () => {
    const token = {
      prefix: "bg-position",
      value: "10px 20px",
      arbitrary: true,
      arbitraryValue: "10px 20px",
    } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "10px 20px" });
  });
});

describe("bg-attachment variations", () => {
  it("should handle bg-fixed", () => {
    expect(bgFixed()).toEqual({ backgroundAttachment: "fixed" });
  });
  it("should handle bg-local", () => {
    expect(bgLocal()).toEqual({ backgroundAttachment: "local" });
  });
  it("should handle bg-scroll", () => {
    expect(bgScroll()).toEqual({ backgroundAttachment: "scroll" });
  });
});

describe("bg-blend variations", () => {
  const blendModes = [
    "normal",
    "multiply",
    "screen",
    "overlay",
    "darken",
    "lighten",
    "color-dodge",
    "color-burn",
    "hard-light",
    "soft-light",
    "difference",
    "exclusion",
    "hue",
    "saturation",
    "color",
    "luminosity",
  ];
  for (const mode of blendModes) {
    it(`should handle bg-blend-${mode}`, () => {
      const token = { prefix: "bg-blend", value: mode } as ParsedClassToken;
      expect(bgBlend(token)).toEqual({ backgroundBlendMode: mode });
    });
  }
});

describe("bg-clip variations", () => {
  const clips = ["border", "padding", "content", "text"];
  for (const clip of clips) {
    it(`should handle bg-clip-${clip}`, () => {
      const token = { prefix: "bg-clip", value: clip } as ParsedClassToken;
      const expected =
        clip === "text"
          ? { backgroundClip: "text" }
          : { backgroundClip: `${clip}-box` };
      expect(bgClip(token)).toEqual(expected);
    });
  }
});

describe("bg-origin variations", () => {
  const origins = ["border", "padding", "content"];
  for (const origin of origins) {
    it(`should handle bg-origin-${origin}`, () => {
      const token = { prefix: "bg-origin", value: origin } as ParsedClassToken;
      expect(bgOrigin(token)).toEqual({ backgroundOrigin: `${origin}-box` });
    });
  }
});

describe("bg-gradient variations", () => {
  it("should handle bg-gradient", () => {
    const token = {
      prefix: "bg-gradient",
      value: "linear-gradient(red, blue)",
    } as ParsedClassToken;
    expect(bgGradient(token)).toEqual({
      backgroundImage: "linear-gradient(red, blue)",
    });
  });
  it("should handle bg-gradient-to-r", () => {
    const token = { prefix: "bg-gradient-to", value: "r" } as ParsedClassToken;
    expect(bgGradientTo(token)).toEqual({ backgroundImage: "r" });
  });
  it("should handle bg-linear", () => {
    const token = { prefix: "bg-linear", value: "to-r" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({
      backgroundImage: "linear-gradient(to right, var(--tw-gradient-stops))",
    });
  });
  it("should handle bg-radial", () => {
    const token = {
      prefix: "bg-radial",
      value: "",
    } as ParsedClassToken;
    expect(bgRadial(token)).toEqual({
      backgroundImage: "radial-gradient(in oklab, var(--tw-gradient-stops))",
    });
  });
  it("should handle bg-gradient-to-tl", () => {
    const token = { prefix: "bg-gradient-to", value: "tl" } as ParsedClassToken;
    expect(bgGradientTo(token)).toEqual({ backgroundImage: "tl" });
  });
  it("should handle bg-gradient-to-b", () => {
    const token = { prefix: "bg-gradient-to", value: "b" } as ParsedClassToken;
    expect(bgGradientTo(token)).toEqual({ backgroundImage: "b" });
  });
  it("should handle bg-linear-[25deg,red_5%,yellow_60%,lime_90%,teal] (arbitrary)", () => {
    const token = {
      prefix: "bg-linear",
      arbitrary: true,
      arbitraryValue: "25deg,red 5%,yellow 60%,lime 90%,teal",
    } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({
      "--linear-gradient": "25deg,red 5%,yellow 60%,lime 90%,teal",
      backgroundImage: "linear-gradient(var(--tw-gradient-stops, var(--linear-gradient)))",
    });
  });
  it("should handle bg-radial-[ellipse_at_center,_red,_blue] (arbitrary)", () => {
    const token = {
      prefix: "bg-radial",
      arbitrary: true,
      arbitraryValue: "ellipse at center, red, blue",
    } as ParsedClassToken;
    expect(bgRadial(token)).toEqual({
      "--radial-gradient": "ellipse at center, red, blue",
      backgroundImage: "radial-gradient(var(--tw-gradient-stops, var(--radial-gradient)))",
    });
  });
  it("should handle bg-conic-[from_180deg_at_50%_50%,_red,_blue] (arbitrary)", () => {
    const token = {
      prefix: "bg-conic",
      arbitrary: true,
      arbitraryValue: "from 180deg at 50% 50%, red, blue",
    } as ParsedClassToken;
    expect(bgConic(token)).toEqual({
      "--conic-gradient": "from 180deg at 50% 50%, red, blue",
      backgroundImage: "conic-gradient(var(--tw-gradient-stops, var(--conic-gradient)))",
    });
  });
});

describe("bg + arbitrary, important, negative, unknown", () => {
  it("should handle bg-[url('/img/foo.png')] (arbitrary)", () => {
    const token = {
      prefix: "bg",
      arbitrary: true,
      arbitraryValue: "url('/img/foo.png')",
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({
      backgroundImage: "url('/img/foo.png')",
    });
  });
  it("should handle bg-[#123456] (arbitrary)", () => {
    const token = {
      prefix: "bg",
      arbitrary: true,
      arbitraryValue: "#123456",
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: "#123456" });
  });
  it("should handle bg-[oklch(0.5_0.2_30)] (arbitrary)", () => {
    const token = {
      prefix: "bg",
      arbitrary: true,
      arbitraryValue: "oklch(0.5 0.2 30)",
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({
      backgroundColor: "oklch(0.5 0.2 30)",
    });
  });
  it("should handle bg-red-500! (!important)", () => {
    const token = {
      prefix: "bg",
      value: "red-500",
      important: true,
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({
      backgroundColor: "#f56565 !important",
    });
  });
  it("should handle -bg-blue-100 (negative, should ignore)", () => {
    const token = {
      prefix: "bg",
      value: "blue-100",
      negative: true,
    } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: "#bfdbfe" });
  });
  it("should handle missing value (unknown)", () => {
    const token = { prefix: "bg" } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundColor: undefined });
  });
  it("should handle bg-none", () => {
    const token = { prefix: "bg-none" } as ParsedClassToken;
    expect(bg(token, mockContext)).toEqual({ backgroundImage: "none" });
  });
});
