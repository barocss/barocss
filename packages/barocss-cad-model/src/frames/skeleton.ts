// FRf (O121): shared skeletons — a skeleton node several frames follow, or a sketch whose straight edges a frame
// follows (engine/doc.ts `frameGeometry`, read at every evaluation). Editing the skeleton moves every frame on it; what
// would break them is refused, typed, naming the frames: deleting a skeleton or sketch a frame follows (chat/features.ts
// deleteFeature), and an edit taking away a segment of a followed skeleton or a point its segments used.
import { featureLabel, frameGeometry, type ModelNode, type StudioDoc } from '../engine/doc';

/** The frames following feature `index` (by label). */
export function followersOf(nodes: readonly ModelNode[], index: number): string[] {
  return nodes.flatMap((n, k) => n.kind === 'frame' && n.follows && ('skeleton' in n.follows ? n.follows.skeleton : n.follows.sketch) === index ? [`feature ${k} (${featureLabel(n, k, nodes)})`] : []);
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
  const g = frameGeometry(doc.nodes, node, doc.parameters);
  return 'code' in g ? node : { ...node, points: g.points, segments: g.segments };
}
