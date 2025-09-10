import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
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
    expect(parseClassToAst("accent-inherit", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "inherit" },
    ]);
  });
  it("accent-current → accent-color: currentColor", () => {
    expect(parseClassToAst("accent-current", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "currentColor" },
    ]);
  });
  it("accent-transparent → accent-color: transparent", () => {
    expect(parseClassToAst("accent-transparent", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "transparent" },
    ]);
  });
  it("accent-black → accent-color: #000", () => {
    expect(parseClassToAst("accent-black", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "var(--color-black)" },
    ]);
  });
  it("accent-white → accent-color: #fff", () => {
    expect(parseClassToAst("accent-white", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "var(--color-white)" },
    ]);
  });
  it("accent-blue-500 → accent-color: #0000ff", () => {
    expect(parseClassToAst("accent-blue-500", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "var(--color-blue-500)" },
    ]);
  });
  it("accent-blue-500/50 → accent-color: #0000ff/50%", () => {
    expect(parseClassToAst("accent-blue-500/50", ctx)).toEqual([
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
    expect(parseClassToAst("accent-[rebeccapurple]", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "rebeccapurple" },
    ]);
  });
  it("accent-(--my-accent) → accent-color: var(--my-accent)", () => {
    expect(parseClassToAst("accent-(--my-accent)", ctx)).toEqual([
      { type: "decl", prop: "accent-color", value: "var(--my-accent)" },
    ]);
  });
});

describe("appearance ", () => {
  it("appearance-none → appearance: none", () => {
    expect(parseClassToAst("appearance-none", ctx)).toEqual([
      { type: "decl", prop: "appearance", value: "none" },
    ]);
  });
  it("appearance-auto → appearance: auto", () => {
    expect(parseClassToAst("appearance-auto", ctx)).toEqual([
      { type: "decl", prop: "appearance", value: "auto" },
    ]);
  });
});

describe("caret-color ", () => {
  it("caret-inherit → caret-color: inherit", () => {
    expect(parseClassToAst("caret-inherit", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "inherit" },
    ]);
  });
  it("caret-current → caret-color: currentColor", () => {
    expect(parseClassToAst("caret-current", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "currentColor" },
    ]);
  });
  it("caret-transparent → caret-color: transparent", () => {
    expect(parseClassToAst("caret-transparent", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "transparent" },
    ]);
  });
  it("caret-black → caret-color: #000", () => {
    expect(parseClassToAst("caret-black", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "var(--color-black)" },
    ]);
  });
  it("caret-white → caret-color: #fff", () => {
    expect(parseClassToAst("caret-white", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "var(--color-white)" },
    ]);
  });
  it("caret-blue-500 → caret-color: var(--color-blue-500)", () => {
    expect(parseClassToAst("caret-blue-500", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "var(--color-blue-500)" },
    ]);
  });
  it("caret-blue-500/50 → caret-color: #0000ff/50%", () => {
    expect(parseClassToAst("caret-blue-500/50", ctx)).toEqual([
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
    expect(parseClassToAst("caret-(--my-caret)", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "var(--my-caret)" },
    ]);
  });
  it("caret-[red] → caret-color: red", () => {
    expect(parseClassToAst("caret-[red]", ctx)).toEqual([
      { type: "decl", prop: "caret-color", value: "red" },
    ]);
  });
});

describe("field-sizing ", () => {
  it("field-sizing-fixed → field-sizing: fixed", () => {
    expect(parseClassToAst("field-sizing-fixed", ctx)).toEqual([
      { type: "decl", prop: "field-sizing", value: "fixed" },
    ]);
  });
  it("field-sizing-content → field-sizing: content", () => {
    expect(parseClassToAst("field-sizing-content", ctx)).toEqual([
      { type: "decl", prop: "field-sizing", value: "content" },
    ]);
  });
});

