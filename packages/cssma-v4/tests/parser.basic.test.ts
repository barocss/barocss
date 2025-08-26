import { describe, it, expect } from 'vitest';
import { parseClassName } from '../src/core/parser';

describe('parseClassName', () => {
  it('parses group-hover:sm:bg-[red]', () => {
    const result = parseClassName('group-hover:sm:bg-[red]');
    expect(result.modifiers).toEqual([
      { type: 'group-hover', negative: false },
      { type: 'sm', negative: false }
    ]);
    expect(result.utility).toEqual({ prefix: 'bg', value: 'red', arbitrary: true, customProperty: false, negative: false, opacity: '' });
  });

  it('parses text-[color:var(--foo)]', () => {
    const result = parseClassName('text-[color:var(--foo)]');
    expect(result.modifiers).toEqual([]);
    expect(result.utility).toEqual({ prefix: 'text', value: 'color:var(--foo)', arbitrary: true, customProperty: false, negative: false, opacity: '' });
  });

  it('parses bg-(--my-bg)', () => {
    const result = parseClassName('bg-(--my-bg)');
    expect(result.modifiers).toEqual([]);
    expect(result.utility).toEqual({ prefix: 'bg', value: '--my-bg', arbitrary: false, customProperty: true, negative: false, opacity: '' });
  });

  it('parses hover:bg-red-500', () => {
    const result = parseClassName('hover:bg-red-500');
    expect(result.modifiers).toEqual([{ type: 'hover', negative: false }]);
    expect(result.utility).toEqual({ prefix: 'bg', value: 'red-500', arbitrary: false, customProperty: false, negative: false, opacity: '' });
  });

  it('parses bg-blue-100', () => {
    const result = parseClassName('bg-blue-100');
    expect(result.modifiers).toEqual([]);
    expect(result.utility).toEqual({ prefix: 'bg', value: 'blue-100', arbitrary: false, customProperty: false, negative: false, opacity: '' });
  });

  it('returns empty result for invalid or malformed class names', () => {
    // Invalid input cases
    const invalidInputs = [
      '',
      '-',
      ':',
      'hover-',
      '::',
      '---',
    ];
    for (const input of invalidInputs) {
      const result = parseClassName(input);
      // Expect: modifiers is an empty array
      expect(result.modifiers).toEqual([]);
      // utility is null or invalid structure
      const isValidUtility = result.utility === null || 
                           result.utility?.prefix === '' || 
                           result.utility?.value === '';
      expect(isValidUtility).toBe(true);
    }
  });
}); 