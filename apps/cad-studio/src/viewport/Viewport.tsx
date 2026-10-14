import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { BodyResult } from '../engine/evaluate';
import type { Vec3 } from '../engine/mesh';
import { OrbitCamera } from './camera';
import { Renderer, type EdgeRef, type FaceRef, type ViewState } from './renderer';

export type SketchTool = 'rectangle' | 'circle' | 'polygon';
export type SketchShape =
  | { kind: 'rectangle'; a: [number, number]; b: [number, number] }
  | { kind: 'circle'; c: [number, number]; r: number }
  | { kind: 'polygon'; points: [number, number][]; closed: boolean };

export interface SketchState { planeZ: number; tool: SketchTool; shape: SketchShape | null; base?: { node: number; side: string } | null }
export interface Gizmo { origin: Vec3; values: Vec3; onDrag(values: Vec3): void }

export interface ViewportHandle {
  fit(): void; setView(name: Parameters<OrbitCamera['setView']>[0]): void; toggleOrtho(): boolean; camera: OrbitCamera;
}

interface Props {
  bodies: BodyResult[];
  selection: { faces: FaceRef[]; edges: EdgeRef[]; bodies: number[] };
  ghost: Set<number>;
  sketch: SketchState | null;
  gizmo: Gizmo | null;
  onPick(hit: { face: FaceRef | null; edge: EdgeRef | null; point: Vec3 | null }, additive: boolean): void;
  onSketchShape(shape: SketchShape | null): void;
  onCursor(p: Vec3 | null): void;
  onBoxSelect(bodies: number[], additive: boolean): void;
  onContextMenu(at: { x: number; y: number }, hit: { face: FaceRef | null; edge: EdgeRef | null }): void;
  onDimClick?(key: string): void;
}

const snap = (v: number) => Math.round(v);

