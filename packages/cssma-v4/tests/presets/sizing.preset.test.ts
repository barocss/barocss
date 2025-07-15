import { describe, it, expect } from "vitest";
import "../../src/index"; // Ensure all utilities are registered
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";

// --- New preset utility structure its ---
describe("preset sizing utilities", () => {
  const ctx = createContext({
    theme: {
      colors: { red: { 500: "#f00" }, blue: { 500: "#00f" } },
      "--z-index": { "10": "10", "20": "20" },
      "--order": { "1": "1", "2": "2" },
      "--grid-column": { "2": "2", "3": "3" },
      "--grid-column-start": { "1": "1" },
      "--grid-column-end": { "2": "2" },
    },
  });

  describe("width utilities", () => {
    it("w-4 → width: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("w-4", ctx)).toEqual([
        { type: "decl", prop: "width", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("w-1/2 → width: calc(1/2 * 100%)", () => {
      expect(applyClassName("w-1/2", ctx)).toEqual([
        { type: "decl", prop: "width", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("w-auto → width: auto", () => {
      expect(applyClassName("w-auto", ctx)).toEqual([
        { type: "decl", prop: "width", value: "auto" },
      ]);
    });
    it("w-px → width: 1px", () => {
      expect(applyClassName("w-px", ctx)).toEqual([
        { type: "decl", prop: "width", value: "1px" },
      ]);
    });
    it("w-full → width: 100%", () => {
      expect(applyClassName("w-full", ctx)).toEqual([
        { type: "decl", prop: "width", value: "100%" },
      ]);
    });
    it("w-screen → width: 100vw", () => {
      expect(applyClassName("w-screen", ctx)).toEqual([
        { type: "decl", prop: "width", value: "100vw" },
      ]);
    });
    it("w-3xs → width: var(--container-3xs)", () => {
      expect(applyClassName("w-3xs", ctx)).toEqual([
        { type: "decl", prop: "width", value: "var(--container-3xs)" },
      ]);
    });
    it("w-[32rem] → width: 32rem", () => {
      expect(applyClassName("w-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "width", value: "32rem" },
      ]);
    });
    it("w-(--my-width) → width: var(--my-width)", () => {
      expect(applyClassName("w-(--my-width)", ctx)).toEqual([
        { type: "decl", prop: "width", value: "var(--my-width)" },
      ]);
    });
  });

  describe("size utilities", () => {
    it("size-4 → width/height: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("size-4", ctx)).toEqual([
        { type: "decl", prop: "width", value: "calc(var(--spacing) * 4)" },
        { type: "decl", prop: "height", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("size-1/2 → width/height: calc(1/2 * 100%)", () => {
      expect(applyClassName("size-1/2", ctx)).toEqual([
        { type: "decl", prop: "width", value: "calc(1/2 * 100%)" },
        { type: "decl", prop: "height", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("size-auto → width/height: auto", () => {
      expect(applyClassName("size-auto", ctx)).toEqual([
        { type: "decl", prop: "width", value: "auto" },
        { type: "decl", prop: "height", value: "auto" },
      ]);
    });
    it("size-px → width/height: 1px", () => {
      expect(applyClassName("size-px", ctx)).toEqual([
        { type: "decl", prop: "width", value: "1px" },
        { type: "decl", prop: "height", value: "1px" },
      ]);
    });
    it("size-full → width/height: 100%", () => {
      expect(applyClassName("size-full", ctx)).toEqual([
        { type: "decl", prop: "width", value: "100%" },
        { type: "decl", prop: "height", value: "100%" },
      ]);
    });
    it("size-[32rem] → width/height: 32rem", () => {
      expect(applyClassName("size-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "width", value: "32rem" },
        { type: "decl", prop: "height", value: "32rem" },
      ]);
    });
    it("size-(--my-size) → width/height: var(--my-size)", () => {
      expect(applyClassName("size-(--my-size)", ctx)).toEqual([
        { type: "decl", prop: "width", value: "var(--my-size)" },
        { type: "decl", prop: "height", value: "var(--my-size)" },
      ]);
    });
  });

  describe("height utilities", () => {
    it("h-4 → height: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("h-4", ctx)).toEqual([
        { type: "decl", prop: "height", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("h-1/2 → height: calc(1/2 * 100%)", () => {
      expect(applyClassName("h-1/2", ctx)).toEqual([
        { type: "decl", prop: "height", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("h-auto → height: auto", () => {
      expect(applyClassName("h-auto", ctx)).toEqual([
        { type: "decl", prop: "height", value: "auto" },
      ]);
    });
    it("h-px → height: 1px", () => {
      expect(applyClassName("h-px", ctx)).toEqual([
        { type: "decl", prop: "height", value: "1px" },
      ]);
    });
    it("h-full → height: 100%", () => {
      expect(applyClassName("h-full", ctx)).toEqual([
        { type: "decl", prop: "height", value: "100%" },
      ]);
    });
    it("h-screen → height: 100vh", () => {
      expect(applyClassName("h-screen", ctx)).toEqual([
        { type: "decl", prop: "height", value: "100vh" },
      ]);
    });
    it("h-dvh → height: 100dvh", () => {
      expect(applyClassName("h-dvh", ctx)).toEqual([
        { type: "decl", prop: "height", value: "100dvh" },
      ]);
    });
    it("h-min → height: min-content", () => {
      expect(applyClassName("h-min", ctx)).toEqual([
        { type: "decl", prop: "height", value: "min-content" },
      ]);
    });
    it("h-max → height: max-content", () => {
      expect(applyClassName("h-max", ctx)).toEqual([
        { type: "decl", prop: "height", value: "max-content" },
      ]);
    });
    it("h-fit → height: fit-content", () => {
      expect(applyClassName("h-fit", ctx)).toEqual([
        { type: "decl", prop: "height", value: "fit-content" },
      ]);
    });
    it("h-[32rem] → height: 32rem", () => {
      expect(applyClassName("h-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "height", value: "32rem" },
      ]);
    });
    it("h-(--my-height) → height: var(--my-height)", () => {
      expect(applyClassName("h-(--my-height)", ctx)).toEqual([
        { type: "decl", prop: "height", value: "var(--my-height)" },
      ]);
    });
  });

  describe("min-height utilities", () => {
    it("min-h-4 → min-height: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("min-h-4", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("min-h-1/2 → min-height: calc(1/2 * 100%)", () => {
      expect(applyClassName("min-h-1/2", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("min-h-0 → min-height: 0px", () => {
      expect(applyClassName("min-h-0", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "0px" },
      ]);
    });
    it("min-h-px → min-height: 1px", () => {
      expect(applyClassName("min-h-px", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "1px" },
      ]);
    });
    it("min-h-full → min-height: 100%", () => {
      expect(applyClassName("min-h-full", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "100%" },
      ]);
    });
    it("min-h-screen → min-height: 100vh", () => {
      expect(applyClassName("min-h-screen", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "100vh" },
      ]);
    });
    it("min-h-dvh → min-height: 100dvh", () => {
      expect(applyClassName("min-h-dvh", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "100dvh" },
      ]);
    });
    it("min-h-min → min-height: min-content", () => {
      expect(applyClassName("min-h-min", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "min-content" },
      ]);
    });
    it("min-h-max → min-height: max-content", () => {
      expect(applyClassName("min-h-max", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "max-content" },
      ]);
    });
    it("min-h-fit → min-height: fit-content", () => {
      expect(applyClassName("min-h-fit", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "fit-content" },
      ]);
    });
    it("min-h-[32rem] → min-height: 32rem", () => {
      expect(applyClassName("min-h-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "32rem" },
      ]);
    });
    it("min-h-(--my-min-height) → min-height: var(--my-min-height)", () => {
      expect(applyClassName("min-h-(--my-min-height)", ctx)).toEqual([
        { type: "decl", prop: "min-height", value: "var(--my-min-height)" },
      ]);
    });
  });

  describe("max-height utilities", () => {
    it("max-h-4 → max-height: calc(var(--spacing) * 4)", () => {
      expect(applyClassName("max-h-4", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "calc(var(--spacing) * 4)" },
      ]);
    });
    it("max-h-1/2 → max-height: calc(1/2 * 100%)", () => {
      expect(applyClassName("max-h-1/2", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "calc(1/2 * 100%)" },
      ]);
    });
    it("max-h-px → max-height: 1px", () => {
      expect(applyClassName("max-h-px", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "1px" },
      ]);
    });
    it("max-h-full → max-height: 100%", () => {
      expect(applyClassName("max-h-full", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "100%" },
      ]);
    });
    it("max-h-screen → max-height: 100vh", () => {
      expect(applyClassName("max-h-screen", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "100vh" },
      ]);
    });
    it("max-h-dvh → max-height: 100dvh", () => {
      expect(applyClassName("max-h-dvh", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "100dvh" },
      ]);
    });
    it("max-h-min → max-height: min-content", () => {
      expect(applyClassName("max-h-min", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "min-content" },
      ]);
    });
    it("max-h-max → max-height: max-content", () => {
      expect(applyClassName("max-h-max", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "max-content" },
      ]);
    });
    it("max-h-fit → max-height: fit-content", () => {
      expect(applyClassName("max-h-fit", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "fit-content" },
      ]);
    });
    it("max-h-none → max-height: none", () => {
      expect(applyClassName("max-h-none", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "none" },
      ]);
    });
    it("max-h-[32rem] → max-height: 32rem", () => {
      expect(applyClassName("max-h-[32rem]", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "32rem" },
      ]);
    });
    it("max-h-(--my-max-height) → max-height: var(--my-max-height)", () => {
      expect(applyClassName("max-h-(--my-max-height)", ctx)).toEqual([
        { type: "decl", prop: "max-height", value: "var(--my-max-height)" },
      ]);
    });
  });

  describe('min-width utilities', () => {
    it('min-w-4 → min-width: calc(var(--spacing) * 4)', () => {
      expect(applyClassName('min-w-4', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'calc(var(--spacing) * 4)' },
      ]);
    });
    it('min-w-1/2 → min-width: calc(1/2 * 100%)', () => {
      expect(applyClassName('min-w-1/2', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'calc(1/2 * 100%)' },
      ]);
    });
    it('min-w-auto → min-width: auto', () => {
      expect(applyClassName('min-w-auto', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'auto' },
      ]);
    });
    it('min-w-px → min-width: 1px', () => {
      expect(applyClassName('min-w-px', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: '1px' },
      ]);
    });
    it('min-w-full → min-width: 100%', () => {
      expect(applyClassName('min-w-full', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: '100%' },
      ]);
    });
    it('min-w-screen → min-width: 100vw', () => {
      expect(applyClassName('min-w-screen', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: '100vw' },
      ]);
    });
    it('min-w-3xs → min-width: var(--container-3xs)', () => {
      expect(applyClassName('min-w-3xs', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'var(--container-3xs)' },
      ]);
    });
    it('min-w-[32rem] → min-width: 32rem', () => {
      expect(applyClassName('min-w-[32rem]', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: '32rem' },
      ]);
    });
    it('min-w-(--my-min-width) → min-width: var(--my-min-width)', () => {
      expect(applyClassName('min-w-(--my-min-width)', ctx)).toEqual([
        { type: 'decl', prop: 'min-width', value: 'var(--my-min-width)' },
      ]);
    });
  });

});
