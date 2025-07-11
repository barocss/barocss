import { describe, it, expect } from 'vitest';
import { backfaceHidden, backfaceVisible, backfaceVisibility } from '../../../../src/converter/cssmaps/transforms';

// Helper for important
const imp = '!important';

describe('cssmaps: backface-visibility', () => {
  it('backface-hidden', () => {
    expect(backfaceHidden()).toEqual({ backfaceVisibility: 'hidden' });
  });
  it('backface-visible', () => {
    expect(backfaceVisible()).toEqual({ backfaceVisibility: 'visible' });
  });
  it('backface-visibility: hidden', () => {
    expect(backfaceVisibility({ value: 'hidden', important: false })).toEqual({ backfaceVisibility: 'hidden' });
  });
  it('backface-visibility: visible', () => {
    expect(backfaceVisibility({ value: 'visible', important: false })).toEqual({ backfaceVisibility: 'visible' });
  });
  it('backface-visibility: initial', () => {
    expect(backfaceVisibility({ value: 'initial', important: false })).toEqual({ backfaceVisibility: 'initial' });
  });
  it('backface-visibility: inherit (arbitrary)', () => {
    expect(backfaceVisibility({ value: 'inherit', important: false })).toEqual({ backfaceVisibility: 'inherit' });
  });
  it('backface-hidden!', () => {
    expect(backfaceVisibility({ value: 'hidden', important: true })).toEqual({ backfaceVisibility: 'hidden !important' });
  });
  it('backface-visible!', () => {
    expect(backfaceVisibility({ value: 'visible', important: true })).toEqual({ backfaceVisibility: 'visible !important' });
  });
}); 