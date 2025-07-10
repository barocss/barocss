import { describe, it, expect } from "vitest";
import {
  border,
  borderT,
  borderB,
  borderL,
  borderR,
  borderX,
  borderY,
  borderS,
  borderE,
} from "../../../src/converter/cssmaps/border";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import { ParsedClassToken } from "../../../src/parser/utils";
import type { CssmaContext, CssmaTheme } from "../../../src/theme-types";

const mockTheme: CssmaTheme = {
  colors: {
    red: { "500": "#ef4444" },
    "red-500": "#ef4444",
  },
  borderWidth: { "2": "2px", "4": "4px" },
  borderStyle: { solid: "solid", dashed: "dashed" },
};
const getByPath = (obj: any, path: string): any =>
  path.split(".").reduce((current, key) => current?.[String(key)], obj);
const mockContext: CssmaContext = {
  hasPreset: () => false,
  theme: (...args) => themeGetter(mockTheme, ...args),
  config: (...args: (string | number)[]) => {
    const path = args[0] as string;
    if (typeof path === "string" && path.startsWith("theme.")) {
      let normalized = path;
      const themePath = normalized.replace("theme.", "");
      return getByPath(mockTheme, themePath);
    }
    return undefined;
  },
  plugins: [],
};

describe("border", () => {
  it("should handle border", () => {
    const token = { prefix: "border" } as ParsedClassToken;
    expect(border(token, mockContext)).toMatchObject({
      borderWidth: expect.any(String),
    });
  });
  it("should handle border-2", () => {
    const token = {
      prefix: "border",
      value: "2",
      numeric: true,
    } as ParsedClassToken;
    expect(border(token, mockContext)).toEqual({ borderWidth: "2px" });
  });
  it("should handle border-red-500", () => {
    const token = { prefix: "border", value: "red-500" } as ParsedClassToken;
    expect(border(token, mockContext)).toEqual({ borderColor: "#ef4444" });
  });
  it("should handle border-solid", () => {
    const token = { prefix: "border", value: "solid" } as ParsedClassToken;
    expect(border(token, mockContext)).toEqual({ borderStyle: "solid" });
  });
  it("should handle border-[3px]", () => {
    const token = {
      prefix: "border",
      arbitrary: true,
      arbitraryValue: "3px",
    } as ParsedClassToken;
    expect(border(token, mockContext)).toEqual({ borderWidth: "3px" });
  });
});

describe("border directions", () => {
  it("should handle border-t-4", () => {
    const token = {
      prefix: "border-t",
      value: "4",
      numeric: true,
    } as ParsedClassToken;
    expect(borderT(token, mockContext)).toEqual({ borderTopWidth: "4px" });
  });
  it("should handle border-b-red-500", () => {
    const token = { prefix: "border-b", value: "red-500" } as ParsedClassToken;
    expect(borderB(token, mockContext)).toEqual({
      borderBottomColor: "#ef4444",
    });
  });
  it("should handle border-l-solid", () => {
    const token = { prefix: "border-l", value: "solid" } as ParsedClassToken;
    expect(borderL(token, mockContext)).toEqual({ borderLeftStyle: "solid" });
  });
  it("should handle border-r-[2px]", () => {
    const token = {
      prefix: "border-r",
      arbitrary: true,
      arbitraryValue: "2px",
    } as ParsedClassToken;
    expect(borderR(token, mockContext)).toEqual({ borderRightWidth: "2px" });
  });
  it("should handle border-x-2", () => {
    const token = {
      prefix: "border-x",
      value: "2",
      numeric: true,
    } as ParsedClassToken;
    expect(borderX(token, mockContext)).toEqual({ borderInlineWidth: "2px" });
  });
  it("should handle border-y-red-500", () => {
    const token = { prefix: "border-y", value: "red-500" } as ParsedClassToken;
    expect(borderY(token, mockContext)).toEqual({
      borderBlockColor: "#ef4444",
    });
  });
  it("should handle border-s-dashed", () => {
    const token = { prefix: "border-s", value: "dashed" } as ParsedClassToken;
    expect(borderS(token, mockContext)).toEqual({
      borderInlineStartStyle: "dashed",
    });
  });
  it("should handle border-e-4", () => {
    const token = {
      prefix: "border-e",
      value: "4",
      numeric: true,
    } as ParsedClassToken;
    expect(borderE(token, mockContext)).toEqual({
      borderInlineEndWidth: "4px",
    });
  });
});
