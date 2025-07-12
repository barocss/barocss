import { describe, it, expect } from 'vitest';
import { aspect } from '../../../src/converter/cssmaps/aspect';
import { createContext } from '../../../src/config/context';
import type { ParsedClassToken } from '../../../src/parser/utils';
import type { CssmaConfig } from '../../../src/theme-types';

const config: CssmaConfig = {
  theme: {
    aspectRatio: {
      retro: '2 / 1',
      square: '1 / 1',
      video: '16 / 9',
    },
  },
};
const ctx = createContext(config);

describe('aspect (converter)', () => {
  it('aspect-square → 1 / 1', () => {
    const token = { prefix: 'aspect', value: 'square' } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: '1 / 1' });
  });
  it('aspect-video → var(--aspect-ratio-video)', () => {
    const token = { prefix: 'aspect', value: 'video' } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: 'var(--aspect-ratio-video)' });
  });
  it('aspect-auto → auto', () => {
    const token = { prefix: 'aspect', value: 'auto' } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: 'auto' });
  });
  it('aspect-[4/3] → 4/3', () => {
    const token = { prefix: 'aspect', arbitrary: true, arbitraryValue: '4/3' } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: '4/3' });
  });
  it('aspect-(--my-ratio) → var(--my-ratio)', () => {
    const token = { prefix: 'aspect', customProperty: true, value: '--my-ratio' } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: 'var(--my-ratio)' });
  });
  it('aspect-retro (theme) → 2 / 1', () => {
    const token = { prefix: 'aspect', value: 'retro' } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: '2 / 1' });
  });
  it('aspect-unknown (theme fallback) → var(--aspect-unknown)', () => {
    const token = { prefix: 'aspect', value: 'unknown' } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: 'var(--aspect-unknown)' });
  });
  it('aspect-3/2 → 3/2', () => {
    const token = { prefix: 'aspect', value: '3', slash: '2' } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: '3/2' });
  });
  it('aspect-square! → 1 / 1 !important', () => {
    const token = { prefix: 'aspect', value: 'square', important: true } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: '1 / 1 !important' });
  });
  it('aspect-(--my-ratio)! → var(--my-ratio) !important', () => {
    const token = { prefix: 'aspect', customProperty: true, value: '--my-ratio', important: true } as ParsedClassToken;
    expect(aspect(token, ctx)).toEqual({ aspectRatio: 'var(--my-ratio) !important' });
  });
}); 