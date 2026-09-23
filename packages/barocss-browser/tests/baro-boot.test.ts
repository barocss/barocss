import { describe, expect, it } from 'vitest';
import { getRuntime } from '../src/baro-boot';

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
