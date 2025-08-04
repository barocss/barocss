import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({});

describe("transform ", () => {
  it("transform-none → transform: none", () => {
    expect(parseClassToAst("transform-none", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "none" },
    ]);
  });
  it("transform-gpu → transform: translateZ(0) var(--tw-rotate-x) var(--tw-rotate-y) var(--tw-rotate-z) var(--tw-skew-x) var(--tw-skew-y)", () => {
    expect(parseClassToAst("transform-gpu", ctx)).toEqual([
      {
        type: "decl",
        prop: "transform",
        value:
          "translateZ(0) var(--tw-rotate-x) var(--tw-rotate-y) var(--tw-rotate-z) var(--tw-skew-x) var(--tw-skew-y)",
      },
    ]);
  });
  it("transform-cpu → transform: var(--tw-rotate-x) var(--tw-rotate-y) var(--tw-rotate-z) var(--tw-skew-x) var(--tw-skew-y)", () => {
    expect(parseClassToAst("transform-cpu", ctx)).toEqual([
      {
        type: "decl",
        prop: "transform",
        value:
          "var(--tw-rotate-x) var(--tw-rotate-y) var(--tw-rotate-z) var(--tw-skew-x) var(--tw-skew-y)",
      },
    ]);
  });
  it("transform-(--my-transform) → transform: var(--my-transform)", () => {
    expect(parseClassToAst("transform-(--my-transform)", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "var(--my-transform)" },
    ]);
  });
  it("transform-[matrix(1,2,3,4,5,6)] → transform: matrix(1,2,3,4,5,6)", () => {
    expect(parseClassToAst("transform-[matrix(1,2,3,4,5,6)]", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "matrix(1,2,3,4,5,6)" },
    ]);
  });
});

describe("transform utilities", () => {
  it("backface-hidden → backface-visibility: hidden", () => {
    expect(parseClassToAst("backface-hidden", ctx)).toEqual([
      { type: "decl", prop: "backface-visibility", value: "hidden" },
    ]);
  });
  it("backface-visible → backface-visibility: visible", () => {
    expect(parseClassToAst("backface-visible", ctx)).toEqual([
      { type: "decl", prop: "backface-visibility", value: "visible" },
    ]);
  });
});

describe("perspective utilities", () => {
  it("perspective-dramatic → perspective: var(--perspective-dramatic)", () => {
    expect(parseClassToAst("perspective-dramatic", ctx)).toEqual([
      { type: "decl", prop: "perspective", value: "var(--perspective-dramatic)" },
    ]);
  });
  it("perspective-near → perspective: var(--perspective-near)", () => {
    expect(parseClassToAst("perspective-near", ctx)).toEqual([
      { type: "decl", prop: "perspective", value: "var(--perspective-near)" },
    ]);
  });
  it("perspective-normal → perspective: var(--perspective-normal)", () => {
    expect(parseClassToAst("perspective-normal", ctx)).toEqual([
      { type: "decl", prop: "perspective", value: "var(--perspective-normal)" },
    ]);
  });
  it("perspective-midrange → perspective: var(--perspective-midrange)", () => {
    expect(parseClassToAst("perspective-midrange", ctx)).toEqual([
      { type: "decl", prop: "perspective", value: "var(--perspective-midrange)" },
    ]);
  });
  it("perspective-distant → perspective: var(--perspective-distant)", () => {
    expect(parseClassToAst("perspective-distant", ctx)).toEqual([
      { type: "decl", prop: "perspective", value: "var(--perspective-distant)" },
    ]);
  });
  it("perspective-none → perspective: none", () => {
    expect(parseClassToAst("perspective-none", ctx)).toEqual([
      { type: "decl", prop: "perspective", value: "none" },
    ]);
  });
  it("perspective-(--my-perspective) → perspective: var(--my-perspective)", () => {
    expect(parseClassToAst("perspective-(--my-perspective)", ctx)).toEqual([
      { type: "decl", prop: "perspective", value: "var(--my-perspective)" },
    ]);
  });
  it("perspective-[750px] → perspective: 750px", () => {
    expect(parseClassToAst("perspective-[750px]", ctx)).toEqual([
      { type: "decl", prop: "perspective", value: "750px" },
    ]);
  });
});

