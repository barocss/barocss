import { describe, it, expect } from "vitest";
import { gap, gapX, gapY } from "../../../src/converter/cssmaps/gap";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("gap", () => {
  it("should handle gap-4", () => {
    const token = { prefix: "gap", value: "4" } as ParsedClassToken;
    expect(gap(token, { theme: () => "1rem" } as any)).toEqual({ gap: "1rem" });
  });
  it("should handle gap-x-2", () => {
    const token = { prefix: "gap-x", value: "2" } as ParsedClassToken;
    expect(gapX(token, { theme: () => "0.5rem" } as any)).toEqual({ columnGap: "0.5rem" });
  });
  it("should handle gap-y-1.5", () => {
    const token = { prefix: "gap-y", value: "1.5" } as ParsedClassToken;
    expect(gapY(token, { theme: () => "0.375rem" } as any)).toEqual({ rowGap: "0.375rem" });
  });
  it("should handle gap-[10px] (arbitrary)", () => {
    const token = { prefix: "gap", arbitrary: true, arbitraryValue: "10px" } as ParsedClassToken;
    expect(gap(token, {} as any)).toEqual({ gap: "10px" });
  });
  it("should handle gap-(--my-gap) (customProperty)", () => {
    const token = { prefix: "gap", customProperty: true, value: "--my-gap" } as ParsedClassToken;
    expect(gap(token, {} as any)).toEqual({ gap: "var(--my-gap)" });
  });
  it("should handle gap-px", () => {
    const token = { prefix: "gap", value: "px" } as ParsedClassToken;
    expect(gap(token, {} as any)).toEqual({ gap: "1px" });
  });
  it("should handle gap-0", () => {
    const token = { prefix: "gap", value: "0" } as ParsedClassToken;
    expect(gap(token, {} as any)).toEqual({ gap: "0px" });
  });
  it("should handle gap-4! (!important)", () => {
    const token = { prefix: "gap", value: "4", important: true } as ParsedClassToken;
    expect(gap(token, { theme: () => "1rem" } as any)).toEqual({ gap: "1rem !important" });
  });
}); 