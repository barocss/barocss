import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (layout)', () => {
  describe('container', () => {
    it('should parse Tailwind v4 container class', () => {
      expect(parseUtility('container')).toEqual(baseUtility({ prefix: 'container', value: '', raw: 'container' }));
    });
  });

  describe('box', () => {
    it('should parse Tailwind v4 box classes', () => {
      expect(parseUtility('box-border')).toEqual(baseUtility({ prefix: 'box', value: 'border', raw: 'box-border' }));
      expect(parseUtility('box-content')).toEqual(baseUtility({ prefix: 'box', value: 'content', raw: 'box-content' }));
      expect(parseUtility('box-border!')).toEqual(baseUtility({ prefix: 'box', value: 'border', raw: 'box-border!', important: true }));
      expect(parseUtility('box-content!')).toEqual(baseUtility({ prefix: 'box', value: 'content', raw: 'box-content!', important: true }));
    });
  });

  describe('display', () => {
    it('should parse Tailwind v4 display classes', () => {
      expect(parseUtility('block')).toEqual(baseUtility({ prefix: 'block', value: '', raw: 'block' }));
      expect(parseUtility('inline-block')).toEqual(baseUtility({ prefix: 'inline', value: 'block', raw: 'inline-block' }));
      expect(parseUtility('inline')).toEqual(baseUtility({ prefix: 'inline', value: '', raw: 'inline' }));
      expect(parseUtility('flex')).toEqual(baseUtility({ prefix: 'flex', value: '', raw: 'flex' }));
      expect(parseUtility('inline-flex')).toEqual(baseUtility({ prefix: 'inline', value: 'flex', raw: 'inline-flex' }));
      expect(parseUtility('table')).toEqual(baseUtility({ prefix: 'table', value: '', raw: 'table' }));
      expect(parseUtility('inline-table')).toEqual(baseUtility({ prefix: 'inline', value: 'table', raw: 'inline-table' }));
      expect(parseUtility('table-caption')).toEqual(baseUtility({ prefix: 'table-caption', value: '', raw: 'table-caption' }));
      expect(parseUtility('table-cell')).toEqual(baseUtility({ prefix: 'table-cell', value: '', raw: 'table-cell' }));
      expect(parseUtility('table-column')).toEqual(baseUtility({ prefix: 'table-column', value: '', raw: 'table-column' }));
      expect(parseUtility('table-column-group')).toEqual(baseUtility({ prefix: 'table-column-group', value: '', raw: 'table-column-group' }));
      expect(parseUtility('table-footer-group')).toEqual(baseUtility({ prefix: 'table-footer-group', value: '', raw: 'table-footer-group' }));
      expect(parseUtility('table-header-group')).toEqual(baseUtility({ prefix: 'table-header-group', value: '', raw: 'table-header-group' }));
      expect(parseUtility('table-row-group')).toEqual(baseUtility({ prefix: 'table-row-group', value: '', raw: 'table-row-group' }));
      expect(parseUtility('table-row')).toEqual(baseUtility({ prefix: 'table-row', value: '', raw: 'table-row' }));
      expect(parseUtility('flow-root')).toEqual(baseUtility({ prefix: 'flow-root', value: '', raw: 'flow-root' }));
      expect(parseUtility('grid')).toEqual(baseUtility({ prefix: 'grid', value: '', raw: 'grid' }));
      expect(parseUtility('inline-grid')).toEqual(baseUtility({ prefix: 'inline', value: 'grid', raw: 'inline-grid' }));
      expect(parseUtility('contents')).toEqual(baseUtility({ prefix: 'contents', value: '', raw: 'contents' }));
      expect(parseUtility('hidden')).toEqual(baseUtility({ prefix: 'hidden', value: '', raw: 'hidden' }));
    });
  });

  describe('float', () => {
    it('should parse Tailwind v4 float classes', () => {
      expect(parseUtility('float-right')).toEqual(baseUtility({ prefix: 'float', value: 'right', raw: 'float-right' }));
      expect(parseUtility('float-left')).toEqual(baseUtility({ prefix: 'float', value: 'left', raw: 'float-left' }));
      expect(parseUtility('float-none')).toEqual(baseUtility({ prefix: 'float', value: 'none', raw: 'float-none' }));
      expect(parseUtility('float-')).toEqual({ type: 'unknown', raw: 'float-' });
    });
  });

  describe('clear', () => {
    it('should parse Tailwind v4 clear classes', () => {
      expect(parseUtility('clear-left')).toEqual(baseUtility({ prefix: 'clear', value: 'left', raw: 'clear-left' }));
      expect(parseUtility('clear-right')).toEqual(baseUtility({ prefix: 'clear', value: 'right', raw: 'clear-right' }));
      expect(parseUtility('clear-both')).toEqual(baseUtility({ prefix: 'clear', value: 'both', raw: 'clear-both' }));
      expect(parseUtility('clear-none')).toEqual(baseUtility({ prefix: 'clear', value: 'none', raw: 'clear-none' }));
      expect(parseUtility('clear-')).toEqual({ type: 'unknown', raw: 'clear-' });
    });
  });

  describe('isolation', () => {
    it('should parse Tailwind v4 isolation classes', () => {
      expect(parseUtility('isolate')).toEqual(baseUtility({ prefix: 'isolate', raw: 'isolate' }));
      expect(parseUtility('isolation-auto')).toEqual(baseUtility({ prefix: 'isolation', value: 'auto', raw: 'isolation-auto' }));
      expect(parseUtility('isolate!')).toEqual(baseUtility({ prefix: 'isolate', raw: 'isolate!', important: true }));
      expect(parseUtility('isolate-')).toEqual({ type: 'unknown', raw: 'isolate-' });
    });
  });

  describe('object', () => {
    it('should parse Tailwind v4 object classes', () => {
      expect(parseUtility('object-contain')).toEqual(baseUtility({ prefix: 'object', value: 'contain', raw: 'object-contain' }));
      expect(parseUtility('object-cover')).toEqual(baseUtility({ prefix: 'object', value: 'cover', raw: 'object-cover' }));
      expect(parseUtility('object-fill')).toEqual(baseUtility({ prefix: 'object', value: 'fill', raw: 'object-fill' }));
      expect(parseUtility('object-none')).toEqual(baseUtility({ prefix: 'object', value: 'none', raw: 'object-none' }));
      expect(parseUtility('object-scale-down')).toEqual(baseUtility({ prefix: 'object', value: 'scale-down', raw: 'object-scale-down' }));
      expect(parseUtility('object-bottom')).toEqual(baseUtility({ prefix: 'object', value: 'bottom', raw: 'object-bottom' }));
      expect(parseUtility('object-center')).toEqual(baseUtility({ prefix: 'object', value: 'center', raw: 'object-center' }));
      expect(parseUtility('object-left')).toEqual(baseUtility({ prefix: 'object', value: 'left', raw: 'object-left' }));
      expect(parseUtility('object-left-bottom')).toEqual(baseUtility({ prefix: 'object', value: 'left-bottom', raw: 'object-left-bottom' }));
      expect(parseUtility('object-left-top')).toEqual(baseUtility({ prefix: 'object', value: 'left-top', raw: 'object-left-top' }));
      expect(parseUtility('object-right')).toEqual(baseUtility({ prefix: 'object', value: 'right', raw: 'object-right' }));
      expect(parseUtility('object-right-bottom')).toEqual(baseUtility({ prefix: 'object', value: 'right-bottom', raw: 'object-right-bottom' }));
      expect(parseUtility('object-right-top')).toEqual(baseUtility({ prefix: 'object', value: 'right-top', raw: 'object-right-top' }));
      expect(parseUtility('object-top')).toEqual(baseUtility({ prefix: 'object', value: 'top', raw: 'object-top' }));
      expect(parseUtility('object-')).toEqual({ type: 'unknown', raw: 'object-' });
    });
  });

  describe('overflow', () => {
    it('should parse Tailwind v4 overflow classes', () => {
      expect(parseUtility('overflow-auto')).toEqual(baseUtility({ prefix: 'overflow', value: 'auto', raw: 'overflow-auto' }));
      expect(parseUtility('overflow-hidden')).toEqual(baseUtility({ prefix: 'overflow', value: 'hidden', raw: 'overflow-hidden' }));
      expect(parseUtility('overflow-visible')).toEqual(baseUtility({ prefix: 'overflow', value: 'visible', raw: 'overflow-visible' }));
      expect(parseUtility('overflow-scroll')).toEqual(baseUtility({ prefix: 'overflow', value: 'scroll', raw: 'overflow-scroll' }));
      expect(parseUtility('overflow-x-auto')).toEqual(baseUtility({ prefix: 'overflow-x', value: 'auto', raw: 'overflow-x-auto' }));
      expect(parseUtility('overflow-y-hidden')).toEqual(baseUtility({ prefix: 'overflow-y', value: 'hidden', raw: 'overflow-y-hidden' }));
      expect(parseUtility('overflow-x-')).toEqual({ type: 'unknown', raw: 'overflow-x-' });
    });
  });

  describe('overscroll', () => {
    it('should parse Tailwind v4 overscroll classes', () => {
      expect(parseUtility('overscroll-auto')).toEqual(baseUtility({ prefix: 'overscroll', value: 'auto', raw: 'overscroll-auto' }));
      expect(parseUtility('overscroll-contain')).toEqual(baseUtility({ prefix: 'overscroll', value: 'contain', raw: 'overscroll-contain' }));
      expect(parseUtility('overscroll-none')).toEqual(baseUtility({ prefix: 'overscroll', value: 'none', raw: 'overscroll-none' }));
      expect(parseUtility('overscroll-y-auto')).toEqual(baseUtility({ prefix: 'overscroll-y', value: 'auto', raw: 'overscroll-y-auto' }));
      expect(parseUtility('overscroll-x-contain')).toEqual(baseUtility({ prefix: 'overscroll-x', value: 'contain', raw: 'overscroll-x-contain' }));
      expect(parseUtility('overscroll-x-')).toEqual({ type: 'unknown', raw: 'overscroll-x-' });
    });
  });

  describe('position', () => {
    it('should parse Tailwind v4 position classes', () => {
      expect(parseUtility('static')).toEqual(baseUtility({ prefix: 'static', raw: 'static' }));
      expect(parseUtility('fixed')).toEqual(baseUtility({ prefix: 'fixed', raw: 'fixed' }));
      expect(parseUtility('absolute')).toEqual(baseUtility({ prefix: 'absolute', raw: 'absolute' }));
      expect(parseUtility('relative')).toEqual(baseUtility({ prefix: 'relative', raw: 'relative' }));
      expect(parseUtility('sticky')).toEqual(baseUtility({ prefix: 'sticky', raw: 'sticky' }));
      expect(parseUtility('static!')).toEqual(baseUtility({ prefix: 'static', raw: 'static!', important: true }));
      expect(parseUtility('static-')).toEqual({ type: 'unknown', raw: 'static-' });
    });
  });

  describe('aspect', () => {
    it('should parse Tailwind v4 aspect classes', () => {
      expect(parseUtility('aspect-auto')).toEqual(baseUtility({ prefix: 'aspect', value: 'auto', raw: 'aspect-auto' }));
      expect(parseUtility('aspect-square')).toEqual(baseUtility({ prefix: 'aspect', value: 'square', raw: 'aspect-square' }));
      expect(parseUtility('aspect-video')).toEqual(baseUtility({ prefix: 'aspect', value: 'video', raw: 'aspect-video' }));
      expect(parseUtility('aspect-[4/3]')).toEqual(baseUtility({ prefix: 'aspect', value: '4/3', arbitrary: true, arbitraryValue: '4/3', raw: 'aspect-[4/3]' }));
      expect(parseUtility('aspect-')).toEqual({ type: 'unknown', raw: 'aspect-' });
    });
  });

  describe('columns', () => {
    it('should parse Tailwind v4 columns classes', () => {
      expect(parseUtility('columns-1')).toEqual(baseUtility({ prefix: 'columns', value: '1', numeric: true, raw: 'columns-1' }));
      expect(parseUtility('columns-3')).toEqual(baseUtility({ prefix: 'columns', value: '3', numeric: true, raw: 'columns-3' }));
      expect(parseUtility('columns-[200px]')).toEqual(baseUtility({ prefix: 'columns', value: '200px', arbitrary: true, arbitraryValue: '200px', raw: 'columns-[200px]' }));
      expect(parseUtility('columns-')).toEqual({ type: 'unknown', raw: 'columns-' });
    });
  });

  describe('break', () => {
    it('should parse Tailwind v4 break classes', () => {
      expect(parseUtility('break-after-auto')).toEqual(baseUtility({ prefix: 'break-after', value: 'auto', raw: 'break-after-auto' }));
      expect(parseUtility('break-before-avoid')).toEqual(baseUtility({ prefix: 'break-before', value: 'avoid', raw: 'break-before-avoid' }));
      expect(parseUtility('break-inside-avoid')).toEqual(baseUtility({ prefix: 'break-inside', value: 'avoid', raw: 'break-inside-avoid' }));
      expect(parseUtility('break-after-')).toEqual({ type: 'unknown', raw: 'break-after-' });
    });
  });

  describe('order', () => {
    it('should parse Tailwind v4 order classes', () => {
      expect(parseUtility('order-1')).toEqual(baseUtility({ prefix: 'order', value: '1', numeric: true, raw: 'order-1' }));
      expect(parseUtility('order-first')).toEqual(baseUtility({ prefix: 'order', value: 'first', raw: 'order-first' }));
      expect(parseUtility('order-last')).toEqual(baseUtility({ prefix: 'order', value: 'last', raw: 'order-last' }));
      expect(parseUtility('order-none')).toEqual(baseUtility({ prefix: 'order', value: 'none', raw: 'order-none' }));
      expect(parseUtility('order-[7]')).toEqual(baseUtility({ prefix: 'order', value: '7', numeric: true, arbitrary: true, arbitraryValue: '7', raw: 'order-[7]' }));
      expect(parseUtility('order-')).toEqual({ type: 'unknown', raw: 'order-' });
    });
  });

  describe('flex', () => {
    it('should parse Tailwind v4 flex classes', () => {
      expect(parseUtility('flex-row')).toEqual(baseUtility({ prefix: 'flex', value: 'row', raw: 'flex-row' }));
      expect(parseUtility('flex-col')).toEqual(baseUtility({ prefix: 'flex', value: 'col', raw: 'flex-col' }));
      expect(parseUtility('flex-wrap')).toEqual(baseUtility({ prefix: 'flex-wrap', value: '', raw: 'flex-wrap' }));
      expect(parseUtility('flex-nowrap')).toEqual(baseUtility({ prefix: 'flex', value: 'nowrap', raw: 'flex-nowrap' }));
      expect(parseUtility('flex-1')).toEqual(baseUtility({ prefix: 'flex', value: '1', numeric: true, raw: 'flex-1' }));
      expect(parseUtility('flex-auto')).toEqual(baseUtility({ prefix: 'flex-auto', value: '', raw: 'flex-auto' }));
      expect(parseUtility('flex-initial')).toEqual(baseUtility({ prefix: 'flex-initial', value: '', raw: 'flex-initial' }));
      expect(parseUtility('flex-none')).toEqual(baseUtility({ prefix: 'flex-none', value: '', raw: 'flex-none' }));
    });
  });

  describe('grid', () => {
    it('should parse Tailwind v4 grid classes', () => {
      expect(parseUtility('grid-cols-1')).toEqual(baseUtility({ prefix: 'grid-cols', value: '1', numeric: true, raw: 'grid-cols-1' }));
      expect(parseUtility('grid-cols-12')).toEqual(baseUtility({ prefix: 'grid-cols', value: '12', numeric: true, raw: 'grid-cols-12' }));
      expect(parseUtility('grid-rows-6')).toEqual(baseUtility({ prefix: 'grid-rows', value: '6', numeric: true, raw: 'grid-rows-6' }));
      expect(parseUtility('grid-flow-row')).toEqual(baseUtility({ prefix: 'grid-flow', value: 'row', raw: 'grid-flow-row' }));
      expect(parseUtility('grid-flow-col')).toEqual(baseUtility({ prefix: 'grid-flow', value: 'col', raw: 'grid-flow-col' }));
      expect(parseUtility('grid-flow-row-dense')).toEqual(baseUtility({ prefix: 'grid-flow', value: 'row-dense', raw: 'grid-flow-row-dense' }));
      expect(parseUtility('grid-flow-col-dense')).toEqual(baseUtility({ prefix: 'grid-flow', value: 'col-dense', raw: 'grid-flow-col-dense' }));
    });
  });
}); 