import { describe, it, expect } from 'vitest';
import { applyClassName } from '../src/core/engine';
import { createContext } from '../src/core/context';

// --- New preset utility structure tests ---
describe('preset utilities (staticUtility/functionalUtility)', () => {
  const ctx = createContext({
    theme: {
      colors: { red: { 500: '#f00' }, blue: { 500: '#00f' } },
      '--z-index': { '10': '10', '20': '20' },
      '--order': { '1': '1', '2': '2' },
      '--grid-column': { '2': '2', '3': '3' },
      '--grid-column-start': { '1': '1' },
      '--grid-column-end': { '2': '2' },
    }
  });

  // Display/Isolation
  it('block/hidden/flex/isolate/isolation-auto', () => {
    expect(applyClassName('block', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'block' }]);
    expect(applyClassName('hidden', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'none' }]);
    expect(applyClassName('flex', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'flex' }]);
    expect(applyClassName('isolate', ctx)).toEqual([{ type: 'decl', prop: 'isolation', value: 'isolate' }]);
    expect(applyClassName('isolation-auto', ctx)).toEqual([{ type: 'decl', prop: 'isolation', value: 'auto' }]);
  });

  // Aspect Ratio
  it('aspect-ratio: static utilities', () => {
    expect(applyClassName('aspect-square', ctx)).toEqual([{ type: 'decl', prop: 'aspect-ratio', value: '1 / 1' }]);
    expect(applyClassName('aspect-video', ctx)).toEqual([{ type: 'decl', prop: 'aspect-ratio', value: 'var(--aspect-ratio-video)' }]);
    expect(applyClassName('aspect-auto', ctx)).toEqual([{ type: 'decl', prop: 'aspect-ratio', value: 'auto' }]);
  });

  it('aspect-ratio: fraction, arbitrary, custom property', () => {
    // fraction value (fraction 검사)
    expect(applyClassName('aspect-16/9', ctx)).toEqual([{ type: 'decl', prop: 'aspect-ratio', value: '16/9' }]);
    expect(applyClassName('aspect-4/3', ctx)).toEqual([{ type: 'decl', prop: 'aspect-ratio', value: '4/3' }]);
    // arbitrary value (fraction 검사 안함, 대괄호 제거)
    expect(applyClassName('aspect-[4/3]', ctx)).toEqual([{ type: 'decl', prop: 'aspect-ratio', value: '4/3' }]);
    expect(applyClassName('aspect-[calc(16+9)/9]', ctx)).toEqual([{ type: 'decl', prop: 'aspect-ratio', value: 'calc(16+9)/9' }]);
    // custom property
    expect(applyClassName('aspect-(--my-ratio)', ctx)).toEqual([{ type: 'decl', prop: 'aspect-ratio', value: 'var(--my-ratio)' }]);
  });

  // Columns
  it('columns: static utilities', () => {
    expect(applyClassName('columns-auto', ctx)).toEqual([{ type: 'decl', prop: 'columns', value: 'auto' }]);
    expect(applyClassName('columns-sm', ctx)).toEqual([{ type: 'decl', prop: 'columns', value: 'var(--container-sm)' }]);
    expect(applyClassName('columns-lg', ctx)).toEqual([{ type: 'decl', prop: 'columns', value: 'var(--container-lg)' }]);
    expect(applyClassName('columns-xl', ctx)).toEqual([{ type: 'decl', prop: 'columns', value: 'var(--container-xl)' }]);
    expect(applyClassName('columns-2xl', ctx)).toEqual([{ type: 'decl', prop: 'columns', value: 'var(--container-2xl)' }]);
  });

  it('columns: dynamic utilities', () => {
    // arbitrary value
    expect(applyClassName('columns-[3]', ctx)).toEqual([{ type: 'decl', prop: 'columns', value: '3' }]);
    expect(applyClassName('columns-[30vw]', ctx)).toEqual([{ type: 'decl', prop: 'columns', value: '30vw' }]);
    // custom property
    expect(applyClassName('columns-(--my-columns)', ctx)).toEqual([{ type: 'decl', prop: 'columns', value: 'var(--my-columns)' }]);
  });

  // Break After
  it('break-after: all static utilities', () => {
    expect(applyClassName('break-after-auto', ctx)).toEqual([{ type: 'decl', prop: 'break-after', value: 'auto' }]);
    expect(applyClassName('break-after-avoid', ctx)).toEqual([{ type: 'decl', prop: 'break-after', value: 'avoid' }]);
    expect(applyClassName('break-after-all', ctx)).toEqual([{ type: 'decl', prop: 'break-after', value: 'all' }]);
    expect(applyClassName('break-after-avoid-page', ctx)).toEqual([{ type: 'decl', prop: 'break-after', value: 'avoid-page' }]);
    expect(applyClassName('break-after-page', ctx)).toEqual([{ type: 'decl', prop: 'break-after', value: 'page' }]);
    expect(applyClassName('break-after-left', ctx)).toEqual([{ type: 'decl', prop: 'break-after', value: 'left' }]);
    expect(applyClassName('break-after-right', ctx)).toEqual([{ type: 'decl', prop: 'break-after', value: 'right' }]);
    expect(applyClassName('break-after-column', ctx)).toEqual([{ type: 'decl', prop: 'break-after', value: 'column' }]);
  });

  // Break Before
  it('break-before: all static utilities', () => {
    expect(applyClassName('break-before-auto', ctx)).toEqual([{ type: 'decl', prop: 'break-before', value: 'auto' }]);
    expect(applyClassName('break-before-avoid', ctx)).toEqual([{ type: 'decl', prop: 'break-before', value: 'avoid' }]);
    expect(applyClassName('break-before-all', ctx)).toEqual([{ type: 'decl', prop: 'break-before', value: 'all' }]);
    expect(applyClassName('break-before-avoid-page', ctx)).toEqual([{ type: 'decl', prop: 'break-before', value: 'avoid-page' }]);
    expect(applyClassName('break-before-page', ctx)).toEqual([{ type: 'decl', prop: 'break-before', value: 'page' }]);
    expect(applyClassName('break-before-left', ctx)).toEqual([{ type: 'decl', prop: 'break-before', value: 'left' }]);
    expect(applyClassName('break-before-right', ctx)).toEqual([{ type: 'decl', prop: 'break-before', value: 'right' }]);
    expect(applyClassName('break-before-column', ctx)).toEqual([{ type: 'decl', prop: 'break-before', value: 'column' }]);
  });

  // Z-Index
  it('z-index: theme, arbitrary, negative, fraction', () => {
    expect(applyClassName('z-10', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '10' }]);
    expect(applyClassName('z-[999]', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '999' }]);
    expect(applyClassName('-z-20', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '-20' }]);
    expect(applyClassName('z-1/2', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '50%' }]);
  });

  // Order
  it('order: theme, arbitrary, negative, first/last', () => {
    expect(applyClassName('order-1', ctx)).toEqual([{ type: 'decl', prop: 'order', value: '1' }]);
    expect(applyClassName('order-[5]', ctx)).toEqual([{ type: 'decl', prop: 'order', value: '5' }]);
    expect(applyClassName('-order-2', ctx)).toEqual([{ type: 'decl', prop: 'order', value: '-2' }]);
    expect(applyClassName('order-first', ctx)).toEqual([{ type: 'decl', prop: 'order', value: '-9999' }]);
    expect(applyClassName('order-last', ctx)).toEqual([{ type: 'decl', prop: 'order', value: '9999' }]);
  });

  // Grid Column
  it('grid-column: theme, arbitrary, negative, auto', () => {
    expect(applyClassName('col-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: '2' }]);
    expect(applyClassName('col-[7]', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: '7' }]);
    expect(applyClassName('-col-3', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: '-3' }]);
    expect(applyClassName('col-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: 'auto' }]);
  });

  // col-span
  it('col-span: custom AST, full', () => {
    expect(applyClassName('col-span-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: 'span 2 / span 2' }]);
    expect(applyClassName('col-span-full', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: '1 / -1' }]);
  });

  // col-start/col-end
  it('col-start/col-end: theme, arbitrary, negative, auto', () => {
    expect(applyClassName('col-start-1', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-start', value: '1' }]);
    expect(applyClassName('col-start-[3]', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-start', value: '3' }]);
    expect(applyClassName('-col-start-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-start', value: '-2' }]);
    expect(applyClassName('col-start-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-start', value: 'auto' }]);
    expect(applyClassName('col-end-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-end', value: '2' }]);
    expect(applyClassName('col-end-[4]', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-end', value: '4' }]);
    expect(applyClassName('-col-end-3', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-end', value: '-3' }]);
    expect(applyClassName('col-end-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-end', value: 'auto' }]);
  });

  // Background Color
  it('background-color: theme, arbitrary, custom property, negative, fraction', () => {
    expect(applyClassName('bg-red-500', ctx)).toEqual([{ type: 'decl', prop: 'background-color', value: '#f00' }]);
    expect(applyClassName('bg-[red]', ctx)).toEqual([{ type: 'decl', prop: 'background-color', value: 'red' }]);
    expect(applyClassName('bg-(--my-bg)', ctx)).toEqual([{ type: 'decl', prop: 'background-color', value: 'var(--my-bg)' }]);
    expect(applyClassName('-bg-blue-500', ctx)).toEqual([{ type: 'decl', prop: 'background-color', value: '-#00f' }]);
    expect(applyClassName('bg-1/4', ctx)).toEqual([{ type: 'decl', prop: 'background-color', value: '25%' }]);
  });

  // Edge: invalid/unsupported values
  it('should return [] for invalid/unsupported values', () => {
    expect(applyClassName('z-foo', ctx)).toEqual([]);
    expect(applyClassName('order-bar', ctx)).toEqual([]);
    expect(applyClassName('col-span-xyz', ctx)).toEqual([]);
    expect(applyClassName('col-start-abc', ctx)).toEqual([]);
    expect(applyClassName('bg-unknown', ctx)).toEqual([{ type: 'decl', prop: 'background-color', value: 'unknown' }]); // fallback to raw value
  });
}); 