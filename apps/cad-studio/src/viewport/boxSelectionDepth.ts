import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';

/** Reject a whole body behind the perspective eye. Leave mixed-depth bodies to the existing box test. */
export function bodyEntirelyBehindEye(mesh: Pick<DisplayMesh, 'bounds' | 'positions'>, eye: Vec3, forward: Vec3): boolean {
  const { positions, bounds: { min, max } } = mesh;
  if (!positions.length) return false;
  const [fx, fy, fz] = forward;
  const depth = (x: number, y: number, z: number) => (x - eye[0]) * fx + (y - eye[1]) * fy + (z - eye[2]) * fz;
  const supportDepth = (lo: Vec3, hi: Vec3) => depth(fx < 0 ? lo[0] : hi[0], fy < 0 ? lo[1] : hi[1], fz < 0 ? lo[2] : hi[2]);
  if (supportDepth(min, max) < 0) return true;
  if (supportDepth(max, min) >= 0) return false;
  // A box can cross the plane even when the actual body does not. Check every vertex, without the selection stride.
  for (let i = 0; i < positions.length; i += 3)
    if (!(depth(positions[i], positions[i + 1], positions[i + 2]) < 0)) return false;
  return true;
}
