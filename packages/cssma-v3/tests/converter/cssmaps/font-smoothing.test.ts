import { describe, it, expect } from "vitest";
import { fontSmoothing } from "../../../src/converter/cssmaps/font";
import { ParsedClassToken } from "../../../src/parser/utils";

describe("fontSmoothing", () => {
  it("should handle antialiased", () => {
    const token = { prefix: "antialiased" } as ParsedClassToken;
    expect(fontSmoothing(token)).toEqual({
      "-webkit-font-smoothing": "antialiased",
      "-moz-osx-font-smoothing": "grayscale",
    });
  });
  it("should handle subpixel-antialiased", () => {
    const token = { prefix: "subpixel-antialiased" } as ParsedClassToken;
    expect(fontSmoothing(token)).toEqual({
      "-webkit-font-smoothing": "auto",
      "-moz-osx-font-smoothing": "auto",
    });
  });
}); 