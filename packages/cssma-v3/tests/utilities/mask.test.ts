import { describe, it, expect } from 'vitest';
import { parseUtility } from '../../src/parser/parseUtility';
import { baseUtility } from './base';

describe('parseUtility (mask)', () => {
  describe('mask', () => {
    it('should parse Tailwind v4 mask classes', () => {
      expect(parseUtility('mask')).toEqual(baseUtility({ prefix: 'mask', raw: 'mask' }));
      expect(parseUtility('mask-none')).toEqual(baseUtility({ prefix: 'mask', value: 'none', raw: 'mask-none' }));
      expect(parseUtility('mask-squircle')).toEqual(baseUtility({ prefix: 'mask', value: 'squircle', raw: 'mask-squircle' }));
      expect(parseUtility('mask-hex')).toEqual(baseUtility({ prefix: 'mask', value: 'hex', raw: 'mask-hex' }));
      expect(parseUtility('mask-')).toEqual({ type: 'unknown', raw: 'mask-' });
      expect(parseUtility('mask-foo')).toEqual({ type: 'unknown', raw: 'mask-foo' });
    });
  });

  describe('mask-type', () => {
    it('should parse Tailwind v4 mask-type classes', () => {
      expect(parseUtility('mask-type-luminance')).toEqual(baseUtility({ prefix: 'mask-type', value: 'luminance', raw: 'mask-type-luminance' }));
      expect(parseUtility('mask-type-alpha')).toEqual(baseUtility({ prefix: 'mask-type', value: 'alpha', raw: 'mask-type-alpha' }));
      expect(parseUtility('mask-type-')).toEqual({ type: 'unknown', raw: 'mask-type-' });
      expect(parseUtility('mask-type-foo')).toEqual({ type: 'unknown', raw: 'mask-type-foo' });
    });
  });

  describe('mask-image', () => {
    it('should parse Tailwind v4 mask-image classes', () => {
      expect(parseUtility('mask-image-none')).toEqual(baseUtility({ prefix: 'mask-image', value: 'none', raw: 'mask-image-none' }));
      expect(parseUtility('mask-image-[url(https://example.com/mask.svg)]')).toEqual(baseUtility({ prefix: 'mask-image', value: '[url(https://example.com/mask.svg)]', raw: 'mask-image-[url(https://example.com/mask.svg)]' }));
      expect(parseUtility('mask-image-')).toEqual({ type: 'unknown', raw: 'mask-image-' });
      expect(parseUtility('mask-image-foo')).toEqual({ type: 'unknown', raw: 'mask-image-foo' });
    });
  });

  describe('mask-size', () => {
    it('should parse Tailwind v4 mask-size classes', () => {
      expect(parseUtility('mask-size-auto')).toEqual(baseUtility({ prefix: 'mask-size', value: 'auto', raw: 'mask-size-auto' }));
      expect(parseUtility('mask-size-contain')).toEqual(baseUtility({ prefix: 'mask-size', value: 'contain', raw: 'mask-size-contain' }));
      expect(parseUtility('mask-size-cover')).toEqual(baseUtility({ prefix: 'mask-size', value: 'cover', raw: 'mask-size-cover' }));
      expect(parseUtility('mask-size-[32px]')).toEqual(baseUtility({ prefix: 'mask-size', value: '[32px]', raw: 'mask-size-[32px]' }));
      expect(parseUtility('mask-size-')).toEqual({ type: 'unknown', raw: 'mask-size-' });
      expect(parseUtility('mask-size-foo')).toEqual({ type: 'unknown', raw: 'mask-size-foo' });
    });
  });

  describe('mask-repeat', () => {
    it('should parse Tailwind v4 mask-repeat classes', () => {
      expect(parseUtility('mask-repeat')).toEqual(baseUtility({ prefix: 'mask-repeat', raw: 'mask-repeat' }));
      expect(parseUtility('mask-no-repeat')).toEqual(baseUtility({ prefix: 'mask-repeat', value: 'no-repeat', raw: 'mask-no-repeat' }));
      expect(parseUtility('mask-repeat-x')).toEqual(baseUtility({ prefix: 'mask-repeat', value: 'x', raw: 'mask-repeat-x' }));
      expect(parseUtility('mask-repeat-y')).toEqual(baseUtility({ prefix: 'mask-repeat', value: 'y', raw: 'mask-repeat-y' }));
      expect(parseUtility('mask-repeat-')).toEqual({ type: 'unknown', raw: 'mask-repeat-' });
      expect(parseUtility('mask-repeat-foo')).toEqual({ type: 'unknown', raw: 'mask-repeat-foo' });
    });
  });

  describe('mask-position', () => {
    it('should parse Tailwind v4 mask-position classes', () => {
      expect(parseUtility('mask-position-center')).toEqual(baseUtility({ prefix: 'mask-position', value: 'center', raw: 'mask-position-center' }));
      expect(parseUtility('mask-position-top')).toEqual(baseUtility({ prefix: 'mask-position', value: 'top', raw: 'mask-position-top' }));
      expect(parseUtility('mask-position-bottom')).toEqual(baseUtility({ prefix: 'mask-position', value: 'bottom', raw: 'mask-position-bottom' }));
      expect(parseUtility('mask-position-left')).toEqual(baseUtility({ prefix: 'mask-position', value: 'left', raw: 'mask-position-left' }));
      expect(parseUtility('mask-position-right')).toEqual(baseUtility({ prefix: 'mask-position', value: 'right', raw: 'mask-position-right' }));
      expect(parseUtility('mask-position-[10%_20%]')).toEqual(baseUtility({ prefix: 'mask-position', value: '[10%_20%]', raw: 'mask-position-[10%_20%]' }));
      expect(parseUtility('mask-position-')).toEqual({ type: 'unknown', raw: 'mask-position-' });
      expect(parseUtility('mask-position-foo')).toEqual({ type: 'unknown', raw: 'mask-position-foo' });
    });
  });

  it('parses mask-mode', () => {
    expect(parseUtility('mask-mode-alpha')).toEqual(baseUtility({ prefix: 'mask-mode', value: 'alpha', raw: 'mask-mode-alpha' }));
  });
  it('returns unknown for invalid', () => {
    expect(parseUtility('mask-type-')).toEqual({ type: 'unknown', raw: 'mask-type-' });
    expect(parseUtility('mask-size-')).toEqual({ type: 'unknown', raw: 'mask-size-' });
    expect(parseUtility('mask-repeat-')).toEqual({ type: 'unknown', raw: 'mask-repeat-' });
    expect(parseUtility('mask-position-')).toEqual({ type: 'unknown', raw: 'mask-position-' });
    expect(parseUtility('mask-mode-')).toEqual({ type: 'unknown', raw: 'mask-mode-' });
  });
}); 