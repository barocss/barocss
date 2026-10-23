// R8.2 (D83): the agent's SubD cage tools — the cage editor's operations (subd/cageEdit.ts, the same session steps
// a person makes in the studio, mirror and all) on a subd node, by index; a query to find what to pick. Indices are
// the cage's as the node keeps it: the half, when the node is mirrored (its plane's vertices stay on the plane).
// Under D41 a move is a value edit of the node (its faces and creases unchanged) and applies at L2; any other
// change is a change of topology, which L2 proposes.
import { SubdError, type CageValidation } from '@barocss/cad';
import type { ModelNode, StudioDoc } from '../engine/doc';
import { commitDrag, emptyCageSel, runOp, selectedVertices, startSession, validationOf, type CageOp, type CageSelection, type CageSession, type StudioCage } from '../subd/cageEdit';
import type { ToolDefinition } from './api';
import { r6Signed as r6 } from '../util/round';
import { isObj, isVec3 } from '../util/guards';

type SubdNode = Extract<ModelNode, { kind: 'subd' }>;
type V3 = [number, number, number];
type Args = Record<string, unknown>;
export const CAGE_TOOL_NAMES = new Set(['subd_cage', 'subd_select', 'subd_move', 'subd_extrude', 'subd_insert_loop', 'subd_bridge', 'subd_fill', 'subd_weld', 'subd_crease', 'subd_delete']);
/** The ones that change the part. */
export const CAGE_MUTATORS = new Set(['subd_move', 'subd_extrude', 'subd_insert_loop', 'subd_bridge', 'subd_fill', 'subd_weld', 'subd_crease', 'subd_delete']);

/** A tool's answer: the next document and what it did, a read-only result, or why not. */
export type CageToolResult = { doc: StudioDoc; did: string; extra: Record<string, unknown> } | { read: Record<string, unknown> } | { error: string };


/** The subd node at `index`, or why not. */
function nodeAt(doc: StudioDoc, index: unknown): { node: SubdNode; index: number } | { error: string } {
  const i = Number(index), subds = doc.nodes.flatMap((n, k) => n.kind === 'subd' ? [k] : []);
  if (!Number.isInteger(i) || !doc.nodes[i]) return { error: `There is no feature ${String(index)}${subds.length ? `; the SubD features are ${subds.join(', ')}` : ' (and no SubD feature: run_command subd-box, subd-torus or subd-tube makes one)'}.` };
  const n = doc.nodes[i];
  if (n.kind !== 'subd') return { error: `Feature ${i} is a ${n.kind}, not a SubD cage${subds.length ? `; the SubD features are ${subds.join(', ')}` : ''}.` };
  return { node: n, index: i };
}
const indices = (x: unknown, what: string, below: number): number[] | string => {
  if (x === undefined) return [];
  if (!Array.isArray(x) || !x.every(v => Number.isInteger(v) && v >= 0 && v < below)) return `"${what}" is a list of indices from 0 to ${below - 1}.`;
  return [...new Set(x as number[])];
};
function edgeList(x: unknown, c: StudioCage): [number, number][] | string {
  if (x === undefined) return [];
  const n = c.positions.length / 3;
  if (!Array.isArray(x) || !x.every(e => Array.isArray(e) && e.length === 2 && e.every(v => Number.isInteger(v) && v >= 0 && v < n))) return '"edges" is a list of [a, b] vertex index pairs.';
  const have = new Set<string>(); for (const f of c.faces) for (let i = 0; i < f.length; i++) { const a = f[i], b = f[(i + 1) % f.length]; have.add(a < b ? `${a}_${b}` : `${b}_${a}`); }
  const out = x as [number, number][], missing = out.filter(([a, b]) => !have.has(a < b ? `${a}_${b}` : `${b}_${a}`));
  if (missing.length) return `Not edges of the cage: ${missing.slice(0, 5).map(e => `[${e.join(', ')}]`).join(', ')}${missing.length > 5 ? ' …' : ''}.`;
  return out;
}
const vec = (x: unknown): V3 | null => isVec3(x) ? [x[0], x[1], x[2]] : null;

