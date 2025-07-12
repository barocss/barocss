import { describe, it, expect } from 'vitest';
import { columns } from '../../../src/converter/cssmaps/columns';
import type { ParsedClassToken } from '../../../src/parser/utils';
import { createContext } from '../../../src/config/context';
import type { CssmaConfig } from '../../../src/theme-types';

const config: CssmaConfig = {
  theme: {
    container: {
      xs: '20rem',
      md: '28rem',
      '3xl': '48rem',
    },
  },
};
const ctx = createContext(config);

describe('columns (converter)', () => {
  it('columns-3 → columns: 3', () => {
    const token = { prefix: 'columns', value: '3' } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: '3' });
  });
  it('columns-7 → columns: 7', () => {
    const token = { prefix: 'columns', value: '7' } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: '7' });
  });
  it('columns-auto → columns: auto', () => {
    const token = { prefix: 'columns', value: 'auto' } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: 'auto' });
  });
  it('columns-xs → columns: var(--container-xs)', () => {
    const token = { prefix: 'columns', value: 'xs' } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: 'var(--container-xs)' });
  });
  it('columns-3xl → columns: var(--container-3xl)', () => {
    const token = { prefix: 'columns', value: '3xl' } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: 'var(--container-3xl)' });
  });
  it('columns-(--my-columns) → columns: var(--my-columns)', () => {
    const token = { prefix: 'columns', value: '--my-columns', customProperty: true } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: 'var(--my-columns)' });
  });
  it('columns-[30vw] → columns: 30vw', () => {
    const token = { prefix: 'columns', arbitrary: true, arbitraryValue: '30vw' } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: '30vw' });
  });
  it('columns-3 ! → columns: 3 !important', () => {
    const token = { prefix: 'columns', value: '3', important: true } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: '3 !important' });
  });
  it('columns-xs ! → columns: var(--container-xs) !important', () => {
    const token = { prefix: 'columns', value: 'xs', important: true } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: 'var(--container-xs) !important' });
  });
  it('columns-(--my-columns) ! → columns: var(--my-columns) !important', () => {
    const token = { prefix: 'columns', value: '--my-columns', customProperty: true, important: true } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: 'var(--my-columns) !important' });
  });
  it('columns-[30vw] ! → columns: 30vw !important', () => {
    const token = { prefix: 'columns', arbitrary: true, arbitraryValue: '30vw', important: true } as ParsedClassToken;
    expect(columns(token)).toEqual({ columns: '30vw !important' });
  });
  it('columns-unknown → undefined', () => {
    const token = { prefix: 'columns', value: 'unknown' } as ParsedClassToken;
    expect(columns(token)).toBeUndefined();
  });
  it('columns-xs (with ctx) → columns: var(--container-xs)', () => {
    const token = { prefix: 'columns', value: 'xs' } as ParsedClassToken;
    expect(columns(token, ctx)).toEqual({ columns: 'var(--container-xs)' });
  });
  it('columns-md (with ctx) → columns: var(--container-md)', () => {
    const token = { prefix: 'columns', value: 'md' } as ParsedClassToken;
    expect(columns(token, ctx)).toEqual({ columns: 'var(--container-md)' });
  });
  it('columns-3xl (with ctx) → columns: var(--container-3xl)', () => {
    const token = { prefix: 'columns', value: '3xl' } as ParsedClassToken;
    expect(columns(token, ctx)).toEqual({ columns: 'var(--container-3xl)' });
  });
  it('columns-unknown (with ctx) → undefined', () => {
    const token = { prefix: 'columns', value: 'unknown' } as ParsedClassToken;
    expect(columns(token, ctx)).toBeUndefined();
  });
}); 