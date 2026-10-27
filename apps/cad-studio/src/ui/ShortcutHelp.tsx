// The keyboard and mouse at a glance (? opens it): every command's key by group, the general keys, and
// how the mouse moves the view and picks.
import { useEffect } from 'react';
import { commands } from '@barocss/cad-model/app/commands';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon, Kbd } from './atoms';

const GROUPS: [string, string][] = [['create', 'Create'], ['modify', 'Modify'], ['pattern', 'Pattern'], ['combine', 'Combine'], ['inspect', 'Inspect']];
const GENERAL: [string, string][] = [['Space', 'Find a command'], ['Enter', 'Apply'], ['⇧Enter', 'Apply, then the same command again'], ['Esc', 'Cancel, or clear the selection'], ['Del', 'Delete what is picked'],
  ['⌘Z / ⇧⌘Z', 'Undo / redo'], ['⌘D', 'Duplicate a body'], ['⌘C / ⌘V', 'Copy a body / paste a copy beside it'],
  ['← → ↑ ↓', 'Nudge the picked body 1 mm in X / Y (Shift: 10 mm)'], ['PgUp / PgDn', 'Nudge it in Z'], ['⌘S', 'Save'], ['F', 'Fit the view (to what is picked)'], ['?', 'This list']];
const MOUSE: [string, string][] = [['Click', 'Pick a face or an edge'], ['Shift-click', 'Add to the pick'], ['Drag', 'Window select (left to right: inside; right to left: touching)'],
  ['Right-drag / Alt-drag', 'Orbit'], ['Middle-drag / Shift-right-drag', 'Pan'], ['Wheel', 'Zoom'], ['Right-click', 'What can be done here'], ['Double-click a face', 'Pick the whole body'], ['Double-click an edge', 'Pick its tangent chain'], ['Double-click a name', 'Rename a body']];

export function ShortcutHelp({ onClose }: { onClose(): void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  return (
    // (G12f: shadcn's Dialog — its overlay, focus kept inside, a click outside closing it.)
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="card help" overlayClassName="help-scrim bg-black/35" aria-label="Keyboard and mouse" aria-describedby={undefined}>
        <DialogTitle className="card-title">KEYBOARD AND MOUSE <ToolIconButton size="tiny" aria-label="Close" onClick={onClose}><Icon name="close" small /></ToolIconButton></DialogTitle>
        <div className="help-cols">
          <section>{GROUPS.map(([g, name]) => {
            const list = commands.filter(c => c.group === g && c.shortcut);
            return list.length ? <div key={g}><h4>{name}</h4>{list.map(c => <div key={c.id} className="help-row"><Icon name={c.icon} small /><span>{c.label}</span><Kbd>{c.shortcut}</Kbd></div>)}</div> : null;
          })}</section>
          <section><h4>General</h4>{GENERAL.map(([k, what]) => <div key={k} className="help-row"><span>{what}</span><Kbd>{k}</Kbd></div>)}
            <h4>Mouse</h4>{MOUSE.map(([k, what]) => <div key={k} className="help-row"><span>{what}</span><span className="muted">{k}</span></div>)}</section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
