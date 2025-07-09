import { ParsedClassToken } from "./../../../src/parser/utils";
import { describe, it, expect } from "vitest";
import { fontVariantNumeric } from "../../../src/converter/cssmaps/font";

describe("fontVariantNumeric", () => {
  it("should handle normal-nums", () => {
    const token = { prefix: "normal-nums" } as ParsedClassToken;
    expect(fontVariantNumeric(token)).toEqual({ fontVariantNumeric: "normal" });
  });
  it("should handle ordinal", () => {
    const token = { prefix: "ordinal" } as ParsedClassToken;
    expect(fontVariantNumeric(token)).toEqual({
      fontVariantNumeric: "ordinal",
    });
  });
  it("should handle slashed-zero", () => {
    const token = { prefix: "slashed-zero" } as ParsedClassToken;
    expect(fontVariantNumeric(token)).toEqual({
      fontVariantNumeric: "slashed-zero",
    });
  });
});
