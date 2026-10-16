import type { DisplayMesh } from '../engine/mesh';

export function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Binary STL from the display mesh, used when the kernel's own STL writer refuses a body family. */
export function meshToStl(mesh: DisplayMesh, name: string): Uint8Array {
  const tris = mesh.indices.length / 3; const out = new Uint8Array(84 + tris * 50); const view = new DataView(out.buffer);
  new TextEncoder().encodeInto(`barocss studio mesh ${name}`.slice(0, 79), out);
  view.setUint32(80, tris, true);
  const p = mesh.positions;
  for (let t = 0; t < tris; t++) {
    const ia = mesh.indices[t * 3] * 3, ib = mesh.indices[t * 3 + 1] * 3, ic = mesh.indices[t * 3 + 2] * 3;
    const ux = p[ib] - p[ia], uy = p[ib + 1] - p[ia + 1], uz = p[ib + 2] - p[ia + 2];
    const vx = p[ic] - p[ia], vy = p[ic + 1] - p[ia + 1], vz = p[ic + 2] - p[ia + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const o = 84 + t * 50; const vals = [nx, ny, nz, p[ia], p[ia + 1], p[ia + 2], p[ib], p[ib + 1], p[ib + 2], p[ic], p[ic + 1], p[ic + 2]];
    vals.forEach((v, k) => view.setFloat32(o + k * 4, v, true));
  }
  return out;
}
