// SD3 (R8.1): a SubD cage's topology and edits, as pure functions — each takes a cage and gives a new one (or
// refuses, SubdError INPUT). Shared by the studio's cage editor, the agent tools and headless use: selection by edge
// loop and ring, a validation for overlays, moving, extruding faces and boundary edges, inserting an edge loop,
// deleting faces, bridging two boundary loops, filling a hole, welding, creases, and one mirror plane.
import { SubdError } from './subd-sd2.js';

export interface Cage { readonly positions: readonly number[]; readonly faces: readonly (readonly number[])[]; readonly creases?: readonly (readonly [number, number])[] }
type V3 = [number, number, number];
const ek = (a: number, b: number) => a < b ? `${a}_${b}` : `${b}_${a}`;

/** The cage's half-edges and edges: each directed side of a face, each undirected edge with its faces (in order of the faces). */
export interface CageTopology {
  /** `${a}>${b}` → [face, side]: face's side `side` runs a → b. */
  readonly half: ReadonlyMap<string, readonly [number, number]>;
  /** undirected edge → its vertices and the faces using it. */
  readonly edges: ReadonlyMap<string, { readonly a: number; readonly b: number; readonly faces: readonly number[] }>;
  /** per vertex: its faces, and its edges' other ends. */
  readonly vertexFaces: readonly (readonly number[])[]; readonly neighbours: readonly (readonly number[])[];
}
export function cageTopology(c: Cage): CageTopology {
  const nv = c.positions.length / 3, half = new Map<string, [number, number]>(), edges = new Map<string, { a: number; b: number; faces: number[] }>();
  const vertexFaces: number[][] = Array.from({ length: nv }, () => []), neighbours: Set<number>[] = Array.from({ length: nv }, () => new Set());
  c.faces.forEach((f, k) => f.forEach((a, s) => {
    const b = f[(s + 1) % f.length];
    half.set(`${a}>${b}`, [k, s]); vertexFaces[a]?.push(k);
    const key = ek(a, b), e = edges.get(key) ?? { a: Math.min(a, b), b: Math.max(a, b), faces: [] };
    e.faces.push(k); edges.set(key, e); neighbours[a]?.add(b); neighbours[b]?.add(a);
  }));
  return { half, edges, vertexFaces, neighbours: neighbours.map(s => [...s]) };
}

// ---- Validation (for an overlay) --------------------------------------------------------------------------------------

export interface CageValidation {
  readonly valid: boolean;
  /** Edges with more than two faces, or used twice the same way (faces wound against each other). */
  readonly nonManifoldEdges: readonly [number, number][];
  /** Vertices whose faces are not one fan (a bowtie). */
  readonly nonManifoldVertices: readonly number[];
  /** Inside vertices not of valence 4 (extraordinary: caps there, R7), and boundary ones not of 3 (or 2 at a corner). */
  readonly poles: readonly { readonly vertex: number; readonly valence: number }[];
  /** Faces that are not quads (refined once more, R7). */
  readonly ngons: readonly number[];
  /** Edges with one face. */
  readonly boundaryEdges: readonly [number, number][];
  /** Vertices where a crease ends inside the surface. */
  readonly darts: readonly number[];
  /** Vertices no face uses. */
  readonly unused: readonly number[];
}
export function validateCage(c: Cage): CageValidation {
  const t = cageTopology(c), nv = c.positions.length / 3, creased = new Set((c.creases ?? []).map(([a, b]) => ek(a, b)));
  const nonManifoldEdges: [number, number][] = [], boundaryEdges: [number, number][] = [];
  const seen = new Set<string>();
  c.faces.forEach(f => f.forEach((a, s) => { const key = `${a}>${f[(s + 1) % f.length]}`; if (seen.has(key)) nonManifoldEdges.push([a, f[(s + 1) % f.length]]); seen.add(key); }));
  for (const e of t.edges.values()) { if (e.faces.length > 2) nonManifoldEdges.push([e.a, e.b]); if (e.faces.length === 1) boundaryEdges.push([e.a, e.b]); }
  const nonManifoldVertices: number[] = [], poles: { vertex: number; valence: number }[] = [], darts: number[] = [], unused: number[] = [];
  for (let v = 0; v < nv; v++) {
    const faces = t.vertexFaces[v];
    if (!faces.length) { unused.push(v); continue; }
    if (fanSize(c, t, v) !== faces.length) nonManifoldVertices.push(v);
    const valence = t.neighbours[v].length, open = t.neighbours[v].some(w => t.edges.get(ek(v, w))!.faces.length === 1);
    if (open ? !(valence === 3 || valence === 2) : valence !== 4) poles.push({ vertex: v, valence });
    if (!open && t.neighbours[v].filter(w => creased.has(ek(v, w))).length === 1) darts.push(v);
  }
  const ngons = c.faces.flatMap((f, k) => f.length === 4 ? [] : [k]);
  return { valid: !nonManifoldEdges.length && !nonManifoldVertices.length && !unused.length, nonManifoldEdges, nonManifoldVertices, poles, ngons, boundaryEdges, darts, unused };
}
/** How many faces round v are reached walking face to face across its edges (all of them, for a manifold vertex). */
function fanSize(c: Cage, t: CageTopology, v: number): number {
  const start = t.vertexFaces[v][0], seen = new Set([start]), stack = [start];
  while (stack.length) {
    const f = c.faces[stack.pop()!], s = f.indexOf(v);
    for (const w of [f[(s + 1) % f.length], f[(s + f.length - 1) % f.length]]) for (const g of t.edges.get(ek(v, w))!.faces) if (!seen.has(g)) { seen.add(g); stack.push(g); }
  }
  return seen.size;
}

