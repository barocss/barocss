import { useEffect, useMemo, useRef, useState } from 'react';
import { commands, type Command, type Ctx } from '../app/commands';
import { Icon, Kbd } from './atoms';

export function Palette({ ctx, onRun, onClose }: { ctx: Ctx; onRun(c: Command): void; onClose(): void }) {
  const [q, setQ] = useState(''); const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return commands.map(c => ({ c, a: c.available(ctx) }))
      .filter(({ c }) => !s || (c.label + ' ' + (c.keywords ?? '') + ' ' + c.id).toLowerCase().includes(s))
      .sort((x, y) => Number(y.a.ok) - Number(x.a.ok));
  }, [q, ctx]);
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div className="card palette" role="dialog" aria-label="Command palette" onMouseDown={e => e.stopPropagation()}>
        <label className="palette-input"><Icon name="search" small /><span className="sr">Search commands</span>
          <input ref={input} value={q} placeholder="Type a command…  hole, chamfer, pattern" onChange={e => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(list.length - 1, c + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(0, c - 1)); }
              if (e.key === 'Enter' && list[cursor]) { e.preventDefault(); onRun(list[cursor].c); }
              if (e.key === 'Escape') onClose();
            }} /><Kbd>Esc</Kbd></label>
        <ul className="palette-list" role="listbox">
          {list.map(({ c, a }, i) => (
            <li key={c.id} role="option" aria-selected={i === cursor} className={(i === cursor ? 'cur ' : '') + (a.ok ? '' : 'off')}
              onMouseEnter={() => setCursor(i)} onClick={() => onRun(c)}>
              <Icon name={c.icon} small /><span className="pl-label">{c.label}</span>
              {!a.ok && <span className="pl-reason">{a.reason}</span>}
              <span className="grow" />{c.shortcut && <Kbd>{c.shortcut}</Kbd>}
            </li>))}
        </ul>
      </div>
    </div>
  );
}
