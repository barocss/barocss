import { describe, it, expect } from 'vitest';
import { defaultTheme } from '../src/theme/default-theme';
import { themeGetter as theme, ThemeGetter } from '../src/core/context';
import { resolveTheme, createContext } from '../src/core/context';

describe('theme() getter', () => {
  it('should resolve dot-path string', () => {
    expect(theme(defaultTheme, 'colors.red.500')).toBe(defaultTheme.colors.red['500']);
    expect(theme(defaultTheme, 'spacing.4')).toBe(defaultTheme.spacing['4']);
    expect(theme(defaultTheme, 'fontFamily.sans')).toEqual(defaultTheme.fontFamily.sans);
  });

  it('should resolve path array', () => {
    expect(theme(defaultTheme, 'colors', 'red', '500')).toBe(defaultTheme.colors.red['500']);
    expect(theme(defaultTheme, 'spacing', 4)).toBe(defaultTheme.spacing['4']);
    expect(theme(defaultTheme, 'fontFamily', 'sans')).toEqual(defaultTheme.fontFamily.sans);
  });

  it('should return undefined for missing path', () => {
    expect(theme(defaultTheme, 'colors', 'notexist')).toBeUndefined();
    expect(theme(defaultTheme, 'notexist')).toBeUndefined();
  });

  it('should resolve function values if present', () => {
    const fnTheme = { ...defaultTheme, test: () => ({ deep: 42 }) };
    expect(theme(fnTheme, 'test.deep')).toBe(42);
  });

  it('should resolve extended/overridden theme (extend, presets)', () => {
    const base = { colors: { red: { 500: '#f00', 600: '#e00' } }, spacing: { 4: '1rem' } };
    const extend = { colors: { red: { 500: '#ff0000' } }, spacing: { 8: '2rem' } };
    const config = { theme: { ...base, extend } };
    const merged = resolveTheme(config);
    expect(merged.colors.red['500']).toBe('#ff0000'); // extend 적용
    expect(merged.colors.red['600']).toBe('#e00');    // base 유지
    expect(merged.spacing['4']).toBe('1rem');         // base 유지
    expect(merged.spacing['8']).toBe('2rem');         // extend 추가
    // context 기반 접근
    const ctx = createContext(config);
    expect(ctx.theme('colors.red.500')).toBe('#ff0000');
    expect(ctx.theme('colors.red.600')).toBe('#e00');
    expect(ctx.theme('spacing.4')).toBe('1rem');
    expect(ctx.theme('spacing.8')).toBe('2rem');
  });

  it('should resolve theme with presets array (multi-preset merge)', () => {
    const preset1 = { theme: { colors: { red: { 500: '#f00' } }, spacing: { 4: '1rem' } } };
    const preset2 = { theme: { colors: { red: { 600: '#e00' } }, spacing: { 8: '2rem' } } };
    const config = { presets: [preset1, preset2], theme: { colors: { red: { 500: '#ff0000' } } } };
    const merged = resolveTheme(config);
    expect(merged.colors.red['500']).toBe('#ff0000'); // theme override
    expect(merged.colors.red['600']).toBe('#e00');    // preset2
    expect(merged.spacing['4']).toBe('1rem');         // preset1
    expect(merged.spacing['8']).toBe('2rem');         // preset2
    // context 기반 접근
    const ctx = createContext(config);
    expect(ctx.theme('colors.red.500')).toBe('#ff0000');
    expect(ctx.theme('colors.red.600')).toBe('#e00');
    expect(ctx.theme('spacing.4')).toBe('1rem');
    expect(ctx.theme('spacing.8')).toBe('2rem');
  });

  it('should support plugin/preset using context.theme for dynamic values', () => {
    const config = {
      theme: {
        colors: {
          primary: '#123456',
          secondary: '#123456',
        },
        spacing: (theme: ThemeGetter) => ({
          1: '0.25rem',
          2: theme('spacing.1'),
        }),
      },
    };
    const ctx = createContext(config);
    // 플러그인 스타일: context.theme('colors.secondary')가 동적으로 primary를 참조
    expect(ctx.theme('colors.secondary')).toBe('#123456');
    expect(ctx.theme('spacing.2')).toBe('0.25rem');
  });

  it('should return undefined for infinite recursion on same path', () => {
    const config = {
      theme: {
        spacing: (theme: ThemeGetter) => theme('spacing.1'),
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('spacing.1')).toBeUndefined();
  });

  it('should allow category function to reference another category', () => {
    const config = {
      theme: {
        colors: { primary: '#123456' },
        borderColor: (theme: ThemeGetter) => ({ main: theme('colors.primary') }),
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('borderColor.main')).toBe('#123456');
  });

  it('should ignore leaf function and return undefined', () => {
    const config = {
      theme: {
        spacing: { 1: () => 'should not call' },
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('spacing.1')).toBeUndefined();
  });

  it('should resolve deep path with category function', () => {
    const config = {
      theme: {
        fontSize: (theme: ThemeGetter) => ({
          lg: { value: '1.125rem', lineHeight: '1.75' },
        }),
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('fontSize.lg.value')).toBe('1.125rem');
    expect(ctx.theme('fontSize.lg.lineHeight')).toBe('1.75');
  });

  it('should allow multiple category functions referencing each other', () => {
    const config = {
      theme: {
        a: (theme: ThemeGetter) => ({ foo: theme('b.bar') }),
        b: (theme: ThemeGetter) => ({ bar: 42 }),
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('a.foo')).toBe(42);
    expect(ctx.theme('b.bar')).toBe(42);
  });

  it('should resolve static and dynamic values mixed', () => {
    const config = {
      theme: {
        spacing: (theme: ThemeGetter) => ({ 1: '0.25rem', 2: '0.5rem', 3: theme('spacing.2') }),
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('spacing.1')).toBe('0.25rem');
    expect(ctx.theme('spacing.2')).toBe('0.5rem');
    expect(ctx.theme('spacing.3')).toBe('0.5rem');
  });

  it('should handle category function returning falsy values', () => {
    const config = {
      theme: {
        spacing: (theme: ThemeGetter) => undefined,
        color: (theme: ThemeGetter) => null,
        border: (theme: ThemeGetter) => false,
        zIndex: (theme: ThemeGetter) => 0,
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('spacing.1')).toBeUndefined();
    expect(ctx.theme('color.red')).toBeUndefined();
    expect(ctx.theme('border.width')).toBeUndefined();
    expect(ctx.theme('zIndex.1')).toBeUndefined();
  });

  it('should handle category function returning an array', () => {
    const config = {
      theme: {
        steps: (theme: ThemeGetter) => ['step1', 'step2'],
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('steps.0')).toBe('step1');
    expect(ctx.theme('steps.1')).toBe('step2');
    expect(ctx.theme('steps.2')).toBeUndefined();
  });

  it('should allow multiple dynamic references in category function', () => {
    const config = {
      theme: {
        base: { a: 1, b: 2 },
        sum: (theme: ThemeGetter) => theme('base.a') + theme('base.b'),
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('sum')).toBe(3);
  });

  it('should allow indirect references unless true recursion', () => {
    const config = {
      theme: {
        a: (theme: ThemeGetter) => theme('b'),
        b: (theme: ThemeGetter) => 42,
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('a')).toBe(42);
  });

  it('should return undefined for dynamic reference to missing path', () => {
    const config = {
      theme: {
        spacing: (theme: ThemeGetter) => ({ 1: theme('spacing.999') }),
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('spacing.1')).toBeUndefined();
  });

  it('should support array path in dynamic reference', () => {
    const config = {
      theme: {
        colors: { red: { 500: '#f00' } },
        border: (theme: ThemeGetter) => ({ main: theme('colors', 'red', '500') }),
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('border.main')).toBe('#f00');
  });

  it('should support mixed string/number path segments', () => {
    const config = {
      theme: {
        spacing: { 1: '0.25rem' },
        test: (theme: ThemeGetter) => theme('spacing', 1),
      },
    };
    const ctx = createContext(config);
    expect(ctx.theme('test')).toBe('0.25rem');
  });
}); 