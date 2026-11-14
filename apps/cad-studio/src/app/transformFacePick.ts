import type { Ctx, FaceSel } from '@barocss/cad-model/app/commands';
import { lookOf } from '@barocss/cad-model/app/bodies';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { ExtrudeEndHit } from './extrudeEndFace';

export function originalTransformFace(ctx: Ctx, doc: StudioDoc, shown: readonly BodyResult[], hit: ExtrudeEndHit, requireAxisPlane: boolean): FaceSel | null {
  if (!hit.face || hit.edge || hit.vertex || hit.direct || hit.instance || hit.instanceFace || hit.instanceCap) return null;
  const picked = shown[hit.face.body], face = picked?.mesh.faces[hit.face.face];
  if (!picked?.ref || !face || lookOf(doc, picked).hidden) return null;
  const originals = ctx.bodies.flatMap((body, index) => body.key === picked.key && body.ref?.node === picked.ref?.node
    && body.ref?.side === picked.ref?.side ? [index] : []);
  if (originals.length !== 1) return null;
  const body = originals[0];
  const matches = ctx.bodies[body].mesh.faces.filter(candidate => candidate.id === face.id && candidate.name === face.name);
  if (matches.length !== 1 || matches[0].kind !== face.kind) return null;
  if (requireAxisPlane && (!face.nativePlaneName || !face.nativeAxisPlane
    || matches[0].nativePlaneName !== face.nativePlaneName || matches[0].nativeAxisPlane?.axis !== face.nativeAxisPlane.axis
    || matches[0].nativeAxisPlane?.at !== face.nativeAxisPlane.at)) return null;
  return { body, face: matches[0].index };
}
