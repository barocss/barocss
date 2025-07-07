import { describe, it, expect } from "vitest";
import { bgGradient } from "../../../src/converter/cssmaps/bg-gradient";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("bgGradient", () => {
  it("should handle bg-gradient", () => {
    const token = { prefix: "bg-gradient", value: "linear-gradient(red, blue)" } as ParsedClassToken;
    expect(bgGradient(token)).toEqual({ backgroundImage: "linear-gradient(red, blue)" });
  });
  it("should handle bg-gradient arbitrary", () => {
    const token = { prefix: "bg-gradient", arbitrary: true, arbitraryValue: "my-gradient" } as ParsedClassToken;
    expect(bgGradient(token)).toEqual({ backgroundImage: "my-gradient" });
  });
}); 