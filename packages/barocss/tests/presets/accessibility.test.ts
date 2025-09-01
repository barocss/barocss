import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

const ctx = createContext({});

describe("forced-color-adjust", () => {
  it("forced-color-adjust-auto → forced-color-adjust: auto", () => {
    expect(parseClassToAst("forced-color-adjust-auto", ctx)).toEqual([
      { type: "decl", prop: "forced-color-adjust", value: "auto" },
    ]);
  });
  it("forced-color-adjust-none → forced-color-adjust: none", () => {
    expect(parseClassToAst("forced-color-adjust-none", ctx)).toEqual([
      { type: "decl", prop: "forced-color-adjust", value: "none" },
    ]);
  });
}); 