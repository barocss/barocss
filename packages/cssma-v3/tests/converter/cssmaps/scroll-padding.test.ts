import { describe, it, expect } from 'vitest';
import { scrollP, scrollPx, scrollPy, scrollPt, scrollPr, scrollPb, scrollPl, scrollPs, scrollPe } from '../../../src/converter/cssmaps/scroll';

describe('cssmaps: scroll-padding', () => {
  it('scrollP spacing scale', () => {
    expect(scrollP({ value: '4', important: false } as any)).toEqual({ scrollPadding: 'calc(var(--spacing)*4)' });
  });
  it('scrollP negative', () => {
    expect(scrollP({ value: '2', negative: true, important: false } as any)).toEqual({ scrollPadding: 'calc(var(--spacing)*-2)' });
  });
  it('scrollP custom property', () => {
    expect(scrollP({ customProperty: true, value: '--foo', important: false } as any)).toEqual({ scrollPadding: 'var(--foo)' });
  });
  it('scrollP arbitrary', () => {
    expect(scrollP({ arbitraryValue: '24rem', important: false } as any)).toEqual({ scrollPadding: '24rem' });
  });
  it('scrollP with !important', () => {
    expect(scrollP({ value: '4', important: true } as any)).toEqual({ scrollPadding: 'calc(var(--spacing)*4) !important' });
  });

  it('scrollPx spacing scale', () => {
    expect(scrollPx({ value: '3', important: false } as any)).toEqual({ scrollPaddingLeft: 'calc(var(--spacing)*3)', scrollPaddingRight: 'calc(var(--spacing)*3)', scrollPaddingInline: 'calc(var(--spacing)*3)' });
  });
  it('scrollPx negative', () => {
    expect(scrollPx({ value: '1', negative: true, important: false } as any)).toEqual({ scrollPaddingLeft: 'calc(var(--spacing)*-1)', scrollPaddingRight: 'calc(var(--spacing)*-1)', scrollPaddingInline: 'calc(var(--spacing)*-1)' });
  });
  it('scrollPx custom property', () => {
    expect(scrollPx({ customProperty: true, value: '--bar', important: false } as any)).toEqual({ scrollPaddingLeft: 'var(--bar)', scrollPaddingRight: 'var(--bar)', scrollPaddingInline: 'var(--bar)' });
  });
  it('scrollPx arbitrary', () => {
    expect(scrollPx({ arbitraryValue: '10vw', important: false } as any)).toEqual({ scrollPaddingLeft: '10vw', scrollPaddingRight: '10vw', scrollPaddingInline: '10vw' });
  });
  it('scrollPx with !important', () => {
    expect(scrollPx({ value: '3', important: true } as any)).toEqual({ scrollPaddingLeft: 'calc(var(--spacing)*3) !important', scrollPaddingRight: 'calc(var(--spacing)*3) !important', scrollPaddingInline: 'calc(var(--spacing)*3) !important' });
  });

  it('scrollPy spacing scale', () => {
    expect(scrollPy({ value: '2', important: false } as any)).toEqual({ scrollPaddingTop: 'calc(var(--spacing)*2)', scrollPaddingBottom: 'calc(var(--spacing)*2)', scrollPaddingBlock: 'calc(var(--spacing)*2)' });
  });
  it('scrollPy negative', () => {
    expect(scrollPy({ value: '2', negative: true, important: false } as any)).toEqual({ scrollPaddingTop: 'calc(var(--spacing)*-2)', scrollPaddingBottom: 'calc(var(--spacing)*-2)', scrollPaddingBlock: 'calc(var(--spacing)*-2)' });
  });
  it('scrollPy custom property', () => {
    expect(scrollPy({ customProperty: true, value: '--baz', important: false } as any)).toEqual({ scrollPaddingTop: 'var(--baz)', scrollPaddingBottom: 'var(--baz)', scrollPaddingBlock: 'var(--baz)' });
  });
  it('scrollPy arbitrary', () => {
    expect(scrollPy({ arbitraryValue: '5em', important: false } as any)).toEqual({ scrollPaddingTop: '5em', scrollPaddingBottom: '5em', scrollPaddingBlock: '5em' });
  });
  it('scrollPy with !important', () => {
    expect(scrollPy({ value: '2', important: true } as any)).toEqual({ scrollPaddingTop: 'calc(var(--spacing)*2) !important', scrollPaddingBottom: 'calc(var(--spacing)*2) !important', scrollPaddingBlock: 'calc(var(--spacing)*2) !important' });
  });

  it('scrollPt', () => {
    expect(scrollPt({ value: '6', important: false } as any)).toEqual({ scrollPaddingTop: 'calc(var(--spacing)*6)' });
  });
  it('scrollPr', () => {
    expect(scrollPr({ value: '7', important: false } as any)).toEqual({ scrollPaddingRight: 'calc(var(--spacing)*7)' });
  });
  it('scrollPb', () => {
    expect(scrollPb({ value: '8', important: false } as any)).toEqual({ scrollPaddingBottom: 'calc(var(--spacing)*8)' });
  });
  it('scrollPl', () => {
    expect(scrollPl({ value: '9', important: false } as any)).toEqual({ scrollPaddingLeft: 'calc(var(--spacing)*9)' });
  });
  it('scrollPt with !important', () => {
    expect(scrollPt({ value: '6', important: true } as any)).toEqual({ scrollPaddingTop: 'calc(var(--spacing)*6) !important' });
  });

  it('scrollPs', () => {
    expect(scrollPs({ value: '5', important: false } as any)).toEqual({ scrollPaddingInlineStart: 'calc(var(--spacing)*5)' });
  });
  it('scrollPe', () => {
    expect(scrollPe({ value: '4', important: false } as any)).toEqual({ scrollPaddingInlineEnd: 'calc(var(--spacing)*4)' });
  });
  it('scrollPs custom property', () => {
    expect(scrollPs({ customProperty: true, value: '--ps', important: false } as any)).toEqual({ scrollPaddingInlineStart: 'var(--ps)' });
  });
  it('scrollPe arbitrary', () => {
    expect(scrollPe({ arbitraryValue: '2rem', important: false } as any)).toEqual({ scrollPaddingInlineEnd: '2rem' });
  });
  it('scrollPe with !important', () => {
    expect(scrollPe({ value: '4', important: true } as any)).toEqual({ scrollPaddingInlineEnd: 'calc(var(--spacing)*4) !important' });
  });
}); 