// ---- Selection: edge loops and rings ---------------------------------------------------------------------------------

/**
 * The edge loop through edge a–b: from each end on through the edge opposite at a valence-4 vertex (all quads round
 * it), stopping at any other vertex, a boundary or the start (closed). Edges as [from, to] in the loop's order.
 */
export function edgeLoop(c: Cage, a: number, b: number): [number, number][] {
  const t = cageTopology(c);
  if (!t.edges.has(ek(a, b))) throw new SubdError('INPUT', `${a}–${b} is not an edge of the cage`);
  const walk = (from: number, to: number): [number, number][] => {
    const out: [number, number][] = [];
    let p = from, q = to;
    for (let guard = 0; guard < t.edges.size; guard++) {
      const next = oppositeAt(c, t, p, q);
      if (next === null) break;
      if (ek(q, next) === ek(a, b)) return [...out, [-1, -1]]; // (closed: back at the start)
      out.push([q, next]); p = q; q = next;
    }
    return out;
  };
  const forward = walk(a, b);
  if (forward.length && forward[forward.length - 1][0] === -1) return [[a, b], ...forward.slice(0, -1)];
  const back = walk(b, a);
  return [...back.reverse().map(([x, y]) => [y, x] as [number, number]), [a, b], ...forward];
}
/** At v (reached along u → v), the edge straight across: valence 4, four quads, no boundary — else null. */
function oppositeAt(c: Cage, t: CageTopology, u: number, v: number): number | null {
  const ns = t.neighbours[v];
  if (ns.length !== 4 || t.vertexFaces[v].length !== 4 || t.vertexFaces[v].some(f => c.faces[f].length !== 4)) return null;
  // The opposite neighbour shares no face with u–v.
  const near = new Set(t.edges.get(ek(u, v))!.faces);
  for (const w of ns) if (w !== u && !t.edges.get(ek(v, w))!.faces.some(f => near.has(f))) return w;
  return null;
}
/** The edge ring through a–b: across each quad to its opposite edge, on into the next face, stopping at a non-quad, a boundary or the start. Edges oriented alike (their first ends on one side). */
export function edgeRing(c: Cage, a: number, b: number): [number, number][] {
  const t = cageTopology(c);
  const e = t.edges.get(ek(a, b));
  if (!e) throw new SubdError('INPUT', `${a}–${b} is not an edge of the cage`);
  const walk = (p: number, q: number, face: number): { edges: [number, number][]; closed: boolean } => {
    const out: [number, number][] = [];
    let x = p, y = q, f = face;
    for (let guard = 0; guard < t.edges.size; guard++) {
      const F = c.faces[f]; if (F.length !== 4) break;
      const i = F.indexOf(x), j = F.indexOf(y);
      // The quad's opposite side, oriented alike: x's opposite corner is across from x along the other diagonal pair.
      const step = (j - i + 4) % 4 === 1 ? 1 : -1, x2 = F[(i - step + 4) % 4], y2 = F[(j + step + 4) % 4];
      if (ek(x2, y2) === ek(a, b)) return { edges: out, closed: true };
      out.push([x2, y2]);
      const next = t.edges.get(ek(x2, y2))!.faces.find(g => g !== f);
      if (next === undefined) break;
      x = x2; y = y2; f = next;
    }
    return { edges: out, closed: false };
  };
  const [f0, f1] = e.faces;
  const one = walk(a, b, f0);
  if (one.closed || f1 === undefined) return [[a, b], ...one.edges];
  const two = walk(a, b, f1);
  return [...two.edges.reverse(), [a, b], ...one.edges];
}

