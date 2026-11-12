import type { ReactNode, RefObject } from 'react';
import { sampleLoop } from '@barocss/cad-model/app/profiles';
import { bandShapes, liveBand } from '@barocss/cad-model/sketch/band';
import { bezierSamples } from '@barocss/cad-model/sketch/bezier';
import { ellipseError, ellipseMatches } from '@barocss/cad-model/sketch/ellipse';
import { shapeOutline } from '@barocss/cad-model/sketch/loops';
import type { SnapPoint } from '@barocss/cad-model/sketch/osnap';
import { isDefaultPlane, toLocal, toWorld } from '@barocss/cad-model/sketch/plane';
import { arcOf, sampleOutline, sampleSlot, type P2 } from '@barocss/cad-model/sketch/profile';
import { hvOf, isSettled, type SketchPick } from '@barocss/cad-model/sketch/rules';
import type { SplineDef } from '@barocss/cad-model/sketch/spline';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { drivingKeys, sketchMarks, type MarkHandlers } from '../ui/SketchMarks';
import type { OrbitCamera } from './camera';
import type { PathGapDraft } from '../sketch/usePathGap';
import type { OverlaidLine } from '../sketch/overlaidLines';
import { draftEllipse, ellipseAxis, ellipseSamples, type EllipseDraft } from './ellipseDraft';
import { closedSplineOf, splineHandleGeometry } from './splineHandles';

export interface SketchOverlayDraft {
  cursor: P2 | null;
  hover?: SketchPick | null;
  bandHover?: number | null;
  snap?: SnapPoint | null;
  extension?: boolean;
  trim?: { kind: 'trim' | 'extend' | 'split'; points: P2[]; owner: SketchState; gap?: PathGapDraft; ends?: [P2, P2] } | null;
}

export interface CentreArcDraft {
  c: P2;
  a?: P2;
  last?: number;
  sweep: number;
  cursor?: P2;
}

/** The derived band outline cached by each Viewport. */
export interface SketchBandCache {
  done: SketchState['done'];
  shape: SketchShape | null;
  band: SketchState['band'];
  res: ReturnType<typeof liveBand>;
}

interface SketchOverlayInputs {
  sk: SketchState;
  shape: SketchShape | null;
  cam: OrbitCamera;
  w: number;
  h: number;
  draft: SketchOverlayDraft;
  bezierPoles: readonly P2[];
  ellipse: EllipseDraft | null;
  centreArc: CentreArcDraft | null;
  extensionGuide?: readonly P2[];
  pathGap?: PathGapDraft;
  overlaidLine?: OverlaidLine;
  inspected?: readonly SketchPick[];
  bandCache: RefObject<SketchBandCache | null>;
  picking: boolean;
  cutting: boolean;
  banding: boolean;
  dimensions: MarkHandlers;
  items: ReactNode[];
}

