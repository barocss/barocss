import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (typography)', () => {
  describe('text decoration', () => {
    it('should parse Tailwind v4 text decoration classes', () => {
      expect(parseUtility('underline')).toEqual(baseUtility({ prefix: 'underline', raw: 'underline' }));
      expect(parseUtility('line-through')).toEqual(baseUtility({ prefix: 'line-through', raw: 'line-through' }));
      expect(parseUtility('no-underline')).toEqual(baseUtility({ prefix: 'no-underline', raw: 'no-underline' }));
      expect(parseUtility('overline')).toEqual(baseUtility({ prefix: 'overline', raw: 'overline' }));
      expect(parseUtility('underline!')).toEqual(baseUtility({ prefix: 'underline', raw: 'underline!', important: true }));
      expect(parseUtility('underline-')).toEqual({ type: 'unknown', raw: 'underline-' });
    });
  });

  describe('decoration', () => {
    it('should parse Tailwind v4 decoration classes', () => {
      expect(parseUtility('decoration-solid')).toEqual(baseUtility({ prefix: 'decoration', value: 'solid', raw: 'decoration-solid' }));
      expect(parseUtility('decoration-double')).toEqual(baseUtility({ prefix: 'decoration', value: 'double', raw: 'decoration-double' }));
      expect(parseUtility('decoration-dotted')).toEqual(baseUtility({ prefix: 'decoration', value: 'dotted', raw: 'decoration-dotted' }));
      expect(parseUtility('decoration-dashed')).toEqual(baseUtility({ prefix: 'decoration', value: 'dashed', raw: 'decoration-dashed' }));
      expect(parseUtility('decoration-wavy')).toEqual(baseUtility({ prefix: 'decoration', value: 'wavy', raw: 'decoration-wavy' }));
      expect(parseUtility('decoration-8')).toEqual(baseUtility({ prefix: 'decoration', value: '8', numeric: true, raw: 'decoration-8' }));
      expect(parseUtility('decoration-[#ff0]')).toEqual(baseUtility({ prefix: 'decoration', value: '#ff0', arbitrary: true, arbitraryType: 'hex', arbitraryValue: '#ff0', raw: 'decoration-[#ff0]' }));
      expect(parseUtility('decoration-[3px]')).toEqual(baseUtility({ prefix: 'decoration', value: '3px', arbitrary: true, arbitraryValue: '3px', raw: 'decoration-[3px]' }));
      expect(parseUtility('decoration-')).toEqual({ type: 'unknown', raw: 'decoration-' });
    });
  });

  describe('underline-offset', () => {
    it('should parse Tailwind v4 underline-offset classes', () => {
      // Basic numeric values
      expect(parseUtility('underline-offset-1')).toEqual(baseUtility({ prefix: 'underline-offset', value: '1', numeric: true, raw: 'underline-offset-1' }));
      expect(parseUtility('underline-offset-4')).toEqual(baseUtility({ prefix: 'underline-offset', value: '4', numeric: true, raw: 'underline-offset-4' }));
      expect(parseUtility('underline-offset-8')).toEqual(baseUtility({ prefix: 'underline-offset', value: '8', numeric: true, raw: 'underline-offset-8' }));
      
      // Auto keyword
      expect(parseUtility('underline-offset-auto')).toEqual(baseUtility({ prefix: 'underline-offset', value: 'auto', raw: 'underline-offset-auto' }));
      
      // Negative values
      expect(parseUtility('-underline-offset-1')).toEqual(baseUtility({ prefix: 'underline-offset', value: '1', negative: true, numeric: true, raw: '-underline-offset-1' }));
      expect(parseUtility('-underline-offset-4')).toEqual(baseUtility({ prefix: 'underline-offset', value: '4', negative: true, numeric: true, raw: '-underline-offset-4' }));
      
      // Arbitrary values
      expect(parseUtility('underline-offset-[2px]')).toEqual(baseUtility({ prefix: 'underline-offset', value: '2px', arbitrary: true, arbitraryValue: '2px', raw: 'underline-offset-[2px]' }));
      expect(parseUtility('underline-offset-[0.5rem]')).toEqual(baseUtility({ prefix: 'underline-offset', value: '0.5rem', arbitrary: true, arbitraryValue: '0.5rem', raw: 'underline-offset-[0.5rem]' }));
      
      // Custom properties
      expect(parseUtility('underline-offset-(--my-offset)')).toEqual(baseUtility({ prefix: 'underline-offset', value: '--my-offset', customProperty: true, raw: 'underline-offset-(--my-offset)' }));
      
      // Invalid cases
      expect(parseUtility('underline-offset-')).toEqual({ type: 'unknown', raw: 'underline-offset-' });
    });
  });

  describe('text align', () => {
    it('should parse Tailwind v4 text align classes', () => {
      expect(parseUtility('text-left')).toEqual(baseUtility({ prefix: 'text', value: 'left', raw: 'text-left' }));
      expect(parseUtility('text-center')).toEqual(baseUtility({ prefix: 'text', value: 'center', raw: 'text-center' }));
      expect(parseUtility('text-right')).toEqual(baseUtility({ prefix: 'text', value: 'right', raw: 'text-right' }));
      expect(parseUtility('text-justify')).toEqual(baseUtility({ prefix: 'text', value: 'justify', raw: 'text-justify' }));
      expect(parseUtility('text-start')).toEqual(baseUtility({ prefix: 'text', value: 'start', raw: 'text-start' }));
      expect(parseUtility('text-end')).toEqual(baseUtility({ prefix: 'text', value: 'end', raw: 'text-end' }));
    });
  });

  describe('text transform', () => {
    it('should parse Tailwind v4 text transform classes', () => {
      expect(parseUtility('uppercase')).toEqual(baseUtility({ prefix: 'uppercase', raw: 'uppercase' }));
      expect(parseUtility('lowercase')).toEqual(baseUtility({ prefix: 'lowercase', raw: 'lowercase' }));
      expect(parseUtility('capitalize')).toEqual(baseUtility({ prefix: 'capitalize', raw: 'capitalize' }));
      expect(parseUtility('normal-case')).toEqual(baseUtility({ prefix: 'normal-case', raw: 'normal-case' }));
      expect(parseUtility('uppercase!')).toEqual(baseUtility({ prefix: 'uppercase', raw: 'uppercase!', important: true }));
      expect(parseUtility('uppercase-')).toEqual({ type: 'unknown', raw: 'uppercase-' });
    });
  });

  describe('text overflow', () => {
    it('should parse Tailwind v4 text overflow classes', () => {
      expect(parseUtility('truncate')).toEqual(baseUtility({ prefix: 'truncate', raw: 'truncate' }));
      expect(parseUtility('overflow-ellipsis')).toEqual(baseUtility({ prefix: 'overflow', value: 'ellipsis', raw: 'overflow-ellipsis' }));
      expect(parseUtility('overflow-clip')).toEqual(baseUtility({ prefix: 'overflow', value: 'clip', raw: 'overflow-clip' }));
      expect(parseUtility('truncate!')).toEqual(baseUtility({ prefix: 'truncate', raw: 'truncate!', important: true }));
      expect(parseUtility('truncate-')).toEqual({ type: 'unknown', raw: 'truncate-' });
    });
  });

  describe('whitespace', () => {
    it('should parse Tailwind v4 whitespace classes', () => {
      expect(parseUtility('whitespace-normal')).toEqual(baseUtility({ prefix: 'whitespace', value: 'normal', raw: 'whitespace-normal' }));
      expect(parseUtility('whitespace-nowrap')).toEqual(baseUtility({ prefix: 'whitespace', value: 'nowrap', raw: 'whitespace-nowrap' }));
      expect(parseUtility('whitespace-pre')).toEqual(baseUtility({ prefix: 'whitespace', value: 'pre', raw: 'whitespace-pre' }));
      expect(parseUtility('whitespace-pre-line')).toEqual(baseUtility({ prefix: 'whitespace', value: 'pre-line', raw: 'whitespace-pre-line' }));
      expect(parseUtility('whitespace-pre-wrap')).toEqual(baseUtility({ prefix: 'whitespace', value: 'pre-wrap', raw: 'whitespace-pre-wrap' }));
      expect(parseUtility('whitespace-')).toEqual({ type: 'unknown', raw: 'whitespace-' });
    });
  });

  describe('break', () => {
    it('should parse Tailwind v4 break classes', () => {
      expect(parseUtility('break-normal')).toEqual(baseUtility({ prefix: 'break', value: 'normal', raw: 'break-normal' }));
      expect(parseUtility('break-words')).toEqual(baseUtility({ prefix: 'break', value: 'words', raw: 'break-words' }));
      expect(parseUtility('break-all')).toEqual(baseUtility({ prefix: 'break', value: 'all', raw: 'break-all' }));
      expect(parseUtility('break-keep')).toEqual(baseUtility({ prefix: 'break', value: 'keep', raw: 'break-keep' }));
      expect(parseUtility('break-')).toEqual({ type: 'unknown', raw: 'break-' });
    });
  });

  describe('hyphens', () => {
    it('should parse Tailwind v4 hyphens classes', () => {
      expect(parseUtility('hyphens-none')).toEqual(baseUtility({ prefix: 'hyphens', value: 'none', raw: 'hyphens-none' }));
      expect(parseUtility('hyphens-manual')).toEqual(baseUtility({ prefix: 'hyphens', value: 'manual', raw: 'hyphens-manual' }));
      expect(parseUtility('hyphens-auto')).toEqual(baseUtility({ prefix: 'hyphens', value: 'auto', raw: 'hyphens-auto' }));
      expect(parseUtility('hyphens-')).toEqual({ type: 'unknown', raw: 'hyphens-' });
    });
  });

  describe('indent', () => {
    it('should parse Tailwind v4 indent classes', () => {
      // Basic numeric values
      expect(parseUtility('indent-0')).toEqual(baseUtility({ prefix: 'indent', value: '0', numeric: true, raw: 'indent-0' }));
      expect(parseUtility('indent-4')).toEqual(baseUtility({ prefix: 'indent', value: '4', numeric: true, raw: 'indent-4' }));
      expect(parseUtility('indent-8')).toEqual(baseUtility({ prefix: 'indent', value: '8', numeric: true, raw: 'indent-8' }));
      
      // Pixel values
      expect(parseUtility('indent-px')).toEqual(baseUtility({ prefix: 'indent', value: 'px', raw: 'indent-px' }));
      
      // Negative values
      expect(parseUtility('-indent-4')).toEqual(baseUtility({ prefix: 'indent', value: '4', negative: true, numeric: true, raw: '-indent-4' }));
      expect(parseUtility('-indent-px')).toEqual(baseUtility({ prefix: 'indent', value: 'px', negative: true, raw: '-indent-px' }));
      
      // Arbitrary values
      expect(parseUtility('indent-[2em]')).toEqual(baseUtility({ prefix: 'indent', value: '2em', arbitrary: true, arbitraryValue: '2em', raw: 'indent-[2em]' }));
      expect(parseUtility('indent-[32px]')).toEqual(baseUtility({ prefix: 'indent', value: '32px', arbitrary: true, arbitraryValue: '32px', raw: 'indent-[32px]' }));
      
      // Custom properties
      expect(parseUtility('indent-(--my-indent)')).toEqual(baseUtility({ prefix: 'indent', value: '--my-indent', customProperty: true, raw: 'indent-(--my-indent)' }));
      
      // Invalid cases
      expect(parseUtility('indent-')).toEqual({ type: 'unknown', raw: 'indent-' });
    });
  });

  describe('list', () => {
    it('should parse Tailwind v4 list classes', () => {
      expect(parseUtility('list-none')).toEqual(baseUtility({ prefix: 'list', value: 'none', raw: 'list-none' }));
      expect(parseUtility('list-disc')).toEqual(baseUtility({ prefix: 'list', value: 'disc', raw: 'list-disc' }));
      expect(parseUtility('list-decimal')).toEqual(baseUtility({ prefix: 'list', value: 'decimal', raw: 'list-decimal' }));
      expect(parseUtility('list-inside')).toEqual(baseUtility({ prefix: 'list', value: 'inside', raw: 'list-inside' }));
      expect(parseUtility('list-outside')).toEqual(baseUtility({ prefix: 'list', value: 'outside', raw: 'list-outside' }));
      
    });
  });

  describe('sub/sup', () => {
    it('should parse Tailwind v4 sub/sup classes', () => {
      expect(parseUtility('sub')).toEqual(baseUtility({ prefix: 'sub', raw: 'sub' }));
      expect(parseUtility('sup')).toEqual(baseUtility({ prefix: 'sup', raw: 'sup' }));
      expect(parseUtility('sub!')).toEqual(baseUtility({ prefix: 'sub', raw: 'sub!', important: true }));
      expect(parseUtility('sub-')).toEqual({ type: 'unknown', raw: 'sub-' });
      expect(parseUtility('sup-')).toEqual({ type: 'unknown', raw: 'sup-' });
    });
  });
}); 