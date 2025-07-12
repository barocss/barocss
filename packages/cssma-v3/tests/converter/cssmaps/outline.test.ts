import { describe, it, expect } from 'vitest';
import { outline, outlineOffset } from '../../../src/converter/cssmaps/outline';
import { createContext } from '../../../src/config/context';
import type { ParsedClassToken } from '../../../src/parser/utils';
import type { CssmaConfig } from '../../../src/theme-types';

const config: CssmaConfig = {
  theme: {
    colors: {
      red: { '500': '#ef4444' },
      blue: { '100': '#dbeafe' }
    }
  }
};
const ctx = createContext(config);

describe('outline (converter)', () => {
  it('outline-2 → outlineWidth: 2px', () => {
    const token = { prefix: 'outline', value: '2', numeric: true } as ParsedClassToken;
    expect(outline(token, ctx)).toEqual({ outlineWidth: '2px' });
  });
  it('outline-red-500 → outlineColor: #ef4444', () => {
    const token = { prefix: 'outline', value: 'red-500' } as ParsedClassToken;
    expect(outline(token, ctx)).toEqual({ outlineColor: '#ef4444' });
  });
  it('outline-solid → outlineStyle: solid', () => {
    const token = { prefix: 'outline', value: 'solid' } as ParsedClassToken;
    expect(outline(token, ctx)).toEqual({ outlineStyle: 'solid' });
  });
  it('outline-[3px] → outlineWidth: 3px', () => {
    const token = { prefix: 'outline', arbitrary: true, arbitraryValue: '3px' } as ParsedClassToken;
    expect(outline(token, ctx)).toEqual({ outlineWidth: '3px' });
  });
  it('outline-[#ff0000] → outlineColor: #ff0000', () => {
    const token = { prefix: 'outline', arbitrary: true, arbitraryValue: '#ff0000' } as ParsedClassToken;
    expect(outline(token, ctx)).toEqual({ outlineColor: '#ff0000' });
  });
  it('outline-dashed → outlineStyle: dashed', () => {
    const token = { prefix: 'outline', value: 'dashed' } as ParsedClassToken;
    expect(outline(token, ctx)).toEqual({ outlineStyle: 'dashed' });
  });
  it('outline-hidden → outline/outlineOffset', () => {
    const token = { prefix: 'outline', value: 'hidden' } as ParsedClassToken;
    expect(outline(token, ctx)).toEqual({ outline: '2px solid transparent', outlineOffset: '2px' });
  });
  it('outline-(color:--my-color) → outlineColor: var(--my-color)', () => {
    const token = { prefix: 'outline', value: 'color:--my-color', customProperty: true } as ParsedClassToken;
    expect(outline(token, ctx)).toEqual({ outlineColor: 'var(--my-color)' });
  });
  it('outline-2 + !important', () => {
    const token = { prefix: 'outline', value: '2', numeric: true, important: true } as ParsedClassToken;
    expect(outline(token, ctx)).toEqual({ outlineWidth: '2px !important' });
  });
});

describe('outlineOffset (converter)', () => {
  it('outline-offset-4 → outlineOffset: 4px', () => {
    const token = { prefix: 'outline-offset', value: '4', numeric: true } as ParsedClassToken;
    expect(outlineOffset(token, ctx)).toEqual({ outlineOffset: '4px' });
  });
  it('outline-offset-[3px] → outlineOffset: 3px', () => {
    const token = { prefix: 'outline-offset', arbitrary: true, arbitraryValue: '3px' } as ParsedClassToken;
    expect(outlineOffset(token, ctx)).toEqual({ outlineOffset: '3px' });
  });
  it('outline-offset-(--my-offset) → outlineOffset: var(--my-offset)', () => {
    const token = { prefix: 'outline-offset', value: '--my-offset', customProperty: true } as ParsedClassToken;
    expect(outlineOffset(token, ctx)).toEqual({ outlineOffset: 'var(--my-offset)' });
  });
  it('-outline-offset-2 → outlineOffset: calc(2px * -1)', () => {
    const token = { prefix: '-outline-offset', value: '-2' } as ParsedClassToken;
    expect(outlineOffset(token, ctx)).toEqual({ outlineOffset: 'calc(2px * -1)' });
  });
  it('outline-offset-4 + !important', () => {
    const token = { prefix: 'outline-offset', value: '4', numeric: true, important: true } as ParsedClassToken;
    expect(outlineOffset(token, ctx)).toEqual({ outlineOffset: '4px !important' });
  });
}); 