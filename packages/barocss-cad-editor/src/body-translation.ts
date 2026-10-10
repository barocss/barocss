import {
  editSourceCurveControlPolygon, editSourceSurfaceControlNet,
  transformNativeGeometryAffine, validateAffineGeometryTransform,
  validateSourceCurveControlPolygonEdit, validateSourceSurfaceControlNetEdit,
} from '@barocss/cad';
import type {
  AffineGeometryTransformReport, CadAffineMatrix3x4, Curve, CurvePoleEdit, CurvePoleEditProvenance,
  Model, Surface, SurfacePoleEdit, SurfacePoleEditProvenance,
} from '@barocss/cad';
import type { CadEditorBodyTranslationField } from './types.js';

const AXES: CadEditorBodyTranslationField[] = ['xMM', 'yMM', 'zMM'];

/** Structural availability only. Source bindings and native/display admission remain separate gates. */
export function withinTranslationProfile(geometry: Curve | Surface, canEdit: boolean): boolean {
  const poles = geometry.kind === 'curve' ? geometry.controlPoints : geometry.controlPoints.flat();
  const knots = geometry.kind === 'curve' ? geometry.knots : [...geometry.knotsU, ...geometry.knotsV];
  return canEdit && poles.every(point => point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000))
    && knots.every(value => Number.isFinite(value) && Math.abs(value) <= 10000);
}

export interface TransformedBodySource {
  source: string;
  noOp: boolean;
  report: AffineGeometryTransformReport;
  provenance: SurfacePoleEditProvenance[];
  curveProvenance: CurvePoleEditProvenance[];
}

function temporaryGeometryId(model: Model, base: string): string {
  const reserved = new Set([model.name, ...model.objects.map(object => object.id)]);
  for (let index = 0; index <= model.objects.length + 1; index++) {
    const candidate = index === 0 ? base : `${base}_${index}`;
    if (!reserved.has(candidate)) return candidate;
  }
  throw new RangeError('A distinct temporary affine result ID is unavailable.');
}

function sameBits(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, index) => sameBits(value, b[index]));
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length
      && Object.keys(x).every(key => Object.hasOwn(y, key) && sameBits(x[key], y[key]));
  }
  return Object.is(a, b);
}

/** Adopt only native transformed coefficients into the original complete source and geometry ID. */
export function translateBodySource(source: string, model: Model, original: Curve | Surface,
  offsetMM: [number, number, number], requested: CadEditorBodyTranslationField[]): TransformedBodySource {
  return transformBodySource(source, model, original,
    [1, 0, 0, offsetMM[0], 0, 1, 0, offsetMM[1], 0, 0, 1, offsetMM[2]], requested, 'cad_editor_translation');
}

/** Shared private affine-to-complete-source path; temporary generated source/model are never adopted. */
export function transformBodySource(source: string, model: Model, original: Curve | Surface,
  matrix: CadAffineMatrix3x4, requested: CadEditorBodyTranslationField[], temporaryBase: string): TransformedBodySource {
  const transformed = transformNativeGeometryAffine(original, matrix,
    { geometryId: temporaryGeometryId(model, temporaryBase), maximumObservations: 961 });
  validateAffineGeometryTransform(transformed);
  let currentSource = source;
  let selected: Curve | Surface = original;
  let noOp = true;
  const provenance: SurfacePoleEditProvenance[] = [];
  const curveProvenance: CurvePoleEditProvenance[] = [];
  const values = (point: [number, number, number]) => Object.fromEntries(
    AXES.filter(field => requested.includes(field)).map(field => [field, point[AXES.indexOf(field)]])
  ) as Partial<Record<CadEditorBodyTranslationField, number>>;
  if (transformed.geometry.kind === 'curve') {
    const poleEdits: CurvePoleEdit[] = transformed.geometry.controlPoints.map((point, index) => ({ index, ...values(point) }));
    const edited = editSourceCurveControlPolygon({ source: currentSource, sourceVersion: 0,
      curveId: original.id, edits: { poleEdits } });
    validateSourceCurveControlPolygonEdit(edited);
    currentSource = edited.source;
    selected = edited.curve;
    noOp = edited.report.noOp;
    curveProvenance.push(...edited.provenance);
  } else {
    const poleEdits: SurfacePoleEdit[] = transformed.geometry.controlPoints.flatMap((row, uIndex) =>
      row.map((point, vIndex) => ({ uIndex, vIndex, ...values(point) })));
    // The existing source writer admits at most 16 poles/64 scalar patches per call.
    // All chunks stay private until the complete native candidate is admitted.
    for (let index = 0; index < poleEdits.length; index += 16) {
      const edited = editSourceSurfaceControlNet({ source: currentSource, sourceVersion: 0,
        surfaceId: original.id, edits: { poleEdits: poleEdits.slice(index, index + 16) } });
      validateSourceSurfaceControlNetEdit(edited);
      currentSource = edited.source;
      selected = edited.model.objects.find(object => object.id === original.id)!;
      noOp = noOp && edited.report.noOp;
      provenance.push(...edited.edit.provenance);
    }
  }
  // Temporary affine identity is proof only; the persisted selected identity is always original.id.
  const expected = { ...transformed.geometry, id: original.id };
  if (!sameBits(selected, expected)) throw new RangeError('The complete-source geometry does not match the native affine coefficient result.');
  return { source: currentSource, noOp, report: transformed.report, provenance, curveProvenance };
}
