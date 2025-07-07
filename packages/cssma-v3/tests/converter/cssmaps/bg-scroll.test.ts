import { describe, it, expect } from "vitest";
import { bgScroll } from "../../../src/converter/cssmaps/bg-scroll";

describe("bgScroll", () => {
  it("should handle bg-scroll", () => {
    expect(bgScroll()).toEqual({ backgroundAttachment: "scroll" });
  });
}); 