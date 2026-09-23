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
  it('keeps generated CSS available through the cache API', () => {
    runtime.addClass('p-4 m-2');

    expect(runtime.has('p-4')).toBe(true);
    expect(runtime.getClasses()).toEqual(['p-4', 'm-2']);
    expect(runtime.getCss('p-4')).toContain('.p-4');
    expect(runtime.getAllCss()).toContain('.m-2');
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
});
