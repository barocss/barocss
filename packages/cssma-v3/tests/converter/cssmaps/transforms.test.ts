import { describe, it, expect } from 'vitest';
import { backface, perspective, perspectiveOrigin, transform, origin, translate, translateX, translateY, translateZ } from '../../../src/converter/cssmaps/transforms';

describe('cssmaps: backface-visibility', () => {
  it('backface-hidden', () => {
    expect(backface({ prefix: 'backface', value: 'hidden', important: false } as any)).toEqual({ backfaceVisibility: 'hidden' });
  });
  it('backface-visible', () => {
    expect(backface({ prefix: 'backface', value: 'visible', important: false } as any)).toEqual({ backfaceVisibility: 'visible' });
  });
  it('backface: hidden!', () => {
    expect(backface({ prefix: 'backface', value: 'hidden', important: true } as any)).toEqual({ backfaceVisibility: 'hidden !important' });
  });
  it('backface: visible!', () => {
    expect(backface({ prefix: 'backface', value: 'visible', important: true } as any)).toEqual({ backfaceVisibility: 'visible !important' });
  });
});


describe('cssmaps: perspective (with context.theme)', () => {
  const ctx = {
    theme: (section: string, value: string) => {
      if (section === 'perspective' && value === 'custom') return '1234px';
      if (section === 'perspectiveOrigin' && value === 'custom-origin') return '10% 90%';
      return undefined;
    }
  } as any;

  it('should use ctx.theme for perspective', () => {
    expect(perspective({ value: 'custom', important: false } as any, ctx)).toEqual({ perspective: '1234px' });
  });
  it('should use ctx.theme for perspectiveOrigin', () => {
    expect(perspectiveOrigin({ value: 'custom-origin', important: false } as any, ctx)).toEqual({ perspectiveOrigin: '10% 90%' });
  });
  it('should fallback to preset if ctx.theme returns undefined', () => {
    expect(perspective({ value: 'dramatic', important: false } as any, ctx)).toEqual({ perspective: 'var(--perspective-dramatic)' });
    expect(perspectiveOrigin({ value: 'top-right', important: false } as any, ctx)).toEqual({ perspectiveOrigin: 'top right' });
  });
  it('should support custom property', () => {
    expect(perspective({ value: '--foo', customProperty: true, important: false } as any, ctx)).toEqual({ perspective: 'var(--foo)' });
    expect(perspectiveOrigin({ value: '--bar', customProperty: true, important: false } as any, ctx)).toEqual({ perspectiveOrigin: 'var(--bar)' });
  });
  it('should support arbitrary value', () => {
    expect(perspective({ arbitrary: true, arbitraryValue: '999px', important: false } as any, ctx)).toEqual({ perspective: '999px' });
    expect(perspectiveOrigin({ arbitrary: true, arbitraryValue: '33% 44%', important: false } as any, ctx)).toEqual({ perspectiveOrigin: '33% 44%' });
  });
  it('should support !important', () => {
    expect(perspective({ value: 'custom', important: true } as any, ctx)).toEqual({ perspective: '1234px !important' });
    expect(perspective({ value: 'dramatic', important: true } as any, ctx)).toEqual({ perspective: 'var(--perspective-dramatic) !important' });
    expect(perspective({ arbitrary: true, arbitraryValue: '999px', important: true } as any, ctx)).toEqual({ perspective: '999px !important' });
    expect(perspectiveOrigin({ value: 'custom-origin', important: true } as any, ctx)).toEqual({ perspectiveOrigin: '10% 90% !important' });
    expect(perspectiveOrigin({ value: 'top-right', important: true } as any, ctx)).toEqual({ perspectiveOrigin: 'top right !important' });
    expect(perspectiveOrigin({ arbitrary: true, arbitraryValue: '33% 44%', important: true } as any, ctx)).toEqual({ perspectiveOrigin: '33% 44% !important' });
  });
});


