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

describe("field-sizing ", () => {
  it("field-sizing-fixed → field-sizing: fixed", () => {
    expect(applyClassName("field-sizing-fixed", ctx)).toEqual([
      { type: "decl", prop: "field-sizing", value: "fixed" },
    ]);
  });
  it("field-sizing-content → field-sizing: content", () => {
    expect(applyClassName("field-sizing-content", ctx)).toEqual([
      { type: "decl", prop: "field-sizing", value: "content" },
    ]);
  });
});

describe("pointer-events ", () => {
  it("pointer-events-auto → pointer-events: auto", () => {
    expect(applyClassName("pointer-events-auto", ctx)).toEqual([
      { type: "decl", prop: "pointer-events", value: "auto" },
    ]);
  });
  it("pointer-events-none → pointer-events: none", () => {
    expect(applyClassName("pointer-events-none", ctx)).toEqual([
      { type: "decl", prop: "pointer-events", value: "none" },
    ]);
  });
});

describe("resize ", () => {
  it("resize → resize: both", () => {
    expect(applyClassName("resize", ctx)).toEqual([
      { type: "decl", prop: "resize", value: "both" },
    ]);
  });
  it("resize-x → resize: horizontal", () => {
    expect(applyClassName("resize-x", ctx)).toEqual([
      { type: "decl", prop: "resize", value: "horizontal" },
    ]);
  });
  it("resize-y → resize: vertical", () => {
    expect(applyClassName("resize-y", ctx)).toEqual([
      { type: "decl", prop: "resize", value: "vertical" },
    ]);
  });
  it("resize-none → resize: none", () => {
    expect(applyClassName("resize-none", ctx)).toEqual([
      { type: "decl", prop: "resize", value: "none" },
    ]);
  });
});

describe("scroll-behavior ", () => {
  it("scroll-auto → scroll-behavior: auto", () => {
    expect(applyClassName("scroll-auto", ctx)).toEqual([
      { type: "decl", prop: "scroll-behavior", value: "auto" },
    ]);
  });
  it("scroll-smooth → scroll-behavior: smooth", () => {
    expect(applyClassName("scroll-smooth", ctx)).toEqual([
      { type: "decl", prop: "scroll-behavior", value: "smooth" },
    ]);
  });
});

describe("color-scheme", () => {
  it("scheme-normal → color-scheme: normal", () => {
    expect(applyClassName("scheme-normal", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "normal" },
    ]);
  });
  it("scheme-dark → color-scheme: dark", () => {
    expect(applyClassName("scheme-dark", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "dark" },
    ]);
  });
  it("scheme-light → color-scheme: light", () => {
    expect(applyClassName("scheme-light", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "light" },
    ]);
  });
  it("scheme-light-dark → color-scheme: light dark", () => {
    expect(applyClassName("scheme-light-dark", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "light dark" },
    ]);
  });
  it("scheme-only-dark → color-scheme: only dark", () => {
    expect(applyClassName("scheme-only-dark", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "only dark" },
    ]);
  });
  it("scheme-only-light → color-scheme: only light", () => {
    expect(applyClassName("scheme-only-light", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "only light" },
    ]);
  });
});

describe("cursor ", () => {
  it("cursor-auto → cursor: auto", () => {
    expect(applyClassName("cursor-auto", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "auto" },
    ]);
  });
  it("cursor-pointer → cursor: pointer", () => {
    expect(applyClassName("cursor-pointer", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "pointer" },
    ]);
  });
  it("cursor-wait → cursor: wait", () => {
    expect(applyClassName("cursor-wait", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "wait" },
    ]);
  });
  it("cursor-grab → cursor: grab", () => {
    expect(applyClassName("cursor-grab", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "grab" },
    ]);
  });
  it("cursor-ns-resize → cursor: ns-resize", () => {
    expect(applyClassName("cursor-ns-resize", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "ns-resize" },
    ]);
  });
  it("cursor-zoom-in → cursor: zoom-in", () => {
    expect(applyClassName("cursor-zoom-in", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "zoom-in" },
    ]);
  });
  it("cursor-(--my-cursor) → cursor: var(--my-cursor)", () => {
    expect(applyClassName("cursor-(--my-cursor)", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "var(--my-cursor)" },
    ]);
  });
  it("cursor-[url(my-cursor.png),pointer] → cursor: url(my-cursor.png),pointer", () => {
    expect(applyClassName("cursor-[url(my-cursor.png),pointer]", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "url(my-cursor.png),pointer" },
    ]);
  });
});


