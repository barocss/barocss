import { describe, it, expect } from 'vitest';
import { parseClassList } from '../src/parser';


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

  it('parses responsive, group, peer, and pseudo modifiers', () => {
    const input = 'sm:md:lg:hover:focus:bg-green-100 group-hover:peer-checked:text-blue-400';
    const results = parseClassList(input);
    expect(results[0]).toMatchObject({
      original: 'sm:md:lg:hover:focus:bg-green-100',
      utility: { prefix: 'bg', value: 'green-100' },
      modifiers: [
        { type: 'modifier', raw: 'sm' },
        { type: 'modifier', raw: 'md' },
        { type: 'modifier', raw: 'lg' },
        { type: 'modifier', raw: 'hover' },
        { type: 'modifier', raw: 'focus' },
      ],
    });
    expect(results[1]).toMatchObject({
      original: 'group-hover:peer-checked:text-blue-400',
      utility: { prefix: 'text', value: 'blue-400' },
      modifiers: [
        { type: 'modifier', raw: 'group-hover' },
        { type: 'modifier', raw: 'peer-checked' },
      ],
    });
  });

  it('parses aria, data, and attribute modifiers', () => {
    const input = 'aria-checked:bg-red-100 data-active:text-yellow-200 [open]:border-2';
    const results = parseClassList(input);
    expect(results[0]).toMatchObject({
      original: 'aria-checked:bg-red-100',
      utility: { prefix: 'bg', value: 'red-100' },
      modifiers: [
        { type: 'modifier', raw: 'aria-checked' },
      ],
    });
    expect(results[1]).toMatchObject({
      original: 'data-active:text-yellow-200',
      utility: { prefix: 'text', value: 'yellow-200' },
      modifiers: [
        { type: 'modifier', raw: 'data-active' },
      ],
    });
    expect(results[2]).toMatchObject({
      original: '[open]:border-2',
      utility: { prefix: 'border', value: '2', numeric: true },
      modifiers: [
        { type: 'modifier', raw: '[open]' },
      ],
    });
  });

  it('parses container, @supports, logical, and container query modifiers', () => {
    const input = 'container:bg-pink-100 @supports:bg-cyan-200 has-[data-state=open]:text-black';
    const results = parseClassList(input);
    expect(results[0]).toMatchObject({
      original: 'container:bg-pink-100',
      utility: { prefix: 'bg', value: 'pink-100' },
      modifiers: [],
    });
    expect(results[1]).toMatchObject({
      original: '@supports:bg-cyan-200',
      utility: { prefix: 'bg', value: 'cyan-200' },
      modifiers: [
        { type: 'modifier', raw: '@supports' },
      ],
    });
    expect(results[2]).toMatchObject({
      original: 'has-[data-state=open]:text-black',
      utility: { prefix: 'text', value: 'black' },
      modifiers: [
        { type: 'modifier', raw: 'has-[data-state=open]' },
      ],
    });
  });

  it('parses multiple arbitrary, important, negative, and slash values', () => {
    const input = 'w-[calc(100%_-_2rem)]! -h-[50px] p-1/3! -m-2/5';
    const results = parseClassList(input);
    expect(results[0]).toMatchObject({
      original: 'w-[calc(100%_-_2rem)]!',
      utility: { prefix: 'w', value: 'calc(100% - 2rem)', arbitrary: true, important: true },
      modifiers: [],
    });
    expect(results[1]).toMatchObject({
      original: '-h-[50px]',
      utility: { prefix: 'h', value: '50px', arbitrary: true, negative: true },
      modifiers: [],
    });
    expect(results[2]).toMatchObject({
      original: 'p-1/3!',
      utility: { prefix: 'p', value: '1', numeric: true, slash: '3', important: true },
      modifiers: [],
    });
    expect(results[3]).toMatchObject({
      original: '-m-2/5',
      utility: { prefix: 'm', value: '2', numeric: true, slash: '5', negative: true },
      modifiers: [],
    });
  });

  it('parses unknown, whitespace, and mixed valid/invalid classes', () => {
    const input = 'foo-bar   bg-blue-100   unknown-class  p-4';
    const results = parseClassList(input);
    expect(results[0]).toMatchObject({
      original: 'foo-bar',
      utility: null,
      modifiers: [],
    });
    expect(results[1]).toMatchObject({
      original: 'bg-blue-100',
      utility: { prefix: 'bg', value: 'blue-100' },
      modifiers: [],
    });
    expect(results[2]).toMatchObject({
      original: 'unknown-class',
      utility: null,
      modifiers: [],
    });
    expect(results[3]).toMatchObject({
      original: 'p-4',
      utility: { prefix: 'p', value: '4', numeric: true },
      modifiers: [],
    });
  });

  it('parses advanced Tailwind v4 utilities and modifiers (latest spec)', () => {
    const input = [
      // Typography
      'font-mono text-lg font-bold italic underline overline line-through no-underline',
      'decoration-wavy decoration-2 underline-offset-4',
      'text-ellipsis text-clip truncate',
      'line-clamp-3',
      // Layout/Aspect
      'aspect-square aspect-video aspect-[4/3]',
      // Accent/Forced Color
      'accent-pink-500 forced-color-adjust-auto forced-color-adjust-none',
      // Writing mode
      'writing-mode-vertical-lr writing-mode-horizontal-tb',
      // Screen reader
      'sr-only not-sr-only',
      // Responsive/Variants
      'sm:md:lg:xl:2xl:bg-gradient-to-r',
      'dark:text-white light:text-black print:bg-gray-100',
      'motion-safe:animate-spin motion-reduce:animate-none',
      'even:bg-gray-50 odd:bg-white',
      // Marker
      'marker:marker-inherit marker:marker-current marker:marker-black',
      // Background
      'bg-blend-multiply bg-clip-padding bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500',
      // Ring/Divide
      'ring-2 ring-offset-4 ring-pink-400 divide-x-2 divide-y divide-pink-200',
      // Placeholder
      'placeholder:text-gray-400 placeholder:italic placeholder:opacity-50',
      // Sub/Sup
      'sub sup',
      // Misc
      'text-shadow',
      // Arbitrary variant
      '[&>*]:m-0',
      // Arbitrary value
      'bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))] text-[length:32px]'
    ].join(' ');
    const results = parseClassList(input);
    expect(results).toEqual(
      expect.arrayContaining([
        // font-mono
        {
          original: 'font-mono',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'font',
            preset: false,
            raw: 'font-mono',
            slash: undefined,
            type: 'utility',
            value: 'mono',
          },
        },
        // aspect-[4/3]
        {
          original: 'aspect-[4/3]',
          modifiers: [],
          utility: {
            arbitrary: true,
            arbitraryType: undefined,
            arbitraryValue: '4/3',
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'aspect',
            preset: false,
            raw: 'aspect-[4/3]',
            slash: undefined,
            type: 'utility',
            value: '4/3',
          },
        },
        // accent-pink-500
        {
          original: 'accent-pink-500',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'accent',
            preset: false,
            raw: 'accent-pink-500',
            slash: undefined,
            type: 'utility',
            value: 'pink-500',
          },
        },
        // forced-color-adjust-auto
        {
          original: 'forced-color-adjust-auto',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'forced-color-adjust-auto',
            preset: false,
            raw: 'forced-color-adjust-auto',
            slash: undefined,
            type: 'utility',
            value: '',
          },
        },
        // forced-color-adjust-none
        {
          original: 'forced-color-adjust-none',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'forced-color-adjust-none',
            preset: false,
            raw: 'forced-color-adjust-none',
            slash: undefined,
            type: 'utility',
            value: '',
          },
        },
        // writing-mode-vertical-lr
        {
          original: 'writing-mode-vertical-lr',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'writing-mode',
            preset: false,
            raw: 'writing-mode-vertical-lr',
            slash: undefined,
            type: 'utility',
            value: 'vertical-lr',
          },
        },
        // writing-mode-horizontal-tb
        {
          original: 'writing-mode-horizontal-tb',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'writing-mode',
            preset: false,
            raw: 'writing-mode-horizontal-tb',
            slash: undefined,
            type: 'utility',
            value: 'horizontal-tb',
          },
        },
        // sr-only
        {
          original: 'sr-only',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'sr-only',
            preset: false,
            raw: 'sr-only',
            slash: undefined,
            type: 'utility',
            value: '',
          },
        },
        // not-sr-only
        {
          original: 'not-sr-only',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'not-sr-only',
            preset: false,
            raw: 'not-sr-only',
            slash: undefined,
            type: 'utility',
            value: '',
          },
        },
        // sm:md:lg:xl:2xl:bg-gradient-to-r
        {
          original: 'sm:md:lg:xl:2xl:bg-gradient-to-r',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'sm', preset: false, raw: 'sm', slash: undefined, type: 'modifier', value: '' },
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'md', preset: false, raw: 'md', slash: undefined, type: 'modifier', value: '' },
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'lg', preset: false, raw: 'lg', slash: undefined, type: 'modifier', value: '' },
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'xl', preset: false, raw: 'xl', slash: undefined, type: 'modifier', value: '' },
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: '2xl', preset: false, raw: '2xl', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'bg-gradient-to',
            preset: false,
            raw: 'bg-gradient-to-r',
            slash: undefined,
            type: 'utility',
            value: 'r',
          },
        },
        // dark:text-white
        {
          original: 'dark:text-white',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'dark', preset: false, raw: 'dark', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'text',
            preset: false,
            raw: 'text-white',
            slash: undefined,
            type: 'utility',
            value: 'white',
          },
        },
        // light:text-black
        {
          original: 'light:text-black',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'light', preset: false, raw: 'light', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'text',
            preset: false,
            raw: 'text-black',
            slash: undefined,
            type: 'utility',
            value: 'black',
          },
        },
        // print:bg-gray-100
        {
          original: 'print:bg-gray-100',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'print', preset: false, raw: 'print', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'bg',
            preset: false,
            raw: 'bg-gray-100',
            slash: undefined,
            type: 'utility',
            value: 'gray-100',
          },
        },
        // motion-safe:animate-spin
        {
          original: 'motion-safe:animate-spin',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'motion-safe', preset: false, raw: 'motion-safe', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'animate',
            preset: false,
            raw: 'animate-spin',
            slash: undefined,
            type: 'utility',
            value: 'spin',
          },
        },
        // motion-reduce:animate-none
        {
          original: 'motion-reduce:animate-none',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'motion-reduce', preset: false, raw: 'motion-reduce', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'animate',
            preset: false,
            raw: 'animate-none',
            slash: undefined,
            type: 'utility',
            value: 'none',
          },
        },
        // even:bg-gray-50
        {
          original: 'even:bg-gray-50',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'even', preset: false, raw: 'even', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'bg',
            preset: false,
            raw: 'bg-gray-50',
            slash: undefined,
            type: 'utility',
            value: 'gray-50',
          },
        },
        // odd:bg-white
        {
          original: 'odd:bg-white',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'odd', preset: false, raw: 'odd', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'bg',
            preset: false,
            raw: 'bg-white',
            slash: undefined,
            type: 'utility',
            value: 'white',
          },
        },
        // marker:marker-inherit
        {
          original: 'marker:marker-inherit',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'marker', preset: false, raw: 'marker', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: null,
        },
        // marker:marker-current
        {
          original: 'marker:marker-current',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'marker', preset: false, raw: 'marker', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: null,
        },
        // marker:marker-black
        {
          original: 'marker:marker-black',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'marker', preset: false, raw: 'marker', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: null,
        },
        // bg-blend-multiply
        {
          original: 'bg-blend-multiply',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'bg-blend',
            preset: false,
            raw: 'bg-blend-multiply',
            slash: undefined,
            type: 'utility',
            value: 'multiply',
          },
        },
        // bg-clip-padding
        {
          original: 'bg-clip-padding',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'bg-clip',
            preset: false,
            raw: 'bg-clip-padding',
            slash: undefined,
            type: 'utility',
            value: 'padding',
          },
        },
        // bg-gradient-to-br
        {
          original: 'bg-gradient-to-br',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'bg-gradient-to',
            preset: false,
            raw: 'bg-gradient-to-br',
            slash: undefined,
            type: 'utility',
            value: 'br',
          },
        },
        // from-pink-500
        {
          original: 'from-pink-500',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'from',
            preset: false,
            raw: 'from-pink-500',
            slash: undefined,
            type: 'utility',
            value: 'pink-500',
          },
        },
        // via-red-500
        {
          original: 'via-red-500',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'via',
            preset: false,
            raw: 'via-red-500',
            slash: undefined,
            type: 'utility',
            value: 'red-500',
          },
        },
        // to-yellow-500
        {
          original: 'to-yellow-500',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'to',
            preset: false,
            raw: 'to-yellow-500',
            slash: undefined,
            type: 'utility',
            value: 'yellow-500',
          },
        },
        // ring-2
        {
          original: 'ring-2',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: true,
            prefix: 'ring',
            preset: false,
            raw: 'ring-2',
            slash: undefined,
            type: 'utility',
            value: '2',
          },
        },
        // ring-offset-4
        {
          original: 'ring-offset-4',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'ring',
            preset: false,
            raw: 'ring-offset-4',
            slash: undefined,
            type: 'utility',
            value: 'offset-4',
          },
        },
        // ring-pink-400
        {
          original: 'ring-pink-400',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'ring',
            preset: false,
            raw: 'ring-pink-400',
            slash: undefined,
            type: 'utility',
            value: 'pink-400',
          },
        },
        // divide-x-2
        {
          original: 'divide-x-2',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: true,
            prefix: 'divide-x',
            preset: false,
            raw: 'divide-x-2',
            slash: undefined,
            type: 'utility',
            value: '2',
          },
        },
        // divide-y
        {
          original: 'divide-y',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'divide-y',
            preset: false,
            raw: 'divide-y',
            slash: undefined,
            type: 'utility',
            value: '',
          },
        },
        // divide-pink-200
        {
          original: 'divide-pink-200',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'divide',
            preset: false,
            raw: 'divide-pink-200',
            slash: undefined,
            type: 'utility',
            value: 'pink-200',
          },
        },
        // placeholder:text-gray-400
        {
          original: 'placeholder:text-gray-400',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'placeholder', preset: false, raw: 'placeholder', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'text',
            preset: false,
            raw: 'text-gray-400',
            slash: undefined,
            type: 'utility',
            value: 'gray-400',
          },
        },
        // placeholder:italic
        {
          original: 'placeholder:italic',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'placeholder', preset: false, raw: 'placeholder', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'italic',
            preset: false,
            raw: 'italic',
            slash: undefined,
            type: 'utility',
            value: '',
          },
        },
        // placeholder:opacity-50
        {
          original: 'placeholder:opacity-50',
          modifiers: [
            { arbitrary: false, arbitraryType: undefined, arbitraryValue: undefined, customProperty: false, important: false, negative: false, numeric: false, prefix: 'placeholder', preset: false, raw: 'placeholder', slash: undefined, type: 'modifier', value: '' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: true,
            prefix: 'opacity',
            preset: false,
            raw: 'opacity-50',
            slash: undefined,
            type: 'utility',
            value: '50',
          },
        },
        // sub
        {
          original: 'sub',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'sub',
            preset: false,
            raw: 'sub',
            slash: undefined,
            type: 'utility',
            value: '',
          },
        },
        // sup
        {
          original: 'sup',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'sup',
            preset: false,
            raw: 'sup',
            slash: undefined,
            type: 'utility',
            value: '',
          },
        },
        // text-shadow
        {
          original: 'text-shadow',
          modifiers: [],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'text',
            preset: false,
            raw: 'text-shadow',
            slash: undefined,
            type: 'utility',
            value: 'shadow',
          },
        },
        // [&>*]:m-0
        {
          original: '[&>*]:m-0',
          modifiers: [
            { arbitrary: true, arbitraryType: 'attribute', arbitraryValue: '&>*', customProperty: false, important: false, negative: false, numeric: false, prefix: 'arbitrary', preset: false, raw: '[&>*]', slash: undefined, type: 'modifier', value: '&>*' },
          ],
          utility: {
            arbitrary: false,
            arbitraryType: undefined,
            arbitraryValue: undefined,
            customProperty: false,
            important: false,
            negative: false,
            numeric: true,
            prefix: 'm',
            preset: false,
            raw: 'm-0',
            slash: undefined,
            type: 'utility',
            value: '0',
          },
        },
        // bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))]
        {
          original: 'bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))]',
          modifiers: [],
          utility: {
            arbitrary: true,
            arbitraryType: 'conic-gradient',
            arbitraryValue: 'at top left, var(--tw-gradient-stops)',
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'bg',
            preset: false,
            raw: 'bg-[conic-gradient(at_top_left,_var(--tw-gradient-stops))]',
            slash: undefined,
            type: 'utility',
            value: 'conic-gradient(at top left, var(--tw-gradient-stops))',
          },
        },
        // text-[length:32px]
        {
          original: 'text-[length:32px]',
          modifiers: [],
          utility: {
            arbitrary: true,
            arbitraryType: undefined,
            arbitraryValue: 'length:32px',
            customProperty: false,
            important: false,
            negative: false,
            numeric: false,
            prefix: 'text',
            preset: false,
            raw: 'text-[length:32px]',
            slash: undefined,
            type: 'utility',
            value: 'length:32px',
          },
        },
      ])
    );
  });
}); 