describe('cssmaps: transform', () => {
  it('transform (default 2D)', () => {
    expect(transform({} as any)).toEqual({
      '--tw-translate-x': '0',
      '--tw-translate-y': '0',
      '--tw-rotate': '0',
      '--tw-skew-x': '0',
      '--tw-skew-y': '0',
      '--tw-scale-x': '1',
      '--tw-scale-y': '1',
      transform:
        'translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) ' +
        'rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) ' +
        'scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))',
    });
  });
  it('transform-none', () => {
    expect(transform({ value: 'none', important: false } as any)).toEqual({ transform: 'none' });
  });
  it('transform-gpu', () => {
    expect(transform({ value: 'gpu', important: false } as any)).toEqual({
      '--tw-translate-x': '0',
      '--tw-translate-y': '0',
      '--tw-rotate': '0',
      '--tw-skew-x': '0',
      '--tw-skew-y': '0',
      '--tw-scale-x': '1',
      '--tw-scale-y': '1',
      transform:
        'translate3d(var(--tw-translate-x), var(--tw-translate-y), 0) ' +
        'rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) ' +
        'scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))',
    });
  });
  it('transform-cpu', () => {
    expect(transform({ value: 'cpu', important: false } as any)).toEqual({
      '--tw-translate-x': '0',
      '--tw-translate-y': '0',
      '--tw-rotate': '0',
      '--tw-skew-x': '0',
      '--tw-skew-y': '0',
      '--tw-scale-x': '1',
      '--tw-scale-y': '1',
      transform:
        'var(--tw-rotate-x) var(--tw-rotate-y) var(--tw-rotate-z) ' +
        'var(--tw-skew-x) var(--tw-skew-y)',
    });
  });
  it('transform-[arbitrary]', () => {
    expect(transform({ arbitrary: true, arbitraryValue: 'matrix(1,2,3,4,5,6)', important: false } as any)).toEqual({ transform: 'matrix(1,2,3,4,5,6)' });
  });
  it('transform-(--custom)', () => {
    expect(transform({ customProperty: true, value: '--my-transform', important: false } as any)).toEqual({ transform: 'var(--my-transform)' });
  });
  it('transform with !important', () => {
    expect(transform({ important: true } as any)).toEqual({
      '--tw-translate-x': '0',
      '--tw-translate-y': '0',
      '--tw-rotate': '0',
      '--tw-skew-x': '0',
      '--tw-skew-y': '0',
      '--tw-scale-x': '1',
      '--tw-scale-y': '1',
      transform:
        'translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) ' +
        'rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) ' +
        'scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y)) !important',
    });
    expect(transform({ value: 'none', important: true } as any)).toEqual({ transform: 'none !important' });
    expect(transform({ value: 'gpu', important: true } as any)).toEqual({
      '--tw-translate-x': '0',
      '--tw-translate-y': '0',
      '--tw-rotate': '0',
      '--tw-skew-x': '0',
      '--tw-skew-y': '0',
      '--tw-scale-x': '1',
      '--tw-scale-y': '1',
      transform:
        'translate3d(var(--tw-translate-x), var(--tw-translate-y), 0) ' +
        'rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) ' +
        'scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y)) !important',
    });
    expect(transform({ arbitrary: true, arbitraryValue: 'matrix(1,2,3,4,5,6)', important: true } as any)).toEqual({ transform: 'matrix(1,2,3,4,5,6) !important' });
    expect(transform({ customProperty: true, value: '--my-transform', important: true } as any)).toEqual({ transform: 'var(--my-transform) !important' });
  });
});


describe('cssmaps: transform-style (transform-3d/flat)', () => {
  it('transform-3d', () => {
    expect(transform({ value: '3d', important: false } as any)).toEqual({ transformStyle: 'preserve-3d' });
  });
  it('transform-flat', () => {
    expect(transform({ value: 'flat', important: false } as any)).toEqual({ transformStyle: 'flat' });
  });
  it('transform-3d with !important', () => {
    expect(transform({ value: '3d', important: true } as any)).toEqual({ transformStyle: 'preserve-3d !important' });
  });
  it('transform-flat with !important', () => {
    expect(transform({ value: 'flat', important: true } as any)).toEqual({ transformStyle: 'flat !important' });
  });
});