// ---- Edits ------------------------------------------------------------------------------------------------------------

const pt = (c: Cage, v: number): V3 => [c.positions[3 * v], c.positions[3 * v + 1], c.positions[3 * v + 2]];
const withCreases = (c: Cage, faces: number[][], positions: number[], creases: [number, number][]): Cage => creases.length ? { positions, faces, creases } : { positions, faces };

/** The vertices moved by `delta` (a mirror plane's own vertices kept on it: see mirror). */
export function moveVertices(c: Cage, vertices: readonly number[], delta: readonly number[]): Cage {
  const positions = [...c.positions];
  for (const v of new Set(vertices)) for (let a = 0; a < 3; a++) positions[3 * v + a] += delta[a];
  return { ...c, positions };
}
/** The vertices of a selection of vertices, edges ([a, b]) and faces. */
export function selectionVertices(c: Cage, sel: { vertices?: readonly number[]; edges?: readonly (readonly [number, number])[]; faces?: readonly number[] }): number[] {
  return [...new Set([...(sel.vertices ?? []), ...(sel.edges ?? []).flat(), ...(sel.faces ?? []).flatMap(f => c.faces[f])])];
}
/** A face region's outward normal at each of its vertices (the mean of its faces' Newell normals there). */
function regionNormals(c: Cage, faces: readonly number[]): Map<number, V3> {
  const out = new Map<number, V3>();
  for (const k of faces) {
    const f = c.faces[k], n: V3 = [0, 0, 0];
    for (let i = 0; i < f.length; i++) { const p = pt(c, f[i]), q = pt(c, f[(i + 1) % f.length]); n[0] += (p[1] - q[1]) * (p[2] + q[2]); n[1] += (p[2] - q[2]) * (p[0] + q[0]); n[2] += (p[0] - q[0]) * (p[1] + q[1]); }
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    for (const v of f) { const m = out.get(v) ?? [0, 0, 0]; out.set(v, [m[0] + n[0] / l, m[1] + n[1] / l, m[2] + n[2] / l]); }
  }
  for (const [v, m] of out) { const l = Math.hypot(m[0], m[1], m[2]) || 1; out.set(v, [m[0] / l, m[1] / l, m[2] / l]); }
  return out;
}
/**
 * The faces extruded as one region: their vertices copied and moved `distance` along the region's normal there, the
 * faces moved onto the copies, and a side quad along every border edge of the region (an edge with no other region
 * face). Returns the cage and the new faces' indices (the region, now at the copies).
 */
