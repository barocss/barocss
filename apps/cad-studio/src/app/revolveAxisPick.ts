import type { EdgeSel } from '@barocss/cad-model/app/commands';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { BodyRef } from '@barocss/cad-model/engine/doc';
import type { DisplayEdge, DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import { bodyKeyFor } from '@barocss/cad-model/engine/ids';
import type { Active } from './commandState';

export interface RevolveAxisHit {
  edge: EdgeSel | null;
  edgeMesh?: DisplayMesh;
  direct?: string;
  instance?: string;
  instanceFace?: unknown;
  instanceCap?: unknown;
}

const sameRef = (a: BodyRef | undefined, b: BodyRef | undefined) => a && b && a.node === b.node && a.side === b.side;
const samePoint = (a: Vec3, b: Vec3) => a.every((v, i) => v === b[i]);
const edgeFaces = (mesh: DisplayMesh, edge: DisplayEdge) => edge.faces.map(i => mesh.faces[i]?.name).sort();

function joinSource(active: Active, shown: BodyResult): BodyRef | undefined {
  if (active.values.op !== 'join' || shown.ref?.side !== 'solid') return;
  const candidate = active.cmd.build?.(active.ctx, active.values);
  if (!candidate || candidate.nodes.length !== active.ctx.doc.nodes.length + 2) return;
  const index = candidate.nodes.length - 1, union = candidate.nodes[index];
  if (union.kind === 'union' && union.right.node === index - 1 && union.right.side === 'solid'
    && candidate.nodes[index - 1].kind === 'revolve' && union.left.node < active.ctx.doc.nodes.length
    && shown.ref.node === index && shown.key === bodyKeyFor(candidate.nodes, index)) return union.left;
}

/** Map a drawn edge to the complete unchanged straight edge of a unique accepted source body. */
export function sourceRevolveAxis(active: Active, shown: readonly BodyResult[], hit: RevolveAxisHit, currentPreview: boolean): EdgeSel | null {
  const pick = hit.edge;
  if (!pick || hit.direct || hit.instance || hit.instanceFace || hit.instanceCap) return null;
  const drawn = shown[pick.body], edge = drawn?.mesh.edges[pick.edge];
  if (!edge || drawn.mesh !== hit.edgeMesh || shown.filter(body => body.key === drawn.key).length !== 1) return null;
  const accepted = active.ctx.bodies;
  const retainedOwners = accepted.flatMap((body, index) => body.key === drawn.key && sameRef(body.ref, drawn.ref) ? [index] : []);
  if (retainedOwners.length > 1) return null;
  const retained = retainedOwners[0] ?? -1;
  if (retained >= 0 && accepted[retained].mesh === drawn.mesh) return { body: retained, edge: pick.edge };
  if (!currentPreview || !edge.straight || edge.names.length !== 1) return null;

  let ref: BodyRef | undefined;
  try { ref = retained >= 0 ? drawn.ref : joinSource(active, drawn); }
  catch { return null; }
  if (!ref) return null;
  const key = bodyKeyFor(active.ctx.doc.nodes, ref.node, ref.side);
  const owners = accepted.flatMap((body, index) => body.key === key && sameRef(body.ref, ref) ? [index] : []);
  if (owners.length !== 1) return null;
  const body = owners[0], mesh = accepted[body].mesh, faces = edgeFaces(drawn.mesh, edge);
  if (faces[0] === faces[1] || faces.some(name => !name || name.includes('+'))) return null;
  const matches = mesh.edges.flatMap((source, index) => {
    if (!source.straight || source.names.length !== 1 || source.names[0] !== edge.names[0]) return [];
    const sourceFaces = edgeFaces(mesh, source);
    if (!faces.every((name, i) => name === sourceFaces[i])) return [];
    return (samePoint(source.a, edge.a) && samePoint(source.b, edge.b)) || (samePoint(source.a, edge.b) && samePoint(source.b, edge.a)) ? [index] : [];
  });
  return matches.length === 1 ? { body, edge: matches[0] } : null;
}
