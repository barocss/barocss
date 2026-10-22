// G17: the 3D sketch's marks in the viewport's overlay (SVG, alike on either renderer, over the scene as the thing
// edited): the work plane round where the next point goes, the segments, the rubber band and an axis lock's guide,
// the points (free ones — the diagnosis's — blue, defined ones white, selected in the accent), the snap ring, and each
// constraint's mark (unmet red, redundant amber; a click picks it). Other skeletons drawn faint.
import type { ModelNode } from '@barocss/cad-model/engine/doc';
import type { Axis3, V3 } from '@barocss/cad-model/frames/sketch3d';
import type { ToolView } from '../viewport/Viewport';
import { constraintMarks, PLANE_AXES, type Diagnosis, type Selection3D, type SkeletonDraft, type Snap, type WorkPlane } from './skeletonTool';

const AXIS_COLOR = { x: '#e5534b', y: '#57b26b', z: '#4f8ff7' } as const;
const UNIT = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] } as const;

export function SkeletonMarks({ view, skeletons, draft, diagnosis, selection, chainFrom, hover, dragging, plane, axis, onPickConstraint }: {
  view: ToolView; skeletons: readonly Extract<ModelNode, { kind: 'skeleton' }>[]; draft: SkeletonDraft | null; diagnosis: Diagnosis | null;
  selection: Selection3D; chainFrom: number | null; hover: { at: V3 | null; snap: Snap | null } | null; dragging: number | null; plane: WorkPlane; axis: Axis3 | null;
  onPickConstraint(k: number, additive: boolean): void;
}) {
  const P = (p: readonly number[]) => view.project(p as V3);
  const faint = skeletons.flatMap((n, s) => n.segments.map(([i, j], k) => { const a = P(n.points[i].map(Number)), b = P(n.points[j].map(Number)); return <line key={`f${s}.${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="skel-faint" />; }));
  if (!draft) return <g aria-label="Skeletons">{faint}</g>;
  const solve = diagnosis && !('error' in diagnosis) ? diagnosis.solve : null;
  const free = new Set(solve?.free ?? []), unmet = new Set(solve?.unmet.map(u => u.constraint) ?? []), redundant = new Set(solve?.redundant ?? []);
  const anchor: V3 = hover?.at ?? (chainFrom !== null ? draft.points[chainFrom] : null) ?? [0, 0, 0];
  const items: React.ReactNode[] = [...faint];
  // The work plane: a grid of round steps round the anchor, about 160 px across.
  {
    const [u, v] = PLANE_AXES[plane].map(a => UNIT[a]), o = P(anchor), e = P([anchor[0] + u[0], anchor[1] + u[1], anchor[2] + u[2]]), perMm = Math.hypot(e[0] - o[0], e[1] - o[1]) || 1;
    const step = 10 ** Math.ceil(Math.log10(24 / perMm)), n = 3, c = anchor.map(x => Math.round(x / step) * step);
    const at = (i: number, j: number) => P([0, 1, 2].map(k => c[k] + u[k] * i * step + v[k] * j * step));
    const d: string[] = [];
    for (let i = -n; i <= n; i++) { const a = at(i, -n), b = at(i, n), p = at(-n, i), q = at(n, i); d.push(`M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`); }
    items.push(<path key="plane" d={d.join('')} className="skel-plane" data-plane={plane} />);
  }
  draft.segments.forEach(([i, j], k) => {
    const a = P(draft.points[i]), b = P(draft.points[j]), on = selection.segments.includes(k);
    items.push(<line key={'s' + k} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={'skel-seg' + (on ? ' sel' : '')} />);
  });
  // An axis lock's guide through the point the next segment starts from (or the one dragged), in the axis's colour.
  const through = dragging !== null ? draft.points[dragging] : chainFrom !== null ? draft.points[chainFrom] : null;
  if (axis && through) {
    const a = UNIT[axis], o = P(through), e = P([through[0] + a[0], through[1] + a[1], through[2] + a[2]]), dx = e[0] - o[0], dy = e[1] - o[1], l = Math.hypot(dx, dy) || 1, L = 4000;
    items.push(<line key="axis" x1={o[0] - dx / l * L} y1={o[1] - dy / l * L} x2={o[0] + dx / l * L} y2={o[1] + dy / l * L} className="skel-axis" style={{ stroke: AXIS_COLOR[axis] }} data-axis={axis} />);
  }
  if (chainFrom !== null && hover?.at) { const a = P(draft.points[chainFrom]), b = P(hover.at); items.push(<line key="band" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="skel-band" />); }
  draft.points.forEach((p, i) => {
    const q = P(p), on = selection.points.includes(i);
    items.push(<circle key={'p' + i} cx={q[0]} cy={q[1]} r={dragging === i ? 6 : 4.5} className={'skel-point' + (free.has(i) ? ' free' : '') + (on ? ' sel' : '')} data-point={i} />);
  });
  if (hover?.snap) {
    const q = P(hover.snap.at);
    items.push(hover.snap.kind === 'point' ? <circle key="snap" cx={q[0]} cy={q[1]} r={8} className="skel-snap" /> : <rect key="snap" x={q[0] - 6} y={q[1] - 6} width={12} height={12} className="skel-snap" />);
  } else if (hover?.at) { const q = P(hover.at); items.push(<circle key="cursor" cx={q[0]} cy={q[1]} r={3} className="skel-cursor" />); }
  for (const m of constraintMarks(draft, P)) {
    const k = m.constraint, w = m.text.length * 7 + 10, cls = 'skel-mark' + (unmet.has(k) ? ' bad' : redundant.has(k) ? ' over' : '') + (selection.constraints.includes(k) ? ' sel' : '');
    items.push(<g key={`c${k}.${m.at[0].toFixed(0)}.${m.at[1].toFixed(0)}`} className={cls} data-constraint={k} onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onPickConstraint(k, e.shiftKey || e.metaKey || e.ctrlKey); }}>
      <rect x={m.at[0] - w / 2} y={m.at[1] - 9} width={w} height={18} rx={4} /><text x={m.at[0]} y={m.at[1] + 4} textAnchor="middle">{m.text}</text></g>);
  }
  return <g aria-label="3D sketch" data-points={draft.points.length} data-segments={draft.segments.length} data-status={solve?.status ?? 'error'}>{items}</g>;
}