/** Add the active sketch's SVG marks and return its separate HTML dimension editor. */
export function drawSketchOverlay({
  sk, shape, cam, w, h, draft, bezierPoles, ellipse, centreArc, extensionGuide, pathGap, overlaidLine, inspected, bandCache, picking, cutting, banding, dimensions, items,
}: SketchOverlayInputs): ReactNode {
  let editor: ReactNode = null;
  const P = (u: number, v: number) => cam.project(toWorld(sk.plane, [u, v]), w, h);
  // The sketch plane's grid (the ground grid shows XY at Z 0): lines a round step apart around the
  // view centre, the plane's own axes brighter.
  if (!isDefaultPlane(sk.plane)) {
    const centre = toLocal(sk.plane, cam.target), half = cam.distance * Math.tan(cam.fovY / 2) * Math.max(1, cam.aspect) * 1.2;
    const step = [1, 2, 5, 10, 20, 50, 100, 200].find(k => half * 2 / k <= 40) ?? 500;
    const u0 = Math.floor((centre[0] - half) / step) * step, u1 = Math.ceil((centre[0] + half) / step) * step;
    const v0 = Math.floor((centre[1] - half) / step) * step, v1 = Math.ceil((centre[1] + half) / step) * step;
    const seg = (a: [number, number], b: [number, number], key: string, axis: boolean) => {
      const p = P(a[0], a[1]), q = P(b[0], b[1]);
      items.push(<line key={key} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} className={axis ? 'sk-grid axis' : 'sk-grid'} />);
    };
    for (let u = u0; u <= u1; u += step) seg([u, v0], [u, v1], 'gu' + u, u === 0);
    for (let v = v0; v <= v1; v += step) seg([u0, v], [u1, v], 'gv' + v, v === 0);
  }
  const label = (x: number, y: number, text: string, key: string) => (
    <g key={'d' + key} className={key.startsWith('live') ? 'dim live' : 'dim'} onPointerDown={e => { if (key.startsWith('live')) return; e.stopPropagation(); e.preventDefault(); dimensions.onDimClick?.(key); }}
      onDoubleClick={e => { if (key.startsWith('len') || key.startsWith('rad')) { e.stopPropagation(); dimensions.onDimEdit?.(key); } }}>
      <rect x={x - 26} y={y - 11} width={52} height={22} rx={4} className="dim-chip" /><text x={x} y={y + 4} textAnchor="middle" className="dim-text">{text}</text></g>);
  // A closed outline shows its kept H/V edges; while drawing, the edges that are H/V as drawn.
  const hv = isSettled(sk.shape) ? hvOf(sk.shape) : null, driving = isSettled(sk.shape) ? drivingKeys(sk.shape) : new Set<string>();
  const glyph = (a: [number, number], b: [number, number], key: string, edge?: number) => {
    const kind = hv && edge !== undefined ? (hv.h.includes(edge) ? 'H' : hv.v.includes(edge) ? 'V' : null) : a[1] === b[1] ? 'H' : a[0] === b[0] ? 'V' : null; if (!kind) return;
    const m = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    items.push(<g key={'g' + key}><rect x={m[0] - 8} y={m[1] - 26} width={16} height={15} rx={3} className="cons-chip" /><text x={m[0]} y={m[1] - 15} textAnchor="middle" className="cons-text">{kind}</text></g>);
  };
  // Shapes finished earlier in this sketch (regions and holes of one profile).
  // (Open pieces — a trimmed shape's rest — as lines with their ends.)
  (sk.done ?? []).forEach((d, i) => {
    if (sk.hideConstruction && d.construction) return;
    const cls = 'sk-shape done' + (d.construction ? ' construction' : '');
    if (d.kind === 'bezier') { items.push(...bezierMarks('done' + i, d.poles, P, true)); return; }
    if (d.kind === 'polygon' && !d.closed) {
      items.push(<polyline key={'done' + i} points={sampleOutline(d.points, d.bulges, false).map(q => { const p = P(q[0], q[1]); return p[0] + ',' + p[1]; }).join(' ')} className={cls + ' open'} />);
      for (const [k, q] of [d.points[0], d.points[d.points.length - 1]].entries()) { const p = P(q[0], q[1]); items.push(<circle key={'de' + i + '.' + k} cx={p[0]} cy={p[1]} r={3} className="sk-end" />); }
    } else items.push(<polygon key={'done' + i} points={shapeOutline(d).map(q => { const p = P(q[0], q[1]); return p[0] + ',' + p[1]; }).join(' ')} className={cls} />);
  });
  // B1: the band's derived outline (solid, no handles), then the shapes the Band tool has picked and the one under the pointer.
  if (sk.band) {
    if (!bandCache.current || bandCache.current.done !== sk.done || bandCache.current.shape !== sk.shape || bandCache.current.band !== sk.band) bandCache.current = { done: sk.done, shape: sk.shape, band: sk.band, res: liveBand(sk) };
    const lb = bandCache.current.res;
    if (lb && !('error' in lb)) {
      const path = (loop: Parameters<typeof sampleLoop>[0]) => 'M' + sampleLoop(loop).map(q => { const p = P(q[0], q[1]); return p[0] + ',' + p[1]; }).join('L') + 'Z';
      items.push(<path key="band" d={path(lb.outer) + (lb.hole ? path(lb.hole) : '')} className="sk-band" />);
    }
  }
  if (banding) {
    const outline = (d: SketchShape) => d.kind === 'bezier' || (d.kind === 'polygon' && !d.closed) ? '' : shapeOutline(d).map(q => { const p = P(q[0], q[1]); return p[0] + ',' + p[1]; }).join(' ');
    const all = bandShapes(sk), hover = draft.bandHover;
    all.forEach((d, i) => { const on = !!d.ids?.[0] && !!sk.bandPicks?.includes(d.ids[0]), pts = on || i === hover ? outline(d) : ''; if (pts) items.push(<polygon key={'bp' + i} points={pts} className={on ? 'sk-band-pick' : 'sk-band-hover'} />); });
  }
  const s = shape;
  if (s?.kind === 'rectangle') {
    const [x0, x1] = [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])], [y0, y1] = [Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])];
    const pts = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
    items.push(<polygon key="r" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} className={'sk-shape' + (s.construction ? ' construction' : '')} />);
    pts.forEach((p, i) => items.push(<circle key={'rp' + i} cx={p[0]} cy={p[1]} r={3} className="sk-point" />));
    if (x1 > x0 && y1 > y0) { glyph([x0, y0], [x1, y0], 'b'); glyph([x1, y0], [x1, y1], 'r'); }
    const top = P((x0 + x1) / 2, y0), side = P(x1, (y0 + y1) / 2);
    items.push(label(top[0], top[1] + 20, String(x1 - x0), 'width'), label(side[0] + 36, side[1], String(y1 - y0), 'height'));
  } else if (s?.kind === 'circle') {
    const pts = Array.from({ length: 72 }, (_, i) => P(s.c[0] + s.r * Math.cos(i / 36 * Math.PI), s.c[1] + s.r * Math.sin(i / 36 * Math.PI)));
    items.push(<polygon key="c" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} className={'sk-shape' + (s.construction ? ' construction' : '')} />);
    const cc = P(s.c[0], s.c[1]); items.push(<circle key="cc" cx={cc[0]} cy={cc[1]} r={3} className="sk-point" />);
    const e = P(s.c[0] + s.r, s.c[1]); items.push(<line key="rl" x1={cc[0]} y1={cc[1]} x2={e[0]} y2={e[1]} className="sk-guide" />, label((cc[0] + e[0]) / 2, (cc[1] + e[1]) / 2 - 16, 'Ø' + s.r * 2, 'diameter'));
  } else if (s?.kind === 'slot') {
    const ring = s.r > 0 ? sampleSlot(s.a, s.b, s.r).map(p => P(p[0], p[1])) : [P(s.a[0], s.a[1]), P(s.b[0], s.b[1])];
    items.push(s.r > 0 ? <polygon key="sl" points={ring.map(p => p[0] + ',' + p[1]).join(' ')} className={'sk-shape' + (s.construction ? ' construction' : '')} />
      : <polyline key="sl" points={ring.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape open" />);
    const a = P(s.a[0], s.a[1]), b = P(s.b[0], s.b[1]);
    items.push(<line key="slc" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="sk-guide" />,
      <circle key="sa" cx={a[0]} cy={a[1]} r={3} className="sk-point" />, <circle key="sb" cx={b[0]} cy={b[1]} r={3} className="sk-point" />);
    const l = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    if (l > 0) items.push(label((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 18, fmtLen(l), 'slot-length'));
    if (s.r > 0) { const e = P(s.b[0], s.b[1] + s.r); items.push(label(e[0] + 34, e[1], 'W ' + fmtLen(s.r * 2), 'slot-width')); }
  } else if (s?.kind === 'bezier') {
    items.push(...bezierMarks('bz', s.poles, P, false));
  } else if (s?.kind === 'polygon') {
    const pts = s.points.map(p => P(p[0], p[1])); const cur = draft.cursor;
    const marks = isSettled(s) ? sketchMarks({ shape: s, done: sk.done, project: (u, v) => P(u, v), picked: sk.picked ?? [], inspected, hover: picking ? draft.hover ?? null : null, editDim: sk.editDim,
      onDimClick: dimensions.onDimClick, onDimEdit: dimensions.onDimEdit, onDimCommit: dimensions.onDimCommit }) : null;
    const ring = sampleOutline(s.points as P2[], s.bulges, s.closed).map(p => P(p[0], p[1]));
    const line = s.closed || s.pending ? ring : cur ? [...ring, P(cur[0], cur[1])] : ring;
    items.push(s.closed ? <polygon key="pg" points={line.map(p => p[0] + ',' + p[1]).join(' ')} className={'sk-shape' + (s.construction ? ' construction' : '')} />
      : <polyline key="pl" points={line.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape open" />);
    if (marks) items.push(...marks.under);
    const ell = isSettled(s) && !!s.ellipse && ellipseMatches(s); // (An ellipse's 96 tiny arcs get no radius labels or centre dots; its centre and axis ends are marked instead.)
    if (ell) [s.ellipse!.center, ...[0, 1, 2, 3].map(k => s.points[k * s.points.length / 4])].forEach((q, i) => { const p = P(q[0], q[1]); items.push(<circle key={'ep' + i} cx={p[0]} cy={p[1]} r={3.5} className="sk-point" />); });
    else pts.forEach((p, i) => items.push(<circle key={'p' + i} cx={p[0]} cy={p[1]} r={3.5} className="sk-point" />));
    const csp = closedSplineOf(s); // (D353: handles only on a closed spline, whose radius chips are hidden so they do not cover them)
    if (csp) items.push(...splineHandleMarks(csp, P));
    (s.tangents ?? []).forEach(j => { const p = pts[j]; if (p) items.push(<g key={'tg' + j}><rect x={p[0] + 6} y={p[1] - 22} width={16} height={15} rx={3} className="cons-chip" /><text x={p[0] + 14} y={p[1] - 11} textAnchor="middle" className="cons-text">T</text></g>); });
    const n = s.points.length;
    for (let i = 0; i < (s.closed ? n : n - 1); i++) {
      const a = s.points[i], b = s.points[(i + 1) % n], bulge = s.bulges?.[i] ?? 0;
      if (bulge) {
        const arc = arcOf(a, b, bulge), t = arc.start + arc.sweep / 2, m = P(arc.center[0] + arc.radius * Math.cos(t), arc.center[1] + arc.radius * Math.sin(t));
        const cc = P(arc.center[0], arc.center[1]); if (!ell) items.push(<circle key={'ac' + i} cx={cc[0]} cy={cc[1]} r={2} className="sk-point" />);
        if (s.closed && !s.pending && !csp && !ell && !driving.has('rad' + i)) items.push(label(m[0], m[1] - 18, 'R' + fmtLen(arc.radius), 'rad' + i));
        if ((s.equalRadii ?? []).some(p => p.includes(i))) items.push(<g key={'eq' + i}><rect x={m[0] + 30} y={m[1] - 26} width={16} height={15} rx={3} className="cons-chip" /><text x={m[0] + 38} y={m[1] - 15} textAnchor="middle" className="cons-text">=</text></g>);
        if ((s.concentric ?? []).some(p => p.includes(i))) items.push(<circle key={'oc' + i} cx={cc[0]} cy={cc[1]} r={6} className="sk-guide" fill="none" />);
        continue;
      }
      glyph(a, b, 'p' + i, i);
      if (s.closed && !s.pending && !driving.has('len' + i)) { const m = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); items.push(label(m[0], m[1] + 20, fmtLen(Math.hypot(b[0] - a[0], b[1] - a[1])), 'len' + i)); }
    }
    if (!s.closed && !s.pending && cur && n) {
      const last = s.points[n - 1];
      if (cur[0] === last[0] || cur[1] === last[1]) glyph(last, cur, 'live');
      const len = Math.hypot(cur[0] - last[0], cur[1] - last[1]); const m = P((cur[0] + last[0]) / 2, (cur[1] + last[1]) / 2);
      if (len > 0) items.push(label(m[0], m[1] + 20, (Math.round(len * 10) / 10).toString(), 'live-len'));
    }
    if (marks) { items.push(...marks.svg); editor = marks.html; }
  }
  // The Bézier tool's control points so far, and (from the second) the curve they make with the cursor as the next one.
  if (sk.tool === 'bezier' && bezierPoles.length) {
    const cur = draft.cursor, bp = bezierPoles;
    items.push(...bezierMarks('bzd', cur ? [...bp, cur] : bp, P, false));
  }
  // The Ellipse tool's draft: the circle of the first axis while its end is chosen, then the ellipse with the pointer as its other semi-axis.
  const ed = sk.tool === 'ellipse' ? ellipse : null, ec = draft.cursor;
  if (ed) {
    const C = P(ed.c[0], ed.c[1]); items.push(<circle key="ed-c" cx={C[0]} cy={C[1]} r={3.5} className="sk-point" />);
    if (!ed.a && ec) {
      const ax = ellipseAxis(ed.c, ec);
      if (ax) {
        const ring = ellipseSamples({ center: ed.c, rx: ax.rx, ry: ax.rx, angle: 0 }).map(q => P(q[0], q[1])), q = P(ec[0], ec[1]);
        items.push(<polygon key="ed-r" points={ring.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-guide" fill="none" />, <line key="ed-l" x1={C[0]} y1={C[1]} x2={q[0]} y2={q[1]} className="sk-guide" />);
        items.push(label((C[0] + q[0]) / 2, (C[1] + q[1]) / 2 - 16, 'Rx ' + fmtLen(ax.rx) + ' · ' + (Math.round(ax.angle * 10) / 10) + '°', 'live-ellipse-rx'));
      }
    } else if (ed.a) {
      const A = P(ed.a[0], ed.a[1]), def = ec ? draftEllipse(ed, ec) : null;
      items.push(<line key="ed-a" x1={C[0]} y1={C[1]} x2={A[0]} y2={A[1]} className="sk-guide" />, <circle key="ed-ap" cx={A[0]} cy={A[1]} r={3.5} className="sk-point" />);
      if (def) {
        const ring = ellipseSamples(def).map(q => P(q[0], q[1])), why = ellipseError(def);
        items.push(<polygon key="ed-e" points={ring.map(p => p[0] + ',' + p[1]).join(' ')} className={why ? 'sk-guide' : 'sk-shape'} fill="none" />);
        const m = P(ec![0], ec![1]); items.push(label(m[0] + 30, m[1] - 14, 'Rx ' + fmtLen(def.rx) + ' · Ry ' + fmtLen(def.ry), 'live-ellipse-r'));
      }
    }
  }
  // The trim tool's target: the piece a click removes.
  // The centre arc being drawn: its circle while the start is chosen, then the arc so far and its radii.
  const ca = sk.tool === 'carc' ? centreArc : null;
  if (ca) {
    const C = P(ca.c[0], ca.c[1]); items.push(<circle key="ca-c" cx={C[0]} cy={C[1]} r={3} className="sk-point" />);
    if (!ca.a && ca.cursor) {
      const r = Math.hypot(ca.cursor[0] - ca.c[0], ca.cursor[1] - ca.c[1]), ring = Array.from({ length: 73 }, (_, k) => P(ca.c[0] + r * Math.cos(k * Math.PI / 36), ca.c[1] + r * Math.sin(k * Math.PI / 36)));
      const q = P(ca.cursor[0], ca.cursor[1]);
      items.push(<polyline key="ca-r" points={ring.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-guide" fill="none" />, <line key="ca-l" x1={C[0]} y1={C[1]} x2={q[0]} y2={q[1]} className="sk-guide" />);
      if (r > 0) items.push(label((C[0] + q[0]) / 2, (C[1] + q[1]) / 2 - 18, 'R' + fmtLen(r), 'live-carc-r'));
    } else if (ca.a) {
      const r = Math.hypot(ca.a[0] - ca.c[0], ca.a[1] - ca.c[1]), t0 = Math.atan2(ca.a[1] - ca.c[1], ca.a[0] - ca.c[0]), n = Math.max(2, Math.ceil(Math.abs(ca.sweep) / (Math.PI / 36)));
      const arc = Array.from({ length: n + 1 }, (_, k) => P(ca.c[0] + r * Math.cos(t0 + ca.sweep * k / n), ca.c[1] + r * Math.sin(t0 + ca.sweep * k / n)));
      const A = P(ca.a[0], ca.a[1]), E = arc[arc.length - 1];
      items.push(<polyline key="ca-arc" points={arc.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape open" />,
        <line key="ca-a" x1={C[0]} y1={C[1]} x2={A[0]} y2={A[1]} className="sk-guide" />, <line key="ca-e" x1={C[0]} y1={C[1]} x2={E[0]} y2={E[1]} className="sk-guide" />,
        <circle key="ca-ap" cx={A[0]} cy={A[1]} r={3.5} className="sk-point" />);
      if (Math.abs(ca.sweep) > 1e-3) items.push(label(E[0] + 30, E[1] - 14, (Math.round(Math.abs(ca.sweep) * 1800 / Math.PI) / 10) + '°', 'live-carc-a'));
    }
  }
  const trim = cutting && draft.trim?.owner === sk && draft.trim.gap === pathGap ? draft.trim : null;
  if (extensionGuide) items.push(<polyline key="arc-extension" className="sk-guide sk-arc-extension" fill="none"
    points={extensionGuide.map(point => { const q = P(...point); return q[0] + ',' + q[1]; }).join(' ')} />);
  if (trim?.kind === 'split') { const p = P(trim.points[0][0], trim.points[0][1]); items.push(<circle key="split" cx={p[0]} cy={p[1]} r={5} className="sk-split" />); }
  else if (trim) items.push(<polyline key="trim" points={trim.points.map(q => { const p = P(q[0], q[1]); return p[0] + ',' + p[1]; }).join(' ')} className={trim.gap ? 'sk-trim sk-path-gap' : trim.kind === 'extend' ? 'sk-extend' : 'sk-trim'} />);
  trim?.ends?.forEach((point, index) => {
    const p = P(...point);
    items.push(<circle key={'gap-end-' + index} cx={p[0]} cy={p[1]} r={4} className="sk-split sk-path-gap-end" />);
  });
  if (overlaidLine) {
    const a = P(...overlaidLine.start), b = P(...overlaidLine.end);
    items.push(<g key="overlaid-line" className="sk-overlaid-line" data-shape={overlaidLine.shape + 1} data-side={overlaidLine.side + 1} data-id={overlaidLine.id}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      <circle cx={a[0]} cy={a[1]} r={3.5} />
      <circle cx={b[0]} cy={b[1]} r={3.5} fill="var(--bg)" />
    </g>);
  }
  const cur = picking ? null : draft.cursor;
  if (cur) { const p = P(cur[0], cur[1]); items.push(<g key="cur"><line x1={p[0] - 8} y1={p[1]} x2={p[0] + 8} y2={p[1]} className="sk-cursor" /><line x1={p[0]} y1={p[1] - 8} x2={p[0]} y2={p[1] + 8} className="sk-cursor" /></g>); }
  // The object snap the pointer is on: its mark (square end, triangle middle, circle centre, diamond quarter) and name.
  const sn = picking ? null : draft.snap;
  if (cur && sn) {
    const p = P(cur[0], cur[1]), r = 6, mark = sn.kind === 'end' || sn.kind === 'origin' || sn.kind === 'calculated' ? <rect x={p[0] - r} y={p[1] - r} width={2 * r} height={2 * r} />
      : sn.kind === 'mid' ? <polygon points={`${p[0]},${p[1] - r - 1} ${p[0] + r + 1},${p[1] + r} ${p[0] - r - 1},${p[1] + r}`} />
      : sn.kind === 'centre' ? <circle cx={p[0]} cy={p[1]} r={r} /> : <polygon points={`${p[0]},${p[1] - r - 1} ${p[0] + r + 1},${p[1]} ${p[0]},${p[1] + r + 1} ${p[0] - r - 1},${p[1]}`} />;
    items.push(<g key="osnap" className="sk-osnap">{mark}<text x={p[0] + 11} y={p[1] - 9}>{draft.extension ? 'Extension' : ({ end: 'End', mid: 'Middle', centre: 'Centre', quadrant: 'Quadrant', origin: 'Origin', calculated: 'Calculated' } as const)[sn.kind]}</text></g>);
  }
  return editor;
}

export const fmtLen = (v: number) => String(Math.round(v * 10) / 10);
/** A Bézier curve's marks (D354): the control polygon dashed, the curve solid (display samples), the control points as dots; `light`: a finished one. */
function bezierMarks(key: string, poles: readonly [number, number][], P: (u: number, v: number) => readonly number[], light: boolean): ReactNode[] {
  // (A malformed stored shape draws nothing.)
  if (!Array.isArray(poles) || poles.length > 4 || !poles.every(q => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1]))) return [];
  const pts = poles.map(q => P(q[0], q[1])), str = (a: readonly (readonly number[])[]) => a.map(p => p[0] + ',' + p[1]).join(' ');
  const out: ReactNode[] = [];
  if (pts.length >= 2) out.push(<polyline key={key + 'g'} points={str(pts)} className="sk-guide" fill="none" />);
  if (poles.length >= 3) out.push(<polyline key={key + 'c'} points={str(bezierSamples(poles).map(q => P(q[0], q[1])))} className={'sk-shape' + (light ? ' done' : '') + ' open'} style={{ fill: 'none' }} />);
  pts.forEach((p, i) => out.push(<circle key={key + 'p' + i} cx={p[0]} cy={p[1]} r={light ? 3 : 3.5} className={light ? 'sk-end' : 'sk-point'} />));
  return out;
}
/** A spline's handles (D353): at each fit point a handle line 30 px each way along its tangent (the handle, else the automatic one) with a dot at each end; the fit points are dots. */
function splineHandleMarks(def: SplineDef, P: (u: number, v: number) => readonly number[]): ReactNode[] {
  const out: ReactNode[] = [];
  splineHandleGeometry(def, P).forEach((g, i) => {
    out.push(<line key={'sh' + i} x1={g.back[0]} y1={g.back[1]} x2={g.fwd[0]} y2={g.fwd[1]} className="sk-handle" />,
      <circle key={'sha' + i} cx={g.back[0]} cy={g.back[1]} r={4} className="sk-handle-end" />, <circle key={'shb' + i} cx={g.fwd[0]} cy={g.fwd[1]} r={4} className="sk-handle-end" />,
      <circle key={'shc' + i} cx={g.c[0]} cy={g.c[1]} r={3.5} className="sk-point" />);
  });
  return out;
}
