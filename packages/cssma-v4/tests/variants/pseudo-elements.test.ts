import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { ctx } from "./test-utils";

describe("pseudo-elements", () => {
  describe("cross-browser pseudo-element variants", () => {
    it('placeholder:bg-red-500 → 4개 selector', () => {
      const result = applyClassName('placeholder:bg-red-500', ctx);
      expect(result).toEqual([
        { type: 'rule', selector: '&::placeholder, &::-webkit-input-placeholder, &::-moz-placeholder, &:-ms-input-placeholder', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] },
      ]);
    });

    it('selection:bg-red-500 → 2개 selector', () => {
      const result = applyClassName('selection:bg-red-500', ctx);
      expect(result).toEqual([
        { type: 'rule', selector: '&::selection, &::-moz-selection', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] },
      ]);
    });

    it('file:bg-red-500 → 2개 selector', () => {
      const result = applyClassName('file:bg-red-500', ctx);
      expect(result).toEqual([
        { type: 'rule', selector: '&::file-selector-button, &::-webkit-file-upload-button', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] },
      ]);
    });
  });

  describe("basic pseudo-elements", () => {
    it('before:bg-red-500 → &::before { ... }', () => {
      expect(applyClassName('before:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&::before',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });

    it('after:bg-red-500 → &::after { ... }', () => {
      expect(applyClassName('after:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&::after',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });

    it('first-line:bg-red-500 → &::first-line { ... }', () => {
      expect(applyClassName('first-line:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&::first-line',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });

    it('first-letter:bg-red-500 → &::first-letter { ... }', () => {
      expect(applyClassName('first-letter:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&::first-letter',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });

    it('backdrop:bg-red-500 → &::backdrop { ... }', () => {
      expect(applyClassName('backdrop:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&::backdrop',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });

    it('details-content:bg-red-500 → &::details-content { ... }', () => {
      expect(applyClassName('details-content:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&::details-content',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });
  });
}); 