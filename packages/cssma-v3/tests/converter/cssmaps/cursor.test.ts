import { describe, it, expect } from 'vitest';
import { cursor } from '../../../src/converter/cssmaps/cursor';

describe('cursor utility', () => {
  it('handles standard classes', () => {
    expect(cursor({ value: 'auto' } as any)).toEqual({ cursor: 'auto' });
    expect(cursor({ value: 'pointer' } as any)).toEqual({ cursor: 'pointer' });
    expect(cursor({ value: 'not-allowed' } as any)).toEqual({ cursor: 'not-allowed' });
    expect(cursor({ value: 'grab' } as any)).toEqual({ cursor: 'grab' });
    expect(cursor({ value: 'zoom-in' } as any)).toEqual({ cursor: 'zoom-in' });
  });

  it('handles !important', () => {
    expect(cursor({ value: 'pointer', important: true } as any)).toEqual({ cursor: 'pointer !important' });
    expect(cursor({ value: 'grab', important: true } as any)).toEqual({ cursor: 'grab !important' });
  });

  it('handles custom properties', () => {
    expect(cursor({ customProperty: true, value: '--my-cursor' } as any)).toEqual({ cursor: 'var(--my-cursor)' });
    expect(cursor({ customProperty: true, value: '--my-cursor', important: true } as any)).toEqual({ cursor: 'var(--my-cursor) !important' });
  });

  it('handles arbitrary values', () => {
    expect(cursor({ arbitrary: true, arbitraryValue: 'cell' } as any)).toEqual({ cursor: 'cell' });
    expect(cursor({ arbitrary: true, arbitraryValue: 'url(my-cursor.png)', important: true } as any)).toEqual({ cursor: 'url(my-cursor.png) !important' });
  });

  it('returns undefined for unknown values', () => {
    expect(cursor({ value: 'unknown' } as any)).toBeUndefined();
  });
}); 