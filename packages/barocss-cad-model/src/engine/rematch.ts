// Re-matching stored face and edge names after an edit (A1.3). A fillet's edges, a chamfer's, a shell's open
// faces and a draft's faces are stored by persistent name; an edit upstream (a sketch given another corner) can
// renumber the faces those names come from, so a name goes missing or, worse, names another face.
//
// When the edit leaves the parent body's names as they were (each name there, of the same kind and facing the
// same way — a dimension changed), every name is trusted. Otherwise each stored name is matched again by its
// geometry before the edit (its signature): among the new faces (edges) of the same kind facing the same way
// (within 1°), the nearest (centroid, midpoint), when it is clearly the nearest (the next is at least twice as
// far, measured against the body's size). A substitution is kept on the node (`rematched`, new name → old) until
// confirmed; none, or several as near, refuses the edit with the candidates.
import { bodyKeyFor, nodeIndexOf } from './ids';
import { prefixDoc, type ModelNode, type StudioDoc } from './doc';
import type { BodyResult, EvalResult } from './evaluate';
import type { Vec3 } from './mesh';

/** What a stored name looked like: a face's kind, normal and centroid, or an edge's straightness, direction and midpoint. */
/**
 * What a stored name looked like: a face's kind, normal and centroid, or an edge's straightness, direction and midpoint.
 * `shared`: how many of the kernel's names one display face or edge carried (a closed rim made of several edges, faces
 * merged as one), when more than one — the signature describes them together, not that name alone (O19).
 */
export interface Signature { kind: string; at: Vec3; dir: Vec3 | null; size: number; radius?: number; shared?: number }
export interface Rematch { node: number; from: string; to: string }

/** Cosine of the largest angle between directions taken as the same (1°). */
export const SAME_DIRECTION = Math.cos(Math.PI / 180);
/** How much nearer the chosen match must be than the next (as near as half the next, or nearer). */
export const CLEARLY_NEARER = 2;

const named = (n: ModelNode): { key: 'edges' | 'open' | 'faces'; edge: boolean } | null =>
  n.kind === 'fillet' || n.kind === 'chamfer' || n.kind === 'sheet-flange' || n.kind === 'sheet-corner-relief' ? { key: 'edges', edge: true } : n.kind === 'shell' ? { key: 'open', edge: false } : n.kind === 'draft' || n.kind === 'full-round' || n.kind === 'face-fillet' || n.kind === 'text-relief' ? { key: 'faces', edge: false } : null;

/** Every face's and edge's signature on a body, by name (a merged face under each of its names). */
export function signaturesOf(body: BodyResult): { faces: Map<string, Signature>; edges: Map<string, Signature> } {
  const faces = new Map<string, Signature>(), edges = new Map<string, Signature>();
  for (const f of body.mesh.faces) {
    const names = f.name.split('+'), sig: Signature = { kind: f.kind, at: f.centroid, dir: f.kind === 'plane' ? f.normal : null, size: f.area, ...(f.radius ? { radius: f.radius } : {}), ...(names.length > 1 ? { shared: names.length } : {}) };
    for (const name of names) faces.set(name, sig);
  }
  for (const e of body.mesh.edges) {
    const d: Vec3 = [e.b[0] - e.a[0], e.b[1] - e.a[1], e.b[2] - e.a[2]], l = Math.hypot(...d);
    const sig: Signature = { kind: e.straight ? 'line' : 'curve', at: [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2, (e.a[2] + e.b[2]) / 2], dir: e.straight && l > 0 ? [d[0] / l, d[1] / l, d[2] / l] : null, size: l, ...(e.names.length > 1 ? { shared: e.names.length } : {}) };
    for (const name of e.names) edges.set(name, sig);
  }
  return { faces, edges };
}

/** Radii taken as the same (relative). */
export const SAME_RADIUS = 1e-6;
/** Same kind, the same radius where there is one, and the same direction where there is one (an edge's either way). */
function alike(a: Signature, b: Signature, edge: boolean): boolean {
  if (a.kind !== b.kind) return false;
  if ((a.radius === undefined) !== (b.radius === undefined) || (a.radius !== undefined && Math.abs(a.radius - b.radius!) > SAME_RADIUS * Math.max(1, a.radius))) return false;
  if (!a.dir || !b.dir) return !a.dir && !b.dir;
  const c = a.dir[0] * b.dir[0] + a.dir[1] * b.dir[1] + a.dir[2] * b.dir[2];
  return (edge ? Math.abs(c) : c) >= SAME_DIRECTION;
}

