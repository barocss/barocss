// FRf (O121): shared skeletons — a skeleton node several frames follow, or a sketch whose straight edges a frame
// follows (engine/doc.ts `frameGeometry`, read at every evaluation). Editing the skeleton moves every frame on it; what
// would break them is refused, typed, naming the frames: deleting a skeleton or sketch a frame follows (chat/features.ts
// deleteFeature), and an edit taking away a segment of a followed skeleton or a point its segments used.
import { featureLabel, followsIndex, frameGeometry, type ModelNode, type StudioDoc } from '../engine/doc';
import { sketch3dRefusal, solveSketch3D, type BoundConstraint3D, type Constraint3D, type Solve3D, type V3 } from './sketch3d';
import { revisionOf } from '../util/revision';

/** The frames following feature `index` (by label). */
export function followersOf(nodes: readonly ModelNode[], index: number): string[] {
  return nodes.flatMap((n, k) => n.kind === 'frame' && n.follows && followsIndex(n.follows) === index ? [`feature ${k} (${featureLabel(n, k, nodes)})`] : []);
}

/** Why an edit of feature `index` to `next` would break the frames following it, or null. */
export function skeletonEditRefusal(nodes: readonly ModelNode[], index: number, next: ModelNode): string | null {
  const was = nodes[index]; if (was?.kind !== 'skeleton') return null;
  const followers = followersOf(nodes, index); if (!followers.length) return null;
  if (next.kind !== 'skeleton') return `[FRAME_SKELETON_IN_USE] skeleton ${index} is followed by ${followers.join(', ')}: it stays a skeleton (give those frames their own points first).`;
  if (next.segments.length < was.segments.length) return `[FRAME_SKELETON_IN_USE] skeleton ${index}'s segments ${was.segments.length} → ${next.segments.length}: ${followers.join(', ')} have a member on each; add or move segments, or give those frames their own points first.`;
  const used = new Set(was.segments.flat()), gone = [...used].filter(p => p >= next.points.length).sort((a, b) => a - b);
  if (gone.length) return `[FRAME_SKELETON_IN_USE] skeleton ${index}'s point${gone.length > 1 ? 's' : ''} ${gone.map(p => p + 1).join(', ')} taken away: ${followers.join(', ')} use ${gone.length > 1 ? 'them' : 'it'}; move points rather than remove them.`;
  return null;
}

/** A frame that follows, with its points and segments set from what it follows (a copy, kept for readers of the node); any other node as it is. */
export function withFollowed(doc: StudioDoc, node: ModelNode): ModelNode {
  if (node.kind !== 'frame' || !node.follows) return node;
  const g = frameGeometry(doc.nodes, node, doc.parameters, doc.instances ?? []);
  if ('code' in g) return node;
  // (FRf2: a placed part's sketch linked now pins that part's revision, unless the person gave one.)
  const f = node.follows, inst = 'part' in f ? doc.instances?.find(i => i.id === f.part) : undefined;
  const follows = 'part' in f && inst && f.revision === undefined ? { ...f, revision: revisionOf(inst.doc) } : f;
  return { ...node, follows, points: g.points, segments: g.segments };
}

/** Each bound value as its parameter's now (O140), and which constraint was bound to which; or a parameter it lacks. */
export function boundConstraints(cs: readonly BoundConstraint3D[], parameters: Readonly<Record<string, number>>): { constraints: Constraint3D[]; bound: Map<number, string> } | { error: string } {
  const bound = new Map<number, string>(), out: Constraint3D[] = [];
  for (const [k, c] of cs.entries()) {
    const key = c.kind === 'angle' ? 'degrees' : c.kind === 'length' || c.kind === 'distance' ? 'value' : null;
    const v = key ? (c as Record<string, unknown>)[key] : undefined;
    if (key && v && typeof v === 'object') {
      const name = (v as { parameter?: unknown }).parameter;
      if (typeof name !== 'string' || !(name in parameters)) return { error: `[SKETCH3D_PARAMETER] constraint ${k} (${c.kind}) is bound to the parameter ${JSON.stringify(name)}, which the document does not have (parameters: ${Object.keys(parameters).join(', ') || 'none'})` };
      bound.set(k, name); out.push({ ...c, [key]: parameters[name] } as Constraint3D);
    } else out.push(c as Constraint3D);
  }
  return { constraints: out, bound };
}
/** A constraint named for a message: its index, kind and, bound, its parameter and that parameter's value now. */
const named = (k: number, cs: readonly Constraint3D[], bound: ReadonlyMap<number, string>) => {
  const c = cs[k], p = bound.get(k);
  return `constraint ${k} (${c.kind}${p ? `, bound to ${p} = ${c.kind === 'angle' ? c.degrees : (c as { value: number }).value}` : ''})`;
};