export function extrudeFaces(c: Cage, faces: readonly number[], distance = 0): { cage: Cage; faces: number[]; vertices: number[] } {
  const region = new Set(faces);
  if (!region.size || [...region].some(k => !(k >= 0 && k < c.faces.length))) throw new SubdError('INPUT', 'extrude: name faces of the cage');
  const t = cageTopology(c), normals = regionNormals(c, [...region]), positions = [...c.positions], copy = new Map<number, number>();
  for (const k of region) for (const v of c.faces[k]) if (!copy.has(v)) {
    const n = normals.get(v)!, p = pt(c, v); copy.set(v, positions.length / 3); positions.push(p[0] + distance * n[0], p[1] + distance * n[1], p[2] + distance * n[2]);
  }
  const out = c.faces.map((f, k) => region.has(k) ? f.map(v => copy.get(v)!) : [...f]);
  for (const k of region) c.faces[k].forEach((a, s, f) => {
    const b = f[(s + 1) % f.length], across = t.edges.get(ek(a, b))!.faces.find(g => g !== k);
    if (across !== undefined && region.has(across)) return;
    out.push([a, b, copy.get(b)!, copy.get(a)!]);
  });
  return { cage: withCreases(c, out, positions, [...(c.creases ?? [])] as [number, number][]), faces: [...region], vertices: [...copy.values()] };
}
/** Boundary edges extruded: each [a, b] (a face's side, no face across) gets a new quad out to a + delta, b + delta (shared along a chain). */
export function extrudeEdges(c: Cage, edges: readonly (readonly [number, number])[], delta: readonly number[]): { cage: Cage; vertices: number[] } {
  const t = cageTopology(c), positions = [...c.positions], copy = new Map<number, number>(), out = c.faces.map(f => [...f]);
  const dup = (v: number) => { let w = copy.get(v); if (w === undefined) { const p = pt(c, v); w = positions.length / 3; positions.push(p[0] + delta[0], p[1] + delta[1], p[2] + delta[2]); copy.set(v, w); } return w; };
  for (const [x, y] of edges) {
    const e = t.edges.get(ek(x, y));
    if (!e || e.faces.length !== 1) throw new SubdError('INPUT', `extrude: ${x}–${y} is not a boundary edge`);
    // (Its face runs a → b; the new quad runs b → a along it, so they meet as twins.)
    const [a, b] = t.half.has(`${x}>${y}`) ? [x, y] : [y, x];
    out.push([b, a, dup(a), dup(b)]);
  }
  return { cage: withCreases(c, out, positions, [...(c.creases ?? [])] as [number, number][]), vertices: [...copy.values()] };
}
/** An edge loop inserted across the ring through a–b, at t along each ring edge (0 at its first end): each quad of the ring split in two; a face at a ring's open end gains the point (it becomes an n-gon). */
export function insertEdgeLoop(c: Cage, a: number, b: number, t = 0.5): { cage: Cage; vertices: number[] } {
  if (!(t > 0 && t < 1)) throw new SubdError('INPUT', 'insert loop: t is between 0 and 1');
  const ring = edgeRing(c, a, b), topo = cageTopology(c), positions = [...c.positions], mid = new Map<string, number>();
  for (const [x, y] of ring) { const p = pt(c, x), q = pt(c, y); mid.set(ek(x, y), positions.length / 3); positions.push(p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]), p[2] + t * (q[2] - p[2])); }
  const touched = new Set(ring.flatMap(([x, y]) => topo.edges.get(ek(x, y))!.faces));
  const out: number[][] = [];
  c.faces.forEach((f, k) => {
    if (!touched.has(k)) { out.push([...f]); return; }
    // Its cycle with the ring's points inserted; a quad with two of them split along them.
    const cyc: number[] = [], at: number[] = [];
    f.forEach((v, s) => { cyc.push(v); const m = mid.get(ek(v, f[(s + 1) % f.length])); if (m !== undefined) { at.push(cyc.length); cyc.push(m); } });
    if (at.length === 2 && f.length === 4) { const [i, j] = at; out.push(cyc.slice(i, j + 1), [...cyc.slice(j), ...cyc.slice(0, i + 1)]); }
    else out.push(cyc);
  });
  const creases: [number, number][] = [];
  for (const [x, y] of c.creases ?? []) { const m = mid.get(ek(x, y)); if (m === undefined) creases.push([x, y]); else creases.push([x, m], [m, y]); }
  return { cage: withCreases(c, out, positions, creases), vertices: [...mid.values()] };
}
/** The faces removed, and the vertices no face uses any more (renumbered; creases kept where their edges are). */
export function deleteFaces(c: Cage, faces: readonly number[]): Cage {
  const gone = new Set(faces);
  return compact({ ...c, faces: c.faces.filter((_, k) => !gone.has(k)) });
}
/** Vertices no face uses dropped and the rest renumbered; creases on edges no face has any more dropped. */
export function compact(c: Cage): Cage {
  const used = new Map<number, number>(), positions: number[] = [];
  for (const f of c.faces) for (const v of f) if (!used.has(v)) { used.set(v, positions.length / 3); positions.push(...pt(c, v)); }
  const faces = c.faces.map(f => f.map(v => used.get(v)!)), edges = cageTopology({ positions, faces }).edges;
  const creases = (c.creases ?? []).flatMap(([a, b]) => used.has(a) && used.has(b) && edges.has(ek(used.get(a)!, used.get(b)!)) ? [[used.get(a)!, used.get(b)!] as [number, number]] : []);
  return withCreases(c, faces, positions, creases);
}
/** A boundary's edges in order round a hole (or along an open chain), each as its face runs it: [v0, v1, …]. */
export function boundaryLoop(c: Cage, edges: readonly (readonly [number, number])[]): { vertices: number[]; closed: boolean } {
  const t = cageTopology(c), next = new Map<number, number>(), prev = new Map<number, number>();
  for (const [x, y] of edges) {
    const e = t.edges.get(ek(x, y));
    if (!e || e.faces.length !== 1) throw new SubdError('INPUT', `${x}–${y} is not a boundary edge`);
    const [a, b] = t.half.has(`${x}>${y}`) ? [x, y] : [y, x];
    if (next.has(a) || prev.has(b)) throw new SubdError('INPUT', 'the boundary edges branch: give one loop or chain');
    next.set(a, b); prev.set(b, a);
  }
  let start = [...next.keys()].find(v => !prev.has(v)), closed = false;
  if (start === undefined) { start = next.keys().next().value!; closed = true; }
  const vertices = [start];
  for (let v = next.get(start); v !== undefined && v !== start; v = next.get(v)) vertices.push(v);
  if (vertices.length !== (closed ? next.size : next.size + 1)) throw new SubdError('INPUT', 'the boundary edges are not one loop or chain');
  return { vertices, closed };
}
/** A hole filled by one face (an n-gon: R7 refines it), run against its boundary. */
export function fillHole(c: Cage, edges: readonly (readonly [number, number])[]): Cage {
  const { vertices, closed } = boundaryLoop(c, edges);
  if (!closed) throw new SubdError('INPUT', 'fill: the boundary edges do not close round a hole');
  return { ...c, faces: [...c.faces, [...vertices].reverse()] };
}
/**
 * Two boundary loops (or chains) of as many edges bridged by quads. A loop is paired with the other turned the
 * opposite way (each quad meets both as a twin) at the offset that keeps the bridge shortest.
 */
