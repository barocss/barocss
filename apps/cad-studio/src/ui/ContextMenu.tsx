import { useMemo } from 'react';
import { commands, type Command, type Ctx } from '@barocss/cad-model/app/commands';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icon, Kbd } from './atoms';

export interface MenuAction { label: string; icon: string; shortcut?: string; run(): void }

/** Right-click menu: commands that apply to what was clicked, then view actions. */
/** `commands`: list the commands that apply (default); off for menus of other things (a history step). */
/** (G12f: shadcn's DropdownMenu, anchored at the click — the arrow keys move through it, a click outside or Escape closes
 *  it. It stays inside the stage below the top bar and clear of the dock's strip or sheet: its height that room's, with its
 *  own scroll, flipped up only where there is more room above in the stage.) */
/** The stage's room for a menu, as Radix's collision boundary and padding: below the top bar, left of the dock's edge. */
function stageRoom() {
  const stage = document.querySelector<HTMLElement>('.stage'), bar = document.querySelector<HTMLElement>('.topbar');
  if (!stage) return { boundary: undefined, padding: 8 };
  const s = stage.getBoundingClientRect(), top = bar ? Math.max(0, bar.getBoundingClientRect().bottom - s.top) : 0;
  const dock = parseFloat(getComputedStyle(stage.closest<HTMLElement>('.studio') ?? stage).getPropertyValue('--dock-strip-w')) || 0;
  return { boundary: stage, padding: { top: top + 6, right: dock + 8, bottom: 8, left: 8 } };
}
export function ContextMenu({ at, ctx, title, actions, onRun, onClose, commands: withCommands = true }: {
  at: { x: number; y: number }; ctx: Ctx; title: string; actions: MenuAction[]; onRun(c: Command): void; onClose(): void; commands?: boolean;
}) {
  // (Shapes are made from the shapes bar, not on what was clicked.)
  const usable = withCommands ? commands.filter(c => c.id !== 'measure' && !c.place && c.available(ctx).ok) : [];
  // (Measured as it opens, at each new click.)
  const room = useMemo(() => stageRoom(), [at]);
  return <DropdownMenu open modal={false} onOpenChange={open => { if (!open) onClose(); }}>
    <DropdownMenuTrigger asChild><span className="menu-anchor" style={{ left: at.x, top: at.y }} /></DropdownMenuTrigger>
    <DropdownMenuContent className="ctx-menu" aria-label={title} side="bottom" align="start" sideOffset={0} collisionBoundary={room.boundary} collisionPadding={room.padding}>
      <DropdownMenuLabel className="ctx-title">{title}</DropdownMenuLabel>
      {usable.map(c => (
        <DropdownMenuItem key={c.id} className="ctx-item" onSelect={() => onRun(c)}>
          <Icon name={c.icon} small /><span>{c.label}</span><span className="grow" />{c.shortcut && <Kbd>{c.shortcut}</Kbd>}
        </DropdownMenuItem>))}
      {usable.length > 0 && <DropdownMenuSeparator className="ctx-sep" />}
      {actions.map(a => (
        <DropdownMenuItem key={a.label} className="ctx-item" onSelect={() => a.run()}>
          <Icon name={a.icon} small /><span>{a.label}</span><span className="grow" />{a.shortcut && <Kbd>{a.shortcut}</Kbd>}
        </DropdownMenuItem>))}
    </DropdownMenuContent>
  </DropdownMenu>;
}
