import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (list)', () => {
  describe('list-style-type', () => {
    it('should parse Tailwind v4 list style type classes', () => {
      expect(parseUtility('list-none')).toEqual(baseUtility({ prefix: 'list', value: 'none', raw: 'list-none' }));
      expect(parseUtility('list-disc')).toEqual(baseUtility({ prefix: 'list', value: 'disc', raw: 'list-disc' }));
      expect(parseUtility('list-decimal')).toEqual(baseUtility({ prefix: 'list', value: 'decimal', raw: 'list-decimal' }));
      expect(parseUtility('list-image-[url(https://example.com/list.svg)]')).toEqual(baseUtility({ prefix: 'list', value: 'image-[url(https://example.com', raw: 'list-image-[url(https://example.com/list.svg)]', slash: 'list.svg)]' }));
      expect(parseUtility('list-')).toEqual({ type: 'unknown', raw: 'list-' });
    });
  });

  describe('list-style-position', () => {
    it('should parse Tailwind v4 list style position classes', () => {
      expect(parseUtility('list-inside')).toEqual(baseUtility({ prefix: 'list', value: 'inside', raw: 'list-inside' }));
      expect(parseUtility('list-outside')).toEqual(baseUtility({ prefix: 'list', value: 'outside', raw: 'list-outside' }));
      expect(parseUtility('list-style-position-')).toEqual(baseUtility({ prefix: 'list', value: 'style-position-', raw: 'list-style-position-' }));
    });
  });

  describe('marker', () => {
    it('should parse Tailwind v4 marker classes', () => {
      expect(parseUtility('marker')).toEqual({ type: 'unknown', raw: 'marker' });
      expect(parseUtility('marker-start')).toEqual({ type: 'unknown', raw: 'marker-start' });
      expect(parseUtility('marker-mid')).toEqual({ type: 'unknown', raw: 'marker-mid' });
      expect(parseUtility('marker-end')).toEqual({ type: 'unknown', raw: 'marker-end' });
      expect(parseUtility('marker-[url(https://example.com/marker.svg)]')).toEqual({ type: 'unknown', raw: 'marker-[url(https://example.com/marker.svg)]' });
      expect(parseUtility('marker-')).toEqual({ type: 'unknown', raw: 'marker-' });
    });
  });
}); 