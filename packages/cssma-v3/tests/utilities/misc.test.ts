import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (misc)', () => {
  it('parses display', () => {
    expect(parseUtility('block')).toEqual(baseUtility({ prefix: 'block', raw: 'block' }));
    expect(parseUtility('inline-block')).toEqual(baseUtility({ prefix: 'inline', value: 'block', raw: 'inline-block' }));
    expect(parseUtility('hidden')).toEqual(baseUtility({ prefix: 'hidden', raw: 'hidden' }));
  });
  it('parses float', () => {
    expect(parseUtility('float-right')).toEqual(baseUtility({ prefix: 'float', value: 'right', raw: 'float-right' }));
    expect(parseUtility('float-left')).toEqual(baseUtility({ prefix: 'float', value: 'left', raw: 'float-left' }));
  });
  it('parses clear', () => {
    expect(parseUtility('clear-both')).toEqual(baseUtility({ prefix: 'clear', value: 'both', raw: 'clear-both' }));
  });
  it('parses content', () => {
    expect(parseUtility('content-none')).toEqual(baseUtility({ prefix: 'content', value: 'none', raw: 'content-none' }));
  });
  it('parses filter', () => {
    expect(parseUtility('filter')).toEqual(baseUtility({ prefix: 'filter', raw: 'filter' }));
    expect(parseUtility('filter-none')).toEqual(baseUtility({ prefix: 'filter', value: 'none', raw: 'filter-none' }));
  });
  it('returns unknown for invalid', () => {
    expect(parseUtility('block-')).toEqual({ type: 'unknown', raw: 'block-' });
    expect(parseUtility('float-')).toEqual({ type: 'unknown', raw: 'float-' });
    expect(parseUtility('clear-')).toEqual({ type: 'unknown', raw: 'clear-' });
    expect(parseUtility('content-')).toEqual({ type: 'unknown', raw: 'content-' });
    expect(parseUtility('filter-')).toEqual({ type: 'unknown', raw: 'filter-' });
  });
}); 