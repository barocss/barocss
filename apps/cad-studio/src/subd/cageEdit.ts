// SD3 (R8.2, D81): the studio's cage-editing session on a subd node — what is edited (the node's cage, or its half
// when mirrored), what is picked, the session's own undo, and the operations of R8.1 (`@barocss/cad` subd-cage)
// applied to the selection. Pure: the App holds a session and draws it; every drag or operation is one step of the
// session's undo; Done writes the node once (one step of the document's undo, the same timeline feature).
import {
  boundaryLoop, bridge, cageTopology, deleteFaces, edgeLoop, edgeRing, extrudeEdges, extrudeFaces, fillHole, halfCage, insertEdgeLoop, keepOnPlane,
  mirrorCage, moveVertices, selectionVertices, setCreases, SubdError, subdPreviewMesh, validateCage, weldVertices, weldWithin, type Cage, type CageValidation, type MirrorAxis,
} from '@barocss/cad';

export type CageMode = 'vertex' | 'edge' | 'face';
export interface CageSelection { readonly vertices: readonly number[]; readonly edges: readonly (readonly [number, number])[]; readonly faces: readonly number[] }
export const emptyCageSel: CageSelection = { vertices: [], edges: [], faces: [] };
export interface StudioCage { positions: number[]; faces: number[][]; creases?: [number, number][] }
export interface CageSession {
  /** The subd node edited. */
  readonly node: number;
  /** The cage as edited (the half, when mirrored) and the mirror plane. */
  readonly cage: StudioCage; readonly mirror?: MirrorAxis;
  /** What the node held when the session began (Cancel puts it back). */
  readonly start: { readonly cage: StudioCage; readonly mirror?: MirrorAxis };
  readonly mode: CageMode; readonly sel: CageSelection;
  /** Box: the cage drawn as it is; Smooth: the limit surface, the cage over it. */
  readonly smooth: boolean;
  readonly undo: readonly { cage: StudioCage; mirror?: MirrorAxis; sel: CageSelection }[]; readonly redo: readonly { cage: StudioCage; mirror?: MirrorAxis; sel: CageSelection }[];
}
export type CageHit = { kind: 'vertex'; v: number } | { kind: 'edge'; a: number; b: number } | { kind: 'face'; f: number };

/** The session without its mirror (so a step can set or drop it). */
const unmirrored = (s: CageSession): Omit<CageSession, 'mirror'> => { const out: { mirror?: MirrorAxis } & Omit<CageSession, 'mirror'> = { ...s }; delete out.mirror; return out; };
const plain = (c: Cage): StudioCage => ({ positions: [...c.positions], faces: c.faces.map(f => [...f]), ...(c.creases?.length ? { creases: c.creases.map(([a, b]) => [a, b] as [number, number]) } : {}) });
const ek = (a: number, b: number) => a < b ? `${a}_${b}` : `${b}_${a}`;

export function startSession(node: number, cage: StudioCage, mirror?: MirrorAxis): CageSession {
  return { node, cage: plain(cage), ...(mirror ? { mirror } : {}), start: { cage: plain(cage), ...(mirror ? { mirror } : {}) }, mode: 'vertex', sel: emptyCageSel, smooth: true, undo: [], redo: [] };
}
/** The cage the kernel builds: the half mirrored, else as edited. */
export const fullCage = (s: Pick<CageSession, 'cage' | 'mirror'>): StudioCage => s.mirror ? plain(mirrorCage(s.cage, s.mirror)) : s.cage;
/** A step: the new cage (and mirror and selection) with the old one on the undo stack. */
function step(s: CageSession, cage: StudioCage, sel: CageSelection, mirror: MirrorAxis | null = s.mirror ?? null): CageSession {
  const rest = unmirrored(s);
  return { ...rest, ...(mirror ? { mirror } : {}), cage, sel, undo: [...s.undo.slice(-99), { cage: s.cage, ...(s.mirror ? { mirror: s.mirror } : {}), sel: s.sel }], redo: [] };
}
export function undoSession(s: CageSession): CageSession {
  const last = s.undo[s.undo.length - 1]; if (!last) return s;
  const rest = unmirrored(s);
  return { ...rest, ...(last.mirror ? { mirror: last.mirror } : {}), cage: last.cage, sel: last.sel, undo: s.undo.slice(0, -1), redo: [...s.redo, { cage: s.cage, ...(s.mirror ? { mirror: s.mirror } : {}), sel: s.sel }] };
}
export function redoSession(s: CageSession): CageSession {
  const next = s.redo[s.redo.length - 1]; if (!next) return s;
  const rest = unmirrored(s);
  return { ...rest, ...(next.mirror ? { mirror: next.mirror } : {}), cage: next.cage, sel: next.sel, redo: s.redo.slice(0, -1), undo: [...s.undo, { cage: s.cage, ...(s.mirror ? { mirror: s.mirror } : {}), sel: s.sel }] };
}

