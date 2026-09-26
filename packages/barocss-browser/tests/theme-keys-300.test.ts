import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

// #300: new theme keys create utilities in the browser runtime; unknown keys stay absent (has() false, #213).
const theme = {
  extend: {
    borderRadius: { card: '1.25rem' },
    fontFamily: { display: ['Inter', 'sans-serif'] },
    boxShadow: { card: '0 2px 4px rgb(0 0 0 / 0.2)' },
    fontSize: { hero: ['4rem', { lineHeight: '1.1' }] },
  },
};

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

describe('#300 browser new theme keys', () => {
  it('generates new-key utilities and keeps unknown keys absent', () => {
    runtime = new BrowserRuntime({ config: { theme } as never });
    runtime.addClass(['rounded-card', 'font-display', 'shadow-card', 'text-hero', 'rounded-nope', 'font-nope']);
    expect(runtime.has('rounded-card')).toBe(true);
    expect(runtime.getCss('rounded-card')).toContain('var(--radius-card)');
    expect(runtime.getCss('font-display')).toContain('font-family: var(--font-display)');
    expect(runtime.getCss('shadow-card')).toContain('rgb(0 0 0 / 0.2)');
    expect(runtime.getCss('text-hero')).toContain('font-size: var(--text-hero)');
    expect(runtime.has('rounded-nope')).toBe(false);
    expect(runtime.has('font-nope')).toBe(false);
  });
});
