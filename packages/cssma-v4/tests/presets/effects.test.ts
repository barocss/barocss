import { describe, it, expect } from 'vitest';
import "../../src/presets";
import { applyClassName } from '../../src/core/engine';
import { createContext } from '../../src/core/context';

const ctx = createContext({
  theme: {
    colors: {
      red: { 500: '#ef4444' },
      black: { 500: '#000' },
      white: { 500: '#fff' },
    },
    shadows: {
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      '2xs': '0 1px rgb(0 0 0 / 0.05)',
    },
  },
});
describe('effects.ts (box-shadow utilities)', () => {
  // Static shadow levels
  it('shadow-md → box-shadow: var(--shadow-md)', () => {
    expect(applyClassName('shadow-md', ctx)).toEqual([
      { type: 'decl', prop: 'box-shadow', value: 'var(--shadow-md)' },
    ]);
  });
  it('shadow → box-shadow: var(--shadow-default)', () => {
    expect(applyClassName('shadow', ctx)).toEqual([
      { type: 'decl', prop: 'box-shadow', value: 'var(--shadow-default)' },
    ]);
  });
  it('shadow-none → box-shadow: 0 0 #0000', () => {
    expect(applyClassName('shadow-none', ctx)).toEqual([
      { type: 'decl', prop: 'box-shadow', value: '0 0 #0000' },
    ]);
  });
  // Static inset shadow levels
  it('inset-shadow-xs → box-shadow: var(--inset-shadow-xs)', () => {
    expect(applyClassName('inset-shadow-xs', ctx)).toEqual([
      { type: 'decl', prop: 'box-shadow', value: 'var(--inset-shadow-xs)' },
    ]);
  });
  it('inset-shadow-none → box-shadow: 0 0 #0000', () => {
    expect(applyClassName('inset-shadow-none', ctx)).toEqual([
      { type: 'decl', prop: 'box-shadow', value: '0 0 #0000' },
    ]);
  });
  // Custom property
  it('shadow-(--my-shadow) → box-shadow: var(--my-shadow)', () => {
    expect(applyClassName('shadow-(--my-shadow)', ctx)).toEqual([
      { type: 'decl', prop: 'box-shadow', value: 'var(--my-shadow)' },
    ]);
  });
  // Arbitrary value
  it('shadow-[0_35px_35px_rgba(0,0,0,0.25)] → box-shadow: 0 35px 35px rgba(0,0,0,0.25)', () => {
    expect(applyClassName('shadow-[0_35px_35px_rgba(0,0,0,0.25)]', ctx)).toEqual([
      { type: 'decl', prop: 'box-shadow', value: '0 35px 35px rgba(0,0,0,0.25)' },
    ]);
  });
  // Shadow color
  it('shadow-red-500 → --tw-shadow-color: var(--color-red-500)', () => {
    expect(applyClassName('shadow-red-500', ctx)).toEqual([
      { type: 'decl', prop: '--tw-shadow-color', value: 'var(--color-red-500)' },
    ]);
  });
  it('shadow-black → --tw-shadow-color: var(--color-black)', () => {
    expect(applyClassName('shadow-black', ctx)).toEqual([
      { type: 'decl', prop: '--tw-shadow-color', value: 'var(--color-black)' },
    ]);
  });
  it('shadow-white → --tw-shadow-color: var(--color-white)', () => {
    expect(applyClassName('shadow-white', ctx)).toEqual([
      { type: 'decl', prop: '--tw-shadow-color', value: 'var(--color-white)' },
    ]);
  });
  // Shadow color with opacity
  it('shadow-red-500/50 → --tw-shadow-color: color-mix(in oklab, var(--color-red-500) 50%, transparent)', () => {
    expect(applyClassName('shadow-red-500/50', ctx)).toEqual([
      { type: 'decl', prop: '--tw-shadow-color', value: 'color-mix(in oklab, var(--color-red-500) 50%, transparent)' },
    ]);
  });
  it('shadow-[#bada55]/80 → --tw-shadow-color: color-mix(in oklab, #bada55 80%, transparent)', () => {
    expect(applyClassName('shadow-[#bada55]/80', ctx)).toEqual([
      { type: 'decl', prop: '--tw-shadow-color', value: 'color-mix(in oklab, #bada55 80%, transparent)' },
    ]);
  });
  // Special cases
  it('shadow-inherit → --tw-shadow-color: inherit', () => {
    expect(applyClassName('shadow-inherit', ctx)).toEqual([
      { type: 'decl', prop: '--tw-shadow-color', value: 'inherit' },
    ]);
  });
  it('shadow-current → --tw-shadow-color: currentColor', () => {
    expect(applyClassName('shadow-current', ctx)).toEqual([
      { type: 'decl', prop: '--tw-shadow-color', value: 'currentColor' },
    ]);
  });
  it('shadow-transparent → --tw-shadow-color: transparent', () => {
    expect(applyClassName('shadow-transparent', ctx)).toEqual([
      { type: 'decl', prop: '--tw-shadow-color', value: 'transparent' },
    ]);
  });
  // Inset shadow color and opacity
  it('inset-shadow-red-500/60 → --tw-inset-shadow-color: color-mix(in oklab, var(--color-red-500) 60%, transparent)', () => {
    expect(applyClassName('inset-shadow-red-500/60', ctx)).toEqual([
      { type: 'decl', prop: '--tw-inset-shadow-color', value: 'color-mix(in oklab, var(--color-red-500) 60%, transparent)' },
    ]);
  });
  // Inset shadow custom property
  it('inset-shadow-(--my-inset-shadow) → box-shadow: var(--my-inset-shadow)', () => {
    expect(applyClassName('inset-shadow-(--my-inset-shadow)', ctx)).toEqual([
      { type: 'decl', prop: 'box-shadow', value: 'var(--my-inset-shadow)' },
    ]);
  });
  // Inset shadow arbitrary value
  it('inset-shadow-[0_2px_3px_rgba(0,0,0,0.25)] → box-shadow: inset 0 2px 3px rgba(0,0,0,0.25)', () => {
    expect(applyClassName('inset-shadow-[0_2px_3px_rgba(0,0,0,0.25)]', ctx)).toEqual([
      { type: 'decl', prop: 'box-shadow', value: 'inset 0 2px 3px rgba(0,0,0,0.25)' },
    ]);
  });
}); 