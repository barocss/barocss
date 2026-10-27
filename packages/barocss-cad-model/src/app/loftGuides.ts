// A copied world-mm seam guide. Later source edits do not drive the authored loft.
import type { ModelNode, StudioDoc } from '../engine/doc';
import { directNow } from '../engine/directModule';

type Guide = NonNullable<Extract<ModelNode, { kind: 'loft' }>['guide']>;
export type LoftGuideCopy =
  | { ok: true; name: string; guide: Guide }
  | { ok: false; name?: string; reason: string };

/** Copy one exact polynomial Bezier span; section/endpoint admission stays with the Kernel. */
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
    if (curve.degree !== 2 && curve.degree !== 3) return no('A loft guide must be one quadratic or cubic Bezier span (degree 2 or 3).');
    const count = curve.degree + 1, points = curve.controlPoints, knots = curve.knots, weights = curve.weights;
    if (!Array.isArray(points) || points.length !== count || !Array.from(points).every(point =>
      Array.isArray(point) && point.length === 3 && Array.from(point).every(value => typeof value === 'number' && Number.isFinite(value)))) return no('The guide needs exactly three or four finite world-mm control points.');
    if (!Array.isArray(knots) || knots.length !== 2 * count || !Array.from(knots).every(value => typeof value === 'number' && Number.isFinite(value))) return no('Only one finite clamped Bezier span is supported; internal or additional knots are not supported.');
    const start = knots[0], end = knots[count];
    if (!(start < end) || !knots.every((value, index) => value === (index < count ? start : end))) return no('The guide knots must be two exact clamped blocks with a positive parameter interval and no internal knots.');
    if (!Array.isArray(weights) || weights.length !== count || !Array.from(weights).every(value =>
      typeof value === 'number' && Number.isFinite(value) && value > 0 && value === weights[0])) return no('Only finite positive exactly equal weights are supported; nonconstant rational guides are not supported.');
    // Equal weights and an affine knot interval describe the same polynomial Bezier controls.
    // Existing direct transforms are already baked by directOps.transform; never apply a matrix here.
    const copied = points.map(point => [point[0], point[1], point[2]] as [number, number, number]);
    return curve.degree === 2
      ? { ok: true, name, guide: { kind: 'quadratic-bezier', controlPoints: [copied[0], copied[1], copied[2]] } }
      : { ok: true, name, guide: { kind: 'cubic-bezier', controlPoints: [copied[0], copied[1], copied[2], copied[3]] } };
  } catch (error) {
    return no(error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error));
  }
}
