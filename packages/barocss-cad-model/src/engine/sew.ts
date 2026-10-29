import { sewSpec, type RawNurbsSurface } from '@barocss/cad/api';
import type { Ctx } from '../app/commands';
import type { ModelNode } from './doc';
import { directNow } from './directModule';
import { refusal } from './refusal';

export interface SewSnapshot { surfaces: readonly RawNurbsSurface[]; names: readonly string[] }
const fail = (message: string): never => { throw refusal('VALUE', `Sew: ${message}`); };

function capture(snapshot: SewSnapshot): SewSnapshot {
  const spec = sewSpec(snapshot.surfaces, { tol: 0 });
  const names = snapshot.names;
  if (!Array.isArray(names) || Object.getPrototypeOf(names) !== Array.prototype || names.length !== spec.surfaces.length || Reflect.ownKeys(names).length !== names.length + 1) return fail('names must match the ordered surfaces.');
  const copy: string[] = [];
  for (let i = 0; i < names.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(names, String(i));
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') return fail('each surface name must be text.');
    copy.push(descriptor.value);
  }
  return { surfaces: spec.surfaces, names: copy };
}

/** Capture whole supports in selection order, without live source references. */
export function sewSnapshot(ctx: Pick<Ctx, 'doc' | 'direct' | 'sewSnapshot'>): SewSnapshot {
  if (ctx.sewSnapshot) return capture(ctx.sewSnapshot);
  const ids = ctx.direct;
  if (!ids || ids.length < 2 || ids.length > 64 || new Set(ids).size !== ids.length) return fail('pick 2 to 64 distinct whole surfaces.');
  const direct = ctx.doc.direct;
  if (!direct) return fail('pick current surfaces.');
  const objects: NonNullable<typeof direct>['objects'] = [];
  for (const id of ids) {
    let match: typeof objects[number] | undefined;
    for (const object of direct.objects) {
      if (object.id !== id) continue;
      if (match) return fail('pick current, unambiguous surfaces.');
      match = object;
    }
    if (!match) return fail('pick current, unambiguous surfaces.');
    objects.push(match);
  }
  // Check every original trim container before source compilation or support access.
  for (const object of objects) {
    const trims = object.trims;
    if (trims !== undefined && (!Array.isArray(trims) || Object.getPrototypeOf(trims) !== Array.prototype || trims.length !== 0 || Reflect.ownKeys(trims).length !== 1)) return fail('untrim the surfaces first; Sew uses their whole support surfaces.');
  }
  for (const object of objects) {
    if (!Object.hasOwn(direct.sources, object.source) || typeof direct.sources[object.source] !== 'string') return fail('a surface source is missing.');
  }
  const D = directNow();
  if (!D) return fail('the surface tools are loading; try again.');
  const surfaces: RawNurbsSurface[] = [], names: string[] = [];
  for (const object of objects) {
    let match: ReturnType<typeof D.modelOf>['objects'][number] | undefined;
    for (const geometry of D.modelOf(direct.sources[object.source]).objects) {
      if (geometry.id !== object.geometry) continue;
      if (match) return fail('pick current source surfaces.');
      match = geometry;
    }
    if (!match || match.kind !== 'surface') return fail('pick current source surfaces.');
    surfaces.push({ degreeU: match.degreeU, degreeV: match.degreeV, knotsU: match.knotsU, knotsV: match.knotsV, controlPoints: match.controlPoints, weights: match.weights });
    names.push(object.name);
  }
  return capture({ surfaces, names });
}

/** The editor uses the same scalar tolerance admission as the public facade. */
export function sewTolerance(surfaces: readonly RawNurbsSurface[], value: number): number {
  return sewSpec(surfaces, { tol: value }).values.tol;
}

export function sewNode(snapshot: SewSnapshot, tol: number): Extract<ModelNode, { kind: 'sew' }> {
  const owned = capture(snapshot), spec = sewSpec(owned.surfaces, { tol });
  return { kind: 'sew', names: [...owned.names], surfaces: spec.surfaces as Extract<ModelNode, { kind: 'sew' }>['surfaces'], ...(spec.values.tol > 0 ? { tolerance: spec.values.tol } : {}) };
}

export function sewNodeProblem(node: Record<string, unknown>): string | null {
  try { sewNode({ surfaces: node.surfaces as readonly RawNurbsSurface[], names: node.names as string[] }, node.tolerance === undefined ? 0 : node.tolerance as number); return null; }
  catch (error) { return error instanceof Error ? error.message : String(error); }
}
