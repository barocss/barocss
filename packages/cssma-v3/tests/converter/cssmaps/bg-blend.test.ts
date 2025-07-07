import { describe, it, expect } from "vitest";
import { bgBlend } from "../../../src/converter/cssmaps/bg-blend";
import type { ParsedClassToken } from "../../../src/parser/types";

describe("bgBlend (background-blend-mode)", () => {
  const blendModes = [
    'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
    'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
    'exclusion', 'hue', 'saturation', 'color', 'luminosity',
  ];
  for (const mode of blendModes) {
    it(`should handle bg-blend-${mode}`, () => {
      const token = { prefix: "bg-blend", value: mode } as ParsedClassToken;
      expect(bgBlend(token)).toEqual({ backgroundBlendMode: mode });
    });
  }

  it("should return undefined for unknown mode", () => {
    const token = { prefix: "bg-blend", value: "unknown" } as ParsedClassToken;
    expect(bgBlend(token)).toBeUndefined();
  });

  it("should return undefined for missing value", () => {
    const token = { prefix: "bg-blend" } as ParsedClassToken;
    expect(bgBlend(token)).toBeUndefined();
  });
}); 