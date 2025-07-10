import { describe, it, expect } from "vitest";
import { rotate, rotateX, rotateY, rotateZ } from "../../../src/converter/cssmaps/rotate";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("rotate", () => {
  it("should handle rotate-45", () => {
    const token = { prefix: "rotate", value: "45" } as ParsedClassToken;
    expect(rotate(token)).toEqual({ rotate: "45deg" });
  });
  it("should handle -rotate-90 (negative)", () => {
    const token = { prefix: "rotate", value: "90", negative: true } as ParsedClassToken;
    expect(rotate(token)).toEqual({ rotate: "-90deg" });
  });
  it("should handle rotate-x-50", () => {
    const token = { prefix: "rotate-x", value: "50" } as ParsedClassToken;
    expect(rotateX(token)).toEqual({ transform: "rotateX(50deg) var(--tw-rotate-y)" });
  });
  it("should handle -rotate-y-30", () => {
    const token = { prefix: "rotate-y", value: "30", negative: true } as ParsedClassToken;
    expect(rotateY(token)).toEqual({ transform: "var(--tw-rotate-x) rotateY(-30deg)" });
  });
  it("should handle rotate-z-45", () => {
    const token = { prefix: "rotate-z", value: "45" } as ParsedClassToken;
    expect(rotateZ(token)).toEqual({ transform: "var(--tw-rotate-x) var(--tw-rotate-y) rotateZ(45deg)" });
  });
  it("should handle rotate-none", () => {
    const token = { prefix: "rotate", value: "none" } as ParsedClassToken;
    expect(rotate(token)).toEqual({ rotate: "none" });
  });
  it("should handle rotate-(--my-rotation) (customProperty)", () => {
    const token = { prefix: "rotate", customProperty: true, value: "--my-rotation" } as ParsedClassToken;
    expect(rotate(token)).toEqual({ rotate: "var(--my-rotation)" });
  });
  it("should handle rotate-[3.142rad] (arbitrary)", () => {
    const token = { prefix: "rotate", arbitrary: true, arbitraryValue: "3.142rad" } as ParsedClassToken;
    expect(rotate(token)).toEqual({ rotate: "3.142rad" });
  });
  it("should handle rotate-45! (!important)", () => {
    const token = { prefix: "rotate", value: "45", important: true } as ParsedClassToken;
    expect(rotate(token)).toEqual({ rotate: "45deg !important" });
  });
}); 