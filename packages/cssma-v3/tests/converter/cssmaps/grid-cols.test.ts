import { describe, it, expect } from "vitest";
import { gridCols } from "../../../src/converter/cssmaps/grid-cols";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("gridCols", () => {
  it("should handle grid-cols-3", () => {
    const token = { prefix: "grid-cols", value: "3" } as ParsedClassToken;
    expect(gridCols(token, {} as any)).toEqual({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" });
  });
  it("should handle grid-cols-none", () => {
    const token = { prefix: "grid-cols", value: "none" } as ParsedClassToken;
    expect(gridCols(token, {} as any)).toEqual({ gridTemplateColumns: "none" });
  });
  it("should handle grid-cols-subgrid", () => {
    const token = { prefix: "grid-cols", value: "subgrid" } as ParsedClassToken;
    expect(gridCols(token, {} as any)).toEqual({ gridTemplateColumns: "subgrid" });
  });
  it("should handle grid-cols-[200px_1fr] (arbitrary)", () => {
    const token = { prefix: "grid-cols", arbitrary: true, arbitraryValue: "200px 1fr" } as ParsedClassToken;
    expect(gridCols(token, {} as any)).toEqual({ gridTemplateColumns: "200px 1fr" });
  });
  it("should handle grid-cols-(--my-cols) (customProperty)", () => {
    const token = { prefix: "grid-cols", customProperty: true, value: "--my-cols" } as ParsedClassToken;
    expect(gridCols(token, {} as any)).toEqual({ gridTemplateColumns: "var(--my-cols)" });
  });
  it("should handle grid-cols-3! (!important)", () => {
    const token = { prefix: "grid-cols", value: "3", important: true } as ParsedClassToken;
    expect(gridCols(token, {} as any)).toEqual({ gridTemplateColumns: "repeat(3, minmax(0, 1fr)) !important" });
  });
}); 