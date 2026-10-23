// O8 (the kernel's D204, D205): a body's lumps — the solids of one result, numbered as the kernel numbers them — and the
// ones touching only along a line or at a point. Such lumps are one body to the model (the union the person asked for),
// but a mesh welded by position reads their touch as non-manifold: the exports and the print checks take them a lump at
// a time, and the result says they only touch (the kernel's old refusal, in its words, as a warning).
// The touch is found on the B-rep's own tessellation (the display mesh is it, face by face): a vertex of one lump within
// the kernel's tolerance of a triangle of another. The kernel imprints the touch (an edge, a split face) on both, so the
// test holds for an edge, a point, a corner on an edge, and a cylinder tangent to a face.
import type { DisplayMesh } from './mesh';

/** A lump's name: its body's, then the lump's number from 1 — the 3MF objects', the STL files' and the warning's. */
export const lumpName = (body: string, lump: number) => `${body} / lump ${lump + 1}`;

/** The lumps of a body's display mesh: each one's triangles (indices into the mesh's triangles), lump 0 first; null for one lump. */
export function lumpTriangles(mesh: DisplayMesh): number[][] | null {
  if (!mesh.faces.some(f => f.lump !== undefined && f.lump > 0)) return null;
  const out: number[][] = [], T = mesh.indices.length / 3;
  for (let t = 0; t < T; t++) {
    const k = mesh.faces[mesh.faceOfVertex[mesh.indices[3 * t]]]?.lump ?? 0;
    while (out.length <= k) out.push([]);
    out[k].push(t);
  }
  return out;
}

/** One lump's triangles as a mesh of its own: its vertices only, renumbered (for the exports). */
export function compactLump(mesh: DisplayMesh, triangles: readonly number[]): { positions: Float32Array; indices: Uint32Array; triangleFaces: Int32Array } {
  const map = new Int32Array(mesh.positions.length / 3).fill(-1), indices = new Uint32Array(triangles.length * 3), triangleFaces = new Int32Array(triangles.length);
  let n = 0;
  for (let k = 0; k < triangles.length; k++) {
    const t = triangles[k];
    for (let c = 0; c < 3; c++) {
      const v = mesh.indices[3 * t + c];
      if (map[v] < 0) map[v] = n++;
      indices[3 * k + c] = map[v];
    }
    triangleFaces[k] = mesh.faceOfVertex[mesh.indices[3 * t]];
  }
  const positions = new Float32Array(n * 3);
  for (let v = 0; v < map.length; v++) if (map[v] >= 0) { positions[3 * map[v]] = mesh.positions[3 * v]; positions[3 * map[v] + 1] = mesh.positions[3 * v + 1]; positions[3 * map[v] + 2] = mesh.positions[3 * v + 2]; }
  return { positions, indices, triangleFaces };
}

/** The mesh with only one lump's triangles (the same vertices and faces): what a per-lump check measures. */
export function lumpMesh(mesh: DisplayMesh, triangles: readonly number[]): DisplayMesh {
  const indices = new Uint32Array(triangles.length * 3), min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < triangles.length; k++) for (let c = 0; c < 3; c++) {
    const v = mesh.indices[3 * triangles[k] + c]; indices[3 * k + c] = v;
    for (let a = 0; a < 3; a++) { const x = mesh.positions[3 * v + a]; if (x < min[a]) min[a] = x; if (x > max[a]) max[a] = x; }
  }
  return { ...mesh, indices, bounds: { min, max } };
}

