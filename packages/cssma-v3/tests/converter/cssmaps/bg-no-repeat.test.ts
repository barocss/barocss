import { describe, it, expect } from "vitest";
import { bgNoRepeat } from "../../../src/converter/cssmaps/bg-no-repeat";

describe("bgNoRepeat", () => {
  it("should handle bg-no-repeat", () => {
    expect(bgNoRepeat()).toEqual({ backgroundRepeat: "no-repeat" });
  });
}); 