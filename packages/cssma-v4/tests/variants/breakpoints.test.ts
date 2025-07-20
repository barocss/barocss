import { describe, it, expect } from "vitest";
import "../../src/presets";
import { applyClassName } from "../../src/core/engine";
import { createContext } from "../../src/core/context";
import { ctx } from "./test-utils";

describe("breakpoints", () => {
  // Max-width breakpoints 테스트
  it('max-sm:bg-red-500 → @media (width < 640px) { & { ... } }', () => {
    expect(applyClassName('max-sm:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(width < 640px)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('max-md:bg-red-500 → @media (width < 768px) { & { ... } }', () => {
    expect(applyClassName('max-md:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(width < 768px)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('min-[600px]:bg-red-500 → @media (width >= 600px) { & { ... } }', () => {
    expect(applyClassName('min-[600px]:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(width >= 600px)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('max-[960px]:bg-red-500 → @media (width < 960px) { & { ... } }', () => {
    expect(applyClassName('max-[960px]:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(width < 960px)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('max-sm:hover:bg-red-500 → @media (width < 640px) { &:hover { ... } }', () => {
    expect(applyClassName('max-sm:hover:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(width < 640px)',
        nodes: [
          {
            type: 'rule',
            selector: '&:hover',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('min-[600px]:hover:bg-red-500 → @media (width >= 600px) { &:hover { ... } }', () => {
    expect(applyClassName('min-[600px]:hover:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(width >= 600px)',
        nodes: [
          {
            type: 'rule',
            selector: '&:hover',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  // 사용자 정의 breakpoint 테스트
  it('tablet:bg-red-500 → @media (min-width: 768px) { & { ... } }', () => {
    expect(applyClassName('tablet:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(min-width: 768px)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('desktop:bg-red-500 → @media (min-width: 1024px) { & { ... } }', () => {
    expect(applyClassName('desktop:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(min-width: 1024px)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('wide:bg-red-500 → @media (min-width: 1440px) { & { ... } }', () => {
    expect(applyClassName('wide:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(min-width: 1440px)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('max-tablet:bg-red-500 → @media (width < 768px) { & { ... } }', () => {
    expect(applyClassName('max-tablet:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(width < 768px)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('max-desktop:bg-red-500 → @media (width < 1024px) { & { ... } }', () => {
    expect(applyClassName('max-desktop:bg-red-500', ctx)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(width < 1024px)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  // Tailwind v4.1 breakpoints 테스트
  it('xs:bg-red-500 with breakpoints → @media (min-width: 30rem) { & { ... } }', () => {
    const ctxWithBreakpoints = createContext({
      theme: {
        colors: { red: { 500: "#f00" } },
        breakpoints: {  // Tailwind CSS v4.1 표준
          xs: "(min-width: 30rem)",
          "2xl": "(min-width: 100rem)",
          "3xl": "(min-width: 120rem)",
        },
      },
    });
    expect(applyClassName('xs:bg-red-500', ctxWithBreakpoints)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(min-width: 30rem)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });

  it('3xl:bg-red-500 with breakpoints → @media (min-width: 120rem) { & { ... } }', () => {
    const ctxWithBreakpoints = createContext({
      theme: {
        colors: { red: { 500: "#f00" } },
        breakpoints: {  // Tailwind CSS v4.1 표준
          xs: "(min-width: 30rem)",
          "2xl": "(min-width: 100rem)",
          "3xl": "(min-width: 120rem)",
        },
      },
    });
    expect(applyClassName('3xl:bg-red-500', ctxWithBreakpoints)).toEqual([
      {
        type: 'at-rule',
        name: 'media',
        params: '(min-width: 120rem)',
        nodes: [
          {
            type: 'rule',
            selector: '&',
            nodes: [
              { type: 'decl', prop: 'background-color', value: '#f00' },
            ],
          },
        ],
      },
    ]);
  });
}); 