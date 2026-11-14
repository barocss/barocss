// One tooltip for the whole app: any element with `data-tip` (its name) shows a card beside it after a
// short hover, with `data-tip-key` (its shortcut), `data-tip-desc` (what it does) and `data-tip-off` (why
// it cannot run now). Placed to the right of the left rail, below everything else. (G12f: drawn with shadcn's
// Tooltip — Radix's placement, kept inside the window — anchored on the hovered element's box; still one layer
// listening for hovers, so no element carries a tooltip of its own.)
import { useEffect, useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from './atoms';

interface Tip { title: string; key?: string; desc?: string; off?: string; box: DOMRect; side: 'right' | 'bottom' }

export function TooltipLayer() {
  const descriptionId = useId();
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    let timer = 0, current: HTMLElement | null = null, described: HTMLElement | null = null;
    const detach = () => {
      if (!described) return;
      const remaining = (described.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(id => id && id !== descriptionId);
      if (remaining.length) described.setAttribute('aria-describedby', remaining.join(' '));
      else described.removeAttribute('aria-describedby');
      described = null;
    };
    const show = (el: HTMLElement) => {
      const box = el.getBoundingClientRect();
      setTip({ title: el.dataset.tip ?? '', key: el.dataset.tipKey || undefined, desc: el.dataset.tipDesc || undefined, off: el.dataset.tipOff || undefined,
        box, side: box.left < 80 ? 'right' : 'bottom' });
    };
    const focusIn = (event: FocusEvent) => {
      if (described) hide();
      const el = event.target;
      if (!(el instanceof HTMLElement) || !el.matches('[data-tip-focus]') || !el.matches(':focus-visible')) return;
      hide();
      current = el;
      described = el;
      const previous = el.getAttribute('aria-describedby');
      el.setAttribute('aria-describedby', previous ? previous + ' ' + descriptionId : descriptionId);
      show(el);
    };
    const over = (e: MouseEvent) => {
      if (described) return;
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
      if (el === current) return;
      current = el; window.clearTimeout(timer); setTip(null);
      if (el) timer = window.setTimeout(() => show(el), 280);
    };
    const hide = () => { detach(); current = null; window.clearTimeout(timer); setTip(null); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !current) return;
      // Remove the hover layer before Radix routes Escape to the active menu or dialog.
      flushSync(hide);
    };
    const focusOut = (event: FocusEvent) => { if (event.target === described) hide(); };
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    document.addEventListener('mouseover', over);
    document.addEventListener('mousedown', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      detach();
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mousedown', hide);
      window.removeEventListener('blur', hide);
      window.removeEventListener('keydown', onKeyDown, true);
      window.clearTimeout(timer);
    };
  }, [descriptionId]);
  if (!tip) return null;
  const { box } = tip;
  return <TooltipProvider>
    <Tooltip open>
      {/* (The anchor: the hovered element's box, taking no pointer events.) */}
      <TooltipTrigger asChild><span className="tooltip-anchor" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} /></TooltipTrigger>
      <TooltipContent side={tip.side} className="tooltip pointer-events-none">
        <div id={descriptionId}>
          <div className="tooltip-head"><b>{tip.title}</b>{tip.key && <Kbd>{tip.key}</Kbd>}</div>
          {tip.desc && <div className="tooltip-desc">{tip.desc}</div>}
          {tip.off && <div className="tooltip-off">{tip.off}</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>;
}
