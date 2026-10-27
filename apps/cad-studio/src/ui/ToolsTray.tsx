// The top bar's right-hand tools (the coordinator's queue after O90): as many as the bar has room for, the rest — from
// the right — in a "More tools" menu, so a narrow window never clips a control or scrolls the page sideways. The
// shapes strip gives way first: the tray counts it at its least (its More button alone), so the tray folds only when
// even that leaves no room. The room is measured again whenever the bar or one of its children changes size.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';

/** A tool's width (the tray adds its own gap between them, the bar's spacing). */
const TOOL = 30, SHAPE = 31;

/** How many tools fit beside the bar's other children (the shapes strip at its least), with a More button when not all do. */
function fitting(tray: HTMLElement, count: number): number {
  const bar = tray.parentElement; if (!bar) return count;
  const cs = getComputedStyle(bar), gap = parseFloat(cs.columnGap) || 0, pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  let others = 0, shown = 0;
  for (const el of Array.from(bar.children)) {
    if (getComputedStyle(el).display === 'none') continue;
    shown++;
    if (el === tray || el.classList.contains('grow')) continue;
    if (el.classList.contains('shapes')) { const s = getComputedStyle(el); others += SHAPE + (parseFloat(s.paddingLeft) || 0) + (parseFloat(s.marginLeft) || 0) + (parseFloat(s.borderLeftWidth) || 0); continue; }
    others += el.getBoundingClientRect().width;
  }
  const room = bar.clientWidth - pad - others - gap * (shown - 1), own = parseFloat(getComputedStyle(tray).columnGap) || 0;
  const all = Math.floor((room + own) / (TOOL + own));
  return all >= count ? count : Math.max(0, all - 1);
}

export function ToolsTray({ items }: { items: readonly ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(items.length), [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const tray = ref.current, bar = tray?.parentElement; if (!tray || !bar) return;
    const measure = () => setFit(fitting(tray, items.length));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar); for (const el of Array.from(bar.children)) if (el !== tray) ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);
  const rest = items.slice(fit);
  return <div className="tools-tray" role="toolbar" aria-label="Tools bar" ref={ref}>
    {items.slice(0, fit)}
    {rest.length > 0 && <span className="tools-more-anchor">
      {/* (G12f: shadcn's DropdownMenu, in place — Radix's dismissal: a click outside, Escape; a pick closes it, but Templates, whose own menu opens inside it.) */}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild><ToolIconButton state={open ? 'on' : 'idle'} aria-label="More tools" data-tip="More tools" data-tip-desc={`${rest.length} more`}><Icon name="more_vert" /></ToolIconButton></DropdownMenuTrigger>
        <DropdownMenuContent portal={false} className="card tools-more min-w-0 p-2" aria-label="More tools" align="end" onClick={e => { if (!(e.target as HTMLElement).closest('.tpl-anchor')) setOpen(false); }}>{rest}</DropdownMenuContent>
      </DropdownMenu>
    </span>}
  </div>;
}