describe("pointer-events ", () => {
  it("pointer-events-auto → pointer-events: auto", () => {
    expect(parseClassToAst("pointer-events-auto", ctx)).toEqual([
      { type: "decl", prop: "pointer-events", value: "auto" },
    ]);
  });
  it("pointer-events-none → pointer-events: none", () => {
    expect(parseClassToAst("pointer-events-none", ctx)).toEqual([
      { type: "decl", prop: "pointer-events", value: "none" },
    ]);
  });
});

describe("resize ", () => {
  it("resize → resize: both", () => {
    expect(parseClassToAst("resize", ctx)).toEqual([
      { type: "decl", prop: "resize", value: "both" },
    ]);
  });
  it("resize-x → resize: horizontal", () => {
    expect(parseClassToAst("resize-x", ctx)).toEqual([
      { type: "decl", prop: "resize", value: "horizontal" },
    ]);
  });
  it("resize-y → resize: vertical", () => {
    expect(parseClassToAst("resize-y", ctx)).toEqual([
      { type: "decl", prop: "resize", value: "vertical" },
    ]);
  });
  it("resize-none → resize: none", () => {
    expect(parseClassToAst("resize-none", ctx)).toEqual([
      { type: "decl", prop: "resize", value: "none" },
    ]);
  });
});

describe("scroll-behavior ", () => {
  it("scroll-auto → scroll-behavior: auto", () => {
    expect(parseClassToAst("scroll-auto", ctx)).toEqual([
      { type: "decl", prop: "scroll-behavior", value: "auto" },
    ]);
  });
  it("scroll-smooth → scroll-behavior: smooth", () => {
    expect(parseClassToAst("scroll-smooth", ctx)).toEqual([
      { type: "decl", prop: "scroll-behavior", value: "smooth" },
    ]);
  });
});

describe("color-scheme", () => {
  it("scheme-normal → color-scheme: normal", () => {
    expect(parseClassToAst("scheme-normal", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "normal" },
    ]);
  });
  it("scheme-dark → color-scheme: dark", () => {
    expect(parseClassToAst("scheme-dark", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "dark" },
    ]);
  });
  it("scheme-light → color-scheme: light", () => {
    expect(parseClassToAst("scheme-light", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "light" },
    ]);
  });
  it("scheme-light-dark → color-scheme: light dark", () => {
    expect(parseClassToAst("scheme-light-dark", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "light dark" },
    ]);
  });
  it("scheme-only-dark → color-scheme: only dark", () => {
    expect(parseClassToAst("scheme-only-dark", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "only dark" },
    ]);
  });
  it("scheme-only-light → color-scheme: only light", () => {
    expect(parseClassToAst("scheme-only-light", ctx)).toEqual([
      { type: "decl", prop: "color-scheme", value: "only light" },
    ]);
  });
});

