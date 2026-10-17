import { encodeBinaryStl } from '@barocss/cad';
import type { DisplayMesh } from '../engine/mesh';

export function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Binary STL from the display mesh, used when the kernel's own STL writer refuses a body family. */
export const meshToStl = (mesh: DisplayMesh, name: string): Uint8Array => encodeBinaryStl(mesh.positions, mesh.indices, `barocss studio mesh ${name}`);
