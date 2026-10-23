// The drawing's SHEET settings (O16: split from DrawingWorkspace, on shadcn's components): scope, size, scale, front side, projection, hidden lines,
// sections, views, edges, tables, balloons, title and revision.
import { useState } from 'react';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { FriendlyError } from '@barocss/cad-model/engine/errors';
import { changeDrawingScope } from '@barocss/cad-model/drawing/scope';
import { sectionMiddle } from '@barocss/cad-model/drawing/sheet';
import { ORIENTATIONS, SCALES, VIEWS, scaleLabel, type Orientation } from '@barocss/cad-model/drawing/views';
import { SECTION_VIEWS, VIEW_IDS, modelPrint, nextRevision, nextSectionId, sameSection, withSections, type DrawingSettings, type SectionViewId } from '@barocss/cad-model/drawing/types';
import type { useDrawingSheet } from '../useDrawingSheet';
import { Icon } from '../atoms';
import { CONTROL, FIELD, SIDE_NAMES, TICK, withTable } from './sheetShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';

type Sheet = ReturnType<typeof useDrawingSheet>;
export function SheetSettings({ sheet: { scopeRead, scope, views, layout, sectionA, sectionList, cutA, cutsMade, hasSheet, hasFrame, kinds, hasBought, doc, title, busy }, settings, sourceDoc, fileName, onChange, onToast, onScopeChanged, turnTo }: {
  sheet: Pick<Sheet, 'scopeRead' | 'scope' | 'views' | 'layout' | 'sectionA' | 'sectionList' | 'cutA' | 'cutsMade' | 'hasSheet' | 'hasFrame' | 'kinds' | 'hasBought' | 'doc' | 'title' | 'busy'>;
  settings: DrawingSettings; sourceDoc: StudioDoc; fileName: string; onChange(next: DrawingSettings): void; onToast(e: FriendlyError): void;
  /** The scope changed: what was picked or dragged on the sheet is let go. */ onScopeChanged(): void; turnTo(o: Orientation): Promise<void>;
}) {
  const [sectionY, setSectionY] = useState<string | null>(null);
  const [sectionAt, setSectionAt] = useState<{ id: string; text: string } | null>(null);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  return <>
        <div className="card-title">SHEET {busy && views && <span className="muted">updating…</span>}</div>
        <label className={FIELD}><span>Scope</span><NativeSelect className={CONTROL} aria-label="Drawing scope" disabled={!!scopeRead.error} value={scopeRead.error ? 'invalid' : scope.kind === 'assembly' ? 'assembly' : scope.part ? `part:${scope.part}` : 'part'} onChange={e => {
          const value = e.target.value;
          try {
            const next = changeDrawingScope(settings, value === 'assembly' ? { kind: 'assembly' } : value === 'part' ? { kind: 'part' } : { kind: 'part', part: value.slice(5) });
            onChange(next); onScopeChanged();
          } catch (cause) { onToast({ title: 'Drawing scope unchanged', hint: cause instanceof Error ? cause.message : String(cause), detail: '' }); }
        }}>
          <option value="part">Part: base</option>
          {scopeRead.error && <option value="invalid">Invalid saved scope</option>}
          {scope.kind === 'part' && scope.part && !sourceDoc.instances?.some(i => i.id === scope.part) && <option value={`part:${scope.part}`}>Missing part: {scope.part}</option>}
          {(sourceDoc.instances ?? []).map(i => <option key={i.id} value={`part:${i.id}`}>Part: {i.id}</option>)}
          <option value="assembly">Assembly</option>
        </NativeSelect></label>
        {scope.kind === 'assembly' && <div className="empty">Auto-dimension is available for a part scope. Assembly scope keeps its BOM table and balloons.</div>}
        <label className={FIELD}><span>Size</span><NativeSelect className={CONTROL} aria-label="Sheet size" value={settings.sheet} onChange={e => onChange({ ...settings, sheet: e.target.value as 'A4' })}>
          <option value="A4">A4 landscape</option><option value="A3">A3 landscape</option></NativeSelect></label>
        <label className={FIELD}><span>Scale</span><NativeSelect className={CONTROL} aria-label="Scale" value={settings.scale ?? 'auto'} onChange={e => { const v = e.target.value; const rest = { ...settings }; delete rest.scale; onChange(v === 'auto' ? rest : { ...rest, scale: Number(v) }); }}>
          <option value="auto">Auto{layout && settings.scale === undefined ? ` (${scaleLabel(layout.scale)})` : ''}</option>
          {SCALES.map(s => <option key={s} value={s}>{scaleLabel(s)}</option>)}</NativeSelect></label>
        <label className={FIELD}><span>Front from</span><NativeSelect className={CONTROL} aria-label="Front view side" value={settings.orientation ?? 'y-'} onChange={e => void turnTo(e.target.value as Orientation)}>
          {ORIENTATIONS.map(o => <option key={o} value={o}>{SIDE_NAMES[o]}</option>)}</NativeSelect></label>
        <label className={FIELD}><span>Projection</span><NativeSelect className={CONTROL} aria-label="Projection" value={settings.projection} onChange={e => onChange({ ...settings, projection: e.target.value as 'third' })}>
          <option value="third">Third angle</option><option value="first">First angle</option></NativeSelect></label>
        <label className={FIELD}><span>Hidden lines</span><input type="checkbox" className={TICK} aria-label="Hidden lines" checked={settings.hidden} onChange={e => onChange({ ...settings, hidden: e.target.checked })} /></label>
        <label className={FIELD}><span>Section A–A</span><input type="checkbox" className={TICK} aria-label="Section A–A" checked={!!sectionA} onChange={e => {
          const rest = sectionList.filter(x => !(x.id === 'A' && x.view === 'front'));
          // By default through the middle of the part, front to back.
          const at = views ? sectionMiddle(views, 'front', settings.orientation) : null;
          onChange(withSections(settings, e.target.checked && at !== null && !rest.some(x => x.id === 'A') ? [{ id: 'A', view: 'front', at }, ...rest] : rest));
        }} /></label>
        {sectionA && <label className={FIELD}><span>Cut at Y</span><span className="num flex items-center gap-1"><Input type="number" className="w-20 text-right" step="any" aria-label="Section Y" value={sectionY ?? sectionA.at}
          onChange={e => setSectionY(e.target.value)}
          onBlur={() => { const y = Number(sectionY); if (sectionY !== null && sectionY.trim() !== '' && Number.isFinite(y)) onChange(withSections(settings, sectionList.map(x => x === sectionA ? { ...x, at: y } : x))); setSectionY(null); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /><em>mm</em></span></label>}
        {sectionA && cutA && !cutA.result.ok && <div className="empty" style={{ color: 'var(--warn)' }}>Section A–A: {cutA.result.error}</div>}
        {/* (O148 X1: more sections, each square to the front, top or right view's depth; letters in order.) */}
        {sectionList.filter(x => x !== sectionA).map(x => {
          const made = cutsMade?.find(c => sameSection(c, x));
          return <div key={x.id} className={FIELD} aria-label={`Section ${x.id}`}>
            <span>Section {x.id}–{x.id}</span>
            <NativeSelect className={CONTROL} aria-label={`Section ${x.id} view`} value={x.view} onChange={e => { const view = e.target.value as SectionViewId, at = views ? sectionMiddle(views, view, settings.orientation) : null; if (at !== null) onChange(withSections(settings, sectionList.map(y => y === x ? { ...y, view, at } : y))); }}>
              {SECTION_VIEWS.map(v => <option key={v} value={v}>{VIEWS[v].label.toLowerCase()}</option>)}</NativeSelect>
            <span className="num flex items-center gap-1"><Input type="number" className="w-20 text-right" step="any" aria-label={`Section ${x.id} at`} value={sectionAt?.id === x.id ? sectionAt.text : x.at}
              onChange={e => setSectionAt({ id: x.id, text: e.target.value })}
              onBlur={() => { const v = Number(sectionAt?.text); if (sectionAt?.id === x.id && sectionAt.text.trim() !== '' && Number.isFinite(v)) onChange(withSections(settings, sectionList.map(y => y === x ? { ...y, at: v } : y))); setSectionAt(null); }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /><em>mm</em></span>
            <Button variant="ghost" size="xs" aria-label={`Remove section ${x.id}`} title={`Remove section ${x.id}–${x.id}`} onClick={() => onChange(withSections(settings, sectionList.filter(y => y !== x)))}><Icon name="close" small /></Button>
            {made && !made.result.ok && <div className="empty" style={{ color: 'var(--warn)' }}>{made.result.error}</div>}
          </div>;
        })}
        <Button variant="ghost" aria-label="Add section" disabled={!views} title="Another section, square to the top view's depth (change its view and place after)" onClick={() => {
          const view: SectionViewId = sectionList.some(x => x.view === 'top') ? 'right' : 'top', at = views ? sectionMiddle(views, view, settings.orientation) : null;
          // (A is the front's, by its checkbox above: added sections take B on.)
          if (at !== null) onChange(withSections(settings, [...sectionList, { id: nextSectionId([{ id: 'A', view: 'front', at: 0 }, ...sectionList]), view, at }]));
        }}>Add section</Button>
        {(['right', 'iso'] as const).map(v => <label key={v} className={FIELD}><span>{v === 'right' ? 'Right view' : 'Isometric view'}</span><input type="checkbox" className={TICK} aria-label={v === 'right' ? 'Right view' : 'Isometric view'} checked={!settings.views || settings.views.includes(v)} onChange={e => {
          const on = new Set(settings.views ?? VIEW_IDS); if (e.target.checked) on.add(v); else on.delete(v);
          const next = { ...settings }; delete next.views; onChange(on.size === VIEW_IDS.length ? next : { ...next, views: VIEW_IDS.filter(x => on.has(x)) });
        }} /></label>)}
        <label className={FIELD}><span>Tangent edges</span><input type="checkbox" className={TICK} aria-label="Tangent edges" checked={!!settings.tangent} onChange={e => { const rest = { ...settings }; delete rest.tangent; onChange(e.target.checked ? { ...rest, tangent: true } : rest); }} /></label>
        <label className={FIELD}><span>Centre lines</span><input type="checkbox" className={TICK} aria-label="Centre lines" checked={settings.centers !== false} onChange={e => { const rest = { ...settings }; delete rest.centers; onChange(e.target.checked ? rest : { ...rest, centers: false }); }} /></label>
        {hasSheet && <label className={FIELD}><span>Bend table</span><input type="checkbox" className={TICK} aria-label="Bend table" checked={!!settings.tables?.some(x => x.from === 'bends')} onChange={e => { const rest = (settings.tables ?? []).filter(x => x.from !== 'bends'); const tables = e.target.checked ? [...rest, { id: 'bends', from: 'bends' }] : rest; const { tables: _t, ...base } = settings; void _t; onChange(tables.length ? { ...base, tables } : base); }} /></label>}
        {hasFrame && <label className={FIELD}><span>Cut list</span><input type="checkbox" className={TICK} aria-label="Cut list table" checked={!!settings.tables?.some(x => x.from === 'cut-list')} onChange={e => onChange(withTable(settings, 'cut-list', e.target.checked))} /></label>}
        {/* (FRd1, O118: the frame's welds as a table, W1… with the cut list's items.) */}
        {hasFrame && <label className={FIELD}><span>Weld list</span><input type="checkbox" className={TICK} aria-label="Weld list table" checked={!!settings.tables?.some(x => x.from === 'weld-list')} onChange={e => onChange(withTable(settings, 'weld-list', e.target.checked))} /></label>}
        {hasFrame && <label className={FIELD}><span>Weld symbols</span><input type="checkbox" className={TICK} aria-label="Weld symbols" checked={!!settings.weldSymbols} onChange={e => { const { weldSymbols: _w, ...base } = settings; void _w; onChange(e.target.checked ? { ...base, weldSymbols: true } : base); }} /></label>}
        {(kinds.size > 0 || hasBought) && <label className={FIELD}><span>Element list</span><input type="checkbox" className={TICK} aria-label="Element list table" checked={!!settings.tables?.some(x => x.from === 'elements')} onChange={e => onChange(withTable(settings, 'elements', e.target.checked))} /></label>}
        {kinds.has('spring') && <label className={FIELD}><span>Spring data</span><input type="checkbox" className={TICK} aria-label="Spring data table" checked={!!settings.tables?.some(x => x.from === 'springs')} onChange={e => onChange(withTable(settings, 'springs', e.target.checked))} /></label>}
        {kinds.has('oring-gland') && <label className={FIELD}><span>Gland table</span><input type="checkbox" className={TICK} aria-label="Gland table" checked={!!settings.tables?.some(x => x.from === 'glands')} onChange={e => onChange(withTable(settings, 'glands', e.target.checked))} /></label>}
        {/* (O147 B2: the BOM as a table and its item balloons, for an assembly or a part with machine elements.) */}
        {(!!doc.instances?.length || kinds.size > 0) && <label className={FIELD}><span>BOM table</span><input type="checkbox" className={TICK} aria-label="BOM table" checked={!!settings.tables?.some(x => x.from === 'bom')} onChange={e => onChange(withTable(settings, 'bom', e.target.checked))} /></label>}
        {(!!doc.instances?.length || kinds.size > 0) && <label className={FIELD}><span>Balloons</span><input type="checkbox" className={TICK} aria-label="Balloons" checked={!!settings.balloons} onChange={e => { const { balloons: _b, ...base } = settings; void _b; onChange(e.target.checked ? { ...base, balloons: true } : base); }} /></label>}
        <label className={FIELD}><span>Title</span><Input className={CONTROL} aria-label="Drawing title" value={titleDraft ?? title} onChange={e => setTitleDraft(e.target.value)}
          onBlur={() => { if (titleDraft !== null) { const rest = { ...settings }; delete rest.title; onChange(titleDraft.trim() && titleDraft.trim() !== fileName ? { ...rest, title: titleDraft.trim() } : rest); setTitleDraft(null); } }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /></label>
        {(() => { const print = modelPrint(doc.nodes), stale = !!settings.revision && !!settings.revisedModel && settings.revisedModel !== print;
          const set = (rev: string) => onChange(rev ? { ...settings, revision: rev, revisedModel: print } : (({ revision: _r, revisedModel: _m, ...rest }) => rest)(settings));
          return <>
            <label className={FIELD}><span>Revision</span><Input className={CONTROL} aria-label="Revision" value={settings.revision ?? ''} placeholder="-" maxLength={6} onChange={e => set(e.target.value.trim().toUpperCase())} />
              <Button variant="ghost" aria-label="Next revision" data-tip="Next revision" data-tip-desc="A → B, 01 → 02: the drawing’s new issue" onClick={() => set(nextRevision(settings.revision))}>Next</Button></label>
            {stale && <div className="empty" style={{ color: 'var(--warn)' }} aria-label="Revision out of date">The model changed since revision {settings.revision}: give the drawing its next revision when you issue it.</div>}
          </>; })()}
        {layout && !layout.fits && <div className="empty" style={{ color: 'var(--warn)' }}>The views do not fit the sheet at {scaleLabel(layout.scale)}. Pick a smaller scale or a larger sheet.</div>}
  </>;
}