describe("scroll-margin ", () => {

  [
    ["m", "scroll-margin"],
    ["mt", "scroll-margin-top"],
    ["mr", "scroll-margin-right"],
    ["mb", "scroll-margin-bottom"],
    ["ml", "scroll-margin-left"],
    ["mx", "scroll-margin-inline"],
    ["my", "scroll-margin-block"],
    ["ms", "scroll-margin-inline-start"],
    ["me", "scroll-margin-inline-end"],
  ].forEach(([name, prop]) => {
    it(`scroll-${name}-1 → ${prop}: calc(var(--spacing) * 1)`, () => {
      expect(applyClassName(`scroll-${name}-1`, ctx)).toEqual([
        { type: "decl", prop, value: `calc(var(--spacing) * 1)` },
      ]);
    });
    it(`-scroll-${name}-1 → ${prop}: calc(var(--spacing) * -1)`, () => {
      expect(applyClassName(`-scroll-${name}-1`, ctx)).toEqual([
        { type: "decl", prop, value: `calc(var(--spacing) * -1)` },
      ]);
    });

    it(`scroll-${name}-[var(--spacing)] → ${prop}: var(--spacing)`, () => {
      expect(applyClassName(`scroll-${name}-[var(--spacing)]`, ctx)).toEqual([
        { type: "decl", prop, value: `var(--spacing)` },
      ]);
    });

    it(`scroll-${name}-(--my-scroll-margin) → ${prop}: var(--my-scroll-margin)`, () => {
      expect(applyClassName(`scroll-${name}-(--my-scroll-margin)`, ctx)).toEqual([
        { type: "decl", prop, value: `var(--my-scroll-margin)` },
      ]);
    });

  });
  
  
});




describe("scroll-padding ", () => {

  [
    ["p", "scroll-padding"],
    ["pt", "scroll-padding-top"],
    ["pr", "scroll-padding-right"],
    ["pb", "scroll-padding-bottom"],
    ["pl", "scroll-padding-left"],
    ["px", "scroll-padding-inline"],
    ["py", "scroll-padding-block"],
    ["ps", "scroll-padding-inline-start"],
    ["pe", "scroll-padding-inline-end"],
  ].forEach(([name, prop]) => {
    it(`scroll-${name}-1 → ${prop}: calc(var(--spacing) * 1)`, () => {
      expect(applyClassName(`scroll-${name}-1`, ctx)).toEqual([
        { type: "decl", prop, value: `calc(var(--spacing) * 1)` },
      ]);
    });
    it(`-scroll-${name}-1 → ${prop}: calc(var(--spacing) * -1)`, () => {
      expect(applyClassName(`-scroll-${name}-1`, ctx)).toEqual([
        { type: "decl", prop, value: `calc(var(--spacing) * -1)` },
      ]);
    });

    it(`scroll-${name}-[var(--spacing)] → ${prop}: var(--spacing)`, () => {
      expect(applyClassName(`scroll-${name}-[var(--spacing)]`, ctx)).toEqual([
        { type: "decl", prop, value: `var(--spacing)` },
      ]);
    });

    it(`scroll-${name}-(--my-scroll-margin) → ${prop}: var(--my-scroll-margin)`, () => {
      expect(applyClassName(`scroll-${name}-(--my-scroll-margin)`, ctx)).toEqual([
        { type: "decl", prop, value: `var(--my-scroll-margin)` },
      ]);
    });

  });
  
  
});

describe("scroll-snap-align", () => {
  it("snap-start → scroll-snap-align: start", () => {
    expect(applyClassName("snap-start", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-align", value: "start" },
    ]);
  });
  it("snap-end → scroll-snap-align: end", () => {
    expect(applyClassName("snap-end", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-align", value: "end" },
    ]);
  });
  it("snap-center → scroll-snap-align: center", () => {
    expect(applyClassName("snap-center", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-align", value: "center" },
    ]);
  });
  it("snap-align-none → scroll-snap-align: none", () => {
    expect(applyClassName("snap-align-none", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-align", value: "none" },
    ]);
  });
});

describe("scroll-snap-stop", () => {
  it("snap-normal → scroll-snap-stop: normal", () => {
    expect(applyClassName("snap-normal", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-stop", value: "normal" },
    ]);
  });
  it("snap-always → scroll-snap-stop: always", () => {
    expect(applyClassName("snap-always", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-stop", value: "always" },
    ]);
  });
});

