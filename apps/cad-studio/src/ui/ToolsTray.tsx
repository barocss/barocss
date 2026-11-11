// The top bar's right-hand tools (the coordinator's queue after O90): as many as the bar has room for, the rest — from
// the right — in a "More tools" menu, so a narrow window never clips a control or scrolls the page sideways. The
// shapes strip gives way first: the tray counts it at its least (its More button alone), so the tray folds only when
// even that leaves no room. The room is measured again whenever the bar or one of its children changes size.
import { cloneElement, isValidElement, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';
import { TemplatePicker } from './TemplatePicker';

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

type ToolProps = { hidden?: boolean; disabled?: boolean; 'aria-label'?: string; inOverflow?: boolean };

export function ToolsTray({ items }: { items: readonly ReactNode[] }) {
  const tools = items.filter((item): item is ReactElement<ToolProps> => isValidElement<ToolProps>(item) && !item.props.hidden);
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(tools.length), [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const tray = ref.current, bar = tray?.parentElement; if (!tray || !bar) return;
    const measure = () => setFit(fitting(tray, tools.length));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar); for (const el of Array.from(bar.children)) if (el !== tray) ro.observe(el);
    return () => ro.disconnect();
  }, [tools.length]);
  const rest = tools.slice(fit);
  return <div className="tools-tray" role="toolbar" aria-label="Tools bar" ref={ref}>
    {tools.slice(0, fit)}
    {rest.length > 0 && <span className="tools-more-anchor">
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <ToolIconButton state={open ? 'on' : 'idle'} aria-label="More tools" data-tip="More tools"
            data-tip-desc={`${rest.length} more`} onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') event.stopPropagation();
            }}>
            <Icon name="more_vert" />
          </ToolIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent portal={false} className="card tools-more min-w-0 p-2 has-[.templates]:overflow-visible"
          aria-label="More tools" align="end" loop onKeyDown={event => event.stopPropagation()}
          onEscapeKeyDown={event => event.stopPropagation()}>
          {rest.map(item => item.type === TemplatePicker ? cloneElement(item, { inOverflow: true })
            : <DropdownMenuItem key={item.key} asChild className="p-0" disabled={item.props.disabled} textValue={item.props['aria-label']}>
              {item}
            </DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>}
  </div>;
}
