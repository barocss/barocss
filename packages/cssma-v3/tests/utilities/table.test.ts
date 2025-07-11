import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (table)', () => {
  it('parses table', () => {
    expect(parseUtility('table')).toEqual(baseUtility({ prefix: 'table', raw: 'table' }));
    expect(parseUtility('table-fixed')).toEqual(baseUtility({ prefix: 'table', value: 'fixed', raw: 'table-fixed' }));
    expect(parseUtility('table-auto')).toEqual(baseUtility({ prefix: 'table', value: 'auto', raw: 'table-auto' }));
  });
  it('parses border-spacing', () => {
    expect(parseUtility('border-spacing-2')).toEqual(baseUtility({ prefix: 'border-spacing', value: '2', numeric: true, raw: 'border-spacing-2' }));
  });
  it('parses caption', () => {
    expect(parseUtility('caption-top')).toEqual(baseUtility({ prefix: 'caption', value: 'top', raw: 'caption-top' }));
    expect(parseUtility('caption-bottom')).toEqual(baseUtility({ prefix: 'caption', value: 'bottom', raw: 'caption-bottom' }));
  });
  it('returns unknown for invalid', () => {
    expect(parseUtility('table-')).toEqual({ type: 'unknown', raw: 'table-' });
    expect(parseUtility('border-spacing-')).toEqual({ type: 'unknown', raw: 'border-spacing-' });
    expect(parseUtility('caption-')).toEqual({ type: 'unknown', raw: 'caption-' });
  });
}); 