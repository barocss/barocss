import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({
  theme: {
    colors: {
      inherit: "inherit",
      current: "currentColor",
      transparent: "transparent",
      black: "#000",
      white: "#fff",
      blue: {
        500: "#0000ff",
      },
    },
  },
});

describe("accent-color ", () => {
  it("accent-inherit → accent-color: inherit", () => {
    expect(applyClassName("accent-inherit", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "inherit" },
    ]);
  });
  it("accent-current → accent-color: currentColor", () => {
    expect(applyClassName("accent-current", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "currentColor" },
    ]);
  });
  it("accent-transparent → accent-color: transparent", () => {
    expect(applyClassName("accent-transparent", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "transparent" },
    ]);
  });
  it("accent-black → accent-color: #000", () => {
    expect(applyClassName("accent-black", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "var(--color-black)" },
    ]);
  });
  it("accent-white → accent-color: #fff", () => {
    expect(applyClassName("accent-white", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "var(--color-white)" },
    ]);
  });
  it("accent-blue-500 → accent-color: #0000ff", () => {
    expect(applyClassName("accent-blue-500", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "var(--color-blue-500)" },
    ]);
  });
  it("accent-blue-500/50 → accent-color: #0000ff/50%", () => {
    expect(applyClassName("accent-blue-500/50", ctx)).toEqual([
      {
        type: "at-rule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "accent-color",
            value: "color-mix(in lab, #0000ff 50%, transparent)",
          },
        ],
      },
      { type: "decl", prop: "accent-color", value: "#0000ff" },
    ]);
  });
  it("accent-[rebeccapurple] → accent-color: rebeccapurple", () => {
    expect(applyClassName("accent-[rebeccapurple]", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "rebeccapurple" },
    ]);
  });
  it("accent-(--my-accent) → accent-color: var(--my-accent)", () => {
    expect(applyClassName("accent-(--my-accent)", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "var(--my-accent)" },
    ]);
  });
});

describe("appearance ", () => {
  it("appearance-none → appearance: none", () => {
    expect(applyClassName("appearance-none", ctx)).toEqual([
      { type: "decl", prop: "appearance", value: "none" },
    ]);
  });
  it("appearance-auto → appearance: auto", () => {
    expect(applyClassName("appearance-auto", ctx)).toEqual([
      { type: "decl", prop: "appearance", value: "auto" },
    ]);
  });
});

describe("caret-color ", () => {
  it("caret-inherit → caret-color: inherit", () => {
    expect(applyClassName("caret-inherit", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "inherit" },
    ]);
  });
  it("caret-current → caret-color: currentColor", () => {
    expect(applyClassName("caret-current", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "currentColor" },
    ]);
  });
  it("caret-transparent → caret-color: transparent", () => {
    expect(applyClassName("caret-transparent", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "transparent" },
    ]);
  });
  it("caret-black → caret-color: #000", () => {
    expect(applyClassName("caret-black", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "var(--color-black)" },
    ]);
  });
  it("caret-white → caret-color: #fff", () => {
    expect(applyClassName("caret-white", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "var(--color-white)" },
    ]);
  });
  it("caret-blue-500 → caret-color: var(--color-blue-500)", () => {
    expect(applyClassName("caret-blue-500", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "var(--color-blue-500)" },
    ]);
  });
  it("caret-blue-500/50 → caret-color: #0000ff/50%", () => {
    expect(applyClassName("caret-blue-500/50", ctx)).toEqual([
      {
        type: "at-rule",
        name: "supports",
        params: "(color:color-mix(in lab, red, red))",
        nodes: [
          {
            type: "decl",
            prop: "caret-color",
            value: "color-mix(in lab, #0000ff 50%, transparent)",
          },
        ],
      },
      { type: "decl", prop: "caret-color", value: "#0000ff" },
    ]);
  });
  it("caret-(--my-caret) → caret-color: var(--my-caret)", () => {
    expect(applyClassName("caret-(--my-caret)", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "var(--my-caret)" },
    ]);
  });
  it("caret-[red] → caret-color: red", () => {
    expect(applyClassName("caret-[red]", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "red" },
    ]);
  });
});