/** The names among `candidates` alike `old`, nearest first. */
export function rankAlike(old: Signature, candidates: ReadonlyMap<string, Signature>, edge: boolean): string[] {
  return [...candidates].filter(([, s]) => alike(old, s, edge)).map(([name, s]) => ({ name, d: Math.hypot(s.at[0] - old.at[0], s.at[1] - old.at[1], s.at[2] - old.at[2]) })).sort((x, y) => x.d - y.d).map(x => x.name);
}

/**
 * The name among `candidates` that `old` became: the nearest alike one, when clearly the nearest; or the
 * candidates when that cannot be told (none alike: an empty list).
 */
export function matchSignature(old: Signature, candidates: ReadonlyMap<string, Signature>, edge: boolean): string | string[] {
  // (Names sharing one signature are one face or edge — the pieces of a display edge, a general fillet's patches,
  // D90: the first of them by name stands for it.)
  const seen = new Set<string>(), key = (s: Signature) => JSON.stringify([s.kind, s.at, s.dir, s.size, s.radius]);
  const near = [...candidates].filter(([, s]) => alike(old, s, edge)).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .filter(([, s]) => { const k = key(s); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(([name, s]) => ({ name, d: Math.hypot(s.at[0] - old.at[0], s.at[1] - old.at[1], s.at[2] - old.at[2]) })).sort((x, y) => x.d - y.d);
  if (!near.length) return [];
  if (near.length === 1 || near[1].d >= CLEARLY_NEARER * near[0].d && near[1].d > 0) return near[0].name;
  return near.filter(x => x.d <= CLEARLY_NEARER * near[0].d).map(x => x.name);
}

/** Whether two bodies' names are the same, each of the same kind and facing the same way. */
function sameNames(a: Map<string, Signature>, b: Map<string, Signature>, edge: boolean): boolean {
  if (a.size !== b.size) return false;
  for (const [name, s] of a) { const t = b.get(name); if (!t || !alike(s, t, edge)) return false; }
  return true;
}

/**
 * `next` (an edit of `prev`) with its stored names re-matched where the edit renumbered their faces, the
 * substitutions made, or why it cannot be told. `evaluate` evaluates a document (a prefix: the named feature's
 * parent body as it stands, before and after the edit).
 */
export async function rematchNames(prev: StudioDoc, next: StudioDoc, evaluate: (doc: StudioDoc) => Promise<EvalResult | null>): Promise<{ doc: StudioDoc; changes: Rematch[] } | { error: string }> {
  // From the first node the edit changed on: names before it cannot have moved.
  let first = 0;
  while (first < next.nodes.length && first < prev.nodes.length && JSON.stringify(next.nodes[first]) === JSON.stringify(prev.nodes[first])) first++;
  const changes: Rematch[] = [], nodes = [...next.nodes];
  for (let k = first; k < nodes.length; k++) {
    const node = nodes[k], what = named(node), was = node.id ? nodeIndexOf(prev.nodes, node.id) : -1;
    if (!what || was < 0 || was < first || !('parent' in node)) continue;
    const parentBefore = (prev.nodes[was] as { parent: { node: number; side: string } }).parent;
    const [a, b] = await Promise.all([evaluate(prefixDoc(prev, was)), evaluate(prefixDoc({ ...next, nodes }, k))]);
    if (!a?.ok || !b?.ok) continue;
    const before = a.bodies.find(x => x.key === bodyKeyFor(prev.nodes, parentBefore.node, parentBefore.side)), after = b.bodies.find(x => x.key === bodyKeyFor(nodes, node.parent.node, node.parent.side));
    if (!before || !after) continue;
    const sa = signaturesOf(before), sb = signaturesOf(after), old = what.edge ? sa.edges : sa.faces, now = what.edge ? sb.edges : sb.faces;
    if (sameNames(old, now, what.edge)) continue;
    const list = (node as Record<string, unknown>)[what.key] as string[], out: string[] = [], rematched: Record<string, string> = { ...(node as { rematched?: Record<string, string> }).rematched };
    for (const name of list) {
      const sig = old.get(name);
      if (!sig) { out.push(name); continue; }
      const m = matchSignature(sig, now, what.edge);
      if (typeof m !== 'string') return { error: m.length ? `Feature ${k}: the ${what.edge ? 'edge' : 'face'} "${name}" is now one of ${m.join(', ')}; name the one you mean.` : `Feature ${k}: the ${what.edge ? 'edge' : 'face'} "${name}" is gone after this edit (nothing like it is left on its body).` };
      out.push(m);
      if (m !== name) { changes.push({ node: k, from: name, to: m }); rematched[m] = rematched[name] ?? name; delete rematched[name]; }
    }
    if (changes.some(c => c.node === k)) nodes[k] = { ...node, [what.key]: out, rematched } as ModelNode;
  }
  return { doc: changes.length ? prefixDoc({ ...next, nodes }, nodes.length) : next, changes };
}
