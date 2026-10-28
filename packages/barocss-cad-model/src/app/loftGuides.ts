// A copied world-mm seam guide. Later source edits do not drive the authored loft.
import type { ModelNode, StudioDoc } from '../engine/doc';
import { directNow } from '../engine/directModule';

type Guide = NonNullable<Extract<ModelNode, { kind: 'loft' }>['guide']>;
export type LoftGuideCopy =
  | { ok: true; name: string; guide: Guide }
  | { ok: false; name?: string; reason: string };

/** Copy a polynomial B-spline; retain the existing single-span Bezier encoding. */
export function copyLoftGuide(doc: Pick<StudioDoc, 'direct'>, objectId: string): LoftGuideCopy {
  let name: string | undefined;
  const no = (reason: string): LoftGuideCopy => ({ ok: false, ...(name === undefined ? {} : { name }), reason });
  try {
    const d = doc.direct;
    if (!d) return no('This document has no direct curves.');
    if (Object.keys(d).some(key => key !== 'sources' && key !== 'objects')) return no('The direct geometry has unsupported metadata or a transform. Use baked world-mm curves.');
    const matches = d.objects.filter(object => object.id === objectId);
    if (matches.length !== 1) return no(matches.length ? 'The curve id is ambiguous in this document.' : 'The selected direct curve is no longer in this document.');
    const object = matches[0]; name = object.name;
    if (Object.keys(object).some(key => !['id', 'name', 'source', 'geometry', 'hidden', 'trims'].includes(key))) return no('The curve object has unsupported metadata or a transform. Use a curve with its transform baked into its source.');
    if (object.trims !== undefined) return no('A trimmed direct object is not a supported loft guide.');
    const source = d.sources[object.source];
    if (typeof source !== 'string' || !source.trim()) return no('The selected curve source is missing.');
    const direct = directNow();
    if (!direct) return no('The curve tools are still loading. Try again in a moment.');
    const model = direct.modelOf(source);
    if (model.lengthUnit !== 'mm') return no('Only world-mm curve sources are supported.');
    if (Object.keys(model).some(key => !['name', 'version', 'lengthUnit', 'objects'].includes(key))) return no('The curve source has unsupported metadata or a transform. Use baked world-mm curves.');
    const curve = direct.geometryOf(d, object);
    if (curve.kind !== 'curve') return no('Choose a direct curve, not a surface.');
    if (Object.keys(curve).some(key => !['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'].includes(key))) return no('The curve has unsupported metadata or a transform. Its world-mm controls cannot be inferred.');
    const degree = curve.degree, points = curve.controlPoints, knots = curve.knots, weights = curve.weights;
    if (!Number.isInteger(degree) || degree < 1 || degree > 5) return no('A loft guide needs a degree from 1 to 5.');
    if (!Array.isArray(points) || points.length < degree + 1 || points.length > 64 || !Array.from(points).every(finitePoint)) return no(`The guide needs ${degree + 1} to 64 finite world-mm control points.`);
    const count = points.length;
    if (!Array.isArray(knots) || knots.length !== count + degree + 1 || !Array.from(knots).every(finiteNumber)) return no('The guide needs finite knots: control points plus degree plus one.');
    const start = knots[0], end = knots[count];
    if (!(start < end)) return no('The guide knots must span a positive parameter interval.');
    for (let i = 1; i < knots.length; i++) if (knots[i] < knots[i - 1]) return no('The guide knots must not decrease.');
    for (let i = 0; i <= degree; i++) if (knots[i] !== start || knots[knots.length - 1 - i] !== end) return no('The guide knots must be clamped at both ends.');
    let repeats = 0;
    for (let i = degree + 1; i < count; i++) {
      repeats = i > degree + 1 && knots[i] === knots[i - 1] ? repeats + 1 : 1;
      if (!(knots[i] > start && knots[i] < end) || repeats > degree) return no('Interior guide knots must lie between the ends and repeat at most degree times.');
    }
    if (!Array.isArray(weights) || weights.length !== count) return no('The guide needs one equal weight per control point.');
    for (const weight of weights) if (!finiteNumber(weight) || weight <= 0 || weight !== weights[0]) return no('Only finite positive exactly equal weights are supported; nonconstant rational guides are not supported.');
    // Equal weights describe a polynomial curve; keep its authored knot interval and controls.
    // Existing direct transforms are already baked by directOps.transform; never apply a matrix here.
    const copied = points.map(copyPoint);
    if (count !== degree + 1 || (degree !== 2 && degree !== 3)) return { ok: true, name, guide: { kind: 'nurbs', degree, knots: [...knots], controlPoints: copied } };
    return curve.degree === 2
      ? { ok: true, name, guide: { kind: 'quadratic-bezier', controlPoints: [copied[0], copied[1], copied[2]] } }
      : { ok: true, name, guide: { kind: 'cubic-bezier', controlPoints: [copied[0], copied[1], copied[2], copied[3]] } };
  } catch (error) {
    return no(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error));
  }
}

function finiteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function finitePoint(value: unknown): boolean { return Array.isArray(value) && value.length === 3 && Array.from(value).every(finiteNumber); }
function copyPoint(point: readonly number[]): [number, number, number] { return [point[0], point[1], point[2]]; }
