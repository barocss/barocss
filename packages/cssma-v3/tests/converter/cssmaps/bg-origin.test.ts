import { describe, it, expect } from "vitest";
import { bgOrigin } from "../../../src/converter/cssmaps/bg-origin";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgOrigin", () => {
  it("should handle bg-origin-border", () => {
    const token = { prefix: "bg-origin", value: "border" } as ParsedClassToken;
    expect(bgOrigin(token)).toEqual({ backgroundOrigin: "border-box" });
  });
  it("should handle bg-origin-padding", () => {
    const token = { prefix: "bg-origin", value: "padding" } as ParsedClassToken;
    expect(bgOrigin(token)).toEqual({ backgroundOrigin: "padding-box" });
  });
  it("should handle bg-origin-content", () => {
    const token = { prefix: "bg-origin", value: "content" } as ParsedClassToken;
    expect(bgOrigin(token)).toEqual({ backgroundOrigin: "content-box" });
  });
  it("should return undefined for disallowed value", () => {
    const token = { prefix: "bg-origin", value: "foobar" } as ParsedClassToken;
    expect(bgOrigin(token)).toBeUndefined();
  });
  it("should return undefined for missing value", () => {
    expect(bgOrigin({ prefix: "bg-origin" } as any)).toBeUndefined();
  });
}); 