// ---- Picking ------------------------------------------------------------------------------------------------------------

type Project = (p: [number, number, number]) => [number, number, number];
const at = (c: StudioCage, v: number): [number, number, number] => [c.positions[3 * v], c.positions[3 * v + 1], c.positions[3 * v + 2]];
/**
 * What the pointer (x, y, CSS px) picks in a mode: the nearest vertex within 8 px, the nearest edge within 6 px, or
 * the face under it (the nearest, by its centre's depth). The cage is drawn over the body, so nothing hides it.
 */
export function pickCage(c: StudioCage, project: Project, x: number, y: number, mode: CageMode): CageHit | null {
  const P = Array.from({ length: c.positions.length / 3 }, (_, v) => project(at(c, v)));
  if (mode === 'vertex') {
    let best = -1, d0 = 8;
    P.forEach((q, v) => { const d = Math.hypot(q[0] - x, q[1] - y); if (d < d0) { d0 = d; best = v; } });
    return best >= 0 ? { kind: 'vertex', v: best } : null;
  }
  if (mode === 'edge') {
    let best: CageHit | null = null, d0 = 6;
    for (const e of cageTopology(c).edges.values()) {
      const a = P[e.a], b = P[e.b], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
      if (d < d0) { d0 = d; best = { kind: 'edge', a: e.a, b: e.b }; }
    }
    return best;
  }
  let best: CageHit | null = null, z0 = Infinity;
  c.faces.forEach((f, k) => {
    let inside = false;
    for (let i = 0, j = f.length - 1; i < f.length; j = i++) { const a = P[f[i]], b = P[f[j]]; if ((a[1] > y) !== (b[1] > y) && x < a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])) inside = !inside; }
    if (!inside) return;
    const z = f.reduce((s, v) => s + P[v][2], 0) / f.length;
    if (z < z0) { z0 = z; best = { kind: 'face', f: k }; }
  });
  return best;
}
/** A pick applied to the selection: alone, or added / taken away (`additive`); `grow` an edge's loop or ring. */
export function select(s: CageSession, hit: CageHit | null, additive: boolean, grow?: 'loop' | 'ring'): CageSession {
  if (!hit) return additive ? s : { ...s, sel: emptyCageSel };
  const base = additive ? s.sel : emptyCageSel;
  if (hit.kind === 'vertex') { const has = base.vertices.includes(hit.v); return { ...s, sel: { ...emptyCageSel, vertices: has ? base.vertices.filter(v => v !== hit.v) : [...base.vertices, hit.v] } }; }
  if (hit.kind === 'face') { const has = base.faces.includes(hit.f); return { ...s, sel: { ...emptyCageSel, faces: has ? base.faces.filter(f => f !== hit.f) : [...base.faces, hit.f] } }; }
  const add: (readonly [number, number])[] = grow === 'loop' ? edgeLoop(s.cage, hit.a, hit.b) : grow === 'ring' ? edgeRing(s.cage, hit.a, hit.b) : [[hit.a, hit.b]];
  const keys = new Set(base.edges.map(([a, b]) => ek(a, b)));
  const toggled = !grow && keys.has(ek(hit.a, hit.b));
  const edges = toggled ? base.edges.filter(([a, b]) => ek(a, b) !== ek(hit.a, hit.b)) : [...base.edges, ...add.filter(([a, b]) => !keys.has(ek(a, b)))];
  return { ...s, sel: { ...emptyCageSel, edges } };
}
export const selectedVertices = (s: CageSession) => selectionVertices(s.cage, s.sel);
/** The selection's centre (where the gizmo sits), or null. */
export function selectionCentre(s: CageSession): [number, number, number] | null {
  const vs = selectedVertices(s); if (!vs.length) return null;
  const m: [number, number, number] = [0, 0, 0];
  for (const v of vs) for (let k = 0; k < 3; k++) m[k] += s.cage.positions[3 * v + k] / vs.length;
  return m;
}

