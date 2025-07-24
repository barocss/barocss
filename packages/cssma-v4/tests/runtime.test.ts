/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StyleRuntime } from '../src/runtime';

describe('StyleRuntime', () => {
  let runtime: StyleRuntime;

  beforeEach(() => {
    // 각 테스트마다 fresh 인스턴스
    runtime = new StyleRuntime({ styleId: 'test-cssma-runtime' });
    document.getElementById('test-cssma-runtime')?.remove();
  });

  afterEach(() => {
    runtime.destroy();
    document.getElementById('test-cssma-runtime')?.remove();
  });

  it('adds a class and injects CSS', () => {
    runtime.addClass('bg-red-500');
    const styleEl = document.getElementById('test-cssma-runtime');
    expect(styleEl).toBeTruthy();
    expect(styleEl!.textContent).toContain('bg-red-500');
    expect(runtime.has('bg-red-500')).toBe(true);
    expect(runtime.getCss('bg-red-500')).toBeTruthy();
  });

  it('does not inject duplicate CSS for the same class', () => {
    runtime.addClass('bg-red-500');
    runtime.addClass('bg-red-500');
    expect(runtime.getAllCss().match(/bg-red-500/g)?.length).toBe(1);
  });

  it('reset clears all injected CSS and cache', () => {
    runtime.addClass('bg-red-500');
    runtime.reset();
    expect(runtime.getAllCss()).toBe('');
    expect(runtime.has('bg-red-500')).toBe(false);
  });

  it('removeClass removes from cache but not from DOM', () => {
    runtime.addClass('bg-red-500');
    runtime.removeClass('bg-red-500');
    expect(runtime.has('bg-red-500')).toBe(false);
    // DOM에는 남아있음
    const styleEl = document.getElementById('test-cssma-runtime');
    expect(styleEl!.textContent).toContain('bg-red-500');
  });

  it('destroy removes style element and clears cache', () => {
    runtime.addClass('bg-red-500');
    runtime.destroy();
    expect(document.getElementById('test-cssma-runtime')).toBeNull();
    expect(runtime.getAllCss()).toBe('');
  });

  it('getCss and getAllCss return correct CSS', () => {
    runtime.addClass('bg-red-500 text-lg');
    const css1 = runtime.getCss('bg-red-500');
    const css2 = runtime.getCss('text-lg');
    expect(css1).toBeTruthy();
    expect(css2).toBeTruthy();
    expect(runtime.getAllCss()).toContain(css1!);
    expect(runtime.getAllCss()).toContain(css2!);
  });

  it('observe injects CSS when class is added via DOM mutation', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500';
    // MutationObserver는 비동기이므로 약간의 대기 필요
    await new Promise(r => setTimeout(r, 10));
    expect(runtime.has('bg-blue-500')).toBe(true);
    expect(runtime.getCss('bg-blue-500')).toBeTruthy();
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('observe returns a MutationObserver and can be disconnected', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'text-green-500';
    await new Promise(r => setTimeout(r, 10));
    expect(runtime.has('text-green-500')).toBe(true);
    observer.disconnect();
    div.className = 'text-yellow-500';
    await new Promise(r => setTimeout(r, 10));
    // observer가 끊겼으므로 새로운 클래스는 캐시되지 않음
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
}); 