describe("perspective-origin utilities", () => {
  it("perspective-origin-center → perspective-origin: center", () => {
    expect(parseClassToAst("perspective-origin-center", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "center" },
    ]);
  });
  it("perspective-origin-top → perspective-origin: top", () => {
    expect(parseClassToAst("perspective-origin-top", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "top" },
    ]);
  });
  it("perspective-origin-top-right → perspective-origin: top right", () => {
    expect(parseClassToAst("perspective-origin-top-right", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "top right" },
    ]);
  });
  it("perspective-origin-right → perspective-origin: right", () => {
    expect(parseClassToAst("perspective-origin-right", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "right" },
    ]);
  });
  it("perspective-origin-bottom-right → perspective-origin: bottom right", () => {
    expect(parseClassToAst("perspective-origin-bottom-right", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "bottom right" },
    ]);
  });
  it("perspective-origin-bottom → perspective-origin: bottom", () => {
    expect(parseClassToAst("perspective-origin-bottom", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "bottom" },
    ]);
  });
  it("perspective-origin-bottom-left → perspective-origin: bottom left", () => {
    expect(parseClassToAst("perspective-origin-bottom-left", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "bottom left" },
    ]);
  });
  it("perspective-origin-left → perspective-origin: left", () => {
    expect(parseClassToAst("perspective-origin-left", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "left" },
    ]);
  });
  it("perspective-origin-top-left → perspective-origin: top left", () => {
    expect(parseClassToAst("perspective-origin-top-left", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "top left" },
    ]);
  });
  it("perspective-origin-(--my-origin) → perspective-origin: var(--my-origin)", () => {
    expect(parseClassToAst("perspective-origin-(--my-origin)", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "var(--my-origin)" },
    ]);
  });
  it("perspective-origin-[25%_75%] → perspective-origin: 25% 75%", () => {
    expect(parseClassToAst("perspective-origin-[25%_75%]", ctx)).toEqual([
      { type: "decl", prop: "perspective-origin", value: "25% 75%" },
    ]);
  });
});

