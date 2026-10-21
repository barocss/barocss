// R8.2 (D81): a SubD cage drawn over the viewport while it is edited — faces picked (n-gons tinted), edges (picked,
// creased, open, non-manifold), vertices (picked, poles ringed), and the mirrored half faint. Drawn over the body
// (the cage is the thing edited; nothing hides it), projected every frame — each kind as one SVG path, so a cage of
// thousands of edges stays a handful of elements. On WebGPU its edges and the mirror are engine lines instead (G7,
// `cageLines`: made when the overlay changes, drawn over the scene), and only the faces and vertices stay SVG.
import type { CageOverlay } from './Viewport';
import type { OverlayLines } from './renderer';

type P = (p: readonly number[]) => [number, number, number];
const ek = (a: number, b: number) => a < b ? `${a}_${b}` : `${b}_${a}`;
type EdgeKind = 'plain' | 'picked' | 'crease' | 'open' | 'bad';
type VertexKind = 'plain' | 'picked' | 'pole' | 'bad';
const EDGE_KINDS: readonly EdgeKind[] = ['plain', 'picked', 'crease', 'open', 'bad'];
/** What an overlay draws, apart from where: each edge once with its kind, each vertex's kind and size, the faces tinted. */
interface Prepared { edgeA: Int32Array; edgeB: Int32Array; edgeKind: Uint8Array; seen: number; vertKind: (VertexKind | null)[]; vertR: Float64Array; ngonFaces: number[]; selFaces: number[]; selCount: number; ngonCount: number }
// (Per overlay — it changes with the cage, the selection or the mode, not from frame to frame — so a frame only
// projects and writes the paths: PERF3 C16, 2.8 ms a frame on a 2k-face cage before.)
const prepared = new WeakMap<CageOverlay, Prepared>();
function prepare(overlay: CageOverlay): Prepared {
  const have = prepared.get(overlay); if (have) return have;
  const { cage, sel, mode, validation: v } = overlay, n = cage.positions.length / 3;
  const selFaces = new Set(sel.faces), selEdges = new Set(sel.edges.map(([a, b]) => ek(a, b))), selVerts = new Set(sel.vertices);
  const creased = new Set((cage.creases ?? []).map(([a, b]) => ek(a, b))), ngons = new Set(v.ngons);
  const open = new Set(v.boundaryEdges.map(([a, b]) => ek(a, b))), bad = new Set(v.nonManifoldEdges.map(([a, b]) => ek(a, b)));
  const poles = new Set(v.poles.map(p => p.vertex)), badVerts = new Set(v.nonManifoldVertices);
  const A: number[] = [], B: number[] = [], K: number[] = [], seen = new Set<string>();
  for (const f of cage.faces) for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length], key = ek(a, b);
    if (seen.has(key)) continue; seen.add(key);
    const kind: EdgeKind = selEdges.has(key) ? 'picked' : bad.has(key) ? 'bad' : open.has(key) ? 'open' : creased.has(key) ? 'crease' : 'plain';
    A.push(a); B.push(b); K.push(EDGE_KINDS.indexOf(kind));
  }
  const vertKind: (VertexKind | null)[] = new Array(n).fill(null), vertR = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (selVerts.has(i)) { vertKind[i] = 'picked'; vertR[i] = 4.5; } else if (badVerts.has(i)) { vertKind[i] = 'bad'; vertR[i] = 4; } else if (poles.has(i)) { vertKind[i] = 'pole'; vertR[i] = 4; } else if (mode === 'vertex') { vertKind[i] = 'plain'; vertR[i] = 2.5; }
  }
  const ngonFaces: number[] = [], selList: number[] = [];
  cage.faces.forEach((_, k) => { if (ngons.has(k) && !selFaces.has(k)) ngonFaces.push(k); if (selFaces.has(k)) selList.push(k); });
  const out: Prepared = { edgeA: Int32Array.from(A), edgeB: Int32Array.from(B), edgeKind: Uint8Array.from(K), seen: seen.size, vertKind, vertR, ngonFaces, selFaces: selList, selCount: selFaces.size, ngonCount: ngons.size };
  prepared.set(overlay, out);
  return out;
}
/** The edge kinds' looks as the SVG drew them (styles.css .cage-edge), in its drawing order. */
const EDGE_LOOK: Record<EdgeKind, Omit<OverlayLines, 'segments'>> = {
  plain: { color: '#7aa7ff', width: 1.2, opacity: 0.85, over: true },
  crease: { color: '#7aa7ff', width: 2.4, opacity: 0.85, over: true },
  open: { color: '#f0c94a', width: 1.2, opacity: 0.85, over: true },
  bad: { color: '#ff4d4d', width: 2.6, opacity: 0.85, over: true },
  picked: { color: '#ffb020', width: 2.6, opacity: 1, over: true },
};
const LINE_ORDER = ['plain', 'crease', 'open', 'bad', 'picked'] as const;
const lineCache = new WeakMap<CageOverlay, [string, OverlayLines][]>();
/**
 * The cage's edges as engine overlay lines (G7): a list a kind and the mirrored half's (each edge once, dashed 3 3), keyed
 * `cage:<kind>` in drawing order; the same list for the same overlay.
 */