/** A face's centre and unit normal (Newell). */
function faceFrame(c: StudioCage, f: number): { centre: V3; normal: V3 } {
  const F = c.faces[f], P = c.positions, n: V3 = [0, 0, 0], m: V3 = [0, 0, 0];
  for (let i = 0; i < F.length; i++) {
    const a = 3 * F[i], b = 3 * F[(i + 1) % F.length];
    n[0] += (P[a + 1] - P[b + 1]) * (P[a + 2] + P[b + 2]); n[1] += (P[a + 2] - P[b + 2]) * (P[a] + P[b]); n[2] += (P[a] - P[b]) * (P[a + 1] + P[b + 1]);
    m[0] += P[a] / F.length; m[1] += P[a + 1] / F.length; m[2] += P[a + 2] / F.length;
  }
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return { centre: m, normal: [n[0] / l, n[1] / l, n[2] / l] };
}
const inBox = (p: readonly number[], box: unknown): boolean => {
  if (!isObj(box)) return true;
  const lo = vec(box.min) ?? [-Infinity, -Infinity, -Infinity], hi = vec(box.max) ?? [Infinity, Infinity, Infinity];
  return p[0] >= lo[0] && p[0] <= hi[0] && p[1] >= lo[1] && p[1] <= hi[1] && p[2] >= lo[2] && p[2] <= hi[2];
};
function validationSummary(v: CageValidation): Record<string, unknown> {
  return { valid: v.valid, poles: v.poles.length, ngons: v.ngons.length, open_edges: v.boundaryEdges.length, non_manifold_edges: v.nonManifoldEdges.length, non_manifold_vertices: v.nonManifoldVertices.length };
}
function cageSummary(n: SubdNode, s: CageSession): Record<string, unknown> {
  const c = n.cage, P = c.positions, lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P[i + k]); hi[k] = Math.max(hi[k], P[i + k]); }
  return { vertices: P.length / 3, faces: c.faces.length, creases: c.creases?.length ?? 0, ...(n.mirror ? { mirror: n.mirror, note: `the cage is the half on the + side of ${n.mirror}; the body is it and its mirror image` } : {}), bounds: { min: lo.map(r6), max: hi.map(r6) }, validation: validationSummary(validationOf(s)) };
}
/** The document with the session's cage on its node (and its mirror, as the editor writes it). */
function withCage(doc: StudioDoc, s: CageSession): StudioDoc {
  return { ...doc, nodes: doc.nodes.map((n, i) => {
    if (i !== s.node) return n;
    const node = { ...(n as SubdNode) } as Partial<SubdNode>; delete node.mirror;
    return { ...node, cage: s.cage, ...(s.mirror ? { mirror: s.mirror } : {}) } as ModelNode;
  }) };
}

