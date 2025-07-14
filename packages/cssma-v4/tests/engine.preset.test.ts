import { describe, it, expect } from 'vitest';
import '../src/index'; // Ensure all utilities are registered
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

  // Break Inside
  it('break-inside: all static utilities', () => {
    expect(applyClassName('break-inside-auto', ctx)).toEqual([{ type: 'decl', prop: 'break-inside', value: 'auto' }]);
    expect(applyClassName('break-inside-avoid', ctx)).toEqual([{ type: 'decl', prop: 'break-inside', value: 'avoid' }]);
    expect(applyClassName('break-inside-avoid-page', ctx)).toEqual([{ type: 'decl', prop: 'break-inside', value: 'avoid-page' }]);
    expect(applyClassName('break-inside-avoid-column', ctx)).toEqual([{ type: 'decl', prop: 'break-inside', value: 'avoid-column' }]);
  });

  // Box Decoration Break
  it('box-decoration-break: static utilities', () => {
    expect(applyClassName('box-decoration-slice', ctx)).toEqual([{ type: 'decl', prop: 'box-decoration-break', value: 'slice' }]);
    expect(applyClassName('box-decoration-clone', ctx)).toEqual([{ type: 'decl', prop: 'box-decoration-break', value: 'clone' }]);
  });

  // Box Sizing
  it('box-sizing: static utilities', () => {
    expect(applyClassName('box-border', ctx)).toEqual([{ type: 'decl', prop: 'box-sizing', value: 'border-box' }]);
    expect(applyClassName('box-content', ctx)).toEqual([{ type: 'decl', prop: 'box-sizing', value: 'content-box' }]);
  });

  // Z-Index
  it('z-index: theme, arbitrary, negative', () => {
    expect(applyClassName('z-10', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '10' }]);
    expect(applyClassName('z-[999]', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '999' }]);
    expect(applyClassName('-z-20', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '-20' }]);
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

  it('display: all  utilities', () => {
    expect(applyClassName('block', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'block' }]);
    expect(applyClassName('inline', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'inline' }]);
    expect(applyClassName('inline-block', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'inline-block' }]);
    expect(applyClassName('flow-root', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'flow-root' }]);
    expect(applyClassName('flex', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'flex' }]);
    expect(applyClassName('inline-flex', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'inline-flex' }]);
    expect(applyClassName('grid', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'grid' }]);
    expect(applyClassName('inline-grid', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'inline-grid' }]);
    expect(applyClassName('contents', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'contents' }]);
    expect(applyClassName('table', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'table' }]);
    expect(applyClassName('inline-table', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'inline-table' }]);
    expect(applyClassName('table-caption', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'table-caption' }]);
    expect(applyClassName('table-cell', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'table-cell' }]);
    expect(applyClassName('table-column', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'table-column' }]);
    expect(applyClassName('table-column-group', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'table-column-group' }]);
    expect(applyClassName('table-footer-group', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'table-footer-group' }]);
    expect(applyClassName('table-header-group', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'table-header-group' }]);
    expect(applyClassName('table-row-group', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'table-row-group' }]);
    expect(applyClassName('table-row', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'table-row' }]);
    expect(applyClassName('list-item', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'list-item' }]);
    expect(applyClassName('hidden', ctx)).toEqual([{ type: 'decl', prop: 'display', value: 'none' }]);
  });

  it('float: all  utilities', () => {
    expect(applyClassName('float-right', ctx)).toEqual([{ type: 'decl', prop: 'float', value: 'right' }]);
    expect(applyClassName('float-left', ctx)).toEqual([{ type: 'decl', prop: 'float', value: 'left' }]);
    expect(applyClassName('float-start', ctx)).toEqual([{ type: 'decl', prop: 'float', value: 'inline-start' }]);
    expect(applyClassName('float-end', ctx)).toEqual([{ type: 'decl', prop: 'float', value: 'inline-end' }]);
    expect(applyClassName('float-none', ctx)).toEqual([{ type: 'decl', prop: 'float', value: 'none' }]);
  });

  it('clear: all  utilities', () => {
    expect(applyClassName('clear-left', ctx)).toEqual([{ type: 'decl', prop: 'clear', value: 'left' }]);
    expect(applyClassName('clear-right', ctx)).toEqual([{ type: 'decl', prop: 'clear', value: 'right' }]);
    expect(applyClassName('clear-both', ctx)).toEqual([{ type: 'decl', prop: 'clear', value: 'both' }]);
    expect(applyClassName('clear-start', ctx)).toEqual([{ type: 'decl', prop: 'clear', value: 'inline-start' }]);
    expect(applyClassName('clear-end', ctx)).toEqual([{ type: 'decl', prop: 'clear', value: 'inline-end' }]);
    expect(applyClassName('clear-none', ctx)).toEqual([{ type: 'decl', prop: 'clear', value: 'none' }]);
  });

  it('isolation: all utilities', () => {
    expect(applyClassName('isolate', ctx)).toEqual([{ type: 'decl', prop: 'isolation', value: 'isolate' }]);
    expect(applyClassName('isolation-auto', ctx)).toEqual([{ type: 'decl', prop: 'isolation', value: 'auto' }]);
  });

  it('object-fit: all utilities', () => {
    expect(applyClassName('object-contain', ctx)).toEqual([{ type: 'decl', prop: 'object-fit', value: 'contain' }]);
    expect(applyClassName('object-cover', ctx)).toEqual([{ type: 'decl', prop: 'object-fit', value: 'cover' }]);
    expect(applyClassName('object-fill', ctx)).toEqual([{ type: 'decl', prop: 'object-fit', value: 'fill' }]);
    expect(applyClassName('object-none', ctx)).toEqual([{ type: 'decl', prop: 'object-fit', value: 'none' }]);
    expect(applyClassName('object-scale-down', ctx)).toEqual([{ type: 'decl', prop: 'object-fit', value: 'scale-down' }]);
  });

  it('object-position: static utilities', () => {
    expect(applyClassName('object-top-left', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'top left' }]);
    expect(applyClassName('object-top', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'top' }]);
    expect(applyClassName('object-top-right', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'top right' }]);
    expect(applyClassName('object-left', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'left' }]);
    expect(applyClassName('object-center', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'center' }]);
    expect(applyClassName('object-right', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'right' }]);
    expect(applyClassName('object-bottom-left', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'bottom left' }]);
    expect(applyClassName('object-bottom', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'bottom' }]);
    expect(applyClassName('object-bottom-right', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'bottom right' }]);
  });

  it('object-position: arbitrary, custom property', () => {
    expect(applyClassName('object-[25%_75%]', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: '25% 75%' }]);
    expect(applyClassName('object-(--my-position)', ctx)).toEqual([{ type: 'decl', prop: 'object-position', value: 'var(--my-position)' }]);
  });

  it('overflow: all utilities', () => {
    expect(applyClassName('overflow-auto', ctx)).toEqual([{ type: 'decl', prop: 'overflow', value: 'auto' }]);
    expect(applyClassName('overflow-hidden', ctx)).toEqual([{ type: 'decl', prop: 'overflow', value: 'hidden' }]);
    expect(applyClassName('overflow-clip', ctx)).toEqual([{ type: 'decl', prop: 'overflow', value: 'clip' }]);
    expect(applyClassName('overflow-visible', ctx)).toEqual([{ type: 'decl', prop: 'overflow', value: 'visible' }]);
    expect(applyClassName('overflow-scroll', ctx)).toEqual([{ type: 'decl', prop: 'overflow', value: 'scroll' }]);
    expect(applyClassName('overflow-x-auto', ctx)).toEqual([{ type: 'decl', prop: 'overflow-x', value: 'auto' }]);
    expect(applyClassName('overflow-y-auto', ctx)).toEqual([{ type: 'decl', prop: 'overflow-y', value: 'auto' }]);
    expect(applyClassName('overflow-x-hidden', ctx)).toEqual([{ type: 'decl', prop: 'overflow-x', value: 'hidden' }]);
    expect(applyClassName('overflow-y-hidden', ctx)).toEqual([{ type: 'decl', prop: 'overflow-y', value: 'hidden' }]);
    expect(applyClassName('overflow-x-clip', ctx)).toEqual([{ type: 'decl', prop: 'overflow-x', value: 'clip' }]);
    expect(applyClassName('overflow-y-clip', ctx)).toEqual([{ type: 'decl', prop: 'overflow-y', value: 'clip' }]);
    expect(applyClassName('overflow-x-visible', ctx)).toEqual([{ type: 'decl', prop: 'overflow-x', value: 'visible' }]);
    expect(applyClassName('overflow-y-visible', ctx)).toEqual([{ type: 'decl', prop: 'overflow-y', value: 'visible' }]);
    expect(applyClassName('overflow-x-scroll', ctx)).toEqual([{ type: 'decl', prop: 'overflow-x', value: 'scroll' }]);
    expect(applyClassName('overflow-y-scroll', ctx)).toEqual([{ type: 'decl', prop: 'overflow-y', value: 'scroll' }]);
  });

  it('overscroll-behavior: all utilities', () => {
    expect(applyClassName('overscroll-auto', ctx)).toEqual([{ type: 'decl', prop: 'overscroll-behavior', value: 'auto' }]);
    expect(applyClassName('overscroll-contain', ctx)).toEqual([{ type: 'decl', prop: 'overscroll-behavior', value: 'contain' }]);
    expect(applyClassName('overscroll-none', ctx)).toEqual([{ type: 'decl', prop: 'overscroll-behavior', value: 'none' }]);
    expect(applyClassName('overscroll-x-auto', ctx)).toEqual([{ type: 'decl', prop: 'overscroll-behavior-x', value: 'auto' }]);
    expect(applyClassName('overscroll-x-contain', ctx)).toEqual([{ type: 'decl', prop: 'overscroll-behavior-x', value: 'contain' }]);
    expect(applyClassName('overscroll-x-none', ctx)).toEqual([{ type: 'decl', prop: 'overscroll-behavior-x', value: 'none' }]);
    expect(applyClassName('overscroll-y-auto', ctx)).toEqual([{ type: 'decl', prop: 'overscroll-behavior-y', value: 'auto' }]);
    expect(applyClassName('overscroll-y-contain', ctx)).toEqual([{ type: 'decl', prop: 'overscroll-behavior-y', value: 'contain' }]);
    expect(applyClassName('overscroll-y-none', ctx)).toEqual([{ type: 'decl', prop: 'overscroll-behavior-y', value: 'none' }]);
  });

  it('position: all utilities', () => {
    expect(applyClassName('static', ctx)).toEqual([{ type: 'decl', prop: 'position', value: 'static' }]);
    expect(applyClassName('fixed', ctx)).toEqual([{ type: 'decl', prop: 'position', value: 'fixed' }]);
    expect(applyClassName('absolute', ctx)).toEqual([{ type: 'decl', prop: 'position', value: 'absolute' }]);
    expect(applyClassName('relative', ctx)).toEqual([{ type: 'decl', prop: 'position', value: 'relative' }]);
    expect(applyClassName('sticky', ctx)).toEqual([{ type: 'decl', prop: 'position', value: 'sticky' }]);
  });
}); 