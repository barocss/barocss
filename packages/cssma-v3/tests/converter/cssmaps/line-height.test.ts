import { describe, it, expect } from "vitest";
import { lineHeight } from "../../../src/converter/cssmaps/text-layout";
import { ParsedClassToken } from "../../../src/parser/utils";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";

const mockTheme = {
  lineHeight: { tight: "1.25", normal: "1.5", loose: "2" },
};
const getByPath = (obj: any, path: string): any =>
  path.split('.').reduce((current, key) => current?.[key], obj);
const mockContext: CssmaContext = {
  hasPreset: () => false,
  theme: (...args) => themeGetter(mockTheme, ...args),
  config: (...args: (string|number)[]) => {
    const path = args[0] as string;
    if (typeof path === "string" && path.startsWith("theme.")) {
      const themePath = path.replace("theme.", "");
      return getByPath(mockTheme, themePath);
    }
    return undefined;
  },
  plugins: [],
};

describe("lineHeight", () => {
  it("should handle leading-tight", () => {
    const token = { prefix: "leading", value: "tight" } as ParsedClassToken;
    expect(lineHeight(token, mockContext)).toEqual({ lineHeight: "1.25" });
  });
  it("should handle leading-normal", () => {
    const token = { prefix: "leading", value: "normal" } as ParsedClassToken;
    expect(lineHeight(token, mockContext)).toEqual({ lineHeight: "1.5" });
  });
  it("should handle leading-loose", () => {
    const token = { prefix: "leading", value: "loose" } as ParsedClassToken;
    expect(lineHeight(token, mockContext)).toEqual({ lineHeight: "2" });
  });
  it("should handle leading-[2.5]", () => {
    const token = { prefix: "leading", arbitrary: true, arbitraryValue: "2.5" } as ParsedClassToken;
    expect(lineHeight(token, mockContext)).toEqual({ lineHeight: "2.5" });
  });
}); 