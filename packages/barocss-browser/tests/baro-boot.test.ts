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
