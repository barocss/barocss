import { describe, it, expect } from "vitest";
import { parseClassName, parseClassList } from "../src/parser";
import { ParsedClassToken } from "../src/parser/utils";

// Helper to extract modifier types for easier assertions
function getModifierTypes(modifiers: ParsedClassToken[]) {
  return modifiers.map((m) => m.type);
}

describe("parseClassName", () => {
  it("parses a simple utility class", () => {
    const result = parseClassName("bg-cover");
    expect(result.original).toBe("bg-cover");
    expect(result.utility).toMatchObject({
      type: "background-size",
      preset: "cover",
    });
    expect(getModifierTypes(result.modifiers)).toEqual([]);
  });

  it("parses a class with a modifier", () => {
    const result = parseClassName("md:bg-cover");
    expect(result.utility).toMatchObject({
      type: "background-size",
      preset: "cover",
    });
    expect(getModifierTypes(result.modifiers)).toContain("breakpoint");
  });

  it("parses a class with multiple modifiers", () => {
    const result = parseClassName("hover:focus:bg-red-500");
    expect(result.utility).toMatchObject({
      type: "background-color",
      preset: "red-500",
    });
    expect(getModifierTypes(result.modifiers)).toEqual(
      expect.arrayContaining(["pseudo", "pseudo"])
    );
  });

  it("parses arbitrary value utility", () => {
    const result = parseClassName("bg-[url(foo)]");
    expect(result.utility).toMatchObject({
      type: "background-image",
      preset: "url(foo)",
      arbitrary: true,
    });
  });

  it("parses important flag", () => {
    const result = parseClassName("p-4!");
    expect(result.utility).toMatchObject({ type: "padding", important: true });
  });

  it("returns unknown for invalid utility", () => {
    const result = parseClassName("not-a-real-utility");
    expect(result.utility).toMatchObject({ type: "unknown" });
  });

  it("parses class with modifier and important", () => {
    const result = parseClassName("md:p-4!");
    expect(result.utility).toMatchObject({ type: "padding", important: true });
    expect(getModifierTypes(result.modifiers)).toContain("breakpoint");
  });

  // --- 복잡한 구조 테스트 ---
  it("parses multiple modifiers of different types", () => {
    const result = parseClassName("dark:group-hover:sm:focus:bg-blue-500");
    expect(result.utility).toMatchObject({
      type: "background-color",
      preset: "blue-500",
    });
    expect(getModifierTypes(result.modifiers)).toEqual(
      expect.arrayContaining(["darkmode", "group", "breakpoint", "pseudo"])
    );
  });

  it("parses arbitrary + important + modifier", () => {
    const result = parseClassName("md:bg-[url(foo)]!");
    expect(result.utility).toMatchObject({
      type: "background-image",
      preset: "url(foo)",
      arbitrary: true,
      important: true,
    });
    expect(getModifierTypes(result.modifiers)).toContain("breakpoint");
  });

  it("parses unknown utility with modifiers", () => {
    const result = parseClassName("hover:foo-bar");
    expect(result.utility).toMatchObject({ type: "unknown", raw: "foo-bar" });
    expect(getModifierTypes(result.modifiers)).toContain("pseudo");
  });

  it("parses chained responsive and pseudo modifiers", () => {
    const result = parseClassName("md:focus:hover:bg-green-200");
    expect(result.utility).toMatchObject({
      type: "background-color",
      preset: "green-200",
    });
    expect(getModifierTypes(result.modifiers)).toEqual(
      expect.arrayContaining(["breakpoint", "pseudo", "pseudo"])
    );
  });

  it("parses modifier with arbitrary value utility", () => {
    const result = parseClassName("hover:text-[oklch(0.6_0.2_120)]");
    expect(result.utility).toMatchObject({
      type: "color",
      preset: "oklch(0.6_0.2_120)",
      arbitrary: true,
    });
    expect(getModifierTypes(result.modifiers)).toContain("pseudo");
  });
});

describe("parseClassList", () => {
  it("parses multiple classes in one string", () => {
    const results = parseClassList("bg-red-500 p-4 md:hover:bg-blue-500");
    expect(results).toHaveLength(3);
    expect(results[0].utility).toMatchObject({
      type: "background-color",
      preset: "red-500",
    });
    expect(results[1].utility).toMatchObject({ type: "padding", value: 4 });
    expect(results[2].utility).toMatchObject({
      type: "background-color",
      preset: "blue-500",
    });
    expect(getModifierTypes(results[2].modifiers)).toEqual(
      expect.arrayContaining(["breakpoint", "pseudo"])
    );
  });

  it("parses classes with arbitrary and important flags", () => {
    const results = parseClassList(
      "bg-[url(foo)]! hover:text-[oklch(0.6_0.2_120)]"
    );
    expect(results[0].utility).toMatchObject({
      type: "background-image",
      preset: "url(foo)",
      arbitrary: true,
      important: true,
    });
    expect(results[1].utility).toMatchObject({
      type: "color",
      preset: "oklch(0.6_0.2_120)",
      arbitrary: true,
    });
    expect(getModifierTypes(results[1].modifiers)).toContain("pseudo");
  });
});
