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
  project: (point: readonly number[]) => readonly number[], printedTop?: number, source?: NativePickSource): VertexPick | null {
  if (body === undefined || filter !== 'all') return null;
  const radius = 7;
  let best: Vec3 | null = null, distance = radius, ambiguous = false;
  let native: { id: string; at: Vec3 } | undefined;
  // A native pick must belong to the edge or face that passed the renderer's visibility test.
  for (const edge of edges) {
    const visible = source && ('edge' in source ? edge.index === source.edge : edge.faces?.includes(source.face));
    for (let k = 0; k < 2; k++) {
      const point = k ? edge.b : edge.a;
      if (printedTop !== undefined && point[2] > printedTop + 1e-7) continue;
      const pixel = project(point), gap = Math.hypot(pixel[0] - x, pixel[1] - y);
      if (gap < radius && visible) {
        const id = edge.nativeVertices?.[k];
        if (!id || (native && native.id !== id)) ambiguous = true;
        else native ??= { id, at: [...point] as Vec3 };
      }
      if (gap < distance) { distance = gap; best = [...point] as Vec3; }
    }
  }
  if (source && native && !ambiguous) {
    const pick = { body, at: native.at };
    nativeOwners.set(pick, { id: native.id, mesh: source.mesh });
    return pick;
  }
  return best ? { body, at: best } : null;
}
