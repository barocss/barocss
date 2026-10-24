// The top bar's shapes strip: as many shape buttons as the bar has room for beside its other controls, the rest in a
// "More shapes" menu — so the bar is never wider than the window (no sideways page scroll), however many placed commands
// there are or however narrow the window. The room is the bar's width less its other children (the two `.grow` spacers
// left out: they take what is left), measured again whenever the bar or one of them changes size.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';

/** A 30 px tool and its 1 px gap. */
const BUTTON = 31;

/** How many buttons fit the room beside the bar's other children (with a More button when not all do). */
function fitting(strip: HTMLElement, count: number): number {
  const bar = strip.parentElement; if (!bar) return count;
  const cs = getComputedStyle(bar), own = getComputedStyle(strip);
  const gap = parseFloat(cs.columnGap) || 0, pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const edge = (parseFloat(own.paddingLeft) || 0) + (parseFloat(own.marginLeft) || 0) + (parseFloat(own.borderLeftWidth) || 0);
  // (Only the children laid out take a gap: a hidden one — `hidden`, display none — takes none.)
  let others = 0, shown = 0;
  for (const el of Array.from(bar.children)) {
    if (getComputedStyle(el).display === 'none') continue;
    shown++; if (el !== strip && !el.classList.contains('grow')) others += el.getBoundingClientRect().width;
  }
  const room = bar.clientWidth - pad - others - gap * (shown - 1) - edge + 1;
  const all = Math.floor(room / BUTTON);
  return all >= count ? count : Math.max(0, all - 1);
}

export function ShapesStrip({ buttons }: { buttons: readonly ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(buttons.length), [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const strip = ref.current, bar = strip?.parentElement; if (!strip || !bar) return;
    const measure = () => setFit(fitting(strip, buttons.length));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar); for (const el of Array.from(bar.children)) if (el !== strip) ro.observe(el);
    return () => ro.disconnect();
  }, [buttons.length]);
  const rest = buttons.slice(fit);
  return <div className="shapes" role="toolbar" aria-label="Shapes" ref={ref}>
    {buttons.slice(0, fit)}
    {rest.length > 0 && <span className="shapes-more-anchor">
      {/* (G12f: shadcn's DropdownMenu, in place — Radix's dismissal: a click outside, Escape; a pick closes it.) */}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild><ToolIconButton state={open ? 'on' : 'idle'} aria-label="More shapes" data-tip="More shapes" data-tip-desc={`${rest.length} more`}><Icon name="more_horiz" /></ToolIconButton></DropdownMenuTrigger>
        <DropdownMenuContent portal={false} className="card shapes-more min-w-0 p-1.5" aria-label="More shapes" align="end" onClick={() => setOpen(false)}>{rest}</DropdownMenuContent>
      </DropdownMenu>
    </span>}
  </div>;
}
