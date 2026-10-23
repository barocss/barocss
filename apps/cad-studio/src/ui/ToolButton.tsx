import { memo } from 'react';
import type { Command } from '@barocss/cad-model/app/commands';
import { Icon } from './atoms';

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
  return <button className={'tool' + (on ? ' on' : '') + (ok ? '' : ' off')} aria-label={c.label}
    data-tip={c.label} data-tip-key={c.shortcut ?? ''} data-tip-desc={c.hint ?? ''} data-tip-off={reason} onClick={() => onStart(c)}
    {...(c.place && ok ? { draggable: true, onDragStart: (e: React.DragEvent) => onDragStart(c, e), onDragEnd: (e: React.DragEvent) => onDragEnd(c, e) } : {})}><Icon name={c.icon} /></button>;
});
