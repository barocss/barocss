import {
  CadReferenceDiagnosticCode, CadReferenceError, CadCurveArcLengthError, CadDocumentError,
  SourceCurveIntervalExtractionError, SourceSurfaceKnotInsertionError, SourceCurveKnotInsertionError, curveDomain, surfaceDomain,
  createCadDocument, createCadGeometryReference, editSourceSurfaceControlNetWide, editSourceCurveControlPolygon,
  evaluateCurveD2, evaluateSurfaceD2, evaluateCurveCurvature, evaluateSurfaceCurvature,
  exportCadDocument, getCadDocumentExportCapabilities, inspectCadDocumentExport,
  parseCadDocument, queryCadDocumentCurveArcLength, resolveCadGeometryReference, serializeCadDocument,
  validateCadDocumentResult, validateSourceSurfaceControlNetWideEdit, validateSourceCurveControlPolygonEdit,
} from '@barocss/cad';
import type { CadDocumentResult, CadDocumentV1, CadGeometryReferenceV0, Curve, CurvePoleEdit, SurfacePoleEdit,
  SourceCurveIntervalExtractionResult, SourceSurfaceKnotInsertionResult, SourceCurveKnotInsertionResult, Surface } from '@barocss/cad';
import { CadEditorError } from './types.js';
import { translateBodySource, withinTranslationProfile } from './body-translation.js';
import { rotateBodySource } from './body-rotation.js';
import { scaleBodySource } from './body-scale.js';
import { duplicateBodySourceDocument } from './body-duplicate.js';
import { extractCurveIntervalSource } from './curve-interval.js';
import { insertSurfaceKnotSource } from './surface-knot.js';
import { insertCurveKnotSource } from './curve-knot.js';
import { appendSurfaceIsoCurveSource } from './surface-isocurve.js';
import type {
  CadEditorCandidate, CadEditorDiagnosticCode, CadEditorPoleField, CadEditorSelectedPole, CadEditorSelectedCurvePole, CadEditorView,
  CadEditorEditTarget, CadEditorBodyTranslationField, CadEditorRotationAxis, CadEditorScaleAxis, CadEditorSurfaceIsoCurveAxis, CadEditorSurfaceIsoCurveCreation,
  CadEditorSelectionTarget, CadEditorSelectionTransition, CadEditorSession, CadEditorSessionOptions, CadEditorSnapshot, CadEditorSurfaceSelection,
} from './types.js';

const FILE_LIMIT = 2097152;
const HISTORY_LIMIT = 20;
const HISTORY_BYTES = 8 * 1024 * 1024;
const REVISION_LIMIT = 2147483647;
const FIELDS: CadEditorPoleField[] = ['xMM', 'yMM', 'zMM', 'weight'];
let sessionSequence = 0;

function requireEditor(condition: boolean, code: CadEditorDiagnosticCode, message: string,
  context: CadEditorError['context'] = {}): asserts condition {
  if (!condition) throw new CadEditorError(code, message, context);
}

/** Internal native data is plain, acyclic data. Copy without losing signed zero. */
function copy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => copy(item)) as T;
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)])) as T;
  return value;
}

function ownFields(input: unknown, allowed: string[], required: string[], context: CadEditorError['context']): Record<string, unknown> {
  requireEditor(input !== null && typeof input === 'object' && !Array.isArray(input)
    && [Object.prototype, null].includes(Object.getPrototypeOf(input)), 'INPUT', 'Plain own data is required.', context);
  const keys = Reflect.ownKeys(input), descriptors = Object.getOwnPropertyDescriptors(input);
  requireEditor(keys.length <= allowed.length && required.every(key => Object.hasOwn(descriptors, key))
    && keys.every(key => typeof key === 'string' && allowed.includes(key)
      && 'value' in descriptors[key] && descriptors[key].enumerable === true), 'INPUT', 'Unsupported or non-data fields are refused.', context);
  return Object.fromEntries((keys as string[]).map(key => [key, descriptors[key].value]));
}

function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++index);
      requireEditor(next >= 0xdc00 && next <= 0xdfff, 'INPUT', 'Unpaired Unicode surrogate is unsupported.');
      bytes += 4;
    } else {
      requireEditor(code < 0xdc00 || code > 0xdfff, 'INPUT', 'Unpaired Unicode surrogate is unsupported.');
      bytes += 3;
    }
  }
  return bytes;
}

function native<T>(action: () => T, message: string, documentId?: string,
  context: CadEditorError['context'] = {}): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadEditorError) throw cause;
    const code = cause instanceof CadReferenceError && cause.code === CadReferenceDiagnosticCode.STALE ? 'STALE' : 'NATIVE';
    throw new CadEditorError(code, message, { documentId, ...context }, cause);
  }
}

function fileBudget(text: string, context: CadEditorError['context'] = {}): number {
  requireEditor(typeof text === 'string', 'INPUT', 'Native document text is required.', context);
  requireEditor(text.length <= FILE_LIMIT, 'BUDGET', 'Document exceeds 2097152 code units.', context);
  const bytes = utf8Bytes(text);
  requireEditor(bytes <= FILE_LIMIT, 'BUDGET', 'Document exceeds 2097152 UTF-8 bytes.', context);
  return bytes;
}

function serialize(result: CadDocumentResult, context: CadEditorError['context'] = {}): string {
  const text = native(() => serializeCadDocument(result.document), 'Native document serialization failed.', result.document.documentId, context);
  fileBudget(text, context);
  return text;
}

function admit(result: CadDocumentResult, context: CadEditorError['context'] = {}): CadDocumentResult {
  const documentId = result.document.documentId;
  native(() => validateCadDocumentResult(result), 'Native document validation failed.', documentId, context);
  serialize(result, context);
  return result;
}

function capabilities(result: CadDocumentResult): CadEditorSnapshot['bodyCapabilities'] {
  return result.document.bodies.map(body => {
    const compiled = result.compiledAssets.find(asset => asset.assetId === body.assetId);
    const geometry = compiled?.model.objects.find(object => object.id === body.geometryId);
    requireEditor(compiled !== undefined && geometry !== undefined, 'NATIVE', 'The native body binding is missing.');
    let reason: CadEditorSnapshot['bodyCapabilities'][number]['reason'] = null;
    if (geometry.kind === 'curve') {
      if (!/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(geometry.id) || geometry.degree < 1 || geometry.degree > 5
        || geometry.controlPoints.length < 2 || geometry.controlPoints.length > 64 || geometry.knots.length > 70
        || !geometry.controlPoints.every(point => point.every(value => Number.isFinite(value) && Math.abs(value) <= 1e6))
        || !geometry.weights.every(value => Number.isFinite(value) && value >= 1e-6 && value <= 1e6)) reason = 'curve-profile';
    }
    else {
      const countU = geometry.controlPoints.length, countV = geometry.controlPoints[0].length;
      if (!/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(geometry.id)
        || geometry.degreeU < 1 || geometry.degreeU > 5 || geometry.degreeV < 1 || geometry.degreeV > 5
        || countU < 2 || countU > 16 || countV < 2 || countV > 16 || countU * countV > 256
        || !geometry.controlPoints.every(row => row.length === countV && row.every(point => point.every(value => Number.isFinite(value) && Math.abs(value) <= 1e6)))
        || !geometry.weights.every(row => row.length === countV && row.every(value => Number.isFinite(value) && value >= 1e-6 && value <= 1e6))) reason = 'surface-profile';
    }
    const canTranslateBody = withinTranslationProfile(geometry, reason === null);
    return { bodyId: body.id, canEditSurfacePole: geometry.kind === 'surface' && reason === null,
      canEditCurvePole: geometry.kind === 'curve' && reason === null, reason,
      canTranslateBody, translationReason: canTranslateBody ? null : 'translation-profile',
      canRotateBody: canTranslateBody, rotationReason: canTranslateBody ? null : 'rotation-profile',
      canScaleBody: canTranslateBody, scaleReason: canTranslateBody ? null : 'scale-profile' };
  });
}

function displayIds(result: CadDocumentResult, input: string[]): string[] {
  const context = { documentId: result.document.documentId, field: 'display-body-set' };
  requireEditor(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    'INPUT', 'Display bodies must be a plain array.', context);
  const fields = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(input);
  requireEditor(input.length >= 1 && input.length <= 4, 'BUDGET', 'Choose 1 through 4 display bodies.', context);
  requireEditor(keys.length === input.length + 1 && keys.every(key => typeof key === 'string'),
    'INPUT', 'Display body IDs must be dense own data.', context);
  const ids = Array.from({ length: input.length }, (_, index) => {
    const field = fields[String(index)];
    requireEditor(field !== undefined && field.enumerable === true && 'value' in field
      && typeof field.value === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(field.value),
      'INPUT', 'Display body IDs must be own ASCII identifiers.', context);
    return field.value as string;
  });
  requireEditor(new Set(ids).size === ids.length, 'INPUT', 'Display body IDs must be unique.', context);
  requireEditor(ids.every(id => result.document.bodies.some(body => body.id === id)),
    'INPUT', 'The display body is missing from the native document.', context);
  return result.document.bodies.filter(body => ids.includes(body.id)).map(body => body.id);
}

function viewFor(result: CadDocumentResult, input?: unknown): CadEditorView {
  const context = { documentId: result.document.documentId, field: 'curve-focus' };
  if (input === undefined) return { kind: 'document' };
  const data = ownFields(input, ['kind', 'bodyId', 'count'], ['kind'], context);
  if (data.kind === 'document') {
    requireEditor(Object.keys(data).length === 1, 'INPUT', 'Document view accepts kind only.', context);
    return { kind: 'document' };
  }
  requireEditor(data.kind === 'curve-focus' && typeof data.bodyId === 'string' && Object.keys(data).length === 3,
    'INPUT', 'Curve focus requires bodyId and count.', context);
  requireEditor(typeof data.count === 'number' && Number.isInteger(data.count) && data.count >= 2 && data.count <= 129,
    'BUDGET', 'Curve focus count must be 2 through 129.', context);
  const bodyId = data.bodyId, count = data.count;
  const reference = native(() => createCadGeometryReference(result, { bodyId }),
    'Native Curve focus binding failed.', result.document.documentId, context).reference;
  const resolved = native(() => resolveCadGeometryReference(result, reference), 'Native Curve focus resolution failed.',
    result.document.documentId, context);
  requireEditor(resolved.geometry.kind === 'curve', 'UNSUPPORTED', 'Focus an original Curve.', context);
  return { kind: 'curve-focus', bodyId, count };
}

function sessionConfiguration(result: CadDocumentResult, options?: CadEditorSessionOptions): { displayBodyIds: string[]; view: CadEditorView } {
  const context = { documentId: result.document.documentId, field: 'display-body-set' };
  const data: Record<string, unknown> = options === undefined ? {} : ownFields(options, ['displayBodyIds', 'view'], [], context);
  let input = data.displayBodyIds as string[] | undefined;
  if (input === undefined) {
    requireEditor(result.document.bodies.length <= 4, 'INPUT', 'Choose explicit display bodies for this document.', context);
    input = result.document.bodies.map(body => body.id);
  }
  return { displayBodyIds: displayIds(result, input), view: viewFor(result, data.view) };
}

function nextRevision(revision: number, context: CadEditorError['context'] = {}): number {
  requireEditor(revision < REVISION_LIMIT, 'REVISION', 'Native revision limit reached.', context);
  return revision + 1;
}

