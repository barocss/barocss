import type { FaceEndExtrudeNode } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { Ctx, FaceSel, Values } from './commands';

export const EXTRUDE_END_FACE_EDIT = 'extrude-end-face-edit';

export function isExtrudeToFace(command: string, values: Values): boolean {
  return (command === 'extrude' || command === EXTRUDE_END_FACE_EDIT) && values.depth === 'to-face';
}

export function awaitingExtrudeEndFace(command: string, values: Values): boolean {
  return isExtrudeToFace(command, values) && values.endFace === undefined;
}

export function extrudeEndFaceIndex(body: BodyResult, name: string): number | null {
  if (!name || name.includes('+') || body.family === 'faceted' || body.band || body.role || body.ref?.side !== 'solid') return null;
  const faces = body.mesh.faces.filter(face => face.name === name);
  if (faces.length !== 1) return null;
  const [face] = faces;
  return face.kind === 'plane' && !face.facet && !face.nativeFaces ? face.index : null;
}

/** Resolve a viewport pick against the accepted command context before storing a durable reference. */
export function extrudeEndFaceTarget(ctx: Ctx, values: Values): FaceEndExtrudeNode['target'] | null {
  const { endBody, endFace } = values;
  if (typeof endBody !== 'number' || !Number.isInteger(endBody) || endBody < 0 || typeof endFace !== 'string') return null;
  const source = ctx.bodies[endBody], body = source?.ref;
  if (!body || extrudeEndFaceIndex(source, endFace) === null) return null;
  const { key } = source;
  if (ctx.bodies.filter(candidate => candidate.key === key).length !== 1) return null;
  const output = ctx.doc.outputs[key];
  if (!output || output.node !== body.node || output.side !== body.side) return null;
  const feature = ctx.doc.nodes[body.node]?.id;
  if (!feature || ctx.doc.nodes.filter(node => node.id === feature).length !== 1) return null;
  return { body: { ...body }, feature, face: endFace };
}

export function extrudeEndFaceValues(ctx: Ctx, values: Values, picked: FaceSel): Values | null {
  const name = ctx.bodies[picked.body]?.mesh.faces[picked.face]?.name;
  if (!name || extrudeEndFaceIndex(ctx.bodies[picked.body], name) !== picked.face) return null;
  const next = { ...values, endBody: picked.body, endFace: name };
  return extrudeEndFaceTarget(ctx, next) ? next : null;
}
