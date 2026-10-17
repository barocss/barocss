import { planeLabel } from '../sketch/plane';
import { isConvex } from '../sketch/loops';
import { useMemo, useState } from 'react';
import type { SketchAnchor, SketchShape, SketchState } from '../viewport/Viewport';
import { arcOf, arcPairs, canBeTangent, inferredHV, radiusToBulge, samePair, type ArcPair, type P2, type SolveResult } from '../sketch/profile';
import { isSettled, redundancy, solveShape, type SketchPick } from '../sketch/rules';
import { ConstraintTools } from './ConstraintTools';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;
const NONE: SketchPick[] = [];

/**
 * Numbers drive the profile. Closed outlines are solved by the kernel's numerical sketch solver:
 * point 1 is anchored, drawn H/V edges stay H/V, typed lengths and radii become locked dimensions and
 * tangent joints stay tangent. The app settles every edit (see sketch/settle.ts) and reports `error`.
 */
export function SketchPanel({ sketch, error, onShape, onPlace, onUi, onOffset, onUseOutline }: { sketch: SketchState; error: string | null; onShape(shape: SketchShape | null): void; onPlace?(kind: SketchAnchor['kind'], offset: number, angle?: number): void;
  /** Sets the picked outline entities or the dimension being edited in the viewport. */
  onUi?(patch: Pick<SketchState, 'picked' | 'editDim'>): void;
  /** Offsets the newest closed shape by `d` mm (out when positive) as a shape beside it. */
  onOffset?(d: number): void;
  /** Adds the face's own outline and holes (as references when `asRefs`); absent when not sketching on a face as it is. */
  onUseOutline?(asRefs: boolean): void }) {
  const [offsetBy, setOffsetBy] = useState(2);
  const s = sketch.shape;
  const num = (id: string, label: string, value: number, set: (v: number) => void, min?: number) => (
    <label className="field" key={id}><span>{label}</span>
      <span className="num"><input id={'sk-' + id} type="number" step="any" min={min} value={round(value)}
        onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) set(v); }} /><em>mm</em></span></label>);
  const solved = useMemo(() => isSettled(s) ? solveShape(s) : null, [s]);
  const status = statusOf(s, solved);
  const constraints = s && !isSettled(s) ? inferred(s) : [];

  const lock = (poly: Polygon, key: 'lengths' | 'radii', i: number, value: number | null) => {
    const next = { ...(poly[key] ?? {}) };
    if (value === null) delete next[i]; else next[i] = value;
    onShape({ ...poly, [key]: next });
  };
  /** An open chain has no solve yet: its arc radius reshapes the bulge directly. */
  const bendOpenArc = (poly: Polygon, i: number, r: number) => {
    const n = poly.points.length, bulges = [...(poly.bulges ?? poly.points.map(() => 0))];
    const b = radiusToBulge(poly.points[i] as P2, poly.points[(i + 1) % n] as P2, r, Math.sign(bulges[i]));
    if (b === null) return;
    bulges[i] = Math.abs(bulges[i]) > 1 ? 1 / b : b; // keep a major arc major
    onShape({ ...poly, bulges });
  };
  const togglePair = (poly: Polygon, key: 'equalRadii' | 'concentric', pair: ArcPair) => {
    const list = poly[key] ?? [];
    onShape({ ...poly, [key]: list.some(p => samePair(p, pair)) ? list.filter(p => !samePair(p, pair)) : [...list, pair] });
  };
  const toggleTangent = (poly: Polygon, j: number) => {
    const t = poly.tangents ?? [];
    onShape({ ...poly, tangents: t.includes(j) ? t.filter(x => x !== j) : [...t, j].sort((a, b) => a - b) });
  };

  return (
    <aside className="card props sk-panel" aria-label="Sketch">
      <div className="card-title">SKETCH · {planeLabel(sketch.plane)}{sketch.base ? ' · on face' : ''}</div>
      {onPlace && (() => {
        const anchor = sketch.anchor ?? { kind: 'xy' as const, offset: 0 };
        return <div className="sk-plane">
          <label className="field"><span>Plane</span>
            <select aria-label="Sketch plane" value={anchor.kind} onChange={e => onPlace(e.target.value as SketchAnchor['kind'], anchor.offset, anchor.angle)}>
              {anchor.face && <option value="face">Selected face</option>}
              <option value="xy">XY (top)</option><option value="xz">XZ (front)</option><option value="yz">YZ (right)</option>
            </select></label>
          <label className="field"><span>Offset</span>
            <span className="num"><input aria-label="Plane offset" type="number" step="any" value={round(anchor.offset)}
              onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && Math.abs(v) <= 10000) onPlace(anchor.kind, v, anchor.angle); }} /><em>mm</em></span></label>
          <label className="field"><span>Angle</span>
            <span className="num"><input aria-label="Plane angle" type="number" step={5} min={-89} max={89} value={round(anchor.angle ?? 0)}
              onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && Math.abs(v) < 90) onPlace(anchor.kind, anchor.offset, v); }} /><em>°</em></span></label>
        </div>;
      })()}
      {!s && <div className="empty">Pick a tool on the left and click on the plane. Points snap to 1 mm.</div>}
      {s && <div className={'sk-status' + (status.warn ? ' open' : '')} role="status"><i />{status.text}</div>}
      {error && <div className="sk-status open" role="alert"><i />{error}</div>}
      {s?.kind === 'rectangle' && (() => {
        const x0 = Math.min(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), w = Math.abs(s.b[0] - s.a[0]), h = Math.abs(s.b[1] - s.a[1]);
        const put = (nx: number, ny: number, nw: number, nh: number) => onShape({ kind: 'rectangle', a: [nx, ny], b: [nx + nw, ny + nh] });
        return <>{num('x', 'Corner X', x0, v => put(v, y0, w, h))}{num('y', 'Corner Y', y0, v => put(x0, v, w, h))}
          {num('width', 'Width', w, v => put(x0, y0, Math.max(0.5, v), h), 0.5)}{num('height', 'Height', h, v => put(x0, y0, w, Math.max(0.5, v)), 0.5)}</>;
      })()}
      {s?.kind === 'circle' && <>
        {num('cx', 'Centre X', s.c[0], v => onShape({ ...s, c: [v, s.c[1]] }))}{num('cy', 'Centre Y', s.c[1], v => onShape({ ...s, c: [s.c[0], v] }))}
        {num('diameter', 'Diameter', s.r * 2, v => onShape({ ...s, r: Math.max(0.25, v / 2) }), 0.5)}</>}
      {s?.kind === 'slot' && (() => {
        const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), angle = Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) * 180 / Math.PI;
        const put = (a: [number, number], len: number, deg: number, r: number) => onShape({ kind: 'slot', a, r,
          b: [round(a[0] + len * Math.cos(deg * Math.PI / 180)), round(a[1] + len * Math.sin(deg * Math.PI / 180))] });
        return <>{num('slot-x', 'Centre X', s.a[0], v => put([v, s.a[1]], l, angle, s.r))}{num('slot-y', 'Centre Y', s.a[1], v => put([s.a[0], v], l, angle, s.r))}
          {num('slot-length', 'Length', l, v => put(s.a, Math.max(0.5, v), angle, s.r), 0.5)}
          <label className="field"><span>Angle</span><span className="num"><input id="sk-slot-angle" type="number" step="any" value={round(angle)}
            onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) put(s.a, l, v, s.r); }} /><em>°</em></span></label>
          {num('slot-width', 'Width', s.r * 2, v => put(s.a, l, angle, Math.max(0.25, v / 2)), 0.5)}</>;
      })()}
      {s?.kind === 'polygon' && <div className="pts pts-4" role="group" aria-label="Outline points">
        <span /><span>X</span><span>Y</span><span>Edge</span>
        {s.points.map((p, i) => {
          const n = s.points.length, b = s.bulges?.[i] ?? 0, hasEdge = s.closed || i < n - 1;
          const q = s.points[(i + 1) % n], edge = b ? arcOf(p as P2, q as P2, b).radius : Math.hypot(q[0] - p[0], q[1] - p[1]);
          const locked = (b ? s.radii?.[i] : s.lengths?.[i]) !== undefined;
          return [
            <span key={'n' + i}>{i + 1}</span>,
            ...[0, 1].map(k => <input key={i + '_' + k} type="number" step="any" aria-label={`Point ${i + 1} ${'XY'[k]}`} value={round(p[k])}
              onChange={e => {
                const v = Number(e.target.value); if (!Number.isFinite(v)) return;
                const lengths = { ...(s.lengths ?? {}) }; delete lengths[i]; delete lengths[(i - 1 + n) % n];
                onShape({ ...s, points: movePoint(s.points, i, k, v, s.closed), lengths });
              }} />),
            hasEdge ? <span key={'e' + i} className="edge-cell">{b ? <em>R</em> : null}
              <input id={'sk-' + (b ? 'rad' : 'len') + i} type="number" step="any" min={0.5} className={locked ? 'locked' : ''} value={round(edge)}
                aria-label={b ? `Arc ${i + 1} radius` : `Edge ${i + 1} length`}
                title={locked ? `Locked ${b ? 'radius' : 'length'} · clear to unlock` : `Type a ${b ? 'radius' : 'length'} (or press Enter) to lock it`}
                onKeyDown={e => {
                  // Enter locks the value as shown instead of finishing the sketch.
                  if (e.key !== 'Enter' || !s.closed) return;
                  e.preventDefault(); e.stopPropagation(); lock(s, b ? 'radii' : 'lengths', i, Number(e.currentTarget.value));
                }}
                onChange={e => {
                  if (e.target.value === '') { if (s.closed) lock(s, b ? 'radii' : 'lengths', i, null); return; }
                  const v = Number(e.target.value); if (!Number.isFinite(v) || v <= 0) return;
                  if (s.closed) lock(s, b ? 'radii' : 'lengths', i, v); else if (b) bendOpenArc(s, i, v);
                }} /></span> : <span key={'e' + i} />,
          ];
        })}
      </div>}
      {s?.kind === 'polygon' && s.closed && !s.pending && s.points.some((_, j) => canBeTangent(s.points as P2[], s.bulges, j)) && <>
        <div className="card-title" style={{ marginTop: 10 }}>TANGENCY</div>
        <div className="tangents" role="group" aria-label="Tangent joints">
          {s.points.map((_, j) => canBeTangent(s.points as P2[], s.bulges, j) && (
            <button key={j} type="button" className={'chip' + (s.tangents?.includes(j) ? ' on' : '')} aria-pressed={!!s.tangents?.includes(j)}
              aria-label={`Tangent at point ${j + 1}`} onClick={() => toggleTangent(s, j)}>T · {j + 1}</button>))}
        </div></>}
      {s?.kind === 'polygon' && s.closed && !s.pending && arcPairs(s.bulges).length > 0 && <>
        <div className="card-title" style={{ marginTop: 10 }}>ARC PAIRS</div>
        <div className="arc-pairs" role="group" aria-label="Arc pairs">
          {arcPairs(s.bulges).map(pair => {
            const on = (key: 'equalRadii' | 'concentric') => !!s[key]?.some(p => samePair(p, pair));
            const name = `arcs ${pair[0] + 1} and ${pair[1] + 1}`;
            return <div className="arc-pair" key={pair.join('_')}><span>Arc {pair[0] + 1} · Arc {pair[1] + 1}</span>
              <button type="button" className={'chip' + (on('equalRadii') ? ' on' : '')} aria-pressed={on('equalRadii')} aria-label={`Equal radius for ${name}`}
                title="Same radius" onClick={() => togglePair(s, 'equalRadii', pair)}>= R</button>
              <button type="button" className={'chip' + (on('concentric') ? ' on' : '')} aria-pressed={on('concentric')} aria-label={`Concentric ${name}`}
                title="Same centre" onClick={() => togglePair(s, 'concentric', pair)}>◎</button></div>;
          })}
        </div></>}
      {isSettled(s) && <ConstraintTools shape={s} picked={sketch.picked ?? NONE} onShape={onShape}
        onPicked={picked => onUi?.({ picked })} onEditDim={editDim => onUi?.({ editDim })} />}
      {constraints.length > 0 && <>
        <div className="card-title" style={{ marginTop: 10 }}>CONSTRAINTS · {constraints.length}</div>
        {constraints.map((c, i) => <div className="kv" key={i}>{c.label}<b>{c.detail}</b></div>)}
      </>}
      {solved?.ok && <div className="kv solver">Solver<b>rank {solved.rank} · {solved.dof} DOF</b></div>}
      {onUseOutline && <>
        <div className="card-title" style={{ marginTop: 10 }}>FACE</div>
        <div className="sk-offset">
          <button className="ghost" aria-label="Use the face outline" data-tip="Use its outline" data-tip-desc="The face's edges (outline and holes) as shapes of this sketch" onClick={() => onUseOutline(false)}>Use its outline</button>
          <button className="ghost" aria-label="Face outline as references" data-tip="As references" data-tip-desc="The face's edges as construction shapes: snapped to, not part of the profile" onClick={() => onUseOutline(true)}>As references</button>
        </div>
      </>}
      {onOffset && <>
        <div className="card-title" style={{ marginTop: 10 }}>OFFSET</div>
        <div className="sk-offset">
          <span className="num"><input aria-label="Offset distance" type="number" step="any" min={0.1} value={offsetBy} onChange={e => setOffsetBy(Number(e.target.value))} /><em>mm</em></span>
          <button className="ghost" aria-label="Offset outward" data-tip="Offset out" data-tip-desc="A copy of the newest closed shape this far outside it (the ring between them is the profile)" onClick={() => onOffset(Math.abs(offsetBy))}>Out</button>
          <button className="ghost" aria-label="Offset inward" data-tip="Offset in" data-tip-desc="A copy of the newest closed shape this far inside it (a wall)" onClick={() => onOffset(-Math.abs(offsetBy))}>In</button>
        </div>
      </>}
    </aside>
  );
}

