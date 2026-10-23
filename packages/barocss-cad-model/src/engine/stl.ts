// Binary STL from the display mesh (PKG-b, B3: the model's, so the CLI need not import ui/): used when the kernel's own
// STL writer refuses a body family.
import { encodeBinaryStl } from '@barocss/cad';
import type { DisplayMesh } from './mesh';
import { compactLump, lumpTriangles } from './lumps';

/** Binary STL from the display mesh, used when the kernel's own STL writer refuses a body family. */
export const meshToStl = (mesh: DisplayMesh, name: string): Uint8Array => encodeBinaryStl(mesh.positions, mesh.indices, `barocss studio mesh ${name}`);
/**
 * O8: a body whose lumps touch only along a line or at a point, one binary STL a lump — STL is triangles alone, so a
 * reader welding by position takes one file of both as non-manifold. The files go as `<name>-lump1.stl`, …; null when
 * the mesh has one lump (the body's one STL, as before).
 */
export function lumpStls(mesh: DisplayMesh, name: string): { lump: number; bytes: Uint8Array }[] | null {
  const lumps = lumpTriangles(mesh); if (!lumps) return null;
  return lumps.map((t, k) => { const m = compactLump(mesh, t); return { lump: k, bytes: encodeBinaryStl(m.positions, m.indices, `barocss studio mesh ${name} lump ${k + 1}`) }; });
}
