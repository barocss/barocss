import { describe, it, expect } from "vitest";
import { text } from "../../../src/converter/cssmaps/text-unified";
import { ParsedClassToken } from "../../../src/parser/utils";
import { theme as themeGetter } from "../../../src/config/theme-getter";
import type { CssmaContext } from "../../../src/theme-types";

const mockTheme = {
  colors: {
    red: { 500: "#ef4444" },
    blue: { 300: "#93c5fd" },
    white: "#fff",
    black: "#000",
    transparent: "transparent",
    current: "currentColor",
    inherit: "inherit",
  },
  fontSize: {
    xs: "0.75rem",
    lg: "1.125rem",
    "2xl": "1.5rem",
  },
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

describe("text (text-unified)", () => {
  it("should handle text color utilities", () => {
    expect(text({ prefix: "text", value: "red-500" } as ParsedClassToken, mockContext)).toEqual({ color: "#ef4444" });
    expect(text({ prefix: "text", value: "blue-300" } as ParsedClassToken, mockContext)).toEqual({ color: "#93c5fd" });
    expect(text({ prefix: "text", arbitrary: true, arbitraryValue: "#ff0000" } as ParsedClassToken, mockContext)).toEqual({ color: "#ff0000" });
    expect(text({ prefix: "text", value: "inherit" } as ParsedClassToken, mockContext)).toEqual({ color: "inherit" });
    expect(text({ prefix: "text", value: "current" } as ParsedClassToken, mockContext)).toEqual({ color: "currentColor" });
    expect(text({ prefix: "text", value: "transparent" } as ParsedClassToken, mockContext)).toEqual({ color: "transparent" });
  });

  it("should handle text alignment utilities", () => {
    expect(text({ prefix: "text", value: "left" } as ParsedClassToken, mockContext)).toEqual({ textAlign: "left" });
    expect(text({ prefix: "text", value: "center" } as ParsedClassToken, mockContext)).toEqual({ textAlign: "center" });
    expect(text({ prefix: "text", value: "right" } as ParsedClassToken, mockContext)).toEqual({ textAlign: "right" });
    expect(text({ prefix: "text", value: "justify" } as ParsedClassToken, mockContext)).toEqual({ textAlign: "justify" });
    expect(text({ prefix: "text", value: "start" } as ParsedClassToken, mockContext)).toEqual({ textAlign: "start" });
    expect(text({ prefix: "text", value: "end" } as ParsedClassToken, mockContext)).toEqual({ textAlign: "end" });
  });

  it("should handle text size utilities", () => {
    expect(text({ prefix: "text", value: "xs" } as ParsedClassToken, mockContext)).toEqual({ fontSize: "0.75rem" });
    expect(text({ prefix: "text", value: "lg" } as ParsedClassToken, mockContext)).toEqual({ fontSize: "1.125rem" });
    expect(text({ prefix: "text", value: "2xl" } as ParsedClassToken, mockContext)).toEqual({ fontSize: "1.5rem" });
    expect(text({ prefix: "text", arbitrary: true, arbitraryValue: "32px" } as ParsedClassToken, mockContext)).toEqual({ fontSize: "32px" });
  });

  it("should handle text wrap utilities", () => {
    expect(text({ prefix: "text", value: "wrap" } as ParsedClassToken, mockContext)).toEqual({ textWrap: "wrap" });
    expect(text({ prefix: "text", value: "nowrap" } as ParsedClassToken, mockContext)).toEqual({ textWrap: "nowrap" });
    expect(text({ prefix: "text", value: "balance" } as ParsedClassToken, mockContext)).toEqual({ textWrap: "balance" });
    expect(text({ prefix: "text", value: "pretty" } as ParsedClassToken, mockContext)).toEqual({ textWrap: "pretty" });
  });

  it("should handle text overflow utilities", () => {
    expect(text({ prefix: "text", value: "ellipsis" } as ParsedClassToken, mockContext)).toEqual({ textOverflow: "ellipsis" });
    expect(text({ prefix: "text", value: "clip" } as ParsedClassToken, mockContext)).toEqual({ textOverflow: "clip" });
  });

  it("should handle truncate utility", () => {
    expect(text({ prefix: "truncate" } as ParsedClassToken, mockContext)).toEqual({
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
  });
}); 