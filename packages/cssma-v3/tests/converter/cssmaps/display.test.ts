import { describe, it, expect } from 'vitest';
import { display } from '../../../src/converter/cssmaps/display';
import type { ParsedClassToken } from '../../../src/parser/utils';

describe('display (converter, prefix 기반)', () => {
  const displayCases = [
    ['inline', 'inline'],
    ['block', 'block'],
    ['inline-block', 'inline-block'],
    ['flow-root', 'flow-root'],
    ['flex', 'flex'],
    ['inline-flex', 'inline-flex'],
    ['grid', 'grid'],
    ['inline-grid', 'inline-grid'],
    ['contents', 'contents'],
    ['table', 'table'],
    ['inline-table', 'inline-table'],
    ['table-caption', 'table-caption'],
    ['table-cell', 'table-cell'],
    ['table-column', 'table-column'],
    ['table-column-group', 'table-column-group'],
    ['table-footer-group', 'table-footer-group'],
    ['table-header-group', 'table-header-group'],
    ['table-row-group', 'table-row-group'],
    ['table-row', 'table-row'],
    ['list-item', 'list-item'],
    ['hidden', 'none'],
  ];
  for (const [prefix, cssValue] of displayCases) {
    it(`${prefix} → display: ${cssValue}`, () => {
      const token = { prefix, value: '' } as ParsedClassToken;
      expect(display(token)).toEqual({ display: cssValue });
    });
    it(`${prefix}! → display: ${cssValue} !important`, () => {
      const token = { prefix, value: '', important: true } as ParsedClassToken;
      expect(display(token)).toEqual({ display: `${cssValue} !important` });
    });
  }

  it('sr-only → sr-only 스타일', () => {
    const token = { prefix: 'sr-only', value: '' } as ParsedClassToken;
    expect(display(token)).toEqual({
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      borderWidth: '0',
    });
  });
  it('not-sr-only → not-sr-only 스타일', () => {
    const token = { prefix: 'not-sr-only', value: '' } as ParsedClassToken;
    expect(display(token)).toEqual({
      position: 'static',
      width: 'auto',
      height: 'auto',
      padding: '0',
      margin: '0',
      overflow: 'visible',
      clip: 'auto',
      whiteSpace: 'normal',
    });
  });

  it('잘못된 prefix → undefined', () => {
    const token = { prefix: 'not-a-display', value: '' } as ParsedClassToken;
    expect(display(token)).toBeUndefined();
  });
}); 