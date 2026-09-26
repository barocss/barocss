import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRuntime } from '../src/baro-boot';

// #356: a later getRuntime with a different nonce/constructable keeps the existing runtime and warns once.
describe('getRuntime option mismatch warning (#356)', () => {
  afterEach(() => { getRuntime().destroy(); vi.restoreAllMocks(); });

  it('warns once when a later call asks for a different nonce', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const rt = getRuntime({});
    expect(getRuntime({ nonce: 'abc' })).toBe(rt);
    getRuntime({ nonce: 'xyz' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/nonce/);
  });

  it('warns once when a later call asks for a different constructable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getRuntime({});
    getRuntime({ constructable: true });
    getRuntime({ constructable: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/constructable/);
  });

  it('does not warn when values match or are omitted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getRuntime({ nonce: 'abc', constructable: false });
    getRuntime({ nonce: 'abc' });
    getRuntime({ constructable: false });
    getRuntime({});
    getRuntime();
    expect(warn).not.toHaveBeenCalled();
  });
});
