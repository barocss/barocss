import { describe, it, expect } from 'vitest';
import { parseClassName } from '../src/core/parser';

describe('parseClassName', () => {
  it('parses group-hover:sm:bg-[red]', () => {
    const result = parseClassName('group-hover:sm:bg-[red]');
    expect(result.modifiers).toEqual([
      { type: 'group', value: 'hover', negative: false },
      { type: 'sm', negative: false }
    ]);
    expect(result.utility).toEqual({ prefix: 'bg', value: 'red', arbitrary: true, customProperty: false, negative: false });
  });

  it('parses text-[color:var(--foo)]', () => {
    const result = parseClassName('text-[color:var(--foo)]');
    expect(result.modifiers).toEqual([]);
    expect(result.utility).toEqual({ prefix: 'text', value: 'color:var(--foo)', arbitrary: true, customProperty: false, negative: false });
  });

  it('parses bg-(--my-bg)', () => {
    const result = parseClassName('bg-(--my-bg)');
    expect(result.modifiers).toEqual([]);
    expect(result.utility).toEqual({ prefix: 'bg', value: '--my-bg', arbitrary: false, customProperty: true, negative: false });
  });

  it('parses hover:bg-red-500', () => {
    const result = parseClassName('hover:bg-red-500');
    expect(result.modifiers).toEqual([{ type: 'hover', negative: false }]);
    expect(result.utility).toEqual({ prefix: 'bg', value: 'red-500', arbitrary: false, customProperty: false, negative: false });
  });

  it('parses bg-blue-100', () => {
    const result = parseClassName('bg-blue-100');
    expect(result.modifiers).toEqual([]);
    expect(result.utility).toEqual({ prefix: 'bg', value: 'blue-100', arbitrary: false, customProperty: false, negative: false });
  });

  it('returns empty result for invalid or malformed class names', () => {
    // 비정상 입력 케이스
    const invalidInputs = [
      '',
      '-',
      ':',
      'hover-',
      '::',
      '---',
      'foo-bar', // 미등록 유틸리티(엔진에서 이미 커버, 파서도 명확히)
    ];
    for (const input of invalidInputs) {
      const result = parseClassName(input);
      // 기대: modifiers는 빈 배열, utility는 undefined 또는 null
      expect(result.modifiers).toEqual([]);
      expect(result.utility == null).toBe(true);
    }
  });
}); 