import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({});

describe("transition-property", () => {
  it("transition → transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter", () => {
    expect(applyClassName("transition", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "color, background-color, border-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-all → transition-property: all", () => {
    expect(applyClassName("transition-all", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "all" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-colors → transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to", () => {
    expect(applyClassName("transition-colors", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "color, background-color, border-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-opacity → transition-property: opacity", () => {
    expect(applyClassName("transition-opacity", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "opacity" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-shadow → transition-property: box-shadow", () => {
    expect(applyClassName("transition-shadow", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "box-shadow" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-transform → transition-property: transform, translate, scale, rotate", () => {
    expect(applyClassName("transition-transform", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "transform, translate, scale, rotate" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-none → transition-property: none", () => {
    expect(applyClassName("transition-none", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "none" },
    ]);
  });
  it("transition-[height] → transition-property: height", () => {
    expect(applyClassName("transition-[height]", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "height" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
  it("transition-(--my-prop) → transition-property: var(--my-prop)", () => {
    expect(applyClassName("transition-(--my-prop)", ctx)).toEqual([
      { type: "decl", prop: "transition-property", value: "var(--my-prop)" },
      { type: "decl", prop: "transition-timing-function", value: "var(--default-transition-timing-function)" },
      { type: "decl", prop: "transition-duration", value: "var(--default-transition-duration)" },
    ]);
  });
});

describe("transition-behavior", () => {
  it("transition-normal → transition-behavior: normal", () => {
    expect(applyClassName("transition-normal", ctx)).toEqual([
      { type: "decl", prop: "transition-behavior", value: "normal" },
    ]);
  });
  it("transition-discrete → transition-behavior: allow-discrete", () => {
    expect(applyClassName("transition-discrete", ctx)).toEqual([
      { type: "decl", prop: "transition-behavior", value: "allow-discrete" },
    ]);
  });
});

describe("transition-duration", () => {
  it("duration-0 → transition-duration: 0ms", () => {
    expect(applyClassName("duration-0", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "0ms" },
    ]);
  });
  it("duration-150 → transition-duration: 150ms", () => {
    expect(applyClassName("duration-150", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "150ms" },
    ]);
  });
  it("duration-700 → transition-duration: 700ms", () => {
    expect(applyClassName("duration-700", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "700ms" },
    ]);
  });
  it("duration-initial → transition-duration: initial", () => {
    expect(applyClassName("duration-initial", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "initial" },
    ]);
  });
  it("duration-[1s,15s] → transition-duration: 1s,15s", () => {
    expect(applyClassName("duration-[1s,15s]", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "1s,15s" },
    ]);
  });
  it("duration-(--my-duration) → transition-duration: var(--my-duration)", () => {
    expect(applyClassName("duration-(--my-duration)", ctx)).toEqual([
      { type: "decl", prop: "transition-duration", value: "var(--my-duration)" },
    ]);
  });
});

describe("transition-timing-function", () => {
  it("ease-linear → transition-timing-function: linear", () => {
    expect(applyClassName("ease-linear", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "linear" },
    ]);
  });
  it("ease-in → transition-timing-function: var(--ease-in)", () => {
    expect(applyClassName("ease-in", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "var(--ease-in)" },
    ]);
  });
  it("ease-out → transition-timing-function: var(--ease-out)", () => {
    expect(applyClassName("ease-out", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "var(--ease-out)" },
    ]);
  });
  it("ease-in-out → transition-timing-function: var(--ease-in-out)", () => {
    expect(applyClassName("ease-in-out", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "var(--ease-in-out)" },
    ]);
  });
  it("ease-initial → transition-timing-function: initial", () => {
    expect(applyClassName("ease-initial", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "initial" },
    ]);
  });
  it("ease-[cubic-bezier(0.95,0.05,0.795,0.035)] → transition-timing-function: cubic-bezier(0.95,0.05,0.795,0.035)", () => {
    expect(applyClassName("ease-[cubic-bezier(0.95,0.05,0.795,0.035)]", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "cubic-bezier(0.95,0.05,0.795,0.035)" },
    ]);
  });
  it("ease-(--my-ease) → transition-timing-function: var(--my-ease)", () => {
    expect(applyClassName("ease-(--my-ease)", ctx)).toEqual([
      { type: "decl", prop: "transition-timing-function", value: "var(--my-ease)" },
    ]);
  });
});

describe("transition-delay", () => {
  it("delay-0 → transition-delay: 0ms", () => {
    expect(applyClassName("delay-0", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "0ms" },
    ]);
  });
  it("delay-150 → transition-delay: 150ms", () => {
    expect(applyClassName("delay-150", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "150ms" },
    ]);
  });
  it("delay-700 → transition-delay: 700ms", () => {
    expect(applyClassName("delay-700", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "700ms" },
    ]);
  });
  it("delay-[1s,250ms] → transition-delay: 1s,250ms", () => {
    expect(applyClassName("delay-[1s,250ms]", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "1s,250ms" },
    ]);
  });
  it("delay-(--my-delay) → transition-delay: var(--my-delay)", () => {
    expect(applyClassName("delay-(--my-delay)", ctx)).toEqual([
      { type: "decl", prop: "transition-delay", value: "var(--my-delay)" },
    ]);
  });
});

describe("animation", () => {
  it("animate-spin → animation: var(--animate-spin)", () => {
    expect(applyClassName("animate-spin", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--animate-spin)" },
    ]);
  });
  it("animate-ping → animation: var(--animate-ping)", () => {
    expect(applyClassName("animate-ping", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--animate-ping)" },
    ]);
  });
  it("animate-pulse → animation: var(--animate-pulse)", () => {
    expect(applyClassName("animate-pulse", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--animate-pulse)" },
    ]);
  });
  it("animate-bounce → animation: var(--animate-bounce)", () => {
    expect(applyClassName("animate-bounce", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--animate-bounce)" },
    ]);
  });
  it("animate-none → animation: none", () => {
    expect(applyClassName("animate-none", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "none" },
    ]);
  });
  it("animate-[wiggle_1s_ease-in-out_infinite] → animation: wiggle_1s_ease-in-out_infinite", () => {
    expect(applyClassName("animate-[wiggle_1s_ease-in-out_infinite]", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "wiggle 1s ease-in-out infinite" },
    ]);
  });
  it("animate-(--my-animation) → animation: var(--my-animation)", () => {
    expect(applyClassName("animate-(--my-animation)", ctx)).toEqual([
      { type: "decl", prop: "animation", value: "var(--my-animation)" },
    ]);
  });
}); 