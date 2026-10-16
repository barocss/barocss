// What the viewport draws over a closed outline for its constraints: driving dimensions (lines with
// arrows and a value chip, double-click to edit), glyphs of explicit constraints, the picked and hovered
// points and edges, and the inline dimension editor.
import type { ReactNode } from 'react';
import { arcOf, sampleSegment, type P2 } from '../sketch/profile';
import { dimensionLabel, dimensionValue, isDriving, samePick, type Polygon, type SketchPick } from '../sketch/rules';
import type { Project } from '../sketch/select';
import './constraints.css';

export interface MarkHandlers {
  onDimClick?(key: string): void;
  onDimEdit?(key: string | null): void;
  onDimCommit?(key: string, value: number): void;
}
interface Args extends MarkHandlers { shape: Polygon; project: Project; picked: readonly SketchPick[]; hover: SketchPick | null; editDim: string | null | undefined }
/** `under`: drawn beneath the outline's own labels (the picked / hovered highlight); `svg`: on top. */
export interface Marks { under: ReactNode[]; svg: ReactNode[]; html: ReactNode }

const fmt = (v: number) => String(Math.round(v * 100) / 100);
type XY = [number, number];
const add = (a: XY, b: XY, k = 1): XY => [a[0] + b[0] * k, a[1] + b[1] * k];
const unit = (a: XY, b: XY): XY => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };

/** Keys of the dimensions drawn as driving dimensions (the plain labels skip them). */
export function drivingKeys(s: Polygon): Set<string> {
  const keys = new Set<string>();
  Object.keys(s.lengths ?? {}).forEach(i => { if (!s.bulges?.[+i]) keys.add('len' + i); });
  Object.keys(s.radii ?? {}).forEach(i => { if (s.bulges?.[+i]) keys.add('rad' + i); });
  return keys;
}

