// The References card in the Browser (A6.3, O26): the part's locked reference bodies (shown ghosted in the viewport),
// each placed by the user (an explicit, recorded placement), its datums taken from its faces, and the keep-outs with
// their verdicts — clear, violated or undecided, the chord tolerance said.
import { useState } from 'react';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { KeepoutResult, Placement, ReferenceSet } from '@barocss/cad-model/engine/schema/references';

export interface ReferencesPanelProps {
  set: ReferenceSet;
  /** Each reference's bodies in its own coordinates (their faces offered for datums). */
  local: ReadonlyMap<string, readonly BodyResult[]>;
  verdicts: readonly KeepoutResult[] | null;
  onAddFile(file: File): void;
  onPlace(id: string, at: Placement): void;
  onDatum(reference: string, face: string, kind: 'plane' | 'axis' | 'point'): void;
  onEnvelope(reference: string, offset: number, clearance: number): void;
  onRemove(id: string): void;
}

const num = (v: string, d: number) => { const x = Number(v); return Number.isFinite(x) ? x : d; };

export function ReferencesPanel(p: ReferencesPanelProps) {
  const [face, setFace] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<Record<string, 'plane' | 'axis' | 'point'>>({});
  const [offset, setOffset] = useState<Record<string, string>>({});
  const counts = p.verdicts ? { violated: p.verdicts.filter(v => v.verdict === 'violated').length, undecided: p.verdicts.filter(v => v.verdict === 'undecided').length } : null;
  return <div className="references" role="region" aria-label="Reference bodies">
    <div className="ol-head specify-head">Reference bodies <span className="muted" aria-label="Reference bodies summary">{p.set.references.length} · {p.set.datums.length} datums · {p.set.keepouts.length} keep-outs{counts && (counts.violated || counts.undecided) ? ` · ${counts.violated} violated, ${counts.undecided} undecided` : ''}</span>
      <label className="tool tiny" data-tip="Add a reference (STEP, STL or OBJ, mm)"><input type="file" aria-label="Add reference" accept=".step,.stp,.stl,.obj" hidden onChange={e => { const f = e.target.files?.[0]; if (f) p.onAddFile(f); e.target.value = ''; }} />＋</label></div>
    {p.set.references.map(r => {
      const faces = (p.local.get(r.id) ?? []).flatMap(b => b.mesh.faces), at = r.at;
      return <div key={r.id} className="req" role="listitem" aria-label={`Reference ${r.id}`}>
        <span className="req-row"><span className="req-mark">◇</span><b>{r.id}</b> {r.name} <span className="muted">· locked · {'step' in r.source ? 'STEP' : 'mesh'} · {faces.length} faces</span></span>
        {(['position', 'rotation'] as const).map(k => <span key={k} className="req-edit ref-at"><span className="muted ref-at-label">{k === 'position' ? 'at mm' : 'turn °'}</span>
          {[0, 1, 2].map(i => <input key={i} aria-label={`${r.id} ${k} ${'xyz'[i]}`} type="number" step="any" defaultValue={at[k][i]}
            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { const next: Placement = { position: [...at.position], rotation: [...at.rotation] }; next[k][i] = num(e.currentTarget.value, at[k][i]); p.onPlace(r.id, next); } }} />)}
        </span>)}
        <span className="req-edit">
          <select aria-label={`${r.id} datum face`} value={face[r.id] ?? ''} onChange={e => setFace(f => ({ ...f, [r.id]: e.target.value }))}><option value="">face…</option>{faces.map(f => <option key={f.name} value={f.name}>{f.name} ({f.kind}{f.radius ? ` r${Math.round(f.radius * 100) / 100}` : ''})</option>)}</select>
          <select aria-label={`${r.id} datum kind`} value={kind[r.id] ?? 'plane'} onChange={e => setKind(k => ({ ...k, [r.id]: e.target.value as 'plane' | 'axis' | 'point' }))}><option value="plane">plane</option><option value="axis">axis</option><option value="point">point</option></select>
          <button className="ghost small" aria-label={`${r.id} add datum`} disabled={!face[r.id]} onClick={() => p.onDatum(r.id, face[r.id], kind[r.id] ?? 'plane')}>Datum</button>
        </span>
        <span className="req-edit">
          <input aria-label={`${r.id} envelope offset`} type="number" step="any" placeholder="offset" value={offset[r.id] ?? ''} onChange={e => setOffset(o => ({ ...o, [r.id]: e.target.value }))} onKeyDown={e => e.stopPropagation()} />
          <button className="ghost small" aria-label={`${r.id} add keep-out`} onClick={() => p.onEnvelope(r.id, num(offset[r.id] ?? '0', 0), 0)}>Keep-out</button>
          <button className="ghost small" aria-label={`Remove ${r.id}`} onClick={() => p.onRemove(r.id)}>Remove</button>
        </span>
      </div>;
    })}
    {p.set.datums.map(d => <div key={d.id} className="req pass" role="listitem" aria-label={`Datum ${d.id}`}>
      <span className="req-row"><span className="req-mark">⌖</span><b>{d.id}</b> {d.name !== d.id ? d.name : ''} <span className="muted">· {d.kind}{d.of ? ` of ${d.of.reference} ${d.of.face ?? 'vertex'}` : ''}{d.radius ? ` · r ${Math.round(d.radius * 1000) / 1000}` : ''}{d.residualMM !== undefined ? ` · fit ${d.residualMM === 0 ? 'exact' : `${d.residualMM.toPrecision(2)} mm`}` : ''}</span></span>
      <span className="req-edit"><button className="ghost small" aria-label={`Remove ${d.id}`} onClick={() => p.onRemove(d.id)}>Remove</button></span>
    </div>)}
    {p.set.keepouts.map(k => {
      const v = p.verdicts?.filter(x => x.keepout === k.id) ?? [], worst = v.find(x => x.verdict === 'violated') ?? v.find(x => x.verdict === 'undecided') ?? v[0];
      return <div key={k.id} className={'req ' + (!worst ? 'unknown' : worst.verdict === 'clear' ? 'pass' : worst.verdict === 'violated' ? 'fail' : 'unknown')} role="listitem" aria-label={`Keep-out ${k.id}`}>
        <span className="req-row" title={worst?.why ?? ''}><span className="req-mark">{!worst ? '…' : worst.verdict === 'clear' ? '✓' : worst.verdict === 'violated' ? '✗' : '?'}</span><b>{k.id}</b> {k.name !== k.id ? k.name : ''} <span className="muted">· {k.shape.kind}{k.around ? ` around ${k.around.reference} +${k.around.offset}` : ''} · clearance {k.clearance}{worst ? ` · ${worst.verdict}${worst.clearanceMM !== null ? `, ${Math.round(worst.clearanceMM * 1000) / 1000} mm` : ''}${worst.chordMM ? ` (±${worst.chordMM === Infinity ? '?' : Math.round(worst.chordMM * 1e4) / 1e4})` : ''}` : ''}</span></span>
        <span className="req-edit"><button className="ghost small" aria-label={`Remove ${k.id}`} onClick={() => p.onRemove(k.id)}>Remove</button></span>
      </div>;
    })}
  </div>;
}
