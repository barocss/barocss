import { describe, it, expect } from "vitest";
import { letterSpacing } from "../../../src/converter/cssmaps/text-layout";
import { ParsedClassToken } from "../../../src/parser/utils";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";

const mockTheme = {
  letterSpacing: { tight: "-0.05em", normal: "0em", wide: "0.05em" },
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

describe("letterSpacing", () => {
  it("should handle tracking-tight", () => {
    const token = { prefix: "tracking", value: "tight" } as ParsedClassToken;
    expect(letterSpacing(token, mockContext)).toEqual({ letterSpacing: "-0.05em" });
  });
  it("should handle tracking-normal", () => {
    const token = { prefix: "tracking", value: "normal" } as ParsedClassToken;
    expect(letterSpacing(token, mockContext)).toEqual({ letterSpacing: "0em" });
  });
  it("should handle tracking-wide", () => {
    const token = { prefix: "tracking", value: "wide" } as ParsedClassToken;
    expect(letterSpacing(token, mockContext)).toEqual({ letterSpacing: "0.05em" });
  });
  it("should handle tracking-[0.1em]", () => {
    const token = { prefix: "tracking", arbitrary: true, arbitraryValue: "0.1em" } as ParsedClassToken;
    expect(letterSpacing(token, mockContext)).toEqual({ letterSpacing: "0.1em" });
  });
}); 