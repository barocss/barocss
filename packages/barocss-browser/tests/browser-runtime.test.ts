import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/browser-runtime';

let runtime: BrowserRuntime;

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  runtime = new BrowserRuntime();
});

afterEach(() => {
  runtime.destroy();
  vi.restoreAllMocks();
});

describe('BrowserRuntime', () => {
  const hasInjectedRule = (fragment: string) => Array.from(document.querySelectorAll<HTMLStyleElement>('[data-barocss="partition"]'))
    .some(style => Array.from(style.sheet?.cssRules ?? []).some(rule => rule.cssText.includes(fragment)));

  it('keeps generated CSS available through the cache API', () => {
    runtime.addClass('p-4 m-2');

    expect(runtime.has('p-4')).toBe(true);
    expect(runtime.getClasses()).toEqual(['p-4', 'm-2']);
    expect(runtime.getCss('p-4')).toContain('.p-4');
    expect(runtime.getAllCss()).toContain('.m-2');
  });

  it('removes only requested CSS while preserving base styles and observation', async () => {
    runtime.updateConfig({ preflight: 'minimal' });
    runtime.observe(document.body);
    const element = document.createElement('div');
    element.className = 'p-4';
    document.body.append(element);
    await Promise.resolve();
    runtime.addClass('m-2');

    runtime.removeClass('p-4');

    expect(element.className).toBe('p-4');
    expect(runtime.has('p-4')).toBe(false);
    expect(runtime.has('m-2')).toBe(true);
    expect(hasInjectedRule('.p-4')).toBe(false);
    expect(hasInjectedRule('.m-2')).toBe(true);
    expect(document.querySelector('[data-category="preflight"]')?.textContent).toBeTruthy();
    expect(document.querySelector('[data-category="css-vars"]')?.textContent).toBeTruthy();

    const later = document.createElement('div');
    later.className = 'flex';
    document.body.append(later);
    await Promise.resolve();
    expect(runtime.has('flex')).toBe(true);

    runtime.addClass('p-4');
    expect(hasInjectedRule('.p-4')).toBe(true);
  });

  it('keeps shared root rules until the last dependent class is removed', () => {
    runtime.addClass('translate-full -translate-full');
    expect(hasInjectedRule('@property --baro-translate-x')).toBe(true);

    runtime.removeClass('translate-full');
    expect(hasInjectedRule('@property --baro-translate-x')).toBe(true);
    expect(hasInjectedRule('.-translate-full')).toBe(true);

    runtime.removeClass('-translate-full');
    expect(document.querySelector('[data-category="root"]')).toBeNull();
    expect(runtime.getCacheStats().runtime.rootCacheSize).toBe(0);
  });

  it('restores a detached style partition when another class is added', () => {
    runtime.updateConfig({ preflight: 'minimal' });
    runtime.addClass('p-4');
    document.querySelectorAll('[data-barocss="partition"]').forEach(style => style.remove());

    runtime.addClass('m-2');

    expect(hasInjectedRule('.p-4')).toBe(true);
    expect(hasInjectedRule('.m-2')).toBe(true);
    expect(document.querySelector('[data-category="preflight"]')?.textContent).toBeTruthy();
    expect(document.querySelector('[data-category="css-vars"]')?.textContent).toBeTruthy();
  });

  it('processes class changes and nested nodes after observation starts', async () => {
    runtime.observe(document.body, { scan: true });
    const element = document.createElement('div');
    element.innerHTML = '<span class="p-4"></span>';
    document.body.append(element);
    await Promise.resolve();

    expect(runtime.has('p-4')).toBe(true);

    element.className = 'm-2';
    await Promise.resolve();
    expect(runtime.has('m-2')).toBe(true);
  });

  it('signals readiness when the initial scan finds no classes', () => {
    const onReady = vi.fn();

    runtime.observe(document.body, { scan: true, onReady });

    expect(onReady).toHaveBeenCalledOnce();
  });

  it('processes classes changed while an element is detached', async () => {
    runtime.observe(document.body);
    const element = document.createElement('div');
    element.className = 'p-4';
    document.body.append(element);
    await Promise.resolve();

    element.remove();
    element.className = 'm-2';
    document.body.append(element);
    await Promise.resolve();

    expect(runtime.has('m-2')).toBe(true);
  });

  it('processes an SVG element added to the observed tree', async () => {
    runtime.observe(document.body);
    document.body.insertAdjacentHTML('beforeend', '<svg class="p-4"></svg>');
    await Promise.resolve();

    expect(runtime.has('p-4')).toBe(true);
  });

  it('regenerates existing classes and base styles after updateConfig', () => {
    runtime.observe(document.body);
    runtime.addClass('p-4');
    const originalVariables = document.querySelector('[data-category="css-vars"]')?.textContent;

    runtime.updateConfig({ theme: { spacing: { 1: '0.5rem' } }, preflight: 'minimal' });

    expect(runtime.has('p-4')).toBe(true);
    expect(runtime.getCss('p-4')).toContain('.p-4');
    expect(document.querySelector('[data-category="preflight"]')?.textContent).toBeTruthy();
    const variables = document.querySelector('[data-category="css-vars"]')?.textContent;
    expect(variables).not.toBe(originalVariables);
    expect(variables).toContain('0.5rem');
  });

  it('continues observing new classes after updateConfig', async () => {
    runtime.observe(document.body);
    runtime.updateConfig({ theme: { spacing: { 1: '0.5rem' } } });

    const element = document.createElement('div');
    element.className = 'm-2';
    document.body.append(element);
    await Promise.resolve();

    expect(runtime.has('m-2')).toBe(true);
    expect(runtime.getCss('m-2')).toContain('.m-2');
  });

  it('disconnects observation and removes styles on destroy', async () => {
    runtime.observe(document.body);
    runtime.destroy();
    runtime.clearCaches();
    const element = document.createElement('div');
    element.className = 'p-4';
    document.body.append(element);
    await Promise.resolve();

    expect(runtime.has('p-4')).toBe(false);
    expect(document.querySelector('[data-barocss="partition"]')).toBeNull();
  });

  it('can generate styles again after clearing caches', () => {
    runtime.addClass('p-4');
    runtime.clearCaches();
    runtime.addClass('m-2');

    expect(runtime.has('p-4')).toBe(false);
    expect(runtime.has('m-2')).toBe(true);
    expect(document.querySelector('[data-category="css-vars"]')).not.toBeNull();
  });

  it('clears only its own context cache', () => {
    const other = new BrowserRuntime({ styleId: 'other-runtime' });
    try {
      runtime.addClass('p-4');
      other.addClass('m-2');
      expect(runtime.getCacheStats().ast.size).toBeGreaterThan(0);
      expect(other.getCacheStats().ast.size).toBeGreaterThan(0);

      runtime.clearCaches();

      expect(runtime.getCacheStats().ast.size).toBe(0);
      expect(other.getCacheStats().ast.size).toBeGreaterThan(0);
    } finally {
      other.destroy();
    }
  });

  it('retries a failed class lookup after clearing its context cache', () => {
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unknownWarnings = () => warnings.mock.calls.filter(([message]) =>
      String(message).includes('Unknown utility class')).length;

    runtime.addClass('pulse-unknown-utility');
    runtime.addClass('pulse-unknown-utility');
    expect(unknownWarnings()).toBe(1);

    runtime.clearCaches();
    runtime.addClass('pulse-unknown-utility');
    expect(unknownWarnings()).toBe(2);
  });
});
