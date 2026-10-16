// One tooltip for the whole app: any element with `data-tip` (its name) shows a card beside it after a
// short hover, with `data-tip-key` (its shortcut), `data-tip-desc` (what it does) and `data-tip-off` (why
// it cannot run now). Placed to the right of the left rail, below everything else.
import { useEffect, useState } from 'react';
import { Kbd } from './atoms';

interface Tip { title: string; key?: string; desc?: string; off?: string; x: number; y: number; side: 'right' | 'below' }

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    let timer = 0, current: HTMLElement | null = null;
    const show = (el: HTMLElement) => {
      const r = el.getBoundingClientRect(), side = r.left < 80 ? 'right' : 'below';
      setTip({ title: el.dataset.tip ?? '', key: el.dataset.tipKey || undefined, desc: el.dataset.tipDesc || undefined, off: el.dataset.tipOff || undefined,
        x: side === 'right' ? r.right + 10 : r.left + r.width / 2, y: side === 'right' ? r.top + r.height / 2 : r.bottom + 8, side });
    };
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
      if (el === current) return;
      current = el; window.clearTimeout(timer); setTip(null);
      if (el) timer = window.setTimeout(() => show(el), 280);
    };
    const hide = () => { current = null; window.clearTimeout(timer); setTip(null); };
    document.addEventListener('mouseover', over); document.addEventListener('mousedown', hide); window.addEventListener('blur', hide);
    return () => { document.removeEventListener('mouseover', over); document.removeEventListener('mousedown', hide); window.removeEventListener('blur', hide); window.clearTimeout(timer); };
  }, []);
  if (!tip) return null;
  return (
    <div className={'card tooltip ' + tip.side} role="tooltip" style={tip.side === 'right' ? { left: tip.x, top: tip.y } : { left: tip.x, top: tip.y }}>
      <div className="tooltip-head"><b>{tip.title}</b>{tip.key && <Kbd>{tip.key}</Kbd>}</div>
      {tip.desc && <div className="tooltip-desc">{tip.desc}</div>}
      {tip.off && <div className="tooltip-off">{tip.off}</div>}
    </div>
  );
}
