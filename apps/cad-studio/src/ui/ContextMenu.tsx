import { useEffect, useRef } from 'react';
import { commands, type Command, type Ctx } from '../app/commands';
import { Icon, Kbd } from './atoms';

export interface MenuAction { label: string; icon: string; shortcut?: string; run(): void }

/** Right-click menu: commands that apply to what was clicked, then view actions. */
export function ContextMenu({ at, ctx, title, actions, onRun, onClose }: {
  at: { x: number; y: number }; ctx: Ctx; title: string; actions: MenuAction[]; onRun(c: Command): void; onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', close); window.addEventListener('keydown', key);
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', key); };
  }, [onClose]);
  const usable = commands.filter(c => c.id !== 'measure' && c.available(ctx).ok);
  const left = Math.min(at.x, window.innerWidth - 236), top = Math.min(at.y, window.innerHeight - 40 - (usable.length + actions.length) * 30);
  return (
    <div ref={ref} className="card ctx-menu" role="menu" aria-label={title} style={{ left, top: Math.max(40, top) }}>
      <div className="card-title ctx-title">{title}</div>
      {usable.map(c => (
        <button key={c.id} role="menuitem" className="ctx-item" onClick={() => onRun(c)}>
          <Icon name={c.icon} small /><span>{c.label}</span><span className="grow" />{c.shortcut && <Kbd>{c.shortcut}</Kbd>}
        </button>))}
      {usable.length > 0 && <div className="ctx-sep" />}
      {actions.map(a => (
        <button key={a.label} role="menuitem" className="ctx-item" onClick={() => { a.run(); onClose(); }}>
          <Icon name={a.icon} small /><span>{a.label}</span><span className="grow" />{a.shortcut && <Kbd>{a.shortcut}</Kbd>}
        </button>))}
    </div>
  );
}
