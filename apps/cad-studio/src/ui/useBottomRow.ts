import { useEffect, useState, type RefObject } from 'react';

/** Where the history bar starts (CSS px from the stage's left: past the browser panel), as styles.css's `.history`. */
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
/** `strip`: the chat column's strip over the stage's left edge (0 when the column shows), G12a. */
export function useBottomRow(corner: RefObject<HTMLElement | null>, strip = 0): BottomRow {
  const [row, setRow] = useState<BottomRow>({ cornerWidth: 600, cornerHeight: 32, stacked: false });
  useEffect(() => {
    const el = corner.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect(), cornerWidth = Math.ceil(r.width), cornerHeight = Math.ceil(r.height);
      // (The stage's width — the centre column's, G12a — not the window's.)
      const stage = (el.offsetParent as HTMLElement | null)?.clientWidth ?? window.innerWidth;
      const stacked = stage - strip - HISTORY_LEFT - cornerWidth - GAPS < HISTORY_MIN;
      setRow(b => b.cornerWidth === cornerWidth && b.cornerHeight === cornerHeight && b.stacked === stacked ? b : { cornerWidth, cornerHeight, stacked });
    };
    const observer = new ResizeObserver(update);
    observer.observe(el); if (el.offsetParent) observer.observe(el.offsetParent); window.addEventListener('resize', update); update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [corner, strip]);
  return row;
}
