import { describe, it, expect } from 'vitest';
import { float } from '../../../src/converter/cssmaps/float';
import type { ParsedClassToken } from '../../../src/parser/utils';

describe('float (converter, prefix 기반)', () => {
  const floatCases = [
    ['float-right', 'right'],
    ['float-left', 'left'],
    ['float-start', 'inline-start'],
    ['float-end', 'inline-end'],
    ['float-none', 'none'],
  ];
  for (const [prefix, cssValue] of floatCases) {
    it(`${prefix} → float: ${cssValue}`, () => {
      const token = { prefix, value: '' } as ParsedClassToken;
      expect(float(token)).toEqual({ float: cssValue });
    });
    it(`${prefix}! → float: ${cssValue} !important`, () => {
      const token = { prefix, value: '', important: true } as ParsedClassToken;
      expect(float(token)).toEqual({ float: `${cssValue} !important` });
    });
  }

  it('잘못된 prefix → undefined', () => {
    const token = { prefix: 'float-up', value: '' } as ParsedClassToken;
    expect(float(token)).toBeUndefined();
  });
}); 