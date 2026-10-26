// Point targets use stored exact edge references; unresolved targets remain visible in this list.
import { useState, type CSSProperties } from 'react';
import { datumTargetConflicts, resolveDatumTarget, type DrawingDatumTarget } from '@barocss/cad-model/drawing/datumTargets';
import type { DrawingSettings, DrawingViews, ViewId } from '@barocss/cad-model/drawing/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CONTROL, FIELD } from './sheetShared';

const TARGET_WRAP: CSSProperties = { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', whiteSpace: 'normal', overflowWrap: 'anywhere' };
const TARGET_FIELD: CSSProperties = { display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', minWidth: 0, maxWidth: '100%' };
const TARGET_INPUT: CSSProperties = { minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' };
const TARGET_ACTION: CSSProperties = { ...TARGET_WRAP, height: 'auto' };

export function DatumTargetsEditor({ settings, views, hiddenViews, selected, choices, onChoose, onSelect, onAdd, onMove, onReselect, onCommit, onRefused }: {
  settings: DrawingSettings; views: DrawingViews | null; hiddenViews: ViewId[]; selected: string | null; choices: DrawingDatumTarget[];
  onChoose(target: DrawingDatumTarget): void; onSelect(id: string): void; onAdd(): void; onMove(target: DrawingDatumTarget): void;
  onReselect(target: DrawingDatumTarget): void;
  onCommit(rows: DrawingDatumTarget[]): boolean; onRefused(message: string): void;
}) {
  const rows = settings.datumTargets ?? [];
  const conflicts = datumTargetConflicts(rows);
  return <details open aria-label="Point datum targets"><summary>Point datum targets ({rows.length})</summary>
    <p className="text-[11px] text-muted-foreground">Straight edge endpoints only. Overlapping endpoints require an exact edge choice.</p>
    <Button variant="ghost" size="xs" disabled={!views || rows.length >= 200} onClick={onAdd}>Add point target</Button>
    {choices.length > 0 && <div role="group" aria-label="Overlapping endpoint choices">
      <p className="text-[11px]">Choose an endpoint by its current position (mm):</p>
      {choices.map((target, i) => {
        const current = views && resolveDatumTarget(views[target.view], target);
        return <Button key={i} variant="ghost" size="xs" title={target.point.edge} className="h-auto max-w-full whitespace-normal text-left" onClick={() => {
        const r = views && resolveDatumTarget(views[target.view], target);
        if (!r) onRefused('Wait for the current drawing.'); else if (!r.ok) onRefused(r.reason); else onChoose(target);
      }}>Endpoint {i + 1} · {current?.ok ? `[${current.at.join(', ')}] mm` : 'Position unavailable'}</Button>;
      })}
    </div>}
    {rows.map((target, index) => <TargetRow key={`${index}:${target.id}`} target={target} views={views} hidden={hiddenViews.includes(target.view)} conflict={conflicts.has(target)} selected={selected === target.id}
      onSelect={() => onSelect(target.id)} onMove={() => onMove(target)} onReselect={() => onReselect(target)} onRemove={() => onCommit(rows.filter((_, i) => i !== index))}
      onEdit={next => onCommit(rows.map((row, i) => i === index ? next : row))} />)}
    {rows.length > 0 && <Button variant="ghost" size="xs" onClick={() => onCommit([])}>Clear point targets</Button>}
  </details>;
}

function TargetRow({ target, views, hidden, conflict, selected, onSelect, onMove, onReselect, onRemove, onEdit }: {
  target: DrawingDatumTarget; views: DrawingViews | null; hidden: boolean; conflict: boolean; selected: boolean; onSelect(): void; onMove(): void; onReselect(): void; onRemove(): void; onEdit(target: DrawingDatumTarget): boolean;
}) {
  const [draft, setDraft] = useState<{ letter: string; number: string } | null>(null);
  const resolved = views && resolveDatumTarget(views[target.view], target);
  return <div className={selected ? 'dw-dim sel' : 'dw-dim'} style={{ ...TARGET_WRAP, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignItems: 'stretch', width: '100%', boxSizing: 'border-box' }}>
    <Button variant="ghost" size="xs" style={{ ...TARGET_ACTION, justifyContent: 'flex-start', textAlign: 'left' }} aria-pressed={selected} onClick={onSelect}>Target {target.letter}{target.number} · {target.view}</Button>
    <div className="text-[11px]" role="status" style={TARGET_WRAP}>{conflict ? 'This target has a duplicate label or reference ID. Change its label or remove a duplicate target.' : !resolved ? 'Current drawing not ready.' : resolved.ok ? `Current endpoint [${resolved.at.join(', ')}] mm` : resolved.reason}</div>
    {hidden && <div className="text-[11px]" style={TARGET_WRAP}>This view is hidden. Show it before moving the symbol.</div>}
    <details className="text-[11px]" style={TARGET_WRAP}><summary style={TARGET_WRAP}>Reference details</summary>
      <div className="break-all">Edge: {target.point.edge}</div>
      <div>Endpoint identity: {target.point.endpoint ?? 'Not recorded'}</div>
      <div>Saved endpoint hint [{target.point.near.join(', ')}] mm</div>
      {target.point.was !== undefined && <div>Reference needs confirmation: {target.point.was}</div>}
      <div>Symbol position [{target.place.join(', ')}] view mm</div>
      {conflict && <div>DATUM_TARGET_DUPLICATE</div>}
      {resolved && !resolved.ok && <div>{resolved.code}</div>}
    </details>
    <label className={FIELD} style={TARGET_FIELD}><span>Letter</span><Input className={CONTROL} style={TARGET_INPUT} aria-label={`Target ${target.letter}${target.number} letter`} value={draft?.letter ?? target.letter} maxLength={1}
      onChange={e => setDraft({ letter: e.target.value.toUpperCase(), number: draft?.number ?? String(target.number) })} /></label>
    <label className={FIELD} style={TARGET_FIELD}><span>Number</span><Input className={CONTROL} style={TARGET_INPUT} aria-label={`Target ${target.letter}${target.number} number`} type="number" min={1} step={1} value={draft?.number ?? target.number}
      onChange={e => setDraft({ letter: draft?.letter ?? target.letter, number: e.target.value })} /></label>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0, maxWidth: '100%' }}>
      <Button variant="ghost" size="xs" style={TARGET_ACTION} disabled={!draft} onClick={() => {
        if (draft && onEdit({ ...target, letter: draft.letter, number: draft.number.trim() ? Number(draft.number) : NaN })) setDraft(null);
      }}>Apply target label</Button>
      <Button variant="ghost" size="xs" style={TARGET_ACTION} disabled={hidden || conflict || !resolved?.ok} onClick={onMove}>Move symbol</Button>
      <Button variant="ghost" size="xs" style={TARGET_ACTION} aria-label={`Reselect endpoint for target ${target.letter}${target.number}`} disabled={!views || conflict} onClick={onReselect}>Reselect endpoint</Button>
      <Button variant="ghost" size="xs" style={TARGET_ACTION} aria-label={`Remove target ${target.letter}${target.number}`} onClick={onRemove}>Remove</Button>
    </div>
  </div>;
}
