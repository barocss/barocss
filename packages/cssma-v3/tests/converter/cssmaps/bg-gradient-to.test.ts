import { describe, it, expect } from "vitest";
import { bgGradientTo } from "../../../src/converter/cssmaps/bg-gradient-to";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgGradientTo", () => {
  it("should handle bg-gradient-to-r", () => {
    const token = { prefix: "bg-gradient-to", value: "to right" } as ParsedClassToken;
    expect(bgGradientTo(token)).toEqual({ backgroundImage: "to right" });
  });
  it("should handle bg-gradient-to arbitrary", () => {
    const token = { prefix: "bg-gradient-to", arbitrary: true, arbitraryValue: "to left" } as ParsedClassToken;
    expect(bgGradientTo(token)).toEqual({ backgroundImage: "to left" });
  });
}); 