export function sketchMarks({ shape: s, project, picked, hover, editDim, onDimClick, onDimEdit, onDimCommit }: Args): Marks {
  const n = s.points.length, P = (p: readonly number[]): XY => { const q = project(p[0], p[1]); return [q[0], q[1]]; };
  const pts = s.points.map(P), centroid: XY = [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n];
  const svg: ReactNode[] = [], under: ReactNode[] = [], anchors = new Map<string, XY>();
  const edgePath = (i: number) => [...sampleSegment(s.points[i] as P2, s.points[(i + 1) % n] as P2, s.bulges?.[i] ?? 0, 16), s.points[(i + 1) % n]].map(P);
  const mid = (i: number): XY => {
    const b = s.bulges?.[i] ?? 0, a = s.points[i] as P2, c = s.points[(i + 1) % n] as P2;
    if (!b) return P([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]);
    const arc = arcOf(a, c, b), t = arc.start + arc.sweep / 2; return P([arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t)]);
  };
  /** The screen normal of a→b that points away from the outline's centre. */
  const outward = (a: XY, b: XY): XY => { const u = unit(a, b), nrm: XY = [-u[1], u[0]], m: XY = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    return (m[0] + nrm[0] - centroid[0]) ** 2 + (m[1] + nrm[1] - centroid[1]) ** 2 >= (m[0] - nrm[0] - centroid[0]) ** 2 + (m[1] - nrm[1] - centroid[1]) ** 2 ? nrm : [-nrm[0], -nrm[1]]; };

  // Picked and hovered entities.
  const mark = (p: SketchPick, cls: string) => {
    if (p.kind === 'point') { const q = pts[p.i]; if (q) under.push(<circle key={cls + 'p' + p.i} cx={q[0]} cy={q[1]} r={7} className={'sk-pick-point ' + cls} />); }
    else if (p.i < n) under.push(<polyline key={cls + 'e' + p.i} points={edgePath(p.i).map(q => q.join(',')).join(' ')} className={'sk-pick-edge ' + cls} />);
  };
  if (hover && !picked.some(p => samePick(p, hover))) mark(hover, 'hover');
  picked.forEach(p => mark(p, 'on'));

  const chip = (at: XY, text: string, key: string, driving: boolean) => {
    const w = Math.max(40, text.length * 7.4 + 14);
    anchors.set(key, at);
    svg.push(<g key={'dd' + key} className={'dim' + (driving ? ' driving' : '')} data-dim={key}
      onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onDimClick?.(key); }}
      onDoubleClick={e => { e.stopPropagation(); onDimEdit?.(key); }}>
      <title>{`${dimensionLabel(s, key)} · double-click to edit`}</title>
      <rect x={at[0] - w / 2} y={at[1] - 11} width={w} height={22} rx={4} className="dim-chip" />
      <text x={at[0]} y={at[1] + 4} textAnchor="middle" className="dim-text">{text}</text></g>);
  };
  const arrow = (tip: XY, dir: XY, key: string) => {
    const back = add(tip, dir, -8), side: XY = [-dir[1] * 3.5, dir[0] * 3.5];
    svg.push(<path key={key} d={`M${tip[0]},${tip[1]}L${back[0] + side[0]},${back[1] + side[1]}L${back[0] - side[0]},${back[1] - side[1]}Z`} className="dim-arrow" />);
  };
  /** A linear dimension a–b (measured between `ends`, default a and b), its line offset outwards with extension lines from a and b. */
  const linear = (a: XY, b: XY, value: number, key: string, ends: [XY, XY] = [a, b]) => {
    const o = outward(ends[0], ends[1]), a2 = add(ends[0], o, 26), b2 = add(ends[1], o, 26), u = unit(a2, b2);
    svg.push(<line key={'dx1' + key} x1={a[0] + o[0] * 4} y1={a[1] + o[1] * 4} x2={a2[0] + o[0] * 5} y2={a2[1] + o[1] * 5} className="dim-ext" />,
      <line key={'dx2' + key} x1={b[0] + o[0] * 4} y1={b[1] + o[1] * 4} x2={b2[0] + o[0] * 5} y2={b2[1] + o[1] * 5} className="dim-ext" />,
      <line key={'dl' + key} x1={a2[0]} y1={a2[1]} x2={b2[0]} y2={b2[1]} className="dim-line" />);
    arrow(a2, [-u[0], -u[1]], 'da1' + key); arrow(b2, u, 'da2' + key);
    chip([(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2], fmt(value), key, true);
  };

  // Driving dimensions.
  for (const key of drivingKeys(s)) {
    const i = Number(key.slice(3)), v = dimensionValue(s, key); if (v === null) continue;
    if (key.startsWith('len')) linear(pts[i], pts[(i + 1) % n], v, key);
    else {
      const arc = arcOf(s.points[i] as P2, s.points[(i + 1) % n] as P2, s.bulges![i]), c = P(arc.center), m = mid(i), u = unit(c, m);
      svg.push(<line key={'rl' + key} x1={c[0]} y1={c[1]} x2={m[0]} y2={m[1]} className="dim-line" />);
      arrow(m, u, 'ra' + key); chip(add(m, u, 30), 'R' + fmt(v), key, true);
    }
  }
  (s.rules ?? []).forEach(r => {
    if ((r.kind !== 'distance' && r.kind !== 'dx' && r.kind !== 'dy') || !pts[r.a] || !pts[r.b]) return;
    if (r.kind === 'distance') { linear(pts[r.a], pts[r.b], r.value, `dist${r.a}_${r.b}`); return; }
    // Along an axis: measured between the points carried across to the far side of both.
    const a = s.points[r.a], b = s.points[r.b], m = r.kind === 'dx' ? 0 : 1, o = 1 - m, far = Math.max(a[o], b[o]);
    const at = (p: readonly number[]) => P(m === 0 ? [p[0], far] : [far, p[1]]);
    linear(pts[r.a], pts[r.b], r.value, `${r.kind}${r.a}_${r.b}`, [at(a), at(b)]);
  });

  /** Where an angle between straight edges a and b is drawn: an arc at their shared point, else midway between them. */
  const angleMark = (a: number, b: number): { at: XY; arc?: string } => {
    const v = (a + 1) % n === b ? b : (b + 1) % n === a ? a : -1;
    if (v < 0) { const ma = mid(a), mb = mid(b); return { at: [(ma[0] + mb[0]) / 2, (ma[1] + mb[1]) / 2] }; }
    const o = pts[v], far = (i: number) => pts[i === v ? (i + 1) % n : i];
    const ua = unit(o, far(a)), ub = unit(o, far(b)), r = 34;
    const delta = Math.atan2(ua[0] * ub[1] - ua[1] * ub[0], ua[0] * ub[0] + ua[1] * ub[1]);
    const bis = unit([0, 0], [ua[0] + ub[0], ua[1] + ub[1]]), p0 = add(o, ua, r), p1 = add(o, ub, r);
    return { at: add(o, Math.hypot(bis[0], bis[1]) ? bis : [-ua[1], ua[0]], r + 22), arc: `M${p0[0]},${p0[1]}A${r},${r} 0 0 ${delta > 0 ? 1 : 0} ${p1[0]},${p1[1]}` };
  };
  (s.rules ?? []).forEach(r => {
    if (r.kind !== 'angle' || r.a >= n || r.b >= n) return;
    const m = angleMark(r.a, r.b), key = `ang${r.a}_${r.b}`;
    if (m.arc) svg.push(<path key={'ar' + key} d={m.arc} className="dim-line" fill="none" />);
    chip(m.at, fmt(r.value) + '°', key, true);
  });

  // Glyphs of explicit constraints, stacked along each edge past its H/V chip.
  const stack = new Map<string, number>();
  const glyph = (at: XY, text: string, key: string, title: string) => {
    svg.push(<g key={key} className="cons-glyph"><title>{title}</title><rect x={at[0] - 9} y={at[1] - 8} width={18} height={16} rx={3} className="cons-chip" />
      <text x={at[0]} y={at[1] + 4} textAnchor="middle" className="cons-text">{text}</text></g>);
  };
  // Inside the edge, stepping along it upwards on screen: the edge's length label sits below its middle.
  const onEdge = (i: number, text: string, key: string, title: string) => {
    const k = (stack.get('e' + i) ?? 0) + 1; stack.set('e' + i, k);
    const a = pts[i], b = pts[(i + 1) % n], u0 = unit(a, b), u: XY = u0[1] > 0 || (u0[1] === 0 && u0[0] < 0) ? [-u0[0], -u0[1]] : u0, o = outward(a, b), m = mid(i);
    glyph(add(add(m, u, 22 * k), o, -20), text, key, title);
  };
  const onPoint = (i: number, text: string, key: string, title: string) => {
    const k = (stack.get('p' + i) ?? 0); stack.set('p' + i, k + 1);
    const q = pts[i]; glyph([q[0] - 16 - 20 * k, q[1] + 16], text, key, title);
  };
  (s.rules ?? []).forEach((r, k) => {
    if (r.kind === 'parallel' || r.kind === 'perpendicular' || r.kind === 'equal') {
      const sym = r.kind === 'parallel' ? '∥' : r.kind === 'perpendicular' ? '⊥' : '=', title = `${r.kind[0].toUpperCase() + r.kind.slice(1)} edges ${r.a + 1} and ${r.b + 1}`;
      onEdge(r.a, sym, `ga${k}`, title); onEdge(r.b, sym, `gb${k}`, title);
    } else if (r.kind === 'fix') onPoint(r.point, '⚓', `gf${k}`, `Point ${r.point + 1} fixed`);
    else if (r.kind === 'coincident') onPoint(r.point, '◎', `gc${k}`, `Point ${r.point + 1} on the centre of arc ${r.arc + 1}`);
  });

  // The inline editor, over the dimension being edited.
  let html: ReactNode = null;
  if (editDim) {
    const v = dimensionValue(s, editDim);
    const d = /^(?:dist|dx|dy)(\d+)_(\d+)$/.exec(editDim), g = /^ang(\d+)_(\d+)$/.exec(editDim);
    const at = anchors.get(editDim) ?? (g ? angleMark(+g[1], +g[2]).at : d ? (() => { const a = pts[+d[1]], b = pts[+d[2]]; return a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as XY : null; })()
      : (() => { const i = Number(editDim.slice(3)); return i < n ? add(mid(i), outward(pts[i], pts[(i + 1) % n]), 26) : null; })());
    if (v !== null && at) {
      html = <input key={editDim} className="dim-edit" type="number" step="any" autoFocus defaultValue={fmt(v)} aria-label={dimensionLabel(s, editDim)}
        title={`${dimensionLabel(s, editDim)}${isDriving(s, editDim) ? '' : ' · Enter adds it as a driving dimension'}${d ? ' · H horizontal, V vertical, A aligned' : ''} · Esc cancels`}
        style={{ left: at[0] - 42, top: at[1] - 13 }}
        onFocus={e => e.currentTarget.select()}
        onKeyDown={e => {
          e.stopPropagation();
          // Committing blurs at once, so keys that follow reach the app even before the editor unmounts.
          if (e.key === 'Enter') { e.preventDefault(); const v = Number(e.currentTarget.value); onDimCommit?.(editDim, v); e.currentTarget.blur(); }
          else if (e.key === 'Escape') { e.preventDefault(); onDimEdit?.(null); }
          // Between two points: A aligned, H horizontal, V vertical.
          else if (d && /^[ahv]$/i.test(e.key)) { e.preventDefault(); onDimEdit?.(({ a: 'dist', h: 'dx', v: 'dy' } as const)[e.key.toLowerCase() as 'a' | 'h' | 'v'] + d[1] + '_' + d[2]); }
        }}
        onBlur={() => onDimEdit?.(null)} />;
    }
  }
  return { under, svg, html };
}
