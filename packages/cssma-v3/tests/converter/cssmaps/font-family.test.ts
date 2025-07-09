import { ParsedClassToken } from './../../../src/parser/utils';
import { describe, it, expect } from "vitest";
import { fontFamily } from "../../../src/converter/cssmaps/font";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";

const mockTheme = {
  fontFamily: {
    sans: 'var(--font-sans)',
    serif: 'var(--font-serif)',
    mono: 'var(--font-mono)',
  },
};
const mockContext: CssmaContext = {
  hasPreset: () => false,
  theme: (...args) => themeGetter(mockTheme, ...args),
  config: () => undefined,
  plugins: [],
};

describe("fontFamily", () => {
  it("should handle font-sans", () => {
    const token = { prefix: "font", value: "sans" } as ParsedClassToken;
    expect(fontFamily(token, mockContext)).toEqual({ fontFamily: "var(--font-sans)" });
  });
  it("should handle font-serif", () => {
    const token = { prefix: "font", value: "serif" } as ParsedClassToken;
    expect(fontFamily(token, mockContext)).toEqual({ fontFamily: "var(--font-serif)" });
  });
  it("should handle font-mono", () => {
    const token = { prefix: "font", value: "mono" } as ParsedClassToken;
    expect(fontFamily(token, mockContext)).toEqual({ fontFamily: "var(--font-mono)" });
  });
  it("should handle font-[Open_Sans]", () => {
    const token = { prefix: "font", arbitrary: true, arbitraryValue: "Open Sans" } as ParsedClassToken;
    expect(fontFamily(token, mockContext)).toEqual({ fontFamily: "Open Sans" });
  });
}); 