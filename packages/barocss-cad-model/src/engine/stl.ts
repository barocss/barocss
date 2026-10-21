// Binary STL from the display mesh (PKG-b, B3: the model's, so the CLI need not import ui/): used when the kernel's own
// STL writer refuses a body family.
import { encodeBinaryStl } from '@barocss/cad';
import type { DisplayMesh } from './mesh';

/** Binary STL from the display mesh, used when the kernel's own STL writer refuses a body family. */
export const meshToStl = (mesh: DisplayMesh, name: string): Uint8Array => encodeBinaryStl(mesh.positions, mesh.indices, `barocss studio mesh ${name}`);
