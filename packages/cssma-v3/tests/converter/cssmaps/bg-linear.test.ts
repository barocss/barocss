import { describe, it, expect } from "vitest";
import { bgLinear } from "../../../src/converter/cssmaps/bg-linear";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgLinear", () => {
  it("should handle direction (to-r)", () => {
    const token = { prefix: "bg-linear", value: "to-r" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(to right, var(--tw-gradient-stops))" });
  });
  it("should handle direction (to-tl)", () => {
    const token = { prefix: "bg-linear", value: "to-tl" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(to top left, var(--tw-gradient-stops))" });
  });
  it("should handle angle (65)", () => {
    const token = { prefix: "bg-linear", value: "65" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(65, var(--tw-gradient-stops))" });
  });
  it("should handle negative angle (-65)", () => {
    const token = { prefix: "bg-linear", value: "65", negative: true } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(-65deg, var(--tw-gradient-stops))" });
  });
  it("should handle angle with deg (90deg)", () => {
    const token = { prefix: "bg-linear", value: "90deg" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(90deg, var(--tw-gradient-stops))" });
  });
  it("should handle slash interpolation (to-r/srgb)", () => {
    const token = { prefix: "bg-linear", value: "to-r", slash: "srgb" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(to right in srgb, var(--tw-gradient-stops))" });
  });
  it("should handle slash interpolation (65/oklab)", () => {
    const token = { prefix: "bg-linear", value: "65", slash: "oklab" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(65 in oklab, var(--tw-gradient-stops))" });
  });
  it("should handle arbitrary value", () => {
    const token = { prefix: "bg-linear", arbitrary: true, arbitraryValue: "25deg,red 5%,yellow 60%,lime 90%,teal" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(var(--tw-gradient-stops, 25deg,red 5%,yellow 60%,lime 90%,teal))" });
  });
  it("should handle custom property", () => {
    const token = { prefix: "bg-linear", customProperty: true, value: "--my-gradient" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(var(--tw-gradient-stops, var(--my-gradient)))" });
  });
  it("should handle undefined value", () => {
    const token = { prefix: "bg-linear" } as ParsedClassToken;
    expect(bgLinear(token)).toEqual({ backgroundImage: "linear-gradient(undefined, var(--tw-gradient-stops))" });
  });
}); 