import { describe, it, expect } from 'vitest';
import { parseClassList } from '../src/parser';

function getModifierTypes(modifiers: any[]) {
  return modifiers.map((m) => m.type);
}

describe('parseClassList (integration)', () => {
  it('parses complex class list with multiple modifiers and flags (full object match)', () => {
    const input = 'dark:group-hover:sm:focus:bg-blue-500 p-1/2 -m-4 hover:text-[oklch(0.6_0.2_120)]! foo-bar';
    const results = parseClassList(input);
    expect(results).toHaveLength(5);
    expect(results[0]).toMatchObject({
      original: 'dark:group-hover:sm:focus:bg-blue-500',
      utility: { prefix: 'bg', value: 'blue-500' },
      modifiers: [
        { type: 'modifier', raw: 'dark' },
        { type: 'modifier', raw: 'group-hover' },
        { type: 'modifier', raw: 'sm' },
        { type: 'modifier', raw: 'focus' },
      ],
    });
    expect(results[1]).toMatchObject({
      original: 'p-1/2',
      utility: { prefix: 'p', value: '1', numeric: true, slash: '2' },
      modifiers: [],
    });
    expect(results[2]).toMatchObject({
      original: '-m-4',
      utility: { prefix: 'm', value: '4', negative: true },
      modifiers: [],
    });
    expect(results[3]).toMatchObject({
      original: 'hover:text-[oklch(0.6_0.2_120)]!',
      utility: { prefix: 'text', value: 'oklch(0.6 0.2 120)', arbitrary: true, important: true },
      modifiers: [
        { type: 'modifier', raw: 'hover' },
      ],
    });
    expect(results[4]).toMatchObject({
      original: 'foo-bar',
      utility: null,
      modifiers: [],
    });
  });

  it('parses empty and whitespace-only input as empty array', () => {
    expect(parseClassList('')).toEqual([]);
    expect(parseClassList('   ')).toEqual([]);
  });

  it('parses important and negative flags together', () => {
    const results = parseClassList('-p-4!');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      original: '-p-4!',
      utility: { prefix: 'p', value: '4', negative: true, important: true },
      modifiers: [],
    });
  });
}); 