import { describe, it, expect } from "vitest";
import {
  items, content, self, justify, justifyItems, justifySelf,
  alignItems, alignContent, alignSelf, placeContent, placeItems, placeSelf
} from "../../../src/converter/cssmaps/flexgrid";
import type { ParsedClassToken } from "../../../src/parser/utils";

describe("flexgrid align/justify/place", () => {
  it("should handle items-start", () => {
    const token = { prefix: "items", value: "start" } as ParsedClassToken;
    expect(items(token)).toEqual({ alignItems: "flex-start" });
  });
  it("should handle content-between", () => {
    const token = { prefix: "content", value: "between" } as ParsedClassToken;
    expect(content(token)).toEqual({ alignContent: "space-between" });
  });
  it("should handle self-center", () => {
    const token = { prefix: "self", value: "center" } as ParsedClassToken;
    expect(self(token)).toEqual({ alignSelf: "center" });
  });
  it("should handle justify-end", () => {
    const token = { prefix: "justify", value: "end" } as ParsedClassToken;
    expect(justify(token)).toEqual({ justifyContent: "flex-end" });
  });
  it("should handle justifyItems-center", () => {
    const token = { prefix: "justify-items", value: "center" } as ParsedClassToken;
    expect(justifyItems(token)).toEqual({ justifyItems: "center" });
  });
  it("should handle justifySelf-end", () => {
    const token = { prefix: "justify-self", value: "end" } as ParsedClassToken;
    expect(justifySelf(token)).toEqual({ justifySelf: "end" });
  });
  it("should handle alignItems-baseline", () => {
    const token = { prefix: "align-items", value: "baseline" } as ParsedClassToken;
    expect(alignItems(token)).toEqual({ alignItems: "baseline" });
  });
  it("should handle alignContent-evenly", () => {
    const token = { prefix: "align-content", value: "evenly" } as ParsedClassToken;
    expect(alignContent(token)).toEqual({ alignContent: "space-evenly" });
  });
  it("should handle alignSelf-stretch", () => {
    const token = { prefix: "align-self", value: "stretch" } as ParsedClassToken;
    expect(alignSelf(token)).toEqual({ alignSelf: "stretch" });
  });
  it("should handle placeContent-around", () => {
    const token = { prefix: "place-content", value: "around" } as ParsedClassToken;
    expect(placeContent(token)).toEqual({ placeContent: "space-around" });
  });
  it("should handle placeItems-center", () => {
    const token = { prefix: "place-items", value: "center" } as ParsedClassToken;
    expect(placeItems(token)).toEqual({ placeItems: "center" });
  });
  it("should handle placeSelf-auto", () => {
    const token = { prefix: "place-self", value: "auto" } as ParsedClassToken;
    expect(placeSelf(token)).toEqual({ placeSelf: "auto" });
  });
  it("should handle items-center! (!important)", () => {
    const token = { prefix: "items", value: "center", important: true } as ParsedClassToken;
    expect(items(token)).toEqual({ alignItems: "center !important" });
  });
  it("should handle unknown value fallback", () => {
    const token = { prefix: "items", value: "unknown" } as ParsedClassToken;
    expect(items(token)).toEqual({ alignItems: "unknown" });
  });
}); 