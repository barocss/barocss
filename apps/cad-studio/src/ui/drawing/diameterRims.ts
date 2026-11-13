import type { BrepProjection, ProjectedEdge, ProjectedPiece } from '@barocss/cad';
import { closestDetailRim, edgeAt, inView, roundIn } from '@barocss/cad-model/drawing/dimensions';
import { hostOf } from '@barocss/cad-model/engine/occurrences';
import type { XY } from '@barocss/cad-model/drawing/types';

const coincidence = 1e-7;

export function rimOccurrence(edge: ProjectedEdge): string | undefined {
  const firstFace = edge.name.split('|', 1)[0];
  return firstFace.includes('/') ? hostOf(firstFace) : undefined;
}

export function diameterRims(projection: BrepProjection, at: XY, rimTol: number, centreTol: number, visibleOnly: boolean, assembly: boolean): ProjectedEdge[] {
  const piecesOf = (edge: ProjectedEdge) => edge.pieces.filter(p => !visibleOnly || p.visible);
  const circles = { ...projection, edges: projection.edges.filter(edge => edge.circle && piecesOf(edge).length) };
  const rim = edgeAt(circles, at, rimTol, visibleOnly);
  let centre: ProjectedEdge | null = null, best = centreTol;
  if (!rim) for (const edge of circles.edges) {
    if (!roundIn(circles, edge) || !edge.circle) continue;
    const [x, y] = inView(circles, edge.circle.center);
    const distance = Math.hypot(x - at[0], y - at[1]);
    if (distance < best) { centre = edge; best = distance; }
  }
  const selected = rim ?? centre;
  if (!selected?.circle) return [];
  if (!assembly || !roundIn(circles, selected)) return [selected];

  const [x, y] = inView(circles, selected.circle.center), radius = selected.circle.radius;
  const length = Math.hypot(at[0] - x, at[1] - y);
  const onRim: XY | null = rim && length > coincidence
    ? [x + radius * (at[0] - x) / length, y + radius * (at[1] - y) / length] : null;
  const atPick = (pieces: ProjectedPiece[]) => pieces.filter(({ curve }) => {
    if (!onRim) return true;
    if (curve.kind !== 'arc') return false;
    const point = closestDetailRim([curve], onRim);
    return point && Math.hypot(point[0] - onRim[0], point[1] - onRim[1]) < coincidence;
  });
  const byOccurrence = new Map<string | undefined, { edge: ProjectedEdge; visible: boolean; depth: number }>();
  for (const edge of circles.edges) {
    if (!edge.circle || !roundIn(circles, edge) || Math.abs(edge.circle.radius - radius) > coincidence) continue;
    const [u, v] = inView(circles, edge.circle.center);
    if (Math.hypot(u - x, v - y) > coincidence) continue;
    const pieces = atPick(piecesOf(edge));
    if (!pieces.length && edge !== selected) continue;
    const owner = rimOccurrence(edge), visible = (pieces.length ? pieces : piecesOf(edge)).some(p => p.visible);
    const depth = edge.circle.center.reduce((sum, value, axis) => sum + value * projection.toward[axis], 0);
    const before = byOccurrence.get(owner);
    if (!before || (visible !== before.visible ? visible : depth > before.depth || (depth === before.depth && edge.name < before.edge.name))) {
      byOccurrence.set(owner, { edge, visible, depth });
    }
  }
  return [...byOccurrence.values()].map(({ edge }) => edge);
}
