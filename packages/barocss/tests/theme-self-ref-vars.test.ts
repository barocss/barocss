import { describe, expect, it } from 'vitest';
import '../src/presets';
import { createContext } from '../src/core/context';
import { isSelfReferencingVar, toCssVarsBlock } from '../src/core/cssVars';
import { generateCss } from '../src/core/engine';

describe('self-referencing theme root vars (#260)', () => {
  it('detects var(<same name>) with optional fallback and whitespace', () => {
    expect(isSelfReferencingVar('--color-brand-600', 'var(--color-brand-600)')).toBe(true);
    expect(isSelfReferencingVar('--color-brand-600', '  var( --color-brand-600 , #123 ) ')).toBe(true);
    expect(isSelfReferencingVar('--color-brand-600', 'var(--color-brand-700)')).toBe(false);
    expect(isSelfReferencingVar('--color-brand-600', '#ff0000')).toBe(false);
    expect(isSelfReferencingVar('--x', 3 as unknown as string)).toBe(false);
  });

  it('skips cyclic root vars but keeps normal values', () => {
    expect(toCssVarsBlock({ '--a': 'var(--a)', '--b': 'red' })).not.toContain('--a:');
    const ctx = createContext({
      theme: {
        extend: {
          colors: { brand: { 600: 'var(--color-brand-600)', 700: 'var(--color-brand-700, #111)', 800: '#222' } },
          borderRadius: { card: 'var(--radius-card)' },
          fontFamily: { display: 'var(--font-display)' },
          spacing: { gutter: 'var(--spacing-gutter)' },
        },
      },
    });
    const root = ctx.themeToCssVars();
    expect(root).not.toMatch(/--color-brand-600:/);
    expect(root).not.toMatch(/--color-brand-700:/);
    expect(root).toContain('--color-brand-800: #222;');
    expect(root).not.toMatch(/--radius-card:/);
    expect(root).not.toMatch(/--font-display:/);
    expect(root).not.toMatch(/--spacing-gutter:/);
    expect(root).toMatch(/--color-red-500:/);
    expect(generateCss('bg-brand-600', ctx)).toContain('var(--color-brand-600)');
  });
});
