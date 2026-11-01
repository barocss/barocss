// 11 ④: the drawing's SHEETS — tabs along the bottom of the workspace (one tab a sheet, + adds one), and under a closed
// "Sheets" toggle in the panel: this sheet's name and delete, and for each view, removed section and detail the sheet it is
// drawn on ("Move … to sheet"). The sheets' data and rules are the model's (cad-model drawing/sheets.ts); these only edit them.
import { useState } from 'react';
import { nextSheetId, moveToSheet, removeSheet, sheetCount, sheetMap, sheetName, shownViews } from '@barocss/cad-model/drawing/sheets';
import { sectionsOf, type DrawingSettings } from '@barocss/cad-model/drawing/types';
import { Icon } from '../atoms';
import { CONTROL, FIELD } from './sheetShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

const VIEW_NAME = { front: 'Front view', top: 'Top view', right: 'Right view', iso: 'Isometric view' } as const;

/** The tabs: one for each sheet, and + to add one (a new empty sheet, shown at once). */
export function SheetTabs({ whole, current, onSelect, onAdd }: { whole: DrawingSettings; current: number; onSelect(k: number): void; onAdd(): void }) {
  return <div className="dw-sheets" role="tablist" aria-label="Sheets">
    {Array.from({ length: sheetCount(whole) }, (_, k) => <button key={k} role="tab" aria-selected={k === current} className={'dw-sheet-tab' + (k === current ? ' on' : '')} title={`${sheetName(whole, k)}: ${k === 0 ? whole.sheet : whole.sheets?.[k - 1]?.size ?? whole.sheet}`} onClick={() => onSelect(k)}>{sheetName(whole, k)}</button>)}
    <button className="dw-sheet-tab" aria-label="Add sheet" title="Add a sheet after the last" onClick={onAdd}><Icon name="add" small /></button>
  </div>;
}

/** The list of what can be moved, then this sheet's name and delete: rare things, so closed by default. */
export function SheetsMenu({ whole, current, onChange }: { whole: DrawingSettings; current: number; onChange(next: DrawingSettings, then?: number): void }) {
  const [draft, setDraft] = useState<string | null>(null), [note, setNote] = useState<string | null>(null);
  const n = sheetCount(whole), at = sheetMap(whole);
  const sheets = whole.sheets ?? [];
  const move = (ref: string, to: number) => {
    const next = { ...whole, sheets: moveToSheet(whole, ref, to) };
    // (A detail or removed section nobody lists is on its parent's sheet: it cannot be put on sheet 1 while its view is elsewhere.)
    if (sheetMap(next).get(ref) !== to) { setNote(`${rows.find(r => r.ref === ref)?.name ?? ref} stays with its view on ${sheetName(whole, sheetMap(next).get(ref) ?? 0)}: move that view to put it on ${sheetName(whole, to)}.`); return; }
    setNote(null); onChange(next);
  };
  const rows: { ref: string; name: string }[] = [
    ...shownViews(whole).map(v => ({ ref: v as string, name: VIEW_NAME[v] })),
    ...sectionsOf(whole).filter(x => x.removed).map(x => ({ ref: `section:${x.id}`, name: `Section ${x.id}–${x.id}` })),
    ...(whole.details ?? []).map(d => ({ ref: `detail:${d.id}`, name: `Detail ${d.id}` })),
  ];
  const rename = () => {
    if (draft === null || current === 0) return;
    const name = draft.trim().slice(0, 40);
    onChange({ ...whole, sheets: sheets.map((x, k) => { if (k !== current - 1) return x; const { name: _n, ...rest } = x; void _n; return name && name !== `Sheet ${current + 1}` ? { ...rest, name } : rest; }) });
    setDraft(null);
  };
  const remove = () => {
    if (current === 0) return;
    // (Its notes go back to the first sheet: they stop naming it, so a later sheet with the same id does not take them.)
    const { sheets: _s, notes: _n, ...rest } = whole; void _s; void _n;
    onChange({ ...rest, ...removeSheet(whole, current) }, current - 1);
  };
  return <details className="dw-sheet-set" aria-label="Sheets">
    <summary className="card-title" style={{ marginTop: 8 }}>SHEETS <span className="muted">{n}</span></summary>
    <label className={FIELD}><span>Name</span><Input className={CONTROL} aria-label="Sheet name" disabled={current === 0} title={current === 0 ? 'The first sheet is always Sheet 1' : 'This sheet’s name, in the sheet index'}
      value={draft ?? sheetName(whole, current)} onChange={e => setDraft(e.target.value)} onBlur={rename} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
    <div className="dw-actions"><Button variant="ghost" size="xs" disabled={current === 0} aria-label="Delete sheet" title={current === 0 ? 'The first sheet stays' : `Delete ${sheetName(whole, current)}: its views go back to sheet 1 (a detail or section to its view's sheet)`} onClick={remove}><Icon name="delete" small /> Delete sheet</Button></div>
    {rows.map(r => <label key={r.ref} className={FIELD}><span>{r.name}</span>
      <NativeSelect className={CONTROL} aria-label={`Move ${r.name} to sheet`} title="The sheet this is drawn on" value={String((at.get(r.ref) ?? 0) + 1)} onChange={e => move(r.ref, Number(e.target.value) - 1)}>
        {Array.from({ length: n }, (_, k) => <option key={k} value={k + 1}>{sheetName(whole, k)}</option>)}
      </NativeSelect></label>)}
    {note && <div className="empty" role="status" aria-label="Sheet move note" style={{ color: 'var(--warn)' }}>{note}</div>}
    <div className="empty">A section that is not removed stays with its view. Tables and the revision table are on sheet 1; a note without a leader stays on the sheet it is made on.</div>
  </details>;
}

export const newSheetId = (whole: DrawingSettings) => nextSheetId(whole);
