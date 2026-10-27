import { queryCadDocumentCurveArcLength, queryCadDocumentSurfaceArea } from '@barocss/cad';
import { resolveDocumentInspection } from './native-inspection.js';

// The existing viewer-curve-length and viewer-surface-area example profiles.
const profiles = Object.freeze({
  curve: Object.freeze({ absoluteTolerance: 1e-7, relativeTolerance: 1e-8,
    maximumEvaluations: 4096, maximumSubdivisions: 128, maximumDepth: 12 }),
  surface: Object.freeze({ absoluteTolerance: 1e-6, relativeTolerance: 1e-8,
    maximumEvaluations: 16384, maximumSubdivisions: 128, maximumDepth: 8 }),
});

/** Return a detached UI tolerance profile. Native work budgets remain fixed. */
export function geometryInspectionDefaults(kind) {
  if (kind !== 'curve' && kind !== 'surface') throw new RangeError('Select a native Curve or Surface.');
  const profile = profiles[kind];
  return { absoluteTolerance: profile.absoluteTolerance, relativeTolerance: profile.relativeTolerance };
}

function tolerances(kind, input) {
  const options = geometryInspectionDefaults(kind);
  if (input === undefined) return options;
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype)
    throw new RangeError('Geometry inspection options must be plain data.');
  const keys = Reflect.ownKeys(input);
  if (keys.length > 2 || keys.some(key => key !== 'absoluteTolerance' && key !== 'relativeTolerance'))
    throw new RangeError('Only absoluteTolerance and relativeTolerance can be set.');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor?.enumerable || !('value' in descriptor))
      throw new RangeError('Geometry inspection tolerances must be own data.');
    options[key] = descriptor.value;
  }
  return options;
}

/** Estimate the complete original native domain. CAD owns admission and quadrature. */
export function inspectDocumentGeometry(source, state, options) {
  const { result, reference } = resolveDocumentInspection(source, state);
  const kind = reference.geometryKind, profile = profiles[kind], settings = tolerances(kind, options);
  const budgets = { maximumEvaluations: profile.maximumEvaluations,
    maximumSubdivisions: profile.maximumSubdivisions, maximumDepth: profile.maximumDepth };
  const estimate = kind === 'curve'
    ? queryCadDocumentCurveArcLength(result, reference, { interval: null,
      absoluteToleranceMM: settings.absoluteTolerance, relativeTolerance: settings.relativeTolerance, ...budgets })
    : queryCadDocumentSurfaceArea(result, reference, { region: null,
      absoluteToleranceMM2: settings.absoluteTolerance, relativeTolerance: settings.relativeTolerance, ...budgets });
  if (estimate.report.criterionSatisfied !== true)
    throw new RangeError('The native geometry estimate did not satisfy its estimator criterion.');
  const curve = kind === 'curve';
  return { kind, reference: { ...estimate.reference },
    value: curve ? estimate.estimatedLengthMM : estimate.areaEstimateMM2,
    errorEstimate: curve ? estimate.errorEstimateMM : estimate.errorEstimateMM2,
    unit: curve ? estimate.report.lengthUnit : estimate.report.areaUnit,
    domain: curve ? { parameter: [...estimate.report.originalDomain] }
      : { u: [...estimate.report.originalDomains.u], v: [...estimate.report.originalDomains.v] },
    absoluteTolerance: curve ? estimate.options.absoluteToleranceMM : estimate.options.absoluteToleranceMM2,
    relativeTolerance: estimate.options.relativeTolerance, criterionSatisfied: true,
    certification: estimate.report.geometricValidity };
}
