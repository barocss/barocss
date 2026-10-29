import { thickenSpec, type RawNurbsSurface, type ThickenOptions } from '@barocss/cad/api';
import type { Ctx } from '../app/commands';
import type { ModelNode } from './doc';
import { directNow } from './directModule';
import { refusal } from './refusal';

export interface ThickenSnapshot { surface: RawNurbsSurface; name: string }
const fail = (message: string): never => { throw refusal('VALUE', `Thicken: ${message}`); };

/** Capture one whole surface. The result has no live source reference. */
export function thickenSnapshot(ctx: Pick<Ctx, 'doc' | 'direct' | 'thickenSnapshot'>): ThickenSnapshot {
  if (ctx.thickenSnapshot) {
    const spec = thickenSpec(ctx.thickenSnapshot.surface, { t: 1 });
    return { surface: spec.surface, name: ctx.thickenSnapshot.name };
  }
  if (ctx.direct?.length !== 1) return fail('pick one whole surface.');
  const direct = ctx.doc.direct, objects = direct?.objects.filter(o => o.id === ctx.direct![0]) ?? [];
  if (!direct || objects.length !== 1) return fail('pick one current surface.');
  const object = objects[0];
  // Keep trim metadata until admission. A malformed container must not become an untrimmed snapshot.
  if (object.trims !== undefined && (!Array.isArray(object.trims) || object.trims.length !== 0)) return fail('untrim the surface first; Thicken uses its whole support surface.');
  if (!Object.hasOwn(direct.sources, object.source) || typeof direct.sources[object.source] !== 'string') return fail('the surface source is missing.');
  const D = directNow();
  if (!D) return fail('the surface tools are loading; try again.');
  const geometries = D.modelOf(direct.sources[object.source]).objects.filter(g => g.id === object.geometry);
  if (geometries.length !== 1 || geometries[0].kind !== 'surface') return fail('pick one current source surface.');
  const g = geometries[0];
  const spec = thickenSpec({ degreeU: g.degreeU, degreeV: g.degreeV, knotsU: g.knotsU, knotsV: g.knotsV, controlPoints: g.controlPoints, weights: g.weights }, { t: 1 });
  return { surface: spec.surface, name: object.name };
}

/** The same strict raw snapshot and option checks used by the public facade. */
export function thickenNodeProblem(node: Record<string, unknown>, parameters: Record<string, number>): string | null {
  try {
    const dim = node.thickness;
    const t = typeof dim === 'number' ? dim : dim && typeof dim === 'object' && 'parameter' in dim ? parameters[String(dim.parameter)] : NaN;
    thickenSpec(node.surface as RawNurbsSurface, { t, ...(node.side !== undefined ? { side: node.side as ThickenOptions['side'] } : {}) });
    return null;
  } catch (error) { return error instanceof Error ? error.message : String(error); }
}

export function thickenNode(snapshot: ThickenSnapshot, t: number, side: string): Extract<ModelNode, { kind: 'thicken' }> {
  const spec = thickenSpec(snapshot.surface, { t, side: side as ThickenOptions['side'] });
  // The spec owns these arrays. The native node stores that independent snapshot.
  return { kind: 'thicken', name: snapshot.name, surface: spec.surface as Extract<ModelNode, { kind: 'thicken' }>['surface'], thickness: spec.values.t, ...(spec.values.side ? { side: spec.values.side } : {}) };
}
