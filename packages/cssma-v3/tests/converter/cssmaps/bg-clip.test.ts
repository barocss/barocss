import { describe, it, expect } from "vitest";
import { bgClip } from "../../../src/converter/cssmaps/bg-clip";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgClip", () => {
  it("should handle bg-clip-border", () => {
    const token = { prefix: "bg-clip", value: "border" } as ParsedClassToken;
    expect(bgClip(token)).toEqual({ backgroundClip: "border-box" });
  });
  it("should handle bg-clip-padding", () => {
    const token = { prefix: "bg-clip", value: "padding" } as ParsedClassToken;
    expect(bgClip(token)).toEqual({ backgroundClip: "padding-box" });
  });
  it("should handle bg-clip-content", () => {
    const token = { prefix: "bg-clip", value: "content" } as ParsedClassToken;
    expect(bgClip(token)).toEqual({ backgroundClip: "content-box" });
  });
  it("should handle bg-clip-text", () => {
    const token = { prefix: "bg-clip", value: "text" } as ParsedClassToken;
    expect(bgClip(token)).toEqual({ backgroundClip: "text" });
  });
  it("should return undefined for disallowed value", () => {
    const token = { prefix: "bg-clip", value: "foobar" } as ParsedClassToken;
    expect(bgClip(token)).toBeUndefined();
  });
  it("should return undefined for missing value", () => {
    expect(bgClip({ prefix: "bg-clip" } as any)).toBeUndefined();
  });
}); 