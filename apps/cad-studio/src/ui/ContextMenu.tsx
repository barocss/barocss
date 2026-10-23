import { commands, type Command, type Ctx } from '@barocss/cad-model/app/commands';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icon, Kbd } from './atoms';

export interface MenuAction { label: string; icon: string; shortcut?: string; run(): void }

/** Right-click menu: commands that apply to what was clicked, then view actions. */
/** `commands`: list the commands that apply (default); off for menus of other things (a history step). */
/** (G12f: shadcn's DropdownMenu, anchored at the click — kept inside the window, the arrow keys move through it, a click
 *  outside or Escape closes it.) */
export function ContextMenu({ at, ctx, title, actions, onRun, onClose, commands: withCommands = true }: {
  at: { x: number; y: number }; ctx: Ctx; title: string; actions: MenuAction[]; onRun(c: Command): void; onClose(): void; commands?: boolean;
}) {
  // (Shapes are made from the shapes bar, not on what was clicked.)
  const usable = withCommands ? commands.filter(c => c.id !== 'measure' && !c.place && c.available(ctx).ok) : [];
  return <DropdownMenu open modal={false} onOpenChange={open => { if (!open) onClose(); }}>
    <DropdownMenuTrigger asChild><span className="menu-anchor" style={{ left: at.x, top: at.y }} /></DropdownMenuTrigger>
    <DropdownMenuContent className="ctx-menu" aria-label={title} side="bottom" align="start" sideOffset={0}>
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
