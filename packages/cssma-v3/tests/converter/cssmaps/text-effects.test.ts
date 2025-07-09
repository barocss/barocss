import { describe, it, expect } from "vitest";
import { textTransform, textShadow } from "../../../src/converter/cssmaps/text-effects";
import { ParsedClassToken } from "../../../src/parser/utils";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";

const mockTheme = {
  textShadow: {
    sm: "var(--tw-shadow-sm)",
    md: "var(--tw-shadow-md)",
  },
};
const getByPath = (obj: any, path: string): any =>
  path.split('.').reduce((current, key) => current?.[key], obj);
const mockContext: CssmaContext = {
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

describe("textTransform", () => {
  it("should handle uppercase", () => {
    const token = { prefix: "uppercase" } as ParsedClassToken;
    expect(textTransform(token)).toEqual({ textTransform: "uppercase" });
  });
  it("should handle lowercase", () => {
    const token = { prefix: "lowercase" } as ParsedClassToken;
    expect(textTransform(token)).toEqual({ textTransform: "lowercase" });
  });
  it("should handle capitalize", () => {
    const token = { prefix: "capitalize" } as ParsedClassToken;
    expect(textTransform(token)).toEqual({ textTransform: "capitalize" });
  });
  it("should handle normal-case", () => {
    const token = { prefix: "normal-case" } as ParsedClassToken;
    expect(textTransform(token)).toEqual({ textTransform: "none" });
  });
});

describe("textShadow", () => {
  it("should handle shadow-sm", () => {
    const token = { prefix: "shadow", value: "sm" } as ParsedClassToken;
    expect(textShadow(token, mockContext)).toEqual({ textShadow: "var(--tw-shadow-sm)" });
  });
  it("should handle shadow-md", () => {
    const token = { prefix: "shadow", value: "md" } as ParsedClassToken;
    expect(textShadow(token, mockContext)).toEqual({ textShadow: "var(--tw-shadow-md)" });
  });
  it("should handle shadow-none", () => {
    const token = { prefix: "shadow", value: "none" } as ParsedClassToken;
    expect(textShadow(token, mockContext)).toEqual({ textShadow: "none" });
  });
}); 