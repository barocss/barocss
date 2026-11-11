// Keep as many tools inline as the top bar can fit, with one slot for More tools when needed.
import { cloneElement, isValidElement, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';
import { TemplatePicker } from './TemplatePicker';

const px = (value: string) => Number.parseFloat(value) || 0;

function fitting(tray: HTMLElement, count: number): number {
  const bar = tray.parentElement;
  // The inline tools and the overflow trigger use the same ToolIconButton size.
  const slot = tray.querySelector('button.tool')?.getBoundingClientRect().width;
  if (!bar || !slot) return count;
  const style = getComputedStyle(bar);
  let room = bar.getBoundingClientRect().width - px(style.paddingLeft) - px(style.paddingRight)
    - px(style.borderLeftWidth) - px(style.borderRightWidth);
  let shown = 0;
  for (const el of Array.from(bar.children)) {
    const childStyle = getComputedStyle(el);
    if (childStyle.display === 'none' || childStyle.position === 'absolute' || childStyle.position === 'fixed') continue;
    shown++;
    if (el === tray || el.classList.contains('grow')) continue;
    room -= el.getBoundingClientRect().width + px(childStyle.marginLeft) + px(childStyle.marginRight);
  }
  room -= px(style.columnGap) * (shown - 1);
  const gap = px(getComputedStyle(tray).columnGap);
  const slots = Math.floor((room + gap) / (slot + gap));
  return slots >= count ? count : Math.max(0, slots - 1);
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
    ro.observe(bar); for (const el of Array.from(bar.children)) ro.observe(el);
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
