// Posed and exploded instances by transform (G1): the joint sliders' pose and the explode factor as one matrix per
// instance, which the viewer puts on that instance's meshes. Nothing is copied or uploaded while a joint plays or the
// explode changes; the meshes stay as placed and are made once per geometry change.
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { explodeOffsets } from '@barocss/cad-model/assembly/explode';
import type { FkResult, Motion } from '@barocss/cad-model/robot/fk';
import { instanceMotions } from '@barocss/cad-model/robot/preview';

type Placed = { id: string; bodies: readonly BodyResult[] };

/** A motion (R row-major, then t) followed by a move by `d`, as a column-major 4 × 4. */
export function poseMatrix(m: Motion | undefined, d: readonly number[] | undefined): Float64Array {
  const M = new Float64Array(16);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) M[j * 4 + i] = m ? m.R[i * 3 + j] : i === j ? 1 : 0;
    M[12 + i] = (m ? m.t[i] : 0) + (d ? d[i] : 0);
  }
  M[15] = 1;
  return M;
}

/** The motion of a column-major 4 × 4 (its rotation part row-major, and its move): to move a mesh's copy by it. */
export function motionOf(M: ArrayLike<number>): Motion {
  const R = new Float64Array(9), t = new Float64Array(3);
  for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) R[i * 3 + j] = M[j * 4 + i]; t[i] = M[12 + i]; }
  return { R, t };
}

/** The box of a mesh's positions through a column-major 4 × 4 (exact: every vertex, nothing allocated but the box). */
export function boundsUnder(P: ArrayLike<number>, M: ArrayLike<number>): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < P.length; v += 3) {
    const x = P[v], y = P[v + 1], z = P[v + 2];
    const a = M[0] * x + M[4] * y + M[8] * z + M[12], b = M[1] * x + M[5] * y + M[9] * z + M[13], c = M[2] * x + M[6] * y + M[10] * z + M[14];
    if (a < min[0]) min[0] = a; if (a > max[0]) max[0] = a;
    if (b < min[1]) min[1] = b; if (b > max[1]) max[1] = b;
    if (c < min[2]) min[2] = c; if (c > max[2]) max[2] = c;
  }
  return { min, max };
}

/** An instance's bodies with their boxes as posed (shallow copies: the meshes' arrays are shared), for the explode's middles. */
const posedBoxes = (i: Placed, m: Motion): Placed => {
  const M = poseMatrix(m, undefined);
  return { id: i.id, bodies: i.bodies.map(b => ({ ...b, mesh: { ...b.mesh, bounds: boundsUnder(b.mesh.positions, M) } })) };
};

/**
 * Each moved instance's matrix: its link's motion from the joint values (relative to the base part's), then its explode
 * offset, worked out from the boxes as posed (as the meshes moved by posedInstances and movedBody gave). Instances that
 * neither move nor spread are left out.
 */
export function instancePoses(part: readonly BodyResult[], instances: readonly Placed[], fk: FkResult | null, explode: number): Map<string, Float64Array> {
  const motions = fk ? instanceMotions(instances.map(i => i.id), fk) : new Map<string, Motion>(), out = new Map<string, Float64Array>();
  const offsets = explode ? explodeOffsets(part, motions.size ? instances.map(i => { const m = motions.get(i.id); return m ? posedBoxes(i, m) : i; }) : instances, explode) : null;
  for (const i of instances) {
    const m = motions.get(i.id), d = offsets?.get(i.id);
    if (m || d) out.set(i.id, poseMatrix(m, d));
  }
  return out;
}
