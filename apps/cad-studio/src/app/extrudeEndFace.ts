import { extrudeEndFaceIndex, extrudeEndFaceTarget } from '@barocss/cad-model/app/extrudeEndFacePick';
import type { FaceSel } from '@barocss/cad-model/app/commands';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { Active } from './commandState';

export interface ExtrudeEndHit {
  face: FaceSel | null;
  edge: unknown;
  vertex?: unknown;
  direct?: string;
  instance?: string;
  instanceFace?: unknown;
  instanceCap?: unknown;
}

function uniqueBody(bodies: readonly BodyResult[], source: BodyResult): number {
  const matches = bodies.flatMap((body, index) => body.key === source.key ? [index] : []);
  if (matches.length !== 1 || !source.ref) return -1;
  const ref = bodies[matches[0]].ref;
  return ref?.node === source.ref.node && ref.side === source.ref.side ? matches[0] : -1;
}

/** Preview indices belong to the drawn bodies. Only a retained body and face can bind the original. */
export function sourceExtrudeEndFace(active: Active, shown: readonly BodyResult[], hit: ExtrudeEndHit): FaceSel | null {
  if (!hit.face || hit.edge || hit.vertex || hit.direct || hit.instance || hit.instanceFace || hit.instanceCap) return null;
  const drawn = shown[hit.face.body], face = drawn?.mesh.faces[hit.face.face];
  if (!face || extrudeEndFaceIndex(drawn, face.name) !== hit.face.face || uniqueBody(shown, drawn) !== hit.face.body) return null;
  const body = uniqueBody(active.ctx.bodies, drawn);
  const index = body < 0 ? null : extrudeEndFaceIndex(active.ctx.bodies[body], face.name);
  return index === null ? null : { body, face: index };
}

export function shownExtrudeEndFace(active: Active, shown: readonly BodyResult[]): FaceSel | null {
  const target = extrudeEndFaceTarget(active.ctx, active.values);
  const source = active.ctx.bodies[Number(active.values.endBody)];
  if (!target || !source) return null;
  const body = uniqueBody(shown, source);
  const face = body < 0 ? null : extrudeEndFaceIndex(shown[body], target.face);
  return face === null ? null : { body, face };
}
