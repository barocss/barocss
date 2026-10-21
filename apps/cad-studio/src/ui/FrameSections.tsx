// The section library (FRc, O117): the person's own rows of frame sections — by their dimensions, each with where its
// sizes come from or flagged as an estimate (none is built in, D122) — added, edited, removed (a row a frame uses
// stays) or loaded from a file. A frame or member takes a row as its section; an edited row moves every frame on it.
import { useState } from 'react';
import type { FrameSectionRow, InlineSection, StudioDoc } from '@barocss/cad-model/engine/doc';
import { editSections, sectionLabel, sectionUses } from '@barocss/cad-model/frames/sections';
import { Icon } from './atoms';

/** Each kind's dimensions, in the kernel's names, with their labels. */
const KINDS: Record<InlineSection['kind'], readonly (readonly [string, string])[]> = {
  'rect-tube': [['width', 'Width'], ['height', 'Height'], ['wall', 'Wall'], ['outerRadius', 'Outer radius']],
  'round-tube': [['diameter', 'Diameter'], ['wall', 'Wall']],
  angle: [['legX', 'Leg x'], ['legY', 'Leg y'], ['thickness', 'Thickness'], ['rootRadius', 'Root radius'], ['toeRadius', 'Toe radius']],
  channel: [['height', 'Height'], ['width', 'Width'], ['web', 'Web'], ['flange', 'Flanges'], ['rootRadius', 'Root radius']],
  tslot: [['size', 'Size'], ['cells', 'Cells (1 or 2)'], ['openSlots', 'Open slots (one cell)'], ['opening', 'Opening'], ['lip', 'Lip'], ['undercut', 'Undercut'], ['depth', 'Depth'], ['bore', 'Bore']],
};
const KIND_LABELS: Record<InlineSection['kind'], string> = { 'rect-tube': 'Rectangular tube', 'round-tube': 'Round tube', angle: 'Angle', channel: 'Channel', tslot: 'T-slot' };
/** A row being written: `editing` an existing one keeps its id (a new id is a new row). */
interface Draft { id: string; name: string; kind: InlineSection['kind']; dims: Record<string, string>; source: string; estimate: boolean; editing: boolean }
const EMPTY: Draft = { id: '', name: '', kind: 'rect-tube', dims: {}, source: '', estimate: false, editing: false };

/** A draft from a row, to edit it. */
const draftOf = (r: FrameSectionRow): Draft => ({ id: r.id, name: r.name ?? '', kind: r.section.kind, dims: Object.fromEntries(Object.entries(r.section).filter(([k]) => k !== 'kind').map(([k, v]) => [k, String(v)])), source: r.source ?? '', estimate: !!r.estimate, editing: true });
/** The row a draft makes: its kind's dimensions as numbers (an empty one left out, the check says which is needed). */
function rowOf(d: Draft): Record<string, unknown> {
  const section: Record<string, unknown> = { kind: d.kind };
  for (const [k] of KINDS[d.kind]) { const t = d.dims[k]?.trim(); if (t) section[k] = Number(t); }
  if (d.kind === 'tslot' && section.cells === 2) delete section.openSlots;
  return { id: d.id.trim(), ...(d.name.trim() ? { name: d.name.trim() } : {}), section, ...(d.source.trim() ? { source: d.source.trim() } : d.estimate ? { estimate: true } : {}) };
}

export function FrameSections({ doc, onCommit, onError }: { doc: StudioDoc; onCommit(next: StudioDoc): void; onError(title: string, message: string): void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const rows = doc.frames?.sections ?? [], uses = sectionUses(doc);
  const apply = (add: unknown[], remove: string[] = []) => {
    const r = editSections(doc, add, remove);
    if ('error' in r) { onError('Section library', r.error); return false; }
    onCommit(r.doc); return true;
  };
  const addFile = async (file: File) => {
    try { const j = JSON.parse(await file.text()) as unknown; apply(Array.isArray(j) ? j : [j]); }
    catch (cause) { onError('Could not read the sections', cause instanceof Error ? cause.message : String(cause)); }
  };
  const set = (patch: Partial<Draft>) => setDraft(d => d && { ...d, ...patch });
  return <section aria-label="Section library">
    <div className="card-title" style={{ marginTop: 8 }}>SECTIONS</div>
    {!rows.length && <div className="empty">No sections of your own: add one, or a file of them (JSON). None is built in.</div>}
    {rows.map(r => {
      const by = uses.get(r.id) ?? [];
      return <div key={r.id} className="param-row" aria-label={`Section ${r.id}`}>
        <span title={r.source ?? 'an estimate'}><b>{r.name ?? r.id}</b> <span className="muted small">{sectionLabel(r.section, String)} · {r.source ?? 'estimate'}{by.length ? ` · ${by.length} feature${by.length === 1 ? '' : 's'}` : ''}</span></span>
        <button className="ghost small" aria-label={`Edit section ${r.id}`} onClick={() => setDraft(draftOf(r))}>Edit</button>
        <button className="ghost small" aria-label={`Remove section ${r.id}`} disabled={!!by.length} title={by.length ? `Used by ${by.join(', ')}` : 'Remove the row'} onClick={() => apply([], [r.id])}><Icon name="delete" small /></button>
      </div>;
    })}
    {draft ? <div className="library" aria-label="Section row">
      <label className="kv"><span>Id</span><input aria-label="Section id" value={draft.id} disabled={draft.editing} onChange={ev => set({ id: ev.target.value })} /></label>
      <label className="kv"><span>Name</span><input aria-label="Section name" value={draft.name} onChange={ev => set({ name: ev.target.value })} /></label>
      <label className="kv"><span>Kind</span><select aria-label="Section kind" value={draft.kind} onChange={ev => set({ kind: ev.target.value as InlineSection['kind'] })}>
        {(Object.keys(KINDS) as InlineSection['kind'][]).map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></label>
      {KINDS[draft.kind].map(([k, label]) => <label key={k} className="kv"><span>{label}</span><input aria-label={`Section ${k}`} inputMode="decimal" value={draft.dims[k] ?? ''} onChange={ev => set({ dims: { ...draft.dims, [k]: ev.target.value } })} /></label>)}
      <label className="kv"><span>Source</span><input aria-label="Section source" placeholder="your shop, a page" value={draft.source} onChange={ev => set({ source: ev.target.value })} /></label>
      <label className="kv"><span>Estimate</span><input type="checkbox" aria-label="Section estimate" checked={draft.estimate} disabled={!!draft.source.trim()} onChange={ev => set({ estimate: ev.target.checked })} /></label>
      <div className="row-actions">
        <button className="primary" aria-label="Save section" onClick={() => { if (apply([rowOf(draft)])) setDraft(null); }}>Save</button>
        <button className="ghost" aria-label="Cancel section" onClick={() => setDraft(null)}>Cancel</button>
      </div>
    </div> : <div className="row-actions">
      <button className="ghost small" aria-label="Add section" onClick={() => setDraft({ ...EMPTY })}>Add a section</button>
      <label className="ghost small file-button">Add a sections file…<input type="file" accept="application/json,.json" aria-label="Sections file" hidden onChange={ev => { const f = ev.currentTarget.files?.[0]; if (f) void addFile(f); ev.currentTarget.value = ''; }} /></label>
    </div>}
  </section>;
}
