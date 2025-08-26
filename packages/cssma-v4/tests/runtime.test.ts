/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import "../src/presets"
import { StyleRuntime } from '../src/runtime/browser-runtime';

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
    runtime.updateConfig({ theme: { colors: { blue: { 500: '#3b82f6' } } } });
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

  it('scan option detects SVG element classes correctly', async () => {
    // SVG 요소 생성
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'w-4 h-4 text-blue-500');
    
    // 일반 HTML 요소도 함께 생성
    const div = document.createElement('div');
    div.className = 'bg-red-500 p-4';
    
    document.body.appendChild(svg);
    document.body.appendChild(div);
    
    // scan: true로 observe 시작
    const observer = runtime.observe(document.body, { scan: true });
    
    // SVG 클래스들이 제대로 파싱되었는지 확인
    console.log('🔍 [TEST] SVG classes found:', svg.getAttribute('class'));
    console.log('🔍 [TEST] Runtime cached classes:', runtime.getClasses());
    console.log('🔍 [TEST] Runtime cache stats:', runtime.getCacheStats());
    
    // SVG 클래스들이 캐시되었는지 확인
    expect(runtime.has('w-4')).toBe(true);
    expect(runtime.has('h-4')).toBe(true);
    expect(runtime.has('text-blue-500')).toBe(true);
    
    // HTML 요소 클래스들도 확인
    expect(runtime.has('bg-red-500')).toBe(true);
    expect(runtime.has('p-4')).toBe(true);
    
    observer.disconnect();
    document.body.removeChild(svg);
    document.body.removeChild(div);
  });

  it('SVG element class changes are detected and processed', async () => {
    // SVG 요소 생성
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'w-4 h-4');
    document.body.appendChild(svg);
    
    // observe 시작 (scan: false로 시작)
    const observer = runtime.observe(document.body, { scan: false });
    
    // 초기에는 클래스가 없어야 함
    expect(runtime.has('w-4')).toBe(false);
    expect(runtime.has('h-4')).toBe(false);
    
    // SVG 클래스 변경
    svg.setAttribute('class', 'w-4 h-4 text-blue-500');
    
    // 변경 감지 대기
    await vi.waitFor(() => {
      expect(runtime.has('w-4')).toBe(true);
    }, { timeout: 1000 });
    
    await vi.waitFor(() => {
      expect(runtime.has('h-4')).toBe(true);
    }, { timeout: 1000 });
    
    await vi.waitFor(() => {
      expect(runtime.has('text-blue-500')).toBe(true);
    }, { timeout: 1000 });
    
    // CSS가 제대로 생성되었는지 확인
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
    // SVG 요소들 생성
    const svg1 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg1.setAttribute('class', 'w-4 h-4');
    
    const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg2.setAttribute('class', 'text-red-500');
    
    // HTML 요소들 생성
    const div1 = document.createElement('div');
    div1.className = 'bg-blue-500 p-2';
    
    const div2 = document.createElement('div');
    div2.className = 'text-lg m-4';
    
    document.body.appendChild(svg1);
    document.body.appendChild(svg2);
    document.body.appendChild(div1);
    document.body.appendChild(div2);
    
    // scan: true로 observe 시작
    const observer = runtime.observe(document.body, { scan: true });
    
    // 모든 클래스들이 제대로 감지되었는지 확인
    const expectedClasses = [
      'w-4', 'h-4', 'text-red-500',  // SVG 클래스들
      'bg-blue-500', 'p-2', 'text-lg', 'm-4'  // HTML 클래스들
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