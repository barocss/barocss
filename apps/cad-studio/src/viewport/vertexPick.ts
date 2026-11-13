import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';

type PickFilter = 'all' | 'face' | 'edge' | 'body';
type EdgeEnds = { a: readonly number[]; b: readonly number[]; index?: number; faces?: readonly number[]; nativeVertices?: readonly [string, string] };
type NativePickSource = { mesh: DisplayMesh } & ({ face: number } | { edge: number });
type VertexPick = { body: number; at: Vec3 };

const nativeOwners = new WeakMap<VertexPick, { id: string; mesh: DisplayMesh; doc?: StudioDoc }>();

export function bindNativeVertexPick(pick: VertexPick, doc: StudioDoc): void {
  const owner = nativeOwners.get(pick);
  if (owner) owner.doc = doc;
}

/** Resolve the original ordered endpoints of the current body. View-only or older picks have no authority here. */
export function currentNativeVertexPoints(doc: StudioDoc, bodies: readonly BodyResult[], picks: readonly VertexPick[]): [Vec3, Vec3, Vec3] | null {
  if (picks.length !== 3 || picks.some(pick => pick.body !== picks[0].body)) return null;
  const mesh = bodies[picks[0].body]?.mesh;
  const ids = new Set<string>();
  for (const pick of picks) {
    const owner = nativeOwners.get(pick);
    if (!owner || owner.doc !== doc || owner.mesh !== mesh || ids.has(owner.id)) return null;
    ids.add(owner.id);
  }
  return [picks[0].at, picks[1].at, picks[2].at];
}
/** The actual 7 px corner search used by hover and click. Explicit filters keep their own pick. */
export function pickVertex(filter: PickFilter, body: number | undefined, edges: readonly EdgeEnds[], x: number, y: number,
  project: (point: readonly number[]) => readonly number[], printedTop?: number, source?: NativePickSource, orthographic = false): VertexPick | null {
  if (body === undefined || filter !== 'all') return null;
  const radius = 7;
  let best: Vec3 | null = null, distance = radius, ambiguous = false;
  let native: Map<string, { at: Vec3; pixel: readonly number[] }> | undefined;
  // A native pick must belong to the edge or face that passed the renderer's visibility test.
  for (const edge of edges) {
    const visible = source && ('edge' in source ? edge.index === source.edge : edge.faces?.includes(source.face));
    for (let k = 0; k < 2; k++) {
      const point = k ? edge.b : edge.a;
      if (printedTop !== undefined && point[2] > printedTop + 1e-7) continue;
      const pixel = project(point), gap = Math.hypot(pixel[0] - x, pixel[1] - y);
      if (gap < radius && visible) {
        const id = edge.nativeVertices?.[k];
        if (!id) ambiguous = true;
        else {
          native ??= new Map();
          if (!native.has(id)) native.set(id, { at: [...point] as Vec3, pixel });
        }
      }
      if (gap < distance) { distance = gap; best = [...point] as Vec3; }
    }
  }
  if (source && native?.size && !ambiguous) {
    const entries = [...native];
    const [id, chosen] = native.size > 1 && orthographic
      ? entries.sort(([, a], [, b]) => a.pixel[2] - b.pixel[2])[0] : entries[0];
    // A nearly end-on edge can put its visible and rear endpoints in the same pixel.
    const front = native.size === 1 || orthographic && Number.isFinite(chosen.pixel[2]) && entries.every(([other, { pixel }]) =>
      other === id || pixel[2] > chosen.pixel[2] && Math.hypot(pixel[0] - chosen.pixel[0], pixel[1] - chosen.pixel[1]) <= 0.1);
    if (front) {
      const pick = { body, at: chosen.at };
      nativeOwners.set(pick, { id, mesh: source.mesh });
      return pick;
    }
  }
  return best ? { body, at: best } : null;
}
