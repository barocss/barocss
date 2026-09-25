import { describe, it, expect } from "vitest";
import "../../src/presets";
import { generateCss, parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({});
// Declarations only; per-axis scale/translate utilities also carry an at-root @property node.
const decls = (cls: string) => parseClassToAst(cls, ctx).filter((n) => n.type === "decl");

describe("transform ", () => {
  it("transform-none → transform: none", () => {
    expect(parseClassToAst("transform-none", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "none" },
    ]);
  });
  it("transform-gpu \u2192 transform: translateZ(0) var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("transform-gpu")).toEqual([
      { type: "decl", prop: "transform", value: "translateZ(0) var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("transform-cpu \u2192 transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("transform-cpu")).toEqual([
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("transform-(--my-transform) → transform: var(--my-transform)", () => {
    expect(parseClassToAst("transform-(--my-transform)", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "var(--my-transform)" },
    ]);
  });
  it("transform-[matrix(1,2,3,4,5,6)] → transform: matrix(1,2,3,4,5,6)", () => {
    expect(parseClassToAst("transform-[matrix(1,2,3,4,5,6)]", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "matrix(1,2,3,4,5,6)" },
    ]);
  });
});

describe("transform utilities", () => {
  it("backface-hidden → backface-visibility: hidden", () => {
    expect(parseClassToAst("backface-hidden", ctx)).toMatchObject([
      { type: "decl", prop: "backface-visibility", value: "hidden" },
    ]);
  });
  it("backface-visible → backface-visibility: visible", () => {
    expect(parseClassToAst("backface-visible", ctx)).toMatchObject([
      { type: "decl", prop: "backface-visibility", value: "visible" },
    ]);
  });
});

describe("perspective utilities", () => {
  it("perspective-dramatic → perspective: var(--perspective-dramatic)", () => {
    expect(parseClassToAst("perspective-dramatic", ctx)).toMatchObject([
      { type: "decl", prop: "perspective", value: "var(--perspective-dramatic)" },
    ]);
  });
  it("perspective-near → perspective: var(--perspective-near)", () => {
    expect(parseClassToAst("perspective-near", ctx)).toMatchObject([
      { type: "decl", prop: "perspective", value: "var(--perspective-near)" },
    ]);
  });
  it("perspective-normal → perspective: var(--perspective-normal)", () => {
    expect(parseClassToAst("perspective-normal", ctx)).toMatchObject([
      { type: "decl", prop: "perspective", value: "var(--perspective-normal)" },
    ]);
  });
  it("perspective-midrange → perspective: var(--perspective-midrange)", () => {
    expect(parseClassToAst("perspective-midrange", ctx)).toMatchObject([
      { type: "decl", prop: "perspective", value: "var(--perspective-midrange)" },
    ]);
  });
  it("perspective-distant → perspective: var(--perspective-distant)", () => {
    expect(parseClassToAst("perspective-distant", ctx)).toMatchObject([
      { type: "decl", prop: "perspective", value: "var(--perspective-distant)" },
    ]);
  });
  it("perspective-none → perspective: none", () => {
    expect(parseClassToAst("perspective-none", ctx)).toMatchObject([
      { type: "decl", prop: "perspective", value: "none" },
    ]);
  });
  it("perspective-(--my-perspective) → perspective: var(--my-perspective)", () => {
    expect(parseClassToAst("perspective-(--my-perspective)", ctx)).toMatchObject([
      { type: "decl", prop: "perspective", value: "var(--my-perspective)" },
    ]);
  });
  it("perspective-[750px] → perspective: 750px", () => {
    expect(parseClassToAst("perspective-[750px]", ctx)).toMatchObject([
      { type: "decl", prop: "perspective", value: "750px" },
    ]);
  });
});

describe("perspective-origin utilities", () => {
  it("perspective-origin-center → perspective-origin: center", () => {
    expect(parseClassToAst("perspective-origin-center", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "center" },
    ]);
  });
  it("perspective-origin-top → perspective-origin: top", () => {
    expect(parseClassToAst("perspective-origin-top", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "top" },
    ]);
  });
  it("perspective-origin-top-right → perspective-origin: top right", () => {
    expect(parseClassToAst("perspective-origin-top-right", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "top right" },
    ]);
  });
  it("perspective-origin-right → perspective-origin: right", () => {
    expect(parseClassToAst("perspective-origin-right", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "right" },
    ]);
  });
  it("perspective-origin-bottom-right → perspective-origin: bottom right", () => {
    expect(parseClassToAst("perspective-origin-bottom-right", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "bottom right" },
    ]);
  });
  it("perspective-origin-bottom → perspective-origin: bottom", () => {
    expect(parseClassToAst("perspective-origin-bottom", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "bottom" },
    ]);
  });
  it("perspective-origin-bottom-left → perspective-origin: bottom left", () => {
    expect(parseClassToAst("perspective-origin-bottom-left", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "bottom left" },
    ]);
  });
  it("perspective-origin-left → perspective-origin: left", () => {
    expect(parseClassToAst("perspective-origin-left", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "left" },
    ]);
  });
  it("perspective-origin-top-left → perspective-origin: top left", () => {
    expect(parseClassToAst("perspective-origin-top-left", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "top left" },
    ]);
  });
  it("perspective-origin-(--my-origin) → perspective-origin: var(--my-origin)", () => {
    expect(parseClassToAst("perspective-origin-(--my-origin)", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "var(--my-origin)" },
    ]);
  });
  it("perspective-origin-[25%_75%] → perspective-origin: 25% 75%", () => {
    expect(parseClassToAst("perspective-origin-[25%_75%]", ctx)).toMatchObject([
      { type: "decl", prop: "perspective-origin", value: "25% 75%" },
    ]);
  });
});

