/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import "../src/presets"
import { StyleRuntime } from '../src/runtime';

describe('StyleRuntime', () => {
  let runtime: StyleRuntime;

  beforeEach(() => {
    runtime = new StyleRuntime({ 
      styleId: 'test-cssma-runtime',
      enableDev: false 
    });
  });

  afterEach(() => {
    runtime.destroy();
  });

  it('creates style element and injects CSS', () => {
    runtime.addClass('bg-blue-500');
    expect(runtime.has('bg-blue-500')).toBe(true);
    expect(runtime.getCss('bg-blue-500')).toBeTruthy();
    expect(document.getElementById('test-cssma-runtime')).toBeTruthy();
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
    runtime.updateTheme({ colors: { blue: { 500: '#3b82f6' } } });
    const newCss = runtime.getCss('bg-blue-500');
    expect(newCss).not.toBe(originalCss);
  });

  it('observe detects class changes and injects CSS', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500';
    
    // vi.waitFor를 사용하여 더 안정적인 비동기 테스트
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
    
    // observer가 끊겼으므로 새로운 클래스는 캐시되지 않음
    await new Promise(r => setTimeout(r, 50));
    expect(runtime.has('text-yellow-500')).toBe(false);
    document.body.removeChild(div);
  });

  it('does not inject after style element is removed', () => {
    runtime.addClass('bg-red-500');
    runtime.destroy();
    runtime.addClass('bg-blue-500');
    expect(runtime.has('bg-blue-500')).toBe(false);
    expect(document.getElementById('test-cssma-runtime')).toBeNull();
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
    
    // StyleRuntime does not remove CSS from DOM
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
    // scan은 동기적으로 동작하므로 바로 확인 가능
    expect(runtime.has('bg-blue-500')).toBe(true);
    expect(runtime.has('text-lg')).toBe(true);
    // 이후 mutation도 정상 감지되는지 확인
    div1.className = 'bg-red-500';
    await new Promise(r => setTimeout(r, 20));
    expect(runtime.has('bg-red-500')).toBe(true);
    observer.disconnect();
    document.body.removeChild(div1);
    document.body.removeChild(div2);
  });
}); 