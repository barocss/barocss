// The section view while its plane moves (G2): on WebGPU the bodies and instances are shown whole and the viewer's clip
// plane cuts and caps them on the GPU; on WebGL2 (no clip plane there) each mesh is clipped and capped on the CPU
// (clipMesh), as before. The kernel's exact section replaces the bodies when it arrives, either way.
import { clipMesh } from '@barocss/cad-model/engine/clip';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import { posedBody } from '@barocss/cad-model/robot/preview';
import { motionOf } from './instancePose';

export interface Section { axis: 'x' | 'y' | 'z'; at: number; keep: 'negative' | 'positive' }
type Placed = { id: string; bodies: BodyResult[] };

/** The section's plane as the viewer takes it: what is kept is where dot(normal, p) ≥ offset. */
export function sectionPlane(s: Section): { normal: Vec3; offset: number } {
  const k = 'xyz'.indexOf(s.axis), sg = s.keep === 'negative' ? -1 : 1, normal: Vec3 = [0, 0, 0];
  normal[k] = sg;
  return { normal, offset: sg * s.at };
}

/** Whether a mesh lies wholly on the cut-away side: when clipMesh gives null (by its box, with clipMesh's tolerance). */
export function cutAway(m: Pick<DisplayMesh, 'bounds'>, s: Section): boolean {
  const k = 'xyz'.indexOf(s.axis), b = m.bounds, size = Math.max(1, ...b.max.map(Math.abs), ...b.min.map(Math.abs)), eps = 1e-9 * size;
  return s.keep === 'negative' ? s.at - b.min[k] <= eps : b.max[k] - s.at <= eps;
}

/**
 * The part's bodies shown in the section while it moves: on the GPU the bodies themselves, less those wholly cut away
 * (the plane cuts and caps the rest); on the CPU each clipped and capped, its cap face named `capName`.
 */
export function sectionedBodies(bodies: readonly BodyResult[], s: Section, gpu: boolean, capName: string): BodyResult[] {
  if (gpu) return bodies.filter(b => !cutAway(b.mesh, s));
  const k = 'xyz'.indexOf(s.axis) as 0 | 1 | 2;
  return bodies.flatMap(b => { const mesh = clipMesh(b.mesh, k, s.at, s.keep, capName); return mesh ? [{ ...b, mesh }] : []; });
}

/**
 * The placed instances in the section: on the GPU the list itself, as placed (their pose matrices on their meshes, the
 * plane in world space cutting them where they are shown); on the CPU moved copies, clipped and capped.
 */
export function sectionedInstances<T extends Placed>(instances: T[], poses: ReadonlyMap<string, Float64Array>, s: Section, gpu: boolean): T[] | Placed[] {
  // (The same list: nothing is made again while the plane moves.)
  if (gpu) return instances;
  const k = 'xyz'.indexOf(s.axis) as 0 | 1 | 2;
  return instances.map(i => {
    const M = poses.get(i.id), m = M && motionOf(M);
    return { id: i.id, bodies: i.bodies.flatMap(b => { const mesh = clipMesh(m ? posedBody(b, m).mesh : b.mesh, k, s.at, s.keep, 'section'); return mesh ? [{ ...b, mesh }] : []; }) };
  });
}
