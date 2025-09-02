/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import "../src/presets"
import { BrowserRuntime } from '../src/runtime/browser-runtime';

describe('BrowserRuntime', () => {
  let runtime: BrowserRuntime;

  beforeEach(() => {
    runtime = new BrowserRuntime({ 
      styleId: 'test-barocss-runtime'
    });
  });

  afterEach(() => {
    runtime.destroy();
  });

  it('creates style element and injects CSS', () => {
    runtime.addClass('bg-blue-500');
    expect(runtime.has('bg-blue-500')).toBe(true);
    expect(runtime.getCss('bg-blue-500')).toBeTruthy();
    expect(document.getElementById('test-barocss-runtime')).toBeTruthy();
  });

  it('handles multiple classes at once', () => {
    runtime.addClass(['bg-blue-500', 'text-lg']);
    expect(runtime.has('bg-blue-500')).toBe(true);
    expect(runtime.has('text-lg')).toBe(true);
    expect(runtime.getClasses()).toHaveLength(2);
  });

  it('does not duplicate CSS for already cached classes', () => {
    runtime.addClass('bg-blue-500');
    runtime.addClass('bg-blue-500');
    expect(runtime.getClasses()).toHaveLength(1);
  });

  it('removes classes from cache when removeClass is called', () => {
    runtime.addClass('bg-blue-500');
    expect(runtime.has('bg-blue-500')).toBe(true);
    runtime.removeClass('bg-blue-500');
    expect(runtime.has('bg-blue-500')).toBe(false);
  });

  it('resets all cached classes when reset is called', () => {
    runtime.addClass(['bg-blue-500', 'text-lg']);
    expect(runtime.getClasses()).toHaveLength(2);
    runtime.reset();
    expect(runtime.getClasses()).toHaveLength(0);
  });

  it('updates theme and regenerates CSS', () => {
    runtime.addClass('bg-blue-500');
    const originalCss = runtime.getCss('bg-blue-500');
    runtime.updateConfig({ theme: { colors: { blue: { 500: '#3b82f6' } } } });
    const newCss = runtime.getCss('bg-blue-500');
    expect(newCss).not.toBe(originalCss);
  });

  it('observe detects class changes and injects CSS', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500';
    
    // Use vi.waitFor for more reliable async testing
    await vi.waitFor(() => {
      expect(runtime.has('bg-blue-500')).toBe(true);
    }, { timeout: 1000 });
    
    expect(runtime.getCss('bg-blue-500')).toBeTruthy();
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('observe returns a MutationObserver and can be disconnected', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'text-green-500';
    
    await vi.waitFor(() => {
      expect(runtime.has('text-green-500')).toBe(true);
    }, { timeout: 1000 });
    
    observer.disconnect();
    div.className = 'text-yellow-500';
    
    // After disconnecting observer, new classes should not be cached
    await new Promise(r => setTimeout(r, 50));
    expect(runtime.has('text-yellow-500')).toBe(false);
    document.body.removeChild(div);
  });

  it('does not inject after style element is removed', () => {
    runtime.addClass('bg-red-500');
    runtime.destroy();
    runtime.addClass('bg-blue-500');
    expect(runtime.has('bg-blue-500')).toBe(false);
    expect(document.getElementById('test-barocss-runtime')).toBeNull();
  });

  it('observe injects CSS for multiple classes added at once', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500 text-lg';
    
    await vi.waitFor(() => {
      expect(runtime.has('bg-blue-500')).toBe(true);
      expect(runtime.has('text-lg')).toBe(true);
    }, { timeout: 1000 });
    
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('removing a class does not remove it from injected CSS', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500';
    
    await vi.waitFor(() => {
      expect(runtime.has('bg-blue-500')).toBe(true);
    }, { timeout: 1000 });
    
    div.className = '';
    await new Promise(r => setTimeout(r, 20));
    
    // BrowserRuntime does not remove CSS from DOM
    expect(runtime.getClasses()).toHaveLength(1);
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('toggling classes does not cause duplicate CSS injection', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500';
    
    await vi.waitFor(() => {
      expect(runtime.has('bg-blue-500')).toBe(true);
    }, { timeout: 1000 });
    
    div.className = '';
    await new Promise(r => setTimeout(r, 20));
    div.className = 'bg-blue-500';
    await new Promise(r => setTimeout(r, 20));
    
    // Only one CSS rule should exist for bg-blue-500
    expect(runtime.getClasses()).toHaveLength(1);
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('rapid consecutive className changes are all observed and injected', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500';
    
    await vi.waitFor(() => {
      expect(runtime.has('bg-blue-500')).toBe(true);
    }, { timeout: 1000 });
    
    div.className = 'text-lg';
    
    await vi.waitFor(() => {
      expect(runtime.has('text-lg')).toBe(true);
    }, { timeout: 1000 });
    
    div.className = 'bg-red-500';
    
    await vi.waitFor(() => {
      expect(runtime.has('bg-red-500')).toBe(true);
    }, { timeout: 1000 });
    
    expect(runtime.has('bg-blue-500')).toBe(true);
    expect(runtime.has('text-lg')).toBe(true);
    expect(runtime.has('bg-red-500')).toBe(true);
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('observer ignores non-class attribute mutations', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.setAttribute('id', 'foo');
    await new Promise(r => setTimeout(r, 10));
    
    // No CSS should be injected for id change
    expect(runtime.getClasses()).toHaveLength(0);
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('observer works with nested elements (delegation)', async () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);
    const observer = runtime.observe(document.body);
    child.className = 'bg-blue-500';
    await new Promise(r => setTimeout(r, 20));
    expect(runtime.has('bg-blue-500')).toBe(true);
    observer.disconnect();
    document.body.removeChild(parent);
  });

  it('observe with scan option injects CSS for pre-existing classes', async () => {
    const div1 = document.createElement('div');
    div1.className = 'bg-blue-500';
    const div2 = document.createElement('div');
    div2.className = 'text-lg';
    document.body.appendChild(div1);
    document.body.appendChild(div2);
    // observe with scan: true
    const observer = runtime.observe(document.body, { scan: true });
    // scan runs synchronously, so we can assert immediately
    expect(runtime.has('bg-blue-500')).toBe(true);
    expect(runtime.has('text-lg')).toBe(true);
    // Verify subsequent mutations are detected
    div1.className = 'bg-red-500';
    await new Promise(r => setTimeout(r, 20));
    expect(runtime.has('bg-red-500')).toBe(true);
    observer.disconnect();
    document.body.removeChild(div1);
    document.body.removeChild(div2);
  });

  it('scan option detects SVG element classes correctly', async () => {
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'w-4 h-4 text-blue-500');
    
    // Create a regular HTML element as well
    const div = document.createElement('div');
    div.className = 'bg-red-500 p-4';
    
    document.body.appendChild(svg);
    document.body.appendChild(div);
    
    // Start observe with scan: true
    const observer = runtime.observe(document.body, { scan: true });
    
    // Verify SVG classes are parsed correctly
    console.log('🔍 [TEST] SVG classes found:', svg.getAttribute('class'));
    console.log('🔍 [TEST] Runtime cached classes:', runtime.getClasses());
    console.log('🔍 [TEST] Runtime cache stats:', runtime.getCacheStats());
    
    // Verify SVG classes are cached
    expect(runtime.has('w-4')).toBe(true);
    expect(runtime.has('h-4')).toBe(true);
    expect(runtime.has('text-blue-500')).toBe(true);
    
    // Verify HTML element classes as well
    expect(runtime.has('bg-red-500')).toBe(true);
    expect(runtime.has('p-4')).toBe(true);
    
    observer.disconnect();
    document.body.removeChild(svg);
    document.body.removeChild(div);
  });

  it('SVG element class changes are detected and processed', async () => {
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'w-4 h-4');
    document.body.appendChild(svg);
    
    // Start observe (scan: false)
    const observer = runtime.observe(document.body, { scan: false });
    
    // Initially, there should be no classes
    expect(runtime.has('w-4')).toBe(false);
    expect(runtime.has('h-4')).toBe(false);
    
    // Change SVG classes
    svg.setAttribute('class', 'w-4 h-4 text-blue-500');
    
    // Wait for mutation detection
    await vi.waitFor(() => {
      expect(runtime.has('w-4')).toBe(true);
    }, { timeout: 1000 });
    
    await vi.waitFor(() => {
      expect(runtime.has('h-4')).toBe(true);
    }, { timeout: 1000 });
    
    await vi.waitFor(() => {
      expect(runtime.has('text-blue-500')).toBe(true);
    }, { timeout: 1000 });
    
    // Verify CSS is generated properly
    const w4Css = runtime.getCss('w-4');
    const h4Css = runtime.getCss('h-4');
    const textBlueCss = runtime.getCss('text-blue-500');
    
    console.log('🔍 [TEST] w-4 CSS:', w4Css);
    console.log('🔍 [TEST] h-4 CSS:', h4Css);
    console.log('🔍 [TEST] text-blue-500 CSS:', textBlueCss);
    
    expect(w4Css).toBeTruthy();
    expect(h4Css).toBeTruthy();
    expect(textBlueCss).toBeTruthy();
    
    observer.disconnect();
    document.body.removeChild(svg);
  });

  it('SVG and HTML elements with classes are all detected during scan', async () => {
    // Create SVG elements
    const svg1 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg1.setAttribute('class', 'w-4 h-4');
    
    const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg2.setAttribute('class', 'text-red-500');
    
    // Create HTML elements
    const div1 = document.createElement('div');
    div1.className = 'bg-blue-500 p-2';
    
    const div2 = document.createElement('div');
    div2.className = 'text-lg m-4';
    
    document.body.appendChild(svg1);
    document.body.appendChild(svg2);
    document.body.appendChild(div1);
    document.body.appendChild(div2);
    
    // Start observe with scan: true
    const observer = runtime.observe(document.body, { scan: true });
    
    // Verify all classes are detected correctly
    const expectedClasses = [
      'w-4', 'h-4', 'text-red-500',  // SVG classes
      'bg-blue-500', 'p-2', 'text-lg', 'm-4'  // HTML classes
    ];
    
    console.log('🔍 [TEST] Expected classes:', expectedClasses);
    console.log('🔍 [TEST] Actually cached classes:', runtime.getClasses());
    
    expectedClasses.forEach(className => {
      expect(runtime.has(className)).toBe(true);
      console.log(`✅ [TEST] ${className} is cached`);
    });
    
    observer.disconnect();
    document.body.removeChild(svg1);
    document.body.removeChild(svg2);
    document.body.removeChild(div1);
    document.body.removeChild(div2);
  });
}); 