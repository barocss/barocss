import { describe, it, expect } from "vitest";
import { fontStyle } from "../../../src/converter/cssmaps/font";
import { ParsedClassToken } from "../../../src/parser/utils";

describe("fontStyle", () => {
  it("should handle italic", () => {
    const token = { prefix: "italic" } as ParsedClassToken;
    expect(fontStyle(token)).toEqual({ fontStyle: "italic" });
  });
  it("should handle not-italic", () => {
    const token = { prefix: "not-italic" } as ParsedClassToken;
    expect(fontStyle(token)).toEqual({ fontStyle: "normal" });
  });
  it("should handle font-style-[oblique]", () => {
    const token = { prefix: "font-style", arbitrary: true, arbitraryValue: "oblique" } as ParsedClassToken;
    expect(fontStyle(token)).toEqual({ fontStyle: "oblique" });
  });
}); 