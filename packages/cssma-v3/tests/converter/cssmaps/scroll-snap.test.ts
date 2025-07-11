import { describe, it, expect } from 'vitest';
import { snap } from '../../../src/converter/cssmaps/scroll';

describe('cssmaps: snap (scroll-snap-align & scroll-snap-stop)', () => {
  // scroll-snap-align
  it('snap-start', () => {
    expect(snap({ value: 'start', important: false } as any)).toEqual({ scrollSnapAlign: 'start' });
  });
  it('snap-end', () => {
    expect(snap({ value: 'end', important: false } as any)).toEqual({ scrollSnapAlign: 'end' });
  });
  it('snap-center', () => {
    expect(snap({ value: 'center', important: false } as any)).toEqual({ scrollSnapAlign: 'center' });
  });
  it('snap-align-none', () => {
    expect(snap({ value: 'align-none', important: false } as any)).toEqual({ scrollSnapAlign: 'none' });
  });
  it('snap-start with !important', () => {
    expect(snap({ value: 'start', important: true } as any)).toEqual({ scrollSnapAlign: 'start !important' });
  });
  // scroll-snap-stop
  it('snap-normal', () => {
    expect(snap({ value: 'normal', important: false } as any)).toEqual({ scrollSnapStop: 'normal' });
  });
  it('snap-always', () => {
    expect(snap({ value: 'always', important: false } as any)).toEqual({ scrollSnapStop: 'always' });
  });
  it('snap-normal with !important', () => {
    expect(snap({ value: 'normal', important: true } as any)).toEqual({ scrollSnapStop: 'normal !important' });
  });
  it('snap-always with !important', () => {
    expect(snap({ value: 'always', important: true } as any)).toEqual({ scrollSnapStop: 'always !important' });
  });
}); 