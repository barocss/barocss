import { describe, it, expect } from 'vitest';
import { scrollM, scrollMx, scrollMy, scrollMt, scrollMr, scrollMb, scrollMl, scrollMs, scrollMe } from '../../../src/converter/cssmaps/scroll';

describe('cssmaps: scroll-margin', () => {
  it('scrollM spacing scale', () => {
    expect(scrollM({ value: '4', important: false } as any)).toEqual({ scrollMargin: 'calc(var(--spacing)*4)' });
  });
  it('scrollM negative', () => {
    expect(scrollM({ value: '2', negative: true, important: false } as any)).toEqual({ scrollMargin: 'calc(var(--spacing)*-2)' });
  });
  it('scrollM custom property', () => {
    expect(scrollM({ customProperty: true, value: '--foo', important: false } as any)).toEqual({ scrollMargin: 'var(--foo)' });
  });
  it('scrollM arbitrary', () => {
    expect(scrollM({ arbitraryValue: '24rem', important: false } as any)).toEqual({ scrollMargin: '24rem' });
  });
  it('scrollM with !important', () => {
    expect(scrollM({ value: '4', important: true } as any)).toEqual({ scrollMargin: 'calc(var(--spacing)*4) !important' });
  });

  it('scrollMx spacing scale', () => {
    expect(scrollMx({ value: '3', important: false } as any)).toEqual({ scrollMarginLeft: 'calc(var(--spacing)*3)', scrollMarginRight: 'calc(var(--spacing)*3)', scrollMarginInline: 'calc(var(--spacing)*3)' });
  });
  it('scrollMx negative', () => {
    expect(scrollMx({ value: '1', negative: true, important: false } as any)).toEqual({ scrollMarginLeft: 'calc(var(--spacing)*-1)', scrollMarginRight: 'calc(var(--spacing)*-1)', scrollMarginInline: 'calc(var(--spacing)*-1)' });
  });
  it('scrollMx custom property', () => {
    expect(scrollMx({ customProperty: true, value: '--bar', important: false } as any)).toEqual({ scrollMarginLeft: 'var(--bar)', scrollMarginRight: 'var(--bar)', scrollMarginInline: 'var(--bar)' });
  });
  it('scrollMx arbitrary', () => {
    expect(scrollMx({ arbitraryValue: '10vw', important: false } as any)).toEqual({ scrollMarginLeft: '10vw', scrollMarginRight: '10vw', scrollMarginInline: '10vw' });
  });
  it('scrollMx with !important', () => {
    expect(scrollMx({ value: '3', important: true } as any)).toEqual({ scrollMarginLeft: 'calc(var(--spacing)*3) !important', scrollMarginRight: 'calc(var(--spacing)*3) !important', scrollMarginInline: 'calc(var(--spacing)*3) !important' });
  });

  it('scrollMy spacing scale', () => {
    expect(scrollMy({ value: '2', important: false } as any)).toEqual({ scrollMarginTop: 'calc(var(--spacing)*2)', scrollMarginBottom: 'calc(var(--spacing)*2)', scrollMarginBlock: 'calc(var(--spacing)*2)' });
  });
  it('scrollMy negative', () => {
    expect(scrollMy({ value: '2', negative: true, important: false } as any)).toEqual({ scrollMarginTop: 'calc(var(--spacing)*-2)', scrollMarginBottom: 'calc(var(--spacing)*-2)', scrollMarginBlock: 'calc(var(--spacing)*-2)' });
  });
  it('scrollMy custom property', () => {
    expect(scrollMy({ customProperty: true, value: '--baz', important: false } as any)).toEqual({ scrollMarginTop: 'var(--baz)', scrollMarginBottom: 'var(--baz)', scrollMarginBlock: 'var(--baz)' });
  });
  it('scrollMy arbitrary', () => {
    expect(scrollMy({ arbitraryValue: '5em', important: false } as any)).toEqual({ scrollMarginTop: '5em', scrollMarginBottom: '5em', scrollMarginBlock: '5em' });
  });
  it('scrollMy with !important', () => {
    expect(scrollMy({ value: '2', important: true } as any)).toEqual({ scrollMarginTop: 'calc(var(--spacing)*2) !important', scrollMarginBottom: 'calc(var(--spacing)*2) !important', scrollMarginBlock: 'calc(var(--spacing)*2) !important' });
  });

  it('scrollMt', () => {
    expect(scrollMt({ value: '6', important: false } as any)).toEqual({ scrollMarginTop: 'calc(var(--spacing)*6)' });
  });
  it('scrollMr', () => {
    expect(scrollMr({ value: '7', important: false } as any)).toEqual({ scrollMarginRight: 'calc(var(--spacing)*7)' });
  });
  it('scrollMb', () => {
    expect(scrollMb({ value: '8', important: false } as any)).toEqual({ scrollMarginBottom: 'calc(var(--spacing)*8)' });
  });
  it('scrollMl', () => {
    expect(scrollMl({ value: '9', important: false } as any)).toEqual({ scrollMarginLeft: 'calc(var(--spacing)*9)' });
  });
  it('scrollMt with !important', () => {
    expect(scrollMt({ value: '6', important: true } as any)).toEqual({ scrollMarginTop: 'calc(var(--spacing)*6) !important' });
  });

  it('scrollMs', () => {
    expect(scrollMs({ value: '5', important: false } as any)).toEqual({ scrollMarginInlineStart: 'calc(var(--spacing)*5)' });
  });
  it('scrollMe', () => {
    expect(scrollMe({ value: '4', important: false } as any)).toEqual({ scrollMarginInlineEnd: 'calc(var(--spacing)*4)' });
  });
  it('scrollMs custom property', () => {
    expect(scrollMs({ customProperty: true, value: '--ms', important: false } as any)).toEqual({ scrollMarginInlineStart: 'var(--ms)' });
  });
  it('scrollMe arbitrary', () => {
    expect(scrollMe({ arbitraryValue: '2rem', important: false } as any)).toEqual({ scrollMarginInlineEnd: '2rem' });
  });
  it('scrollMe with !important', () => {
    expect(scrollMe({ value: '4', important: true } as any)).toEqual({ scrollMarginInlineEnd: 'calc(var(--spacing)*4) !important' });
  });
}); 