/** Why the sketch's data is refused (sketch3dRefusal), a bound constraint named with its parameter and value; or null. */
export function boundRefusal(points: readonly V3[], segments: readonly [number, number][], b: { constraints: readonly Constraint3D[]; bound: ReadonlyMap<number, string> }): string | null {
  const why = sketch3dRefusal(points, segments, b.constraints); if (!why) return null;
  const k = Number(/^constraint (\d+)/.exec(why)?.[1]);
  return b.bound.has(k) ? why.replace(/^constraint \d+ \([^)]*\)/, named(k, b.constraints, b.bound)) : why;
}
/**
 * FRg (O122): a skeleton with constraints solved from its points as given — stored solved — with its diagnosis; a
 * conflict refused, typed, naming the constraints left unmet and the parameters they are bound to (O140). A bound
 * value is its parameter's now. Any other node as it is.
 */
export function solvedSkeleton(node: ModelNode, parameters: Readonly<Record<string, number>> = {}): { node: ModelNode; solve?: Omit<Solve3D, 'points'> } | { error: string } {
  if (node.kind !== 'skeleton' || !node.constraints?.length) return { node };
  const b = boundConstraints(node.constraints, parameters); if ('error' in b) return b;
  const why = boundRefusal(node.points as V3[], node.segments, b);
  if (why) return { error: `[SKETCH3D_INPUT] skeleton.${why}` };
  const r = solveSketch3D(node.points as V3[], node.segments, b.constraints);
  if (r.status === 'conflict') {
    // (The parameters the unmet constraints are bound to; none of them bound: every parameter the skeleton binds — one of them moved it there.)
    const unmetBound = [...new Set(r.unmet.flatMap(u => b.bound.has(u.constraint) ? [b.bound.get(u.constraint)!] : []))], params = unmetBound.length ? unmetBound : [...new Set(b.bound.values())];
    return { error: `[SKETCH3D_CONFLICT] the skeleton's constraints cannot all hold: ${r.unmet.map(u => `${named(u.constraint, b.constraints, b.bound)} off by ${+u.residual.toPrecision(3)}`).join(', ')}. ${params.length ? `Change the parameter${params.length > 1 ? 's' : ''} ${params.join(', ')}, or ` : ''}Change or remove one of them.` };
  }
  const { points, ...solve } = r;
  // (Points the solve left where they were stay the very same: a re-solve of an unchanged skeleton changes nothing.)
  const was = node.points as V3[], moved = points.some((p, i) => p.some((v, j) => Math.abs(v - was[i][j]) > 1e-12));
  return { node: moved ? { ...node, points: points.map(p => [p[0], p[1], p[2]] as [number, number, number]) } : node, solve };
}
/** Whether a skeleton has a value bound to a parameter. */
const isBound = (n: ModelNode) => n.kind === 'skeleton' && !!n.constraints?.some(c => (c.kind === 'length' || c.kind === 'distance') && typeof c.value === 'object' || c.kind === 'angle' && typeof c.degrees === 'object');
/**
 * The document with every skeleton bound to a parameter re-solved for the parameters as they are (O140: a parameter
 * changed, its skeletons follow; the frames on them with them); the same document when none moved; or the refusal, the
 * skeleton's feature named.
 */
export function resolveSkeletons(doc: StudioDoc): { doc: StudioDoc } | { error: string } {
  if (!doc.nodes.some(isBound)) return { doc };
  let nodes: ModelNode[] | null = null;
  for (const [k, n] of doc.nodes.entries()) {
    if (!isBound(n)) continue;
    const r = solvedSkeleton(n, doc.parameters);
    if ('error' in r) return { error: r.error.replace(/^\[(\w+)\] /, `[$1] feature ${k} (${featureLabel(n, k, doc.nodes)}): `) };
    if (r.node !== n) (nodes ??= [...doc.nodes])[k] = r.node;
  }
  return { doc: nodes ? { ...doc, nodes } : doc };
}