function statusOf(s: SketchShape | null, solved: SolveResult | null): { text: string; warn: boolean } {
  if (!s) return { text: '', warn: false };
  if (s.kind === 'slot') return s.r > 0 ? { text: 'Slot · extrudes as a line + arc solid', warn: false } : { text: 'Click the second centre, then the width', warn: true };
  if (s.kind !== 'polygon') return { text: 'Fully defined · every value is dimensioned', warn: false };
  if (!s.closed) return { text: s.pending ? 'Move to bend the arc, click to place it' : 'Open profile · click the first point to close', warn: true };
  if (s.pending) return { text: 'Move to bend the closing arc, click to place it', warn: true };
  if (!solved) return { text: 'Outline closed', warn: false };
  if (!solved.ok) return { text: solved.reason, warn: true };
  const curved = (s.bulges ?? []).some(Boolean);
  const tail = curved ? ' · line + arc outline' : !isConvex(s.points) ? ' · concave, extrudes as a line + arc solid' : '';
  const extra = redundancy(solved);
  if (extra > 0) return { text: `Over-defined · ${extra} redundant constraint${extra > 1 ? 's' : ''} — remove one${tail}`, warn: true };
  return solved.dof === 0 ? { text: 'Fully defined' + tail, warn: false }
    : { text: `Under-defined · ${solved.dof} DOF left — add dimensions or constraints${tail}`, warn: true };
}

