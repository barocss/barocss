import { measureBrepEdgeContinuity, type BrepEdgeContinuityResult } from '@barocss/cad';
import { partBreps } from './evaluate';
import type { StudioDoc } from './doc';
import type { DisplayEdge } from './mesh';

export interface ContinuityEdge {
  id: string;
  name: string;
  faces: [string, string];
}

export type ContinuityRequest =
  | { kind: 'list'; picked?: DisplayEdge['nativeJoint'] }
  | { kind: 'measure'; edgeId: string };
export type ContinuityReply =
  | { edges: ContinuityEdge[]; selected: string | null }
  | { measurement: BrepEdgeContinuityResult }
  | { error: string };

export function readEdgeContinuity(doc: StudioDoc, bodyKey: string, request: ContinuityRequest): ContinuityReply {
  const bodies = partBreps(doc).filter(body => body.key === bodyKey);
  if (bodies.length !== 1) return { error: 'The selected body has no unique native geometry.' };
  const { brep } = bodies[0];
  if (request.kind === 'measure') return { measurement: measureBrepEdgeContinuity(brep, request.edgeId) };

  const faces = new Map(brep.faces.map(face => [face.id, face]));
  const loops = new Map(brep.loops.map(loop => [loop.id, loop.face]));
  const uses = new Map<string, (string | undefined)[]>();
  for (const use of brep.coedges) {
    const list = uses.get(use.edge) ?? [];
    list.push(loops.get(use.loop));
    uses.set(use.edge, list);
  }

  const edges: ContinuityEdge[] = [];
  let selected: string | null = null;
  for (const edge of brep.edges) {
    const on = uses.get(edge.id);
    if (on?.length !== 2 || on[0] === on[1]) continue;
    const a = faces.get(on[0] ?? ''), b = faces.get(on[1] ?? '');
    if (a?.surface.kind !== 'surface' || b?.surface.kind !== 'surface') continue;
    if (request.picked?.edgeId === edge.id && request.picked.faces.includes(a.id) && request.picked.faces.includes(b.id)) selected = edge.id;
    edges.push({ id: edge.id, name: edge.name ?? edge.id, faces: [a.name ?? a.id, b.name ?? b.id] });
  }

  return { edges, selected };
}
