import { describe, it, expect } from "vitest";
import { bgLocal } from "../../../src/converter/cssmaps/bg-local";

describe("bgLocal", () => {
  it("should handle bg-local", () => {
    expect(bgLocal()).toEqual({ backgroundAttachment: "local" });
  });
}); 