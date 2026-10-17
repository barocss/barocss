import { useEffect, useState } from 'react';
import { analyzeCurve, analyzeSurface, curveLength, curvePlaneCrossings, directOps, domainsOf, geometryOf, surfaceIntersection, type DirectGeometry } from '../engine/direct';

/**
 * The tools for selected direct curves and surfaces: one curve (split, knot, trim, reverse, poles), two
 * curves (join, ruled surface, sweep), one surface (split, region, iso-curve, reverse, knot, degree,
 * poles). Each tool is one undoable edit; a refusal comes back as a message.
 */
export function DirectPanel({ direct, selected, onChange, onError, onHide, onThicken, onSew }: {
  direct: DirectGeometry; selected: string[];
  onChange(next: DirectGeometry, select?: string[]): void;
  onError(message: string): void;
  onHide(ids: string[]): void;
  /** A surface thickened into a body of the part. */
  onThicken?(id: string, thickness: number, side: 'normal' | 'reverse' | 'both'): void;
  /** Surfaces sewn along their edges into one closed body of the part (`tolerance` mm; 0: the kernel's own). */
  onSew?(ids: string[], tolerance: number): void;
}) {
  const [gap, setGap] = useState(0);
  const objs = selected.map(id => direct.objects.find(o => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);
  const geoms = objs.map(o => { try { return geometryOf(direct, o); } catch { return null; } });
  const run = (op: () => DirectGeometry, select?: (next: DirectGeometry) => string[]) => {
    try { const next = op(); onChange(next, select?.(next)); }
    catch (e) { onError(e instanceof Error ? e.message : String(e)); }
  };
  /** The objects an operation added (to select them). */
  const added = (next: DirectGeometry) => next.objects.slice(direct.objects.length).map(o => o.id);
  if (!objs.length) return null;
  const one = objs.length === 1 ? objs[0] : null, g = one ? geoms[0] : null;
  const curves = geoms.every(x => x?.kind === 'curve');
  return (
    <aside className="card props direct-panel" aria-label="Direct geometry">
      <div className="card-title">{one ? (g?.kind === 'surface' ? 'SURFACE' : 'CURVE') : `${objs.length} OBJECTS`}
        <button className="ghost tiny" onClick={() => onHide(selected)}>Hide</button></div>
      {one ? <Rename key={one.id} name={one.name} onRename={n => run(() => directOps.rename(direct, one.id, n))} />
        : objs.map(o => <div key={o.id} className="kv">Name <b>{o.name}</b></div>)}
      <Transform onMove={by => run(() => directOps.move(direct, selected, by))} onRotate={(axis, deg) => run(() => directOps.rotate(direct, selected, axis, deg))}
        onScale={k => run(() => directOps.scale(direct, selected, k))} onDuplicate={() => run(() => directOps.duplicate(direct, selected), added)}
        onStretch={k => run(() => directOps.stretch(direct, selected, k))} onShear={(a, b, k) => run(() => directOps.shear(direct, selected, a, b, k))} />
      {one && g?.kind === 'curve' && <CurveTools id={one.id} direct={direct} run={run} added={added} />}
      {one && g?.kind === 'surface' && <SurfaceTools id={one.id} direct={direct} run={run} added={added} onThicken={onThicken} />}
      {objs.length >= 3 && curves && <div className="render-section">
        <div className="card-title" style={{ marginTop: 8 }}>{objs.length} CURVES</div>
        <div className="row-actions">
          <button className="ghost" title="A surface through the curves in the order they were picked" onClick={() => run(() => directOps.loft(direct, selected), added)}>Loft</button>
          {objs.length === 4 && <button className="ghost" aria-label="Fill the loop" title="A surface filling the loop the four curves make (a Coons patch)" onClick={() => run(() => directOps.fill(direct, selected), added)}>Fill</button>}
        </div>
      </div>}
      {objs.length >= 2 && onSew && geoms.every(x => x?.kind === 'surface') && <div className="render-section">
        <div className="card-title" style={{ marginTop: 8 }}>SEW</div>
        <NumberField label="Gap" value={gap} onChange={setGap} />
        <button className="ghost" aria-label="Sew into a body" title="Join the surfaces along their edges into one closed solid (edges closer than the gap meet; 0 keeps it tight)" onClick={() => onSew(selected, gap)}>Sew into a body</button>
      </div>}
      {objs.length === 2 && geoms.every(x => x?.kind === 'surface') && <div className="render-section">
        <div className="card-title" style={{ marginTop: 8 }}>TWO SURFACES</div>
        <button className="ghost" aria-label="Intersect the surfaces" title="The curves where the two surfaces meet" onClick={() => run(() => surfaceIntersection(direct, selected[0], selected[1]).direct, added)}>Intersection curves</button>
      </div>}
      {objs.length === 2 && curves && <div className="render-section">
        <div className="card-title" style={{ marginTop: 8 }}>TWO CURVES</div>
        <div className="row-actions">
          <button className="ghost" onClick={() => run(() => directOps.joinCurves(direct, selected[0], selected[1]), added)}>Join</button>
          <button className="ghost" onClick={() => run(() => directOps.ruledSurface(direct, selected[0], selected[1]), added)}>Ruled surface</button>
          <button className="ghost" title="The first curve swept along the second" onClick={() => run(() => directOps.sweep(direct, selected[0], selected[1]), added)}>Sweep</button>
          <button className="ghost" title="A surface through both curves" onClick={() => run(() => directOps.loft(direct, selected), added)}>Loft</button>
        </div>
      </div>}
    </aside>
  );
}

type Run = (op: () => DirectGeometry, select?: (next: DirectGeometry) => string[]) => void;

/** A number box; lazy ones report on Enter or when left (an edit each, not one per keystroke). */
function NumberField({ label, value, onChange, lazy }: { label: string; value: number; onChange(v: number): void; lazy?: boolean }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const report = (t: string) => { const v = Number(t); if (t.trim() !== '' && Number.isFinite(v) && (!lazy || v !== value)) onChange(v); };
  return <label className="field"><span>{label}</span><input type="number" step="any" aria-label={label} value={text}
    onChange={e => { setText(e.target.value); if (!lazy) report(e.target.value); }}
    onBlur={() => { if (lazy) report(text); }} onKeyDown={e => { if (lazy && e.key === 'Enter') report(text); }} /></label>;
}

function CurveTools({ id, direct, run, added }: { id: string; direct: DirectGeometry; run: Run; added: (n: DirectGeometry) => string[] }) {
  const dom = domainsOf(direct, id), t = dom.kind === 'curve' ? dom.t : [0, 1] as [number, number];
  const mid = (t[0] + t[1]) / 2;
  const [at, setAt] = useState(mid), [from, setFrom] = useState(t[0]), [to, setTo] = useState(t[1]), [tol, setTol] = useState(0.01), [poles, setPoles] = useState(6);
  useEffect(() => { setAt(mid); setFrom(t[0]); setTo(t[1]); }, [id, t[0], t[1]]);
  const g = geometryOf(direct, direct.objects.find(o => o.id === id)!);
  return <div className="render-section">
    <div className="kv">Degree <b>{g.kind === 'curve' ? g.degree : ''}</b></div>
    <div className="kv">Domain <b>{t.map(v => Math.round(v * 1e4) / 1e4).join(' … ')}</b></div>
    <div className="kv">Length <b>{fmtNum(curveLength(direct, id), 4)} mm</b></div>
    {g.kind === 'curve' && (() => { const a = g.controlPoints[0], b = g.controlPoints[g.controlPoints.length - 1], chord = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = curveLength(direct, id);
      return <div className="kv">Chord <b>{fmtNum(chord, 4)} mm{chord > 1e-9 ? ` · length ${fmtNum(L / chord, 4)}×` : ' · closed'}</b></div>; })()}
    <NumberField label="At t" value={at} onChange={setAt} />
    <Analysis run={() => { const a = analyzeCurve(direct, id, at); return [['Point', a.point.map(v => fmtNum(v, 3)).join(', ')], ['Radius', a.radius === null ? 'straight' : `${fmtNum(a.radius, 4)} mm`]]; }} />
    <div className="row-actions">
      <button className="ghost" onClick={() => run(() => directOps.splitCurve(direct, id, at), added)}>Split</button>
      <button className="ghost" onClick={() => run(() => directOps.insertCurveKnot(direct, id, at))}>Insert knot</button>
      <button className="ghost" onClick={() => run(() => directOps.reverseCurve(direct, id), added)}>Reverse</button>
      <button className="ghost" onClick={() => run(() => directOps.elevateCurveDegree(direct, id))}>Raise degree</button>
    </div>
    <NumberField label="From t" value={from} onChange={setFrom} />
    <NumberField label="To t" value={to} onChange={setTo} />
    <button className="ghost" onClick={() => run(() => directOps.curveInterval(direct, id, from, to))}>Trim to interval</button>
    <div className="card-title" style={{ marginTop: 8 }}>SIMPLIFY</div>
    <NumberField label="Within mm" value={tol} onChange={setTol} />
    <button className="ghost" aria-label="Remove the knot" title="Take out the knot nearest t, if the curve moves no more than the tolerance" onClick={() => run(() => directOps.removeCurveKnot(direct, id, at, tol), added)}>Remove knot near t</button>
    <NumberField label="Poles" value={poles} onChange={setPoles} />
    <button className="ghost" aria-label="Refit the curve" title="Fit the curve again with this many poles (least squares, cubic): its name says the largest gap" onClick={() => run(() => directOps.refitCurve(direct, id, poles), added)}>Refit</button>
    <Crossings id={id} direct={direct} />
    {g.kind === 'curve' && <Poles rows={g.controlPoints.map((p, i) => ({ key: String(i), label: `P${i}`, point: p, weight: g.weights[i] }))}
      onEdit={(k, pole) => run(() => directOps.editCurvePole(direct, id, Number(k), pole))} />}
  </div>;
}

/** Where the curve crosses a plane square to X, Y or Z, at a value. */
function Crossings({ id, direct }: { id: string; direct: DirectGeometry }) {
  const [axis, setAxis] = useState<'x' | 'y' | 'z'>('z'), [at, setAt] = useState(0), [found, setFound] = useState<ReturnType<typeof curvePlaneCrossings> | null>(null), [note, setNote] = useState<string | null>(null);
  useEffect(() => { setFound(null); setNote(null); }, [id, axis, at]);
  return <>
    <div className="card-title" style={{ marginTop: 8 }}>CROSSINGS</div>
    <label className="field"><span>Plane</span><select aria-label="Crossing plane" value={axis} onChange={e => setAxis(e.target.value as 'x' | 'y' | 'z')}><option value="x">X =</option><option value="y">Y =</option><option value="z">Z =</option></select></label>
    <NumberField label="At" value={at} onChange={setAt} />
    <button className="ghost" aria-label="Find crossings" onClick={() => { try { setFound(curvePlaneCrossings(direct, id, axis, at)); } catch (e) { setFound(null); setNote(e instanceof Error ? e.message : String(e)); } }}>Find crossings</button>
    {note && !found && <div className="muted small">{note}</div>}
    {found && (found.length ? found.map((c, k) => <div key={k} className="kv" aria-label="Crossing">t {fmtNum(c.t, 5)} <b>{c.point.map(v => fmtNum(v, 3)).join(', ')}</b></div>) : <div className="muted small">The curve does not cross {axis.toUpperCase()} = {at}.</div>)}
  </>;
}

function SurfaceTools({ id, direct, run, added, onThicken }: { id: string; direct: DirectGeometry; run: Run; added: (n: DirectGeometry) => string[]; onThicken?(id: string, thickness: number, side: 'normal' | 'reverse' | 'both'): void }) {
  const [wall, setWall] = useState(2), [wallSide, setWallSide] = useState<'normal' | 'reverse' | 'both'>('normal');
  const [edge, setEdge] = useState<'u-min' | 'u-max' | 'v-min' | 'v-max'>('u-max'), [reach, setReach] = useState(5);
  const dom = domainsOf(direct, id), u = dom.kind === 'surface' ? dom.u : [0, 1] as [number, number], v = dom.kind === 'surface' ? dom.v : [0, 1] as [number, number];
  const [axis, setAxis] = useState<'u' | 'v'>('u');
  const range = axis === 'u' ? u : v, mid = (range[0] + range[1]) / 2;
  const [at, setAt] = useState(mid);
  const [box, setBox] = useState<[number, number, number, number]>([u[0], u[1], v[0], v[1]]);
  useEffect(() => { setAt(mid); }, [id, axis, mid]);
  useEffect(() => { setBox([u[0], u[1], v[0], v[1]]); }, [id, u[0], u[1], v[0], v[1]]);
  const g = geometryOf(direct, direct.objects.find(o => o.id === id)!);
  return <div className="render-section">
    {g.kind === 'surface' && <div className="kv">Degree <b>{g.degreeU} × {g.degreeV}</b></div>}
    <div className="kv">Domain <b>u {u.map(x => Math.round(x * 1e4) / 1e4).join('…')} · v {v.map(x => Math.round(x * 1e4) / 1e4).join('…')}</b></div>
    <label className="field"><span>Direction</span><select aria-label="Surface direction" value={axis} onChange={e => setAxis(e.target.value as 'u' | 'v')}><option value="u">U</option><option value="v">V</option></select></label>
    <NumberField label={`At ${axis}`} value={at} onChange={setAt} />
    <div className="row-actions">
      <button className="ghost" onClick={() => run(() => directOps.splitSurface(direct, id, axis, at), added)}>Split</button>
      <button className="ghost" onClick={() => run(() => directOps.isoCurve(direct, id, axis, at), added)}>Iso-curve</button>
      <button className="ghost" onClick={() => run(() => directOps.insertSurfaceKnot(direct, id, axis, at))}>Insert knot</button>
      <button className="ghost" onClick={() => run(() => directOps.elevateDegree(direct, id, axis))}>Raise degree</button>
      <button className="ghost" onClick={() => run(() => directOps.reverseSurface(direct, id, axis), added)}>Reverse</button>
    </div>
    <SurfacePoint id={id} direct={direct} u={u} v={v} />
    <div className="card-title" style={{ marginTop: 8 }}>EXTEND</div>
    <label className="field"><span>Edge</span><select aria-label="Extend edge" value={edge} onChange={e => setEdge(e.target.value as typeof edge)}>
      <option value="u-max">u end</option><option value="u-min">u start</option><option value="v-max">v end</option><option value="v-min">v start</option></select></label>
    <NumberField label="Extend by" value={reach} onChange={setReach} />
    <button className="ghost" aria-label="Extend the surface" title="Run the surface on past the edge, straight along its tangent there" onClick={() => run(() => directOps.extendSurface(direct, id, edge, reach), added)}>Extend</button>
    {onThicken && <>
      <div className="card-title" style={{ marginTop: 8 }}>THICKEN</div>
      <NumberField label="Thickness" value={wall} onChange={setWall} />
      <label className="field"><span>Side</span><select aria-label="Thicken side" value={wallSide} onChange={e => setWallSide(e.target.value as typeof wallSide)}>
        <option value="normal">Along the normal</option><option value="reverse">Against it</option><option value="both">Half each way</option></select></label>
      <button className="ghost" aria-label="Thicken into a body" onClick={() => onThicken(id, wall, wallSide)}>Thicken into a body</button>
    </>}
    <div className="card-title" style={{ marginTop: 8 }}>REGION</div>
    {(['u from', 'u to', 'v from', 'v to'] as const).map((l, k) => <NumberField key={l} label={l} value={box[k]} onChange={x => setBox(b => b.map((y, j) => j === k ? x : y) as typeof b)} />)}
    <button className="ghost" onClick={() => run(() => directOps.surfaceRegion(direct, id, [box[0], box[1]], [box[2], box[3]]), added)}>Extract region</button>
    {g.kind === 'surface' && <Poles rows={g.controlPoints.flatMap((row, i) => row.map((p, j) => ({ key: `${i},${j}`, label: `P${i},${j}`, point: p, weight: g.weights[i][j] })))}
      onEdit={(k, pole) => { const [i, j] = k.split(',').map(Number); run(() => directOps.editSurfacePole(direct, id, i, j, pole)); }} />}
  </div>;
}

/** Control points: pick one, edit its position and weight. */
function Poles({ rows, onEdit }: { rows: { key: string; label: string; point: readonly number[]; weight: number }[]; onEdit(key: string, pole: { xMM?: number; yMM?: number; zMM?: number; weight?: number }): void }) {
  const [pick, setPick] = useState(rows[0]?.key ?? '');
  const row = rows.find(r => r.key === pick) ?? rows[0];
  if (!row) return null;
  return <>
    <div className="card-title" style={{ marginTop: 8 }}>CONTROL POINT</div>
    <label className="field"><span>Point</span><select aria-label="Control point" value={row.key} onChange={e => setPick(e.target.value)}>{rows.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
    {(['xMM', 'yMM', 'zMM'] as const).map((f, k) => <NumberField key={f} lazy label={'XYZ'[k]} value={row.point[k]} onChange={x => onEdit(row.key, { [f]: x })} />)}
    <NumberField lazy label="Weight" value={row.weight} onChange={x => { if (x > 0) onEdit(row.key, { weight: x }); }} />
  </>;
}

const fmtNum = (v: number, digits: number) => String(Math.round(v * 10 ** digits) / 10 ** digits);

/** Values of a query at the current inputs, or why it has none there. */
function Analysis({ run }: { run(): [string, string][] }) {
  let rows: [string, string][];
  try { rows = run(); } catch (e) { return <div className="muted small">{e instanceof Error ? e.message : String(e)}</div>; }
  return <>{rows.map(([k, v]) => <div key={k} className="kv">{k} <b>{v}</b></div>)}</>;
}

/** A surface at (u, v): point, normal and curvatures. */
function SurfacePoint({ id, direct, u, v }: { id: string; direct: DirectGeometry; u: [number, number]; v: [number, number] }) {
  const [at, setAt] = useState<[number, number]>([(u[0] + u[1]) / 2, (v[0] + v[1]) / 2]);
  useEffect(() => setAt([(u[0] + u[1]) / 2, (v[0] + v[1]) / 2]), [id, u[0], u[1], v[0], v[1]]);
  return <>
    <div className="card-title" style={{ marginTop: 8 }}>AT (U, V)</div>
    <NumberField label="u" value={at[0]} onChange={x => setAt([x, at[1]])} />
    <NumberField label="v" value={at[1]} onChange={x => setAt([at[0], x])} />
    <Analysis run={() => { const a = analyzeSurface(direct, id, at[0], at[1]); return [['Point', a.point.map(x => fmtNum(x, 3)).join(', ')], ['Normal', a.normal.map(x => fmtNum(x, 4)).join(', ')], ['Mean curvature', `${fmtNum(a.mean, 6)} /mm`], ['Gaussian', `${fmtNum(a.gaussian, 8)} /mm²`]]; }} />
  </>;
}

function Rename({ name, onRename }: { name: string; onRename(n: string): void }) {
  const [text, setText] = useState(name);
  return <label className="field"><span>Name</span><input aria-label="Object name" value={text} onChange={e => setText(e.target.value)}
    onBlur={() => { if (text.trim() && text !== name) onRename(text); }} onKeyDown={e => { if (e.key === 'Enter' && text.trim() && text !== name) onRename(text); }} /></label>;
}

/** Move by a vector, turn about an axis through the centre, scale about the centre, or duplicate. */
type Ax = 'x' | 'y' | 'z';
function Transform({ onMove, onRotate, onScale, onDuplicate, onStretch, onShear }: { onMove(by: [number, number, number]): void; onRotate(axis: Ax, deg: number): void; onScale(k: number): void; onDuplicate(): void; onStretch(k: [number, number, number]): void; onShear(along: Ax, by: Ax, k: number): void }) {
  const [st, setSt] = useState<[number, number, number]>([1, 1, 2]), [along, setAlong] = useState<Ax>('x'), [byAx, setByAx] = useState<Ax>('z'), [sk, setSk] = useState(0.5);
  const axisPick = (label: string, v: Ax, set: (a: Ax) => void) => <label className="field"><span>{label}</span><select aria-label={label} value={v} onChange={e => set(e.target.value as Ax)}><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>;
  const [by, setBy] = useState<[number, number, number]>([0, 0, 10]);
  const [axis, setAxis] = useState<'x' | 'y' | 'z'>('z'), [deg, setDeg] = useState(90), [k, setK] = useState(2);
  return <div className="render-section">
    <div className="card-title" style={{ marginTop: 8 }}>TRANSFORM</div>
    {(['ΔX', 'ΔY', 'ΔZ'] as const).map((l, i) => <NumberField key={l} label={l} value={by[i]} onChange={x => setBy(b => b.map((y, j) => j === i ? x : y) as typeof b)} />)}
    <button className="ghost" onClick={() => onMove(by)}>Move</button>
    <label className="field"><span>Axis</span><select aria-label="Rotation axis" value={axis} onChange={e => setAxis(e.target.value as 'x' | 'y' | 'z')}><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></label>
    <NumberField label="Angle °" value={deg} onChange={setDeg} />
    <button className="ghost" onClick={() => onRotate(axis, deg)}>Rotate</button>
    <NumberField label="Factor" value={k} onChange={setK} />
    <div className="row-actions"><button className="ghost" onClick={() => onScale(k)}>Scale</button><button className="ghost" onClick={onDuplicate}>Duplicate</button></div>
    {(['× X', '× Y', '× Z'] as const).map((l, i) => <NumberField key={l} label={l} value={st[i]} onChange={x => setSt(b => b.map((y, j) => j === i ? x : y) as typeof b)} />)}
    <button className="ghost" onClick={() => onStretch(st)}>Stretch</button>
    {axisPick('Shear moves', along, setAlong)}{axisPick('by', byAx, setByAx)}
    <NumberField label="Shear factor" value={sk} onChange={setSk} />
    <button className="ghost" onClick={() => onShear(along, byAx, sk)}>Shear</button>
  </div>;
}
