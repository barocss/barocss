// STL and OBJ files as a mesh feature: the triangles read, scaled from the file's unit to millimetres
// (the files say none: the user picks it), welded and rounded so the document stays small.
import { readObj, readStl } from '@barocss/cad';
import { MM_PER_INCH } from '../util/units';
/** Imported meshes go through Booleans up to this many triangles in F0, previewed up to the second (the kernel's limits, said in the studio). */
export { FACET_EXPLODE_TRIANGLES, FACET_PREVIEW_TRIANGLES } from '@barocss/cad';

export const MESH_UNITS = [{ value: 'mm', label: 'Millimetres', toMM: 1 }, { value: 'cm', label: 'Centimetres', toMM: 10 }, { value: 'm', label: 'Metres', toMM: 1000 }, { value: 'in', label: 'Inches', toMM: MM_PER_INCH }] as const;
export type MeshUnit = typeof MESH_UNITS[number]['value'];

/**
 * A mesh file's triangles (positions three a vertex, indices three a triangle) in its own units; `float32` when the
 * file holds single-precision numbers (STL): its positions are kept at that precision (D45).
 */
export function readMeshFile(name: string, bytes: Uint8Array): { positions: ArrayLike<number>; indices: number[] | null; float32?: boolean } {
  if (/\.obj$/i.test(name)) return readObj(new TextDecoder().decode(bytes));
  return { positions: readStl(bytes), indices: null, float32: true };
}

/**
 * Scaled to mm and welded (corners equal to 1e-6 mm are one vertex): what the mesh feature keeps. A single-precision
 * file's positions stay single precision once scaled (no digits it never had); others as scaled (D45).
 */
export function meshInMM(mesh: { positions: ArrayLike<number>; indices: number[] | null; float32?: boolean }, unit: MeshUnit): { positions: number[]; indices: number[]; size: [number, number, number] } {
  const k = MESH_UNITS.find(u => u.value === unit)!.toMM, P = mesh.positions, n = P.length / 3, f32 = !!mesh.float32;
  // (Corners keyed by their coordinates rounded to 1e-6 mm, the three integers hashed into buckets and compared
  // exactly: the same vertices, in the same order, as keying them by their text — without a string or array a corner.)
  const positions: number[] = [], buckets = new Map<number, number | number[]>(), remap: number[] = new Array(n);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < n; v++) {
    const x = f32 ? Math.fround(P[3 * v] * k) : P[3 * v] * k, y = f32 ? Math.fround(P[3 * v + 1] * k) : P[3 * v + 1] * k, z = f32 ? Math.fround(P[3 * v + 2] * k) : P[3 * v + 2] * k;
    const rx = Math.round(x * 1e6), ry = Math.round(y * 1e6), rz = Math.round(z * 1e6), h = cornerHash(rx, ry, rz), at = buckets.get(h);
    let i = -1;
    if (at !== undefined) {
      if (typeof at === 'number') { if (sameCorner(positions, at, rx, ry, rz)) i = at; }
      else for (const c of at) if (sameCorner(positions, c, rx, ry, rz)) { i = c; break; }
    }
    if (i < 0) {
      i = positions.length / 3; positions.push(x, y, z);
      if (at === undefined) buckets.set(h, i); else if (typeof at === 'number') buckets.set(h, [at, i]); else at.push(i);
      // (Math.min and max, as before: a NaN corner makes the size NaN.)
      lo[0] = Math.min(lo[0], x); hi[0] = Math.max(hi[0], x); lo[1] = Math.min(lo[1], y); hi[1] = Math.max(hi[1], y); lo[2] = Math.min(lo[2], z); hi[2] = Math.max(hi[2], z);
    }
    remap[v] = i;
  }
  const indices = mesh.indices ? mesh.indices.map(i => remap[i]) : remap;
  return { positions, indices, size: [0, 1, 2].map(a => Math.round((hi[a] - lo[a]) * 1000) / 1000) as [number, number, number] };
}
/** A corner's rounded coordinates hashed (collisions only cost a comparison). */
function cornerHash(x: number, y: number, z: number): number { return (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791) ^ Math.imul((x / 4294967296) | 0, 2654435761)) >>> 0; }
/** Whether corner c's coordinates round as (x, y, z) (a NaN as a NaN, as their texts compared). */
function sameCorner(P: number[], c: number, x: number, y: number, z: number): boolean { return same(Math.round(P[3 * c] * 1e6), x) && same(Math.round(P[3 * c + 1] * 1e6), y) && same(Math.round(P[3 * c + 2] * 1e6), z); }
const same = (a: number, b: number) => a === b || (a !== a && b !== b);
