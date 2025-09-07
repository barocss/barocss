import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({});

describe("transition-property", () => {
  it("transition → transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, --baro-gradient-from, --baro-gradient-via, --baro-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter", () => {
    expect(parseClassToAst("transition", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "color, background-color, border-color, text-decoration-color, fill, stroke, --baro-gradient-from, --baro-gradient-via, --baro-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-all → transition-property: all", () => {
    expect(parseClassToAst("transition-all", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "all" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-colors → transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, --baro-gradient-from, --baro-gradient-via, --baro-gradient-to", () => {
    expect(parseClassToAst("transition-colors", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "color, background-color, border-color, text-decoration-color, fill, stroke, --baro-gradient-from, --baro-gradient-via, --baro-gradient-to" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-opacity → transition-property: opacity", () => {
    expect(parseClassToAst("transition-opacity", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "opacity" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-shadow → transition-property: box-shadow", () => {
    expect(parseClassToAst("transition-shadow", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "box-shadow" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-transform → transition-property: transform, translate, scale, rotate", () => {
    expect(parseClassToAst("transition-transform", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "transform, translate, scale, rotate" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-none → transition-property: none", () => {
    expect(parseClassToAst("transition-none", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "none" },
    ]);
  });
  it("transition-[height] → transition-property: height", () => {
    expect(parseClassToAst("transition-[height]", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "height" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-(--my-prop) → transition-property: var(--my-prop)", () => {
    expect(parseClassToAst("transition-(--my-prop)", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "var(--my-prop)" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
});

describe("transition-behavior", () => {
  it("transition-normal → transition-behavior: normal", () => {
    expect(parseClassToAst("transition-normal", ctx)).toEqual([
      { type: "decl", prop: "transition-behavior", value: "normal" },
    ]);
  });
  it("transition-discrete → transition-behavior: allow-discrete", () => {
    expect(parseClassToAst("transition-discrete", ctx)).toEqual([
      { type: "decl", prop: "transition-behavior", value: "allow-discrete" },
    ]);
  });
});

describe("transition-duration", () => {
  it("duration-0 → transition-duration: 0ms", () => {
    expect(parseClassToAst("duration-0", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "0ms" },
    ]);
  });
  it("duration-150 → transition-duration: 150ms", () => {
    expect(parseClassToAst("duration-150", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "150ms" },
    ]);
  });
  it("duration-700 → transition-duration: 700ms", () => {
    expect(parseClassToAst("duration-700", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "700ms" },
    ]);
  });
  it("duration-initial → transition-duration: initial", () => {
    expect(parseClassToAst("duration-initial", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "initial" },
    ]);
  });
  it("duration-[1s,15s] → transition-duration: 1s,15s", () => {
    expect(parseClassToAst("duration-[1s,15s]", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "1s,15s" },
    ]);
  });
  it("duration-(--my-duration) → transition-duration: var(--my-duration)", () => {
    expect(parseClassToAst("duration-(--my-duration)", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "var(--my-duration)" },
    ]);
  });
});

describe("transition-timing-function", () => {
  it("ease-linear → transition-timing-function: linear", () => {
    expect(parseClassToAst("ease-linear", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "linear" },
    ]);
  });
  it("ease-in → transition-timing-function: var(--ease-in)", () => {
    expect(parseClassToAst("ease-in", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "var(--ease-in)" },
    ]);
  });
  it("ease-out → transition-timing-function: var(--ease-out)", () => {
    expect(parseClassToAst("ease-out", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "var(--ease-out)" },
    ]);
  });
  it("ease-in-out → transition-timing-function: var(--ease-in-out)", () => {
    expect(parseClassToAst("ease-in-out", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "var(--ease-in-out)" },
    ]);
  });
  it("ease-initial → transition-timing-function: initial", () => {
    expect(parseClassToAst("ease-initial", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "initial" },
    ]);
  });
  it("ease-[cubic-bezier(0.95,0.05,0.795,0.035)] → transition-timing-function: cubic-bezier(0.95,0.05,0.795,0.035)", () => {
    expect(parseClassToAst("ease-[cubic-bezier(0.95,0.05,0.795,0.035)]", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "cubic-bezier(0.95,0.05,0.795,0.035)" },
    ]);
  });
  it("ease-(--my-ease) → transition-timing-function: var(--my-ease)", () => {
    expect(parseClassToAst("ease-(--my-ease)", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "var(--my-ease)" },
    ]);
  });
});

describe("transition-delay", () => {
  it("delay-0 → transition-delay: 0ms", () => {
    expect(parseClassToAst("delay-0", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "0ms" },
    ]);
  });
  it("delay-150 → transition-delay: 150ms", () => {
    expect(parseClassToAst("delay-150", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "150ms" },
    ]);
  });
  it("delay-700 → transition-delay: 700ms", () => {
    expect(parseClassToAst("delay-700", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "700ms" },
    ]);
  });
  it("delay-[1s,250ms] → transition-delay: 1s,250ms", () => {
    expect(parseClassToAst("delay-[1s,250ms]", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "1s,250ms" },
    ]);
  });
  it("delay-(--my-delay) → transition-delay: var(--my-delay)", () => {
    expect(parseClassToAst("delay-(--my-delay)", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "var(--my-delay)" },
    ]);
  });
});

describe("animation", () => {
  it("animate-spin → animation: var(--animate-spin)", () => {
    expect(parseClassToAst("animate-spin", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--animate-spin)" },
    ]);
  });
  it("animate-ping → animation: var(--animate-ping)", () => {
    expect(parseClassToAst("animate-ping", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--animate-ping)" },
    ]);
  });
  it("animate-pulse → animation: var(--animate-pulse)", () => {
    expect(parseClassToAst("animate-pulse", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--animate-pulse)" },
    ]);
  });
  it("animate-bounce → animation: var(--animate-bounce)", () => {
    expect(parseClassToAst("animate-bounce", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--animate-bounce)" },
    ]);
  });
  it("animate-none → animation: none", () => {
    expect(parseClassToAst("animate-none", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "none" },
    ]);
  });
  it("animate-[wiggle_1s_ease-in-out_infinite] → animation: wiggle_1s_ease-in-out_infinite", () => {
    expect(parseClassToAst("animate-[wiggle_1s_ease-in-out_infinite]", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "wiggle 1s ease-in-out infinite" },
    ]);
  });
  it("animate-(--my-animation) → animation: var(--my-animation)", () => {
    expect(parseClassToAst("animate-(--my-animation)", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--my-animation)" },
    ]);
  });
}); 