describe("rotate utilities", () => {
  it("rotate-none → rotate: none", () => {
    expect(parseClassToAst("rotate-none", ctx)).toEqual([
      { type: "decl", prop: "rotate", value: "none" },
    ]);
  });
  it("rotate-45 → rotate: 45deg", () => {
    expect(parseClassToAst("rotate-45", ctx)).toEqual([
      { type: "decl", prop: "rotate", value: "45deg" },
    ]);
  });
  it("-rotate-30 → rotate: calc(30deg * -1)", () => {
    expect(parseClassToAst("-rotate-30", ctx)).toEqual([
      { type: "decl", prop: "rotate", value: "calc(30deg * -1)" },
    ]);
  });
  it("rotate-(--my-rotation) → rotate: var(--my-rotation)", () => {
    expect(parseClassToAst("rotate-(--my-rotation)", ctx)).toEqual([
      { type: "decl", prop: "rotate", value: "var(--my-rotation)" },
    ]);
  });
  it("rotate-[3.142rad] → rotate: 3.142rad", () => {
    expect(parseClassToAst("rotate-[3.142rad]", ctx)).toEqual([
      { type: "decl", prop: "rotate", value: "3.142rad" },
    ]);
  });

  it("rotate-x-50 → transform: rotateX(50deg) var(--tw-rotate-y)", () => {
    expect(parseClassToAst("rotate-x-50", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "rotateX(50deg) var(--tw-rotate-y)" },
    ]);
  });
  it("-rotate-x-15 → transform: rotateX(-15deg) var(--tw-rotate-y)", () => {
    expect(parseClassToAst("-rotate-x-15", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "rotateX(-15deg) var(--tw-rotate-y)" },
    ]);
  });
  it("rotate-x-(--my-rotation) → transform: rotateX(var(--my-rotation)) var(--tw-rotate-y)", () => {
    expect(parseClassToAst("rotate-x-(--my-rotation)", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "rotateX(var(--my-rotation)) var(--tw-rotate-y)" },
    ]);
  });
  it("rotate-x-[1.5turn] → transform: rotateX(1.5turn) var(--tw-rotate-y)", () => {
    expect(parseClassToAst("rotate-x-[1.5turn]", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "rotateX(1.5turn) var(--tw-rotate-y)" },
    ]);
  });

  it("rotate-y-25 → transform: var(--tw-rotate-x) rotateY(25deg)", () => {
    expect(parseClassToAst("rotate-y-25", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "var(--tw-rotate-x) rotateY(25deg)" },
    ]);
  });
  it("-rotate-y-30 → transform: var(--tw-rotate-x) rotateY(-30deg)", () => {
    expect(parseClassToAst("-rotate-y-30", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "var(--tw-rotate-x) rotateY(-30deg)" },
    ]);
  });
  it("rotate-y-(--my-rotation) → transform: var(--tw-rotate-x) rotateY(var(--my-rotation))", () => {
    expect(parseClassToAst("rotate-y-(--my-rotation)", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "var(--tw-rotate-x) rotateY(var(--my-rotation))" },
    ]);
  });
  it("rotate-y-[2rad] → transform: var(--tw-rotate-x) rotateY(2rad)", () => {
    expect(parseClassToAst("rotate-y-[2rad]", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "var(--tw-rotate-x) rotateY(2rad)" },
    ]);
  });

  it("rotate-z-45 → transform: var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(45deg)", () => {
    expect(parseClassToAst("rotate-z-45", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(45deg)" },
    ]);
  });
  it("-rotate-z-30 → transform: var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(-30deg)", () => {
    expect(parseClassToAst("-rotate-z-30", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(-30deg)" },
    ]);
  });
  it("rotate-z-(--my-rotation) → transform: var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(var(--my-rotation))", () => {
    expect(parseClassToAst("rotate-z-(--my-rotation)", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(var(--my-rotation))" },
    ]);
  });
  it("rotate-z-[0.5turn] → transform: var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(0.5turn)", () => {
    expect(parseClassToAst("rotate-z-[0.5turn]", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(0.5turn)" },
    ]);
  });
});

