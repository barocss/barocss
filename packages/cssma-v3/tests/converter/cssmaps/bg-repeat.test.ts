import { describe, it, expect } from "vitest";
import { bgRepeat } from "../../../src/converter/cssmaps/bg-repeat";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgRepeat", () => {
  it("should handle bg-repeat", () => {
    const token = { prefix: "bg-repeat", value: "repeat" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "repeat" });
  });
  it("should handle bg-repeat-x", () => {
    const token = { prefix: "bg-repeat", value: "repeat-x" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "repeat-x" });
  });
  it("should handle bg-repeat-y", () => {
    const token = { prefix: "bg-repeat", value: "repeat-y" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "repeat-y" });
  });
  it("should handle bg-repeat-space", () => {
    const token = { prefix: "bg-repeat", value: "space" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "space" });
  });
  it("should handle bg-repeat-round", () => {
    const token = { prefix: "bg-repeat", value: "round" } as ParsedClassToken;
    expect(bgRepeat(token)).toEqual({ backgroundRepeat: "round" });
  });
  it("should return undefined for disallowed value", () => {
    const token = { prefix: "bg-repeat", value: "foobar" } as ParsedClassToken;
    expect(bgRepeat(token)).toBeUndefined();
  });
  it("should return undefined for missing value", () => {
    expect(bgRepeat({ prefix: "bg-repeat" } as any)).toBeUndefined();
  });
}); 