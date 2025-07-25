/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import "../src/presets"
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
    expect(runtime.getClasses().length).toBe(1);
    expect(runtime.has('bg-red-500')).toBe(true);
    expect(runtime.getCss('bg-red-500')).toBeTruthy();
  });

  it('does not inject duplicate CSS for the same class', () => {
    runtime.addClass('bg-red-500');
    runtime.addClass('bg-red-500');
    expect(runtime.getClasses().length).toBe(1);
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
    expect(runtime.getClasses().length).toBe(0);
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

  it('observe injects CSS for multiple classes added at once', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500 text-lg';
    await new Promise(r => setTimeout(r, 10));
    expect(runtime.has('bg-blue-500')).toBe(true);
    expect(runtime.has('text-lg')).toBe(true);
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('removing a class does not remove it from injected CSS', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500';
    await new Promise(r => setTimeout(r, 10));
    expect(runtime.has('bg-blue-500')).toBe(true);
    div.className = '';
    await new Promise(r => setTimeout(r, 10));
    // StyleRuntime does not remove CSS from DOM
    expect(runtime.getClasses().length).toBe(1);
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('toggling classes does not cause duplicate CSS injection', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500';
    await new Promise(r => setTimeout(r, 20));
    div.className = '';
    await new Promise(r => setTimeout(r, 20));
    div.className = 'bg-blue-500';
    await new Promise(r => setTimeout(r, 20));
    // Only one CSS rule should exist for bg-blue-500
    expect(runtime.getClasses().length).toBe(1);
    observer.disconnect();
    document.body.removeChild(div);
  });

  it('rapid consecutive className changes are all observed and injected', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const observer = runtime.observe(document.body);
    div.className = 'bg-blue-500';
    await new Promise(r => setTimeout(r, 20));
    div.className = 'text-lg';
    await new Promise(r => setTimeout(r, 20));
    div.className = 'bg-red-500';
    await new Promise(r => setTimeout(r, 20));
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
    expect(runtime.getAllCss()).toBe('');
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
    await new Promise(r => setTimeout(r, 10));
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
    await new Promise(r => setTimeout(r, 10));
    expect(runtime.has('bg-red-500')).toBe(true);
    observer.disconnect();
    document.body.removeChild(div1);
    document.body.removeChild(div2);
  });
}); 