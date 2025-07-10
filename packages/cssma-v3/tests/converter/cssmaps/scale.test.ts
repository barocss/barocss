import { describe, it, expect } from "vitest";
import { scale, scaleX, scaleY, scaleZ, scale3d } from "../../../src/converter/cssmaps/scale";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("scale", () => {
  it("should handle scale-100", () => {
    const token = { prefix: "scale", value: "100" } as ParsedClassToken;
    expect(scale(token)).toEqual({ scale: "100% 100%" });
  });
  it("should handle scale-75", () => {
    const token = { prefix: "scale", value: "75" } as ParsedClassToken;
    expect(scale(token)).toEqual({ scale: "75% 75%" });
  });
  it("should handle -scale-125 (negative)", () => {
    const token = { prefix: "scale", value: "125", negative: true } as ParsedClassToken;
    expect(scale(token)).toEqual({ scale: "calc(125% * -1) calc(125% * -1)" });
  });
  it("should handle scale-x-110", () => {
    const token = { prefix: "scale-x", value: "110" } as ParsedClassToken;
    expect(scaleX(token)).toEqual({ scale: "110% var(--tw-scale-y)" });
  });
  it("should handle scale-y-90", () => {
    const token = { prefix: "scale-y", value: "90" } as ParsedClassToken;
    expect(scaleY(token)).toEqual({ scale: "var(--tw-scale-x) 90%" });
  });
  it("should handle scale-z-80", () => {
    const token = { prefix: "scale-z", value: "80" } as ParsedClassToken;
    expect(scaleZ(token)).toEqual({ scale: "var(--tw-scale-x) var(--tw-scale-y) 80%" });
  });
  it("should handle scale-3d", () => {
    const token = { prefix: "scale", value: "3d" } as ParsedClassToken;
    expect(scale3d(token)).toEqual({ scale: "var(--tw-scale-x) var(--tw-scale-y) var(--tw-scale-z)" });
  });
  it("should handle scale-none", () => {
    const token = { prefix: "scale", value: "none" } as ParsedClassToken;
    expect(scale(token)).toEqual({ scale: "none" });
  });
  it("should handle scale-(--my-scale) (customProperty)", () => {
    const token = { prefix: "scale", customProperty: true, value: "--my-scale" } as ParsedClassToken;
    expect(scale(token)).toEqual({ scale: "var(--my-scale) var(--my-scale)" });
  });
  it("should handle scale-[1.7] (arbitrary)", () => {
    const token = { prefix: "scale", arbitrary: true, arbitraryValue: "1.7" } as ParsedClassToken;
    expect(scale(token)).toEqual({ scale: "1.7" });
  });
  it("should handle scale-100! (!important)", () => {
    const token = { prefix: "scale", value: "100", important: true } as ParsedClassToken;
    expect(scale(token)).toEqual({ scale: "100% 100% !important" });
  });
}); 