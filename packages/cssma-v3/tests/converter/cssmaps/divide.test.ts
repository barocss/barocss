import { describe, it, expect } from 'vitest';
import { divideX, divideY, divide } from '../../../src/converter/cssmaps/divide';
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

describe('divideX (converter)', () => {
  it('divide-x → 1px end, 0px start', () => {
    const token = { prefix: 'divide-x' } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderInlineStartWidth: '0px',
        borderInlineEndWidth: '1px',
      },
    });
  });
  it('divide-x-2 → 2px end, 0px start', () => {
    const token = { prefix: 'divide-x', value: '2', numeric: true } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderInlineStartWidth: '0px',
        borderInlineEndWidth: '2px',
      },
    });
  });
  it('divide-x-0 → 0px both', () => {
    const token = { prefix: 'divide-x', value: '0' } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderInlineStartWidth: '0px',
        borderInlineEndWidth: '0px',
      },
    });
  });
  it('divide-x-reverse → --tw-divide-x-reverse: 1', () => {
    const token = { prefix: 'divide-x', value: 'reverse' } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '--tw-divide-x-reverse': '1',
    });
  });
  it('divide-x-red-500 → theme color', () => {
    const token = { prefix: 'divide-x', value: 'red-500' } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderColor: '#ef4444',
      },
    });
  });
  it('divide-x-[#123456] → arbitrary color', () => {
    const token = { prefix: 'divide-x', arbitrary: true, arbitraryValue: '#123456' } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderColor: '#123456',
      },
    });
  });
  it('divide-x-solid → borderStyle', () => {
    const token = { prefix: 'divide-x', value: 'solid' } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderStyle: 'solid',
      },
    });
  });
  it('divide-x-[3px] → arbitrary length', () => {
    const token = { prefix: 'divide-x', arbitrary: true, arbitraryValue: '3px' } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderInlineStartWidth: '0px',
        borderInlineEndWidth: '3px',
      },
    });
  });
  it('divide-x-(color:--my-color) → custom property color', () => {
    const token = { prefix: 'divide-x', customProperty: true, value: 'color:--my-color' } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderColor: 'var(--my-color)',
      },
    });
  });
  it('divide-x-(length:--my-width) → custom property length', () => {
    const token = { prefix: 'divide-x', customProperty: true, value: 'length:--my-width' } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderInlineStartWidth: '0px',
        borderInlineEndWidth: 'var(--my-width)',
      },
    });
  });
  it('divide-x-2! → important', () => {
    const token = { prefix: 'divide-x', value: '2', numeric: true, important: true } as ParsedClassToken;
    expect(divideX(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderInlineStartWidth: '0px !important',
        borderInlineEndWidth: '2px !important',
      },
    });
  });
});

describe('divideY (converter)', () => {
  it('divide-y → 1px bottom, 0px top', () => {
    const token = { prefix: 'divide-y' } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderTopWidth: '0px',
        borderBottomWidth: '1px',
      },
    });
  });
  it('divide-y-2 → 2px bottom, 0px top', () => {
    const token = { prefix: 'divide-y', value: '2', numeric: true } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderTopWidth: '0px',
        borderBottomWidth: '2px',
      },
    });
  });
  it('divide-y-0 → 0px both', () => {
    const token = { prefix: 'divide-y', value: '0' } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderTopWidth: '0px',
        borderBottomWidth: '0px',
      },
    });
  });
  it('divide-y-reverse → --tw-divide-y-reverse: 1', () => {
    const token = { prefix: 'divide-y', value: 'reverse' } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '--tw-divide-y-reverse': '1',
    });
  });
  it('divide-y-blue-100 → theme color', () => {
    const token = { prefix: 'divide-y', value: 'blue-100' } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderColor: '#dbeafe',
      },
    });
  });
  it('divide-y-[#123456] → arbitrary color', () => {
    const token = { prefix: 'divide-y', arbitrary: true, arbitraryValue: '#123456' } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderColor: '#123456',
      },
    });
  });
  it('divide-y-dotted → borderStyle', () => {
    const token = { prefix: 'divide-y', value: 'dotted' } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderStyle: 'dotted',
      },
    });
  });
  it('divide-y-[5px] → arbitrary length', () => {
    const token = { prefix: 'divide-y', arbitrary: true, arbitraryValue: '5px' } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderTopWidth: '0px',
        borderBottomWidth: '5px',
      },
    });
  });
  it('divide-y-(color:--my-color) → custom property color', () => {
    const token = { prefix: 'divide-y', customProperty: true, value: 'color:--my-color' } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderColor: 'var(--my-color)',
      },
    });
  });
  it('divide-y-(length:--my-width) → custom property length', () => {
    const token = { prefix: 'divide-y', customProperty: true, value: 'length:--my-width' } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderTopWidth: '0px',
        borderBottomWidth: 'var(--my-width)',
      },
    });
  });
  it('divide-y-2! → important', () => {
    const token = { prefix: 'divide-y', value: '2', numeric: true, important: true } as ParsedClassToken;
    expect(divideY(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderTopWidth: '0px !important',
        borderBottomWidth: '2px !important',
      },
    });
  });
});

describe('divide (converter)', () => {
  it('divide-solid → borderStyle', () => {
    const token = { prefix: 'divide', value: 'solid' } as ParsedClassToken;
    expect(divide(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderStyle: 'solid',
      },
    });
  });
  it('divide-dashed → borderStyle', () => {
    const token = { prefix: 'divide', value: 'dashed' } as ParsedClassToken;
    expect(divide(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderStyle: 'dashed',
      },
    });
  });
  it('divide-none → borderStyle', () => {
    const token = { prefix: 'divide', value: 'none' } as ParsedClassToken;
    expect(divide(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderStyle: 'none',
      },
    });
  });
  it('divide-unknown → fallback', () => {
    const token = { prefix: 'divide', value: 'unknown' } as ParsedClassToken;
    expect(divide(token, ctx)).toEqual({
      borderStyle: 'unknown',
    });
  });
  it('divide-solid! → important', () => {
    const token = { prefix: 'divide', value: 'solid', important: true } as ParsedClassToken;
    expect(divide(token, ctx)).toEqual({
      '& > :not(:last-child)': {
        borderStyle: 'solid !important',
      },
    });
  });
}); 