// ---- Dragging and the operations -------------------------------------------------------------------------------------

/** The vertices on the mirror plane (kept on it as they move). */
function onPlane(s: Pick<CageSession, 'cage' | 'mirror'>): number[] {
  if (!s.mirror) return [];
  const k = s.mirror === 'x' ? 0 : s.mirror === 'y' ? 1 : 2;
  return Array.from({ length: s.cage.positions.length / 3 }, (_, v) => v).filter(v => s.cage.positions[3 * v + k] === 0);
}
/**
 * The cage while the selection is dragged by `delta` (not yet a step): moved — or, with `extrude`, faces or boundary
 * edges extruded first and the new ones moved. The mirror plane's vertices stay on it.
 */
export function dragged(s: CageSession, delta: readonly number[], extrude: boolean): { cage: StudioCage; sel: CageSelection } {
  if (extrude && s.sel.faces.length) {
    // (Mirrored: no wall along the open side on the plane, and what is on the plane stays there.)
    const plane = new Set(onPlane(s)), e = extrudeFaces(s.cage, s.sel.faces, 0, s.mirror ? (a, b) => plane.has(a) && plane.has(b) : undefined);
    const moved = moveVertices(e.cage, e.vertices, delta);
    return { cage: plain(s.mirror ? keepOnPlane(moved, s.mirror, onPlane({ cage: plain(e.cage), mirror: s.mirror })) : moved), sel: { ...emptyCageSel, faces: e.faces } };
  }
  if (extrude && s.sel.edges.length) {
    const e = extrudeEdges(s.cage, s.sel.edges, delta), c = plain(e.cage), t = cageTopology(c);
    // (The new edges: those between the new vertices, the extrusion's open end.)
    const edges = [...t.edges.values()].filter(x => e.vertices.includes(x.a) && e.vertices.includes(x.b)).map(x => [x.a, x.b] as [number, number]);
    return { cage: c, sel: { ...emptyCageSel, edges } };
  }
  const plane = onPlane(s);
  return { cage: plain(keepOnPlane(moveVertices(s.cage, selectedVertices(s), delta), s.mirror ?? 'x', plane)), sel: s.sel };
}
/** A drag let go: one step. */
export function commitDrag(s: CageSession, delta: readonly number[], extrude: boolean): CageSession {
  if (!extrude && delta.every(x => x === 0)) return s;
  const d = dragged(s, delta, extrude);
  return step(s, d.cage, d.sel);
}

