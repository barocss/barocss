import { describe, expect, it, vi } from 'vitest';
import { baroBoot, getRuntime } from '../src/baro-boot';

describe('getRuntime', () => {
  it('creates a usable runtime after the previous one is destroyed', () => {
    const first = getRuntime({});
    first.destroy();

    const second = getRuntime({});
    try {
      expect(second).not.toBe(first);
      expect(second.getStats().isDestroyed).toBe(false);
      second.addClass('p-4');
      expect(second.has('p-4')).toBe(true);
    } finally {
      second.destroy();
    }
  });
});

describe('baroBoot', () => {
  it('clears the loading marker when observation fails', () => {
    const runtime = getRuntime({});
    const observe = vi.spyOn(runtime, 'observe').mockImplementation(() => { throw new Error('observe failed'); });
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      baroBoot();
      expect(document.body.classList.contains('baro-boot-doing')).toBe(false);
      expect(logError).toHaveBeenCalled();
    } finally {
      observe.mockRestore();
      logError.mockRestore();
      runtime.destroy();
    }
  });

  it('starts after the body becomes available', () => {
    const originalBody = document.body;
    originalBody.remove();

    try {
      baroBoot();
      const body = document.createElement('body');
      body.innerHTML = '<div class="p-4"></div>';
      document.documentElement.append(body);
      document.dispatchEvent(new Event('DOMContentLoaded'));

      expect(body.classList.contains('baro-boot-done')).toBe(true);
      expect(getRuntime({}).has('p-4')).toBe(true);
    } finally {
      getRuntime({}).destroy();
      document.body?.remove();
      document.documentElement.append(originalBody);
    }
  });
});

describe('config with a shared runtime (#214)', () => {
  const config = { theme: { extend: { colors: { brand: '#123456' } } } };

  it('applies config when getRuntime() ran before baroStart({ config })', () => {
    const early = getRuntime();
    try {
      baroBoot({ config });
      const runtime = getRuntime();
      expect(runtime).toBe(early);
      runtime.addClass('bg-brand');
      expect(runtime.getCss('bg-brand')).toContain('#123456');
    } finally {
      getRuntime().destroy();
    }
  });

  it('keeps config when baroStart({ config }) runs before getRuntime()', () => {
    try {
      baroBoot({ config });
      const runtime = getRuntime();
      runtime.addClass('bg-brand');
      expect(runtime.getCss('bg-brand')).toContain('#123456');
    } finally {
      getRuntime().destroy();
    }
  });
});