export function bridge(c: Cage, edgesA: readonly (readonly [number, number])[], edgesB: readonly (readonly [number, number])[]): Cage {
  const A = boundaryLoop(c, edgesA), B = boundaryLoop(c, edgesB);
  if (A.closed !== B.closed || A.vertices.length !== B.vertices.length) throw new SubdError('INPUT', `bridge: the two ${A.closed ? 'loops' : 'chains'} differ (${A.vertices.length} and ${B.vertices.length} vertices, ${A.closed ? 'closed' : 'open'} and ${B.closed ? 'closed' : 'open'})`);
  if (A.vertices.some(v => B.vertices.includes(v))) throw new SubdError('INPUT', 'bridge: the two boundaries share a vertex');
  const n = A.vertices.length, a = A.vertices, b = B.vertices;
  // B(i): b run backwards from offset s; the closed case tries every s, the open one pairs the ends.
  let best = 0, bestCost = Infinity;
  for (let s = 0; s < (A.closed ? n : 1); s++) {
    let cost = 0;
    for (let i = 0; i < n; i++) { const p = pt(c, a[i]), q = pt(c, b[A.closed ? (s - i + n) % n : n - 1 - i]); cost += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }
    if (cost < bestCost) { bestCost = cost; best = s; }
  }
  const B_ = (i: number) => b[A.closed ? ((best - i) % n + n) % n : n - 1 - i];
  const faces = c.faces.map(f => [...f]);
  for (let i = 0; i < (A.closed ? n : n - 1); i++) faces.push([a[(i + 1) % n], a[i], B_(i), B_(i + 1)]);
  return { ...c, faces };
}
/** The vertices merged into their centroid; faces losing a side keep the rest (one left with fewer than 3 is removed). Refused when the result is not a manifold. */
export function weldVertices(c: Cage, vertices: readonly number[]): Cage {
  if (new Set(vertices).size < 2) throw new SubdError('INPUT', 'weld: give at least two vertices');
  return weldGroups(c, [[...new Set(vertices)]]);
}
/** Vertices within `tolerance` of each other welded, group by group (e.g. two loops brought together). */
export function weldWithin(c: Cage, vertices: readonly number[], tolerance: number): Cage {
  const groups: number[][] = [], taken = new Set<number>();
  for (const v of vertices) {
    if (taken.has(v)) continue;
    const p = pt(c, v), g = vertices.filter(w => !taken.has(w) && Math.hypot(...pt(c, w).map((x, a) => x - p[a])) <= tolerance);
    g.forEach(w => taken.add(w)); if (g.length > 1) groups.push([...new Set(g)]);
  }
  if (!groups.length) throw new SubdError('INPUT', `weld: no two of the vertices are within ${tolerance} mm`);
  return weldGroups(c, groups);
}
/** Each group merged into its first vertex at the group's centroid, all at once. */
function weldGroups(c: Cage, groups: readonly (readonly number[])[]): Cage {
  const to = new Map<number, number>(), positions = [...c.positions];
  for (const g of groups) {
    const m: V3 = [0, 0, 0];
    for (const v of g) { const p = pt(c, v); for (let a = 0; a < 3; a++) m[a] += p[a] / g.length; to.set(v, g[0]); }
    positions.splice(3 * g[0], 3, ...m);
  }
  const map = (v: number) => to.get(v) ?? v;
  const faces = c.faces.map(f => f.map(map).filter((v, i, g) => v !== g[(i + g.length - 1) % g.length])).filter(f => f.length >= 3 && new Set(f).size === f.length);
  const creases = (c.creases ?? []).map(([a, b]) => [map(a), map(b)] as [number, number]).filter(([a, b]) => a !== b);
  const out = compact(withCreases(c, faces, positions, creases)), v = validateCage(out);
  if (!v.valid) throw new SubdError('INPUT', `weld: the cage would not be a manifold (${v.nonManifoldEdges.length} edges, ${v.nonManifoldVertices.length} vertices)`);
  return out;
}
/** Edges made infinitely sharp (on) or smooth again (off). */
export function setCreases(c: Cage, edges: readonly (readonly [number, number])[], on: boolean): Cage {
  const t = cageTopology(c);
  for (const [a, b] of edges) if (!t.edges.has(ek(a, b))) throw new SubdError('INPUT', `crease: ${a}–${b} is not an edge of the cage`);
  const have = new Map((c.creases ?? []).map(([a, b]) => [ek(a, b), [a, b] as [number, number]]));
  for (const [a, b] of edges) { if (on) have.set(ek(a, b), [a, b]); else have.delete(ek(a, b)); }
  return withCreases(c, c.faces.map(f => [...f]), [...c.positions], [...have.values()]);
}

