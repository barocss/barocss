import { useMemo, useState } from 'react';
import type { SketchShape, SketchState } from '../viewport/Viewport';
import { arcOf, inferredHV, radiusToBulge, solveOutline, type P2 } from '../sketch/profile';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;

/**
 * Numbers drive the profile. Straight outlines are solved by the kernel's numerical sketch solver:
 * point 1 is anchored, drawn H/V edges stay H/V and typed edge lengths become locked dimensions.
 */
export function SketchPanel({ sketch, onShape }: { sketch: SketchState; onShape(shape: SketchShape | null): void }) {
  const s = sketch.shape;
  const [solveError, setSolveError] = useState<string | null>(null);
  const num = (id: string, label: string, value: number, set: (v: number) => void, min?: number) => (
    <label className="field" key={id}><span>{label}</span>
      <span className="num"><input id={'sk-' + id} type="number" step="any" min={min} value={round(value)}
        onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) set(v); }} /><em>mm</em></span></label>);
  const straight = s?.kind === 'polygon' && !(s.bulges ?? []).some(Boolean);
  const solved = useMemo(() => s?.kind === 'polygon' && s.closed && straight && s.points.length <= 8 ? solveOutline(s.points as P2[], s.lengths ?? {}) : null, [s, straight]);
  const status = statusOf(s, solved);
  const constraints = s ? inferred(s) : [];

  const setLength = (poly: Polygon, i: number, value: number | null) => {
    const lengths = { ...(poly.lengths ?? {}) };
    if (value === null) delete lengths[i]; else lengths[i] = value;
    if (value === null) { setSolveError(null); onShape({ ...poly, lengths }); return; }
    const result = solveOutline(poly.points as P2[], lengths);
    if (!result.ok) { setSolveError(result.reason); return; }
    setSolveError(null); onShape({ ...poly, points: result.points, lengths });
  };
  const setRadius = (poly: Polygon, i: number, r: number) => {
    const n = poly.points.length, bulges = [...(poly.bulges ?? poly.points.map(() => 0))];
    const b = radiusToBulge(poly.points[i] as P2, poly.points[(i + 1) % n] as P2, r, Math.sign(bulges[i]));
    if (b === null) { setSolveError('An arc radius must be at least half its chord'); return; }
    bulges[i] = Math.abs(bulges[i]) > 1 ? 1 / b : b; // keep a major arc major
    setSolveError(null); onShape({ ...poly, bulges });
  };

  return (
    <aside className="card props sk-panel" aria-label="Sketch">
      <div className="card-title">SKETCH · Z {sketch.planeZ}{sketch.base ? ' · on face' : ''}</div>
      {!s && <div className="empty">Pick a tool on the left and click on the plane. Points snap to 1 mm.</div>}
      {s && <div className={'sk-status' + (status.warn ? ' open' : '')} role="status"><i />{status.text}</div>}
      {solveError && <div className="sk-status open" role="alert"><i />{solveError}</div>}
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
          const locked = s.lengths?.[i] !== undefined;
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
                aria-label={b ? `Arc ${i + 1} radius` : `Edge ${i + 1} length`} title={b ? 'Arc radius' : locked ? 'Locked length · clear to unlock' : 'Type a length (or press Enter) to lock it'}
                onKeyDown={e => {
                  // Enter locks the value as shown instead of finishing the sketch.
                  if (e.key !== 'Enter' || b || !s.closed || !straight) return;
                  e.preventDefault(); e.stopPropagation(); setLength(s, i, Number(e.currentTarget.value));
                }}
                onChange={e => {
                  if (e.target.value === '' && !b) { setLength(s, i, null); return; }
                  const v = Number(e.target.value); if (!Number.isFinite(v) || v <= 0) return;
                  if (b) setRadius(s, i, v); else if (s.closed && straight) setLength(s, i, v);
                }} /></span> : <span key={'e' + i} />,
          ];
        })}
      </div>}
      {constraints.length > 0 && <>
        <div className="card-title" style={{ marginTop: 10 }}>CONSTRAINTS · {constraints.length}</div>
        {constraints.map((c, i) => <div className="kv" key={i}>{c.label}<b>{c.detail}</b></div>)}
      </>}
      {solved?.ok && <div className="kv solver">Solver<b>rank {solved.rank} · {solved.dof} DOF</b></div>}
    </aside>
  );
}

function statusOf(s: SketchShape | null, solved: ReturnType<typeof solveOutline> | null): { text: string; warn: boolean } {
  if (!s) return { text: '', warn: false };
  if (s.kind === 'slot') return s.r > 0 ? { text: 'Slot · extrudes as a line + arc solid', warn: false } : { text: 'Click the second centre, then the width', warn: true };
  if (s.kind !== 'polygon') return { text: 'Fully defined · every value is dimensioned', warn: false };
  if (!s.closed) return { text: s.pending ? 'Move to bend the arc, click to place it' : 'Open profile · click the first point to close', warn: true };
  if (s.pending) return { text: 'Move to bend the closing arc, click to place it', warn: true };
  const curved = (s.bulges ?? []).some(Boolean);
  if (curved) return { text: 'Line + arc outline · arcs keep their radius', warn: false };
  if (!solved) return { text: 'Outline has more than 8 points · the solver is skipped', warn: true };
  if (!solved.ok) return { text: solved.reason, warn: true };
  const concave = !isConvex(s.points);
  const tail = concave ? ' · concave, extrudes as a line + arc solid' : '';
  return solved.dof === 0 ? { text: 'Fully defined' + tail, warn: false }
    : { text: `Under-defined · ${solved.dof} DOF left — type edge lengths to lock them${tail}`, warn: true };
}

function inferred(s: SketchShape) {
  if (s.kind === 'rectangle') return [{ label: 'Horizontal', detail: '2 edges' }, { label: 'Vertical', detail: '2 edges' }, { label: 'Perpendicular', detail: '4 corners' }];
  if (s.kind === 'circle') return [{ label: 'Diameter', detail: 'Ø' + s.r * 2 }];
  if (s.kind === 'slot') return [{ label: 'Tangent', detail: '4 joints' }, { label: 'Equal radius', detail: 'both ends' }];
  const out: { label: string; detail: string }[] = [];
  const straightEdges = s.points.map((_, i) => !(s.bulges?.[i] ?? 0));
  if (s.closed) out.push({ label: 'Anchor', detail: 'point 1' });
  const n = s.points.length, { h, v } = inferredHV(s.points as P2[]);
  for (const i of h) if ((s.closed || i < n - 1) && straightEdges[i]) out.push({ label: 'Horizontal', detail: `edge ${i + 1}` });
  for (const i of v) if ((s.closed || i < n - 1) && straightEdges[i]) out.push({ label: 'Vertical', detail: `edge ${i + 1}` });
  for (const [i, l] of Object.entries(s.lengths ?? {})) out.push({ label: 'Length', detail: `edge ${Number(i) + 1} = ${round(l)}` });
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

export function isConvex(points: [number, number][]) {
  let sign = 0; const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n], c = points[(i + 2) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cr !== 0) { if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false; }
  }
  return true;
}

