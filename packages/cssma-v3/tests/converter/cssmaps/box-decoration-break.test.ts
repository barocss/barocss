import { describe, it, expect } from 'vitest';
import { boxDecorationBreak } from '../../../src/converter/cssmaps/box-decoration-break';
import type { ParsedClassToken } from '../../../src/parser/utils';

describe('boxDecorationBreak (converter)', () => {
  const values = [
    'slice', 'clone',
  ];
  for (const value of values) {
    it(`box-decoration-${value} → boxDecorationBreak: ${value}`, () => {
      const token = { prefix: 'box-decoration', value } as ParsedClassToken;
      expect(boxDecorationBreak(token)).toEqual({ boxDecorationBreak: value });
    });
    it(`box-decoration-${value}! → boxDecorationBreak: ${value} !important`, () => {
      const token = { prefix: 'box-decoration', value, important: true } as ParsedClassToken;
      expect(boxDecorationBreak(token)).toEqual({ boxDecorationBreak: `${value} !important` });
    });
  }
}); 