import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

// #287: config.utilities reaches the browser runtime; custom utilities resolve and are cached like any class.
const utilities = { 'max-w-app': { 'max-width': '72rem', 'margin-inline': 'auto' }, 'active-nav': { 'text-decoration-line': 'underline' } };

let runtime: BrowserRuntime | undefined;
beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { runtime?.destroy(); runtime = undefined; vi.restoreAllMocks(); });

describe('#287 browser custom utilities', () => {
  it('generates and reports custom utilities from config', () => {
    runtime = new BrowserRuntime({ config: { utilities } });
    runtime.addClass(['max-w-app', 'md:max-w-app', 'hover:active-nav']);
    expect(runtime.has('max-w-app')).toBe(true);
    expect(runtime.getCss('max-w-app')).toContain('max-width: 72rem');
    expect(runtime.getCss('md:max-w-app')).toContain('48rem');
    expect(runtime.getCss('hover:active-nav')).toContain(':hover');
  });
  it('is absent without the option', () => {
    runtime = new BrowserRuntime();
    runtime.addClass('max-w-app');
    expect(runtime.getCss('max-w-app') ?? '').not.toContain('72rem');
  });
});