describe("scale utilities", () => {
  it("scale-none → scale: none", () => {
    expect(parseClassToAst("scale-none", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "none" },
    ]);
  });
  it("scale-3d → scale: var(--tw-scale-x) var(--tw-scale-y) var(--tw-scale-z)", () => {
    expect(parseClassToAst("scale-3d", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--tw-scale-x) var(--tw-scale-y) var(--tw-scale-z)" },
    ]);
  });
  it("scale-75 → scale: 75% 75%", () => {
    expect(parseClassToAst("scale-75", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "75% 75%" },
    ]);
  });
  it("-scale-80 → scale: calc(80% * -1) calc(80% * -1)", () => {
    expect(parseClassToAst("-scale-80", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "calc(80% * -1) calc(80% * -1)" },
    ]);
  });
  it("scale-(--my-scale) → scale: var(--my-scale) var(--my-scale)", () => {
    expect(parseClassToAst("scale-(--my-scale)", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--my-scale) var(--my-scale)" },
    ]);
  });
  it("scale-[1.7] → scale: 1.7", () => {
    expect(parseClassToAst("scale-[1.7]", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "1.7" },
    ]);
  });

  it("scale-x-90 → scale: calc(90% * 1) var(--tw-scale-y)", () => {
    expect(parseClassToAst("scale-x-90", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "calc(90% * 1) var(--tw-scale-y)" },
    ]);
  });
  it("-scale-x-60 → scale: calc(60% * -1) var(--tw-scale-y)", () => {
    expect(parseClassToAst("-scale-x-60", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "calc(60% * -1) var(--tw-scale-y)" },
    ]);
  });
  it("scale-x-(--my-scale) → scale: var(--my-scale) var(--tw-scale-y)", () => {
    expect(parseClassToAst("scale-x-(--my-scale)", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--my-scale) var(--tw-scale-y)" },
    ]);
  });
  it("scale-x-[2.5] → scale: 2.5 var(--tw-scale-y)", () => {
    expect(parseClassToAst("scale-x-[2.5]", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "2.5 var(--tw-scale-y)" },
    ]);
  });

  it("scale-y-110 → scale: var(--tw-scale-x) calc(110% * 1)", () => {
    expect(parseClassToAst("scale-y-110", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--tw-scale-x) calc(110% * 1)" },
    ]);
  });
  it("-scale-y-95 → scale: var(--tw-scale-x) calc(95% * -1)", () => {
    expect(parseClassToAst("-scale-y-95", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--tw-scale-x) calc(95% * -1)" },
    ]);
  });
  it("scale-y-(--my-scale) → scale: var(--tw-scale-x) var(--my-scale)", () => {
    expect(parseClassToAst("scale-y-(--my-scale)", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--tw-scale-x) var(--my-scale)" },
    ]);
  });
  it("scale-y-[0.8] → scale: var(--tw-scale-x) 0.8", () => {
    expect(parseClassToAst("scale-y-[0.8]", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--tw-scale-x) 0.8" },
    ]);
  });

  it("scale-z-120 → scale: var(--tw-scale-x) var(--tw-scale-y) calc(120% * 1)", () => {
    expect(parseClassToAst("scale-z-120", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--tw-scale-x) var(--tw-scale-y) calc(120% * 1)" },
    ]);
  });
  it("-scale-z-70 → scale: var(--tw-scale-x) var(--tw-scale-y) calc(70% * -1)", () => {
    expect(parseClassToAst("-scale-z-70", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--tw-scale-x) var(--tw-scale-y) calc(70% * -1)" },
    ]);
  });
  it("scale-z-(--my-scale) → scale: var(--tw-scale-x) var(--tw-scale-y) var(--my-scale)", () => {
    expect(parseClassToAst("scale-z-(--my-scale)", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--tw-scale-x) var(--tw-scale-y) var(--my-scale)" },
    ]);
  });
  it("scale-z-[1.2] → scale: var(--tw-scale-x) var(--tw-scale-y) 1.2", () => {
    expect(parseClassToAst("scale-z-[1.2]", ctx)).toEqual([
      { type: "decl", prop: "scale", value: "var(--tw-scale-x) var(--tw-scale-y) 1.2" },
    ]);
  });
});

describe("skew utilities", () => {
  it("skew-4 → transform: skewX(4deg) skewY(4deg)", () => {
    expect(parseClassToAst("skew-4", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewX(4deg) skewY(4deg)" },
    ]);
  });
  it("-skew-12 → transform: skewX(-12deg) skewY(-12deg)", () => {
    expect(parseClassToAst("-skew-12", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewX(-12deg) skewY(-12deg)" },
    ]);
  });
  it("skew-(--my-skew) → transform: skewX(var(--my-skew)) skewY(var(--my-skew))", () => {
    expect(parseClassToAst("skew-(--my-skew)", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewX(var(--my-skew)) skewY(var(--my-skew))" },
    ]);
  });
  it("skew-[0.5turn] → transform: skewX(0.5turn) skewY(0.5turn)", () => {
    expect(parseClassToAst("skew-[0.5turn]", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewX(0.5turn) skewY(0.5turn)" },
    ]);
  });

  it("skew-x-8 → transform: skewX(8deg)", () => {
    expect(parseClassToAst("skew-x-8", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewX(8deg)" },
    ]);
  });
  it("-skew-x-3 → transform: skewX(-3deg)", () => {
    expect(parseClassToAst("-skew-x-3", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewX(-3deg)" },
    ]);
  });
  it("skew-x-(--my-skew) → transform: skewX(var(--my-skew))", () => {
    expect(parseClassToAst("skew-x-(--my-skew)", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewX(var(--my-skew))" },
    ]);
  });
  it("skew-x-[1.2rad] → transform: skewX(1.2rad)", () => {
    expect(parseClassToAst("skew-x-[1.2rad]", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewX(1.2rad)" },
    ]);
  });

  it("skew-y-6 → transform: skewY(6deg)", () => {
    expect(parseClassToAst("skew-y-6", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewY(6deg)" },
    ]);
  });
  it("-skew-y-2 → transform: skewY(-2deg)", () => {
    expect(parseClassToAst("-skew-y-2", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewY(-2deg)" },
    ]);
  });
  it("skew-y-(--my-skew) → transform: skewY(var(--my-skew))", () => {
    expect(parseClassToAst("skew-y-(--my-skew)", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewY(var(--my-skew))" },
    ]);
  });
  it("skew-y-[45deg] → transform: skewY(45deg)", () => {
    expect(parseClassToAst("skew-y-[45deg]", ctx)).toEqual([
      { type: "decl", prop: "transform", value: "skewY(45deg)" },
    ]);
  });
});

