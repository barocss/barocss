import { describe, it, expect } from 'vitest';
import { resize } from '../../../src/converter/cssmaps/resize';

describe('resize utility', () => {
  it('handles standard classes', () => {
    expect(resize({ value: 'none' } as any)).toEqual({ resize: 'none' });
    expect(resize({ value: 'y' } as any)).toEqual({ resize: 'vertical' });
    expect(resize({ value: 'x' } as any)).toEqual({ resize: 'horizontal' });
    expect(resize({ value: '' } as any)).toEqual({ resize: 'both' });
    expect(resize({} as any)).toEqual({ resize: 'both' }); // default
  });

  it('handles !important', () => {
    expect(resize({ value: 'none', important: true } as any)).toEqual({ resize: 'none !important' });
    expect(resize({ value: 'x', important: true } as any)).toEqual({ resize: 'horizontal !important' });
    expect(resize({ value: '', important: true } as any)).toEqual({ resize: 'both !important' });
  });
}); 