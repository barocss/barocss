import { describe, it, expect } from 'vitest';
import { borderSpacing, borderSpacingX, borderSpacingY } from '../../../src/converter/cssmaps/border-spacing';
import { createContext } from '../../../src/config/context';
import type { CssmaContext } from '../../../src/theme-types';

const ctx: CssmaContext = createContext({});

describe('borderSpacing utility', () => {
  it('handles standard number', () => {
    expect(borderSpacing({ value: '2', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ borderSpacing: 'calc(var(--spacing) * 2)' });
  });
  it('handles custom property', () => {
    expect(borderSpacing({ value: '--foo', customProperty: true, arbitrary: false, important: false } as any, ctx)).toEqual({ borderSpacing: 'var(--foo)' });
  });
  it('handles arbitrary value', () => {
    expect(borderSpacing({ value: '[7px]', customProperty: false, arbitrary: true, arbitraryValue: '7px', important: false } as any, ctx)).toEqual({ borderSpacing: '7px' });
  });
  it('handles !important modifier', () => {
    expect(borderSpacing({ value: '2', customProperty: false, arbitrary: false, important: true } as any, ctx)).toEqual({ borderSpacing: 'calc(var(--spacing) * 2) !important' });
    expect(borderSpacing({ value: '--foo', customProperty: true, arbitrary: false, important: true } as any, ctx)).toEqual({ borderSpacing: 'var(--foo) !important' });
    expect(borderSpacing({ value: '[7px]', customProperty: false, arbitrary: true, arbitraryValue: '7px', important: true } as any, ctx)).toEqual({ borderSpacing: '7px !important' });
  });
  it('falls back to raw value if not found', () => {
    expect(borderSpacing({ value: 'inherit', customProperty: false, arbitrary: false, important: false } as any, ctx)).toBeUndefined();
  });
  it('returns undefined for empty value', () => {
    expect(borderSpacing({ value: '', customProperty: false, arbitrary: false, important: false } as any, ctx)).toBeUndefined();
  });
});

describe('borderSpacingX utility', () => {
  it('handles standard number', () => {
    expect(borderSpacingX({ value: '4', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ borderSpacing: 'calc(var(--spacing) * 4) var(--tw-border-spacing-y)' });
  });
  it('handles custom property', () => {
    expect(borderSpacingX({ value: '--foo', customProperty: true, arbitrary: false, important: false } as any, ctx)).toEqual({ borderSpacing: 'var(--foo) var(--tw-border-spacing-y)' });
  });
  it('handles arbitrary value', () => {
    expect(borderSpacingX({ value: '[10px]', customProperty: false, arbitrary: true, arbitraryValue: '10px', important: false } as any, ctx)).toEqual({ borderSpacing: '10px var(--tw-border-spacing-y)' });
  });
  it('handles !important modifier', () => {
    expect(borderSpacingX({ value: '4', customProperty: false, arbitrary: false, important: true } as any, ctx)).toEqual({ borderSpacing: 'calc(var(--spacing) * 4) var(--tw-border-spacing-y) !important' });
    expect(borderSpacingX({ value: '--foo', customProperty: true, arbitrary: false, important: true } as any, ctx)).toEqual({ borderSpacing: 'var(--foo) var(--tw-border-spacing-y) !important' });
    expect(borderSpacingX({ value: '[10px]', customProperty: false, arbitrary: true, arbitraryValue: '10px', important: true } as any, ctx)).toEqual({ borderSpacing: '10px var(--tw-border-spacing-y) !important' });
  });
  it('falls back to raw value if not found', () => {
    expect(borderSpacingX({ value: 'inherit', customProperty: false, arbitrary: false, important: false } as any, ctx)).toBeUndefined();
  });
  it('returns undefined for empty value', () => {
    expect(borderSpacingX({ value: '', customProperty: false, arbitrary: false, important: false } as any, ctx)).toBeUndefined();
  });
});

describe('borderSpacingY utility', () => {
  it('handles standard number', () => {
    expect(borderSpacingY({ value: '1', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ borderSpacing: 'var(--tw-border-spacing-x) calc(var(--spacing) * 1)' });
  });
  it('handles custom property', () => {
    expect(borderSpacingY({ value: '--foo', customProperty: true, arbitrary: false, important: false } as any, ctx)).toEqual({ borderSpacing: 'var(--tw-border-spacing-x) var(--foo)' });
  });
  it('handles arbitrary value', () => {
    expect(borderSpacingY({ value: '[5em]', customProperty: false, arbitrary: true, arbitraryValue: '5em', important: false } as any, ctx)).toEqual({ borderSpacing: 'var(--tw-border-spacing-x) 5em' });
  });
  it('handles !important modifier', () => {
    expect(borderSpacingY({ value: '1', customProperty: false, arbitrary: false, important: true } as any, ctx)).toEqual({ borderSpacing: 'var(--tw-border-spacing-x) calc(var(--spacing) * 1) !important' });
    expect(borderSpacingY({ value: '--foo', customProperty: true, arbitrary: false, important: true } as any, ctx)).toEqual({ borderSpacing: 'var(--tw-border-spacing-x) var(--foo) !important' });
    expect(borderSpacingY({ value: '[5em]', customProperty: false, arbitrary: true, arbitraryValue: '5em', important: true } as any, ctx)).toEqual({ borderSpacing: 'var(--tw-border-spacing-x) 5em !important' });
  });
  it('falls back to raw value if not found', () => {
    expect(borderSpacingY({ value: 'inherit', customProperty: false, arbitrary: false, important: false } as any, ctx)).toBeUndefined();
  });
  it('returns undefined for empty value', () => {
    expect(borderSpacingY({ value: '', customProperty: false, arbitrary: false, important: false } as any, ctx)).toBeUndefined();
  });
}); 