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

  it('inset/top/right/bottom/left: all utilities', () => {
    // Inset (all)
    expect(applyClassName('inset-0', ctx)).toEqual([{ type: 'decl', prop: 'inset', value: 'calc(var(--spacing) * 0)' }]);
    expect(applyClassName('inset-auto', ctx)).toEqual([{ type: 'decl', prop: 'inset', value: 'auto' }]);
    expect(applyClassName('inset-full', ctx)).toEqual([{ type: 'decl', prop: 'inset', value: '100%' }]);
    expect(applyClassName('inset-px', ctx)).toEqual([{ type: 'decl', prop: 'inset', value: '1px' }]);
    expect(applyClassName('-inset-1', ctx)).toEqual([{ type: 'decl', prop: 'inset', value: 'calc(var(--spacing) * -1)' }]);
    expect(applyClassName('inset-[2.5rem]', ctx)).toEqual([{ type: 'decl', prop: 'inset', value: '2.5rem' }]);
    expect(applyClassName('inset-(--my-inset)', ctx)).toEqual([{ type: 'decl', prop: 'inset', value: 'var(--my-inset)' }]);
    // Inset X/Y
    expect(applyClassName('inset-x-0', ctx)).toEqual([{ type: 'decl', prop: 'inset-inline', value: 'calc(var(--spacing) * 0)' }]);
    expect(applyClassName('inset-x-auto', ctx)).toEqual([{ type: 'decl', prop: 'inset-inline', value: 'auto' }]);
    expect(applyClassName('inset-x-full', ctx)).toEqual([{ type: 'decl', prop: 'inset-inline', value: '100%' }]);
    expect(applyClassName('-inset-x-px', ctx)).toEqual([{ type: 'decl', prop: 'inset-inline', value: '-1px' }]);
    // Inset Y
    expect(applyClassName('inset-y-0', ctx)).toEqual([{ type: 'decl', prop: 'inset-block', value: 'calc(var(--spacing) * 0)' }]);
    expect(applyClassName('inset-y-auto', ctx)).toEqual([{ type: 'decl', prop: 'inset-block', value: 'auto' }]);
    expect(applyClassName('inset-y-full', ctx)).toEqual([{ type: 'decl', prop: 'inset-block', value: '100%' }]);
    expect(applyClassName('-inset-y-px', ctx)).toEqual([{ type: 'decl', prop: 'inset-block', value: '-1px' }]);
    // Top/Right/Bottom/Left
    expect(applyClassName('top-0', ctx)).toEqual([{ type: 'decl', prop: 'top', value: 'calc(var(--spacing) * 0)' }]);
    expect(applyClassName('top-auto', ctx)).toEqual([{ type: 'decl', prop: 'top', value: 'auto' }]);
    expect(applyClassName('top-full', ctx)).toEqual([{ type: 'decl', prop: 'top', value: '100%' }]);
    expect(applyClassName('top-px', ctx)).toEqual([{ type: 'decl', prop: 'top', value: '1px' }]);
    expect(applyClassName('-top-1', ctx)).toEqual([{ type: 'decl', prop: 'top', value: 'calc(var(--spacing) * -1)' }]);
    expect(applyClassName('top-[10%]', ctx)).toEqual([{ type: 'decl', prop: 'top', value: '10%' }]);
    expect(applyClassName('top-(--my-top)', ctx)).toEqual([{ type: 'decl', prop: 'top', value: 'var(--my-top)' }]);
    expect(applyClassName('right-0', ctx)).toEqual([{ type: 'decl', prop: 'right', value: 'calc(var(--spacing) * 0)' }]);
    expect(applyClassName('right-auto', ctx)).toEqual([{ type: 'decl', prop: 'right', value: 'auto' }]);
    expect(applyClassName('right-full', ctx)).toEqual([{ type: 'decl', prop: 'right', value: '100%' }]);
    expect(applyClassName('right-px', ctx)).toEqual([{ type: 'decl', prop: 'right', value: '1px' }]);
    expect(applyClassName('-right-1', ctx)).toEqual([{ type: 'decl', prop: 'right', value: 'calc(var(--spacing) * -1)' }]);
    expect(applyClassName('right-[10%]', ctx)).toEqual([{ type: 'decl', prop: 'right', value: '10%' }]);
    expect(applyClassName('right-(--my-right)', ctx)).toEqual([{ type: 'decl', prop: 'right', value: 'var(--my-right)' }]);
    expect(applyClassName('bottom-0', ctx)).toEqual([{ type: 'decl', prop: 'bottom', value: 'calc(var(--spacing) * 0)' }]);
    expect(applyClassName('bottom-auto', ctx)).toEqual([{ type: 'decl', prop: 'bottom', value: 'auto' }]);
    expect(applyClassName('bottom-full', ctx)).toEqual([{ type: 'decl', prop: 'bottom', value: '100%' }]);
    expect(applyClassName('bottom-px', ctx)).toEqual([{ type: 'decl', prop: 'bottom', value: '1px' }]);
    expect(applyClassName('-bottom-1', ctx)).toEqual([{ type: 'decl', prop: 'bottom', value: 'calc(var(--spacing) * -1)' }]);
    expect(applyClassName('bottom-[10%]', ctx)).toEqual([{ type: 'decl', prop: 'bottom', value: '10%' }]);
    expect(applyClassName('bottom-(--my-bottom)', ctx)).toEqual([{ type: 'decl', prop: 'bottom', value: 'var(--my-bottom)' }]);
    expect(applyClassName('left-0', ctx)).toEqual([{ type: 'decl', prop: 'left', value: 'calc(var(--spacing) * 0)' }]);
    expect(applyClassName('left-auto', ctx)).toEqual([{ type: 'decl', prop: 'left', value: 'auto' }]);
    expect(applyClassName('left-full', ctx)).toEqual([{ type: 'decl', prop: 'left', value: '100%' }]);
    expect(applyClassName('left-px', ctx)).toEqual([{ type: 'decl', prop: 'left', value: '1px' }]);
    expect(applyClassName('-left-1', ctx)).toEqual([{ type: 'decl', prop: 'left', value: 'calc(var(--spacing) * -1)' }]);
    expect(applyClassName('left-[10%]', ctx)).toEqual([{ type: 'decl', prop: 'left', value: '10%' }]);
    expect(applyClassName('left-(--my-left)', ctx)).toEqual([{ type: 'decl', prop: 'left', value: 'var(--my-left)' }]);
  });

  it('visibility: all utilities', () => {
    expect(applyClassName('visible', ctx)).toEqual([{ type: 'decl', prop: 'visibility', value: 'visible' }]);
    expect(applyClassName('invisible', ctx)).toEqual([{ type: 'decl', prop: 'visibility', value: 'hidden' }]);
    expect(applyClassName('collapse', ctx)).toEqual([{ type: 'decl', prop: 'visibility', value: 'collapse' }]);
  });

  it('z-index: all utilities', () => {
    expect(applyClassName('z-auto', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: 'auto' }]);
    expect(applyClassName('z-0', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '0' }]);
    expect(applyClassName('z-1', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '1' }]);
    expect(applyClassName('z-2', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '2' }]);
    expect(applyClassName('z-3', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '3' }]);
    expect(applyClassName('z-4', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '4' }]);
    expect(applyClassName('z-5', ctx)).toEqual([{ type: 'decl', prop: 'z-index', value: '5' }]);
  });

  it('flex-basis: all utilities', () => {
    expect(applyClassName('basis-full', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: '100%' }]);
    expect(applyClassName('basis-auto', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'auto' }]);
    expect(applyClassName('basis-3xs', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-3xs)' }]);
    expect(applyClassName('basis-2xs', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-2xs)' }]);
    expect(applyClassName('basis-xs', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-xs)' }]);
    expect(applyClassName('basis-sm', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-sm)' }]);
    expect(applyClassName('basis-md', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-md)' }]);
    expect(applyClassName('basis-lg', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-lg)' }]);
    expect(applyClassName('basis-xl', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-xl)' }]);
    expect(applyClassName('basis-2xl', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-2xl)' }]);
    expect(applyClassName('basis-3xl', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-3xl)' }]);
    expect(applyClassName('basis-4xl', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-4xl)' }]);
    expect(applyClassName('basis-5xl', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-5xl)' }]);
    expect(applyClassName('basis-6xl', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-6xl)' }]);
    expect(applyClassName('basis-7xl', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'var(--container-7xl)' }]);
    expect(applyClassName('basis-1/2', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: '50%' }]);
    expect(applyClassName('basis-1/3', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: '33.33333333333333%' }]);
    expect(applyClassName('basis-10', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'calc(var(--container-10) * 1px)' }]);
    expect(applyClassName('basis-20', ctx)).toEqual([{ type: 'decl', prop: 'flex-basis', value: 'calc(var(--container-20) * 1px)' }]);
  });

  it('flex-direction: all utilities', () => {
    expect(applyClassName('flex-row', ctx)).toEqual([{ type: 'decl', prop: 'flex-direction', value: 'row' }]);
    expect(applyClassName('flex-row-reverse', ctx)).toEqual([{ type: 'decl', prop: 'flex-direction', value: 'row-reverse' }]);
    expect(applyClassName('flex-col', ctx)).toEqual([{ type: 'decl', prop: 'flex-direction', value: 'column' }]);
    expect(applyClassName('flex-col-reverse', ctx)).toEqual([{ type: 'decl', prop: 'flex-direction', value: 'column-reverse' }]);
  });

  it('flex-wrap: all utilities', () => {
    expect(applyClassName('flex-wrap', ctx)).toEqual([{ type: 'decl', prop: 'flex-wrap', value: 'wrap' }]);
    expect(applyClassName('flex-wrap-reverse', ctx)).toEqual([{ type: 'decl', prop: 'flex-wrap', value: 'wrap-reverse' }]);
    expect(applyClassName('flex-nowrap', ctx)).toEqual([{ type: 'decl', prop: 'flex-wrap', value: 'nowrap' }]);
  });

  it('flex: static, number, fraction, arbitrary, custom property', () => {
    // static
    expect(applyClassName('flex-auto', ctx)).toEqual([{ type: 'decl', prop: 'flex', value: '1 1 auto' }]);
    expect(applyClassName('flex-initial', ctx)).toEqual([{ type: 'decl', prop: 'flex', value: '0 1 auto' }]);
    expect(applyClassName('flex-none', ctx)).toEqual([{ type: 'decl', prop: 'flex', value: 'none' }]);
    // number
    expect(applyClassName('flex-1', ctx)).toEqual([{ type: 'decl', prop: 'flex', value: '1' }]);
    expect(applyClassName('flex-2', ctx)).toEqual([{ type: 'decl', prop: 'flex', value: '2' }]);
    // fraction
    expect(applyClassName('flex-1/2', ctx)).toEqual([{ type: 'decl', prop: 'flex', value: 'calc(50%)' }]);
    // arbitrary
    expect(applyClassName('flex-[2_1_0%]', ctx)).toEqual([{ type: 'decl', prop: 'flex', value: '2 1 0%' }]);
    // custom property
    expect(applyClassName('flex-(--my-flex)', ctx)).toEqual([{ type: 'decl', prop: 'flex', value: 'var(--my-flex)' }]);
  });

  it('flex-grow: static, number, arbitrary, custom property', () => {
    // static
    expect(applyClassName('grow', ctx)).toEqual([{ type: 'decl', prop: 'flex-grow', value: '1' }]);
    expect(applyClassName('grow-0', ctx)).toEqual([{ type: 'decl', prop: 'flex-grow', value: '0' }]);
    // number
    expect(applyClassName('grow-2', ctx)).toEqual([{ type: 'decl', prop: 'flex-grow', value: '2' }]);
    // arbitrary
    expect(applyClassName('grow-[2]', ctx)).toEqual([{ type: 'decl', prop: 'flex-grow', value: '2' }]);
    // custom property
    expect(applyClassName('grow-(--my-grow)', ctx)).toEqual([{ type: 'decl', prop: 'flex-grow', value: 'var(--my-grow)' }]);
  });

  it('flex-shrink: static, number, arbitrary, custom property', () => {
    // static
    expect(applyClassName('shrink', ctx)).toEqual([{ type: 'decl', prop: 'flex-shrink', value: '1' }]);
    expect(applyClassName('shrink-0', ctx)).toEqual([{ type: 'decl', prop: 'flex-shrink', value: '0' }]);
    // number
    expect(applyClassName('shrink-2', ctx)).toEqual([{ type: 'decl', prop: 'flex-shrink', value: '2' }]);
    // arbitrary
    expect(applyClassName('shrink-[2]', ctx)).toEqual([{ type: 'decl', prop: 'flex-shrink', value: '2' }]);
    // custom property
    expect(applyClassName('shrink-(--my-shrink)', ctx)).toEqual([{ type: 'decl', prop: 'flex-shrink', value: 'var(--my-shrink)' }]);
  });

  it('order: static, number, negative, arbitrary, custom property', () => {
    // static
    expect(applyClassName('order-first', ctx)).toEqual([{ type: 'decl', prop: 'order', value: 'calc(-infinity)' }]);
    expect(applyClassName('order-last', ctx)).toEqual([{ type: 'decl', prop: 'order', value: 'calc(infinity)' }]);
    expect(applyClassName('order-none', ctx)).toEqual([{ type: 'decl', prop: 'order', value: '0' }]);
    // number
    expect(applyClassName('order-1', ctx)).toEqual([{ type: 'decl', prop: 'order', value: '1' }]);
    expect(applyClassName('order-2', ctx)).toEqual([{ type: 'decl', prop: 'order', value: '2' }]);
    // negative
    expect(applyClassName('-order-1', ctx)).toEqual([{ type: 'decl', prop: 'order', value: 'calc(1 * -1)' }]);
    // arbitrary
    expect(applyClassName('order-[min(var(--total-items),10)]', ctx)).toEqual([{ type: 'decl', prop: 'order', value: 'min(var(--total-items),10)' }]);
    // custom property
    expect(applyClassName('order-(--my-order)', ctx)).toEqual([{ type: 'decl', prop: 'order', value: 'var(--my-order)' }]);
  });

  it('grid-template-columns: static, number, arbitrary, custom property', () => {
    // static
    expect(applyClassName('grid-cols-none', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-columns', value: 'none' }]);
    expect(applyClassName('grid-cols-subgrid', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-columns', value: 'subgrid' }]);
    // number
    expect(applyClassName('grid-cols-1', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-columns', value: 'repeat(1, minmax(0, 1fr))' }]);
    expect(applyClassName('grid-cols-3', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-columns', value: 'repeat(3, minmax(0, 1fr))' }]);
    // arbitrary
    expect(applyClassName('grid-cols-[200px_minmax(900px,_1fr)_100px]', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-columns', value: '200px minmax(900px, 1fr) 100px' }]);
    // custom property
    expect(applyClassName('grid-cols-(--my-grid-cols)', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-columns', value: 'var(--my-grid-cols)' }]);
  });

  it('grid-template-rows: static, number, arbitrary, custom property', () => {
    // static
    expect(applyClassName('grid-rows-none', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-rows', value: 'none' }]);
    expect(applyClassName('grid-rows-subgrid', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-rows', value: 'subgrid' }]);
    // number
    expect(applyClassName('grid-rows-1', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-rows', value: 'repeat(1, minmax(0, 1fr))' }]);
    expect(applyClassName('grid-rows-3', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-rows', value: 'repeat(3, minmax(0, 1fr))' }]);
    // arbitrary
    expect(applyClassName('grid-rows-[200px_minmax(900px,_1fr)_100px]', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-rows', value: '200px minmax(900px, 1fr) 100px' }]);
    // custom property
    expect(applyClassName('grid-rows-(--my-grid-rows)', ctx)).toEqual([{ type: 'decl', prop: 'grid-template-rows', value: 'var(--my-grid-rows)' }]);
  });

  it('grid-row: row-span, row-start, row-end, row utilities', () => {
    // row-span
    expect(applyClassName('row-span-full', ctx)).toEqual([{ type: 'decl', prop: 'grid-row', value: '1 / -1' }]);
    expect(applyClassName('row-span-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-row', value: 'span 2 / span 2' }]);
    expect(applyClassName('row-span-[5]', ctx)).toEqual([{ type: 'decl', prop: 'grid-row', value: 'span 5 / span 5' }]);
    expect(applyClassName('row-span-(--my-span)', ctx)).toEqual([{ type: 'decl', prop: 'grid-row', value: 'span var(--my-span) / span var(--my-span)' }]);
    // row-start
    expect(applyClassName('row-start-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-start', value: 'auto' }]);
    expect(applyClassName('row-start-3', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-start', value: '3' }]);
    expect(applyClassName('-row-start-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-start', value: 'calc(2 * -1)' }]);
    expect(applyClassName('row-start-(--my-start)', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-start', value: 'var(--my-start)' }]);
    expect(applyClassName('row-start-[7]', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-start', value: '7' }]);
    // row-end
    expect(applyClassName('row-end-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-end', value: 'auto' }]);
    expect(applyClassName('row-end-4', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-end', value: '4' }]);
    expect(applyClassName('-row-end-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-end', value: 'calc(2 * -1)' }]);
    expect(applyClassName('row-end-(--my-end)', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-end', value: 'var(--my-end)' }]);
    expect(applyClassName('row-end-[8]', ctx)).toEqual([{ type: 'decl', prop: 'grid-row-end', value: '8' }]);
    // row
    expect(applyClassName('row-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-row', value: 'auto' }]);
    expect(applyClassName('row-3', ctx)).toEqual([{ type: 'decl', prop: 'grid-row', value: '3' }]);
    expect(applyClassName('-row-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-row', value: 'calc(2 * -1)' }]);
    expect(applyClassName('row-(--my-row)', ctx)).toEqual([{ type: 'decl', prop: 'grid-row', value: 'var(--my-row)' }]);
    expect(applyClassName('row-[5]', ctx)).toEqual([{ type: 'decl', prop: 'grid-row', value: '5' }]);
  });

  it('grid-auto-flow: static utilities', () => {
    expect(applyClassName('grid-flow-row', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-flow', value: 'row' }]);
    expect(applyClassName('grid-flow-col', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-flow', value: 'column' }]);
    expect(applyClassName('grid-flow-dense', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-flow', value: 'dense' }]);
    expect(applyClassName('grid-flow-row-dense', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-flow', value: 'row dense' }]);
    expect(applyClassName('grid-flow-col-dense', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-flow', value: 'column dense' }]);
  });

  it('grid-auto-columns: static, arbitrary, custom property', () => {
    // static
    expect(applyClassName('auto-cols-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-columns', value: 'auto' }]);
    expect(applyClassName('auto-cols-min', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-columns', value: 'min-content' }]);
    expect(applyClassName('auto-cols-max', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-columns', value: 'max-content' }]);
    expect(applyClassName('auto-cols-fr', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-columns', value: 'minmax(0, 1fr)' }]);
    // arbitrary
    expect(applyClassName('auto-cols-[minmax(0,2fr)]', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-columns', value: 'minmax(0,2fr)' }]);
    // custom property
    expect(applyClassName('auto-cols-(--my-auto-cols)', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-columns', value: 'var(--my-auto-cols)' }]);
  });

  it('grid-auto-rows: static, arbitrary, custom property', () => {
    // static
    expect(applyClassName('auto-rows-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-rows', value: 'auto' }]);
    expect(applyClassName('auto-rows-min', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-rows', value: 'min-content' }]);
    expect(applyClassName('auto-rows-max', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-rows', value: 'max-content' }]);
    expect(applyClassName('auto-rows-fr', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-rows', value: 'minmax(0, 1fr)' }]);
    // arbitrary
    expect(applyClassName('auto-rows-[minmax(0,2fr)]', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-rows', value: 'minmax(0,2fr)' }]);
    // custom property
    expect(applyClassName('auto-rows-(--my-auto-rows)', ctx)).toEqual([{ type: 'decl', prop: 'grid-auto-rows', value: 'var(--my-auto-rows)' }]);
  });

  it('gap: number, arbitrary, custom property', () => {
    // number
    expect(applyClassName('gap-2', ctx)).toEqual([{ type: 'decl', prop: 'gap', value: 'calc(var(--spacing) * 2)' }]);
    // arbitrary
    expect(applyClassName('gap-[10vw]', ctx)).toEqual([{ type: 'decl', prop: 'gap', value: '10vw' }]);
    // custom property
    expect(applyClassName('gap-(--my-gap)', ctx)).toEqual([{ type: 'decl', prop: 'gap', value: 'var(--my-gap)' }]);
  });
  it('gap-x: number, arbitrary, custom property', () => {
    // number
    expect(applyClassName('gap-x-3', ctx)).toEqual([{ type: 'decl', prop: 'column-gap', value: 'calc(var(--spacing) * 3)' }]);
    // arbitrary
    expect(applyClassName('gap-x-[5vw]', ctx)).toEqual([{ type: 'decl', prop: 'column-gap', value: '5vw' }]);
    // custom property
    expect(applyClassName('gap-x-(--my-gap-x)', ctx)).toEqual([{ type: 'decl', prop: 'column-gap', value: 'var(--my-gap-x)' }]);
  });
  it('gap-y: number, arbitrary, custom property', () => {
    // number
    expect(applyClassName('gap-y-4', ctx)).toEqual([{ type: 'decl', prop: 'row-gap', value: 'calc(var(--spacing) * 4)' }]);
    // arbitrary
    expect(applyClassName('gap-y-[2vw]', ctx)).toEqual([{ type: 'decl', prop: 'row-gap', value: '2vw' }]);
    // custom property
    expect(applyClassName('gap-y-(--my-gap-y)', ctx)).toEqual([{ type: 'decl', prop: 'row-gap', value: 'var(--my-gap-y)' }]);
  });

  it('justify-content: static utilities', () => {
    expect(applyClassName('justify-start', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'flex-start' }]);
    expect(applyClassName('justify-end', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'flex-end' }]);
    expect(applyClassName('justify-end-safe', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'safe flex-end' }]);
    expect(applyClassName('justify-center', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'center' }]);
    expect(applyClassName('justify-center-safe', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'safe center' }]);
    expect(applyClassName('justify-between', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'space-between' }]);
    expect(applyClassName('justify-around', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'space-around' }]);
    expect(applyClassName('justify-evenly', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'space-evenly' }]);
    expect(applyClassName('justify-stretch', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'stretch' }]);
    expect(applyClassName('justify-baseline', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'baseline' }]);
    expect(applyClassName('justify-normal', ctx)).toEqual([{ type: 'decl', prop: 'justify-content', value: 'normal' }]);
  });

  it('justify-items: static utilities', () => {
    expect(applyClassName('justify-items-start', ctx)).toEqual([{ type: 'decl', prop: 'justify-items', value: 'start' }]);
    expect(applyClassName('justify-items-end', ctx)).toEqual([{ type: 'decl', prop: 'justify-items', value: 'end' }]);
    expect(applyClassName('justify-items-end-safe', ctx)).toEqual([{ type: 'decl', prop: 'justify-items', value: 'safe end' }]);
    expect(applyClassName('justify-items-center', ctx)).toEqual([{ type: 'decl', prop: 'justify-items', value: 'center' }]);
    expect(applyClassName('justify-items-center-safe', ctx)).toEqual([{ type: 'decl', prop: 'justify-items', value: 'safe center' }]);
    expect(applyClassName('justify-items-stretch', ctx)).toEqual([{ type: 'decl', prop: 'justify-items', value: 'stretch' }]);
    expect(applyClassName('justify-items-normal', ctx)).toEqual([{ type: 'decl', prop: 'justify-items', value: 'normal' }]);
  });

  it('justify-self: static utilities', () => {
    expect(applyClassName('justify-self-auto', ctx)).toEqual([{ type: 'decl', prop: 'justify-self', value: 'auto' }]);
    expect(applyClassName('justify-self-start', ctx)).toEqual([{ type: 'decl', prop: 'justify-self', value: 'start' }]);
    expect(applyClassName('justify-self-center', ctx)).toEqual([{ type: 'decl', prop: 'justify-self', value: 'center' }]);
    expect(applyClassName('justify-self-center-safe', ctx)).toEqual([{ type: 'decl', prop: 'justify-self', value: 'safe center' }]);
    expect(applyClassName('justify-self-end', ctx)).toEqual([{ type: 'decl', prop: 'justify-self', value: 'end' }]);
    expect(applyClassName('justify-self-end-safe', ctx)).toEqual([{ type: 'decl', prop: 'justify-self', value: 'safe end' }]);
    expect(applyClassName('justify-self-stretch', ctx)).toEqual([{ type: 'decl', prop: 'justify-self', value: 'stretch' }]);
  });

  it('align-content: static utilities', () => {
    expect(applyClassName('content-normal', ctx)).toEqual([{ type: 'decl', prop: 'align-content', value: 'normal' }]);
    expect(applyClassName('content-center', ctx)).toEqual([{ type: 'decl', prop: 'align-content', value: 'center' }]);
    expect(applyClassName('content-start', ctx)).toEqual([{ type: 'decl', prop: 'align-content', value: 'flex-start' }]);
    expect(applyClassName('content-end', ctx)).toEqual([{ type: 'decl', prop: 'align-content', value: 'flex-end' }]);
    expect(applyClassName('content-between', ctx)).toEqual([{ type: 'decl', prop: 'align-content', value: 'space-between' }]);
    expect(applyClassName('content-around', ctx)).toEqual([{ type: 'decl', prop: 'align-content', value: 'space-around' }]);
    expect(applyClassName('content-evenly', ctx)).toEqual([{ type: 'decl', prop: 'align-content', value: 'space-evenly' }]);
    expect(applyClassName('content-baseline', ctx)).toEqual([{ type: 'decl', prop: 'align-content', value: 'baseline' }]);
    expect(applyClassName('content-stretch', ctx)).toEqual([{ type: 'decl', prop: 'align-content', value: 'stretch' }]);
  });

  it('align-items: static utilities', () => {
    expect(applyClassName('items-start', ctx)).toEqual([{ type: 'decl', prop: 'align-items', value: 'flex-start' }]);
    expect(applyClassName('items-end', ctx)).toEqual([{ type: 'decl', prop: 'align-items', value: 'flex-end' }]);
    expect(applyClassName('items-end-safe', ctx)).toEqual([{ type: 'decl', prop: 'align-items', value: 'safe flex-end' }]);
    expect(applyClassName('items-center', ctx)).toEqual([{ type: 'decl', prop: 'align-items', value: 'center' }]);
    expect(applyClassName('items-center-safe', ctx)).toEqual([{ type: 'decl', prop: 'align-items', value: 'safe center' }]);
    expect(applyClassName('items-baseline', ctx)).toEqual([{ type: 'decl', prop: 'align-items', value: 'baseline' }]);
    expect(applyClassName('items-baseline-last', ctx)).toEqual([{ type: 'decl', prop: 'align-items', value: 'last baseline' }]);
    expect(applyClassName('items-stretch', ctx)).toEqual([{ type: 'decl', prop: 'align-items', value: 'stretch' }]);
  });

  it('align-self: static utilities', () => {
    expect(applyClassName('self-auto', ctx)).toEqual([{ type: 'decl', prop: 'align-self', value: 'auto' }]);
    expect(applyClassName('self-start', ctx)).toEqual([{ type: 'decl', prop: 'align-self', value: 'flex-start' }]);
    expect(applyClassName('self-end', ctx)).toEqual([{ type: 'decl', prop: 'align-self', value: 'flex-end' }]);
    expect(applyClassName('self-end-safe', ctx)).toEqual([{ type: 'decl', prop: 'align-self', value: 'safe flex-end' }]);
    expect(applyClassName('self-center', ctx)).toEqual([{ type: 'decl', prop: 'align-self', value: 'center' }]);
    expect(applyClassName('self-center-safe', ctx)).toEqual([{ type: 'decl', prop: 'align-self', value: 'safe center' }]);
    expect(applyClassName('self-stretch', ctx)).toEqual([{ type: 'decl', prop: 'align-self', value: 'stretch' }]);
    expect(applyClassName('self-baseline', ctx)).toEqual([{ type: 'decl', prop: 'align-self', value: 'baseline' }]);
    expect(applyClassName('self-baseline-last', ctx)).toEqual([{ type: 'decl', prop: 'align-self', value: 'last baseline' }]);
  });

  it('place-content: static utilities', () => {
    expect(applyClassName('place-content-center', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'center' }]);
    expect(applyClassName('place-content-center-safe', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'safe center' }]);
    expect(applyClassName('place-content-start', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'start' }]);
    expect(applyClassName('place-content-end', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'end' }]);
    expect(applyClassName('place-content-end-safe', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'safe end' }]);
    expect(applyClassName('place-content-between', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'space-between' }]);
    expect(applyClassName('place-content-around', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'space-around' }]);
    expect(applyClassName('place-content-evenly', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'space-evenly' }]);
    expect(applyClassName('place-content-baseline', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'baseline' }]);
    expect(applyClassName('place-content-stretch', ctx)).toEqual([{ type: 'decl', prop: 'place-content', value: 'stretch' }]);
  });

  it('place-items: static utilities', () => {
    expect(applyClassName('place-items-start', ctx)).toEqual([{ type: 'decl', prop: 'place-items', value: 'start' }]);
    expect(applyClassName('place-items-end', ctx)).toEqual([{ type: 'decl', prop: 'place-items', value: 'end' }]);
    expect(applyClassName('place-items-end-safe', ctx)).toEqual([{ type: 'decl', prop: 'place-items', value: 'safe end' }]);
    expect(applyClassName('place-items-center', ctx)).toEqual([{ type: 'decl', prop: 'place-items', value: 'center' }]);
    expect(applyClassName('place-items-center-safe', ctx)).toEqual([{ type: 'decl', prop: 'place-items', value: 'safe center' }]);
    expect(applyClassName('place-items-baseline', ctx)).toEqual([{ type: 'decl', prop: 'place-items', value: 'baseline' }]);
    expect(applyClassName('place-items-stretch', ctx)).toEqual([{ type: 'decl', prop: 'place-items', value: 'stretch' }]);
  });

  it('place-self: static utilities', () => {
    expect(applyClassName('place-self-auto', ctx)).toEqual([{ type: 'decl', prop: 'place-self', value: 'auto' }]);
    expect(applyClassName('place-self-start', ctx)).toEqual([{ type: 'decl', prop: 'place-self', value: 'start' }]);
    expect(applyClassName('place-self-end', ctx)).toEqual([{ type: 'decl', prop: 'place-self', value: 'end' }]);
    expect(applyClassName('place-self-end-safe', ctx)).toEqual([{ type: 'decl', prop: 'place-self', value: 'safe end' }]);
    expect(applyClassName('place-self-center', ctx)).toEqual([{ type: 'decl', prop: 'place-self', value: 'center' }]);
    expect(applyClassName('place-self-center-safe', ctx)).toEqual([{ type: 'decl', prop: 'place-self', value: 'safe center' }]);
    expect(applyClassName('place-self-stretch', ctx)).toEqual([{ type: 'decl', prop: 'place-self', value: 'stretch' }]);
  });

  it('grid-column: col-span, col-start, col-end, col utilities', () => {
    // col-span
    expect(applyClassName('col-span-full', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: '1 / -1' }]);
    expect(applyClassName('col-span-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: 'span 2 / span 2' }]);
    expect(applyClassName('col-span-[5]', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: 'span 5 / span 5' }]);
    expect(applyClassName('col-span-(--my-span)', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: 'span var(--my-span) / span var(--my-span)' }]);
    // col-start
    expect(applyClassName('col-start-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-start', value: 'auto' }]);
    expect(applyClassName('col-start-3', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-start', value: '3' }]);
    expect(applyClassName('-col-start-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-start', value: 'calc(2 * -1)' }]);
    expect(applyClassName('col-start-(--my-start)', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-start', value: 'var(--my-start)' }]);
    // col-end
    expect(applyClassName('col-end-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-end', value: 'auto' }]);
    expect(applyClassName('col-end-4', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-end', value: '4' }]);
    expect(applyClassName('-col-end-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-end', value: 'calc(2 * -1)' }]);
    expect(applyClassName('col-end-(--my-end)', ctx)).toEqual([{ type: 'decl', prop: 'grid-column-end', value: 'var(--my-end)' }]);
    // col
    expect(applyClassName('col-auto', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: 'auto' }]);
    expect(applyClassName('col-3', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: '3' }]);
    expect(applyClassName('-col-2', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: 'calc(2 * -1)' }]);
    expect(applyClassName('col-(--my-col)', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: 'var(--my-col)' }]);
    expect(applyClassName('col-[3]', ctx)).toEqual([{ type: 'decl', prop: 'grid-column', value: '3' }]);
  });

  
}); 