describe("cursor ", () => {
  it("cursor-auto → cursor: auto", () => {
    expect(parseClassToAst("cursor-auto", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "auto" },
    ]);
  });
  it("cursor-pointer → cursor: pointer", () => {
    expect(parseClassToAst("cursor-pointer", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "pointer" },
    ]);
  });
  it("cursor-wait → cursor: wait", () => {
    expect(parseClassToAst("cursor-wait", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "wait" },
    ]);
  });
  it("cursor-grab → cursor: grab", () => {
    expect(parseClassToAst("cursor-grab", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "grab" },
    ]);
  });
  it("cursor-ns-resize → cursor: ns-resize", () => {
    expect(parseClassToAst("cursor-ns-resize", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "ns-resize" },
    ]);
  });
  it("cursor-zoom-in → cursor: zoom-in", () => {
    expect(parseClassToAst("cursor-zoom-in", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "zoom-in" },
    ]);
  });
  it("cursor-(--my-cursor) → cursor: var(--my-cursor)", () => {
    expect(parseClassToAst("cursor-(--my-cursor)", ctx)).toEqual([
      { type: "decl", prop: "cursor", value: "var(--my-cursor)" },
    ]);
  });
  it("cursor-[url(my-cursor.png),pointer] → cursor: url(my-cursor.png),pointer", () => {
    expect(parseClassToAst("cursor-[url(my-cursor.png),pointer]", ctx)).toEqual([
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
      expect(parseClassToAst(`scroll-${name}-1`, ctx)).toEqual([
        { type: "decl", prop, value: `calc(var(--spacing) * 1)` },
      ]);
    });
    it(`-scroll-${name}-1 → ${prop}: calc(var(--spacing) * -1)`, () => {
      expect(parseClassToAst(`-scroll-${name}-1`, ctx)).toEqual([
        { type: "decl", prop, value: `calc(var(--spacing) * -1)` },
      ]);
    });

    it(`scroll-${name}-[var(--spacing)] → ${prop}: var(--spacing)`, () => {
      expect(parseClassToAst(`scroll-${name}-[var(--spacing)]`, ctx)).toEqual([
        { type: "decl", prop, value: `var(--spacing)` },
      ]);
    });

    it(`scroll-${name}-(--my-scroll-margin) → ${prop}: var(--my-scroll-margin)`, () => {
      expect(parseClassToAst(`scroll-${name}-(--my-scroll-margin)`, ctx)).toEqual([
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
      expect(parseClassToAst(`scroll-${name}-1`, ctx)).toEqual([
        { type: "decl", prop, value: `calc(var(--spacing) * 1)` },
      ]);
    });
    it(`-scroll-${name}-1 → ${prop}: calc(var(--spacing) * -1)`, () => {
      expect(parseClassToAst(`-scroll-${name}-1`, ctx)).toEqual([
        { type: "decl", prop, value: `calc(var(--spacing) * -1)` },
      ]);
    });

    it(`scroll-${name}-[var(--spacing)] → ${prop}: var(--spacing)`, () => {
      expect(parseClassToAst(`scroll-${name}-[var(--spacing)]`, ctx)).toEqual([
        { type: "decl", prop, value: `var(--spacing)` },
      ]);
    });

    it(`scroll-${name}-(--my-scroll-margin) → ${prop}: var(--my-scroll-margin)`, () => {
      expect(parseClassToAst(`scroll-${name}-(--my-scroll-margin)`, ctx)).toEqual([
        { type: "decl", prop, value: `var(--my-scroll-margin)` },
      ]);
    });

  });
  
  
});

describe("scroll-snap-align", () => {
  it("snap-start → scroll-snap-align: start", () => {
    expect(parseClassToAst("snap-start", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-align", value: "start" },
    ]);
  });
  it("snap-end → scroll-snap-align: end", () => {
    expect(parseClassToAst("snap-end", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-align", value: "end" },
    ]);
  });
  it("snap-center → scroll-snap-align: center", () => {
    expect(parseClassToAst("snap-center", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-align", value: "center" },
    ]);
  });
  it("snap-align-none → scroll-snap-align: none", () => {
    expect(parseClassToAst("snap-align-none", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-align", value: "none" },
    ]);
  });
});

describe("scroll-snap-stop", () => {
  it("snap-normal → scroll-snap-stop: normal", () => {
    expect(parseClassToAst("snap-normal", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-stop", value: "normal" },
    ]);
  });
  it("snap-always → scroll-snap-stop: always", () => {
    expect(parseClassToAst("snap-always", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-stop", value: "always" },
    ]);
  });
});

describe("scroll-snap-type", () => {
  it("snap-none → scroll-snap-type: none", () => {
    expect(parseClassToAst("snap-none", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-type", value: "none" },
    ]);
  });
  it("snap-x → scroll-snap-type: x var(--baro-scroll-snap-strictness)", () => {
    expect(parseClassToAst("snap-x", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-type", value: "x var(--baro-scroll-snap-strictness)" },
    ]);
  });
  it("snap-y → scroll-snap-type: y var(--baro-scroll-snap-strictness)", () => {
    expect(parseClassToAst("snap-y", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-type", value: "y var(--baro-scroll-snap-strictness)" },
    ]);
  });
  it("snap-both → scroll-snap-type: both var(--baro-scroll-snap-strictness)", () => {
    expect(parseClassToAst("snap-both", ctx)).toEqual([
      { type: "decl", prop: "scroll-snap-type", value: "both var(--baro-scroll-snap-strictness)" },
    ]);
  });
  it("snap-mandatory → --baro-scroll-snap-strictness: mandatory", () => {
    expect(parseClassToAst("snap-mandatory", ctx)).toEqual([
      { type: "decl", prop: "--baro-scroll-snap-strictness", value: "mandatory" },
    ]);
  });
  it("snap-proximity → --baro-scroll-snap-strictness: proximity", () => {
    expect(parseClassToAst("snap-proximity", ctx)).toEqual([
      { type: "decl", prop: "--baro-scroll-snap-strictness", value: "proximity" },
    ]);
  });
});

