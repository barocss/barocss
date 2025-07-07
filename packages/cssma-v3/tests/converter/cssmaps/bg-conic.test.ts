import { describe, it, expect } from "vitest";
import { bgConic } from "../../../src/converter/cssmaps/bg-conic";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgConic", () => {
  it("should handle default", () => {
    const token = { prefix: "bg-conic" } as ParsedClassToken;
    expect(bgConic(token)).toEqual({ backgroundImage: "conic-gradient(in oklab, var(--tw-gradient-stops))" });
  });
  it("should handle from/at/angle", () => {
    const token = { prefix: "bg-conic", value: "180deg at 50% 50%" } as ParsedClassToken;
    expect(bgConic(token)).toEqual({ backgroundImage: "conic-gradient(from 180deg at 50% 50% in oklab, var(--tw-gradient-stops))" });
  });
  it("should handle negative angle", () => {
    const token = { prefix: "bg-conic", value: "90deg", negative: true } as ParsedClassToken;
    expect(bgConic(token)).toEqual({ backgroundImage: "conic-gradient(from -90deg in oklab, var(--tw-gradient-stops))" });
  });
  it("should handle slash interpolation", () => {
    const token = { prefix: "bg-conic", value: "45deg at center", slash: "hsl" } as ParsedClassToken;
    expect(bgConic(token)).toEqual({ backgroundImage: "conic-gradient(from 45deg at center in hsl, var(--tw-gradient-stops))" });
  });
  it("should handle arbitrary value", () => {
    const token = { prefix: "bg-conic", arbitrary: true, arbitraryValue: "from 90deg at 10% 20%" } as ParsedClassToken;
    expect(bgConic(token)).toEqual({ backgroundImage: "from 90deg at 10% 20%" });
  });
  it("should handle custom property", () => {
    const token = { prefix: "bg-conic", customProperty: true, value: "--my-conic" } as ParsedClassToken;
    expect(bgConic(token)).toEqual({ backgroundImage: "var(--my-conic)" });
  });
}); 