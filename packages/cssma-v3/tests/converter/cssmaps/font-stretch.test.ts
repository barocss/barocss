import { describe, it, expect } from "vitest";
import { fontStretch } from "../../../src/converter/cssmaps/font";
import { ParsedClassToken } from "../../../src/parser/utils";

describe("fontStretch", () => {
  it("should handle font-stretch-[condensed]", () => {
    const token = { prefix: "font-stretch", arbitrary: true, arbitraryValue: "condensed" } as ParsedClassToken;
    expect(fontStretch(token)).toEqual({ fontStretch: "condensed" });
  });
  it("should handle font-stretch-(--my-stretch)", () => {
    const token = { prefix: "font-stretch", customProperty: true, value: "--my-stretch" } as ParsedClassToken;
    expect(fontStretch(token)).toEqual({ fontStretch: "var(--my-stretch)" });
  });
}); 