/** Runs one cage tool. Read-only tools answer `read`; the others the document they make (not yet evaluated). */
export function runCageTool(doc: StudioDoc, name: string, args: Args): CageToolResult {
  const at = nodeAt(doc, args.index);
  if ('error' in at) return at;
  const { node, index } = at, c = node.cage, s0 = startSession(index, c, node.mirror), nv = c.positions.length / 3;
  try {
    if (name === 'subd_cage') return { read: { index, ...cageSummary(node, s0) } };
    if (name === 'subd_select') return { read: select(c, args) };
    const sel = selectionOf(c, args);
    if (typeof sel === 'string') return { error: sel };
    const s = { ...s0, sel };
    let next: CageSession, did: string;
    switch (name) {
      case 'subd_move': {
        const d = vec(args.delta); if (!d) return { error: 'Pass "delta": [dx, dy, dz] in mm.' };
        if (!selectedVertices(s).length) return { error: 'Pass what to move: "vertices", "edges" or "faces".' };
        next = commitDrag(s, d, false); did = `moved ${selectedVertices(s).length} cage vertices by [${d.join(', ')}]`; break;
      }
      case 'subd_extrude': {
        if (!sel.faces.length && !sel.edges.length) return { error: 'Pass "faces" to extrude, or open "edges" (a boundary) to pull out.' };
        let d = vec(args.offset);
        if (!d) {
          const dist = Number(args.distance); if (!Number.isFinite(dist) || !sel.faces.length) return { error: 'Pass "offset": [dx, dy, dz], or (for faces) "distance" along their mean normal.' };
          const n: V3 = [0, 0, 0]; for (const f of sel.faces) { const fr = faceFrame(c, f); n[0] += fr.normal[0]; n[1] += fr.normal[1]; n[2] += fr.normal[2]; }
          const l = Math.hypot(n[0], n[1], n[2]); if (!(l > 1e-9)) return { error: 'The faces\' normals cancel out: give "offset".' };
          d = [n[0] / l * dist, n[1] / l * dist, n[2] / l * dist];
        }
        next = commitDrag(s, d, true); did = `extruded ${sel.faces.length ? `${sel.faces.length} faces` : `${sel.edges.length} open edges`} by [${d.map(r6).join(', ')}]`; break;
      }
      case 'subd_insert_loop': {
        const t = args.t === undefined ? 0.5 : Number(args.t);
        if (!(t > 0 && t < 1)) return { error: '"t" is a fraction between 0 and 1 (exclusive) along the edge from its first vertex.' };
        next = runOp(s, 'insert-loop', undefined, t); did = `inserted an edge loop across [${sel.edges[0]?.join(', ')}]${t === 0.5 ? '' : ` at ${r6(t)} along it`}`; break;
      }
      case 'subd_bridge': { next = op(s, 'bridge'); did = `bridged two open loops (${sel.edges.length} edges)`; break; }
      case 'subd_fill': { next = op(s, 'fill'); did = `filled the hole round ${sel.edges.length} open edges`; break; }
      case 'subd_weld': {
        const tol = args.tolerance === undefined ? null : Number(args.tolerance);
        if (tol !== null && !(tol > 0)) return { error: '"tolerance" is a distance above 0 (mm).' };
        next = tol === null ? op(s, 'weld') : runOp(s, 'weld-near', tol); did = tol === null ? `welded ${selectedVertices(s).length} vertices into one` : `welded vertices within ${tol} mm`; break;
      }
      case 'subd_crease': { const on = args.on !== false; next = op(s, on ? 'crease' : 'uncrease'); did = `${on ? 'creased' : 'smoothed'} ${sel.edges.length || `the sides of ${sel.faces.length} faces'`} edges`; break; }
      case 'subd_delete': { next = op(s, 'delete'); did = `deleted ${sel.faces.length} faces`; break; }
      default: return { error: `Unknown tool "${name}".` };
    }
    if (next === s) return { error: 'That changes nothing.' };
    // (Refused, not written, when it leaves the cage not a manifold: as the editor's Done.)
    const v = validationOf(next);
    if (!v.valid) return { error: `That would leave the cage not a manifold (${v.nonManifoldEdges.length} edges and ${v.nonManifoldVertices.length} vertices).` };
    const out = next.cage, made = { vertices: out.positions.length / 3, faces: out.faces.length };
    return { doc: withCage(doc, next), did: `${did} (feature ${index})`, extra: { cage: { before: { vertices: nv, faces: c.faces.length }, after: made, ...(next.sel.faces.length || next.sel.edges.length ? { new: { faces: next.sel.faces, edges: next.sel.edges } } : {}) }, validation: validationSummary(v) } };
  } catch (e) {
    if (e instanceof SubdError) return { error: e.message.replace(/^SubD: /, '') };
    throw e;
  }
}
function op(s: CageSession, o: CageOp): CageSession { return runOp(s, o); }
/** The selection the arguments name, checked against the cage. */
function selectionOf(c: StudioCage, args: Args): CageSelection | string {
  const nv = c.positions.length / 3;
  const v = indices(args.vertices, 'vertices', nv); if (typeof v === 'string') return v;
  const f = indices(args.faces, 'faces', c.faces.length); if (typeof f === 'string') return f;
  const e = edgeList(args.edges, c); if (typeof e === 'string') return e;
  const edge = args.edge === undefined ? [] : edgeList([args.edge], c); if (typeof edge === 'string') return edge;
  return { ...emptyCageSel, vertices: v, faces: f, edges: [...edge, ...e] };
}
/** The query: faces by direction and place, vertices by place, edges as a loop or ring through one edge. */
function select(c: StudioCage, args: Args): Record<string, unknown> {
  const what = args.what, limit = Math.max(1, Math.min(500, Number(args.limit) || 200));
  if (what === 'faces') {
    const dir = vec(args.normal), within = Math.cos((Number(args.within_deg ?? 30)) * Math.PI / 180), out: Record<string, unknown>[] = [];
    let all = 0;
    for (let f = 0; f < c.faces.length; f++) {
      const fr = faceFrame(c, f); if (!inBox(fr.centre, args.box)) continue;
      if (dir) { const l = Math.hypot(...dir) || 1; if ((fr.normal[0] * dir[0] + fr.normal[1] * dir[1] + fr.normal[2] * dir[2]) / l < within) continue; }
      all++; if (out.length < limit) out.push({ face: f, centre: fr.centre.map(r6), normal: fr.normal.map(r6), sides: c.faces[f].length });
    }
    return { faces: out, count: all, ...(all > out.length ? { note: `${all - out.length} more: narrow by "box" or "normal", or raise "limit"` } : {}) };
  }
  if (what === 'vertices') {
    const out: Record<string, unknown>[] = []; let all = 0;
    for (let i = 0; i < c.positions.length / 3; i++) { const p = [c.positions[3 * i], c.positions[3 * i + 1], c.positions[3 * i + 2]]; if (!inBox(p, args.box)) continue; all++; if (out.length < limit) out.push({ vertex: i, at: p.map(r6) }); }
    return { vertices: out, count: all, ...(all > out.length ? { note: `${all - out.length} more: narrow by "box", or raise "limit"` } : {}) };
  }
  if (what === 'loop' || what === 'ring') {
    const e = edgeList(args.edge === undefined ? undefined : [args.edge], c);
    if (typeof e === 'string' || !e.length) return { error: typeof e === 'string' ? e : 'Pass "edge": [a, b], an edge of the cage.' };
    const s = runOp({ ...startSession(0, c), sel: { ...emptyCageSel, edges: e } }, what === 'loop' ? 'select-loop' : 'select-ring');
    return { [what]: s.sel.edges, count: s.sel.edges.length };
  }
  if (what === 'boundary') {
    // (In a "box", both ends in it: one hole's edges among several.)
    const P = c.positions, at = (v: number) => [P[3 * v], P[3 * v + 1], P[3 * v + 2]];
    const open = validationOf(startSession(0, c)).boundaryEdges.filter(([a, b]) => inBox(at(a), args.box) && inBox(at(b), args.box));
    return { open_edges: open.slice(0, limit), count: open.length };
  }
  return { error: 'Pass "what": faces (by "normal", "within_deg", "box"), vertices (by "box"), loop or ring (through "edge"), or boundary (the open edges).' };
}

const idx = { type: 'integer', description: 'The SubD feature\'s index (get_part_summary lists them; run_command subd-box, subd-torus or subd-tube makes one).' };
const ints = (what: string) => ({ type: 'array', items: { type: 'integer' }, description: what });
const pairs = (what: string) => ({ type: 'array', items: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 }, description: what });
const v3 = (what: string) => ({ type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3, description: what });
export const CAGE_TOOLS: ToolDefinition[] = [
  { name: 'subd_cage', description: 'A SubD feature\'s cage: vertex and face counts, creases, mirror plane, bounds and its validation (poles, n-gons, open edges, non-manifold). Read only.', input_schema: { type: 'object', properties: { index: idx }, required: ['index'], additionalProperties: false } },
  { name: 'subd_select', description: 'Finds cage indices to pass to the other subd_ tools (changes nothing): faces by outward "normal" (within "within_deg", default 30) and/or a "box" {min, max} on their centres; vertices in a "box"; the edge "loop" or "ring" through an "edge" [a, b]; or the "boundary" (open edges; with "box", those with both ends in it). Indices are of the cage as the node keeps it (the half when mirrored).', input_schema: { type: 'object', properties: { index: idx, what: { type: 'string', enum: ['faces', 'vertices', 'loop', 'ring', 'boundary'] }, normal: v3('faces: the direction they face'), within_deg: { type: 'number' }, box: { type: 'object', description: '{min: [x, y, z], max: [x, y, z]} (either may be left out)' }, edge: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 }, limit: { type: 'integer' } }, required: ['index', 'what'], additionalProperties: false } },
  { name: 'subd_move', description: 'Moves cage vertices (or those of the given edges or faces) by "delta" mm. Faces and creases stay: a value edit of the feature (applies directly at autonomy L2). On a mirrored cage the plane\'s vertices stay on the plane.', input_schema: { type: 'object', properties: { index: idx, vertices: ints('vertex indices'), edges: pairs('edges [a, b]'), faces: ints('face indices'), delta: v3('[dx, dy, dz] mm') }, required: ['index', 'delta'], additionalProperties: false } },
  { name: 'subd_extrude', description: 'Extrudes cage "faces" as one region (side quads round it) by "offset" [dx, dy, dz] or "distance" along their mean normal; or pulls open boundary "edges" out by "offset". Changes topology (a proposal at L2). The result names the new faces or edges.', input_schema: { type: 'object', properties: { index: idx, faces: ints('face indices'), edges: pairs('open edges [a, b]'), offset: v3('[dx, dy, dz] mm'), distance: { type: 'number', description: 'mm along the faces\' mean normal' } }, required: ['index'], additionalProperties: false } },
  { name: 'subd_insert_loop', description: 'Inserts an edge loop across the ring of faces through "edge" [a, b], at "t" along each ring edge from the side of a (default 0.5, the middle; near 0 or 1 a holding loop that tightens the rounding there). Changes topology.', input_schema: { type: 'object', properties: { index: idx, edge: { type: 'array', items: { type: 'integer' }, minItems: 2, maxItems: 2 }, t: { type: 'number', description: 'fraction along the edge from a, between 0 and 1' } }, required: ['index', 'edge'], additionalProperties: false } },
  { name: 'subd_bridge', description: 'Bridges two open loops of equal length with a band of quads: "edges" holds both loops\' edges. Changes topology.', input_schema: { type: 'object', properties: { index: idx, edges: pairs('the open edges of both loops') }, required: ['index', 'edges'], additionalProperties: false } },
  { name: 'subd_fill', description: 'Fills the hole round open "edges" (one face; subd_select what "boundary" lists them). Changes topology.', input_schema: { type: 'object', properties: { index: idx, edges: pairs('the open edges round the hole') }, required: ['index', 'edges'], additionalProperties: false } },
  { name: 'subd_weld', description: 'Welds "vertices" into one, or (with "tolerance" mm) those within it of each other. Changes topology.', input_schema: { type: 'object', properties: { index: idx, vertices: ints('vertex indices'), tolerance: { type: 'number' } }, required: ['index', 'vertices'], additionalProperties: false } },
  { name: 'subd_crease', description: 'Makes cage "edges" (or the sides of "faces") sharp creases, or smooth again with "on": false. Changes the feature beyond its values (a proposal at L2).', input_schema: { type: 'object', properties: { index: idx, edges: pairs('edges [a, b]'), faces: ints('face indices'), on: { type: 'boolean' } }, required: ['index'], additionalProperties: false } },
  { name: 'subd_delete', description: 'Deletes cage "faces" (an open surface or a hole to fill or bridge). Changes topology; a cage left not a manifold is refused.', input_schema: { type: 'object', properties: { index: idx, faces: ints('face indices') }, required: ['index', 'faces'], additionalProperties: false } },
];
