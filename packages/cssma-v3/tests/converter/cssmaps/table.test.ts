import { describe, it, expect } from 'vitest';
import { tableLayout, captionSide } from '../../../src/converter/cssmaps/table';
import { createContext } from '../../../src/config/context';
import type { CssmaContext } from '../../../src/theme-types';

const ctx: CssmaContext = createContext({});

describe('tableLayout utility', () => {
  it('handles standard classes', () => {
    expect(tableLayout({ value: 'auto', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ tableLayout: 'auto' });
    expect(tableLayout({ value: 'fixed', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ tableLayout: 'fixed' });
  });

  it('handles !important modifier', () => {
    expect(tableLayout({ value: 'auto', customProperty: false, arbitrary: false, important: true } as any, ctx)).toEqual({ tableLayout: 'auto !important' });
  });

  it('falls back to raw value if not found', () => {
    expect(tableLayout({ value: 'unknown', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ tableLayout: 'unknown' });
  });

  it('returns undefined for empty value', () => {
    expect(tableLayout({ value: '', customProperty: false, arbitrary: false, important: false } as any, ctx)).toBeUndefined();
  });
});

describe('captionSide utility', () => {
  it('handles standard classes', () => {
    expect(captionSide({ value: 'top', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ captionSide: 'top' });
    expect(captionSide({ value: 'bottom', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ captionSide: 'bottom' });
  });

  it('handles !important modifier', () => {
    expect(captionSide({ value: 'top', customProperty: false, arbitrary: false, important: true } as any, ctx)).toEqual({ captionSide: 'top !important' });
  });

  it('falls back to raw value if not found', () => {
    expect(captionSide({ value: 'unknown', customProperty: false, arbitrary: false, important: false } as any, ctx)).toEqual({ captionSide: 'unknown' });
  });

  it('returns undefined for empty value', () => {
    expect(captionSide({ value: '', customProperty: false, arbitrary: false, important: false } as any, ctx)).toBeUndefined();
  });
}); 