import { useLayoutEffect, useState, type DependencyList, type RefObject } from 'react';

/** The room kept for the "+n" chip and its gap (CSS px). */
const MORE_W = 48;

/**
 * Whole chips only in a bar of `.hs` chips (G12e, the history bar): the chips past its room are hidden, never cut
 * mid-text; returns how many, for a "+n" chip, and the bar's width with every chip shown (`natural`: the bottom row stacks
 * the bar above the view bar when it does not fit beside it). What follows the chips (the rollback marker, its note) keeps its place.
 * `expanded`: all shown (the bar wraps). The chips are hidden by their style, outside React, measured again when the bar,
 * the stage or the view bar beside it resizes, and on `deps` — the bar stacked above the view bar is one, its own size not
 * changing while chips are hidden; the App renders only when the count changes.
 */
export function useFitChips(bar: RefObject<HTMLElement | null>, expanded: boolean, deps: DependencyList): { hidden: number; natural: number } {
  const [fitted, setFitted] = useState({ hidden: 0, natural: 0 });
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const fit = () => {
      const chips = [...el.querySelectorAll<HTMLElement>(':scope > .hs')];
      for (const c of chips) c.style.display = '';
      el.scrollLeft = 0;
      const natural = el.scrollWidth + 2;
      let n = 0;
      if (!expanded && chips.length && el.scrollWidth > el.clientWidth + 0.5) {
        const style = getComputedStyle(el), gap = parseFloat(style.columnGap) || 0;
        // (What follows the last chip — the marker, the note, not the "+n" chip — and the "+n" chip's room.)
        let trailing = MORE_W;
        for (let x = chips[chips.length - 1].nextElementSibling as HTMLElement | null; x; x = x.nextElementSibling as HTMLElement | null)
          if (!x.classList.contains('hs-more')) trailing += x.offsetWidth + gap;
        const limit = el.clientWidth - (parseFloat(style.paddingRight) || 0) - trailing;
        for (const c of chips) if (c.offsetLeft + c.offsetWidth > limit) { c.style.display = 'none'; n++; }
      }
      setFitted(f => f.hidden === n && Math.abs(f.natural - natural) < 1 ? f : { hidden: n, natural });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    if (el.offsetParent) observer.observe(el.offsetParent);
    const corner = el.parentElement?.querySelector('.corner-right');
    if (corner) observer.observe(corner);
    return () => observer.disconnect();
  }, [bar, expanded, ...deps]);
  return fitted;
}
