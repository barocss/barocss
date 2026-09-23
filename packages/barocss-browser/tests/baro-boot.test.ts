import { describe, expect, it } from 'vitest';
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
