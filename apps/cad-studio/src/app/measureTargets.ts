import { bodyName, lookOf } from '@barocss/cad-model/app/bodies';
import type { MeasurePick } from '@barocss/cad-model/app/measure';
import type { PartInstance, StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import { bindMeasureFacePick } from './pinnedFaceMeasure';

export interface MeasureTarget {
  pick: MeasurePick;
  occurrence?: PartInstance;
  body: string;
  label: string;
  mesh: DisplayMesh;
  face?: string;
  edge?: readonly string[];
}

export interface PlacedMeasureSource {
  inst: PartInstance;
  bodies: BodyResult[];
  hidden: ReadonlySet<string>;
}

export function capturePlacedMeasureFace(pick: { body: number; face: number }, doc: StudioDoc, source: PlacedMeasureSource | undefined): MeasureTarget | null {
  const body = source?.bodies[pick.body];
  return source && body && !source.hidden.has(body.key) ? captureMeasureTarget(pick, doc, body, false, source.inst) : null;
}

export function captureMeasureTarget(pick: MeasurePick, doc: StudioDoc, body: BodyResult | undefined, pinReady = false, occurrence?: PartInstance): MeasureTarget | null {
  if (!body || (!occurrence && lookOf(doc, body).hidden)) return null;
  const face = pick.face === undefined ? undefined : body.mesh.faces[pick.face];
  if (pick.face !== undefined && !face) return null;
  const edge = pick.edge === undefined ? undefined : body.mesh.edges[pick.edge];
  if (pick.edge !== undefined && !edge) return null;
  if (pinReady && face) bindMeasureFacePick(pick, doc, body);
  return { pick, body: body.key, label: occurrence?.name ?? bodyName(doc, body), occurrence, mesh: body.mesh, face: face?.nativePlaneName ?? face?.name, edge: edge?.names };
}

export function readMeasureTarget(target: MeasureTarget, doc: StudioDoc, bodies: readonly BodyResult[]): MeasurePick | null {
  const index = bodies.findIndex(body => body.key === target.body);
  if (index < 0 || bodies.some((body, i) => i !== index && body.key === target.body)) return null;
  const body = bodies[index];
  if (!target.occurrence && lookOf(doc, body).hidden) return null;
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

/** A display edit can copy an occurrence. Its source definition and original placement still identify it. */
export function sameMeasureOccurrence(original: PartInstance, current: PartInstance): boolean {
  return original === current || (original.doc === current.doc
    && original.part?.id === current.part?.id && original.part?.rev === current.part?.rev
    && original.name === current.name
    && original.position.every((value, axis) => value === current.position[axis])
    && original.rotation.every((value, axis) => value === current.rotation[axis]));
}
