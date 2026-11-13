import type { MeasurePick } from '@barocss/cad-model/app/measure';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';

export interface MeasureGeometry { pick: MeasurePick; mesh: DisplayMesh }

/** Curved surfaces and sampled curves are compared as display triangles and segments. */
export function usesCurvedMeshDistance({ pick, mesh }: MeasureGeometry): boolean {
  if (pick.face !== undefined) {
    const face = mesh.faces[pick.face];
    if (!face || face.facet) return false;
    return face.kind === 'curved' || face.curvedBoundary === true
      || mesh.edges.some(edge => !edge.straight && edge.faces.includes(face.index));
  }
  return pick.edge !== undefined && mesh.edges[pick.edge]?.straight === false;
}

/** The current axis comparison fits display normals and points. */
export const measureAxesBasis = 'mesh fit';
