// STL and OBJ files as a mesh feature: the triangles read, scaled from the file's unit to millimetres
// (the files say none: the user picks it), welded and rounded so the document stays small.
import { readObj, readStl } from '@barocss/cad';
/** Imported meshes go through Booleans up to this many triangles in F0, previewed up to the second (the kernel's limits, said in the studio). */
export { FACET_EXPLODE_TRIANGLES, FACET_PREVIEW_TRIANGLES } from '@barocss/cad';

export const MESH_UNITS = [{ value: 'mm', label: 'Millimetres', toMM: 1 }, { value: 'cm', label: 'Centimetres', toMM: 10 }, { value: 'm', label: 'Metres', toMM: 1000 }, { value: 'in', label: 'Inches', toMM: 25.4 }] as const;
export type MeshUnit = typeof MESH_UNITS[number]['value'];

/** A mesh file's triangles (positions three a vertex, indices three a triangle) in its own units. */
export function readMeshFile(name: string, bytes: Uint8Array): { positions: ArrayLike<number>; indices: number[] | null } {
  if (/\.obj$/i.test(name)) return readObj(new TextDecoder().decode(bytes));
  return { positions: readStl(bytes), indices: null };
}

/** Scaled to mm and welded (corners equal to 1e-6 mm are one vertex): what the mesh feature keeps. */
export function meshInMM(mesh: { positions: ArrayLike<number>; indices: number[] | null }, unit: MeshUnit): { positions: number[]; indices: number[]; size: [number, number, number] } {
  const k = MESH_UNITS.find(u => u.value === unit)!.toMM, P = mesh.positions, n = P.length / 3;
  const positions: number[] = [], seen = new Map<string, number>(), remap: number[] = [];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n; v++) {
    const p = [0, 1, 2].map(a => Math.round(P[3 * v + a] * k * 1e6) / 1e6), key = p.join(',');
    let i = seen.get(key); if (i === undefined) { i = positions.length / 3; positions.push(...p); seen.set(key, i); p.forEach((x, a) => { lo[a] = Math.min(lo[a], x); hi[a] = Math.max(hi[a], x); }); }
    remap.push(i);
  }
  const indices = mesh.indices ? mesh.indices.map(i => remap[i]) : remap;
  return { positions, indices, size: [0, 1, 2].map(a => Math.round((hi[a] - lo[a]) * 1000) / 1000) as [number, number, number] };
}
