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

  it('inserts styles into an iframe element supplied as the insertion point', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameBody = frame.contentDocument!.body;
    const frameRuntime = new BrowserRuntime({ insertionPoint: frameBody });

    try {
      frameRuntime.addClass('p-4');
      const styles = frameBody.querySelectorAll<HTMLStyleElement>('style[data-barocss="partition"]');
      const css = Array.from(styles, style => Array.from(style.sheet?.cssRules ?? [], rule => rule.cssText))
        .flat()
        .join('\n');
      expect(css).toContain('.p-4');
    } finally {
      frameRuntime.destroy();
      frame.remove();
    }
  });

  it('processes elements added to an observed iframe body', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameBody = frame.contentDocument!.body;
    const frameRuntime = new BrowserRuntime({ insertionPoint: frameBody });

    try {
      frameRuntime.observe(frameBody);
      const element = frame.contentDocument!.createElement('div');
      element.className = 'p-4';
      frameBody.append(element);
      await Promise.resolve();

      expect(frameRuntime.has('p-4')).toBe(true);
    } finally {
      frameRuntime.destroy();
      frame.remove();
    }
  });

  it('processes SVG classes added inside an observed iframe', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument!;
    const frameRuntime = new BrowserRuntime({ insertionPoint: frameDocument.body });

    try {
      frameRuntime.observe(frameDocument.body);
      const svg = frameDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'p-4');
      frameDocument.body.append(svg);
      await Promise.resolve();

      expect(frameRuntime.has('p-4')).toBe(true);
    } finally {
      frameRuntime.destroy();
      frame.remove();
    }
  });

  it('keeps generated CSS available through the cache API', () => {
    runtime.addClass('p-4 m-2');

    expect(runtime.has('p-4')).toBe(true);
    expect(runtime.getClasses()).toEqual(['p-4', 'm-2']);
    expect(runtime.getCss('p-4')).toContain('.p-4');
    expect(runtime.getAllCss()).toContain('.m-2');
  });

  it('includes shared root rules in all generated CSS', () => {
    runtime.addClass('translate-full -translate-full');

    const css = runtime.getAllCss();
    expect(css).toContain('.translate-full');
    expect(css).toContain('.-translate-full');
    expect(css.match(/@property --baro-translate-x/g)).toHaveLength(1);
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

  it('places layout rules in the layout style partition', () => {
    runtime.addClass('flex');

    expect(document.querySelector('[data-category="layout"]')).not.toBeNull();
  });

  it('restores a removed style partition when an existing class appears in the DOM', async () => {
    runtime.observe(document.body);
    runtime.addClass('p-4');
    document.querySelector('[data-category="spacing"]')?.remove();

    const element = document.createElement('div');
    element.className = 'p-4';
    document.body.append(element);
    await Promise.resolve();

    const style = document.querySelector<HTMLStyleElement>('[data-category="spacing"]');
    const css = Array.from(style?.sheet?.cssRules ?? [], rule => rule.cssText).join('\n');
    expect(css).toContain('.p-4');
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

  it('inserts layout rules before signaling readiness', () => {
    document.body.innerHTML = '<div class="flex p-4"></div>';
    const onReady = vi.fn(() => {
      expect(document.querySelector('[data-category="layout"]')).not.toBeNull();
      expect(document.querySelector('[data-category="spacing"]')).toBeNull();
    });

    runtime.observe(document.body, { scan: true, onReady });

    expect(onReady).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-category="spacing"]')).not.toBeNull();
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

  it('skips elements removed before their insertion is observed', async () => {
    runtime.observe(document.body);
    const element = document.createElement('div');
    element.className = 'p-4';
    document.body.append(element);
    element.remove();
    await Promise.resolve();

    expect(runtime.has('p-4')).toBe(false);
  });

  it('skips class changes on elements removed before observation runs', async () => {
    runtime.observe(document.body);
    const element = document.createElement('div');
    document.body.append(element);
    await Promise.resolve();

    element.className = 'm-2';
    element.remove();
    await Promise.resolve();

    expect(runtime.has('m-2')).toBe(false);
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