describe('cssmaps: origin (transform-origin)', () => {
  it('origin-center', () => {
    expect(origin({ value: 'center', important: false } as any)).toEqual({ transformOrigin: 'center' });
  });
  it('origin-top', () => {
    expect(origin({ value: 'top', important: false } as any)).toEqual({ transformOrigin: 'top' });
  });
  it('origin-top-right', () => {
    expect(origin({ value: 'top-right', important: false } as any)).toEqual({ transformOrigin: 'top right' });
  });
  it('origin-right', () => {
    expect(origin({ value: 'right', important: false } as any)).toEqual({ transformOrigin: 'right' });
  });
  it('origin-bottom-right', () => {
    expect(origin({ value: 'bottom-right', important: false } as any)).toEqual({ transformOrigin: 'bottom right' });
  });
  it('origin-bottom', () => {
    expect(origin({ value: 'bottom', important: false } as any)).toEqual({ transformOrigin: 'bottom' });
  });
  it('origin-bottom-left', () => {
    expect(origin({ value: 'bottom-left', important: false } as any)).toEqual({ transformOrigin: 'bottom left' });
  });
  it('origin-left', () => {
    expect(origin({ value: 'left', important: false } as any)).toEqual({ transformOrigin: 'left' });
  });
  it('origin-top-left', () => {
    expect(origin({ value: 'top-left', important: false } as any)).toEqual({ transformOrigin: 'top left' });
  });
  it('origin-(--custom)', () => {
    expect(origin({ customProperty: true, value: '--my-origin', important: false } as any)).toEqual({ transformOrigin: 'var(--my-origin)' });
  });
  it('origin-[arbitrary]', () => {
    expect(origin({ arbitrary: true, arbitraryValue: '33% 75%', important: false } as any)).toEqual({ transformOrigin: '33% 75%' });
  });
  it('origin with !important', () => {
    expect(origin({ value: 'center', important: true } as any)).toEqual({ transformOrigin: 'center !important' });
    expect(origin({ customProperty: true, value: '--my-origin', important: true } as any)).toEqual({ transformOrigin: 'var(--my-origin) !important' });
    expect(origin({ arbitrary: true, arbitraryValue: '33% 75%', important: true } as any)).toEqual({ transformOrigin: '33% 75% !important' });
  });
});

describe('cssmaps: translate', () => {
  it('translate spacing scale', () => {
    expect(translate({ value: '4', important: false } as any)).toEqual({ transform: 'translate: calc(var(--spacing) * 4) calc(var(--spacing) * 4);' });
  });
  it('translate negative scale', () => {
    expect(translate({ value: '2', negative: true, important: false } as any)).toEqual({ transform: 'translate: calc(var(--spacing) * -2) calc(var(--spacing) * -2);' });
  });
  it('translate px', () => {
    expect(translate({ value: 'px', important: false } as any)).toEqual({ transform: '1px 1px' });
  });
  it('translate full', () => {
    expect(translate({ value: 'full', important: false } as any)).toEqual({ transform: '100% 100%' });
  });
  it('translate fraction', () => {
    expect(translate({ value: '1', slash: '2', important: false } as any)).toEqual({ transform: 'calc(0.5 * 100%) calc(0.5 * 100%);' });
  });
  it('translate custom property', () => {
    expect(translate({ customProperty: true, value: '--foo', important: false } as any)).toEqual({ transform: 'var(--foo) var(--foo)' });
  });
  it('translate arbitrary', () => {
    expect(translate({ arbitraryValue: '10px', important: false } as any)).toEqual({ transform: '10px 10px' });
  });
  it('translate with !important', () => {
    expect(translate({ value: '4', important: true } as any)).toEqual({ transform: 'translate: calc(var(--spacing) * 4) calc(var(--spacing) * 4); !important' });
  });
});