export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(props, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const camera = useRef(new OrbitCamera());
  const frame = useRef(0);
  const hover = useRef<{ face: FaceRef | null; edge: EdgeRef | null }>({ face: null, edge: null });
  const drag = useRef<{ mode: 'orbit' | 'pan' | 'gizmo' | 'box' | null; x: number; y: number; axis?: number; start?: Vec3; moved: boolean; x0?: number; y0?: number }>({ mode: null, x: 0, y: 0, moved: false });
  const sketchDraft = useRef<{ cursor: [number, number] | null }>({ cursor: null });
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const propsRef = useRef(props); propsRef.current = props;
  const fitted = useRef(false);

  const viewState = (): ViewState => ({
    hoverFace: hover.current.face, hoverEdge: hover.current.edge,
    selectedFaces: propsRef.current.selection.faces, selectedEdges: propsRef.current.selection.edges, selectedBodies: propsRef.current.selection.bodies,
    offsets: new Map(), ghostBodies: propsRef.current.ghost,
  });

  const request = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const r = renderer.current; if (!r) return;
      r.render(camera.current, viewState());
      setTick(t => t + 1);
    });
  };

  useEffect(() => {
    try { renderer.current = new Renderer(canvas.current!); } catch (e) { setError(String(e)); return; }
    const observer = new ResizeObserver(request); observer.observe(canvas.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const r = renderer.current; if (!r) return;
    r.setBodies(props.bodies);
    if (!fitted.current && props.bodies.length) { const b = r.bounds(); if (b) { camera.current.aspect = canvas.current!.clientWidth / Math.max(1, canvas.current!.clientHeight); camera.current.fit(b.min, b.max); fitted.current = true; } }
    r.setState(viewState()); request();
  }, [props.bodies]);

  useEffect(() => { renderer.current?.setState(viewState()); request(); }, [props.selection, props.ghost]);
  useEffect(() => { request(); }, [props.sketch, props.gizmo]);

  useImperativeHandle(ref, () => ({
    camera: camera.current,
    fit() { const b = renderer.current?.bounds(); if (b) camera.current.fit(b.min, b.max); request(); },
    setView(name) { camera.current.setView(name); const b = renderer.current?.bounds(); if (b) camera.current.fit(b.min, b.max); request(); },
    toggleOrtho() { camera.current.ortho = !camera.current.ortho; request(); return camera.current.ortho; },
  }));

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
  };
  const planePoint = (x: number, y: number, w: number, h: number, z: number): Vec3 | null => {
    const { origin, dir } = camera.current.ray((x / w) * 2 - 1, 1 - (y / h) * 2);
    if (Math.abs(dir[2]) < 1e-6) return null;
    const t = (z - origin[2]) / dir[2]; if (t < 0) return null;
    return [origin[0] + dir[0] * t, origin[1] + dir[1] * t, z];
  };
  const surfacePoint = (x: number, y: number, w: number, h: number, face: FaceRef | null): Vec3 | null => {
    if (!face) return null;
    const f = propsRef.current.bodies[face.body]?.mesh.faces[face.face]; if (!f || f.kind !== 'plane') return null;
    const { origin, dir } = camera.current.ray((x / w) * 2 - 1, 1 - (y / h) * 2);
    const denom = f.normal[0] * dir[0] + f.normal[1] * dir[1] + f.normal[2] * dir[2]; if (Math.abs(denom) < 1e-9) return null;
    const t = ((f.centroid[0] - origin[0]) * f.normal[0] + (f.centroid[1] - origin[1]) * f.normal[1] + (f.centroid[2] - origin[2]) * f.normal[2]) / denom;
    return [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t];
  };

  const gizmoAxes = () => {
    const g = propsRef.current.gizmo; if (!g || !canvas.current) return null;
    const w = canvas.current.clientWidth, h = canvas.current.clientHeight;
    const o: Vec3 = [g.origin[0] + g.values[0], g.origin[1] + g.values[1], g.origin[2] + g.values[2]];
    const len = camera.current.distance * 0.14;
    const p0 = camera.current.project(o, w, h);
    const tips = [0, 1, 2].map(k => { const t: Vec3 = [...o] as Vec3; t[k] += len; return camera.current.project(t, w, h); });
    return { o, p0, tips, len };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    canvas.current!.setPointerCapture(e.pointerId);
    const { x, y } = local(e);
    const axes = gizmoAxes();
    if (e.button === 0 && axes) {
      const hit = axes.tips.findIndex(t => Math.hypot(t[0] - x, t[1] - y) < 14);
      if (hit >= 0) { drag.current = { mode: 'gizmo', x, y, axis: hit, start: [...propsRef.current.gizmo!.values] as Vec3, moved: false }; return; }
    }
    if (e.button === 2 && !e.shiftKey) drag.current = { mode: 'orbit', x, y, moved: false };
    else if (e.button === 1 || (e.button === 2 && e.shiftKey)) drag.current = { mode: 'pan', x, y, moved: false };
    else if (e.button === 0 && e.altKey) drag.current = { mode: 'orbit', x, y, moved: false };
    else drag.current = { mode: null, x, y, moved: false, x0: x, y0: y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y, w, h } = local(e); const d = drag.current; const r = renderer.current; if (!r) return;
    if (d.mode === 'orbit') { camera.current.orbit(x - d.x, y - d.y); d.x = x; d.y = y; d.moved = true; request(); return; }
    if (d.mode === 'pan') { camera.current.pan(x - d.x, y - d.y, h); d.x = x; d.y = y; d.moved = true; request(); return; }
    if (d.mode === 'gizmo') {
      const axes = gizmoAxes()!; const k = d.axis!;
      const sx = axes.tips[k][0] - axes.p0[0], sy = axes.tips[k][1] - axes.p0[1]; const sl = Math.hypot(sx, sy) || 1;
      const along = ((x - d.x) * sx + (y - d.y) * sy) / sl; const mm = (along / sl) * axes.len;
      const values: Vec3 = [...d.start!] as Vec3; values[k] = snap(d.start![k] + mm);
      propsRef.current.gizmo!.onDrag(values); d.moved = true; return;
    }
    const sk = propsRef.current.sketch;
    if (!sk && e.buttons === 1 && d.x0 !== undefined && (d.mode === 'box' || Math.hypot(x - d.x0, y - d.y0!) > 5)) {
      d.mode = 'box'; d.x = x; d.y = y; d.moved = true; request(); return;
    }
    if (sk) {
      const p = planePoint(x, y, w, h, sk.planeZ);
      sketchDraft.current.cursor = p ? [snap(p[0]), snap(p[1])] : null;
      propsRef.current.onCursor(p ? [snap(p[0]), snap(p[1]), sk.planeZ] : null);
      const s = sk.shape; const c = sketchDraft.current.cursor;
      if (s && c) {
        if (s.kind === 'rectangle' && drafting.current) propsRef.current.onSketchShape({ ...s, b: c });
        if (s.kind === 'circle' && drafting.current) propsRef.current.onSketchShape({ ...s, r: Math.max(1, Math.round(Math.hypot(c[0] - s.c[0], c[1] - s.c[1]))) });
      }
      request(); return;
    }
    const face = r.pickFace(x, y, camera.current, viewState());
    const edge = r.pickEdge(x, y, camera.current, viewState());
    const prev = hover.current;
    const next = { face: edge ? null : face, edge };
    if (JSON.stringify(prev) !== JSON.stringify(next)) { hover.current = next; r.setState(viewState()); request(); }
    const point = surfacePoint(x, y, w, h, face) ?? planePoint(x, y, w, h, 0);
    propsRef.current.onCursor(point);
  };

  const drafting = useRef(false);
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = { mode: null, x: 0, y: 0, moved: false };
    const { x, y, w, h } = local(e);
    if (d.mode === 'box') { boxSelect(d.x0!, d.y0!, x, y, e.shiftKey); request(); return; }
    if (e.button === 2 && d.mode === 'orbit' && !d.moved && !propsRef.current.sketch) {
      const r = renderer.current!; const edge = r.pickEdge(x, y, camera.current, viewState());
      const face = edge ? null : r.pickFace(x, y, camera.current, viewState());
      propsRef.current.onContextMenu({ x: e.clientX, y: e.clientY }, { face, edge }); return;
    }
    if (d.mode || d.moved || e.button !== 0) return;
    const sk = propsRef.current.sketch;
    if (sk) {
      const p = planePoint(x, y, w, h, sk.planeZ); if (!p) return;
      const c: [number, number] = [snap(p[0]), snap(p[1])];
      const s = sk.shape;
      if (sk.tool === 'rectangle') {
        if (!drafting.current) { drafting.current = true; propsRef.current.onSketchShape({ kind: 'rectangle', a: c, b: c }); }
        else { drafting.current = false; if (s && s.kind === 'rectangle') propsRef.current.onSketchShape({ ...s, b: c }); }
      } else if (sk.tool === 'circle') {
        if (!drafting.current) { drafting.current = true; propsRef.current.onSketchShape({ kind: 'circle', c, r: 1 }); }
        else drafting.current = false;
      } else {
        const pts = s && s.kind === 'polygon' && !s.closed ? s.points : [];
        if (pts.length >= 3 && pts[0][0] === c[0] && pts[0][1] === c[1]) propsRef.current.onSketchShape({ kind: 'polygon', points: pts, closed: true });
        else propsRef.current.onSketchShape({ kind: 'polygon', points: [...pts, c], closed: false });
      }
      return;
    }
    const r = renderer.current!; const edge = r.pickEdge(x, y, camera.current, viewState());
    const face = edge ? null : r.pickFace(x, y, camera.current, viewState());
    propsRef.current.onPick({ face, edge, point: surfacePoint(x, y, w, h, face) }, e.shiftKey);
  };

  /** Window selection left→right (fully inside), crossing right→left (touching). */
  const boxSelect = (x0: number, y0: number, x1: number, y1: number, additive: boolean) => {
    const c = canvas.current!; const w = c.clientWidth, h = c.clientHeight;
    const [lx, hx, ly, hy] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    const crossing = x1 < x0; const picked: number[] = [];
    propsRef.current.bodies.forEach((b, i) => {
      const P = b.mesh.positions; let inside = 0, total = 0;
      const step = Math.max(3, Math.floor(P.length / 3 / 400) * 3);
      for (let k = 0; k < P.length; k += step) {
        const q = camera.current.project([P[k], P[k + 1], P[k + 2]], w, h); total++;
        if (q[0] >= lx && q[0] <= hx && q[1] >= ly && q[1] <= hy) inside++;
      }
      if (crossing ? inside > 0 : inside === total && total > 0) picked.push(i);
    });
    propsRef.current.onBoxSelect(picked, additive);
  };

  const onWheel = (e: React.WheelEvent) => {
    const { x, y, w, h } = local(e);
    camera.current.zoom(Math.exp(e.deltaY * 0.0015), (x / w) * 2 - 1, 1 - (y / h) * 2); request();
  };

  // Overlay: sketch preview, dimension labels and the move gizmo, projected each frame.
  const overlay = () => {
    const c = canvas.current; if (!c) return null;
    const w = c.clientWidth, h = c.clientHeight; const cam = camera.current;
    const items: React.ReactNode[] = [];
    const sk = props.sketch;
    if (sk) {
      const z = sk.planeZ; const P = (u: number, v: number) => cam.project([u, v, z], w, h);
      const label = (x: number, y: number, text: string, key: string) => (
        <g key={'d' + key} className="dim" onPointerDown={e => { e.stopPropagation(); props.onDimClick?.(key); }}>
          <rect x={x - 26} y={y - 11} width={52} height={22} rx={4} className="dim-chip" /><text x={x} y={y + 4} textAnchor="middle" className="dim-text">{text}</text></g>);
      const glyph = (a: [number, number], b: [number, number], key: string) => {
        const kind = a[1] === b[1] ? 'H' : a[0] === b[0] ? 'V' : null; if (!kind) return;
        const m = P((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        items.push(<g key={'g' + key}><rect x={m[0] - 8} y={m[1] - 26} width={16} height={15} rx={3} className="cons-chip" /><text x={m[0]} y={m[1] - 15} textAnchor="middle" className="cons-text">{kind}</text></g>);
      };
      const s = sk.shape;
      if (s?.kind === 'rectangle') {
        const [x0, x1] = [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0])], [y0, y1] = [Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])];
        const pts = [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
        items.push(<polygon key="r" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape" />);
        pts.forEach((p, i) => items.push(<circle key={'rp' + i} cx={p[0]} cy={p[1]} r={3} className="sk-point" />));
        if (x1 > x0 && y1 > y0) { glyph([x0, y0], [x1, y0], 'b'); glyph([x1, y0], [x1, y1], 'r'); }
        const top = P((x0 + x1) / 2, y0), side = P(x1, (y0 + y1) / 2);
        items.push(label(top[0], top[1] + 20, String(x1 - x0), 'width'), label(side[0] + 36, side[1], String(y1 - y0), 'height'));
      } else if (s?.kind === 'circle') {
        const pts = Array.from({ length: 72 }, (_, i) => P(s.c[0] + s.r * Math.cos(i / 36 * Math.PI), s.c[1] + s.r * Math.sin(i / 36 * Math.PI)));
        items.push(<polygon key="c" points={pts.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape" />);
        const cc = P(s.c[0], s.c[1]); items.push(<circle key="cc" cx={cc[0]} cy={cc[1]} r={3} className="sk-point" />);
        const e = P(s.c[0] + s.r, s.c[1]); items.push(<line key="rl" x1={cc[0]} y1={cc[1]} x2={e[0]} y2={e[1]} className="sk-guide" />, label((cc[0] + e[0]) / 2, (cc[1] + e[1]) / 2 - 16, 'Ø' + s.r * 2, 'diameter'));
      } else if (s?.kind === 'polygon') {
        const pts = s.points.map(p => P(p[0], p[1])); const cur = sketchDraft.current.cursor;
        const line = s.closed ? pts : cur ? [...pts, P(cur[0], cur[1])] : pts;
        items.push(s.closed ? <polygon key="pg" points={line.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape" />
          : <polyline key="pl" points={line.map(p => p[0] + ',' + p[1]).join(' ')} className="sk-shape open" />);
        pts.forEach((p, i) => items.push(<circle key={'p' + i} cx={p[0]} cy={p[1]} r={3.5} className="sk-point" />));
        const n = s.points.length; for (let i = 0; i < (s.closed ? n : n - 1); i++) glyph(s.points[i], s.points[(i + 1) % n], 'p' + i);
        if (!s.closed && cur && n) {
          const last = s.points[n - 1];
          if (cur[0] === last[0] || cur[1] === last[1]) glyph(last, cur, 'live');
          const len = Math.hypot(cur[0] - last[0], cur[1] - last[1]); const m = P((cur[0] + last[0]) / 2, (cur[1] + last[1]) / 2);
          if (len > 0) items.push(label(m[0], m[1] + 20, (Math.round(len * 10) / 10).toString(), 'live-len'));
        }
      }
      const cur = sketchDraft.current.cursor;
      if (cur) { const p = P(cur[0], cur[1]); items.push(<g key="cur"><line x1={p[0] - 8} y1={p[1]} x2={p[0] + 8} y2={p[1]} className="sk-cursor" /><line x1={p[0]} y1={p[1] - 8} x2={p[0]} y2={p[1] + 8} className="sk-cursor" /></g>); }
    }
    // Thick strokes for hovered and selected edges (WebGL lines are 1 px).
    const edgeStroke = (e: EdgeRef, cls: string, key: string) => {
      const mesh = props.bodies[e.body]?.mesh; if (!mesh) return;
      const L = mesh.edgeLines, E = mesh.edgeOfSegment; const parts: string[] = [];
      for (let s = 0; s < L.length; s += 6) if (E[s / 3] === e.edge) {
        const p = cam.project([L[s], L[s + 1], L[s + 2]], w, h), q = cam.project([L[s + 3], L[s + 4], L[s + 5]], w, h);
        parts.push(`M${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`);
      }
      if (parts.length) items.push(<path key={key} d={parts.join('')} className={cls} />);
    };
    if (!sk) {
      if (hover.current.edge) edgeStroke(hover.current.edge, 'edge-hover', 'eh');
      props.selection.edges.forEach((e, i) => edgeStroke(e, 'edge-sel', 'es' + i));
    }
    const axes = gizmoAxes();
    if (axes) {
      const colors = ['#e5534b', '#57b26b', '#4f8ff7'];
      axes.tips.forEach((t, k) => items.push(<g key={'g' + k}><line x1={axes.p0[0]} y1={axes.p0[1]} x2={t[0]} y2={t[1]} stroke={colors[k]} strokeWidth={3} /><circle cx={t[0]} cy={t[1]} r={7} fill={colors[k]} className="gz-handle" /></g>));
      items.push(<circle key="go" cx={axes.p0[0]} cy={axes.p0[1]} r={6} fill="#f2f3f5" stroke="#101113" strokeWidth={1.5} />);
    }
    const dr = drag.current;
    if (dr.mode === 'box' && dr.x0 !== undefined) {
      const crossing = dr.x < dr.x0;
      items.push(<rect key="box" x={Math.min(dr.x0, dr.x)} y={Math.min(dr.y0!, dr.y)} width={Math.abs(dr.x - dr.x0)} height={Math.abs(dr.y - dr.y0!)} className={crossing ? 'marquee crossing' : 'marquee'} />);
    }
    // Axis triad, bottom-left, following the camera.
    const { right, up } = cam.basis(); const tx = 92, ty = h - 64;
    ['#e5534b', '#57b26b', '#4f8ff7'].forEach((color, k) => {
      const a: Vec3 = [0, 0, 0]; a[k] = 1;
      const x = a[0] * right[0] + a[1] * right[1] + a[2] * right[2], y = -(a[0] * up[0] + a[1] * up[1] + a[2] * up[2]);
      items.push(<g key={'t' + k}><line x1={tx} y1={ty} x2={tx + x * 20} y2={ty + y * 20} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <text x={tx + x * 27} y={ty + y * 27 + 3} fontSize={9} textAnchor="middle" fill={color} fontFamily="IBM Plex Mono">{'XYZ'[k]}</text></g>);
    });
    return <svg className="vp-overlay" width={w} height={h} aria-hidden="true">{items}</svg>;
  };

  return (
    <div className="viewport">
      <canvas ref={canvas} className="vp-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onWheel={onWheel} onContextMenu={e => e.preventDefault()} aria-label="3D viewport. Right-drag to orbit, middle-drag to pan, wheel to zoom." />
      {overlay()}
      {error && <div className="vp-error" role="alert">{error}</div>}
    </div>
  );
});