export type CageOp = 'extrude' | 'insert-loop' | 'bridge' | 'fill' | 'weld' | 'weld-near' | 'crease' | 'uncrease' | 'delete' | 'select-loop' | 'select-ring' | 'mirror-x' | 'mirror-y' | 'mirror-z' | 'mirror-off';
/** Two boundary edge sets from one selection: its edges split into connected chains. */
function twoBoundaries(c: StudioCage, edges: readonly (readonly [number, number])[]): [(readonly [number, number])[], (readonly [number, number])[]] {
  const groups: (readonly [number, number])[][] = [];
  for (const e of edges) {
    const touching = groups.filter(g => g.some(([a, b]) => a === e[0] || a === e[1] || b === e[0] || b === e[1]));
    const merged = [e, ...touching.flat()];
    for (const g of touching) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  if (groups.length !== 2) throw new SubdError('INPUT', `bridge: select two boundary loops or chains (${groups.length} picked)`);
  void c;
  return [groups[0], groups[1]];
}
/**
 * An operation on the selection: one step, or refused (SubdError, said by the panel). Extrude here goes out 0 (the
 * gizmo then moves it); insert-loop runs across the ring through the first selected edge, at its middle.
 */
export function runOp(s: CageSession, op: CageOp, tolerance = 0.01): CageSession {
  const c = s.cage, sel = s.sel;
  switch (op) {
    case 'select-loop': case 'select-ring': {
      const e = sel.edges[0]; if (!e) throw new SubdError('INPUT', 'pick an edge first');
      return { ...s, sel: { ...emptyCageSel, edges: op === 'select-loop' ? edgeLoop(c, e[0], e[1]) : edgeRing(c, e[0], e[1]) } };
    }
    case 'extrude': {
      if (sel.faces.length) { const d = dragged(s, [0, 0, 0], true); return step(s, d.cage, d.sel); }
      if (sel.edges.length) { const d = dragged(s, [0, 0, 0], true); return step(s, d.cage, d.sel); }
      throw new SubdError('INPUT', 'extrude: pick faces, or boundary edges');
    }
    case 'insert-loop': {
      const e = sel.edges[0]; if (!e) throw new SubdError('INPUT', 'insert loop: pick an edge across which the loop runs');
      const r = insertEdgeLoop(c, e[0], e[1], 0.5), t = cageTopology(r.cage);
      const edges = [...t.edges.values()].filter(x => r.vertices.includes(x.a) && r.vertices.includes(x.b)).map(x => [x.a, x.b] as [number, number]);
      return step(s, plain(r.cage), { ...emptyCageSel, edges });
    }
    case 'bridge': { const [a, b] = twoBoundaries(c, sel.edges); return step(s, plain(bridge(c, a, b)), emptyCageSel); }
    case 'fill': { const out = fillHole(c, sel.edges); return step(s, plain(out), { ...emptyCageSel, faces: [out.faces.length - 1] }); }
    case 'weld': return step(s, plain(weldVertices(c, selectedVertices(s))), emptyCageSel);
    case 'weld-near': return step(s, plain(weldWithin(c, selectedVertices(s), tolerance)), emptyCageSel);
    case 'crease': case 'uncrease': {
      const edges = sel.edges.length ? sel.edges : sel.faces.flatMap(f => c.faces[f].map((v, i, F) => [v, F[(i + 1) % F.length]] as [number, number]));
      if (!edges.length) throw new SubdError('INPUT', 'crease: pick edges (or faces: their sides)');
      return step(s, plain(setCreases(c, edges, op === 'crease')), s.sel);
    }
    case 'delete': {
      if (!sel.faces.length) throw new SubdError('INPUT', 'delete: pick faces');
      return step(s, plain(deleteFaces(c, sel.faces)), emptyCageSel);
    }
    case 'mirror-off': return s.mirror ? step(s, fullCage(s), emptyCageSel, null) : s;
    default: {
      const axis = op.slice(-1) as MirrorAxis;
      // (From a whole cage: its positive side kept; from another mirror: made whole first.)
      return step(s, plain(halfCage(fullCage(s), axis)), emptyCageSel, axis);
    }
  }
}
/** The boundary loop (or chain) through the selected boundary edges, for the panel to say what Fill / Bridge would take. */
export const boundaryOf = (s: CageSession) => boundaryLoop(s.cage, s.sel.edges);

// ---- What is drawn ----------------------------------------------------------------------------------------------------

/** The validation of the cage the kernel builds, for the overlay. */
/**
 * The cage's validation — a matter of its faces, creases and vertex count only (no position) — kept for the last
 * cage: a move, and every step of an extrusion's drag (its topology fixed while it is dragged), reads it again rather
 * than validating a 2k-face cage per frame (4.4 ms; PERF3 C16). The cage compared face by face.
 */
let lastValidation: { faces: readonly (readonly number[])[]; creases: readonly (readonly number[])[]; nv: number; v: CageValidation } | null = null;
export function validationOf(s: CageSession): CageValidation {
  const c = fullCage(s), nv = c.positions.length / 3, creases = c.creases ?? [];
  const last = lastValidation;
  if (last && last.nv === nv && sameLists(last.faces, c.faces) && sameLists(last.creases, creases)) return last.v;
  const v = validateCage(c);
  lastValidation = { faces: c.faces, creases, nv, v };
  return v;
}
function sameLists(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x === y) continue; if (x.length !== y.length) return false; for (let j = 0; j < x.length; j++) if (x[j] !== y[j]) return false; }
  return true;
}
/** Refinement levels for the preview: as fine as stays quick (≈ 20 000 triangles; the exact body follows on release). */
export function previewLevels(c: StudioCage): number { let l = 1; while (l < 3 && 2 * c.faces.length * 4 ** (l + 1) <= 20000) l++; return l; }
/** The limit surface's quick preview (Smooth), or the cage itself (Box), as triangles. */
export function previewTriangles(c: StudioCage, smooth: boolean): { positions: ArrayLike<number>; indices: ArrayLike<number>; normals: ArrayLike<number> | null } {
  if (smooth) return subdPreviewMesh(c, previewLevels(c));
  const idx: number[] = []; for (const f of c.faces) for (let i = 1; i + 1 < f.length; i++) idx.push(f[0], f[i], f[i + 1]);
  return { positions: c.positions, indices: idx, normals: null };
}
