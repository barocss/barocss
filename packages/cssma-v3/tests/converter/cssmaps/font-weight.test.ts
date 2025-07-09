import { describe, it, expect } from "vitest";
import { fontWeight } from "../../../src/converter/cssmaps/font";
import { ParsedClassToken } from "../../../src/parser/utils";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";

const mockTheme = {
  fontWeight: {
    bold: '700',
    light: '300',
  },
};
const mockContext: CssmaContext = {
  hasPreset: () => false,
  theme: (...args) => themeGetter(mockTheme, ...args),
  config: () => undefined,
  plugins: [],
};

describe("fontWeight", () => {
  it("should handle font-bold", () => {
    const token = { prefix: "font", value: "bold" } as ParsedClassToken;
    expect(fontWeight(token, mockContext)).toEqual({ fontWeight: "700" });
  });
  it("should handle font-light", () => {
    const token = { prefix: "font", value: "light" } as ParsedClassToken;
    expect(fontWeight(token, mockContext)).toEqual({ fontWeight: "300" });
  });
  it("should handle font-[550]", () => {
    const token = { prefix: "font", arbitrary: true, arbitraryValue: "550" } as ParsedClassToken;
    expect(fontWeight(token, mockContext)).toEqual({ fontWeight: "550" });
  });
}); 