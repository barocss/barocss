import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContext, generateCss, parseClassToAst, setDebug } from '../src';

const kitMessages = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter(([m]) => /\[(generateCss|astToCss|BAROCSS)\]/.test(String(m))).length;

describe('kit console diagnostics', () => {
  afterEach(() => {
    setDebug(false);
    vi.restoreAllMocks();
  });

  it('logs nothing by default for unknown or invalid classes', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const ctx = createContext({});
    parseClassToAst('definitely-unknown-utility', ctx);
    generateCss('definitely-unknown-utility hover:nope-xyz', ctx);
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('restores logging with the debug config flag', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = createContext({ debug: true });
    parseClassToAst('definitely-unknown-utility', ctx);
    expect(kitMessages(warn)).toBeGreaterThan(0);
  });

  it('restores logging with setDebug()', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = createContext({});
    setDebug(true);
    generateCss('definitely-unknown-utility', ctx);
    expect(kitMessages(warn)).toBeGreaterThan(0);
  });
});
