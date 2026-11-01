// Point targets use stored exact edge references; line and area targets are placed by view points. Unresolved targets remain visible in this list.
import { useState, type CSSProperties } from 'react';
import { datumTargetConflicts, datumTargetSizeText, resolveDatumTarget, type DatumTargetKind, type DrawingDatumTarget } from '@barocss/cad-model/drawing/datumTargets';
import type { DrawingSettings, DrawingViews, ViewId } from '@barocss/cad-model/drawing/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { CONTROL, FIELD } from './sheetShared';

const TARGET_WRAP: CSSProperties = { minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', whiteSpace: 'normal', overflowWrap: 'anywhere' };
const TARGET_FIELD: CSSProperties = { display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', minWidth: 0, maxWidth: '100%' };
const TARGET_INPUT: CSSProperties = { minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' };
const TARGET_ACTION: CSSProperties = { ...TARGET_WRAP, height: 'auto' };

/** What the next added target is: its kind, area shape and size (typed, model mm) and whether a point target is the moveable symbol. */
export interface DatumTargetDraft { kind: DatumTargetKind; shape: 'circle' | 'rect'; d: string; w: string; h: string; moveable: boolean }
export const DEFAULT_TARGET_DRAFT: DatumTargetDraft = { kind: 'point', shape: 'circle', d: '6', w: '6', h: '4', moveable: false };

export function DatumTargetsEditor({ settings, views, hiddenViews, selected, choices, draft, onDraft, onChoose, onSelect, onAdd, onMove, onReselect, onCommit, onRefused }: {
  settings: DrawingSettings; views: DrawingViews | null; hiddenViews: ViewId[]; selected: string | null; choices: DrawingDatumTarget[]; draft: DatumTargetDraft; onDraft(draft: DatumTargetDraft): void;
  onChoose(target: DrawingDatumTarget): void; onSelect(id: string): void; onAdd(): void; onMove(target: DrawingDatumTarget): void;
  onReselect(target: DrawingDatumTarget): void;
  onCommit(rows: DrawingDatumTarget[]): boolean; onRefused(message: string): void;
}) {
  const rows = settings.datumTargets ?? [];
  const conflicts = datumTargetConflicts(rows);
  const set = (patch: Partial<DatumTargetDraft>) => onDraft({ ...draft, ...patch });
  return <details open aria-label="Datum targets"><summary>Datum targets ({rows.length})</summary>
    <p className="text-[11px] text-muted-foreground">{draft.kind === 'point' ? 'A point is a straight edge endpoint. Overlapping endpoints require an exact edge choice.' : draft.kind === 'line' ? 'A line is two points picked in a view. It does not follow the geometry.' : 'An area is centred on a point picked in a view. It does not follow the geometry.'}</p>
    <label className={FIELD} style={TARGET_FIELD}><span>Kind</span><NativeSelect className={CONTROL} aria-label="Datum target kind" value={draft.kind} onChange={e => set({ kind: e.target.value as DatumTargetKind })}>
      <option value="point">Point</option><option value="line">Line</option><option value="area">Area</option></NativeSelect></label>
    {draft.kind === 'area' && <>
      <label className={FIELD} style={TARGET_FIELD}><span>Area shape</span><NativeSelect className={CONTROL} aria-label="Datum target area shape" value={draft.shape} onChange={e => set({ shape: e.target.value as 'circle' | 'rect' })}>
        <option value="circle">Circle</option><option value="rect">Rectangle</option></NativeSelect></label>
      {draft.shape === 'circle'
        ? <label className={FIELD} style={TARGET_FIELD}><span>Ø (mm)</span><Input className={CONTROL} style={TARGET_INPUT} aria-label="Datum target area diameter" type="number" min={0} step="any" value={draft.d} onChange={e => set({ d: e.target.value })} /></label>
        : <>
          <label className={FIELD} style={TARGET_FIELD}><span>Width (mm)</span><Input className={CONTROL} style={TARGET_INPUT} aria-label="Datum target area width" type="number" min={0} step="any" value={draft.w} onChange={e => set({ w: e.target.value })} /></label>
          <label className={FIELD} style={TARGET_FIELD}><span>Height (mm)</span><Input className={CONTROL} style={TARGET_INPUT} aria-label="Datum target area height" type="number" min={0} step="any" value={draft.h} onChange={e => set({ h: e.target.value })} /></label>
        </>}
    </>}
    {draft.kind === 'point' && <details className="text-[11px]" style={TARGET_WRAP}><summary style={TARGET_WRAP}>Details</summary>
      <label className="flex items-center gap-1"><input type="checkbox" aria-label="New datum target moveable" checked={draft.moveable} onChange={e => set({ moveable: e.target.checked })} />Moveable symbol</label>
    </details>}
    <Button variant="ghost" size="xs" aria-label="Add datum target" disabled={!views || rows.length >= 200} onClick={onAdd}>{draft.kind === 'point' ? 'Add point target' : draft.kind === 'line' ? 'Add line target' : 'Add area target'}</Button>
    {choices.length > 0 && <div role="group" aria-label="Overlapping endpoint choices">
      <p className="text-[11px]">Choose an endpoint by its current position (mm):</p>
      {choices.map((target, i) => {
        const current = views && resolveDatumTarget(views[target.view], target);
        return <Button key={i} variant="ghost" size="xs" title={target.point?.edge} className="h-auto max-w-full whitespace-normal text-left" onClick={() => {
        const r = views && resolveDatumTarget(views[target.view], target);
        if (!r) onRefused('Wait for the current drawing.'); else if (!r.ok) onRefused(r.reason); else onChoose(target);
      }}>Endpoint {i + 1} · {current?.ok ? `[${current.at.join(', ')}] mm` : 'Position unavailable'}</Button>;
      })}
    </div>}
    {rows.map((target, index) => <TargetRow key={`${index}:${target.id}`} target={target} views={views} hidden={hiddenViews.includes(target.view)} conflict={conflicts.has(target)} selected={selected === target.id}
      onSelect={() => onSelect(target.id)} onMove={() => onMove(target)} onReselect={() => onReselect(target)} onRemove={() => onCommit(rows.filter((_, i) => i !== index))}
      onEdit={next => onCommit(rows.map((row, i) => i === index ? next : row))} />)}
    {rows.length > 0 && <Button variant="ghost" size="xs" onClick={() => onCommit([])}>Clear datum targets</Button>}
  </details>;
}

function TargetRow({ target, views, hidden, conflict, selected, onSelect, onMove, onReselect, onRemove, onEdit }: {
  target: DrawingDatumTarget; views: DrawingViews | null; hidden: boolean; conflict: boolean; selected: boolean; onSelect(): void; onMove(): void; onReselect(): void; onRemove(): void; onEdit(target: DrawingDatumTarget): boolean;
}) {
  const [draft, setDraft] = useState<{ letter: string; number: string; d: string; w: string; h: string } | null>(null);
  const resolved = views && resolveDatumTarget(views[target.view], target);
  const kind = target.kind ?? 'point', size = datumTargetSizeText(target);
  const fields = (): { letter: string; number: string; d: string; w: string; h: string } => draft ?? { letter: target.letter, number: String(target.number), d: target.kind === 'area' && target.area.shape === 'circle' ? String(target.area.d) : '', w: target.kind === 'area' && target.area.shape === 'rect' ? String(target.area.w) : '', h: target.kind === 'area' && target.area.shape === 'rect' ? String(target.area.h) : '' };
  const at = (p: readonly number[]) => `[${p.join(', ')}]`;
  // A saved row from before the strict rules is kept as it is; changing it would hit the strict authoring check, so say what to repair first.
  const legacy = target.point && (!target.point.endpoint ? 'it has no recorded endpoint. Choose Reselect endpoint first.' : target.number > 99 ? 'its number is above 99. Change the number first.' : null);
  return <div className={selected ? 'dw-dim sel' : 'dw-dim'} style={{ ...TARGET_WRAP, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignItems: 'stretch', width: '100%', boxSizing: 'border-box' }}>
    <Button variant="ghost" size="xs" style={{ ...TARGET_ACTION, justifyContent: 'flex-start', textAlign: 'left' }} aria-pressed={selected} onClick={onSelect}>Target {target.letter}{target.number} · {target.view} · {kind}{size ? ` ${size}` : ''}</Button>
    <div className="text-[11px]" role="status" style={TARGET_WRAP}>{conflict ? 'This target has a duplicate label or reference ID. Change its label or remove a duplicate target.' : !resolved ? 'Current drawing not ready.' : resolved.ok ? (target.kind === 'line' ? `Line from ${at(target.line.from)} to ${at(target.line.to)} view mm` : target.kind === 'area' ? `${target.area.shape === 'circle' ? 'Circle' : 'Rectangle'} ${size} mm at ${at(target.area.at)} view mm` : `Current endpoint [${resolved.at.join(', ')}] mm`) : resolved.reason}</div>
    {hidden && <div className="text-[11px]" style={TARGET_WRAP}>This view is hidden. Show it before moving the symbol.</div>}
    <details className="text-[11px]" style={TARGET_WRAP}><summary style={TARGET_WRAP}>Reference details</summary>
      {target.point && <>
        <div className="break-all">Edge: {target.point.edge}</div>
        <div>Endpoint identity: {target.point.endpoint ?? 'Not recorded'}</div>
        <div>Saved endpoint hint [{target.point.near.join(', ')}] mm</div>
        {target.point.was !== undefined && <div>Reference needs confirmation: {target.point.was}</div>}
        {legacy
          ? <div role="status">Moveable cannot change yet: {legacy}</div>
          : <label className="flex items-center gap-1"><input type="checkbox" aria-label={`Target ${target.letter}${target.number} moveable`} checked={!!target.moveable} onChange={e => onEdit(setMoveable(target, e.target.checked))} />Moveable symbol</label>}
      </>}
      <div>Symbol position [{target.place.join(', ')}] view mm</div>
      {conflict && <div>DATUM_TARGET_DUPLICATE</div>}
      {resolved && !resolved.ok && <div>{resolved.code}</div>}
    </details>
    <label className={FIELD} style={TARGET_FIELD}><span>Letter</span><Input className={CONTROL} style={TARGET_INPUT} aria-label={`Target ${target.letter}${target.number} letter`} value={fields().letter} maxLength={1}
      onChange={e => setDraft({ ...fields(), letter: e.target.value.toUpperCase() })} /></label>
    <label className={FIELD} style={TARGET_FIELD}><span>Number</span><Input className={CONTROL} style={TARGET_INPUT} aria-label={`Target ${target.letter}${target.number} number`} type="number" min={1} step={1} value={fields().number}
      onChange={e => setDraft({ ...fields(), number: e.target.value })} /></label>
    {target.kind === 'area' && (target.area.shape === 'circle'
      ? <label className={FIELD} style={TARGET_FIELD}><span>Ø (mm)</span><Input className={CONTROL} style={TARGET_INPUT} aria-label={`Target ${target.letter}${target.number} diameter`} type="number" min={0} step="any" value={fields().d} onChange={e => setDraft({ ...fields(), d: e.target.value })} /></label>
      : <>
        <label className={FIELD} style={TARGET_FIELD}><span>Width</span><Input className={CONTROL} style={TARGET_INPUT} aria-label={`Target ${target.letter}${target.number} width`} type="number" min={0} step="any" value={fields().w} onChange={e => setDraft({ ...fields(), w: e.target.value })} /></label>
        <label className={FIELD} style={TARGET_FIELD}><span>Height</span><Input className={CONTROL} style={TARGET_INPUT} aria-label={`Target ${target.letter}${target.number} height`} type="number" min={0} step="any" value={fields().h} onChange={e => setDraft({ ...fields(), h: e.target.value })} /></label>
      </>)}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0, maxWidth: '100%' }}>
      <Button variant="ghost" size="xs" style={TARGET_ACTION} disabled={!draft} onClick={() => {
        if (draft && onEdit(relabelled(target, draft))) setDraft(null);
      }}>Apply target label</Button>
      <Button variant="ghost" size="xs" style={TARGET_ACTION} disabled={hidden || conflict || !resolved?.ok} onClick={onMove}>Move symbol</Button>
      {kind === 'point' && <Button variant="ghost" size="xs" style={TARGET_ACTION} aria-label={`Reselect endpoint for target ${target.letter}${target.number}`} disabled={!views || conflict} onClick={onReselect}>Reselect endpoint</Button>}
      <Button variant="ghost" size="xs" style={TARGET_ACTION} aria-label={`Remove target ${target.letter}${target.number}`} onClick={onRemove}>Remove</Button>
    </div>
  </div>;
}

/** The row with its letter, number and (an area's) size as typed; a size that is not a number reaches the refusal as NaN. */
function relabelled(target: DrawingDatumTarget, draft: { letter: string; number: string; d: string; w: string; h: string }): DrawingDatumTarget {
  const number = draft.number.trim() ? Number(draft.number) : NaN, size = (v: string) => v.trim() ? Number(v) : NaN;
  if (target.kind !== 'area') return { ...target, letter: draft.letter, number };
  return { ...target, letter: draft.letter, number, area: target.area.shape === 'circle' ? { ...target.area, d: size(draft.d) } : { ...target.area, w: size(draft.w), h: size(draft.h) } };
}
function setMoveable(target: DrawingDatumTarget, on: boolean): DrawingDatumTarget {
  if (target.kind === 'line' || target.kind === 'area') return target;
  const next = { ...target }; delete next.moveable;
  return on ? { ...next, moveable: true } : next;
}
