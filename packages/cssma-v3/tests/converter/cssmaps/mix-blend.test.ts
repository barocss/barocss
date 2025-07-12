import { describe, it, expect } from "vitest";
import { mixBlend } from "../../../src/converter/cssmaps/mix-blend";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("mixBlend (mix-blend-mode)", () => {
  const blendModes = [
    'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
    'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference',
    'exclusion', 'hue', 'saturation', 'color', 'luminosity', 'plus-lighter',
  ];
  for (const mode of blendModes) {
    it(`should handle mix-blend-${mode}`, () => {
      const token = { prefix: "mix-blend", value: mode } as ParsedClassToken;
      expect(mixBlend(token)).toEqual({ mixBlendMode: mode });
    });
  }

  it("should return undefined for unknown mode", () => {
    const token = { prefix: "mix-blend", value: "unknown" } as ParsedClassToken;
    expect(mixBlend(token)).toBeUndefined();
  });

  it("should return undefined for missing value", () => {
    const token = { prefix: "mix-blend" } as ParsedClassToken;
    expect(mixBlend(token)).toBeUndefined();
  });
}); 