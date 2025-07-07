import { describe, it, expect } from "vitest";
import { bgRadial } from "../../../src/converter/cssmaps/bg-radial";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgRadial", () => {
  it("should handle default", () => {
    const token = { prefix: "bg-radial" } as ParsedClassToken;
    expect(bgRadial(token)).toEqual({ backgroundImage: "radial-gradient(var(--tw-gradient-stops))" });
  });
  it("should handle shape/at/size", () => {
    const token = { prefix: "bg-radial", value: "circle at 50% 75%" } as ParsedClassToken;
    expect(bgRadial(token)).toEqual({ backgroundImage: "radial-gradient(circle at 50% 75%, var(--tw-gradient-stops))" });
  });
  it("should handle slash interpolation", () => {
    const token = { prefix: "bg-radial", value: "ellipse at center", slash: "oklab" } as ParsedClassToken;
    expect(bgRadial(token)).toEqual({ backgroundImage: "radial-gradient(ellipse at center in oklab, var(--tw-gradient-stops))" });
  });
  it("should handle arbitrary value", () => {
    const token = { prefix: "bg-radial", arbitrary: true, arbitraryValue: "circle at 10% 20%" } as ParsedClassToken;
    expect(bgRadial(token)).toEqual({ backgroundImage: "radial-gradient(var(--tw-gradient-stops, circle at 10% 20%))" });
  });
  it("should handle custom property", () => {
    const token = { prefix: "bg-radial", customProperty: true, value: "--my-radial" } as ParsedClassToken;
    expect(bgRadial(token)).toEqual({ backgroundImage: "radial-gradient(var(--tw-gradient-stops, var(--my-radial)))" });
  });
}); 