import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";
import { ctx } from "./test-utils";

describe("container queries", () => {
  it('@sm:bg-red-500 → @container (width >= 24rem) { ... }', () => {
    const ctx2 = createContext({
      theme: {
        colors: { red: { 500: '#f00' } },
        container: { sm: '24rem', md: '28rem' },
        breakpoint: { sm: '24rem', md: '28rem' },
      },
    });
    expect(applyClassName('@sm:bg-red-500', ctx2)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: '(width >= 24rem)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });

  it('@max-md:bg-red-500 → @container (width < 28rem) { ... }', () => {
    const ctx2 = createContext({
      theme: {
        colors: { red: { 500: '#f00' } },
        container: { sm: '24rem', md: '28rem' },
        breakpoint: { sm: '24rem', md: '28rem' },
      },
    });
    expect(applyClassName('@max-md:bg-red-500', ctx2)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: '(width < 28rem)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });

  it('@min-[475px]:bg-red-500 → @container (width >= 475px) { ... }', () => {
    expect(applyClassName('@min-[475px]:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: '(width >= 475px)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });

  it('@container/main:bg-red-500 → @container main { ... }', () => {
    expect(applyClassName('@container/main:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: 'main',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });

  it('@sm/main:bg-red-500 → @container main (width >= 24rem) { ... }', () => {
    const ctx2 = createContext({
      theme: {
        colors: { red: { 500: '#f00' } },
        container: { sm: '24rem', md: '28rem' },
        breakpoint: { sm: '24rem', md: '28rem' },
      },
    });
    expect(applyClassName('@sm/main:bg-red-500', ctx2)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: 'main (width >= 24rem)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });

  it('@min-[475px]/main:bg-red-500 → @container main (width >= 475px) { ... }', () => {
    expect(applyClassName('@min-[475px]/main:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: 'main (width >= 475px)',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });

  it('중첩: @sm:@max-md:bg-red-500', () => {
    const ctx2 = createContext({
      theme: {
        colors: { red: { 500: '#f00' } },
        container: { sm: '24rem', md: '28rem' },
        breakpoint: { sm: '24rem', md: '28rem' },
      },
    });
    expect(applyClassName('@sm:@max-md:bg-red-500', ctx2)).toEqual([
      {
        type: 'at-rule',
        name: 'container',
        params: '(width >= 24rem)',
        nodes: [
          {
            type: 'at-rule',
            name: 'container',
            params: '(width < 28rem)',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('starting:bg-red-500 → @starting-style { ... }', () => {
    expect(applyClassName('starting:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'starting-style',
        params: '',
        nodes: [
          { type: 'decl', prop: 'background-color', value: '#f00' },
        ],
      },
    ]);
  });
}); 