describe("scroll-snap-type", () => {
  it("snap-none → scroll-snap-type: none", () => {
    expect(applyClassName("snap-none", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-type", value: "none" },
    ]);
  });
  it("snap-x → scroll-snap-type: x var(--tw-scroll-snap-strictness)", () => {
    expect(applyClassName("snap-x", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-type", value: "x var(--tw-scroll-snap-strictness)" },
    ]);
  });
  it("snap-y → scroll-snap-type: y var(--tw-scroll-snap-strictness)", () => {
    expect(applyClassName("snap-y", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-type", value: "y var(--tw-scroll-snap-strictness)" },
    ]);
  });
  it("snap-both → scroll-snap-type: both var(--tw-scroll-snap-strictness)", () => {
    expect(applyClassName("snap-both", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-type", value: "both var(--tw-scroll-snap-strictness)" },
    ]);
  });
  it("snap-mandatory → --tw-scroll-snap-strictness: mandatory", () => {
    expect(applyClassName("snap-mandatory", ctx)).toEqual([
      { type: "decl", prop: "--tw-scroll-snap-strictness", value: "mandatory" },
    ]);
  });
  it("snap-proximity → --tw-scroll-snap-strictness: proximity", () => {
    expect(applyClassName("snap-proximity", ctx)).toEqual([
      { type: "decl", prop: "--tw-scroll-snap-strictness", value: "proximity" },
    ]);
  });
});

describe("touch-action", () => {
  it("touch-auto → touch-action: auto", () => {
    expect(applyClassName("touch-auto", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "auto" },
    ]);
  });
  it("touch-none → touch-action: none", () => {
    expect(applyClassName("touch-none", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "none" },
    ]);
  });
  it("touch-pan-x → touch-action: pan-x", () => {
    expect(applyClassName("touch-pan-x", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-x" },
    ]);
  });
  it("touch-pan-left → touch-action: pan-left", () => {
    expect(applyClassName("touch-pan-left", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-left" },
    ]);
  });
  it("touch-pan-right → touch-action: pan-right", () => {
    expect(applyClassName("touch-pan-right", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-right" },
    ]);
  });
  it("touch-pan-y → touch-action: pan-y", () => {
    expect(applyClassName("touch-pan-y", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-y" },
    ]);
  });
  it("touch-pan-up → touch-action: pan-up", () => {
    expect(applyClassName("touch-pan-up", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-up" },
    ]);
  });
  it("touch-pan-down → touch-action: pan-down", () => {
    expect(applyClassName("touch-pan-down", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-down" },
    ]);
  });
  it("touch-pinch-zoom → touch-action: pinch-zoom", () => {
    expect(applyClassName("touch-pinch-zoom", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pinch-zoom" },
    ]);
  });
  it("touch-manipulation → touch-action: manipulation", () => {
    expect(applyClassName("touch-manipulation", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "manipulation" },
    ]);
  });
});

describe("user-select", () => {
  it("select-none → user-select: none", () => {
    expect(applyClassName("select-none", ctx)).toEqual([
      { type: "decl", prop: "user-select", value: "none" },
    ]);
  });
  it("select-text → user-select: text", () => {
    expect(applyClassName("select-text", ctx)).toEqual([
      { type: "decl", prop: "user-select", value: "text" },
    ]);
  });
  it("select-all → user-select: all", () => {
    expect(applyClassName("select-all", ctx)).toEqual([
      { type: "decl", prop: "user-select", value: "all" },
    ]);
  });
  it("select-auto → user-select: auto", () => {
    expect(applyClassName("select-auto", ctx)).toEqual([
      { type: "decl", prop: "user-select", value: "auto" },
    ]);
  });
});

describe("will-change", () => {
  it("will-change-auto → will-change: auto", () => {
    expect(applyClassName("will-change-auto", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "auto" },
    ]);
  });
  it("will-change-scroll → will-change: scroll-position", () => {
    expect(applyClassName("will-change-scroll", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "scroll-position" },
    ]);
  });
  it("will-change-contents → will-change: contents", () => {
    expect(applyClassName("will-change-contents", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "contents" },
    ]);
  });
  it("will-change-transform → will-change: transform", () => {
    expect(applyClassName("will-change-transform", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "transform" },
    ]);
  });
  it("will-change-[opacity] → will-change: opacity", () => {
    expect(applyClassName("will-change-[opacity]", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "opacity" },
    ]);
  });
  it("will-change-(--my-will) → will-change: var(--my-will)", () => {
    expect(applyClassName("will-change-(--my-will)", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "var(--my-will)" },
    ]);
  });
});