import { describe, it, expect } from 'vitest';
import { mask, maskOrigin, maskPosition, maskRepeat, maskSize, maskType } from '../../../src/converter/cssmaps/mask';
import { createContext } from '../../../src/config/context';

const context = createContext({
  theme: {
    blur: {
      xs: '2px',
      sm: '4px',
      md: '12px',
      lg: '16px',
      xl: '24px',
      '2xl': '40px',
      '3xl': '64px',
      custom: '99px',
    },
  },
});

describe('mask()', () => {
  it('returns maskClip for clip values', () => {
    expect(mask({ value: 'border' } as any, context)).toEqual({ maskClip: 'border-box' });
    expect(mask({ value: 'padding' } as any, context)).toEqual({ maskClip: 'padding-box' });
    expect(mask({ value: 'content' } as any, context)).toEqual({ maskClip: 'content-box' });
    expect(mask({ value: 'fill' } as any, context)).toEqual({ maskClip: 'fill-box' });
    expect(mask({ value: 'stroke' } as any, context)).toEqual({ maskClip: 'stroke-box' });
    expect(mask({ value: 'view' } as any, context)).toEqual({ maskClip: 'view-box' });
    expect(mask({ value: 'no-clip' } as any, context)).toEqual({ maskClip: 'no-clip' });
  });

  it('returns maskComposite for composite values', () => {
    expect(mask({ value: 'add' } as any, context)).toEqual({ maskComposite: 'add' });
    expect(mask({ value: 'subtract' } as any, context)).toEqual({ maskComposite: 'subtract' });
    expect(mask({ value: 'intersect' } as any, context)).toEqual({ maskComposite: 'intersect' });
    expect(mask({ value: 'exclude' } as any, context)).toEqual({ maskComposite: 'exclude' });
  });

  it('returns maskMode for mode values', () => {
    expect(mask({ value: 'alpha' } as any, context)).toEqual({ maskMode: 'alpha' });
    expect(mask({ value: 'luminance' } as any, context)).toEqual({ maskMode: 'luminance' });
  });

  it('returns maskOrigin for origin values', () => {
    expect(maskOrigin({ value: 'border' } as any, context)).toEqual({ maskOrigin: 'border-box' });
    expect(maskOrigin({ value: 'padding' } as any, context)).toEqual({ maskOrigin: 'padding-box' });
    expect(maskOrigin({ value: 'content' } as any, context)).toEqual({ maskOrigin: 'content-box' });
    expect(maskOrigin({ value: 'fill' } as any, context)).toEqual({ maskOrigin: 'fill-box' });
    expect(maskOrigin({ value: 'stroke' } as any, context)).toEqual({ maskOrigin: 'stroke-box' });
    expect(maskOrigin({ value: 'view' } as any, context)).toEqual({ maskOrigin: 'view-box' });
  });

  it('returns maskRepeat for repeat values', () => {
    expect(maskRepeat({ value: 'repeat' } as any, context)).toEqual({ maskRepeat: 'repeat' });
    expect(mask({ value: 'no-repeat' } as any, context)).toEqual({ maskRepeat: 'no-repeat' });
    expect(maskRepeat({ value: 'space' } as any, context)).toEqual({ maskRepeat: 'space' });
    expect(maskRepeat({ value: 'round' } as any, context)).toEqual({ maskRepeat: 'round' });
  });

  it('returns maskSize for size values', () => {
    expect(mask({ value: 'auto' } as any, context)).toEqual({ maskSize: 'auto' });
    expect(mask({ value: 'cover' } as any, context)).toEqual({ maskSize: 'cover' });
    expect(mask({ value: 'contain' } as any, context)).toEqual({ maskSize: 'contain' });
    expect(maskSize({ value: '--custom', customProperty: true } as any, context)).toEqual({ maskSize: 'var(--custom)' });
    expect(maskSize({ value: '32px', arbitrary: true, arbitraryValue: '32px' } as any, context)).toEqual({ maskSize: '32px' });
  });

  it('returns maskType for type values', () => {
    expect(maskType({ value: 'alpha' } as any, context)).toEqual({ maskType: 'alpha' });
    expect(maskType({ value: 'luminance' } as any, context)).toEqual({ maskType: 'luminance' });
  });

  it('returns maskPosition for position values', () => {
    expect(mask({ value: 'top' } as any, context)).toEqual({ maskPosition: 'top' });
    expect(mask({ value: 'top-left' } as any, context)).toEqual({ maskPosition: 'top left' });
    expect(mask({ value: 'center' } as any, context)).toEqual({ maskPosition: 'center' });
    expect(mask({ value: 'bottom-right' } as any, context)).toEqual({ maskPosition: 'bottom right' });
    expect(maskPosition({ value: '--custom', customProperty: true } as any, context)).toEqual({ maskPosition: 'var(--custom)' });
    expect(maskPosition({ value: '10% 20%', arbitrary: true, arbitraryValue: '10% 20%' } as any, context)).toEqual({ maskPosition: '10% 20%' });
  });

  it('returns maskSize for none/auto', () => {
    expect(mask({ value: 'none' } as any, context)).toEqual({ maskImage: 'none' });
    expect(mask({ value: 'auto' } as any, context)).toEqual({ maskSize: 'auto' });
  });

  it('returns mask with !important', () => {
    expect(mask({ value: 'border', important: true } as any, context)).toEqual({ maskClip: 'border-box !important' });
    expect(mask({ value: 'add', important: true } as any, context)).toEqual({ maskComposite: 'add !important' });
    expect(mask({ value: 'top', important: true } as any, context)).toEqual({ maskPosition: 'top !important' });
    expect(mask({ value: 'auto', important: true } as any, context)).toEqual({ maskSize: 'auto !important' });
  });

  it('fallback: returns mask as-is', () => {
    expect(mask({ value: 'unknown' } as any, context)).toEqual({ mask: 'unknown' });
  });
}); 