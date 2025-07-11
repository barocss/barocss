import { describe, it, expect } from 'vitest';
import {
  scrollM, scrollMx, scrollMy, scrollMt, scrollMr, scrollMb, scrollMl, scrollMs, scrollMe,
  scrollP, scrollPx, scrollPy, scrollPt, scrollPr, scrollPb, scrollPl, scrollPs, scrollPe,
  snap, scroll
} from '../../../src/converter/cssmaps/scroll';

describe('scroll-margin utilities', () => {
  it('handles all sides', () => {
    expect(scrollM({ value: '4' } as any)).toEqual({ scrollMargin: 'calc(var(--spacing)*4)' });
    expect(scrollM({ value: '4', important: true } as any)).toEqual({ scrollMargin: 'calc(var(--spacing)*4) !important' });
    expect(scrollM({ value: '4', negative: true } as any)).toEqual({ scrollMargin: 'calc(var(--spacing)*-4)' });
    expect(scrollM({ customProperty: true, value: '--my-margin' } as any)).toEqual({ scrollMargin: 'var(--my-margin)' });
    expect(scrollM({ arbitraryValue: '10px' } as any)).toEqual({ scrollMargin: '10px' });
  });
  it('handles directions', () => {
    expect(scrollMx({ value: '2' } as any)).toMatchObject({
      scrollMarginLeft: 'calc(var(--spacing)*2)',
      scrollMarginRight: 'calc(var(--spacing)*2)',
      scrollMarginInline: 'calc(var(--spacing)*2)',
    });
    expect(scrollMy({ value: '2' } as any)).toMatchObject({
      scrollMarginTop: 'calc(var(--spacing)*2)',
      scrollMarginBottom: 'calc(var(--spacing)*2)',
      scrollMarginBlock: 'calc(var(--spacing)*2)',
    });
    expect(scrollMt({ value: '1' } as any)).toEqual({ scrollMarginTop: 'calc(var(--spacing)*1)' });
    expect(scrollMr({ value: '1' } as any)).toEqual({ scrollMarginRight: 'calc(var(--spacing)*1)' });
    expect(scrollMb({ value: '1' } as any)).toEqual({ scrollMarginBottom: 'calc(var(--spacing)*1)' });
    expect(scrollMl({ value: '1' } as any)).toEqual({ scrollMarginLeft: 'calc(var(--spacing)*1)' });
    expect(scrollMs({ value: '1' } as any)).toEqual({ scrollMarginInlineStart: 'calc(var(--spacing)*1)' });
    expect(scrollMe({ value: '1' } as any)).toEqual({ scrollMarginInlineEnd: 'calc(var(--spacing)*1)' });
  });
});

describe('scroll-padding utilities', () => {
  it('handles all sides', () => {
    expect(scrollP({ value: '4' } as any)).toEqual({ scrollPadding: 'calc(var(--spacing)*4)' });
    expect(scrollP({ value: '4', important: true } as any)).toEqual({ scrollPadding: 'calc(var(--spacing)*4) !important' });
    expect(scrollP({ value: '4', negative: true } as any)).toEqual({ scrollPadding: 'calc(var(--spacing)*-4)' });
    expect(scrollP({ customProperty: true, value: '--my-padding' } as any)).toEqual({ scrollPadding: 'var(--my-padding)' });
    expect(scrollP({ arbitraryValue: '10px' } as any)).toEqual({ scrollPadding: '10px' });
  });
  it('handles directions', () => {
    expect(scrollPx({ value: '2' } as any)).toMatchObject({
      scrollPaddingLeft: 'calc(var(--spacing)*2)',
      scrollPaddingRight: 'calc(var(--spacing)*2)',
      scrollPaddingInline: 'calc(var(--spacing)*2)',
    });
    expect(scrollPy({ value: '2' } as any)).toMatchObject({
      scrollPaddingTop: 'calc(var(--spacing)*2)',
      scrollPaddingBottom: 'calc(var(--spacing)*2)',
      scrollPaddingBlock: 'calc(var(--spacing)*2)',
    });
    expect(scrollPt({ value: '1' } as any)).toEqual({ scrollPaddingTop: 'calc(var(--spacing)*1)' });
    expect(scrollPr({ value: '1' } as any)).toEqual({ scrollPaddingRight: 'calc(var(--spacing)*1)' });
    expect(scrollPb({ value: '1' } as any)).toEqual({ scrollPaddingBottom: 'calc(var(--spacing)*1)' });
    expect(scrollPl({ value: '1' } as any)).toEqual({ scrollPaddingLeft: 'calc(var(--spacing)*1)' });
    expect(scrollPs({ value: '1' } as any)).toEqual({ scrollPaddingInlineStart: 'calc(var(--spacing)*1)' });
    expect(scrollPe({ value: '1' } as any)).toEqual({ scrollPaddingInlineEnd: 'calc(var(--spacing)*1)' });
  });
});

describe('scroll snap utilities', () => {
  it('handles scroll-snap-align', () => {
    expect(snap({ value: 'start' } as any)).toEqual({ scrollSnapAlign: 'start' });
    expect(snap({ value: 'end', important: true } as any)).toEqual({ scrollSnapAlign: 'end !important' });
    expect(snap({ value: 'center' } as any)).toEqual({ scrollSnapAlign: 'center' });
    expect(snap({ value: 'align-none' } as any)).toEqual({ scrollSnapAlign: 'none' });
  });
  it('handles scroll-snap-stop', () => {
    expect(snap({ value: 'normal' } as any)).toEqual({ scrollSnapStop: 'normal' });
    expect(snap({ value: 'always', important: true } as any)).toEqual({ scrollSnapStop: 'always !important' });
  });
  it('handles scroll-snap-type', () => {
    expect(snap({ value: 'none' } as any)).toEqual({ scrollSnapType: 'none' });
    expect(snap({ value: 'x' } as any)).toEqual({ scrollSnapType: 'x var(--tw-scroll-snap-strictness)' });
    expect(snap({ value: 'y', important: true } as any)).toEqual({ scrollSnapType: 'y var(--tw-scroll-snap-strictness) !important' });
    expect(snap({ value: 'both' } as any)).toEqual({ scrollSnapType: 'both var(--tw-scroll-snap-strictness)' });
  });
  it('handles snap strictness', () => {
    expect(snap({ value: 'mandatory' } as any)).toEqual({ '--tw-scroll-snap-strictness': 'mandatory' });
    expect(snap({ value: 'proximity', important: true } as any)).toEqual({ '--tw-scroll-snap-strictness': 'proximity !important' });
  });
});

describe('scroll-behavior utility', () => {
  it('handles scroll-behavior', () => {
    expect(scroll({ value: 'auto' } as any)).toEqual({ scrollBehavior: 'auto' });
    expect(scroll({ value: 'smooth', important: true } as any)).toEqual({ scrollBehavior: 'smooth !important' });
    expect(scroll({ value: 'instant' } as any)).toEqual({ scrollBehavior: 'instant' });
    expect(scroll({ value: 'unknown' } as any)).toEqual({ scrollBehavior: 'auto' });
  });
}); 