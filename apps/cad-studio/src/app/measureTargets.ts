import { bodyName, lookOf } from '@barocss/cad-model/app/bodies';
import type { MeasurePick } from '@barocss/cad-model/app/measure';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import { bindMeasureFacePick } from './pinnedFaceMeasure';

export interface MeasureTarget {
  pick: MeasurePick;
  body: string;
  label: string;
  mesh: DisplayMesh;
  face?: string;
  edge?: readonly string[];
}

export function captureMeasureTarget(pick: MeasurePick, doc: StudioDoc, body: BodyResult | undefined, pinReady = false): MeasureTarget | null {
  if (!body || lookOf(doc, body).hidden) return null;
  const face = pick.face === undefined ? undefined : body.mesh.faces[pick.face];
  if (pick.face !== undefined && !face) return null;
  const edge = pick.edge === undefined ? undefined : body.mesh.edges[pick.edge];
  if (pick.edge !== undefined && !edge) return null;
  if (pinReady && face) bindMeasureFacePick(pick, doc, body);
  return { pick, body: body.key, label: bodyName(doc, body), mesh: body.mesh, face: face?.nativePlaneName ?? face?.name, edge: edge?.names };
}

export function readMeasureTarget(target: MeasureTarget, doc: StudioDoc, bodies: readonly BodyResult[]): MeasurePick | null {
  const index = bodies.findIndex(body => body.key === target.body);
  if (index < 0 || bodies.some((body, i) => i !== index && body.key === target.body)) return null;
  const body = bodies[index];
  if (lookOf(doc, body).hidden) return null;
  if (body.mesh === target.mesh) return index === target.pick.body ? target.pick : { ...target.pick, body: index };
  if (target.face !== undefined) {
    const faces = body.mesh.faces.filter(face => (face.nativePlaneName ?? face.name) === target.face);
    return faces.length === 1 ? { body: index, face: faces[0].index } : null;
  }
  if (target.edge?.length) {
    const edges = body.mesh.edges.filter(edge => edge.names.length === target.edge!.length && edge.names.every(name => target.edge!.includes(name)));
    return edges.length === 1 ? { body: index, edge: edges[0].index } : null;
  }
  return null;
}