interface Presentation {
  displayBodyIds: string[]; view: CadEditorView; selectionTarget: CadEditorSelectionTarget | null;
  editTarget: CadEditorEditTarget; rotationAxis: CadEditorRotationAxis; scaleAxis: CadEditorScaleAxis;
}
interface DuplicateBoundary { before: Presentation; after: Presentation }
interface SurfaceIsoCurveBoundary { before: Presentation; after: Presentation }
interface SurfaceIsoCurveBinding {
  bodyId: string; reference: CadGeometryReferenceV0; source: string; surface: Surface;
  domains: { u: [number, number]; v: [number, number] }; axis: CadEditorSurfaceIsoCurveAxis;
  baseGeneration: number; baseDisplayGeneration: number; view: CadEditorView;
}
interface IntervalBoundary { bodyId: string }
interface IntervalBinding {
  bodyId: string; reference: CadGeometryReferenceV0; source: string; curve: Curve; domain: [number, number];
  baseGeneration: number; baseDisplayGeneration: number; view: CadEditorView;
}
interface IntervalPreparation {
  extraction?: SourceCurveIntervalExtractionResult;
  boundary?: IntervalBoundary;
  clearPoleBodyId?: string;
}
interface CurveKnotBoundary { bodyId: string }
interface CurveKnotBinding {
  bodyId: string; reference: CadGeometryReferenceV0; source: string; curve: Curve; domain: [number, number];
  baseGeneration: number; baseDisplayGeneration: number; view: CadEditorView;
}
interface CurveKnotPreparation {
  insertion?: SourceCurveKnotInsertionResult;
  boundary?: CurveKnotBoundary;
  clearPoleBodyId?: string;
}
interface SurfaceKnotBoundary { bodyId: string }
interface SurfaceKnotBinding {
  bodyId: string; reference: CadGeometryReferenceV0; source: string; surface: Surface;
  domains: { u: [number, number]; v: [number, number] }; axis: 'u' | 'v';
  baseGeneration: number; baseDisplayGeneration: number; view: CadEditorView;
}
interface SurfaceKnotPreparation {
  insertion?: SourceSurfaceKnotInsertionResult;
  boundary?: SurfaceKnotBoundary;
  clearPoleBodyId?: string;
}
interface HistoryState { document: CadDocumentV1; bytes: number; nativeNames?: string[]; duplicateBoundary?: DuplicateBoundary; surfaceIsoCurveBoundary?: SurfaceIsoCurveBoundary;
  intervalBoundary?: IntervalBoundary; surfaceKnotBoundary?: SurfaceKnotBoundary; curveKnotBoundary?: CurveKnotBoundary }
interface Prepared {
  candidate: CadEditorCandidate; historyIndex?: number;
  selectionTarget?: CadEditorSelectionTarget | null; transitionToken?: string;
  structuralPresentation?: Presentation; duplicateBoundary?: DuplicateBoundary;
  surfaceIsoCurveBoundary?: SurfaceIsoCurveBoundary; structuralBodyOnly?: boolean;
  intervalBoundary?: IntervalBoundary; clearCurvePoleBodyId?: string;
  surfaceKnotBoundary?: SurfaceKnotBoundary; clearSurfacePoleBodyId?: string;
  curveKnotBoundary?: CurveKnotBoundary;
}

