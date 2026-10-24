// R7 (cad-model's facade): the shared typed selectors (@barocss/cad/api), filled from what cad-model's evaluation already
// worked out — the display mesh's edges and faces, each with its persistent names (engine/mesh.ts: seams, coplanar
// splits and tangent joints already left out). The queries hand back those names, which a feature node stores.
import { BodyQuery, type EdgeInfo, type FaceInfo } from '@barocss/cad/api';
import type { DisplayMesh } from '../engine/mesh';

export { BodyQuery, EdgeQuery, FaceQuery, type AxisName, type Direction, type EdgeInfo, type FaceInfo } from '@barocss/cad/api';

/** A body's edges and faces, read once from its display mesh. */
export function meshSelection(mesh: DisplayMesh): BodyQuery {
  const edgesOfFace: number[][] = mesh.faces.map(() => []);
  const edges: EdgeInfo[] = mesh.edges.map((e, k) => {
    edgesOfFace[e.faces[0]]?.push(k); if (e.faces[1] !== e.faces[0]) edgesOfFace[e.faces[1]]?.push(k);
    return {
      names: e.names, straight: e.straight, axis: e.axis,
      a: [e.a[0], e.a[1], e.a[2]], b: [e.b[0], e.b[1], e.b[2]],
      faces: [mesh.faces[e.faces[0]]?.name ?? '', mesh.faces[e.faces[1]]?.name ?? ''],
    };
  });
  const faces: FaceInfo[] = mesh.faces.map((f, k) => ({
    name: f.name, kind: f.kind, normal: [f.normal[0], f.normal[1], f.normal[2]], centroid: [f.centroid[0], f.centroid[1], f.centroid[2]],
    areaMM2: f.areaMM2, edges: edgesOfFace[k],
  }));
  return new BodyQuery(edges, faces);
}
