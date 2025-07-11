import { describe, it, expect } from "vitest";
import { skew, skewX, skewY } from "../../../src/converter/cssmaps/skew";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("skew", () => {
  it("should handle skew-4", () => {
    const token = { prefix: "skew", value: "4" } as ParsedClassToken;
    expect(skew(token)).toEqual({ transform: "skewX(4deg) skewY(4deg)" });
  });
  it("should handle -skew-10 (negative)", () => {
    const token = { prefix: "skew", value: "10", negative: true } as ParsedClassToken;
    expect(skew(token)).toEqual({ transform: "skewX(-10deg) skewY(-10deg)" });
  });
  it("should handle skew-x-6", () => {
    const token = { prefix: "skew-x", value: "6" } as ParsedClassToken;
    expect(skewX(token)).toEqual({ transform: "skewX(6deg)" });
  });
  it("should handle -skew-y-12", () => {
    const token = { prefix: "skew-y", value: "12", negative: true } as ParsedClassToken;
    expect(skewY(token)).toEqual({ transform: "skewY(-12deg)" });
  });
  it("should handle skew-(--my-skew) (customProperty)", () => {
    const token = { prefix: "skew", customProperty: true, value: "--my-skew" } as ParsedClassToken;
    expect(skew(token)).toEqual({ transform: "skewX(var(--my-skew)) skewY(var(--my-skew))" });
  });
  it("should handle skew-[3.142rad] (arbitrary)", () => {
    const token = { prefix: "skew", arbitrary: true, arbitraryValue: "3.142rad" } as ParsedClassToken;
    expect(skew(token)).toEqual({ transform: "skewX(3.142rad) skewY(3.142rad)" });
  });
  it("should handle skew-4! (!important)", () => {
    const token = { prefix: "skew", value: "4", important: true } as ParsedClassToken;
    expect(skew(token)).toEqual({ transform: "skewX(4deg) skewY(4deg) !important" });
  });
}); 