/** Create an owned source-authoritative editor. No renderer or browser resources are created. */
export function createCadEditorSession(initialDocument: CadDocumentV1, options?: CadEditorSessionOptions): CadEditorSession {
  let accepted = admit(native(() => createCadDocument(initialDocument), 'Initial native document creation failed.'));
  const initialConfiguration = sessionConfiguration(accepted, options);
  let displayBodyIds = initialConfiguration.displayBodyIds;
  let view = initialConfiguration.view;
  let editTarget: CadEditorEditTarget = 'pole';
  let rotationAxis: CadEditorRotationAxis = 'z';
  let scaleAxis: CadEditorScaleAxis = 'uniform';
  let bodyCapabilities = capabilities(accepted);
  const sessionId = ++sessionSequence;
  let tokenSequence = 0;
  let generation = 0;
  let displayGeneration = 0;
  let disposed = false;
  let selectedBodyId: string | null = null;
  let selection: CadEditorSelectedPole | null = null;
  let curveSelection: CadEditorSelectedCurvePole | null = null;
  let selectionTransition: CadEditorSelectionTransition | null = null;
  let pending: CadEditorSnapshot['pending'] = {};
  let intervalBinding: IntervalBinding | null = null;
  let surfaceKnotBinding: SurfaceKnotBinding | null = null;
  let curveKnotBinding: CurveKnotBinding | null = null;
  let surfaceIsoCurveBinding: SurfaceIsoCurveBinding | null = null;
  let prepared: Prepared | null = null;
  let history: HistoryState[] = [{ document: copy(accepted.document), bytes: fileBudget(serialize(accepted)),
    nativeNames: accepted.compiledAssets.flatMap(asset => [asset.model.name, ...asset.model.objects.map(geometry => geometry.id)]) }];
  let historyIndex = 0;
  const assetRevisionHighWater = new Map(accepted.document.assets.map(asset => [asset.id, asset.revision]));
  let dirty = true;
  let downloadStatus: CadEditorSnapshot['downloadStatus'] = 'Not downloaded';
  let download: { token: string; generation: number } | null = null;
  let lastProvenance: CadEditorSnapshot['lastProvenance'] = [];
  let lastCurveProvenance: CadEditorSnapshot['lastCurveProvenance'] = [];
  let lastBodyTranslation: CadEditorSnapshot['lastBodyTranslation'] = null;
  let lastBodyRotation: CadEditorSnapshot['lastBodyRotation'] = null;
  let lastBodyScale: CadEditorSnapshot['lastBodyScale'] = null;
  let lastCurveInterval: CadEditorSnapshot['lastCurveInterval'] = null;
  let lastSurfaceKnot: CadEditorSnapshot['lastSurfaceKnot'] = null;
  let lastCurveKnot: CadEditorSnapshot['lastCurveKnot'] = null;
  let lastSurfaceIsoCurve: CadEditorSnapshot['lastSurfaceIsoCurve'] = null;
  const listeners = new Set<() => void>();

  const live = () => requireEditor(!disposed, 'LIFECYCLE', 'The editor session is disposed.');
  const emit = () => {
    for (const listener of [...listeners]) {
      // A subscriber cannot turn an already committed transaction into a refusal.
      try { listener(); } catch { /* Subscriber errors belong to the subscriber. */ }
    }
  };
  const invalidatePrepared = () => {
    if (prepared !== null) { prepared = null; emit(); }
  };
  const newToken = () => `cad-editor-${sessionId}-${++tokenSequence}`;
  const historyBytes = () => history.reduce((total, state) => total + state.bytes, 0);
  const snapshot = (): CadEditorSnapshot => copy({
    accepted, generation, displayGeneration, displayBodyIds, view, editTarget, rotationAxis, scaleAxis, bodyCapabilities,
    selectedBodyId, selection, curveSelection, selectionTransition, pending, candidate: prepared?.candidate ?? null,
    history: { index: historyIndex, count: history.length, bytes: historyBytes(), canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 },
    dirty, downloadStatus, disposed, lastProvenance, lastCurveProvenance, lastBodyTranslation, lastBodyRotation, lastBodyScale, lastCurveInterval, lastSurfaceKnot, lastCurveKnot, lastSurfaceIsoCurve,
  });
  const select = (input: CadEditorSurfaceSelection, document = accepted): CadEditorSelectedPole => {
    const context = { documentId: document.document.documentId, bodyId: input?.bodyId, field: 'selection-transition' };
    requireEditor(input !== null && typeof input === 'object' && typeof input.bodyId === 'string', 'INPUT', 'Surface body selection is required.', context);
    const reference = native(() => createCadGeometryReference(document, { bodyId: input.bodyId }), 'Native body reference creation failed.', document.document.documentId, context).reference;
    const resolved = native(() => resolveCadGeometryReference(document, reference), 'Native body reference resolution failed.', document.document.documentId, context);
    requireEditor(resolved.geometry.kind === 'surface', 'UNSUPPORTED', 'Curve poles are read-only in this editor.', context);
    const surface = resolved.geometry;
    const countU = surface.controlPoints.length, countV = surface.controlPoints[0].length;
    requireEditor(Number.isInteger(input.uIndex) && input.uIndex >= 0 && input.uIndex < countU
      && Number.isInteger(input.vIndex) && input.vIndex >= 0 && input.vIndex < countV, 'INPUT', 'Pole indices must be inside the original Surface grid.', context);
    const point = surface.controlPoints[input.uIndex][input.vIndex];
    return { bodyId: input.bodyId, uIndex: input.uIndex, vIndex: input.vIndex, reference, countU, countV,
      accepted: { xMM: point[0], yMM: point[1], zMM: point[2], weight: surface.weights[input.uIndex][input.vIndex] } };
  };
  const resolveTarget = (input: CadEditorSelectionTarget, document = accepted) => {
    const context: CadEditorError['context'] = { documentId: document.document.documentId, field: 'selection-transition' };
    const data = ownFields(input, ['bodyId', 'uIndex', 'vIndex', 'index', 'reference'], ['bodyId'], context);
    requireEditor(typeof data.bodyId === 'string', 'INPUT', 'Select an existing document body.', context);
    const bodyId = data.bodyId;
    context.bodyId = bodyId;
    requireEditor(document.document.bodies.some(body => body.id === bodyId), 'INPUT', 'The selected body is missing.', context);
    const reference = data.reference === undefined
      ? native(() => createCadGeometryReference(document, { bodyId }), 'Native body reference creation failed.', document.document.documentId, context).reference
      : native(() => resolveCadGeometryReference(document, data.reference as CadGeometryReferenceV0), 'Native selection reference resolution failed.', document.document.documentId, context).reference;
    requireEditor(reference.bodyId === bodyId, 'INPUT', 'The native reference must match the selected body.', context);
    const resolved = native(() => resolveCadGeometryReference(document, reference), 'Native body reference resolution failed.', document.document.documentId, context);
    if (resolved.geometry.kind === 'curve') {
      requireEditor(data.uIndex === undefined && data.vIndex === undefined, 'INPUT', 'Curve selection uses a Point index, not U/V.', context);
      const index = data.index === undefined ? (curveSelection?.bodyId === bodyId ? curveSelection.index : 0) : data.index;
      const curve = resolved.geometry, count = curve.controlPoints.length;
      requireEditor(typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < count,
        'INPUT', 'Point index must be inside the original Curve.', context);
      const point = curve.controlPoints[index];
      const curvePole: CadEditorSelectedCurvePole = { bodyId, index, reference, count,
        accepted: { xMM: point[0], yMM: point[1], zMM: point[2], weight: curve.weights[index] } };
      return { target: { bodyId, index, reference } satisfies CadEditorSelectionTarget, pole: null, curvePole };
    }
    requireEditor(data.index === undefined && (data.uIndex === undefined) === (data.vIndex === undefined),
      'INPUT', 'Surface selection uses both U/V indices, not a Curve Point index.', context);
    const uIndex = data.uIndex === undefined ? (selection?.bodyId === bodyId ? selection.uIndex : 0) : data.uIndex;
    const vIndex = data.vIndex === undefined ? (selection?.bodyId === bodyId ? selection.vIndex : 0) : data.vIndex;
    requireEditor(typeof uIndex === 'number' && typeof vIndex === 'number', 'INPUT', 'Surface indices must be numbers.', context);
    const pole = select({ bodyId, uIndex, vIndex }, document);
    return { target: { bodyId, uIndex, vIndex, reference } satisfies CadEditorSelectionTarget, pole, curvePole: null };
  };
  const logicalTarget = (target: CadEditorSelectionTarget): CadEditorSelectionTarget => {
    if (target.index !== undefined) return { bodyId: target.bodyId, index: target.index };
    if (target.uIndex !== undefined && target.vIndex !== undefined)
      return { bodyId: target.bodyId, uIndex: target.uIndex, vIndex: target.vIndex };
    return { bodyId: target.bodyId };
  };
  const currentPresentation = (): Presentation => ({
    displayBodyIds: copy(displayBodyIds), view: copy(view), editTarget, rotationAxis, scaleAxis,
    selectionTarget: selectedBodyId === null ? null : selection !== null
      ? { bodyId: selectedBodyId, uIndex: selection.uIndex, vIndex: selection.vIndex }
      : curveSelection !== null ? { bodyId: selectedBodyId, index: curveSelection.index } : { bodyId: selectedBodyId },
  });
  const switchTarget = (input: CadEditorSelectionTarget) => {
    const resolved = resolveTarget(input);
    selectedBodyId = resolved.target.bodyId; selection = resolved.pole; curveSelection = resolved.curvePole;
  };
  const requestSelection = (input: CadEditorSelectionTarget): CadEditorSelectionTransition | null => {
    live();
    const resolved = resolveTarget(input);
    if (resolved.target.bodyId === selectedBodyId && (resolved.curvePole !== null
      ? curveSelection !== null && curveSelection.index === resolved.curvePole.index
      : selection !== null && resolved.pole !== null && selection.uIndex === resolved.pole.uIndex && selection.vIndex === resolved.pole.vIndex)) return null;
    requireEditor(!(hasIntervalRaw() && resolved.target.bodyId === selectedBodyId), 'INPUT',
      'Apply or discard the interval before selecting another original point on this Curve.',
      { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'curve-interval' });
    requireEditor(!(hasSurfaceKnotRaw() && resolved.target.bodyId === selectedBodyId), 'INPUT',
      'Apply or discard the knot before selecting another original pole on this Surface.', surfaceKnotContext());
    requireEditor(!(hasCurveKnotRaw() && resolved.target.bodyId === selectedBodyId), 'INPUT',
      'Apply or discard the knot before selecting another original point on this Curve.', curveKnotContext());
    requireEditor(!(hasSurfaceIsoCurveRaw() && resolved.target.bodyId === selectedBodyId), 'INPUT',
      'Apply or discard the iso-Curve before selecting another pole on this Surface.', surfaceIsoCurveContext());
    prepared = null;
    if (Object.keys(pending).length > 0) {
      selectionTransition = { token: newToken(), baseGeneration: generation, target: copy(resolved.target) };
      const returned = copy(selectionTransition); emit(); return returned;
    }
    selectedBodyId = resolved.target.bodyId; selection = resolved.pole; curveSelection = resolved.curvePole;
    selectionTransition = null; emit(); return null;
  };
  const requireResolvedDraft = () => requireEditor(Object.keys(pending).length === 0 && selectionTransition === null,
    'INPUT', 'Apply or discard the draft before Open or history.',
    { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'selection-transition' });
  const intervalContext = (): CadEditorError['context'] => ({ documentId: accepted.document.documentId,
    bodyId: selectedBodyId ?? undefined, field: 'curve-interval' });
  const hasIntervalRaw = () => Object.hasOwn(pending, 'intervalMin') || Object.hasOwn(pending, 'intervalMax');
  const surfaceKnotContext = (): CadEditorError['context'] => ({ documentId: accepted.document.documentId,
    bodyId: selectedBodyId ?? undefined, field: 'surface-knot' });
  const hasSurfaceKnotRaw = () => Object.hasOwn(pending, 'surfaceKnotU') || Object.hasOwn(pending, 'surfaceKnotV');
  const curveKnotContext = (): CadEditorError['context'] => ({ documentId: accepted.document.documentId,
    bodyId: selectedBodyId ?? undefined, field: 'curve-knot' });
  const hasCurveKnotRaw = () => Object.hasOwn(pending, 'curveKnot');
  const surfaceIsoCurveContext = (): CadEditorError['context'] => ({ documentId: accepted.document.documentId,
    bodyId: selectedBodyId ?? undefined, field: 'surface-isocurve' });
  const hasSurfaceIsoCurveRaw = () => Object.hasOwn(pending, 'surfaceIsoU') || Object.hasOwn(pending, 'surfaceIsoV');
  const requireNoIntervalDraft = () => {
    requireEditor(!hasSurfaceIsoCurveRaw(), 'INPUT',
      'Apply or discard the iso-Curve before entering other object or pole fields.', surfaceIsoCurveContext());
    requireEditor(!hasIntervalRaw(), 'INPUT',
      'Apply or discard the interval before entering other object or pole fields.', intervalContext());
    requireEditor(!hasSurfaceKnotRaw(), 'INPUT',
      'Apply or discard the knot before entering other object or pole fields.', surfaceKnotContext());
    requireEditor(!hasCurveKnotRaw(), 'INPUT',
      'Apply or discard the knot before entering other object or pole fields.', curveKnotContext());
  };
  const intervalNative = <T>(action: () => T, message: string): T => {
    try { return action(); } catch (cause) {
      if (cause instanceof CadEditorError) throw cause;
      const code = cause instanceof CadReferenceError && cause.code === CadReferenceDiagnosticCode.STALE ? 'STALE'
        : (cause instanceof SourceCurveIntervalExtractionError || cause instanceof CadDocumentError) && cause.code === 'BUDGET' ? 'BUDGET' : 'NATIVE';
      throw new CadEditorError(code, message, intervalContext(), cause);
    }
  };
  const intervalBodyReference = () => {
    const context = intervalContext();
    requireEditor(editTarget === 'pole', 'INPUT', 'Select Control point before restricting an interval.', context);
    requireEditor(selectedBodyId !== null && (view.kind === 'document'
      || view.kind === 'curve-focus' && view.bodyId === selectedBodyId),
      'DISPLAY', 'Select an original Curve in document view or its matching focused view.', context);
    const reference = intervalNative(() => createCadGeometryReference(accepted, { bodyId: selectedBodyId! }),
      'Native interval body reference creation failed.').reference;
    const resolved = intervalNative(() => resolveCadGeometryReference(accepted, reference), 'Native interval body resolution failed.');
    requireEditor(resolved.geometry.kind === 'curve', 'UNSUPPORTED', 'Interval restriction requires an original Curve.', context);
    return { reference: resolved.reference, geometry: resolved.geometry, source: resolved.source };
  };
  const captureInterval = (): IntervalBinding => {
    const resolved = intervalBodyReference();
    return { bodyId: resolved.reference.bodyId, reference: copy(resolved.reference), source: resolved.source,
      curve: copy(resolved.geometry), domain: intervalNative(() => curveDomain(resolved.geometry), 'Native original Curve domain query failed.'),
      baseGeneration: generation, baseDisplayGeneration: displayGeneration, view: copy(view) };
  };
  const currentInterval = (binding: IntervalBinding) => {
    const context = intervalContext();
    requireEditor(editTarget === 'pole' && selectedBodyId === binding.bodyId
      && binding.baseGeneration === generation && binding.baseDisplayGeneration === displayGeneration
      && (view.kind === 'document' && binding.view.kind === 'document'
        || view.kind === 'curve-focus' && binding.view.kind === 'curve-focus'
          && view.bodyId === binding.bodyId && view.bodyId === binding.view.bodyId && view.count === binding.view.count),
    'STALE', 'The interval body or view changed. Review the pending parameters.', context);
    const resolved = intervalNative(() => resolveCadGeometryReference(accepted, binding.reference), 'Native bound interval reference resolution failed.');
    requireEditor(resolved.source === binding.source && resolved.geometry.kind === 'curve', 'STALE',
      'The interval must remain bound to the original complete source.', context);
  };
  const surfaceKnotNative = <T>(action: () => T, message: string): T => {
    try { return action(); } catch (cause) {
      if (cause instanceof CadEditorError) throw cause;
      const code = cause instanceof CadReferenceError && cause.code === CadReferenceDiagnosticCode.STALE ? 'STALE'
        : (cause instanceof SourceSurfaceKnotInsertionError || cause instanceof CadDocumentError) && cause.code === 'BUDGET' ? 'BUDGET' : 'NATIVE';
      throw new CadEditorError(code, message, surfaceKnotContext(), cause);
    }
  };
  const captureSurfaceKnot = (axis: 'u' | 'v'): SurfaceKnotBinding => {
    const context = surfaceKnotContext();
    requireEditor(editTarget === 'pole', 'INPUT', 'Select Control point before inserting a knot.', context);
    requireEditor(selectedBodyId !== null && view.kind === 'document', 'DISPLAY',
      'Select an original Surface in document view before inserting a knot.', context);
    const reference = surfaceKnotNative(() => createCadGeometryReference(accepted, { bodyId: selectedBodyId! }),
      'Native knot body reference creation failed.').reference;
    const resolved = surfaceKnotNative(() => resolveCadGeometryReference(accepted, reference),
      'Native knot body resolution failed.');
    requireEditor(resolved.geometry.kind === 'surface', 'UNSUPPORTED', 'Knot insertion requires an original Surface.', context);
    const surface = resolved.geometry;
    return { bodyId: resolved.reference.bodyId, reference: copy(resolved.reference), source: resolved.source,
      surface: copy(surface), domains: surfaceKnotNative(() => surfaceDomain(surface),
        'Native original Surface domain query failed.'), axis,
      baseGeneration: generation, baseDisplayGeneration: displayGeneration, view: copy(view) };
  };
  const currentSurfaceKnot = (binding: SurfaceKnotBinding) => {
    const context = surfaceKnotContext();
    requireEditor(editTarget === 'pole' && selectedBodyId === binding.bodyId
      && binding.baseGeneration === generation && binding.baseDisplayGeneration === displayGeneration
      && view.kind === 'document' && binding.view.kind === 'document', 'STALE',
    'The knot body or document view changed. Review the pending parameter.', context);
    const resolved = surfaceKnotNative(() => resolveCadGeometryReference(accepted, binding.reference),
      'Native bound knot reference resolution failed.');
    requireEditor(resolved.source === binding.source && resolved.geometry.kind === 'surface', 'STALE',
      'The knot must remain bound to the original complete Surface source.', context);
  };
  const curveKnotNative = <T>(action: () => T, message: string): T => {
    try { return action(); } catch (cause) {
      if (cause instanceof CadEditorError) throw cause;
      const code = cause instanceof CadReferenceError && cause.code === CadReferenceDiagnosticCode.STALE ? 'STALE'
        : (cause instanceof SourceCurveKnotInsertionError || cause instanceof CadDocumentError) && cause.code === 'BUDGET' ? 'BUDGET'
          : cause instanceof SourceCurveKnotInsertionError && cause.code === 'FILE' ? 'FILE' : 'NATIVE';
      throw new CadEditorError(code, message, curveKnotContext(), cause);
    }
  };
  const captureCurveKnot = (): CurveKnotBinding => {
    const context = curveKnotContext();
    requireEditor(editTarget === 'pole', 'INPUT', 'Select Control point before inserting a knot.', context);
    requireEditor(selectedBodyId !== null && (view.kind === 'document'
      || view.kind === 'curve-focus' && view.bodyId === selectedBodyId), 'DISPLAY',
      'Select an original Curve in document view or its matching focused view.', context);
    const reference = curveKnotNative(() => createCadGeometryReference(accepted, { bodyId: selectedBodyId! }),
      'Native knot body reference creation failed.').reference;
    const resolved = curveKnotNative(() => resolveCadGeometryReference(accepted, reference),
      'Native knot body resolution failed.');
    const curve = resolved.geometry;
    requireEditor(curve.kind === 'curve', 'UNSUPPORTED', 'Knot insertion requires an original Curve.', context);
    return { bodyId: resolved.reference.bodyId, reference: copy(resolved.reference), source: resolved.source,
      curve: copy(curve), domain: curveKnotNative(() => curveDomain(curve),
        'Native original Curve domain query failed.'),
      baseGeneration: generation, baseDisplayGeneration: displayGeneration, view: copy(view) };
  };
  const currentCurveKnot = (binding: CurveKnotBinding) => {
    const context = curveKnotContext();
    requireEditor(editTarget === 'pole' && selectedBodyId === binding.bodyId
      && binding.baseGeneration === generation && binding.baseDisplayGeneration === displayGeneration
      && (view.kind === 'document' && binding.view.kind === 'document'
        || view.kind === 'curve-focus' && binding.view.kind === 'curve-focus'
          && view.bodyId === binding.bodyId && view.bodyId === binding.view.bodyId && view.count === binding.view.count),
    'STALE', 'The knot body or view changed. Review the pending parameter.', context);
    const resolved = curveKnotNative(() => resolveCadGeometryReference(accepted, binding.reference),
      'Native bound knot reference resolution failed.');
    requireEditor(resolved.source === binding.source && resolved.geometry.kind === 'curve', 'STALE',
      'The knot must remain bound to the original complete Curve source.', context);
  };
  const surfaceIsoCurveNative = <T>(action: () => T, message: string): T => {
    try { return action(); } catch (cause) {
      if (cause instanceof CadEditorError) throw cause;
      const code = cause instanceof CadReferenceError && cause.code === CadReferenceDiagnosticCode.STALE ? 'STALE'
        : cause instanceof CadDocumentError && cause.code === 'BUDGET' ? 'BUDGET' : 'NATIVE';
      throw new CadEditorError(code, message, surfaceIsoCurveContext(), cause);
    }
  };
  const captureSurfaceIsoCurve = (axis: CadEditorSurfaceIsoCurveAxis): SurfaceIsoCurveBinding => {
    const context = surfaceIsoCurveContext();
    requireEditor(editTarget === 'pole', 'INPUT', 'Select Control point before creating an iso-Curve.', context);
    requireEditor(selectedBodyId !== null && view.kind === 'document', 'DISPLAY',
      'Select an original Surface in document view before creating an iso-Curve.', context);
    const reference = surfaceIsoCurveNative(() => createCadGeometryReference(accepted, { bodyId: selectedBodyId! }),
      'Native iso-Curve source reference creation failed.').reference;
    const resolved = surfaceIsoCurveNative(() => resolveCadGeometryReference(accepted, reference),
      'Native iso-Curve source resolution failed.');
    const surface = resolved.geometry;
    requireEditor(surface.kind === 'surface', 'UNSUPPORTED', 'Iso-Curve construction requires an original Surface.', context);
    return { bodyId: reference.bodyId, reference: copy(reference), source: resolved.source, surface: copy(surface),
      domains: surfaceIsoCurveNative(() => surfaceDomain(surface), 'Native original Surface domain query failed.'),
      axis, baseGeneration: generation, baseDisplayGeneration: displayGeneration, view: copy(view) };
  };
  const currentSurfaceIsoCurve = (binding: SurfaceIsoCurveBinding) => {
    const context = surfaceIsoCurveContext();
    requireEditor(editTarget === 'pole' && selectedBodyId === binding.bodyId
      && binding.baseGeneration === generation && binding.baseDisplayGeneration === displayGeneration
      && view.kind === 'document' && binding.view.kind === 'document', 'STALE',
      'The iso-Curve source body or view changed. Review the parameter.', context);
    const resolved = surfaceIsoCurveNative(() => resolveCadGeometryReference(accepted, binding.reference),
      'Native bound iso-Curve source resolution failed.');
    requireEditor(resolved.source === binding.source && resolved.geometry.kind === 'surface', 'STALE',
      'The iso-Curve must remain bound to the original complete Surface source.', context);
  };
  const requireEditable = () => {
    const context = { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'edit-capability' };
    requireEditor(selectedBodyId !== null, 'INPUT', 'Select an editable Surface body first.', context);
    const capability = bodyCapabilities.find(body => body.bodyId === selectedBodyId);
    requireEditor(capability?.canEditSurfacePole === true, 'UNSUPPORTED', 'This selection is outside the Surface pole edit profile.', context);
  };
  const requireCurveEditable = () => {
    const context = { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'curve-pole' };
    requireEditor(curveSelection !== null, 'INPUT', 'Select an original Curve Point first.', context);
    requireEditor(bodyCapabilities.find(body => body.bodyId === curveSelection!.bodyId)?.canEditCurvePole === true,
      'UNSUPPORTED', 'This Curve is outside the native pole edit profile.', context);
  };
  const requireBodyTransformEditable = (operation: 'translation' | 'rotation' | 'scale') => {
    const context = { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: `body-${operation}` };
    const selected = selection ?? curveSelection;
    requireEditor(selected !== null && selected.bodyId === selectedBodyId, 'INPUT', 'Select an original object first.', context);
    const capability = bodyCapabilities.find(body => body.bodyId === selected.bodyId);
    requireEditor((operation === 'scale' ? capability?.canScaleBody : operation === 'rotation' ? capability?.canRotateBody : capability?.canTranslateBody) === true,
      'UNSUPPORTED', `This object is outside the native ${operation} profile.`, context);
    return native(() => resolveCadGeometryReference(accepted, selected.reference),
      `Native object ${operation} reference resolution failed.`, accepted.document.documentId, context);
  };
  const prepare = (kind: CadEditorCandidate['kind'], result: CadDocumentResult,
    provenance: CadEditorCandidate['provenance'] = [], targetIndex?: number,
    postSelection?: CadEditorSelectionTransition, candidateDisplayIds = displayBodyIds, candidateView = view,
    curveProvenance: CadEditorCandidate['curveProvenance'] = [],
    bodyTranslation: CadEditorCandidate['bodyTranslation'] = null,
    bodyRotation: CadEditorCandidate['bodyRotation'] = null,
    bodyScale: CadEditorCandidate['bodyScale'] = null,
    structural?: { presentation: Presentation; duplicateBoundary?: DuplicateBoundary;
      surfaceIsoCurveBoundary?: SurfaceIsoCurveBoundary; surfaceIsoCurve?: CadEditorSurfaceIsoCurveCreation; preserveBodyOnly?: true },
    interval?: IntervalPreparation, surfaceKnot?: SurfaceKnotPreparation, curveKnot?: CurveKnotPreparation): CadEditorCandidate => {
    if (interval?.clearPoleBodyId !== undefined) {
      const reference = native(() => createCadGeometryReference(result, { bodyId: interval.clearPoleBodyId! }),
        'Native interval presentation reference creation failed.', result.document.documentId, { field: 'curve-interval' }).reference;
      const resolved = native(() => resolveCadGeometryReference(result, reference),
        'Native interval presentation body resolution failed.', result.document.documentId, { field: 'curve-interval' });
      requireEditor(resolved.geometry.kind === 'curve', 'STALE', 'The interval must retain the original Curve body.',
        { documentId: result.document.documentId, bodyId: interval.clearPoleBodyId, field: 'curve-interval' });
    }
    if (surfaceKnot?.clearPoleBodyId !== undefined) {
      const context = { documentId: result.document.documentId, bodyId: surfaceKnot.clearPoleBodyId, field: 'surface-knot' };
      const reference = native(() => createCadGeometryReference(result, { bodyId: surfaceKnot.clearPoleBodyId! }),
        'Native knot presentation reference creation failed.', result.document.documentId, context).reference;
      const resolved = native(() => resolveCadGeometryReference(result, reference),
        'Native knot presentation body resolution failed.', result.document.documentId, context);
      requireEditor(resolved.geometry.kind === 'surface', 'STALE', 'The knot must retain its original Surface body.', context);
    }
    if (curveKnot?.clearPoleBodyId !== undefined) {
      const context = { documentId: result.document.documentId, bodyId: curveKnot.clearPoleBodyId, field: 'curve-knot' };
      const reference = native(() => createCadGeometryReference(result, { bodyId: curveKnot.clearPoleBodyId! }),
        'Native knot presentation reference creation failed.', result.document.documentId, context).reference;
      const resolved = native(() => resolveCadGeometryReference(result, reference),
        'Native knot presentation body resolution failed.', result.document.documentId, context);
      requireEditor(resolved.geometry.kind === 'curve', 'STALE', 'The knot must retain its original Curve body.', context);
    }
    const structuralTarget = structural?.presentation.selectionTarget;
    // Only the known iso-Curve boundary retains absent pole indices literally.
    // Duplicate and ordinary selection normalization keep their existing policy.
    const structuralBodyOnly = structural?.preserveBodyOnly === true && structuralTarget != null
      && structuralTarget.index === undefined && structuralTarget.uIndex === undefined && structuralTarget.vIndex === undefined;
    if (structuralBodyOnly && structuralTarget != null) native(() => createCadGeometryReference(result, { bodyId: structuralTarget.bodyId }),
      'Native construction body-only reference creation failed.', result.document.documentId, { field: 'surface-isocurve' });
    const proposed = structural === undefined ? undefined : {
      ...copy(structural.presentation),
      displayBodyIds: displayIds(result, structural.presentation.displayBodyIds),
      view: viewFor(result, structural.presentation.view),
      selectionTarget: structural.presentation.selectionTarget === null ? null
        : structuralBodyOnly ? { bodyId: structural.presentation.selectionTarget.bodyId }
          : logicalTarget(resolveTarget(structural.presentation.selectionTarget, result).target),
    };
    prepared = { candidate: { kind, result, provenance, curveProvenance, bodyTranslation, bodyRotation, bodyScale, token: newToken(), baseGeneration: generation,
      baseDisplayGeneration: displayGeneration, displayBodyIds: copy(proposed?.displayBodyIds ?? candidateDisplayIds), view: copy(proposed?.view ?? candidateView),
      ...(proposed === undefined ? {} : { selectionTarget: copy(proposed.selectionTarget), presentation: 'structural' as const }),
      ...(structural?.surfaceIsoCurve === undefined ? {} : { surfaceIsoCurve: structural.surfaceIsoCurve }),
      ...(interval?.extraction === undefined ? {} : { curveInterval: interval.extraction }),
      ...(curveKnot?.insertion === undefined ? {} : { curveKnot: curveKnot.insertion }),
      ...(surfaceKnot?.insertion === undefined ? {} : { surfaceKnot: surfaceKnot.insertion }),
      ...(surfaceKnot?.clearPoleBodyId === undefined ? {} : { selectionTarget: { bodyId: surfaceKnot.clearPoleBodyId }, clearSurfacePoleSelection: true as const }),
      ...(interval?.clearPoleBodyId === undefined ? {} : { selectionTarget: { bodyId: interval.clearPoleBodyId }, clearCurvePoleSelection: true as const }),
      ...(curveKnot?.clearPoleBodyId === undefined ? {} : { selectionTarget: { bodyId: curveKnot.clearPoleBodyId }, clearCurvePoleSelection: true as const }),
    }, historyIndex: targetIndex,
      selectionTarget: surfaceKnot?.clearPoleBodyId !== undefined ? { bodyId: surfaceKnot.clearPoleBodyId }
        : curveKnot?.clearPoleBodyId !== undefined ? { bodyId: curveKnot.clearPoleBodyId }
        : interval?.clearPoleBodyId !== undefined ? { bodyId: interval.clearPoleBodyId }
        : proposed !== undefined ? copy(proposed.selectionTarget) : postSelection === undefined ? undefined : {
        bodyId: postSelection.target.bodyId, uIndex: postSelection.target.uIndex, vIndex: postSelection.target.vIndex, index: postSelection.target.index,
      }, transitionToken: postSelection?.token,
      structuralPresentation: proposed, duplicateBoundary: copy(structural?.duplicateBoundary),
      surfaceIsoCurveBoundary: copy(structural?.surfaceIsoCurveBoundary), structuralBodyOnly,
      intervalBoundary: copy(interval?.boundary), clearCurvePoleBodyId: curveKnot?.clearPoleBodyId ?? interval?.clearPoleBodyId,
      curveKnotBoundary: copy(curveKnot?.boundary),
      surfaceKnotBoundary: copy(surfaceKnot?.boundary), clearSurfacePoleBodyId: surfaceKnot?.clearPoleBodyId };
    const returned = copy(prepared.candidate);
    emit();
    return returned;
  };
  const restore = (direction: -1 | 1): CadEditorCandidate => {
    live();
    requireResolvedDraft();
    invalidatePrepared();
    const targetIndex = historyIndex + direction;
    requireEditor(targetIndex >= 0 && targetIndex < history.length, 'INPUT', 'This history direction is unavailable.');
    const target = history[targetIndex].document;
    const duplicateBoundary = direction < 0 ? history[historyIndex].duplicateBoundary : history[targetIndex].duplicateBoundary;
    const isoBoundary = direction < 0 ? history[historyIndex].surfaceIsoCurveBoundary : history[targetIndex].surfaceIsoCurveBoundary;
    const boundary = duplicateBoundary ?? isoBoundary;
    if (boundary !== undefined) {
      const context = { documentId: accepted.document.documentId, field: isoBoundary === undefined ? 'body-duplicate' : 'surface-isocurve' };
      const document = copy(target);
      document.revision = nextRevision(accepted.document.revision, context);
      for (const body of accepted.document.bodies) {
        const prior = target.bodies.find(value => value.id === body.id);
        if (prior !== undefined) requireEditor(prior.kind === body.kind && prior.assetId === body.assetId
          && prior.geometryId === body.geometryId, 'STALE', 'Structural history body binding does not match.',
        { ...context, bodyId: body.id });
      }
      document.assets = target.assets.map(prior => {
        const current = accepted.document.assets.find(asset => asset.id === prior.id);
        if (current === undefined) {
          const highWater = assetRevisionHighWater.get(prior.id);
          requireEditor(highWater !== undefined, 'STALE', 'The structural history asset revision is missing.', context);
          return { ...prior, revision: nextRevision(highWater, context) };
        }
        requireEditor(current.role === prior.role && current.sourceVersion === prior.sourceVersion
          && current.sourceFrame === prior.sourceFrame, 'STALE', 'Structural history asset metadata does not match.', context);
        return prior.source === current.source ? copy(current)
          : { ...current, source: prior.source, revision: nextRevision(current.revision, context) };
      });
      const result = admit(native(() => createCadDocument(document), 'Native structural history reconstruction failed.',
        document.documentId, context), context);
      const presentation = copy(direction < 0 ? boundary.before : boundary.after);
      return prepare(direction < 0 ? 'undo' : 'redo', result, [], targetIndex, undefined,
        presentation.displayBodyIds, presentation.view, [], null, null, null,
        { presentation, ...(isoBoundary === undefined ? {} : { preserveBodyOnly: true as const }) });
    }
    const document = copy(accepted.document);
    document.revision = nextRevision(document.revision);
    const context = { documentId: document.documentId, field: 'body-name' };
    requireEditor(document.bodies.length === target.bodies.length, 'STALE', 'History body inventory does not match the accepted document.', context);
    document.bodies = document.bodies.map((body, index) => {
      const prior = target.bodies[index];
      requireEditor(prior.id === body.id && prior.kind === body.kind && prior.assetId === body.assetId
        && prior.geometryId === body.geometryId, 'STALE', 'History body binding does not match the accepted document.',
        { ...context, bodyId: body.id });
      return { ...body, name: prior.name };
    });
    document.assets = document.assets.map(asset => {
      const prior = target.assets.find(value => value.id === asset.id);
      requireEditor(prior !== undefined, 'STALE', 'History asset identity does not match the accepted document.');
      return prior.source === asset.source ? asset : { ...asset, source: prior.source, revision: nextRevision(asset.revision) };
    });
    const result = admit(native(() => createCadDocument(document), 'Native history reconstruction failed.', document.documentId));
    const intervalBoundary = direction < 0 ? history[historyIndex].intervalBoundary : history[targetIndex].intervalBoundary;
    const surfaceKnotBoundary = direction < 0 ? history[historyIndex].surfaceKnotBoundary : history[targetIndex].surfaceKnotBoundary;
    const curveKnotBoundary = direction < 0 ? history[historyIndex].curveKnotBoundary : history[targetIndex].curveKnotBoundary;
    return prepare(direction < 0 ? 'undo' : 'redo', result, [], targetIndex, undefined, displayBodyIds, view, [], null, null, null,
      undefined, intervalBoundary !== undefined && selectedBodyId === intervalBoundary.bodyId
        ? { clearPoleBodyId: intervalBoundary.bodyId } : undefined,
      surfaceKnotBoundary !== undefined && selectedBodyId === surfaceKnotBoundary.bodyId
        ? { clearPoleBodyId: surfaceKnotBoundary.bodyId } : undefined,
      curveKnotBoundary !== undefined && selectedBodyId === curveKnotBoundary.bodyId
        ? { boundary: curveKnotBoundary, clearPoleBodyId: curveKnotBoundary.bodyId } : undefined);
  };
  const pendingValues = (bodyId: string, curve = false, translation = false): Partial<Record<CadEditorPoleField, number>> => {
    const values: Partial<Record<CadEditorPoleField, number>> = {};
    for (const field of FIELDS) if (Object.hasOwn(pending, field)) {
      const text = pending[field]!.trim();
      const context = { documentId: accepted.document.documentId, bodyId, field: translation ? 'body-translation' : curve ? 'curve-pole' : field };
      requireEditor(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text), 'INPUT', translation ? 'Translation offset must be a decimal or exponent number.' : 'Pole input must be a decimal or exponent number.', context);
      const value = Number(text);
      requireEditor(Number.isFinite(value), 'INPUT', translation ? 'Translation offset must be finite.' : 'Pole input must be finite.', context);
      values[field] = value;
    }
    return values;
  };
  const prepareApply = (): CadEditorCandidate | null => {
    live();
    // Coefficient history can retain a logical body while clearing its obsolete pole.
    if (Object.keys(pending).length === 0 && selectedBodyId !== null && selection === null && curveSelection === null) {
      const body = native(() => createCadGeometryReference(accepted, { bodyId: selectedBodyId! }),
        'Native body-only reference creation failed.', accepted.document.documentId);
      if (body.geometry.kind === 'surface' && view.kind === 'document'
        || body.geometry.kind === 'curve' && (view.kind === 'document'
          || view.kind === 'curve-focus' && view.bodyId === selectedBodyId)) return null;
    }
    if (hasSurfaceIsoCurveRaw()) {
      const context = surfaceIsoCurveContext();
      requireEditor(prepared === null, 'INPUT', 'Resolve the current candidate before creating an iso-Curve.', context);
      requireEditor(surfaceIsoCurveBinding !== null, 'STALE', 'The original Surface parameter binding is missing.', context);
      const binding = surfaceIsoCurveBinding, key = binding.axis === 'u' ? 'surfaceIsoU' : 'surfaceIsoV';
      requireEditor(Object.keys(pending).every(field => field === key) && Object.hasOwn(pending, key), 'INPUT',
        'Iso-Curve parameters cannot be mixed with other draft fields or axes.', context);
      currentSurfaceIsoCurve(binding);
      requireEditor(displayBodyIds.length < 4, 'BUDGET', 'Hide a body before creating an iso-Curve.', context);
      const text = pending[key]!.trim();
      requireEditor(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text), 'INPUT',
        'The iso-Curve parameter must be a decimal or exponent number.', context);
      const parameter = Number(text);
      requireEditor(Number.isFinite(parameter), 'INPUT', 'The iso-Curve parameter must be finite.', context);
      const before = currentPresentation(), document = copy(accepted.document);
      document.revision = nextRevision(document.revision, context);
      const reserved = new Set(history.flatMap(state => [
        ...(state.nativeNames ?? []),
        ...state.document.assets.map(asset => asset.id),
        ...state.document.bodies.flatMap(body => [body.id, body.geometryId]),
      ]));
      for (const asset of accepted.compiledAssets) {
        reserved.add(asset.model.name);
        for (const geometry of asset.model.objects) reserved.add(geometry.id);
      }
      const appended = surfaceIsoCurveNative(() => appendSurfaceIsoCurveSource(document, binding.surface,
        copy(binding.reference), binding.axis, parameter, [...reserved]), 'Native iso-Curve construction failed.');
      const result = surfaceIsoCurveNative(() => admit(createCadDocument(appended.document), context),
        'Native iso-Curve document admission failed.');
      const transition = selectionTransition;
      const after: Presentation = { ...copy(before), displayBodyIds: [...displayBodyIds, appended.creation.bodyId],
        selectionTarget: transition === null ? copy(before.selectionTarget) : logicalTarget(transition.target) };
      return prepare('surface-isocurve', result, [], undefined, transition ?? undefined, after.displayBodyIds, after.view,
        [], null, null, null, { presentation: after, surfaceIsoCurveBoundary: { before, after },
          surfaceIsoCurve: appended.creation, preserveBodyOnly: true });
    }
    if (hasCurveKnotRaw()) {
      const context = curveKnotContext();
      requireEditor(prepared === null, 'INPUT', 'Resolve the current candidate before inserting a knot.', context);
      requireEditor(curveKnotBinding !== null, 'STALE', 'The original knot binding is missing.', context);
      const binding = curveKnotBinding;
      requireEditor(Object.keys(pending).length === 1, 'INPUT',
        'Curve knot insertion cannot be mixed with other draft fields.', context);
      currentCurveKnot(binding);
      const text = pending.curveKnot!.trim();
      requireEditor(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text), 'INPUT',
        'Knot parameters must be decimal or exponent numbers.', context);
      const knot = Number(text);
      requireEditor(Number.isFinite(knot), 'INPUT', 'Knot parameters must be finite.', context);
      const insertion = curveKnotNative(() => insertCurveKnotSource(binding.source, binding.curve, knot),
        'Native complete-source Curve knot insertion failed.');
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision, context);
      document.assets = document.assets.map(asset => asset.id === binding.reference.assetId
        ? { ...asset, source: insertion.source, revision: nextRevision(asset.revision, context) } : asset);
      const result = curveKnotNative(() => {
        const result = createCadDocument(document);
        validateCadDocumentResult(result);
        fileBudget(serializeCadDocument(result.document), context);
        return result;
      }, 'Native refined Curve document admission failed.');
      const transition = selectionTransition;
      if (transition !== null && transition.target.bodyId === binding.bodyId && transition.target.index !== undefined)
        requireEditor(false, 'INPUT', 'Finish the knot before choosing another point on this Curve.', context);
      return prepare('curve-knot', result, [], undefined, transition ?? undefined, displayBodyIds, view, [], null, null, null,
        undefined, undefined, undefined, { insertion, boundary: { bodyId: binding.bodyId },
          ...(transition === null || transition.target.bodyId === binding.bodyId ? { clearPoleBodyId: binding.bodyId } : {}) });
    }
    if (hasSurfaceKnotRaw()) {
      const context = surfaceKnotContext();
      requireEditor(prepared === null, 'INPUT', 'Resolve the current candidate before inserting a knot.', context);
      requireEditor(surfaceKnotBinding !== null, 'STALE', 'The original knot binding is missing.', context);
      const binding = surfaceKnotBinding, key = binding.axis === 'u' ? 'surfaceKnotU' : 'surfaceKnotV';
      requireEditor(Object.keys(pending).length === 1 && Object.hasOwn(pending, key), 'INPUT',
        'One Surface knot axis cannot be mixed with other draft fields.', context);
      currentSurfaceKnot(binding);
      const text = pending[key]!.trim();
      requireEditor(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text), 'INPUT',
        'Knot parameters must be decimal or exponent numbers.', context);
      const knot = Number(text);
      requireEditor(Number.isFinite(knot), 'INPUT', 'Knot parameters must be finite.', context);
      const insertion = surfaceKnotNative(() => insertSurfaceKnotSource(binding.source, binding.surface, binding.axis, knot),
        'Native complete-source Surface knot insertion failed.');
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision, context);
      document.assets = document.assets.map(asset => asset.id === binding.reference.assetId
        ? { ...asset, source: insertion.source, revision: nextRevision(asset.revision, context) } : asset);
      const result = surfaceKnotNative(() => {
        const result = createCadDocument(document);
        validateCadDocumentResult(result);
        fileBudget(serializeCadDocument(result.document), context);
        return result;
      }, 'Native refined Surface document admission failed.');
      const transition = selectionTransition;
      if (transition !== null && transition.target.bodyId === binding.bodyId
        && (transition.target.uIndex !== undefined || transition.target.vIndex !== undefined))
        requireEditor(false, 'INPUT', 'Finish the knot before choosing another pole on this Surface.', context);
      return prepare('surface-knot', result, [], undefined, transition ?? undefined, displayBodyIds, view, [], null, null, null,
        undefined, undefined, { insertion, boundary: { bodyId: binding.bodyId },
          ...(transition === null || transition.target.bodyId === binding.bodyId ? { clearPoleBodyId: binding.bodyId } : {}) });
    }
    if (hasIntervalRaw()) {
      const context = intervalContext();
      requireEditor(prepared === null, 'INPUT', 'Resolve the current candidate before restricting the interval.', context);
      requireEditor(intervalBinding !== null && Object.keys(pending).every(key => key === 'intervalMin' || key === 'intervalMax'),
        'INPUT', 'Interval parameters cannot be mixed with other draft fields.', context);
      const binding = intervalBinding;
      currentInterval(binding);
      const bounds: [number, number] = [...binding.domain];
      for (const [key, index] of [['intervalMin', 0], ['intervalMax', 1]] as const) if (Object.hasOwn(pending, key)) {
        const text = pending[key]!.trim();
        requireEditor(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text),
          'INPUT', 'Interval parameters must be decimal or exponent numbers.', context);
        const value = Number(text);
        requireEditor(Number.isFinite(value), 'INPUT', 'Interval parameters must be finite.', context);
        bounds[index] = value;
      }
      const extraction = intervalNative(() => extractCurveIntervalSource(binding.source, binding.curve, bounds),
        'Native complete-source Curve interval restriction failed.');
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision, context);
      document.assets = document.assets.map(asset => asset.id === binding.reference.assetId
        ? { ...asset, source: extraction.source, revision: nextRevision(asset.revision, context) } : asset);
      const result = intervalNative(() => {
        const result = createCadDocument(document);
        validateCadDocumentResult(result);
        fileBudget(serializeCadDocument(result.document), context);
        return result;
      }, 'Native restricted Curve document admission failed.');
      const transition = selectionTransition;
      if (transition !== null && transition.target.bodyId === binding.bodyId && transition.target.index !== undefined)
        requireEditor(false, 'INPUT', 'Finish the interval before choosing a new point on this Curve.', context);
      return prepare('curve-interval', result, [], undefined, transition ?? undefined, displayBodyIds, view, [], null, null, null,
        undefined, { extraction, boundary: { bodyId: binding.bodyId },
          ...(transition === null || transition.target.bodyId === binding.bodyId ? { clearPoleBodyId: binding.bodyId } : {}) });
    }
    if (editTarget === 'scale') {
      const resolved = requireBodyTransformEditable('scale');
      const bodyId = resolved.reference.bodyId;
      const context = { documentId: accepted.document.documentId, bodyId, field: 'body-scale' };
      requireEditor(prepared === null, 'INPUT', 'Resolve the current candidate before scaling the object.', context);
      requireEditor(resolved.geometry.kind === 'curve'
        ? view.kind === 'document' || view.kind === 'curve-focus' && view.bodyId === bodyId : view.kind === 'document',
      'DISPLAY', resolved.geometry.kind === 'curve' ? 'Use document view or focus this Curve before scaling it.' : 'Return to document view before scaling this Surface.',
      { ...context, field: 'curve-focus' });
      const transition = selectionTransition;
      if (Object.keys(pending).length === 0) { emit(); return null; }
      requireEditor(Object.keys(pending).length === 1 && Object.hasOwn(pending, 'scaleFactor'), 'INPUT',
        'Object scale accepts a dimensionless factor only.', context);
      const text = pending.scaleFactor!.trim();
      requireEditor(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text), 'INPUT',
        'Scale factor must be a decimal or exponent number.', context);
      const factor = Number(text);
      requireEditor(Number.isFinite(factor) && factor >= 0.001 && factor <= 100, 'INPUT',
        'Enter a positive scale factor from 0.001 to 100.', context);
      const pivotMM: [number, number, number] = resolved.geometry.kind === 'curve'
        ? [...resolved.geometry.controlPoints[curveSelection!.index]]
        : [...resolved.geometry.controlPoints[selection!.uIndex][selection!.vIndex]];
      const compiled = accepted.compiledAssets.find(asset => asset.assetId === resolved.reference.assetId);
      requireEditor(compiled !== undefined, 'NATIVE', 'The native scale asset binding is missing.', context);
      const edited = native(() => scaleBodySource(resolved.source, compiled.model, resolved.geometry,
        pivotMM, scaleAxis, factor), 'Native complete-source object scale failed.', accepted.document.documentId, context);
      if (edited.noOp) {
        if (transition !== null) switchTarget(transition.target);
        pending = {}; prepared = null; selectionTransition = null; emit(); return null;
      }
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision, context);
      document.assets = document.assets.map(asset => asset.id === resolved.reference.assetId
        ? { ...asset, source: edited.source, revision: nextRevision(asset.revision, context) } : asset);
      const result = admit(native(() => createCadDocument(document), 'Native scaled document creation failed.',
        document.documentId, context), context);
      const resultReference = native(() => createCadGeometryReference(result, { bodyId }),
        'Native scaled body reference creation failed.', document.documentId, context).reference;
      return prepare('apply', result, edited.provenance, undefined, transition ?? undefined, displayBodyIds, view,
        edited.curveProvenance, null, null, { reference: resolved.reference, resultReference, axis: scaleAxis,
          factor, pivotMM, report: edited.report });
    }
    if (editTarget === 'rotation') {
      const resolved = requireBodyTransformEditable('rotation');
      const bodyId = resolved.reference.bodyId;
      const context = { documentId: accepted.document.documentId, bodyId, field: 'body-rotation' };
      requireEditor(prepared === null, 'INPUT', 'Resolve the current candidate before rotating the object.', context);
      requireEditor(resolved.geometry.kind === 'curve'
        ? view.kind === 'document' || view.kind === 'curve-focus' && view.bodyId === bodyId : view.kind === 'document',
      'DISPLAY', resolved.geometry.kind === 'curve' ? 'Use document view or focus this Curve before rotating it.' : 'Return to document view before rotating this Surface.',
      { ...context, field: 'curve-focus' });
      const transition = selectionTransition;
      if (Object.keys(pending).length === 0) { emit(); return null; }
      requireEditor(Object.keys(pending).length === 1 && Object.hasOwn(pending, 'angleDegrees'), 'INPUT',
        'Object rotation accepts an angle in degrees only.', context);
      const text = pending.angleDegrees!.trim();
      requireEditor(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text), 'INPUT',
        'Rotation angle must be a decimal or exponent number.', context);
      const angleDegrees = Number(text);
      requireEditor(Number.isFinite(angleDegrees) && Math.abs(angleDegrees) <= 360, 'INPUT',
        'Enter a finite rotation angle from -360 to 360 degrees.', context);
      const pivotMM: [number, number, number] = resolved.geometry.kind === 'curve'
        ? [...resolved.geometry.controlPoints[curveSelection!.index]]
        : [...resolved.geometry.controlPoints[selection!.uIndex][selection!.vIndex]];
      const compiled = accepted.compiledAssets.find(asset => asset.assetId === resolved.reference.assetId);
      requireEditor(compiled !== undefined, 'NATIVE', 'The native rotation asset binding is missing.', context);
      const edited = native(() => rotateBodySource(resolved.source, compiled.model, resolved.geometry,
        pivotMM, rotationAxis, angleDegrees), 'Native complete-source object rotation failed.', accepted.document.documentId, context);
      if (edited.noOp) {
        if (transition !== null) switchTarget(transition.target);
        pending = {}; prepared = null; selectionTransition = null; emit(); return null;
      }
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision, context);
      document.assets = document.assets.map(asset => asset.id === resolved.reference.assetId
        ? { ...asset, source: edited.source, revision: nextRevision(asset.revision, context) } : asset);
      const result = admit(native(() => createCadDocument(document), 'Native rotated document creation failed.',
        document.documentId, context), context);
      const resultReference = native(() => createCadGeometryReference(result, { bodyId }),
        'Native rotated body reference creation failed.', document.documentId, context).reference;
      return prepare('apply', result, edited.provenance, undefined, transition ?? undefined, displayBodyIds, view,
        edited.curveProvenance, null, { reference: resolved.reference, resultReference, axis: rotationAxis,
          angleDegrees, pivotMM, report: edited.report });
    }
    if (editTarget === 'object') {
      const resolved = requireBodyTransformEditable('translation');
      const bodyId = resolved.reference.bodyId;
      const context = { documentId: accepted.document.documentId, bodyId, field: 'body-translation' };
      requireEditor(prepared === null, 'INPUT', 'Resolve the current candidate before moving the object.', context);
      requireEditor(resolved.geometry.kind === 'curve'
        ? view.kind === 'document' || view.kind === 'curve-focus' && view.bodyId === bodyId : view.kind === 'document',
      'DISPLAY', resolved.geometry.kind === 'curve' ? 'Use document view or focus this Curve before moving it.' : 'Return to document view before moving this Surface.',
      { ...context, field: 'curve-focus' });
      const transition = selectionTransition;
      if (Object.keys(pending).length === 0) { emit(); return null; }
      requireEditor(!Object.hasOwn(pending, 'weight') && !Object.hasOwn(pending, 'angleDegrees') && !Object.hasOwn(pending, 'scaleFactor'), 'INPUT', 'Object translation accepts XYZ offsets only.', context);
      const values = pendingValues(bodyId, false, true);
      const offsetMM: [number, number, number] = [values.xMM ?? 0, values.yMM ?? 0, values.zMM ?? 0];
      const requested = (['xMM', 'yMM', 'zMM'] as CadEditorBodyTranslationField[]).filter(field => Object.hasOwn(pending, field));
      const compiled = accepted.compiledAssets.find(asset => asset.assetId === resolved.reference.assetId);
      requireEditor(compiled !== undefined, 'NATIVE', 'The native translation asset binding is missing.', context);
      const edited = native(() => translateBodySource(resolved.source, compiled.model, resolved.geometry, offsetMM, requested),
        'Native complete-source object translation failed.', accepted.document.documentId, context);
      if (edited.noOp) {
        if (transition !== null) switchTarget(transition.target);
        pending = {}; prepared = null; selectionTransition = null; emit(); return null;
      }
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision, context);
      document.assets = document.assets.map(asset => asset.id === resolved.reference.assetId
        ? { ...asset, source: edited.source, revision: nextRevision(asset.revision, context) } : asset);
      const result = admit(native(() => createCadDocument(document), 'Native translated document creation failed.',
        document.documentId, context), context);
      const resultReference = native(() => createCadGeometryReference(result, { bodyId }),
        'Native translated body reference creation failed.', document.documentId, context).reference;
      return prepare('apply', result, edited.provenance, undefined, transition ?? undefined, displayBodyIds, view,
        edited.curveProvenance, { reference: resolved.reference, resultReference, offsetMM, report: edited.report });
    }
    if (curveSelection !== null) {
      requireCurveEditable();
      const selected = curveSelection;
      const context = { documentId: accepted.document.documentId, bodyId: selected.bodyId, field: 'curve-pole' };
      requireEditor(view.kind === 'document' || view.kind === 'curve-focus' && view.bodyId === selected.bodyId, 'DISPLAY',
        'Use document view or focus this Curve before applying its Point edits.', { ...context, field: 'curve-focus' });
      invalidatePrepared();
      const transition = selectionTransition;
      if (Object.keys(pending).length === 0) { emit(); return null; }
      const edit: CurvePoleEdit = { index: selected.index, ...pendingValues(selected.bodyId, true) };
      const resolved = native(() => resolveCadGeometryReference(accepted, selected.reference),
        'Native selected Curve resolution failed.', accepted.document.documentId, context);
      requireEditor(resolved.geometry.kind === 'curve', 'UNSUPPORTED', 'The selected body must remain a Curve.', context);
      const edited = native(() => editSourceCurveControlPolygon({ source: resolved.source, sourceVersion: 0,
        curveId: resolved.geometry.id, edits: { poleEdits: [edit] } }), 'Native complete-source Curve edit failed.',
        accepted.document.documentId, context);
      native(() => validateSourceCurveControlPolygonEdit(edited), 'Native complete-source Curve edit validation failed.',
        accepted.document.documentId, context);
      if (edited.report.noOp) {
        if (transition !== null) switchTarget(transition.target);
        pending = {}; prepared = null; selectionTransition = null; emit(); return null;
      }
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision, context);
      document.assets = document.assets.map(asset => asset.id === selected.reference.assetId
        ? { ...asset, source: edited.source, revision: nextRevision(asset.revision, context) } : asset);
      const result = admit(native(() => createCadDocument(document), 'Native edited Curve document creation failed.',
        document.documentId, context), context);
      return prepare('apply', result, [], undefined, transition ?? undefined, displayBodyIds, view, edited.provenance);
    }
    requireEditable(); requireEditor(selection !== null, 'INPUT', 'Select an original Surface pole first.');
    requireEditor(view.kind === 'document', 'DISPLAY', 'Return to document view before applying Surface edits.',
      { documentId: accepted.document.documentId, bodyId: selection.bodyId, field: 'curve-focus' });
    invalidatePrepared();
    const transition = selectionTransition;
    if (Object.keys(pending).length === 0) { emit(); return null; }
    const edit: SurfacePoleEdit = { uIndex: selection.uIndex, vIndex: selection.vIndex, ...pendingValues(selection.bodyId) };
    const resolved = native(() => resolveCadGeometryReference(accepted, selection!.reference), 'Native selected Surface resolution failed.', accepted.document.documentId);
    // Only the native writer's complete source is authoritative for this asset.
    const edited = native(() => editSourceSurfaceControlNetWide({ source: resolved.source, sourceVersion: 0,
      surfaceId: resolved.geometry.id, edits: { poleEdits: [edit] } }),
    'Native complete-source Surface edit failed.', accepted.document.documentId, { bodyId: selection.bodyId });
    native(() => validateSourceSurfaceControlNetWideEdit(edited), 'Native complete-source edit validation failed.',
      accepted.document.documentId, { bodyId: selection.bodyId });
    if (edited.report.noOp) {
      if (transition !== null) switchTarget(transition.target);
      pending = {}; prepared = null; selectionTransition = null; emit(); return null;
    }
    const document = copy(accepted.document);
    document.revision = nextRevision(document.revision);
    document.assets = document.assets.map(asset => asset.id === selection!.reference.assetId
      ? { ...asset, source: edited.source, revision: nextRevision(asset.revision) } : asset);
    const result = admit(native(() => createCadDocument(document), 'Native edited document creation failed.', document.documentId));
    return prepare('apply', result, edited.provenance, undefined, transition ?? undefined);
  };

  const resolveAnalysis = (reference: CadGeometryReferenceV0) => {
    live();
    return native(() => resolveCadGeometryReference(accepted, reference), 'Native geometry analysis reference refused.',
      accepted.document.documentId, { field: 'geometry-analysis' });
  };
  const resolveCurveAnalysis = (reference: CadGeometryReferenceV0) => {
    const resolved = resolveAnalysis(reference);
    requireEditor(resolved.geometry.kind === 'curve', 'UNSUPPORTED', 'Select an original Curve for this query.',
      { documentId: accepted.document.documentId, bodyId: resolved.reference.bodyId, field: 'geometry-analysis' });
    return { reference: resolved.reference, geometry: resolved.geometry };
  };
  const resolveSurfaceAnalysis = (reference: CadGeometryReferenceV0) => {
    const resolved = resolveAnalysis(reference);
    requireEditor(resolved.geometry.kind === 'surface', 'UNSUPPORTED', 'Select an original Surface for this query.',
      { documentId: accepted.document.documentId, bodyId: resolved.reference.bodyId, field: 'geometry-analysis' });
    return { reference: resolved.reference, geometry: resolved.geometry };
  };

  return {
    getSnapshot: snapshot,
    getExportCapabilities() {
      live();
      return copy(native(() => getCadDocumentExportCapabilities(), 'Native export capabilities failed.',
        accepted.document.documentId, { field: 'document-export' }));
    },
    inspectExport(exportOptions) {
      live();
      return copy(native(() => inspectCadDocumentExport(accepted, exportOptions), 'Native export inspection failed.',
        accepted.document.documentId, { field: 'document-export' }));
    },
    exportAccepted(exportOptions) {
      live();
      return copy(native(() => exportCadDocument(accepted, exportOptions), 'Native accepted document export failed.',
        accepted.document.documentId, { field: 'document-export' }));
    },
    inspectCurveLength(reference, lengthOptions) {
      live();
      try {
        return copy(queryCadDocumentCurveArcLength(accepted, reference, lengthOptions));
      } catch (cause) {
        const code = cause instanceof CadCurveArcLengthError && cause.code === 'STALE' ? 'STALE' : 'NATIVE';
        throw new CadEditorError(code, 'Native Curve length estimate refused.',
          { documentId: accepted.document.documentId, field: 'curve-length' }, cause);
      }
    },
    inspectCurveD2(reference, parameter) {
      const resolved = resolveCurveAnalysis(reference);
      const result = native(() => evaluateCurveD2(resolved.geometry, parameter), 'Native Curve derivatives refused.',
        accepted.document.documentId, { bodyId: resolved.reference.bodyId, field: 'geometry-analysis' });
      return copy({ kind: 'curve' as const, query: 'derivatives' as const, reference: resolved.reference, parameter, result });
    },
    inspectSurfaceD2(reference, u, v) {
      const resolved = resolveSurfaceAnalysis(reference);
      const result = native(() => evaluateSurfaceD2(resolved.geometry, u, v), 'Native Surface derivatives refused.',
        accepted.document.documentId, { bodyId: resolved.reference.bodyId, field: 'geometry-analysis' });
      return copy({ kind: 'surface' as const, query: 'derivatives' as const, reference: resolved.reference, u, v, result });
    },
    inspectCurveCurvature(reference, parameter) {
      const resolved = resolveCurveAnalysis(reference);
      const result = native(() => evaluateCurveCurvature(resolved.geometry, parameter), 'Native Curve curvature refused.',
        accepted.document.documentId, { bodyId: resolved.reference.bodyId, field: 'geometry-analysis' });
      return copy({ kind: 'curve' as const, query: 'curvature' as const, reference: resolved.reference, parameter, result });
    },
    inspectSurfaceCurvature(reference, u, v) {
      const resolved = resolveSurfaceAnalysis(reference);
      const result = native(() => evaluateSurfaceCurvature(resolved.geometry, u, v), 'Native Surface curvature refused.',
        accepted.document.documentId, { bodyId: resolved.reference.bodyId, field: 'geometry-analysis' });
      return copy({ kind: 'surface' as const, query: 'curvature' as const, reference: resolved.reference, u, v, result });
    },
    subscribe(listener) {
      live(); requireEditor(typeof listener === 'function', 'INPUT', 'A subscription listener is required.');
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    requestSelection,
    resolveSelectionTransition(token, choice) {
      live();
      const context = { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'selection-transition' };
      requireEditor(selectionTransition !== null && selectionTransition.token === token
        && selectionTransition.baseGeneration === generation, 'STALE', 'The selection decision is no longer current.', context);
      requireEditor(choice === 'apply' || choice === 'discard' || choice === 'cancel', 'INPUT', 'Choose Apply, Discard or Cancel.', context);
      if (choice === 'apply') return prepareApply();
      if (choice === 'discard') {
        switchTarget(selectionTransition.target);
        pending = {};
        intervalBinding = null;
        surfaceKnotBinding = null;
        curveKnotBinding = null; surfaceIsoCurveBinding = null;
      }
      selectionTransition = null; prepared = null; emit(); return null;
    },
    selectSurfacePole(input) {
      live();
      ownFields(input, ['bodyId', 'uIndex', 'vIndex'], ['bodyId', 'uIndex', 'vIndex'], { field: 'selection-transition' });
      requestSelection(input);
    },
    selectCurvePole(input) {
      live();
      ownFields(input, ['bodyId', 'index'], ['bodyId', 'index'], { field: 'selection-transition' });
      requestSelection(input);
    },
    setEditTarget(target) {
      live();
      const context = { documentId: accepted.document.documentId, field: 'edit-target' };
      requireEditor(target === 'pole' || target === 'object' || target === 'rotation' || target === 'scale', 'INPUT', 'Choose Control point, Object, Rotate object or Scale object.', context);
      requireEditor(Object.keys(pending).length === 0 && prepared === null && selectionTransition === null,
        'INPUT', 'Resolve the draft, candidate or selection decision before changing the edit target.', context);
      if (editTarget === target) return;
      editTarget = target; emit();
    },
    setRotationAxis(axis) {
      live();
      const context = { documentId: accepted.document.documentId, field: 'rotation-axis' };
      requireEditor(axis === 'x' || axis === 'y' || axis === 'z', 'INPUT', 'Choose world X, Y or Z.', context);
      requireEditor(Object.keys(pending).length === 0 && prepared === null && selectionTransition === null,
        'INPUT', 'Resolve the draft, candidate or selection decision before changing the rotation axis.', context);
      if (rotationAxis === axis) return;
      rotationAxis = axis; emit();
    },
    stageBodyRotation(rawAngleDegrees) {
      live();
      requireNoIntervalDraft();
      const context = { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'body-rotation' };
      requireEditor(editTarget === 'rotation', 'INPUT', 'Select Rotate object before entering an angle.', context);
      requireBodyTransformEditable('rotation');
      requireEditor(typeof rawAngleDegrees === 'string' && rawAngleDegrees.length <= 128,
        'BUDGET', 'Rotation input must have at most 128 characters.', context);
      pending = { angleDegrees: rawAngleDegrees }; prepared = null; selectionTransition = null; emit();
    },
    setScaleAxis(axis) {
      live();
      const context = { documentId: accepted.document.documentId, field: 'scale-axis' };
      requireEditor(axis === 'uniform' || axis === 'x' || axis === 'y' || axis === 'z', 'INPUT', 'Choose All, X, Y or Z.', context);
      requireEditor(Object.keys(pending).length === 0 && prepared === null && selectionTransition === null,
        'INPUT', 'Resolve the draft, candidate or selection decision before changing the scale axis.', context);
      if (scaleAxis === axis) return;
      scaleAxis = axis; emit();
    },
    stageBodyScale(rawFactor) {
      live();
      requireNoIntervalDraft();
      const context = { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'body-scale' };
      requireEditor(editTarget === 'scale', 'INPUT', 'Select Scale object before entering a factor.', context);
      requireBodyTransformEditable('scale');
      requireEditor(typeof rawFactor === 'string' && rawFactor.length <= 128,
        'BUDGET', 'Scale input must have at most 128 characters.', context);
      pending = { scaleFactor: rawFactor }; prepared = null; selectionTransition = null; emit();
    },
    stageBodyTranslationField(field, rawText) {
      live();
      requireNoIntervalDraft();
      const context = { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'body-translation' };
      requireEditor(editTarget === 'object', 'INPUT', 'Select Object before entering translation offsets.', context);
      requireBodyTransformEditable('translation');
      requireEditor(field === 'xMM' || field === 'yMM' || field === 'zMM', 'INPUT', 'Object translation accepts XYZ offsets only.', context);
      requireEditor(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET', 'Translation input must have at most 128 characters.', context);
      pending = { ...pending, [field]: rawText }; prepared = null; selectionTransition = null; emit();
    },
    stageSurfacePoleField(field, rawText) {
      live(); requireNoIntervalDraft(); requireEditor(editTarget === 'pole', 'INPUT', 'Select Control point before editing a pole.', { field: 'edit-target' });
      requireEditable(); requireEditor(selection !== null, 'INPUT', 'Select an original Surface pole first.');
      requireEditor(FIELDS.includes(field), 'INPUT', 'The pole field is unsupported.');
      requireEditor(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET', 'Pole input must have at most 128 characters.');
      pending = { ...pending, [field]: rawText }; prepared = null; selectionTransition = null; emit();
    },
    stageCurvePoleField(field, rawText) {
      live(); requireNoIntervalDraft(); requireEditor(editTarget === 'pole', 'INPUT', 'Select Control point before editing a pole.', { field: 'edit-target' });
      requireCurveEditable();
      const context = { documentId: accepted.document.documentId, bodyId: curveSelection!.bodyId, field: 'curve-pole' };
      requireEditor(FIELDS.includes(field), 'INPUT', 'The Curve Point field is unsupported.', context);
      requireEditor(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET', 'Point input must have at most 128 characters.', context);
      pending = { ...pending, [field]: rawText }; prepared = null; selectionTransition = null; emit();
    },
    stageCurveIntervalField(field, rawText) {
      live();
      const context = intervalContext();
      requireEditor(field === 'min' || field === 'max', 'INPUT', 'Choose the minimum or maximum parameter.', context);
      requireEditor(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET',
        'Interval input must have at most 128 characters.', context);
      requireEditor(Object.keys(pending).every(key => key === 'intervalMin' || key === 'intervalMax'),
        'INPUT', 'Apply or discard other fields before restricting an interval.', context);
      const binding = intervalBinding ?? captureInterval();
      currentInterval(binding);
      const text = rawText.trim();
      const value = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ? Number(text) : NaN;
      const key = field === 'min' ? 'intervalMin' : 'intervalMax';
      const fields = { ...pending };
      if (Number.isFinite(value) && Object.is(value, binding.domain[field === 'min' ? 0 : 1])) delete fields[key];
      else fields[key] = rawText;
      pending = fields; intervalBinding = Object.hasOwn(fields, 'intervalMin') || Object.hasOwn(fields, 'intervalMax') ? binding : null;
      prepared = null; selectionTransition = null; emit();
    },
    stageSurfaceKnotField(axis, rawText) {
      live();
      const context = surfaceKnotContext();
      requireEditor(axis === 'u' || axis === 'v', 'INPUT', 'Choose the original U or V axis.', context);
      requireEditor(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET',
        'Knot input must have at most 128 characters.', context);
      const key = axis === 'u' ? 'surfaceKnotU' : 'surfaceKnotV';
      requireEditor(Object.keys(pending).every(field => field === key), 'INPUT',
        'Apply or discard the current draft before changing the knot axis or operation.', context);
      const binding = surfaceKnotBinding ?? captureSurfaceKnot(axis);
      requireEditor(binding.axis === axis, 'INPUT', 'Apply or discard the knot before changing its axis.', context);
      currentSurfaceKnot(binding);
      const fields = { ...pending };
      if (rawText === '') delete fields[key];
      else fields[key] = rawText;
      pending = fields; surfaceKnotBinding = Object.hasOwn(fields, key) ? binding : null;
      prepared = null; selectionTransition = null; emit();
    },
    stageSurfaceIsoCurveField(axis, rawText) {
      live();
      const context = surfaceIsoCurveContext();
      requireEditor(axis === 'u' || axis === 'v', 'INPUT', 'Choose the original U or V axis.', context);
      requireEditor(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET',
        'Iso-Curve input must have at most 128 characters.', context);
      const key = axis === 'u' ? 'surfaceIsoU' : 'surfaceIsoV';
      requireEditor(Object.keys(pending).every(field => field === key), 'INPUT',
        'Apply or discard the current draft before changing the iso-Curve axis or operation.', context);
      const binding = surfaceIsoCurveBinding ?? captureSurfaceIsoCurve(axis);
      requireEditor(binding.axis === axis, 'INPUT', 'Apply or discard the iso-Curve before changing its axis.', context);
      currentSurfaceIsoCurve(binding);
      const fields = { ...pending };
      if (rawText === '') delete fields[key]; else fields[key] = rawText;
      pending = fields; surfaceIsoCurveBinding = Object.hasOwn(fields, key) ? binding : null;
      prepared = null; selectionTransition = null; emit();
    },
    stageCurveKnotField(rawText) {
      live();
      const context = curveKnotContext();
      requireEditor(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET',
        'Knot input must have at most 128 characters.', context);
      requireEditor(Object.keys(pending).every(field => field === 'curveKnot'), 'INPUT',
        'Apply or discard other draft fields before inserting a Curve knot.', context);
      const binding = curveKnotBinding ?? captureCurveKnot();
      currentCurveKnot(binding);
      const fields = { ...pending };
      if (rawText === '') delete fields.curveKnot;
      else fields.curveKnot = rawText;
      pending = fields; curveKnotBinding = Object.hasOwn(fields, 'curveKnot') ? binding : null;
      prepared = null; selectionTransition = null; emit();
    },
    discardPending() { live(); pending = {}; intervalBinding = null; surfaceKnotBinding = null; curveKnotBinding = null; surfaceIsoCurveBinding = null; prepared = null; selectionTransition = null; emit(); },
    prepareApply,
    prepareOpen(text, options) {
      live(); fileBudget(text);
      const result = admit(native(() => parseCadDocument(text), 'Native document Open failed.'));
      const incoming = sessionConfiguration(result, options);
      requireResolvedDraft();
      invalidatePrepared();
      return prepare('open', result, [], undefined, undefined, incoming.displayBodyIds, incoming.view);
    },
    prepareDisplayBodies(bodyIds) {
      live();
      const ids = displayIds(accepted, bodyIds);
      requireEditor(prepared === null && selectionTransition === null, 'INPUT', 'Resolve the current candidate or selection decision first.',
        { documentId: accepted.document.documentId, field: 'display-body-set' });
      return prepare('display', accepted, [], undefined, undefined, ids, { kind: 'document' });
    },
    prepareCurveFocus(bodyId, count) {
      live();
      const proposed = viewFor(accepted, { kind: 'curve-focus', bodyId, count });
      requireEditor(prepared === null && selectionTransition === null, 'INPUT', 'Resolve the current candidate or selection decision first.',
        { documentId: accepted.document.documentId, field: 'curve-focus' });
      return prepare('display', accepted, [], undefined, undefined, displayBodyIds, proposed);
    },
    prepareDocumentView() {
      live();
      requireEditor(prepared === null && selectionTransition === null, 'INPUT', 'Resolve the current candidate or selection decision first.',
        { documentId: accepted.document.documentId, field: 'curve-focus' });
      return prepare('display', accepted, [], undefined, undefined, displayBodyIds, { kind: 'document' });
    },
    prepareRenameBody(bodyId, name) {
      live();
      const context = { documentId: accepted.document.documentId, field: 'body-name' };
      requireEditor(typeof bodyId === 'string', 'INPUT', 'Choose an existing body to rename.', context);
      const body = accepted.document.bodies.find(value => value.id === bodyId);
      requireEditor(body !== undefined, 'INPUT', 'The body to rename is missing.', { ...context, bodyId });
      requireEditor(Object.keys(pending).length === 0 && selectionTransition === null && prepared === null,
        'INPUT', 'Resolve the draft, selection decision or candidate before renaming.', { ...context, bodyId });
      if (name === body.name) return null;
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision, { ...context, bodyId });
      document.bodies = document.bodies.map(value => value.id === bodyId ? { ...value, name } : value);
      const result = admit(native(() => createCadDocument(document), 'Native body rename refused.', document.documentId,
        { ...context, bodyId }), { ...context, bodyId });
      return prepare('rename', result);
    },
    prepareDuplicateBody(bodyId, options) {
      live();
      const context = { documentId: accepted.document.documentId, field: 'body-duplicate' };
      requireEditor(typeof bodyId === 'string', 'INPUT', 'Choose an existing body to duplicate.', context);
      const bodyContext = { ...context, bodyId };
      const data: Record<string, unknown> = options === undefined ? {} : ownFields(options, ['name'], [], bodyContext);
      requireEditor(data.name === undefined || typeof data.name === 'string', 'INPUT', 'The copied body name must be text.', bodyContext);
      const body = accepted.document.bodies.find(value => value.id === bodyId);
      requireEditor(body !== undefined && selectedBodyId === bodyId, 'INPUT', 'Select the body to duplicate first.', bodyContext);
      requireEditor(Object.keys(pending).length === 0 && selectionTransition === null && prepared === null,
        'INPUT', 'Resolve the draft, selection decision or candidate before duplicating.', bodyContext);
      if (view.kind === 'document')
        requireEditor(displayBodyIds.length < 4, 'BUDGET', 'Hide a body before duplicating.', bodyContext);
      else requireEditor(view.bodyId === bodyId
        && accepted.bodyBindings.some(binding => binding.bodyId === bodyId && binding.geometryKind === 'curve'),
      'DISPLAY', 'Return to document view before duplicating this body.', bodyContext);
      const before = currentPresentation();
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision, bodyContext);
      const duplicated = duplicateBodySourceDocument(document, bodyId, data.name as string | undefined,
        history.map(state => state.document));
      const result = admit(native(() => createCadDocument(duplicated.document), 'Native body duplication refused.',
        document.documentId, bodyContext), bodyContext);
      const after: Presentation = {
        ...copy(before),
        selectionTarget: { ...before.selectionTarget!, bodyId: duplicated.bodyId },
        displayBodyIds: view.kind === 'document' ? [...displayBodyIds, duplicated.bodyId] : copy(displayBodyIds),
        view: view.kind === 'curve-focus' ? { ...view, bodyId: duplicated.bodyId } : copy(view),
      };
      return prepare('duplicate', result, [], undefined, undefined, after.displayBodyIds, after.view,
        [], null, null, null, { presentation: after, duplicateBoundary: { before, after } });
    },
    prepareUndo() { return restore(-1); },
    prepareRedo() { return restore(1); },
    acceptCandidate(token) {
      live();
      requireEditor(prepared !== null && prepared.candidate.token === token && prepared.candidate.baseGeneration === generation
        && prepared.candidate.baseDisplayGeneration === displayGeneration,
        'STALE', 'The prepared candidate is no longer current.');
      const current = prepared;
      const result = current.candidate.result;
      if (current.candidate.kind === 'display') {
        displayBodyIds = copy(current.candidate.displayBodyIds); view = copy(current.candidate.view);
        displayGeneration++; prepared = null;
        const returned = snapshot(); emit(); return returned;
      }
      requireEditor(current.transitionToken === undefined || selectionTransition !== null
        && selectionTransition.token === current.transitionToken && selectionTransition.baseGeneration === generation,
        'STALE', 'The selection decision is no longer current.', { field: 'selection-transition' });
      const target = current.structuralPresentation !== undefined ? current.selectionTarget ?? null
        : current.candidate.kind === 'open' || selectedBodyId === null ? null
          : current.selectionTarget ?? { bodyId: selectedBodyId, uIndex: selection?.uIndex, vIndex: selection?.vIndex, index: curveSelection?.index };
      // A coefficient boundary can retain a logical body without a pole. Ordinary
      // same-inventory commits must not turn that absence into an implicit point0.
      const bodyOnly = target !== null && (current.structuralBodyOnly === true
        || current.structuralPresentation === undefined && current.selectionTarget === undefined
          && selectedBodyId === target.bodyId && selection === null && curveSelection === null);
      const clearBodyId = current.clearSurfacePoleBodyId ?? current.clearCurvePoleBodyId
        ?? (bodyOnly ? target!.bodyId : undefined);
      const clearPole = clearBodyId !== undefined && target?.bodyId === clearBodyId;
      if (clearPole) {
        const expectedKind = current.clearSurfacePoleBodyId !== undefined ? 'surface'
          : current.clearCurvePoleBodyId !== undefined ? 'curve'
            : accepted.bodyBindings.find(binding => binding.bodyId === clearBodyId)?.geometryKind;
        const context = { documentId: result.document.documentId, bodyId: clearBodyId,
          field: current.structuralBodyOnly === true ? 'surface-isocurve'
            : expectedKind === 'surface' ? 'surface-knot' : current.curveKnotBoundary !== undefined ? 'curve-knot' : 'curve-interval' };
        const reference = native(() => createCadGeometryReference(result, { bodyId: clearBodyId! }),
          'Native body-only reference creation failed.', result.document.documentId, context).reference;
        const resolved = native(() => resolveCadGeometryReference(result, reference),
          'Native body-only resolution failed.', result.document.documentId, context);
        requireEditor(resolved.geometry.kind === expectedKind, 'STALE', 'The coefficient boundary must retain its original body kind.', context);
      }
      const nextTarget = target === null || clearPole ? null : resolveTarget(target, result);
      const nextCapabilities = capabilities(result);
      const state: HistoryState = { document: copy(result.document), bytes: fileBudget(serialize(result)),
        nativeNames: result.compiledAssets.flatMap(asset => [asset.model.name, ...asset.model.objects.map(geometry => geometry.id)]) };
      if (current.candidate.kind === 'duplicate') state.duplicateBoundary = copy(current.duplicateBoundary);
      if (current.candidate.kind === 'surface-isocurve') state.surfaceIsoCurveBoundary = copy(current.surfaceIsoCurveBoundary);
      if (current.candidate.kind === 'curve-interval') state.intervalBoundary = copy(current.intervalBoundary);
      if (current.candidate.kind === 'surface-knot') state.surfaceKnotBoundary = copy(current.surfaceKnotBoundary);
      if (current.candidate.kind === 'curve-knot') state.curveKnotBoundary = copy(current.curveKnotBoundary);
      if (current.candidate.kind === 'open') { history = [state]; historyIndex = 0; }
      else if (current.candidate.kind === 'apply' || current.candidate.kind === 'rename' || current.candidate.kind === 'duplicate'
        || current.candidate.kind === 'curve-interval' || current.candidate.kind === 'surface-knot' || current.candidate.kind === 'curve-knot'
        || current.candidate.kind === 'surface-isocurve') {
        history = [...history.slice(0, historyIndex + 1), state];
        while (history.length > HISTORY_LIMIT || historyBytes() > HISTORY_BYTES) history.shift();
        historyIndex = history.length - 1;
      } else historyIndex = current.historyIndex!;
      accepted = result; selectedBodyId = clearPole ? clearBodyId! : nextTarget?.target.bodyId ?? null; selection = nextTarget?.pole ?? null;
      curveSelection = nextTarget?.curvePole ?? null;
      bodyCapabilities = nextCapabilities;
      if (current.candidate.kind === 'open') { displayBodyIds = copy(current.candidate.displayBodyIds); view = copy(current.candidate.view); editTarget = 'pole'; rotationAxis = 'z'; scaleAxis = 'uniform'; displayGeneration++; }
      else if (current.structuralPresentation !== undefined) {
        const presentation = current.structuralPresentation;
        const changed = displayBodyIds.length !== presentation.displayBodyIds.length
          || displayBodyIds.some((bodyId, index) => bodyId !== presentation.displayBodyIds[index])
          || view.kind !== presentation.view.kind
          || view.kind === 'curve-focus' && presentation.view.kind === 'curve-focus'
            && (view.bodyId !== presentation.view.bodyId || view.count !== presentation.view.count);
        displayBodyIds = copy(presentation.displayBodyIds); view = copy(presentation.view);
        editTarget = presentation.editTarget; rotationAxis = presentation.rotationAxis; scaleAxis = presentation.scaleAxis;
        if (changed) displayGeneration++;
      }
      if (current.candidate.kind === 'open') assetRevisionHighWater.clear();
      for (const asset of accepted.document.assets)
        assetRevisionHighWater.set(asset.id, Math.max(assetRevisionHighWater.get(asset.id) ?? 0, asset.revision));
      const retainedAssetIds = new Set(history.flatMap(state => state.document.assets.map(asset => asset.id)));
      for (const id of assetRevisionHighWater.keys()) if (!retainedAssetIds.has(id)) assetRevisionHighWater.delete(id);
      generation++; pending = {}; intervalBinding = null; surfaceKnotBinding = null; curveKnotBinding = null; surfaceIsoCurveBinding = null; prepared = null; selectionTransition = null;
      lastProvenance = copy(current.candidate.provenance);
      lastCurveProvenance = copy(current.candidate.curveProvenance);
      lastBodyTranslation = copy(current.candidate.bodyTranslation);
      lastBodyRotation = copy(current.candidate.bodyRotation);
      lastBodyScale = copy(current.candidate.bodyScale);
      lastCurveInterval = copy(current.candidate.curveInterval ?? null);
      lastSurfaceKnot = copy(current.candidate.surfaceKnot ?? null);
      lastCurveKnot = copy(current.candidate.curveKnot ?? null);
      lastSurfaceIsoCurve = copy(current.candidate.surfaceIsoCurve ?? null);
      dirty = current.candidate.kind !== 'open'; downloadStatus = 'Not downloaded'; download = null;
      const returned = snapshot(); emit(); return returned;
    },
    cancelCandidate(token) {
      live(); requireEditor(prepared !== null && prepared.candidate.token === token, 'STALE', 'The prepared candidate is no longer current.');
      prepared = null; emit();
    },
    serializeAccepted() {
      live(); const text = serialize(accepted), token = newToken();
      download = { token, generation };
      return { token, text, suggestedFilename: `${accepted.document.documentId}.cad-document.json` };
    },
    markDownloaded(token) {
      live(); requireEditor(download !== null && download.token === token && download.generation === generation,
        'STALE', 'The accepted document changed after the download capture.');
      dirty = false; downloadStatus = 'Download started'; emit();
    },
    dispose() {
      if (disposed) return;
      disposed = true; prepared = null; intervalBinding = null; surfaceKnotBinding = null; curveKnotBinding = null; surfaceIsoCurveBinding = null; selectionTransition = null; download = null; pending = {}; emit(); listeners.clear();
    },
  };
}
