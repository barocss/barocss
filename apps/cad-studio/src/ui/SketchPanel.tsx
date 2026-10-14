import type { SketchShape, SketchState } from '../viewport/Viewport';

/** Numbers drive the profile: editing a dimension reshapes it; H/V edges stay H/V while editing points. */
export function SketchPanel({ sketch, onShape }: { sketch: SketchState; onShape(shape: SketchShape | null): void }) {
  const s = sketch.shape;
  const num = (id: string, label: string, value: number, set: (v: number) => void, min?: number) => (
    <label className="field" key={id}><span>{label}</span>
      <span className="num"><input id={'sk-' + id} type="number" step="any" min={min} value={value}
        onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) set(v); }} /><em>mm</em></span></label>);
  const convex = s?.kind === 'polygon' && s.closed ? isConvex(s.points) : true;
  const constraints = s ? inferred(s) : [];
  return (
    <aside className="card props sk-panel" aria-label="Sketch">
      <div className="card-title">SKETCH · Z {sketch.planeZ}{sketch.base ? ' · on face' : ''}</div>
      {!s && <div className="empty">Pick a tool on the left and click on the plane. Points snap to 1 mm.</div>}
      {s && <div className={'sk-status' + (s.kind === 'polygon' && (!s.closed || !convex) ? ' open' : '')}><i />
        {s.kind === 'polygon' && !s.closed ? 'Open profile · click the first point to close'
          : !convex ? 'Profile is concave · the kernel needs a convex outline'
            : 'Fully defined · every point is dimensioned'}</div>}
      {s?.kind === 'rectangle' && (() => {
        const x0 = Math.min(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), w = Math.abs(s.b[0] - s.a[0]), h = Math.abs(s.b[1] - s.a[1]);
        const put = (nx: number, ny: number, nw: number, nh: number) => onShape({ kind: 'rectangle', a: [nx, ny], b: [nx + nw, ny + nh] });
        return <>{num('x', 'Corner X', x0, v => put(v, y0, w, h))}{num('y', 'Corner Y', y0, v => put(x0, v, w, h))}
          {num('width', 'Width', w, v => put(x0, y0, Math.max(0.5, v), h), 0.5)}{num('height', 'Height', h, v => put(x0, y0, w, Math.max(0.5, v)), 0.5)}</>;
      })()}
      {s?.kind === 'circle' && <>
        {num('cx', 'Centre X', s.c[0], v => onShape({ ...s, c: [v, s.c[1]] }))}{num('cy', 'Centre Y', s.c[1], v => onShape({ ...s, c: [s.c[0], v] }))}
        {num('diameter', 'Diameter', s.r * 2, v => onShape({ ...s, r: Math.max(0.25, v / 2) }), 0.5)}</>}
      {s?.kind === 'polygon' && <div className="pts" role="group" aria-label="Polygon points">
        <span /><span>X</span><span>Y</span>
        {s.points.map((p, i) => [
          <span key={'n' + i}>{i + 1}</span>,
          ...[0, 1].map(k => <input key={i + '_' + k} type="number" step="any" aria-label={`Point ${i + 1} ${'XY'[k]}`} value={p[k]}
            onChange={e => { const v = Number(e.target.value); if (!Number.isFinite(v)) return; onShape({ ...s, points: movePoint(s.points, i, k, v, s.closed) }); }} />),
        ])}
      </div>}
      {constraints.length > 0 && <>
        <div className="card-title" style={{ marginTop: 10 }}>CONSTRAINTS · {constraints.length}</div>
        {constraints.map((c, i) => <div className="kv" key={i}>{c.label}<b>{c.detail}</b></div>)}
      </>}
    </aside>
  );
}

function inferred(s: SketchShape) {
  if (s.kind === 'rectangle') return [{ label: 'Horizontal', detail: '2 edges' }, { label: 'Vertical', detail: '2 edges' }, { label: 'Perpendicular', detail: '4 corners' }];
  if (s.kind === 'circle') return [{ label: 'Diameter', detail: 'Ø' + s.r * 2 }];
  const n = s.points.length, out: { label: string; detail: string }[] = [];
  for (let i = 0; i < (s.closed ? n : n - 1); i++) {
    const a = s.points[i], b = s.points[(i + 1) % n];
    if (a[1] === b[1]) out.push({ label: 'Horizontal', detail: `edge ${i + 1}` });
    else if (a[0] === b[0]) out.push({ label: 'Vertical', detail: `edge ${i + 1}` });
  }
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

export function isConvex(points: [number, number][]) {
  let sign = 0; const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n], c = points[(i + 2) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cr !== 0) { if (sign === 0) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) return false; }
  }
  return true;
}
