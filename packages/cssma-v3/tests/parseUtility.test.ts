import { describe, it, expect } from 'vitest';
import { parseUtility } from '../src/parser/parseUtility';

describe('parseUtility', () => {
  it('parses bg-cover', () => {
    expect(parseUtility('bg-cover')).toMatchObject({ type: 'utility', preset: false, value: 'cover' });
  });
  it('parses bg-repeat-x', () => {
    expect(parseUtility('bg-repeat-x')).toMatchObject({ type: 'utility', preset: false, value: 'repeat-x' });
  });
  it('parses bg-origin-border', () => {
    expect(parseUtility('bg-origin-border')).toMatchObject({ type: 'utility', preset: false, value: 'border' });
  });
  it('parses bg-center', () => {
    expect(parseUtility('bg-center')).toMatchObject({ type: 'utility', preset: false, value: 'center' });
  });
  it('parses content-none', () => {
    expect(parseUtility('content-none')).toMatchObject({ type: 'utility', preset: false, value: 'none' });
  });
  it('parses from-red-500', () => {
    expect(parseUtility('from-red-500')).toMatchObject({ type: 'utility', preset: false, value: 'red-500' });
  });
  it('parses text-center', () => {
    expect(parseUtility('text-center')).toMatchObject({ type: 'utility', preset: false, value: 'center' });
  });
  it('parses underline', () => {
    expect(parseUtility('underline')).toMatchObject({ type: 'utility', preset: false, value: 'underline' });
  });
  it('parses decoration-blue-500', () => {
    expect(parseUtility('decoration-blue-500')).toMatchObject({ type: 'utility', preset: false, value: 'blue-500' });
  });
  it('parses text-wrap', () => {
    expect(parseUtility('text-wrap')).toMatchObject({ type: 'utility', preset: false, value: 'wrap' });
  });
  it('parses indent-4', () => {
    expect(parseUtility('indent-4')).toMatchObject({ type: 'utility', preset: false, value: '4' });
  });
  it('parses -indent-8', () => {
    expect(parseUtility('-indent-8')).toMatchObject({ type: 'utility', preset: false, value: '8', negative: true });
  });
  it('parses indent-px', () => {
    expect(parseUtility('indent-px')).toMatchObject({ type: 'utility', preset: false, value: 'px' });
  });
  it('parses -indent-px', () => {
    expect(parseUtility('-indent-px')).toMatchObject({ type: 'utility', preset: false, value: 'px', negative: true });
  });
  it('parses vertical-align-top', () => {
    expect(parseUtility('vertical-align-top')).toMatchObject({ type: 'unknown', raw: 'vertical-align-top' });
  });
  it('parses white-space-nowrap', () => {
    expect(parseUtility('white-space-nowrap')).toMatchObject({ type: 'unknown', raw: 'white-space-nowrap' });
  });
  it('parses break-all', () => {
    expect(parseUtility('break-all')).toMatchObject({ type: 'utility', preset: false, value: 'all' });
  });
  it('parses overflow-wrap-anywhere', () => {
    expect(parseUtility('overflow-wrap-anywhere')).toMatchObject({ type: 'utility', preset: false, value: 'wrap-anywhere' });
  });
  it('parses hyphens-auto', () => {
    expect(parseUtility('hyphens-auto')).toMatchObject({ type: 'utility', preset: false, value: 'auto' });
  });
  it('returns unknown for invalid utility', () => {
    expect(parseUtility('not-a-real-utility')).toMatchObject({ type: 'unknown' });
  });
});

describe('parseUtility important flag', () => {
  it('parses important flag for background color', () => {
    expect(parseUtility('bg-red-500!')).toMatchObject({ type: 'utility', important: true });
  });
  it('parses important flag for padding', () => {
    expect(parseUtility('p-4!')).toMatchObject({ type: 'utility', important: true });
  });
  it('parses important flag for unknown utility', () => {
    expect(parseUtility('foo-bar!')).toMatchObject({ type: 'unknown' });
  });
  it('does not set important for normal utility', () => {
    expect(parseUtility('bg-red-500')).toMatchObject({ important: false });
  });
}); 