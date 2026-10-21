// FRf (O121): shared skeletons — a skeleton node several frames follow, or a sketch whose straight edges a frame
// follows (engine/doc.ts `frameGeometry`, read at every evaluation). Editing the skeleton moves every frame on it; what
// would break them is refused, typed, naming the frames: deleting a skeleton or sketch a frame follows (chat/features.ts
// deleteFeature), and an edit taking away a segment of a followed skeleton or a point its segments used.
import { featureLabel, followsIndex, frameGeometry, type ModelNode, type StudioDoc } from '../engine/doc';
import { solveSketch3D, type Solve3D, type V3 } from './sketch3d';
import { revisionOf } from '../team/revision';

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

/**
 * FRg (O122): a skeleton with constraints solved from its points as given — stored solved — with its diagnosis; a
 * conflict refused, typed, naming the constraints left unmet. Any other node as it is.
 */
export function solvedSkeleton(node: ModelNode): { node: ModelNode; solve?: Omit<Solve3D, 'points'> } | { error: string } {
  if (node.kind !== 'skeleton' || !node.constraints?.length) return { node };
  const r = solveSketch3D(node.points as V3[], node.segments, node.constraints);
  if (r.status === 'conflict') return { error: `[SKETCH3D_CONFLICT] the skeleton's constraints cannot all hold: ${r.unmet.map(u => `constraint ${u.constraint} (${node.constraints![u.constraint].kind}) off by ${+u.residual.toPrecision(3)}`).join(', ')}. Change or remove one of them.` };
  const { points, ...solve } = r;
  return { node: { ...node, points: points.map(p => [p[0], p[1], p[2]] as [number, number, number]) }, solve };
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