function inferred(s: SketchShape) {
  if (s.kind === 'rectangle') return [{ label: 'Horizontal', detail: '2 edges' }, { label: 'Vertical', detail: '2 edges' }, { label: 'Perpendicular', detail: '4 corners' }];
  if (s.kind === 'circle') return [{ label: 'Diameter', detail: 'Ø' + s.r * 2 }];
  if (s.kind === 'slot') return [{ label: 'Tangent', detail: '4 joints' }, { label: 'Equal radius', detail: 'both ends' }];
  const out: { label: string; detail: string }[] = [];
  const straightEdges = s.points.map((_, i) => !(s.bulges?.[i] ?? 0));
  if (s.closed) out.push({ label: 'Anchor', detail: 'point 1' });
  const n = s.points.length, { h, v } = inferredHV(s.points as P2[], s.bulges);
  for (const i of h) if ((s.closed || i < n - 1) && straightEdges[i]) out.push({ label: 'Horizontal', detail: `edge ${i + 1}` });
  for (const i of v) if ((s.closed || i < n - 1) && straightEdges[i]) out.push({ label: 'Vertical', detail: `edge ${i + 1}` });
  for (const [i, l] of Object.entries(s.lengths ?? {})) out.push({ label: 'Length', detail: `edge ${Number(i) + 1} = ${round(l)}` });
  for (const [i, r] of Object.entries(s.radii ?? {})) out.push({ label: 'Radius', detail: `arc ${Number(i) + 1} = R${round(r)}` });
  for (const j of s.tangents ?? []) out.push({ label: 'Tangent', detail: `point ${j + 1}` });
  for (const [a, b] of s.equalRadii ?? []) out.push({ label: 'Equal radius', detail: `arc ${a + 1} = arc ${b + 1}` });
  for (const [a, b] of s.concentric ?? []) out.push({ label: 'Concentric', detail: `arc ${a + 1} · arc ${b + 1}` });
  s.bulges?.forEach((b, i) => { if (b) out.push({ label: 'Arc', detail: `edge ${i + 1} ${b > 0 ? 'ccw' : 'cw'}` }); });
  return out;
}

/** Moving a point drags the neighbours of its horizontal/vertical edges so they stay aligned. */
function movePoint(points: [number, number][], i: number, k: number, v: number, closed: boolean) {
  const n = points.length; const next = points.map(p => [...p] as [number, number]); const old = points[i][k];
  next[i][k] = v;
  for (const j of [i - 1, i + 1]) {
    if (!closed && (j < 0 || j >= n)) continue;
    const jj = (j + n) % n; const other = 1 - k;
    // Edge i–jj is aligned along `other` axis when they share coordinate k.
    if (points[jj][k] === old && points[jj][other] !== points[i][other]) next[jj][k] = v;
  }
  return next;
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;


