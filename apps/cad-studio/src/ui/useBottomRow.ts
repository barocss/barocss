import { useEffect, useState, type RefObject } from 'react';

/** Where the history bar starts (CSS px from the window's left: past the browser panel), as styles.css's `.history`. */
export const HISTORY_LEFT = 270;
/** The history bar's least width beside the view bar; with less room it stacks above the view bar. */
export const HISTORY_MIN = 280;
/** The gaps: the view bar's right inset and the space between the two bars. */
const GAPS = 36;

export interface BottomRow { cornerWidth: number; cornerHeight: number; stacked: boolean }

/**
 * The bottom row's layout: the view bar's measured size (the corner-right row: Display, the views, Pick all, Snap, units),
 * and whether the history bar still fits beside it or stacks above it. The history bar used to assume the view bar was
 * 600 px wide; as it grew (Analyse, Maps …) the two overlapped at 1280 px. The App sets these as CSS variables and a class.
 */
export function useBottomRow(corner: RefObject<HTMLElement | null>): BottomRow {
  const [row, setRow] = useState<BottomRow>({ cornerWidth: 600, cornerHeight: 32, stacked: false });
  useEffect(() => {
    const el = corner.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect(), cornerWidth = Math.ceil(r.width), cornerHeight = Math.ceil(r.height);
      const stacked = window.innerWidth - HISTORY_LEFT - cornerWidth - GAPS < HISTORY_MIN;
      setRow(b => b.cornerWidth === cornerWidth && b.cornerHeight === cornerHeight && b.stacked === stacked ? b : { cornerWidth, cornerHeight, stacked });
    };
    const observer = new ResizeObserver(update);
    observer.observe(el); window.addEventListener('resize', update); update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [corner]);
  return row;
}
