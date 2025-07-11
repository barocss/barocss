import { describe, it, expect } from 'vitest';
import { touch } from '../../../src/converter/cssmaps/touch';

describe('touch-action utility', () => {
  it('handles standard classes', () => {
    expect(touch({ value: 'auto' } as any)).toEqual({ touchAction: 'auto' });
    expect(touch({ value: 'none' } as any)).toEqual({ touchAction: 'none' });
    expect(touch({ value: 'pan-x' } as any)).toEqual({ touchAction: 'pan-x' });
    expect(touch({ value: 'pan-left' } as any)).toEqual({ touchAction: 'pan-left' });
    expect(touch({ value: 'pan-right' } as any)).toEqual({ touchAction: 'pan-right' });
    expect(touch({ value: 'pan-y' } as any)).toEqual({ touchAction: 'pan-y' });
    expect(touch({ value: 'pan-up' } as any)).toEqual({ touchAction: 'pan-up' });
    expect(touch({ value: 'pan-down' } as any)).toEqual({ touchAction: 'pan-down' });
    expect(touch({ value: 'pinch-zoom' } as any)).toEqual({ touchAction: 'pinch-zoom' });
    expect(touch({ value: 'manipulation' } as any)).toEqual({ touchAction: 'manipulation' });
  });

  it('handles !important', () => {
    expect(touch({ value: 'auto', important: true } as any)).toEqual({ touchAction: 'auto !important' });
    expect(touch({ value: 'pan-x', important: true } as any)).toEqual({ touchAction: 'pan-x !important' });
  });
}); 