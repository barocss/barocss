import { describe, it, expect } from "vitest";
import { bgSize } from "../../../src/converter/cssmaps/bg-size";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgSize", () => {
  it("should handle bg-size-cover", () => {
    const token = { prefix: "bg-size", value: "cover" } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "cover" });
  });
  it("should handle bg-size-contain", () => {
    const token = { prefix: "bg-size", value: "contain" } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "contain" });
  });
  it("should handle bg-size-auto", () => {
    const token = { prefix: "bg-size", value: "auto" } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "auto" });
  });
  it("should handle bg-size-[50px_100px] (arbitrary)", () => {
    const token = { prefix: "bg-size", arbitrary: true, arbitraryValue: "50px 100px", value: "50px 100px" } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "50px 100px" });
  });
  it("should handle bg-size-(--my-image-size) (customProperty)", () => {
    const token = { prefix: "bg-size", customProperty: true, value: "--my-image-size" } as ParsedClassToken;
    expect(bgSize(token)).toEqual({ backgroundSize: "var(--my-image-size)" });
  });
  it("should return undefined for missing value", () => {
    expect(bgSize({ prefix: "bg-size" } as any)).toBeUndefined();
  });
  it("should return undefined for disallowed value", () => {
    const token = { prefix: "bg-size", value: "foobar" } as ParsedClassToken;
    expect(bgSize(token)).toBeUndefined();
  });
}); 