describe("transform-origin ", () => {
  it("origin-center → transform-origin: center", () => {
    expect(parseClassToAst("origin-center", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "center" },
    ]);
  });
  it("origin-top → transform-origin: top", () => {
    expect(parseClassToAst("origin-top", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "top" },
    ]);
  });
  it("origin-top-right → transform-origin: top right", () => {
    expect(parseClassToAst("origin-top-right", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "top right" },
    ]);
  });
  it("origin-right → transform-origin: right", () => {
    expect(parseClassToAst("origin-right", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "right" },
    ]);
  });
  it("origin-bottom-right → transform-origin: bottom right", () => {
    expect(parseClassToAst("origin-bottom-right", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "bottom right" },
    ]);
  });
  it("origin-bottom → transform-origin: bottom", () => {
    expect(parseClassToAst("origin-bottom", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "bottom" },
    ]);
  });
  it("origin-bottom-left → transform-origin: bottom left", () => {
    expect(parseClassToAst("origin-bottom-left", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "bottom left" },
    ]);
  });
  it("origin-left → transform-origin: left", () => {
    expect(parseClassToAst("origin-left", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "left" },
    ]);
  });
  it("origin-top-left → transform-origin: top left", () => {
    expect(parseClassToAst("origin-top-left", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "top left" },
    ]);
  });
  it("origin-(--my-origin) → transform-origin: var(--my-origin)", () => {
    expect(parseClassToAst("origin-(--my-origin)", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "var(--my-origin)" },
    ]);
  });
  it("origin-[25%_75%] → transform-origin: 25% 75%", () => {
    expect(parseClassToAst("origin-[25%_75%]", ctx)).toEqual([
      { type: "decl", prop: "transform-origin", value: "25% 75%" },
    ]);
  });
});

describe("transform-style ", () => {
  it("transform-3d → transform-style: preserve-3d", () => {
    expect(parseClassToAst("transform-3d", ctx)).toEqual([
      { type: "decl", prop: "transform-style", value: "preserve-3d" },
    ]);
  });
  it("transform-flat → transform-style: flat", () => {
    expect(parseClassToAst("transform-flat", ctx)).toEqual([
      { type: "decl", prop: "transform-style", value: "flat" },
    ]);
  });
});