// ——— the touch (module level: the loops run per vertex and per triangle)
const tri = new Float64Array(9);
function loadTriangle(P: ArrayLike<number>, I: ArrayLike<number>, t: number): void {
  for (let c = 0; c < 3; c++) { const v = I[3 * t + c]; tri[3 * c] = P[3 * v]; tri[3 * c + 1] = P[3 * v + 1]; tri[3 * c + 2] = P[3 * v + 2]; }
}
/** The squared distance from p to the loaded triangle (Ericson's closest point, region by region). */
function pointTriangle2(px: number, py: number, pz: number): number {
  const ax = tri[0], ay = tri[1], az = tri[2], abx = tri[3] - ax, aby = tri[4] - ay, abz = tri[5] - az, acx = tri[6] - ax, acy = tri[7] - ay, acz = tri[8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az, d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx: number, qy: number, qz: number;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
  else {
    const bpx = px - tri[3], bpy = py - tri[4], bpz = pz - tri[5], d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    const cpx = px - tri[6], cpy = py - tri[7], cpz = pz - tri[8], d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    const vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
    if (d3 >= 0 && d4 <= d3) { qx = tri[3]; qy = tri[4]; qz = tri[5]; }
    else if (d6 >= 0 && d5 <= d6) { qx = tri[6]; qy = tri[7]; qz = tri[8]; }
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz; }
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz; }
    else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); qx = tri[3] + w * (tri[6] - tri[3]); qy = tri[4] + w * (tri[7] - tri[4]); qz = tri[5] + w * (tri[8] - tri[5]); }
    else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
  }
  const dx = px - qx, dy = py - qy, dz = pz - qz;
  return dx * dx + dy * dy + dz * dz;
}
/** The box of a lump's vertices: [minX, minY, minZ, maxX, maxY, maxZ]. */
function boxOf(P: ArrayLike<number>, I: ArrayLike<number>, triangles: readonly number[]): Float64Array {
  const b = new Float64Array([Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]);
  for (const t of triangles) for (let c = 0; c < 3; c++) { const v = I[3 * t + c]; for (let a = 0; a < 3; a++) { const x = P[3 * v + a]; if (x < b[a]) b[a] = x; if (x > b[3 + a]) b[3 + a] = x; } }
  return b;
}
/** Whether a vertex of lump `a` lies within `tol` of a triangle of lump `b` (each box widened by `tol` first). */
function touchesFrom(P: ArrayLike<number>, I: ArrayLike<number>, a: readonly number[], b: readonly number[], boxB: Float64Array, tol: number): boolean {
  const tol2 = tol * tol;
  for (const ta of a) for (let c = 0; c < 3; c++) {
    const v = I[3 * ta + c], px = P[3 * v], py = P[3 * v + 1], pz = P[3 * v + 2];
    if (px < boxB[0] - tol || py < boxB[1] - tol || pz < boxB[2] - tol || px > boxB[3] + tol || py > boxB[4] + tol || pz > boxB[5] + tol) continue;
    for (const tb of b) { loadTriangle(P, I, tb); if (pointTriangle2(px, py, pz) <= tol2) return true; }
  }
  return false;
}
/**
 * The pairs of lumps [i, j] (i < j) that touch: within the kernel's tolerance (1e-6 of the body's size, as the mesh's
 * own `near`), a vertex of one on a triangle of the other. Lumps apart give none; one lump, none.
 */
export function lumpTouches(mesh: DisplayMesh): [number, number][] {
  const lumps = lumpTriangles(mesh); if (!lumps) return [];
  const P = mesh.positions, I = mesh.indices, boxes = lumps.map(l => boxOf(P, I, l)), out: [number, number][] = [];
  const size = Math.hypot(mesh.bounds.max[0] - mesh.bounds.min[0], mesh.bounds.max[1] - mesh.bounds.min[1], mesh.bounds.max[2] - mesh.bounds.min[2]), tol = 1e-6 * Math.max(1, size);
  for (let i = 0; i < lumps.length; i++) for (let j = i + 1; j < lumps.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (A[0] > B[3] + tol || B[0] > A[3] + tol || A[1] > B[4] + tol || B[1] > A[4] + tol || A[2] > B[5] + tol || B[2] > A[5] + tol) continue;
    if (touchesFrom(P, I, lumps[i], lumps[j], B, tol) || touchesFrom(P, I, lumps[j], lumps[i], A, tol)) out.push([i, j]);
  }
  return out;
}
