// P2 (cad-model's facade): the one place the facade calls the core's library functions — a library part (a screw
// boss, a snap hook, a standoff, a vent …) added to a body as one step, the write the agent's add_library_part makes
// (chat/assembly.ts): its base on a flat face at a point, facing out of it, its rules checked against the wall measured
// there. A refusal is the core's sentence, its bracketed code kept (§6), else LIBRARY_PART.
import { BarocssError, bracketedCode, refuse, type Vec3 } from '@barocss/cad/api';
import type { StudioDoc } from '../engine/doc';
import { faceTableOf } from '../assembly/faces';
import { addLibraryPartToBody } from '../library/libraries';
import { bodiesOf } from './core';

type XYZ = [number, number, number];
const placementTuple = (value: unknown, name: string): XYZ => {
  if (!Array.isArray(value) || value.length !== 3 || ![0, 1, 2].every(k => typeof value[k] === 'number' && Number.isFinite(value[k]))) throw refuse('VALUE', `${name} is a finite [x, y, z] tuple`);
  return [value[0], value[1], value[2]];
};

/** add_library_part's inputs past the library and part: a variant, the part's parameters, the wall it sits on (else measured), its X direction. */
export interface LibraryPartInput { variant?: string; params?: Readonly<Record<string, number>>; context?: Readonly<Record<string, number>>; xDirection?: Vec3 }

/** The document with the library part added to the body `key` on its flat face `face` at `point`, evaluated; and the warnings its checks gave. */
export function withLibraryPart(doc: StudioDoc, key: string, library: string, item: string, face: string, point: Vec3, o: LibraryPartInput): { doc: StudioDoc; warnings: string[] } {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw refuse('VALUE', 'library part options are an object');
  if (typeof face !== 'string' || !face.length) throw refuse('VALUE', 'a library part face is a non-empty face name');
  const at = placementTuple(point, 'point'), xDir = o.xDirection === undefined ? undefined : placementTuple(o.xDirection, 'xDirection');
  const name = face.replace(/#\d+$/, ''), table = faceTableOf(doc)[name];
  if (!table || table.kind !== 'plane') throw refuse('FACE_NOT_FLAT', `${face} is not a flat face of the part: a library part stands on one`);
  const body = bodiesOf(doc).find(b => b.key === key);
  if (!body?.ref) throw refuse('NO_BODY', `the part has no body ${key} to add to`);
  const r = addLibraryPartToBody(doc, library, item, {
    ...(o.variant !== undefined ? { variant: o.variant } : {}), ...(o.params ? { params: { ...o.params } } : {}), ...(o.context ? { context: { ...o.context } } : {}),
  }, { body: body.ref, face, point: at, normal: table.normal, ...(xDir !== undefined ? { xDir } : {}) });
  if ('error' in r) throw new BarocssError(bracketedCode(r.error) ?? 'LIBRARY_PART', r.error, 'evaluate');
  bodiesOf(r.doc);
  return { doc: r.doc, warnings: [...r.node.warnings] };
}
