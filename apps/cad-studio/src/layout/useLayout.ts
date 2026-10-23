import { useCallback, useEffect, useRef, useState } from 'react';

/** The chat column's width range and default (CSS px), and its collapsed strip's. */
export const CHAT_MIN = 320, CHAT_MAX = 520, CHAT_DEFAULT = 360, CHAT_STRIP = 44;
/** The right dock's width (G12b), counted already when deciding what fits; and the centre's least width. */
export const DOCK_WIDTH = 300, DOCK_NARROW = 280, CENTRE_MIN = 560;

const WIDTH_KEY = 'studio.chatWidth', OPEN_KEY = 'studio.chatOpen';
const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };
const clampWidth = (w: number) => Math.min(CHAT_MAX, Math.max(CHAT_MIN, Math.round(w)));
/** Whether the chat column and the dock both fit beside the centre's least width. */
export const chatFits = (windowWidth: number, chatWidth: number) =>
  windowWidth >= chatWidth + (windowWidth >= 1280 ? DOCK_WIDTH : DOCK_NARROW) + CENTRE_MIN;

/**
 * The three columns' layout state (G12a): the chat column open or collapsed to its strip, and its width (dragged,
 * 320–520, kept per viewer). A window narrowed past what fits collapses the chat once; the person can open it again.
 */
export function useLayout() {
  const [chatOpen, setChatOpenState] = useState(() => read(OPEN_KEY) === '1');
  const [chatWidth, setChatWidthState] = useState(() => clampWidth(Number(read(WIDTH_KEY)) || CHAT_DEFAULT));
  const setChatOpen = useCallback((next: boolean | ((open: boolean) => boolean)) => setChatOpenState(open => {
    const v = typeof next === 'function' ? next(open) : next; write(OPEN_KEY, v ? '1' : '0'); return v;
  }), []);
  const setChatWidth = useCallback((w: number) => { const v = clampWidth(w); write(WIDTH_KEY, String(v)); setChatWidthState(v); }, []);
  // (Collapsed when the window narrows past what fits: on the crossing only, so an open made after it holds.)
  const fitted = useRef<boolean | null>(null);
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const check = () => {
      const fits = chatFits(window.innerWidth, chatWidth);
      if (fitted.current !== false && !fits) setChatOpenState(false);
      fitted.current = fits; setWindowWidth(window.innerWidth);
    };
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [chatWidth]);
  // (The width shown: what was dragged, less what the centre needs — never under the column's least width.)
  const chatShown = Math.min(chatWidth, Math.max(CHAT_MIN, windowWidth - CENTRE_MIN));
  // (G12b: the dock's width, and whether it is docked beside the centre or a strip with a sheet — the chat shown or not.)
  const dockWidth = windowWidth >= 1280 ? DOCK_WIDTH : DOCK_NARROW;
  const [dockSheet, setDockSheet] = useState(false);
  const dockDocked = (chatColumnWidth: number) => windowWidth - chatColumnWidth >= dockWidth + CENTRE_MIN;
  return { chatOpen, setChatOpen, chatWidth, chatShown, setChatWidth, windowWidth, dockWidth, dockDocked, dockSheet, setDockSheet };
}
