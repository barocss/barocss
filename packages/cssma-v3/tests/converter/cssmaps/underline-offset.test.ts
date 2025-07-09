import { describe, it, expect } from "vitest";
import { underlineOffset } from "../../../src/converter/cssmaps/text-decoration";
import { ParsedClassToken } from "../../../src/parser/utils";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";

const mockTheme = {
  textUnderlineOffset: { 4: "4px", auto: "auto", 3: "3em" },
};

const getByPath = (obj: any, path: string): any =>
  path.split('.').reduce((current, key) => current?.[key], obj);

const mockContext: CssmaContext = {
  hasPreset: () => false,
  theme: (...args) => themeGetter(mockTheme, ...args),
  config: (path: string) => {
    if (typeof path === "string" && path.startsWith("theme.")) {
      const themePath = path.replace("theme.", "");
      return getByPath(mockTheme, themePath);
    }
    return undefined;
  },
  plugins: [],
};

describe("underlineOffset", () => {
  it("should handle underline-offset-4", () => {
    const token = { prefix: "underline-offset", value: "4" } as ParsedClassToken;
    expect(underlineOffset(token, mockContext)).toEqual({ textUnderlineOffset: "4px" });
  });
  it("should handle -underline-offset-2", () => {
    const token = { prefix: "underline-offset", value: "2", negative: true } as ParsedClassToken;
    expect(underlineOffset(token, mockContext)).toEqual({ textUnderlineOffset: "calc(2px * -1)" });
  });
  it("should handle underline-offset-auto", () => {
    const token = { prefix: "underline-offset", value: "auto" } as ParsedClassToken;
    expect(underlineOffset(token, mockContext)).toEqual({ textUnderlineOffset: "auto" });
  });
  it("should handle underline-offset-[3em]", () => {
    const token = { prefix: "underline-offset", arbitrary: true, arbitraryValue: "3em" } as ParsedClassToken;
    expect(underlineOffset(token, mockContext)).toEqual({ textUnderlineOffset: "3em" });
  });
}); 