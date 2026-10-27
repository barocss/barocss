import { memo } from 'react';
import type { Command, Ctx } from '@barocss/cad-model/app/commands';
import { ShapesStrip } from './ShapesStrip';
import { ToolIconButton } from '@/components/ui/tool-button';
import { Icon } from './atoms';
import { commandIconName } from './commandIcons';

/**
 * A command's button on the rail or the shapes strip (R1c: memoised — the App's render went through every button and its
 * icon, 20 ms on a pick, G8). `reason` is why it is off ('' when it is not); a placing command's button drags.
 */
export const ToolButton = memo(function ToolButton({ c, ok, reason, on, onStart, onDragStart, onDragEnd }: {
  c: Command; ok: boolean; reason: string; on: boolean;
  onStart(c: Command): void;
  onDragStart(c: Command, e: React.DragEvent): void;
  onDragEnd(c: Command, e: React.DragEvent): void;
}) {
  return <ToolIconButton state={on ? 'on' : ok ? 'idle' : 'off'} aria-label={c.label}
    data-tip={c.label} data-tip-key={c.shortcut ?? ''} data-tip-off={reason} onClick={() => onStart(c)}
    {...(c.place && ok ? { draggable: true, onDragStart: (e: React.DragEvent) => onDragStart(c, e), onDragEnd: (e: React.DragEvent) => onDragEnd(c, e) } : {})}><Icon name={commandIconName(c.id, c.icon)} /></ToolIconButton>;
});

/** A command's availability as its button shows it ('' when it is on). */
export interface CommandState { ok: boolean; reason: string }
interface ListProps {
  list: readonly Command[];
  /** One for each of list; `sig` says when any changed. */
  states: readonly CommandState[];
  sig: string;
  activeId: string | null;
  onStart(c: Command): void;
  onDragStart(c: Command, e: React.DragEvent): void;
  onDragEnd(c: Command, e: React.DragEvent): void;
}
/** Two button lists' props alike: the same commands, availability (by its signature), active command and handlers. */
const sameList = (a: ListProps, b: ListProps) =>
  a.list === b.list && a.sig === b.sig && a.activeId === b.activeId && a.onStart === b.onStart && a.onDragStart === b.onDragStart && a.onDragEnd === b.onDragEnd;
function buttonsOf(p: ListProps) {
  return p.list.map((c, i) => <ToolButton key={c.id} c={c} ok={p.states[i].ok} reason={p.states[i].reason} on={p.activeId === c.id} onStart={p.onStart} onDragStart={p.onDragStart} onDragEnd={p.onDragEnd} />);
}
/**
 * A group of command buttons (R1c (2)): made again only when a command's availability or the active command changes — the
 * App renders in every frame of a joint played, an explode or a section drag, and made every button again each time.
 */
export const CommandButtons = memo(function CommandButtons(p: ListProps) { return <>{buttonsOf(p)}</>; }, sameList);
/** The shapes strip's buttons, made as CommandButtons is. */
export const CommandStrip = memo(function CommandStrip(p: ListProps) { return <ShapesStrip buttons={buttonsOf(p)} />; }, sameList);

/** The availability of each of a list of commands in a context, and its signature. */
export function commandStates(list: readonly Command[], ctx: Ctx): { states: CommandState[]; sig: string } {
  const states = list.map(c => { const a = c.available(ctx); return { ok: a.ok, reason: a.ok ? '' : a.reason }; });
  return { states, sig: states.map(s => (s.ok ? '1' : '0') + s.reason).join('\u0001') };
}