describe("rotate utilities", () => {
  it("rotate-none → rotate: none", () => {
    expect(parseClassToAst("rotate-none", ctx)).toMatchObject([
      { type: "decl", prop: "rotate", value: "none" },
    ]);
  });
  it("rotate-45 → rotate: 45deg", () => {
    expect(parseClassToAst("rotate-45", ctx)).toMatchObject([
      { type: "decl", prop: "rotate", value: "45deg" },
    ]);
  });
  it("-rotate-30 → rotate: calc(30deg * -1)", () => {
    expect(parseClassToAst("-rotate-30", ctx)).toMatchObject([
      { type: "decl", prop: "rotate", value: "calc(30deg * -1)" },
    ]);
  });
  it("rotate-(--my-rotation) → rotate: var(--my-rotation)", () => {
    expect(parseClassToAst("rotate-(--my-rotation)", ctx)).toMatchObject([
      { type: "decl", prop: "rotate", value: "var(--my-rotation)" },
    ]);
  });
  it("rotate-[3.142rad] → rotate: 3.142rad", () => {
    expect(parseClassToAst("rotate-[3.142rad]", ctx)).toMatchObject([
      { type: "decl", prop: "rotate", value: "3.142rad" },
    ]);
  });

  it("rotate-x-50 \u2192 --baro-rotate-x: rotateX(50deg) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("rotate-x-50")).toEqual([
      { type: "decl", prop: "--baro-rotate-x", value: "rotateX(50deg)" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("-rotate-x-15 \u2192 --baro-rotate-x: rotateX(-15deg) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("-rotate-x-15")).toEqual([
      { type: "decl", prop: "--baro-rotate-x", value: "rotateX(-15deg)" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("rotate-x-(--my-rotation) \u2192 --baro-rotate-x: rotateX(var(--my-rotation)) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("rotate-x-(--my-rotation)")).toEqual([
      { type: "decl", prop: "--baro-rotate-x", value: "rotateX(var(--my-rotation))" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("rotate-x-[1.5turn] \u2192 --baro-rotate-x: rotateX(1.5turn) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("rotate-x-[1.5turn]")).toEqual([
      { type: "decl", prop: "--baro-rotate-x", value: "rotateX(1.5turn)" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });

  it("rotate-y-25 \u2192 --baro-rotate-y: rotateY(25deg) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("rotate-y-25")).toEqual([
      { type: "decl", prop: "--baro-rotate-y", value: "rotateY(25deg)" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("-rotate-y-30 \u2192 --baro-rotate-y: rotateY(-30deg) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("-rotate-y-30")).toEqual([
      { type: "decl", prop: "--baro-rotate-y", value: "rotateY(-30deg)" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("rotate-y-(--my-rotation) \u2192 --baro-rotate-y: rotateY(var(--my-rotation)) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("rotate-y-(--my-rotation)")).toEqual([
      { type: "decl", prop: "--baro-rotate-y", value: "rotateY(var(--my-rotation))" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("rotate-y-[2rad] \u2192 --baro-rotate-y: rotateY(2rad) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("rotate-y-[2rad]")).toEqual([
      { type: "decl", prop: "--baro-rotate-y", value: "rotateY(2rad)" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });

  it("rotate-z-45 \u2192 --baro-rotate-z: rotateZ(45deg) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("rotate-z-45")).toEqual([
      { type: "decl", prop: "--baro-rotate-z", value: "rotateZ(45deg)" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("-rotate-z-30 \u2192 --baro-rotate-z: rotateZ(-30deg) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("-rotate-z-30")).toEqual([
      { type: "decl", prop: "--baro-rotate-z", value: "rotateZ(-30deg)" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("rotate-z-(--my-rotation) \u2192 --baro-rotate-z: rotateZ(var(--my-rotation)) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("rotate-z-(--my-rotation)")).toEqual([
      { type: "decl", prop: "--baro-rotate-z", value: "rotateZ(var(--my-rotation))" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
  it("rotate-z-[0.5turn] \u2192 --baro-rotate-z: rotateZ(0.5turn) ; transform: var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)", () => {
    expect(decls("rotate-z-[0.5turn]")).toEqual([
      { type: "decl", prop: "--baro-rotate-z", value: "rotateZ(0.5turn)" },
      { type: "decl", prop: "transform", value: "var(--baro-rotate-x,) var(--baro-rotate-y,) var(--baro-rotate-z,) var(--baro-skew-x,) var(--baro-skew-y,)" },
    ]);
  });
});

describe("scale utilities", () => {
  it("scale-none → scale: none", () => {
    expect(parseClassToAst("scale-none", ctx)).toMatchObject([
      { type: "decl", prop: "scale", value: "none" },
    ]);
  });
  it("scale-3d \u2192 scale: var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)", () => {
    expect(decls("scale-3d")).toEqual([
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)" },
    ]);
  });
  it("scale-75 → scale: 75% 75%", () => {
    expect(parseClassToAst("scale-75", ctx)).toMatchObject([
      { type: "decl", prop: "scale", value: "75% 75%" },
    ]);
  });
  it("-scale-80 → scale: calc(80% * -1) calc(80% * -1)", () => {
    expect(parseClassToAst("-scale-80", ctx)).toMatchObject([
      { type: "decl", prop: "scale", value: "calc(80% * -1) calc(80% * -1)" },
    ]);
  });
  it("scale-(--my-scale) → scale: var(--my-scale) var(--my-scale)", () => {
    expect(parseClassToAst("scale-(--my-scale)", ctx)).toMatchObject([
      { type: "decl", prop: "scale", value: "var(--my-scale) var(--my-scale)" },
    ]);
  });
  it("scale-[1.7] → scale: 1.7", () => {
    expect(parseClassToAst("scale-[1.7]", ctx)).toMatchObject([
      { type: "decl", prop: "scale", value: "1.7" },
    ]);
  });

  it("scale-x-90 \u2192 --baro-scale-x: calc(90% * 1) ; scale: var(--baro-scale-x) var(--baro-scale-y)", () => {
    expect(decls("scale-x-90")).toEqual([
      { type: "decl", prop: "--baro-scale-x", value: "calc(90% * 1)" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y)" },
    ]);
  });
  it("-scale-x-60 \u2192 --baro-scale-x: calc(60% * -1) ; scale: var(--baro-scale-x) var(--baro-scale-y)", () => {
    expect(decls("-scale-x-60")).toEqual([
      { type: "decl", prop: "--baro-scale-x", value: "calc(60% * -1)" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y)" },
    ]);
  });
  it("scale-x-(--my-scale) \u2192 --baro-scale-x: var(--my-scale) ; scale: var(--baro-scale-x) var(--baro-scale-y)", () => {
    expect(decls("scale-x-(--my-scale)")).toEqual([
      { type: "decl", prop: "--baro-scale-x", value: "var(--my-scale)" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y)" },
    ]);
  });
  it("scale-x-[2.5] \u2192 --baro-scale-x: 2.5 ; scale: var(--baro-scale-x) var(--baro-scale-y)", () => {
    expect(decls("scale-x-[2.5]")).toEqual([
      { type: "decl", prop: "--baro-scale-x", value: "2.5" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y)" },
    ]);
  });

  it("scale-y-110 \u2192 --baro-scale-y: calc(110% * 1) ; scale: var(--baro-scale-x) var(--baro-scale-y)", () => {
    expect(decls("scale-y-110")).toEqual([
      { type: "decl", prop: "--baro-scale-y", value: "calc(110% * 1)" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y)" },
    ]);
  });
  it("-scale-y-95 \u2192 --baro-scale-y: calc(95% * -1) ; scale: var(--baro-scale-x) var(--baro-scale-y)", () => {
    expect(decls("-scale-y-95")).toEqual([
      { type: "decl", prop: "--baro-scale-y", value: "calc(95% * -1)" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y)" },
    ]);
  });
  it("scale-y-(--my-scale) \u2192 --baro-scale-y: var(--my-scale) ; scale: var(--baro-scale-x) var(--baro-scale-y)", () => {
    expect(decls("scale-y-(--my-scale)")).toEqual([
      { type: "decl", prop: "--baro-scale-y", value: "var(--my-scale)" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y)" },
    ]);
  });
  it("scale-y-[0.8] \u2192 --baro-scale-y: 0.8 ; scale: var(--baro-scale-x) var(--baro-scale-y)", () => {
    expect(decls("scale-y-[0.8]")).toEqual([
      { type: "decl", prop: "--baro-scale-y", value: "0.8" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y)" },
    ]);
  });

  it("scale-z-120 \u2192 --baro-scale-z: calc(120% * 1) ; scale: var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)", () => {
    expect(decls("scale-z-120")).toEqual([
      { type: "decl", prop: "--baro-scale-z", value: "calc(120% * 1)" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)" },
    ]);
  });
  it("-scale-z-70 \u2192 --baro-scale-z: calc(70% * -1) ; scale: var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)", () => {
    expect(decls("-scale-z-70")).toEqual([
      { type: "decl", prop: "--baro-scale-z", value: "calc(70% * -1)" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)" },
    ]);
  });
  it("scale-z-(--my-scale) \u2192 --baro-scale-z: var(--my-scale) ; scale: var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)", () => {
    expect(decls("scale-z-(--my-scale)")).toEqual([
      { type: "decl", prop: "--baro-scale-z", value: "var(--my-scale)" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)" },
    ]);
  });
  it("scale-z-[1.2] \u2192 --baro-scale-z: 1.2 ; scale: var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)", () => {
    expect(decls("scale-z-[1.2]")).toEqual([
      { type: "decl", prop: "--baro-scale-z", value: "1.2" },
      { type: "decl", prop: "scale", value: "var(--baro-scale-x) var(--baro-scale-y) var(--baro-scale-z)" },
    ]);
  });
});

describe("skew utilities", () => {
  it("skew-4 → transform: skewX(4deg) skewY(4deg)", () => {
    expect(parseClassToAst("skew-4", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewX(4deg) skewY(4deg)" },
    ]);
  });
  it("-skew-12 → transform: skewX(-12deg) skewY(-12deg)", () => {
    expect(parseClassToAst("-skew-12", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewX(-12deg) skewY(-12deg)" },
    ]);
  });
  it("skew-(--my-skew) → transform: skewX(var(--my-skew)) skewY(var(--my-skew))", () => {
    expect(parseClassToAst("skew-(--my-skew)", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewX(var(--my-skew)) skewY(var(--my-skew))" },
    ]);
  });
  it("skew-[0.5turn] → transform: skewX(0.5turn) skewY(0.5turn)", () => {
    expect(parseClassToAst("skew-[0.5turn]", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewX(0.5turn) skewY(0.5turn)" },
    ]);
  });

  it("skew-x-8 → transform: skewX(8deg)", () => {
    expect(parseClassToAst("skew-x-8", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewX(8deg)" },
    ]);
  });
  it("-skew-x-3 → transform: skewX(-3deg)", () => {
    expect(parseClassToAst("-skew-x-3", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewX(-3deg)" },
    ]);
  });
  it("skew-x-(--my-skew) → transform: skewX(var(--my-skew))", () => {
    expect(parseClassToAst("skew-x-(--my-skew)", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewX(var(--my-skew))" },
    ]);
  });
  it("skew-x-[1.2rad] → transform: skewX(1.2rad)", () => {
    expect(parseClassToAst("skew-x-[1.2rad]", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewX(1.2rad)" },
    ]);
  });

  it("skew-y-6 → transform: skewY(6deg)", () => {
    expect(parseClassToAst("skew-y-6", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewY(6deg)" },
    ]);
  });
  it("-skew-y-2 → transform: skewY(-2deg)", () => {
    expect(parseClassToAst("-skew-y-2", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewY(-2deg)" },
    ]);
  });
  it("skew-y-(--my-skew) → transform: skewY(var(--my-skew))", () => {
    expect(parseClassToAst("skew-y-(--my-skew)", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewY(var(--my-skew))" },
    ]);
  });
  it("skew-y-[45deg] → transform: skewY(45deg)", () => {
    expect(parseClassToAst("skew-y-[45deg]", ctx)).toMatchObject([
      { type: "decl", prop: "transform", value: "skewY(45deg)" },
    ]);
  });
});

describe("transform-origin ", () => {
  it("origin-center → transform-origin: center", () => {
    expect(parseClassToAst("origin-center", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "center" },
    ]);
  });
  it("origin-top → transform-origin: top", () => {
    expect(parseClassToAst("origin-top", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "top" },
    ]);
  });
  it("origin-top-right → transform-origin: top right", () => {
    expect(parseClassToAst("origin-top-right", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "top right" },
    ]);
  });
  it("origin-right → transform-origin: right", () => {
    expect(parseClassToAst("origin-right", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "right" },
    ]);
  });
  it("origin-bottom-right → transform-origin: bottom right", () => {
    expect(parseClassToAst("origin-bottom-right", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "bottom right" },
    ]);
  });
  it("origin-bottom → transform-origin: bottom", () => {
    expect(parseClassToAst("origin-bottom", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "bottom" },
    ]);
  });
  it("origin-bottom-left → transform-origin: bottom left", () => {
    expect(parseClassToAst("origin-bottom-left", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "bottom left" },
    ]);
  });
  it("origin-left → transform-origin: left", () => {
    expect(parseClassToAst("origin-left", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "left" },
    ]);
  });
  it("origin-top-left → transform-origin: top left", () => {
    expect(parseClassToAst("origin-top-left", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "top left" },
    ]);
  });
  it("origin-(--my-origin) → transform-origin: var(--my-origin)", () => {
    expect(parseClassToAst("origin-(--my-origin)", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "var(--my-origin)" },
    ]);
  });
  it("origin-[25%_75%] → transform-origin: 25% 75%", () => {
    expect(parseClassToAst("origin-[25%_75%]", ctx)).toMatchObject([
      { type: "decl", prop: "transform-origin", value: "25% 75%" },
    ]);
  });
});

describe("transform-style ", () => {
  it("transform-3d → transform-style: preserve-3d", () => {
    expect(parseClassToAst("transform-3d", ctx)).toMatchObject([
      { type: "decl", prop: "transform-style", value: "preserve-3d" },
    ]);
  });
  it("transform-flat → transform-style: flat", () => {
    expect(parseClassToAst("transform-flat", ctx)).toMatchObject([
      { type: "decl", prop: "transform-style", value: "flat" },
    ]);
  });
});

describe("translate utilities ", () => {
  // --- Static ---
  it("translate-none → translate: none", () => {
    expect(parseClassToAst("translate-none", ctx)).toMatchObject([
      { type: "decl", prop: "translate", value: "none" },
    ]);
  });
  it("translate-px → translate: 1px 1px", () => {
    expect(parseClassToAst("translate-px", ctx)).toMatchObject([
      { type: "decl", prop: "translate", value: "1px 1px" },
    ]);
  });
  it("-translate-px → translate: -1px -1px", () => {
    expect(parseClassToAst("-translate-px", ctx)).toMatchObject([
      { type: "decl", prop: "translate", value: "-1px -1px" },
    ]);
  });
  it("translate-full → translate: 100% 100%", () => {
    expect(parseClassToAst("translate-full", ctx)).toMatchObject([
      {type: "at-root", nodes: [
        {type: "at-rule", name: "property", params: "--baro-translate-x", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
        {type: "at-rule", name: "property", params: "--baro-translate-y", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
        {type: "at-rule", name: "property", params: "--baro-translate-z", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
      ]},
      {type: "decl", prop: "--baro-translate-x", value: "100%"},
      {type: "decl", prop: "--baro-translate-y", value: "100%"},
      {type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)"},
    ]);
  });

  it("-translate-full → translate: -100% -100%", () => {
    expect(parseClassToAst("-translate-full", ctx)).toMatchObject([
      {type: "at-root", nodes: [
        {type: "at-rule", name: "property", params: "--baro-translate-x", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
        {type: "at-rule", name: "property", params: "--baro-translate-y", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
        {type: "at-rule", name: "property", params: "--baro-translate-z", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
      ]},
      {type: "decl", prop: "--baro-translate-x", value: "-100%"},
      {type: "decl", prop: "--baro-translate-y", value: "-100%"},
      {type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)"},
    ]);
  });
  it("translate-x-px \u2192 --baro-translate-x: 1px ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-x-px")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "1px" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("-translate-x-px \u2192 --baro-translate-x: -1px ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("-translate-x-px")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "-1px" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-x-full \u2192 --baro-translate-x: 100% ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-x-full")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "100%" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("-translate-x-full \u2192 --baro-translate-x: -100% ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("-translate-x-full")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "-100%" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-y-px \u2192 --baro-translate-y: 1px ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-y-px")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "1px" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("-translate-y-px \u2192 --baro-translate-y: -1px ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("-translate-y-px")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "-1px" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-y-full \u2192 --baro-translate-y: 100% ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-y-full")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "100%" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("-translate-y-full \u2192 --baro-translate-y: -100% ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("-translate-y-full")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "-100%" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-z-px \u2192 --baro-translate-z: 1px ; translate: var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)", () => {
    expect(decls("translate-z-px")).toEqual([
      { type: "decl", prop: "--baro-translate-z", value: "1px" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)" },
    ]);
  });
  it("-translate-z-px \u2192 --baro-translate-z: -1px ; translate: var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)", () => {
    expect(decls("-translate-z-px")).toEqual([
      { type: "decl", prop: "--baro-translate-z", value: "-1px" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)" },
    ]);
  });

  // --- Functional: spacing scale (number) ---
  it("translate-2 \u2192 translate: calc(var(--spacing) * 2) calc(var(--spacing) * 2)", () => {
    expect(decls("translate-2")).toEqual([
      { type: "decl", prop: "translate", value: "calc(var(--spacing) * 2) calc(var(--spacing) * 2)" },
    ]);
  });
  it("-translate-3 → translate: calc(var(--spacing) * -3) calc(var(--spacing) * -3)", () => {
    expect(parseClassToAst("-translate-3", ctx)).toMatchObject([
      { type: "decl", prop: "translate", value: "calc(var(--spacing) * -3) calc(var(--spacing) * -3)" },
    ]);
  });
  it("translate-x-4 \u2192 --baro-translate-x: calc(var(--spacing) * 4) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-x-4")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "calc(var(--spacing) * 4)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("-translate-x-1 \u2192 --baro-translate-x: calc(var(--spacing) * -1) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("-translate-x-1")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "calc(var(--spacing) * -1)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-y-5 \u2192 --baro-translate-y: calc(var(--spacing) * 5) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-y-5")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "calc(var(--spacing) * 5)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("-translate-y-2 \u2192 --baro-translate-y: calc(var(--spacing) * -2) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("-translate-y-2")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "calc(var(--spacing) * -2)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-z-6 \u2192 --baro-translate-z: calc(var(--spacing) * 6) ; translate: var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)", () => {
    expect(decls("translate-z-6")).toEqual([
      { type: "decl", prop: "--baro-translate-z", value: "calc(var(--spacing) * 6)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)" },
    ]);
  });
  it("-translate-z-2 \u2192 --baro-translate-z: calc(var(--spacing) * -2) ; translate: var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)", () => {
    expect(decls("-translate-z-2")).toEqual([
      { type: "decl", prop: "--baro-translate-z", value: "calc(var(--spacing) * -2)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)" },
    ]);
  });

  // --- Functional: fraction ---
  it("translate-1/2 → translate: calc(1/2 * 100%) calc(1/2 * 100%)", () => {
    expect(parseClassToAst("translate-1/2", ctx)).toMatchObject([
      { type: "decl", prop: "translate", value: "calc(1/2 * 100%) calc(1/2 * 100%)" },
    ]);
  });
  it("-translate-1/4 → translate: calc(-1/4 * 100%) calc(-1/4 * 100%)", () => {
    expect(parseClassToAst("-translate-1/4", ctx)).toMatchObject([
      { type: "decl", prop: "translate", value: "calc(-1/4 * 100%) calc(-1/4 * 100%)" },
    ]);
  });
  it("translate-x-3/5 \u2192 --baro-translate-x: calc(3/5 * 100%) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-x-3/5")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "calc(3/5 * 100%)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("-translate-x-2/3 \u2192 --baro-translate-x: calc(-2/3 * 100%) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("-translate-x-2/3")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "calc(-2/3 * 100%)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-y-1/6 \u2192 --baro-translate-y: calc(1/6 * 100%) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-y-1/6")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "calc(1/6 * 100%)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("-translate-y-1/3 \u2192 --baro-translate-y: calc(-1/3 * 100%) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("-translate-y-1/3")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "calc(-1/3 * 100%)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-z-2/7 \u2192 --baro-translate-z: calc(2/7 * 100%) ; translate: var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)", () => {
    expect(decls("translate-z-2/7")).toEqual([
      { type: "decl", prop: "--baro-translate-z", value: "calc(2/7 * 100%)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)" },
    ]);
  });
  it("-translate-z-1/8 \u2192 --baro-translate-z: calc(-1/8 * 100%) ; translate: var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)", () => {
    expect(decls("-translate-z-1/8")).toEqual([
      { type: "decl", prop: "--baro-translate-z", value: "calc(-1/8 * 100%)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)" },
    ]);
  });

  // --- Functional: arbitrary ---
  it("translate-[42px] → translate: 42px 42px", () => {
    expect(parseClassToAst("translate-[42px]", ctx)).toMatchObject([
      { type: "decl", prop: "translate", value: "42px 42px" },
    ]);
  });
  it("translate-x-[10vw] \u2192 --baro-translate-x: 10vw ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-x-[10vw]")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "10vw" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-y-[5rem] \u2192 --baro-translate-y: 5rem ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-y-[5rem]")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "5rem" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-z-[2em] \u2192 --baro-translate-z: 2em ; translate: var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)", () => {
    expect(decls("translate-z-[2em]")).toEqual([
      { type: "decl", prop: "--baro-translate-z", value: "2em" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)" },
    ]);
  });

  // --- Functional: custom property ---
  it("translate-(--my-translate) → translate: var(--my-translate) var(--my-translate)", () => {
    expect(parseClassToAst("translate-(--my-translate)", ctx)).toMatchObject([
      { type: "decl", prop: "translate", value: "var(--my-translate) var(--my-translate)" },
    ]);
  });
  it("translate-x-(--my-x) \u2192 --baro-translate-x: var(--my-x) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-x-(--my-x)")).toEqual([
      { type: "decl", prop: "--baro-translate-x", value: "var(--my-x)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-y-(--my-y) \u2192 --baro-translate-y: var(--my-y) ; translate: var(--baro-translate-x) var(--baro-translate-y)", () => {
    expect(decls("translate-y-(--my-y)")).toEqual([
      { type: "decl", prop: "--baro-translate-y", value: "var(--my-y)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y)" },
    ]);
  });
  it("translate-z-(--my-z) \u2192 --baro-translate-z: var(--my-z) ; translate: var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)", () => {
    expect(decls("translate-z-(--my-z)")).toEqual([
      { type: "decl", prop: "--baro-translate-z", value: "var(--my-z)" },
      { type: "decl", prop: "translate", value: "var(--baro-translate-x) var(--baro-translate-y) var(--baro-translate-z)" },
    ]);
  });
}); 
describe("per-axis composition (Tailwind v4 shape)", () => {
  it("translate-x registers both axes so a lone axis never references an undefined var", () => {
    const css = generateCss("translate-x-4", ctx);
    expect(css).toContain("@property --baro-translate-x");
    expect(css).toContain("@property --baro-translate-y");
  });
  it("scale-x registers its axes with initial value 1", () => {
    const css = generateCss("scale-x-75", ctx);
    expect(css).toMatch(/@property --baro-scale-y \{[^}]*initial-value: 1;/);
  });
  it("hoists @property out of a media variant (hover:)", () => {
    const css = generateCss("hover:-translate-y-1", ctx);
    expect(css).toContain("@property --baro-translate-x");
    expect(css).not.toMatch(/@media \(hover: hover\) \{\s*\}/);
  });
});
