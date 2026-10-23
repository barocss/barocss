import { useEffect, useState, type RefObject } from 'react';

/** Where the history bar starts (CSS px from the stage's left), as styles.css's `--history-left`: past the browser panel
 * when it is at the left, else past the tools rail (G12d: the Browser in the dock). */
export const HISTORY_LEFT = 270, HISTORY_LEFT_RAIL = 72;
/** The history bar's least width beside the view bar; with less room it stacks above the view bar. */
export const HISTORY_MIN = 280;
/** The least room for the stacked bar; with less — an open dock sheet over a narrow centre — the stage is cramped: the bar and
 * the view cube hide until the sheet closes. */
export const HISTORY_LEAST = 160;
/** The gaps: the view bar's right inset and the space between the two bars. */
const GAPS = 36;

export interface BottomRow { stacked: boolean; cramped: boolean }

/**
 * The bottom row's layout: the view bar's measured size (the corner-right row: Display, the views, Pick all, Snap, units),
 * and whether the history bar still fits beside it or stacks above it. The history bar used to assume the view bar was
 * 600 px wide; as it grew (Analyse, Maps …) the two overlapped at 1280 px. The size goes onto the studio element as CSS
 * variables (--corner-w, --corner-h) here, outside React: a label in the bar that changes as it is dragged (Explode ×0.03 …)
 * resizes it each frame, and the App renders only when the stacking changes (G12d, R1). The App sets the classes.
 */
/** `strip`: the strips and the dock's open sheet over the stage's edges (G12a/b); `left`: where the bar starts; `natural`:
 * the history bar's width with every step shown — it stacks when that does not fit beside the view bar (G12e). */
export function useBottomRow(corner: RefObject<HTMLElement | null>, strip = 0, left = HISTORY_LEFT, natural = 0): BottomRow {
  const [row, setRow] = useState<BottomRow>({ stacked: false, cramped: false });
  useEffect(() => {
    const el = corner.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect(), cornerWidth = Math.ceil(r.width), cornerHeight = Math.ceil(r.height);
      const studio = el.closest<HTMLElement>('.studio');
      studio?.style.setProperty('--corner-w', cornerWidth + 'px'); studio?.style.setProperty('--corner-h', cornerHeight + 'px');
      // (The stage's width — the centre column's, G12a — not the window's.)
      const stage = (el.offsetParent as HTMLElement | null)?.clientWidth ?? window.innerWidth;
      const stacked = stage - strip - left - cornerWidth - GAPS < Math.max(HISTORY_MIN, natural), cramped = stage - strip - left - 12 < HISTORY_LEAST;
      setRow(b => b.stacked === stacked && b.cramped === cramped ? b : { stacked, cramped });
    };
    const observer = new ResizeObserver(update);
    observer.observe(el); if (el.offsetParent) observer.observe(el.offsetParent); window.addEventListener('resize', update); update();
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [corner, strip, left, natural]);
  return row;
}
