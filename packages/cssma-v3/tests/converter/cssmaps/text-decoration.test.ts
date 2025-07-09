import { describe, it, expect } from "vitest";
import { textDecoration } from "../../../src/converter/cssmaps/text-decoration";
import { ParsedClassToken } from "../../../src/parser/utils";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";

const mockTheme = {
  colors: { red: { 500: "#ef4444" }, blue: { 300: "#93c5fd" } },
  textDecorationThickness: { 2: "2px", 4: "4px" },
  textDecorationStyle: { solid: "solid", dashed: "dashed" },
};
const getByPath = (obj: any, path: string): any =>
  path.split('.').reduce((current, key) => current?.[key], obj);
const mockContext: CssmaContext = {
  theme: (...args) => themeGetter(mockTheme, ...args),
  config: (path: string) => {
    if (typeof path === "string" && path.startsWith("theme.")) {
      // "theme.colors.red-500" → "theme.colors.red.500"
      const normalized = path.replace(/([a-zA-Z]+)-(\d{3})/, "$1.$2");
      const themePath = normalized.replace("theme.", "");
      return getByPath(mockTheme, themePath);
    }
    return undefined;
  },
  plugins: [],
};

describe("textDecoration", () => {
  it("should handle decoration-red-500", () => {
    const token = { prefix: "decoration", value: "red-500" } as ParsedClassToken;
    expect(textDecoration(token, mockContext)).toEqual({ textDecorationColor: "#ef4444" });
  });
  it("should handle decoration-solid", () => {
    const token = { prefix: "decoration", value: "solid" } as ParsedClassToken;
    expect(textDecoration(token, mockContext)).toEqual({ textDecorationStyle: "solid" });
  });
  it("should handle decoration-2", () => {
    const token = { prefix: "decoration", value: "2" } as ParsedClassToken;
    expect(textDecoration(token, mockContext)).toEqual({ textDecorationThickness: "2px" });
  });
  it("should handle decoration-[3px]", () => {
    const token = { prefix: "decoration", arbitrary: true, arbitraryValue: "3px" } as ParsedClassToken;
    expect(textDecoration(token, mockContext)).toEqual({ textDecorationThickness: "3px" });
  });
}); 