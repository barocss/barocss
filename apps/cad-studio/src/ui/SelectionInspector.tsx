import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { fmt, type StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import { selectedBodies, refOf, type Selection } from '@barocss/cad-model/app/commands';
import { BODY_COLOURS, bodyName, lookOf, materialIdOf, withLook } from '@barocss/cad-model/app/bodies';
import { bodyMass, combined, inertiaAbout, sig3 } from '@barocss/cad-model/app/mass';
import { measureItem } from '@barocss/cad-model/app/measure';
import { boundsOf } from '@barocss/cad-model/engine/bounds';
import { MATERIALS } from '@barocss/cad-model/library/materials';
import { briefMaterial } from '@barocss/cad-model/chat/brief';
import { fastenerName, fastenerThread } from '@barocss/cad-model/app/fasteners';
import { fastenerSizesOf } from '@barocss/cad-model/engine/fastenerSizeRows';
import { emptySel } from '../app/studioConstants';
import { PointTest } from './PointTest';
import { Icon } from './atoms';
interface SelectionInspectorProps {
  model: { doc: StudioDoc; evaluated: StudioDoc; bodies: BodyResult[]; fresh: boolean; busy: boolean; massReady: boolean };
  selection: Selection;
  materialSettings: { material: string; setMaterial: Dispatch<SetStateAction<string>> };
  display: { showBox: boolean; setShowBox: Dispatch<SetStateAction<boolean>>; inertiaAt: 'centre' | 'origin'; setInertiaAt: Dispatch<SetStateAction<'centre' | 'origin'>> };
  changes: { commit(next: StudioDoc): boolean; setSelection: Dispatch<SetStateAction<Selection>>; edgesToCurves(): void; loadBendTable(body: BodyResult, file?: File): Promise<void>; setFlatView(key: string): void; setCutListView(open: boolean): void; separate(body: BodyResult): void };
  children: ReactNode;
}
/** Properties of the accepted selection; document adoption and feature editing stay in App. */
export function SelectionInspector({ model, selection, materialSettings, display, changes, children }: SelectionInspectorProps) {
  const { doc, evaluated, bodies, fresh, busy, massReady } = model;
  const { material, setMaterial } = materialSettings;
  const { showBox, setShowBox, inertiaAt, setInertiaAt } = display;
  const { commit, setSelection, edgesToCurves, loadBendTable, setFlatView, setCutListView, separate } = changes;
  const density = MATERIALS.find(m => m.id === material) ?? MATERIALS[0];
  const sel1 = selection.faces[0] ? { kind: 'face' as const, body: bodies[selection.faces[0].body], face: bodies[selection.faces[0].body]?.mesh.faces[selection.faces[0].face] }
    : selection.edges[0] ? { kind: 'edge' as const, body: bodies[selection.edges[0].body], edge: bodies[selection.edges[0].body]?.mesh.edges[selection.edges[0].edge] } : null;
  const selBodies = selectedBodies(selection).map(i => bodies[i]).filter(Boolean);
  return <aside className="card props" aria-label="Selection">
        {selection.vertices?.length ? (<>
          <div className="card-title">SELECTION · {selection.vertices.length === 1 ? 'POINT' : `${selection.vertices.length} POINTS`}</div>
          {selection.vertices.map((v, k) => <div key={k} className="kv">{selection.vertices!.length > 1 ? `Point ${k + 1}` : 'X Y Z'} <b>{v.at.map(x => fmt(Math.round(x * 1000) / 1000)).join(', ')}</b></div>)}
          {selection.vertices.length === 2 && (() => { const [a, b] = selection.vertices!.map(v => v.at), d = [0, 1, 2].map(k => b[k] - a[k]); return <><div className="kv">Distance <b>{fmt(Math.round(Math.hypot(d[0], d[1], d[2]) * 1000) / 1000)} mm</b></div><div className="kv">ΔX ΔY ΔZ <b>{d.map(x => fmt(Math.round(x * 1000) / 1000)).join(', ')}</b></div></>; })()}
        </>) : sel1?.kind === 'face' && sel1.face ? (<>
          <div className="card-title">SELECTION · FACE</div>
          <div className="kv">Type <b>{sel1.face.kind === 'plane' ? 'Planar' : 'Curved'}</b></div>
          {sel1.face.kind === 'plane' && <div className="kv">Normal <b>{sel1.face.normal.map(v => fmt(Math.round(v * 1000) / 1000)).join(', ')}</b></div>}
          <div className="kv">Area <b>{fmt(Math.round(sel1.face.area * 100) / 100)} mm²</b></div>
          {sel1.face.radius !== undefined && <div className="kv">Radius <b>{fmt(Math.round(sel1.face.radius * 1000) / 1000)} mm</b></div>}
          {(() => { const b = bodies[selection.faces[0]?.body], name = sel1.face.name, faces = b ? lookOf(doc, b).faces ?? {} : {}, cur = faces[name];
            const set = (c?: string) => { if (!b) return; const next = { ...faces }; if (c) next[name] = c; else delete next[name]; commit(withLook(doc, b, { faces: Object.keys(next).length ? next : undefined })); };
            return b ? <div className="kv">Face colour <span className="swatches" role="group" aria-label="Face colour">
              <button className={'swatch none' + (cur ? '' : ' on')} aria-label="No face colour" data-tip="The body's colour" onClick={() => set()} />
              {BODY_COLOURS.map(c => <button key={c} className={'swatch' + (cur === c ? ' on' : '')} style={{ background: c }} aria-label={'Face colour ' + c} onClick={() => set(c)} />)}
            </span></div> : null; })()}
        </>) : sel1?.kind === 'edge' && sel1.edge ? (<>
          <div className="card-title">SELECTION · EDGE</div>
          {(() => { const it = measureItem(sel1.body.mesh, { body: selection.edges[0].body, edge: selection.edges[0].edge }); return <>
            <div className="kv">Type <b>{it.label}</b></div>
            {it.length !== undefined && <div className="kv">Length <b>{fmt(Math.round(it.length * 100) / 100)} mm</b></div>}
            {it.radius !== undefined && <div className="kv">Radius <b>{fmt(Math.round(it.radius * 1000) / 1000)} mm</b></div>}
          </>; })()}
          {sel1.edge.axis && <div className="kv">Direction <b>{sel1.edge.axis.toUpperCase()}</b></div>}
          <div className="kv"><span /><button className="ghost small" aria-label="Edge as a curve" data-tip="As a curve" data-tip-desc="A copy of this edge as a curve in space (a line, an arc or the polyline), for surfaces" onClick={() => edgesToCurves()}>As a curve</button></div>
        </>) : null}
        {selBodies.length > 0 && !fresh && <><div className="card-title" style={{ marginTop: sel1 ? 10 : 0 }}>BODY</div>
          <div className="empty" aria-busy="true">{busy ? 'Evaluating… its values show once the part is up to date.' : 'The part did not evaluate: fix it, or undo, to see this body\'s values.'}</div></>}
        {selBodies.length > 0 && fresh && <>
          <div className="card-title" style={{ marginTop: sel1 ? 10 : 0 }}>BODY{selBodies.length > 1 ? ` · ${selBodies.length} selected` : ''}</div>
          {selBodies.slice(0, 1).map(b => { const { min, max } = b.mesh.bounds, look = lookOf(doc, b); return <div key={b.key}>
            <label className="kv">Name <input className="kv-input" aria-label="Name" key={b.key + bodyName(doc, b)} defaultValue={bodyName(doc, b)}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); e.stopPropagation(); }}
              onBlur={e => { const v = e.currentTarget.value.trim(); if (v !== bodyName(doc, b)) commit(withLook(doc, b, { name: v })); }} /></label>
            <div className="kv">Colour <span className="swatches" role="group" aria-label="Colour">
              <button className={'swatch none' + (look.color ? '' : ' on')} aria-label="No colour" data-tip="Default grey" onClick={() => commit(withLook(doc, b, { color: undefined }))} />
              {BODY_COLOURS.map(c => <button key={c} className={'swatch' + (look.color === c ? ' on' : '')} style={{ background: c }} aria-label={'Colour ' + c} onClick={() => commit(withLook(doc, b, { color: c }))} />)}
              <label className="swatch pick" data-tip="Any colour" style={look.color && !(BODY_COLOURS as readonly string[]).includes(look.color) ? { background: look.color } : undefined}>
                <input type="color" aria-label="Any colour" value={look.color ?? '#bcc0c7'} onChange={e => commit(withLook(doc, b, { color: e.target.value }))} /></label>
            </span></div>
            <label className="kv">Visible <input type="checkbox" checked={!look.hidden} onChange={e => { if (!commit(withLook(doc, b, { hidden: !e.target.checked }))) return; if (!e.target.checked) setSelection(emptySel); }} /></label>
            <label className="kv"><span>Bounds <b>{fmt(max[0] - min[0])} × {fmt(max[1] - min[1])} × {fmt(max[2] - min[2])}</b></span><span className="kv-check"><input type="checkbox" aria-label="Show the bounding box" checked={showBox} onChange={e => setShowBox(e.target.checked)} /> box</span></label>
            {/* (O18: a mass still being worked out reads "…", never 0 or the last revision's.) */}
            {b.volume !== null ? <div className="kv">Volume <b>{fmt(Math.round(b.volume))} mm³</b></div> : b.massRef !== undefined ? <div className="kv">Volume <b aria-label="Mass pending">…</b></div> : null}
            {/* (O179: a volume the kernel found from the mesh, said so with its bound — its mass is as good.) */}
            {b.volume !== null && b.volumeBasis && <div className="kv warn" aria-label="Volume basis" title="The kernel could not integrate this body: its volume, mass and centre of mass are from the display mesh">From the mesh <b>± {b.volumeBasis.bound === null ? '?' : fmt(Math.round(b.volumeBasis.bound * 10) / 10)} mm³</b></div>}
            {(() => { const own = MATERIALS.find(m => m.id === materialIdOf(doc, b)) ?? density; return <>
              {b.volume !== null ? <div className="kv">Mass <b>{fmt(Math.round(b.volume * own.density / 100) / 10)} g</b></div> : b.massRef !== undefined ? <div className="kv">Mass <b>…</b></div> : null}
              {/* The body's own material (the default for new bodies stays the studio's). */}
              <label className="kv"><span>Material{!look.material && <span className="muted"> · {briefMaterial(doc) ? 'from the brief' : 'default'}</span>}</span><select aria-label="Material" value={own.id} onChange={e => commit(withLook(doc, b, { material: e.target.value === (briefMaterial(doc) ?? material) ? undefined : e.target.value }))}>{MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
              {own.id !== material && <div className="kv"><span /><button className="ghost small" onClick={() => setMaterial(own.id)} data-tip="Default material" data-tip-desc="Bodies without a material of their own use it">Use as default</button></div>}
            </>; })()}
            {(() => { const top = evaluated.nodes[refOf(b).node], made = top && 'made' in top ? top.made : undefined, sizes = fastenerSizesOf(doc), t = made?.command === 'fastener' ? fastenerThread(made.values, sizes) : null;
              return t ? <><div className="kv">Part <b>{fastenerName(made!.values, sizes)}</b></div><div className="kv">Thread <b>M{t.d}×{t.pitch} {t.hand} · {t.internal ? 'internal' : 'external'}</b></div><div className="kv muted">Cosmetic thread: no helical geometry; nominal sizes from your fastener rows — check the standard before manufacture.</div></> : null; })()}
            {b.centroid ? <div className="kv">Centre of mass <b>{b.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div> : b.massRef !== undefined ? <div className="kv">Centre of mass <b>…</b></div> : null}
            {(() => { const own = MATERIALS.find(m => m.id === materialIdOf(doc, b)) ?? density, mp = bodyMass(b, own.density); if (!mp) return null;
              const I = inertiaAt === 'origin' ? inertiaAbout(mp.inertia, mp.mass, mp.centroid, [0, 0, 0]) : mp.inertia;
              return <>
                <label className="kv"><span>Inertia</span><select aria-label="Inertia about" value={inertiaAt} onChange={e => setInertiaAt(e.target.value as 'centre' | 'origin')}><option value="centre">about the centre of mass</option><option value="origin">about the origin</option></select></label>
                <div className="kv inertia" aria-label="Moments of inertia">Ixx Iyy Izz <b>{[0, 1, 2].map(k => sig3(I[k][k])).join(' · ')} g·mm²</b></div>
                <div className="kv inertia muted">Ixy Iyz Ixz <b>{[[0, 1], [1, 2], [0, 2]].map(([i, j]) => sig3(I[i][j], Math.max(I[0][0], I[1][1], I[2][2]))).join(' · ')}</b></div>
              </>; })()}
            {/* (The kernel's area over the exact surfaces, as mass properties; the display mesh's only where it cannot, said.) */}
            <div className="kv" title={b.areaBasis === 'display mesh' ? 'From the display mesh: the kernel could not integrate this body' : 'Over the exact surfaces'}>Surface area <b>{fmt(Math.round(b.area ?? b.mesh.faces.reduce((t, f) => t + f.area, 0)))} mm²{b.areaBasis === 'display mesh' ? ' (mesh)' : ''}</b></div>
            <div className="kv">Faces <b>{b.mesh.faces.length}</b></div>
            {b.notes?.map((n, k) => <div key={k} className={'hint' + (n.warning ? ' warn' : ' muted')} aria-label="Generator note">{n.warning && <Icon name="warning" small />} {n.text}</div>)}
            {b.sheet && <div className="kv"><span>K <b>{b.sheet.bendTable ? `bend table ${b.sheet.bendTable}` : b.sheet.kFactor}</b></span><label className="ghost small" data-tip="Bend table" data-tip-desc="Load your shop's bend table (JSON: rows of thickness, radius and angle to K, allowance or deduction, each citing a source or marked an estimate) for this sheet's bends">Bend table…<input type="file" accept=".json,application/json" aria-label="Bend table file" style={{ display: 'none' }} onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ''; void loadBendTable(b, file); }} /></label></div>}
            {b.flat && <div className="kv"><span>Flat pattern <b>{fmt(Math.round(b.flat.box.max[0] * 100) / 100)} × {fmt(Math.round(b.flat.box.max[1] * 100) / 100)}</b></span><button className="ghost small" aria-label="Show the flat pattern" data-tip="Flat pattern" data-tip-desc="The sheet unfolded: its outline, bend lines and notes; export it as DXF" onClick={() => setFlatView(b.key)}>Flat</button></div>}
            {b.cutPiece && <div className="kv"><span>Cut list <b>{fmt(Math.round(b.cutPiece.axisLength * 100) / 100)} mm</b></span><button className="ghost small" aria-label="Show the cut list" data-tip="Cut list" data-tip-desc="The frame's members to cut: identical ones on a row, their lengths, end cuts and mass; export it as CSV" onClick={() => setCutListView(true)}>Cut list</button></div>}
            <PointTest mesh={b.mesh} />
            {b.pieces && <div className="kv"><span>Pieces <b>{b.pieces}</b></span><button className="ghost small" aria-label="Separate the pieces" data-tip="Separate" data-tip-desc="Make each piece a body of its own (to move, colour or cut on its own)" onClick={() => separate(b)}>Separate</button></div>}
          </div>; })}
          {selBodies.length > 1 && selBodies.some(b => b.massRef !== undefined) && <div className="kv">Together <b aria-label="Mass pending">…</b></div>}
          {selBodies.length > 1 && !selBodies.some(b => b.massRef !== undefined) && (() => { const parts = selBodies.flatMap(b => { const m = bodyMass(b, (MATERIALS.find(x => x.id === materialIdOf(doc, b)) ?? density).density); return m ? [m] : []; }), c = combined(parts), box = boundsOf(selBodies);
            return c && box ? <><div className="kv">Together <b>{fmt(Math.round(c.mass * 10) / 10)} g</b></div><div className="kv">Centre of mass <b>{c.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>
              <div className="kv">Bounds <b>{[0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ')}</b></div></> : null; })()}
        </>}
        {!sel1 && !selBodies.length && bodies.length > 0 && fresh && !massReady && <div className="part-summary"><div className="card-title">PART · {bodies.length} {bodies.length === 1 ? 'body' : 'bodies'}</div><div className="kv">Mass <b aria-label="Mass pending">…</b></div></div>}
        {!sel1 && !selBodies.length && bodies.length > 0 && fresh && massReady && (() => { const parts = bodies.flatMap(b => { const m = bodyMass(b, (MATERIALS.find(x => x.id === materialIdOf(doc, b)) ?? density).density); return m ? [m] : []; }), c = combined(parts), box = boundsOf(bodies);
          return c && box ? <div className="part-summary"><div className="card-title">PART · {bodies.length} {bodies.length === 1 ? 'body' : 'bodies'}</div>
            <div className="kv">Mass <b>{fmt(Math.round(c.mass * 10) / 10)} g</b></div><div className="kv">Centre of mass <b>{c.centroid.map(v => fmt(Math.round(v * 100) / 100)).join(', ')}</b></div>
            <label className="kv"><span>Bounds <b>{[0, 1, 2].map(k => fmt(Math.round((box.max[k] - box.min[k]) * 100) / 100)).join(' × ')}</b></span><span className="kv-check"><input type="checkbox" aria-label="Show the bounding box" checked={showBox} onChange={e => setShowBox(e.target.checked)} /> box</span></label></div> : null; })()}
        {children}
      </aside>;
}
