import { useMemo, useState } from 'react';
import { commands, type Command as StudioCommand, type Ctx } from '@barocss/cad-model/app/commands';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { paletteList } from './paletteList';
import { Icon, Kbd } from './atoms';

/** `extra`: the studio's own commands, after the model's (G17's 3D sketch). (G12f: shadcn's Command — cmdk's keyboard
 *  selection — in its Dialog; the list ranked by paletteList, not cmdk's filter. Typing changes only the palette's state.) */
export function Palette({ ctx, onRun, onClose, extra }: { ctx: Ctx; onRun(c: StudioCommand): void; onClose(): void; extra?: readonly StudioCommand[] }) {
  const [q, setQ] = useState('');
  const all = useMemo(() => extra?.length ? [...commands, ...extra] : commands, [extra]);
  const list = useMemo(() => paletteList(q, ctx, all), [q, ctx, all]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="card palette top-[18vh] translate-y-0" overlayClassName="palette-backdrop bg-black/25" aria-label="Command palette" aria-describedby={undefined}>
      <DialogTitle className="sr">Command palette</DialogTitle>
      {/* (Enter is the palette's here: the window's — finish a sketch, apply — must not see it once the command starts.) */}
      <Command shouldFilter={false} loop onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}>
        <label className="palette-input"><Icon name="search" small /><span className="sr">Search commands</span>
          <CommandInput autoFocus value={q} onValueChange={setQ} placeholder="Type a command…  hole, chamfer, pattern" /><Kbd>Esc</Kbd></label>
        <CommandList className="palette-list">
          {list.map(({ c, a }) => (
            <CommandItem key={c.id} value={c.id} className={'pl-item' + (a.ok ? '' : ' off')} onSelect={() => onRun(c)}>
              <Icon name={c.icon} small /><span className="pl-label">{c.label}</span>
              {!a.ok && <span className="pl-reason">{a.reason}</span>}
              <span className="grow" />{c.shortcut && <Kbd>{c.shortcut}</Kbd>}
            </CommandItem>))}
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>;
}
