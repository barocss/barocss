import { describe, it, expect } from "vitest";
import "../../src/presets";
import { parseClassToAst } from "../../src/core/engine";
import { createContext } from "../../src/core/context";
import { ctx } from "./test-utils";

describe("has variants", () => {
  it('has-[.child]:bg-red-500 → &:has(.child) { ... }', () => {
    expect(parseClassToAst('has-[.child]:bg-red-500', ctx)).toMatchObject([
      {
        type: 'rule',
        selector: '&:has(.child)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });

  it('group-hover:has-[.child]:bg-red-500 → .group:hover &:has(.child) { ... }', () => {
    expect(parseClassToAst('group-hover:has-[.child]:bg-red-500', ctx)).toMatchObject([
      {
        type: 'rule',
        selector: '&:is(:where(.group):hover *)',
        nodes: [
          {
            type: 'rule',
            selector: '&:has(.child)',
            nodes: [{ type: 'decl', prop: 'background-color', value: '#f00' }],
          },
        ],
      },
    ]);
  });

  it('has-[.foo>.bar]:bg-blue-500 → &:has(.foo>.bar) { ... }', () => {
    const ctx2 = createContext({ theme: { colors: { blue: { 500: '#00f' } } } });
    expect(parseClassToAst('has-[.foo>.bar]:bg-blue-500', ctx2)).toMatchObject([
      {
        type: 'rule',
        selector: '&:has(.foo>.bar)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#00f' },
        ],
      },
    ]);
  });
}); 