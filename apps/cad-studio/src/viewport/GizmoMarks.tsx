// The transform gizmo and feature handles as SVG marks over the viewport (see gizmo.ts): thin shafts with
// cone heads, translucent plane squares, quarter arcs with a turn arrow, a centre dot; the handle under the
// pointer (or being dragged) in the accent colour, and while dragging the value in a chip by the pointer.
import type React from 'react';
import { AXIS_COLORS, handleLayout, layout, type FeatureHandle, type GizmoHit, type Projector, type TransformGizmo } from './gizmo';

type XY = [number, number];
const HOT = '#f5c542';
const mix = ['#e0c64e', '#4fb9c4', '#c27ad8']; // XY, YZ, XZ squares
const pts = (p: XY[]) => p.map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ');
/** A cone head at `to`, pointing from `from`: a long narrow triangle with a slightly hollow base. */
function cone(from: XY, to: XY, len: number, half: number): XY[] {
  const dx = to[0] - from[0], dy = to[1] - from[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const b: XY = [to[0] - ux * len, to[1] - uy * len], m: XY = [to[0] - ux * len * 0.82, to[1] - uy * len * 0.82];
  return [to, [b[0] - uy * half, b[1] + ux * half], m, [b[0] + uy * half, b[1] - ux * half]];
}
const same = (a: GizmoHit | null, b: GizmoHit) => !!a && JSON.stringify(a) === JSON.stringify(b);

export function gizmoMarks(g: TransformGizmo | null, handles: readonly FeatureHandle[], P: Projector, hot: GizmoHit | null, readout: { at: XY; text: string } | null): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  if (g) {
    const L = layout(g, P);
    for (const q of L.planes) {
      const on = same(hot, { kind: 'plane', axes: q.axes }), color = on ? HOT : mix[q.axes[0] === 0 && q.axes[1] === 1 ? 0 : q.axes[0] === 1 ? 1 : 2];
      items.push(<polygon key={'gp' + q.axes.join('')} points={pts(q.points)} fill={color} fillOpacity={on ? 0.7 : 0.42} stroke={color} strokeWidth={1.4} strokeLinejoin="round" className="gizmo-plane" data-gizmo={'plane' + q.axes.map(a => 'XYZ'[a]).join('')} />);
    }
    for (const r of L.arcs) {
      const on = same(hot, { kind: 'turn', axis: r.axis }), color = on ? HOT : AXIS_COLORS[r.axis], end = r.points[r.points.length - 1], prev = r.points[r.points.length - 3];
      items.push(<g key={'gr' + r.axis} className="gizmo-arc" data-gizmo={'turn' + 'XYZ'[r.axis]}>
        <polyline points={pts(r.points)} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={on ? 7 : 5.5} strokeLinecap="round" />
        <polyline points={pts(r.points)} fill="none" stroke={color} strokeWidth={on ? 4.5 : 3} strokeLinecap="round" />
        <polygon points={pts(cone(prev, end, 9, 5))} fill={color} /></g>);
    }
    for (const a of L.arrows) {
      const on = same(hot, { kind: 'move', axis: a.axis }), color = on ? HOT : AXIS_COLORS[a.axis], head = cone(a.from, a.to, on ? 15 : 13, on ? 5.5 : 4.5);
      const base = head[2];
      items.push(<g key={'ga' + a.axis} className="gizmo-arrow" data-gizmo={'move' + 'XYZ'[a.axis]}>
        <line x1={a.from[0]} y1={a.from[1]} x2={base[0]} y2={base[1]} stroke="#000" strokeOpacity={0.35} strokeWidth={on ? 5 : 4} strokeLinecap="round" />
        <line x1={a.from[0]} y1={a.from[1]} x2={base[0]} y2={base[1]} stroke={color} strokeWidth={on ? 3 : 2} strokeLinecap="round" />
        <polygon points={pts(head)} fill={color} stroke="#000" strokeOpacity={0.3} strokeWidth={0.8} /></g>);
    }
    items.push(<circle key="go" cx={L.origin[0]} cy={L.origin[1]} r={3.5} className="gizmo-origin" />);
  }
  handles.forEach((h, index) => {
    const { from, to } = handleLayout(h, P), on = same(hot, { kind: 'handle', index }), head = cone(from, to, on ? 13 : 11, on ? 5 : 4);
    items.push(<g key={'gh' + h.id} className={'gizmo-handle' + (on ? ' hot' : '')} data-handle={h.id}>
      <line x1={from[0]} y1={from[1]} x2={head[2][0]} y2={head[2][1]} stroke="#000" strokeOpacity={0.35} strokeWidth={on ? 5 : 4} strokeLinecap="round" />
      <line x1={from[0]} y1={from[1]} x2={head[2][0]} y2={head[2][1]} strokeWidth={on ? 3 : 2} strokeLinecap="round" />
      <polygon points={pts(head)} /><circle cx={from[0]} cy={from[1]} r={3.5} /></g>);
  });
  if (readout) {
    const w = Math.max(48, readout.text.length * 7 + 16);
    items.push(<g key="gread" className="gizmo-readout"><rect x={readout.at[0] + 16} y={readout.at[1] - 32} width={w} height={20} rx={4} className="dim-chip" />
      <text x={readout.at[0] + 16 + w / 2} y={readout.at[1] - 18} textAnchor="middle" className="dim-text">{readout.text}</text></g>);
  }
  return items;
}