export function cageLines(overlay: CageOverlay): [string, OverlayLines][] {
  const have = lineCache.get(overlay); if (have) return have;
  const pre = prepare(overlay), P = overlay.cage.positions, segs: Record<EdgeKind, number[]> = { plain: [], picked: [], crease: [], open: [], bad: [] };
  for (let e = 0; e < pre.edgeA.length; e++) { const a = pre.edgeA[e], b = pre.edgeB[e]; segs[EDGE_KINDS[pre.edgeKind[e]]].push(P[3 * a], P[3 * a + 1], P[3 * a + 2], P[3 * b], P[3 * b + 1], P[3 * b + 2]); }
  const out: [string, OverlayLines][] = [];
  const m = overlay.mirrored;
  if (m) {
    const seen = new Set<string>(), M = m.positions, mirror: number[] = [];
    for (const f of m.faces) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length], key = ek(a, b); if (seen.has(key)) continue; seen.add(key); mirror.push(M[3 * a], M[3 * a + 1], M[3 * a + 2], M[3 * b], M[3 * b + 1], M[3 * b + 2]); }
    out.push(['cage:mirror', { segments: Float32Array.from(mirror), color: '#7aa7ff', width: 0.8, opacity: 0.3, dash: [3, 3], over: true }]);
  }
  for (const k of LINE_ORDER) if (segs[k].length) out.push(['cage:' + k, { segments: Float32Array.from(segs[k]), ...EDGE_LOOK[k] }]);
  lineCache.set(overlay, out);
  return out;
}
/** Every key cageLines can use (to clear them). */
export const CAGE_LINE_KEYS = ['cage:mirror', ...LINE_ORDER.map(k => 'cage:' + k)];
const dot = (X: Float64Array, Y: Float64Array, i: number, r: number) => `M${(X[i] - r).toFixed(1)},${Y[i].toFixed(1)}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0`;
const facePath = (faces: readonly (readonly number[])[], list: readonly number[], S: readonly string[]) => list.map(k => 'M' + faces[k].map(i => S[i]).join('L') + 'Z').join('');

export function CageMarks({ overlay, project, lines = true }: { overlay: CageOverlay; project: P; lines?: boolean }) {
  const { cage } = overlay, n = cage.positions.length / 3, pre = prepare(overlay);
  const X = new Float64Array(n), Y = new Float64Array(n), S: string[] = new Array(n);
  for (let i = 0; i < n; i++) { const q = project([cage.positions[3 * i], cage.positions[3 * i + 1], cage.positions[3 * i + 2]]); X[i] = q[0]; Y[i] = q[1]; S[i] = `${X[i].toFixed(1)},${Y[i].toFixed(1)}`; }
  // Edges by kind, each kind one path.
  const paths: Record<EdgeKind, string[]> = { plain: [], picked: [], crease: [], open: [], bad: [] };
  if (lines) for (let e = 0; e < pre.edgeA.length; e++) paths[EDGE_KINDS[pre.edgeKind[e]]].push(`M${S[pre.edgeA[e]]}L${S[pre.edgeB[e]]}`);
  const pickedEdges = lines ? paths.picked.length : pre.edgeKind.reduce((n, k) => n + (EDGE_KINDS[k] === 'picked' ? 1 : 0), 0);
  const verts: Record<VertexKind, string[]> = { plain: [], picked: [], pole: [], bad: [] };
  for (let i = 0; i < n; i++) { const k = pre.vertKind[i]; if (k) verts[k].push(dot(X, Y, i, pre.vertR[i])); }
  const ngons = { size: pre.ngonCount }, selFaces = { size: pre.selCount }, seen = { size: pre.seen };
  const m = overlay.mirrored;
  const mirrorPath = m && lines ? (() => { const M = Array.from({ length: m.positions.length / 3 }, (_, i) => project([m.positions[3 * i], m.positions[3 * i + 1], m.positions[3 * i + 2]])); return m.faces.map(f => 'M' + f.map(i => `${M[i][0].toFixed(1)},${M[i][1].toFixed(1)}`).join('L') + 'Z').join(''); })() : '';
  return <g className="cage" aria-label="SubD cage" data-edges={seen.size} data-picked-edges={pickedEdges} data-engine-lines={lines ? undefined : 1}>
    {mirrorPath && <path d={mirrorPath} className="cage-mirror" />}
    {ngons.size > 0 && <path d={facePath(cage.faces, pre.ngonFaces, S)} className="cage-face ngon" />}
    {selFaces.size > 0 && <path d={facePath(cage.faces, pre.selFaces, S)} className="cage-face picked" data-picked-faces={selFaces.size} />}
    {(['plain', 'crease', 'open', 'bad', 'picked'] as const).map(k => paths[k].length > 0 && <path key={k} d={paths[k].join('')} className={`cage-edge${k === 'plain' ? '' : ' ' + k}`} />)}
    {(['plain', 'pole', 'bad', 'picked'] as const).map(k => verts[k].length > 0 && <path key={'v' + k} d={verts[k].join('')} className={`cage-vertex${k === 'plain' ? '' : ' ' + k}`} />)}
  </g>;
}
