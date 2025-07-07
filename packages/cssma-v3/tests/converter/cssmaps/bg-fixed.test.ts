import { describe, it, expect } from "vitest";
import { bgFixed } from "../../../src/converter/cssmaps/bg-fixed";

describe("bgFixed", () => {
  it("should handle bg-fixed", () => {
    expect(bgFixed()).toEqual({ backgroundAttachment: "fixed" });
  });
}); 