// ——— FRf2 (O125): base frames following placed parts' sketches.
type PartFollow = { frame: number; label: string; part: string; sketch: string; revision?: string };
/** The base part's frames that follow a placed part's sketch. */
export function partFollowers(doc: StudioDoc, part?: string): PartFollow[] {
  return doc.nodes.flatMap((n, k) => n.kind === 'frame' && n.follows && 'part' in n.follows && (part === undefined || n.follows.part === part)
    ? [{ frame: k, label: `feature ${k} (${featureLabel(n, k, doc.nodes)})`, part: n.follows.part, sketch: n.follows.sketch, ...(n.follows.revision ? { revision: n.follows.revision } : {}) }] : []);
}
/** Each base frame whose followed part changed since it was linked (its revision pinned then, the part's now): to relink. */
export function followedStale(doc: StudioDoc): { frame: number; label: string; part: string; sketch: string; was: string; now: string }[] {
  return partFollowers(doc).flatMap(f => {
    const inst = doc.instances?.find(i => i.id === f.part); if (!inst || !f.revision) return [];
    const now = revisionOf(inst.doc);
    return now === f.revision ? [] : [{ frame: f.frame, label: f.label, part: f.part, sketch: f.sketch, was: f.revision, now }];
  });
}
/** The staleness in words, for a result, a member's notes and the drawing's issues. */
export const staleText = (s: { part: string; sketch: string; was: string; now: string }) => `follows ${s.part}'s sketch ${s.sketch}, which changed since it was linked (revision ${s.was} → ${s.now}): its geometry is the sketch now; relink with features.edit (follows.revision ${s.now})`;

/** Why deleting placed part `part` would break base frames following its sketches, or null. */
export function partDeleteRefusal(doc: StudioDoc, part: string): string | null {
  const f = partFollowers(doc, part);
  return f.length ? `[FRAME_PART_IN_USE] ${part} holds the sketch${new Set(f.map(x => x.sketch)).size > 1 ? 'es' : ''} ${[...new Set(f.map(x => x.sketch))].join(', ')} that ${f.map(x => x.label).join(', ')} follow${f.length > 1 ? '' : 's'}: give those frames their own points, or delete them, first.` : null;
}
/**
 * Why a part-scoped edit leaving placed part `part` as `next` would break base frames following its sketches, or null:
 * a followed sketch gone, no longer straight-edged, or with fewer edges than the frames have members (FRf's rule).
 */
export function partEditRefusal(doc: StudioDoc, part: string, next: StudioDoc): string | null {
  const followers = partFollowers(doc, part); if (!followers.length) return null;
  const parts = (doc.instances ?? []).map(i => i.id === part ? { ...i, doc: next } : i);
  for (const f of followers) {
    const frame = doc.nodes[f.frame] as Extract<ModelNode, { kind: 'frame' }>;
    const before = frameGeometry(doc.nodes, frame, doc.parameters, doc.instances ?? []), after = frameGeometry(doc.nodes, frame, doc.parameters, parts);
    if ('code' in after) return `[FRAME_PART_IN_USE] ${f.label} follows ${part}'s sketch ${f.sketch}: the edit would leave it ${after.code === 'FRAME_PART_FEATURE_GONE' ? 'gone' : 'not a straight-edged sketch'} (${after.error}).`;
    if ('segments' in before && after.segments.length < before.segments.length) return `[FRAME_PART_IN_USE] ${f.label} follows ${part}'s sketch ${f.sketch}: its edges ${before.segments.length} → ${after.segments.length}, and the frame has a member on each; move edges, or give the frame its own points, first.`;
  }
  return null;
}
/** The base frames' copies of what they follow set again from the parts as they are (after a part's edit). */
export function refreshFollowed(doc: StudioDoc): StudioDoc {
  if (!partFollowers(doc).length) return doc;
  return { ...doc, nodes: doc.nodes.map(n => n.kind === 'frame' && n.follows && 'part' in n.follows ? withFollowed(doc, n) : n) };
}
