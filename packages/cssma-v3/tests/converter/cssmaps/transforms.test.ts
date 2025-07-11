import { describe, it, expect } from 'vitest';
import { backface, perspective, perspectiveOrigin } from '../../../src/converter/cssmaps/transforms';

describe('cssmaps: backface-visibility', () => {
  it('backface-hidden', () => {
    expect(backface({ prefix: 'backface', value: 'hidden', important: false } as any)).toEqual({ backfaceVisibility: 'hidden' });
  });
  it('backface-visible', () => {
    expect(backface({ prefix: 'backface', value: 'visible', important: false } as any)).toEqual({ backfaceVisibility: 'visible' });
  });
  it('backface: hidden!', () => {
    expect(backface({ prefix: 'backface', value: 'hidden', important: true } as any)).toEqual({ backfaceVisibility: 'hidden !important' });
  });
  it('backface: visible!', () => {
    expect(backface({ prefix: 'backface', value: 'visible', important: true } as any)).toEqual({ backfaceVisibility: 'visible !important' });
  });
});


describe('cssmaps: perspective (with context.theme)', () => {
  const ctx = {
    theme: (section: string, value: string) => {
      if (section === 'perspective' && value === 'custom') return '1234px';
      if (section === 'perspectiveOrigin' && value === 'custom-origin') return '10% 90%';
      return undefined;
    }
  } as any;

  it('should use ctx.theme for perspective', () => {
    expect(perspective({ value: 'custom', important: false } as any, ctx)).toEqual({ perspective: '1234px' });
  });
  it('should use ctx.theme for perspectiveOrigin', () => {
    expect(perspectiveOrigin({ value: 'custom-origin', important: false } as any, ctx)).toEqual({ perspectiveOrigin: '10% 90%' });
  });
  it('should fallback to preset if ctx.theme returns undefined', () => {
    expect(perspective({ value: 'dramatic', important: false } as any, ctx)).toEqual({ perspective: 'var(--perspective-dramatic)' });
    expect(perspectiveOrigin({ value: 'top-right', important: false } as any, ctx)).toEqual({ perspectiveOrigin: 'top right' });
  });
  it('should support custom property', () => {
    expect(perspective({ value: '--foo', customProperty: true, important: false } as any, ctx)).toEqual({ perspective: 'var(--foo)' });
    expect(perspectiveOrigin({ value: '--bar', customProperty: true, important: false } as any, ctx)).toEqual({ perspectiveOrigin: 'var(--bar)' });
  });
  it('should support arbitrary value', () => {
    expect(perspective({ arbitrary: true, arbitraryValue: '999px', important: false } as any, ctx)).toEqual({ perspective: '999px' });
    expect(perspectiveOrigin({ arbitrary: true, arbitraryValue: '33% 44%', important: false } as any, ctx)).toEqual({ perspectiveOrigin: '33% 44%' });
  });
  it('should support !important', () => {
    expect(perspective({ value: 'custom', important: true } as any, ctx)).toEqual({ perspective: '1234px !important' });
    expect(perspective({ value: 'dramatic', important: true } as any, ctx)).toEqual({ perspective: 'var(--perspective-dramatic) !important' });
    expect(perspective({ arbitrary: true, arbitraryValue: '999px', important: true } as any, ctx)).toEqual({ perspective: '999px !important' });
    expect(perspectiveOrigin({ value: 'custom-origin', important: true } as any, ctx)).toEqual({ perspectiveOrigin: '10% 90% !important' });
    expect(perspectiveOrigin({ value: 'top-right', important: true } as any, ctx)).toEqual({ perspectiveOrigin: 'top right !important' });
    expect(perspectiveOrigin({ arbitrary: true, arbitraryValue: '33% 44%', important: true } as any, ctx)).toEqual({ perspectiveOrigin: '33% 44% !important' });
  });
}); 