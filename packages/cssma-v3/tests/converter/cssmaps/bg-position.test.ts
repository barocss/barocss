import { describe, it, expect } from "vitest";
import { bgPosition } from "../../../src/converter/cssmaps/bg-position";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgPosition", () => {
  it("should handle bg-position-top-left", () => {
    const token = { prefix: "bg-position", value: "top-left" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "top left" });
  });
  it("should handle bg-position-top", () => {
    const token = { prefix: "bg-position", value: "top" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "top" });
  });
  it("should handle bg-position-top-right", () => {
    const token = { prefix: "bg-position", value: "top-right" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "top right" });
  });
  it("should handle bg-position-left", () => {
    const token = { prefix: "bg-position", value: "left" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "left" });
  });
  it("should handle bg-position-center", () => {
    const token = { prefix: "bg-position", value: "center" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "center" });
  });
  it("should handle bg-position-right", () => {
    const token = { prefix: "bg-position", value: "right" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "right" });
  });
  it("should handle bg-position-bottom-left", () => {
    const token = { prefix: "bg-position", value: "bottom-left" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "bottom left" });
  });
  it("should handle bg-position-bottom", () => {
    const token = { prefix: "bg-position", value: "bottom" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "bottom" });
  });
  it("should handle bg-position-bottom-right", () => {
    const token = { prefix: "bg-position", value: "bottom-right" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "bottom right" });
  });
  it("should handle bg-position-[10px_20px] (arbitrary)", () => {
    const token = { prefix: "bg-position", arbitrary: true, arbitraryValue: "10px 20px", value: "10px 20px" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "10px 20px" });
  });
  it("should handle bg-position-(--my-bg-position) (customProperty)", () => {
    const token = { prefix: "bg-position", customProperty: true, value: "--my-bg-position" } as ParsedClassToken;
    expect(bgPosition(token)).toEqual({ backgroundPosition: "var(--my-bg-position)" });
  });
  it("should return undefined for disallowed value", () => {
    const token = { prefix: "bg-position", value: "foobar" } as ParsedClassToken;
    expect(bgPosition(token)).toBeUndefined();
  });
  it("should return undefined for missing value", () => {
    expect(bgPosition({ prefix: "bg-position" } as any)).toBeUndefined();
  });
}); 