// ---- Mirror ------------------------------------------------------------------------------------------------------------

export type MirrorAxis = 'x' | 'y' | 'z';
/**
 * The full cage from one half and a mirror plane through the origin across `axis`: the half's vertices on the plane
 * (within `tolerance`) shared, the rest copied across, the copied faces wound back; creases copied. A face lying in
 * the plane is refused (it would be doubled).
 */
export function mirrorCage(half: Cage, axis: MirrorAxis, tolerance = 1e-9): Cage {
  const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2, nv = half.positions.length / 3, positions = [...half.positions], copy = new Int32Array(nv);
  for (let v = 0; v < nv; v++) {
    if (Math.abs(half.positions[3 * v + k]) <= tolerance) { positions[3 * v + k] = 0; copy[v] = v; continue; }
    const p = pt(half, v); p[k] = -p[k]; copy[v] = positions.length / 3; positions.push(...p);
  }
  for (const f of half.faces) if (f.every(v => copy[v] === v)) throw new SubdError('INPUT', 'mirror: a face lies in the mirror plane');
  const faces = [...half.faces.map(f => [...f]), ...half.faces.map(f => [...f].reverse().map(v => copy[v]))];
  const creases = [...(half.creases ?? []).map(([a, b]) => [a, b] as [number, number]), ...(half.creases ?? []).filter(([a, b]) => copy[a] !== a || copy[b] !== b).map(([a, b]) => [copy[a], copy[b]] as [number, number])];
  return withCreases(half, faces, positions, creases);
}
/** The half's vertices on the mirror plane put back on it exactly (after a move): they must stay there for the halves to meet. */
export function keepOnPlane(c: Cage, axis: MirrorAxis, onPlane: readonly number[]): Cage {
  const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2, positions = [...c.positions];
  for (const v of onPlane) positions[3 * v + k] = 0;
  return { ...c, positions };
}
