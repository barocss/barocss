import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";
import { ctx } from "./test-utils";

describe("arbitrary variants", () => {
  describe("basic arbitrary variants", () => {
    it('[&>*]:bg-red-500 → &>* { ... }', () => {
      expect(applyClassName('[&>*]:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&>*',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });

    it('aria-[pressed=true]:bg-red-500 → [aria-pressed="true"] & { ... }', () => {
      expect(applyClassName('aria-[pressed=true]:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&[aria-pressed="true"]',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });

    it('data-[state=open]:bg-red-500 → &[data-state="open"] { ... }', () => {
      expect(applyClassName('data-[state=open]:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&[data-state="open"]',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });

    it('is-[.foo]:bg-red-500 → &:is(.foo) { ... }', () => {
      expect(applyClassName('is-[.foo]:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&:is(.foo)',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });

    it('where-[.bar]:bg-red-500 → &:where(.bar) { ... }', () => {
      expect(applyClassName('where-[.bar]:bg-red-500', ctx)).toEqual([
        {
          type: 'rule',
          selector: '&:where(.bar)',
          nodes: [
            { type: 'decl', prop: 'background-color', value: '#f00' },
          ],
        },
      ]);
    });
  });

  describe("complex arbitrary variants", () => {
    it('[&:hover]:bg-red-500 → &:hover { ... }', () => {
      expect(applyClassName('[&:hover]:bg-red-500', ctx)).toEqual([
        { type: 'rule', selector: '&:hover', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
      ]);
    });

    it('[.foo>.bar]:bg-blue-500 → .foo>.bar { ... }', () => {
      const ctx2 = createContext({ theme: { colors: { blue: { 500: '#00f' } } } });
      expect(applyClassName('[.foo>.bar]:bg-blue-500', ctx2)).toEqual([
        { type: 'rule', selector: '.foo>.bar &', nodes: [{ type: 'decl', prop: 'background-color', value: '#00f' }] }
      ]);
    });

    it('group-hover:[&>*]:bg-red-500 → .group:hover &>* { ... }', () => {
      expect(applyClassName('group-hover:[&>*]:bg-red-500', ctx)).toEqual([
        { type: 'rule', selector: '.group:hover &>*', nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }] }
      ]);
    });

    it('dark:[.foo]:hover:bg-blue-500 → .dark .foo:hover { ... }', () => {
      const ctx2 = createContext({ darkMode: 'class', theme: { colors: { blue: { 500: '#00f' } } } });
      expect(applyClassName('dark:[.foo]:hover:bg-blue-500', ctx2)).toEqual([
        {
          type: 'rule',
          selector: '.dark',
          nodes: [
            { type: 'rule', selector: '.foo &:hover', nodes: [{ type: 'decl', prop: 'background-color', value: '#00f' }] }
          ]
        }
      ]);
    });
  });
}); 