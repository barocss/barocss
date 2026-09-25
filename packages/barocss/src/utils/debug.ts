/**
 * Kit diagnostics are silent by default so untrusted runtime class names
 * cannot spam the console. Enable with `setDebug(true)` or `debug: true`
 * in the config passed to `createContext`.
 */
let debugEnabled = false;

export function setDebug(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebug(): boolean {
  return debugEnabled;
}

export function debugLog(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  if (debugEnabled) console.log(...args);
}

export function debugWarn(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  if (debugEnabled) console.warn(...args);
}
