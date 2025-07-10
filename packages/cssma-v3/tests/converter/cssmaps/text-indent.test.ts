import { describe, it, expect } from "vitest";
import { textIndent } from "../../../src/converter/cssmaps/text-layout";
import { ParsedClassToken } from "../../../src/parser/utils";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";

const mockTheme = {
  spacing: { 4: "1rem", 8: "2rem" },
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

describe("textIndent", () => {
  it("should handle indent-4", () => {
    const token = { prefix: "indent", value: "4" } as ParsedClassToken;
    expect(textIndent(token, mockContext)).toEqual({ textIndent: "1rem" });
  });
  it("should handle -indent-8", () => {
    const token = { prefix: "indent", value: "8", negative: true } as ParsedClassToken;
    expect(textIndent(token, mockContext)).toEqual({ textIndent: "calc(2rem * -1)" });
  });
  it("should handle indent-px", () => {
    const token = { prefix: "indent", value: "px" } as ParsedClassToken;
    expect(textIndent(token, mockContext)).toEqual({ textIndent: "1px" });
  });
  it("should handle indent-[32px]", () => {
    const token = { prefix: "indent", arbitrary: true, arbitraryValue: "32px" } as ParsedClassToken;
    expect(textIndent(token, mockContext)).toEqual({ textIndent: "32px" });
  });
}); 