describe("translate utilities ", () => {
  // --- Static ---
  it("translate-none → translate: none", () => {
    expect(parseClassToAst("translate-none", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "none" },
    ]);
  });
  it("translate-px → translate: 1px 1px", () => {
    expect(parseClassToAst("translate-px", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "1px 1px" },
    ]);
  });
  it("-translate-px → translate: -1px -1px", () => {
    expect(parseClassToAst("-translate-px", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "-1px -1px" },
    ]);
  });
  it("translate-full → translate: 100% 100%", () => {
    expect(parseClassToAst("translate-full", ctx)).toEqual([
      {type: "at-root", nodes: [
        {type: "at-rule", name: "property", params: "--tw-translate-x", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
        {type: "at-rule", name: "property", params: "--tw-translate-y", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
        {type: "at-rule", name: "property", params: "--tw-translate-z", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
      ]},
      {type: "decl", prop: "--tw-translate-x", value: "100%"},
      {type: "decl", prop: "--tw-translate-y", value: "100%"},
      {type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y)"},
    ]);
  });

  it("-translate-full → translate: -100% -100%", () => {
    expect(parseClassToAst("-translate-full", ctx)).toEqual([
      {type: "at-root", nodes: [
        {type: "at-rule", name: "property", params: "--tw-translate-x", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
        {type: "at-rule", name: "property", params: "--tw-translate-y", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
        {type: "at-rule", name: "property", params: "--tw-translate-z", nodes: [
          {type: "decl", prop: "syntax", value: '"*"'},
          {type: "decl", prop: "inherits", value: "false"},
          {type: "decl", prop: "initial-value", value: "0"},
        ]},
      ]},
      {type: "decl", prop: "--tw-translate-x", value: "-100%"},
      {type: "decl", prop: "--tw-translate-y", value: "-100%"},
      {type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y)"},
    ]);
  });
  it("translate-x-px → translate: 1px var(--tw-translate-y)", () => {
    expect(parseClassToAst("translate-x-px", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "1px var(--tw-translate-y)" },
    ]);
  });
  it("-translate-x-px → translate: -1px var(--tw-translate-y)", () => {
    expect(parseClassToAst("-translate-x-px", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "-1px var(--tw-translate-y)" },
    ]);
  });
  it("translate-x-full → translate: 100% var(--tw-translate-y)", () => {
    expect(parseClassToAst("translate-x-full", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "100% var(--tw-translate-y)" },
    ]);
  });
  it("-translate-x-full → translate: -100% var(--tw-translate-y)", () => {
    expect(parseClassToAst("-translate-x-full", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "-100% var(--tw-translate-y)" },
    ]);
  });
  it("translate-y-px → translate: var(--tw-translate-x) 1px", () => {
    expect(parseClassToAst("translate-y-px", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) 1px" },
    ]);
  });
  it("-translate-y-px → translate: var(--tw-translate-x) -1px", () => {
    expect(parseClassToAst("-translate-y-px", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) -1px" },
    ]);
  });
  it("translate-y-full → translate: var(--tw-translate-x) 100%", () => {
    expect(parseClassToAst("translate-y-full", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) 100%" },
    ]);
  });
  it("-translate-y-full → translate: var(--tw-translate-x) -100%", () => {
    expect(parseClassToAst("-translate-y-full", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) -100%" },
    ]);
  });
  it("translate-z-px → translate: var(--tw-translate-x) var(--tw-translate-y) 1px", () => {
    expect(parseClassToAst("translate-z-px", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y) 1px" },
    ]);
  });
  it("-translate-z-px → translate: var(--tw-translate-x) var(--tw-translate-y) -1px", () => {
    expect(parseClassToAst("-translate-z-px", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y) -1px" },
    ]);
  });

  // --- Functional: spacing scale (number) ---
  it("translate-2 → translate: calc(2 * 100%) calc(2 * 100%)", () => {
    expect(parseClassToAst("translate-2", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "calc(2 * 100%) calc(2 * 100%)" },
    ]);
  });
  it("-translate-3 → translate: calc(var(--spacing) * -3) calc(var(--spacing) * -3)", () => {
    expect(parseClassToAst("-translate-3", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "calc(var(--spacing) * -3) calc(var(--spacing) * -3)" },
    ]);
  });
  it("translate-x-4 → translate: calc(4 * 100%) var(--tw-translate-y)", () => {
    expect(parseClassToAst("translate-x-4", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "calc(4 * 100%) var(--tw-translate-y)" },
    ]);
  });
  it("-translate-x-1 → translate: calc(var(--spacing) * -1) var(--tw-translate-y)", () => {
    expect(parseClassToAst("-translate-x-1", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "calc(var(--spacing) * -1) var(--tw-translate-y)" },
    ]);
  });
  it("translate-y-5 → translate: var(--tw-translate-x) calc(5 * 100%)", () => {
    expect(parseClassToAst("translate-y-5", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) calc(5 * 100%)" },
    ]);
  });
  it("-translate-y-2 → translate: var(--tw-translate-x) calc(var(--spacing) * -2)", () => {
    expect(parseClassToAst("-translate-y-2", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) calc(var(--spacing) * -2)" },
    ]);
  });
  it("translate-z-6 → translate: var(--tw-translate-x) var(--tw-translate-y) calc(6 * 100%)", () => {
    expect(parseClassToAst("translate-z-6", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y) calc(6 * 100%)" },
    ]);
  });
  it("-translate-z-2 → translate: var(--tw-translate-x) var(--tw-translate-y) calc(var(--spacing) * -2)", () => {
    expect(parseClassToAst("-translate-z-2", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y) calc(var(--spacing) * -2)" },
    ]);
  });

  // --- Functional: fraction ---
  it("translate-1/2 → translate: calc(1/2 * 100%) calc(1/2 * 100%)", () => {
    expect(parseClassToAst("translate-1/2", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "calc(1/2 * 100%) calc(1/2 * 100%)" },
    ]);
  });
  it("-translate-1/4 → translate: calc(-1/4 * 100%) calc(-1/4 * 100%)", () => {
    expect(parseClassToAst("-translate-1/4", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "calc(-1/4 * 100%) calc(-1/4 * 100%)" },
    ]);
  });
  it("translate-x-3/5 → translate: calc(3/5 * 100%) var(--tw-translate-y)", () => {
    expect(parseClassToAst("translate-x-3/5", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "calc(3/5 * 100%) var(--tw-translate-y)" },
    ]);
  });
  it("-translate-x-2/3 → translate: calc(-2/3 * 100%) var(--tw-translate-y)", () => {
    expect(parseClassToAst("-translate-x-2/3", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "calc(-2/3 * 100%) var(--tw-translate-y)" },
    ]);
  });
  it("translate-y-1/6 → translate: var(--tw-translate-x) calc(1/6 * 100%)", () => {
    expect(parseClassToAst("translate-y-1/6", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) calc(1/6 * 100%)" },
    ]);
  });
  it("-translate-y-1/3 → translate: var(--tw-translate-x) calc(-1/3 * 100%)", () => {
    expect(parseClassToAst("-translate-y-1/3", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) calc(-1/3 * 100%)" },
    ]);
  });
  it("translate-z-2/7 → translate: var(--tw-translate-x) var(--tw-translate-y) calc(2/7 * 100%)", () => {
    expect(parseClassToAst("translate-z-2/7", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y) calc(2/7 * 100%)" },
    ]);
  });
  it("-translate-z-1/8 → translate: var(--tw-translate-x) var(--tw-translate-y) calc(-1/8 * 100%)", () => {
    expect(parseClassToAst("-translate-z-1/8", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y) calc(-1/8 * 100%)" },
    ]);
  });

  // --- Functional: arbitrary ---
  it("translate-[42px] → translate: 42px 42px", () => {
    expect(parseClassToAst("translate-[42px]", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "42px 42px" },
    ]);
  });
  it("translate-x-[10vw] → translate: 10vw var(--tw-translate-y)", () => {
    expect(parseClassToAst("translate-x-[10vw]", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "10vw var(--tw-translate-y)" },
    ]);
  });
  it("translate-y-[5rem] → translate: var(--tw-translate-x) 5rem", () => {
    expect(parseClassToAst("translate-y-[5rem]", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) 5rem" },
    ]);
  });
  it("translate-z-[2em] → translate: var(--tw-translate-x) var(--tw-translate-y) 2em", () => {
    expect(parseClassToAst("translate-z-[2em]", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y) 2em" },
    ]);
  });

  // --- Functional: custom property ---
  it("translate-(--my-translate) → translate: var(--my-translate) var(--my-translate)", () => {
    expect(parseClassToAst("translate-(--my-translate)", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--my-translate) var(--my-translate)" },
    ]);
  });
  it("translate-x-(--my-x) → translate: var(--my-x) var(--tw-translate-y)", () => {
    expect(parseClassToAst("translate-x-(--my-x)", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--my-x) var(--tw-translate-y)" },
    ]);
  });
  it("translate-y-(--my-y) → translate: var(--tw-translate-x) var(--my-y)", () => {
    expect(parseClassToAst("translate-y-(--my-y)", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--my-y)" },
    ]);
  });
  it("translate-z-(--my-z) → translate: var(--tw-translate-x) var(--tw-translate-y) var(--my-z)", () => {
    expect(parseClassToAst("translate-z-(--my-z)", ctx)).toEqual([
      { type: "decl", prop: "translate", value: "var(--tw-translate-x) var(--tw-translate-y) var(--my-z)" },
    ]);
  });
}); 