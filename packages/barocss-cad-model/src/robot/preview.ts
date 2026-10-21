// The joint-slider preview (RM2, O15): the instances shown moved by forward kinematics, the base part still (when the
// robot's base link is an instance, every motion is shown relative to the base part's, the same relative motion).
// Bodies are copied before they are moved: the evaluated ones stay as they were.
import { placeBody, type BodyResult } from '../engine/evaluate';
import { BASE } from '../assembly/mates';
import { composeInto, invert, type FkResult, type Motion } from './fk';

/** A body moved by a motion, on its own copy of the mesh arrays. */
export function posedBody(b: BodyResult, m: Motion): BodyResult {
  const mesh = { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() };
  return placeBody({ ...b, mesh }, m.R as unknown as number[], m.t as unknown as number[]);
}
const moved = (m: Motion) => m.t[0] !== 0 || m.t[1] !== 0 || m.t[2] !== 0 || m.R[0] !== 1 || m.R[4] !== 1 || m.R[8] !== 1 || m.R[1] !== 0 || m.R[2] !== 0 || m.R[3] !== 0 || m.R[5] !== 0 || m.R[6] !== 0 || m.R[7] !== 0;

/**
 * Each instance's motion as the joint values put it, relative to the base part's (posedInstances moves the meshes by
 * these; the studio's viewer moves its meshes' transforms by them instead, G1): only the instances that move.
 */
export function instanceMotions(ids: Iterable<string>, fk: FkResult): Map<string, Motion> {
  const base = fk.motions.get(BASE), rel = base && moved(base) ? invert(base) : null, out = new Map<string, Motion>();
  for (const id of ids) {
    const own = fk.motions.get(id);
    if (!own) continue;
    const m = rel ? composeInto({ R: new Float64Array(9), t: new Float64Array(3) }, rel, own) : own;
    if (moved(m)) out.set(id, m);
  }
  return out;
}

/** The placed instances as the joint values put them (an instance its link does not move: as it was). */
export function posedInstances(instances: readonly { id: string; bodies: BodyResult[] }[], fk: FkResult): { id: string; bodies: BodyResult[] }[] {
  const motions = instanceMotions(instances.map(i => i.id), fk);
  return instances.map(i => { const m = motions.get(i.id); return m ? { id: i.id, bodies: i.bodies.map(b => posedBody(b, m)) } : i; });
}
