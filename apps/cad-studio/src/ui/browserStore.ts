// The browser's storage for what the model layer keeps between sessions (PKG-b, B4): the model asks for a store and the
// app hands it this one — the only place `localStorage` is reached for them. Unavailable storage (private mode, a
// blocked origin) reads as empty and writes nothing.
/** `localStorage`, guarded: null when the browser has none or refuses it. */
export function browserStore(): { getItem(key: string): string | null; setItem(key: string, value: string): void } | null {
  try { const s = globalThis.localStorage; s?.getItem(''); return s ?? null; } catch { return null; }
}
