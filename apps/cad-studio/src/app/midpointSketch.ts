import { lookOf } from '@barocss/cad-model/app/bodies';
import type { Command, Ctx, Selection } from '@barocss/cad-model/app/commands';
import type { NativeMidpointFace } from '@barocss/cad-model/app/nativeMidpointPlane';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { BodyResult } from '@barocss/cad-model/engine/evaluate';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';

type FacePick = Selection['faces'][number];
const pickedOn = new WeakMap<FacePick, { doc: StudioDoc; mesh: DisplayMesh }>();

export function bindMidpointPick(pick: FacePick, doc: StudioDoc, body: BodyResult | undefined): void {
  if (body?.mesh.faces[pick.face]?.nativePlaneName) pickedOn.set(pick, { doc, mesh: body.mesh });
}

export const midpointSelectionHint = 'Select two distinct native planar faces on one visible solid.';

export function currentNativePlanePick(ctx: Ctx, pick: FacePick, doc = ctx.doc): { bodyKey: string; face: NativeMidpointFace } | null {
  const body = ctx.bodies[pick.body];
  const ref = body?.ref, output = body && ctx.doc.outputs[body.key];
  if (!ref || !output || output.node !== ref.node || output.side !== ref.side || lookOf(doc, body).hidden) return null;
  const owner = pickedOn.get(pick), face = body.mesh.faces[pick.face];
  if (owner?.doc !== doc || owner.mesh !== body.mesh || face?.kind !== 'plane' || face.facet || !face.nativePlaneName) return null;
  return { bodyKey: body.key, face: { id: face.id, name: face.nativePlaneName } };
}

export function midpointFaces(ctx: Ctx, doc = ctx.doc) {
  const { faces, edges, bodies, sketches, vertices } = ctx.selection;
  if (faces.length !== 2 || edges.length || bodies.length || sketches?.length || vertices?.length
    || ctx.direct?.length || doc.instances?.length) return null;
  const [a, b] = faces;
  if (a.body !== b.body || a.face === b.face) return null;
  const first = currentNativePlanePick(ctx, a, doc), second = currentNativePlanePick(ctx, b, doc);
  if (!first || !second || first.face.id === second.face.id) return null;
  return { key: first.bodyKey, faces: [first.face, second.face] as const };
}

export const SKETCH_AT_MIDPOINT: Command = {
  id: 'sketch-at-midpoint', label: 'Sketch at midpoint', icon: 'cad-sketch', group: 'create',
  hint: 'Start an independent sketch halfway between two parallel faces',
  keywords: 'midplane mid-plane workplane plane faces parallel sketch',
  available: ctx => midpointFaces(ctx, ctx.bearingAssembly?.root) ? { ok: true } : { ok: false, reason: midpointSelectionHint },
};