describe("touch-action", () => {
  it("touch-auto → touch-action: auto", () => {
    expect(parseClassToAst("touch-auto", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "auto" },
    ]);
  });
  it("touch-none → touch-action: none", () => {
    expect(parseClassToAst("touch-none", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "none" },
    ]);
  });
  it("touch-pan-x → touch-action: pan-x", () => {
    expect(parseClassToAst("touch-pan-x", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-x" },
    ]);
  });
  it("touch-pan-left → touch-action: pan-left", () => {
    expect(parseClassToAst("touch-pan-left", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-left" },
    ]);
  });
  it("touch-pan-right → touch-action: pan-right", () => {
    expect(parseClassToAst("touch-pan-right", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-right" },
    ]);
  });
  it("touch-pan-y → touch-action: pan-y", () => {
    expect(parseClassToAst("touch-pan-y", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-y" },
    ]);
  });
  it("touch-pan-up → touch-action: pan-up", () => {
    expect(parseClassToAst("touch-pan-up", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-up" },
    ]);
  });
  it("touch-pan-down → touch-action: pan-down", () => {
    expect(parseClassToAst("touch-pan-down", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pan-down" },
    ]);
  });
  it("touch-pinch-zoom → touch-action: pinch-zoom", () => {
    expect(parseClassToAst("touch-pinch-zoom", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "pinch-zoom" },
    ]);
  });
  it("touch-manipulation → touch-action: manipulation", () => {
    expect(parseClassToAst("touch-manipulation", ctx)).toEqual([
      { type: "decl", prop: "touch-action", value: "manipulation" },
    ]);
  });
});

describe("user-select", () => {
  it("select-none → user-select: none", () => {
    expect(parseClassToAst("select-none", ctx)).toEqual([
      { type: "decl", prop: "user-select", value: "none" },
    ]);
  });
  it("select-text → user-select: text", () => {
    expect(parseClassToAst("select-text", ctx)).toEqual([
      { type: "decl", prop: "user-select", value: "text" },
    ]);
  });
  it("select-all → user-select: all", () => {
    expect(parseClassToAst("select-all", ctx)).toEqual([
      { type: "decl", prop: "user-select", value: "all" },
    ]);
  });
  it("select-auto → user-select: auto", () => {
    expect(parseClassToAst("select-auto", ctx)).toEqual([
      { type: "decl", prop: "user-select", value: "auto" },
    ]);
  });
});

describe("will-change", () => {
  it("will-change-auto → will-change: auto", () => {
    expect(parseClassToAst("will-change-auto", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "auto" },
    ]);
  });
  it("will-change-scroll → will-change: scroll-position", () => {
    expect(parseClassToAst("will-change-scroll", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "scroll-position" },
    ]);
  });
  it("will-change-contents → will-change: contents", () => {
    expect(parseClassToAst("will-change-contents", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "contents" },
    ]);
  });
  it("will-change-transform → will-change: transform", () => {
    expect(parseClassToAst("will-change-transform", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "transform" },
    ]);
  });
  it("will-change-[opacity] → will-change: opacity", () => {
    expect(parseClassToAst("will-change-[opacity]", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "opacity" },
    ]);
  });
  it("will-change-(--my-will) → will-change: var(--my-will)", () => {
    expect(parseClassToAst("will-change-(--my-will)", ctx)).toEqual([
      { type: "decl", prop: "will-change", value: "var(--my-will)" },
    ]);
  });
});