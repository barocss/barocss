import { decimalAt, decimalValue, tickNumber } from './decimal';
import type { Resolved } from './dimensions';
import type { DimPoint, DimView, DrawingDimension, Tolerance } from './types';

export interface ToleranceStackTerm { id: string; sign: 1 | -1 }
export type ToleranceStackResult =
  | { ok: true; unit: 'mm'; nominal: string; minimum: string; maximum: string }
  | { ok: false; reason: string };

function deviations(tolerance: Tolerance): readonly [lower: number, upper: number] | null {
  if (tolerance.kind === 'symmetric' && Number.isFinite(tolerance.value) && tolerance.value > 0) {
    return [-tolerance.value, tolerance.value];
  }
  if (tolerance.kind === 'deviation' && Number.isFinite(tolerance.lower) && Number.isFinite(tolerance.upper)
    && tolerance.lower <= tolerance.upper) {
    return [tolerance.lower, tolerance.upper];
  }
  return null;
}

/** Match identical resolver inputs. Different reference pairs can still be mechanically dependent. */
function referenceKey(point: DimPoint): string {
  if (point.at === 'pcd') {
    return JSON.stringify([point.at, point.ring?.map(({ edge, near }) => [edge, near])]);
  }
  return JSON.stringify([point.at, point.edge, point.near]);
}

/** Identity for a selected linear measure, excluding its annotation position and tolerance. */
export function linearMeasurementKey(dim: Extract<DrawingDimension, { kind: 'linear' }>): string {
  return JSON.stringify([dim.view, dim.orient, [referenceKey(dim.a), referenceKey(dim.b)].sort()]);
}

function signedText(value: bigint, places: number): string {
  const magnitude = tickNumber(value, places, true, true);
  return value < 0n ? `-${magnitude}` : magnitude;
}

/** Use the raw model lengths and authored deviations in mm. The caller selects independent dimensions and their signs. */
export function calculateToleranceStack(
  unit: string,
  terms: readonly ToleranceStackTerm[],
  dimensions: readonly Resolved[],
): ToleranceStackResult {
  if (unit !== 'mm') return { ok: false, reason: 'Stack inputs must use model millimetres.' };
  if (terms.length < 2) return { ok: false, reason: 'Select at least two dimensions.' };

  const byId = new Map<string, Resolved | null>();
  for (const dimension of dimensions) {
    const { id } = dimension.dim;
    byId.set(id, byId.has(id) ? null : dimension);
  }
  const ids = new Set<string>();
  const pairs = new Set<string>();
  let view: DimView | undefined;
  let orientation: 'horizontal' | 'vertical' | undefined;
  let places = 0;
  let nominal = 0n;
  let minimum = 0n;
  let maximum = 0n;
  for (const term of terms) {
    if (typeof term?.id !== 'string' || !term.id.trim()) return { ok: false, reason: 'Each term requires a dimension ID.' };
    const { id, sign } = term;
    if (sign !== 1 && sign !== -1) return { ok: false, reason: `Select a plus or minus sign for dimension ${id}.` };
    if (ids.has(id)) return { ok: false, reason: `Use dimension ${id} only once.` };
    ids.add(id);
    const dimension = byId.get(id);
    if (dimension === null) return { ok: false, reason: `More than one dimension has ID ${id}.` };
    if (!dimension) return { ok: false, reason: `Dimension ${id} is missing from this sheet.` };
    if (!dimension.ok) return { ok: false, reason: `The drawing cannot resolve dimension ${id}.` };
    if (dimension.kind !== 'linear') return { ok: false, reason: `Dimension ${id} must be linear.` };

    const { dim, value } = dimension;
    if (dim.orient !== 'horizontal' && dim.orient !== 'vertical') {
      return { ok: false, reason: `Dimension ${id} must be horizontal or vertical.` };
    }
    if (orientation !== undefined && (orientation !== dim.orient || view !== dim.view)) {
      return { ok: false, reason: 'Select dimensions with the same orientation in the same view.' };
    }
    view = dim.view;
    orientation = dim.orient;
    if (dim.basic || (dim.count !== undefined && dim.count !== 1)) {
      return { ok: false, reason: `Dimension ${id} must specify one size with a tolerance.` };
    }
    if (!Number.isFinite(value) || value <= 0) {
      return { ok: false, reason: `Dimension ${id} must have a finite positive length.` };
    }
    if (!dim.tol) return { ok: false, reason: `Dimension ${id} needs an explicit numeric tolerance.` };
    if (dim.tol.kind === 'fit') return { ok: false, reason: `Dimension ${id} uses a fit. Enter numeric deviations.` };
    const limits = deviations(dim.tol);
    if (!limits) return { ok: false, reason: `Dimension ${id} has an invalid tolerance.` };

    const pair = linearMeasurementKey(dim);
    if (pairs.has(pair)) return { ok: false, reason: `Dimension ${id} measures the same points as another term.` };
    pairs.add(pair);

    const length = decimalValue(value);
    const lower = decimalValue(limits[0]);
    const upper = decimalValue(limits[1]);
    const termPlaces = Math.max(places, length.places, lower.places, upper.places);
    const termNominal = decimalAt(length, termPlaces);
    const termMinimum = termNominal + decimalAt(lower, termPlaces);
    const termMaximum = termNominal + decimalAt(upper, termPlaces);
    if (termMinimum <= 0n) return { ok: false, reason: `Dimension ${id} has a tolerance that permits a zero or negative size.` };

    const scale = 10n ** BigInt(termPlaces - places);
    places = termPlaces;
    nominal = nominal * scale + BigInt(sign) * termNominal;
    minimum = minimum * scale + (sign === 1 ? termMinimum : -termMaximum);
    maximum = maximum * scale + (sign === 1 ? termMaximum : -termMinimum);
  }
  return {
    ok: true,
    unit,
    nominal: signedText(nominal, places),
    minimum: signedText(minimum, places),
    maximum: signedText(maximum, places),
  };
}