describe('cssmaps: translateX', () => {
  it('translateX spacing scale', () => {
    expect(translateX({ value: '3', important: false } as any)).toEqual({ transform: 'translateX: calc(var(--spacing) * 3);' });
  });
  it('translateX negative scale', () => {
    expect(translateX({ value: '1', negative: true, important: false } as any)).toEqual({ transform: 'translateX: calc(var(--spacing) * -1);' });
  });
  it('translateX px', () => {
    expect(translateX({ value: 'px', important: false } as any)).toEqual({ transform: '1px var(--tw-translate-y)' });
  });
  it('translateX full', () => {
    expect(translateX({ value: 'full', important: false } as any)).toEqual({ transform: '100% var(--tw-translate-y)' });
  });
  it('translateX fraction', () => {
    expect(translateX({ value: '1', slash: '2', important: false } as any)).toEqual({ transform: 'calc(0.5 * 100%) var(--tw-translate-y)' });
  });
  it('translateX custom property', () => {
    expect(translateX({ customProperty: true, value: '--foo', important: false } as any)).toEqual({ transform: 'var(--foo) var(--tw-translate-y)' });
  });
  it('translateX arbitrary', () => {
    expect(translateX({ arbitraryValue: '5rem', important: false } as any)).toEqual({ transform: '5rem var(--tw-translate-y)' });
  });
  it('translateX with !important', () => {
    expect(translateX({ value: '3', important: true } as any)).toEqual({ transform: 'translateX: calc(var(--spacing) * 3); !important' });
  });
});

describe('cssmaps: translateY', () => {
  it('translateY spacing scale', () => {
    expect(translateY({ value: '2', important: false } as any)).toEqual({ transform: 'translate: calc(var(--spacing) * 2) var(--tw-translate-y);' });
  });
  it('translateY negative scale', () => {
    expect(translateY({ value: '2', negative: true, important: false } as any)).toEqual({ transform: 'translate: calc(var(--spacing) * -2) var(--tw-translate-y);' });
  });
  it('translateY px', () => {
    expect(translateY({ value: 'px', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) 1px' });
  });
  it('translateY full', () => {
    expect(translateY({ value: 'full', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) 100%' });
  });
  it('translateY fraction', () => {
    expect(translateY({ value: '1', slash: '2', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) calc(0.5 * 100%)' });
  });
  it('translateY custom property', () => {
    expect(translateY({ customProperty: true, value: '--foo', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) var(--foo)' });
  });
  it('translateY arbitrary', () => {
    expect(translateY({ arbitraryValue: '2vw', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) 2vw' });
  });
  it('translateY with !important', () => {
    expect(translateY({ value: '2', important: true } as any)).toEqual({ transform: 'translate: calc(var(--spacing) * 2) var(--tw-translate-y); !important' });
  });
});

describe('cssmaps: translateZ', () => {
  it('translateZ spacing scale', () => {
    expect(translateZ({ value: '1', important: false } as any)).toEqual({ transform: 'translateZ: calc(var(--spacing) * 1);' });
  });
  it('translateZ negative scale', () => {
    expect(translateZ({ value: '2', negative: true, important: false } as any)).toEqual({ transform: 'translateZ: calc(var(--spacing) * -2);' });
  });
  it('translateZ px', () => {
    expect(translateZ({ value: 'px', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) var(--tw-translate-y) 1px' });
  });
  it('translateZ full', () => {
    expect(translateZ({ value: 'full', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) var(--tw-translate-y) 100%' });
  });
  it('translateZ fraction', () => {
    expect(translateZ({ value: '1', slash: '2', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) var(--tw-translate-y) calc(0.5 * 100%)' });
  });
  it('translateZ custom property', () => {
    expect(translateZ({ customProperty: true, value: '--foo', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) var(--tw-translate-y) var(--foo)' });
  });
  it('translateZ arbitrary', () => {
    expect(translateZ({ arbitraryValue: '8px', important: false } as any)).toEqual({ transform: 'var(--tw-translate-x) var(--tw-translate-y) 8px' });
  });
  it('translateZ with !important', () => {
    expect(translateZ({ value: '1', important: true } as any)).toEqual({ transform: 'translateZ: calc(var(--spacing) * 1); !important' });
  });
}); 