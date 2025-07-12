import { describe, it, expect } from 'vitest';
import { boxSizing } from '../../../src/converter/cssmaps/box-sizing';
import type { ParsedClassToken } from '../../../src/parser/utils';

describe('boxSizing (converter)', () => {
  it('box-border → boxSizing: border-box', () => {
    const token = { prefix: 'box', value: 'border' } as ParsedClassToken;
    expect(boxSizing(token)).toEqual({ boxSizing: 'border-box' });
  });
  it('box-content → boxSizing: content-box', () => {
    const token = { prefix: 'box', value: 'content' } as ParsedClassToken;
    expect(boxSizing(token)).toEqual({ boxSizing: 'content-box' });
  });
  it('box-border! → boxSizing: border-box !important', () => {
    const token = { prefix: 'box', value: 'border', important: true } as ParsedClassToken;
    expect(boxSizing(token)).toEqual({ boxSizing: 'border-box !important' });
  });
  it('box-content! → boxSizing: content-box !important', () => {
    const token = { prefix: 'box', value: 'content', important: true } as ParsedClassToken;
    expect(boxSizing(token)).toEqual({ boxSizing: 'content-box !important' });
  });
  it('box-sizing-unknown → undefined', () => {
    const token = { prefix: 'box', value: 'unknown' } as ParsedClassToken;
    expect(boxSizing(token)).toBeUndefined();
  });
}); 