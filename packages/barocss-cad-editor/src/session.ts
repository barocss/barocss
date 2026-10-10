import {
  CadReferenceDiagnosticCode, CadReferenceError,
  createCadDocument, createCadGeometryReference, editSourceSurfaceControlNet,
  evaluateCurveD2, evaluateSurfaceD2, evaluateCurveCurvature, evaluateSurfaceCurvature,
  exportCadDocument, getCadDocumentExportCapabilities, inspectCadDocumentExport,
  parseCadDocument, resolveCadGeometryReference, serializeCadDocument,
  validateCadDocumentResult, validateSourceSurfaceControlNetEdit,
} from '@barocss/cad';
import type { CadDocumentResult, CadDocumentV1, CadGeometryReferenceV0, SurfacePoleEdit } from '@barocss/cad';
import { CadEditorError } from './types.js';
import type {
  CadEditorCandidate, CadEditorDiagnosticCode, CadEditorPoleField, CadEditorSelectedPole,
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

function fileBudget(text: string): number {
  requireEditor(typeof text === 'string', 'INPUT', 'Native document text is required.');
  requireEditor(text.length <= FILE_LIMIT, 'BUDGET', 'Document exceeds 2097152 code units.');
  const bytes = utf8Bytes(text);
  requireEditor(bytes <= FILE_LIMIT, 'BUDGET', 'Document exceeds 2097152 UTF-8 bytes.');
  return bytes;
}

function serialize(result: CadDocumentResult): string {
  const text = native(() => serializeCadDocument(result.document), 'Native document serialization failed.', result.document.documentId);
  fileBudget(text);
  return text;
}

function admit(result: CadDocumentResult): CadDocumentResult {
  const documentId = result.document.documentId;
  native(() => validateCadDocumentResult(result), 'Native document validation failed.', documentId);
  serialize(result);
  return result;
}

function capabilities(result: CadDocumentResult): CadEditorSnapshot['bodyCapabilities'] {
  return result.document.bodies.map(body => {
    const compiled = result.compiledAssets.find(asset => asset.assetId === body.assetId);
    const geometry = compiled?.model.objects.find(object => object.id === body.geometryId);
    requireEditor(compiled !== undefined && geometry !== undefined, 'NATIVE', 'The native body binding is missing.');
    let reason: CadEditorSnapshot['bodyCapabilities'][number]['reason'] = null;
    if (geometry.kind === 'curve') reason = 'curve';
    else {
      const countU = geometry.controlPoints.length, countV = geometry.controlPoints[0].length;
      if (!/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(geometry.id)
        || geometry.degreeU < 1 || geometry.degreeU > 3 || geometry.degreeV < 1 || geometry.degreeV > 3
        || countU < 2 || countU > 16 || countV < 2 || countV > 16 || countU * countV > 256
        || !geometry.controlPoints.every(row => row.length === countV && row.every(point => point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000)))
        || !geometry.weights.every(row => row.length === countV && row.every(value => Number.isFinite(value) && value >= 1e-6 && value <= 1e6))) reason = 'surface-profile';
    }
    return { bodyId: body.id, canEditSurfacePole: reason === null, reason };
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

function sessionDisplayIds(result: CadDocumentResult, options?: CadEditorSessionOptions): string[] {
  let input: string[] | undefined;
  const context = { documentId: result.document.documentId, field: 'display-body-set' };
  if (options !== undefined) {
    requireEditor(options !== null && typeof options === 'object' && !Array.isArray(options)
      && [Object.prototype, null].includes(Object.getPrototypeOf(options)), 'INPUT', 'Session options must be plain own data.', context);
    const keys = Reflect.ownKeys(options), fields = Object.getOwnPropertyDescriptors(options);
    requireEditor(keys.length <= 1 && keys.every(key => key === 'displayBodyIds')
      && keys.every(key => 'value' in fields[key as string] && fields[key as string].enumerable),
      'INPUT', 'Session options accept displayBodyIds only.', context);
    input = fields.displayBodyIds?.value;
  }
  if (input === undefined) {
    requireEditor(result.document.bodies.length <= 4, 'INPUT', 'Choose explicit display bodies for this document.', context);
    input = result.document.bodies.map(body => body.id);
  }
  return displayIds(result, input);
}

function nextRevision(revision: number): number {
  requireEditor(revision < REVISION_LIMIT, 'REVISION', 'Native revision limit reached.');
  return revision + 1;
}

interface HistoryState { document: CadDocumentV1; bytes: number }
interface Prepared {
  candidate: CadEditorCandidate; historyIndex?: number;
  selectionTarget?: CadEditorSelectionTarget; transitionToken?: string;
}

/** Create an owned source-authoritative editor. No renderer or browser resources are created. */
export function createCadEditorSession(initialDocument: CadDocumentV1, options?: CadEditorSessionOptions): CadEditorSession {
  let accepted = admit(native(() => createCadDocument(initialDocument), 'Initial native document creation failed.'));
  let displayBodyIds = sessionDisplayIds(accepted, options);
  let bodyCapabilities = capabilities(accepted);
  const sessionId = ++sessionSequence;
  let tokenSequence = 0;
  let generation = 0;
  let displayGeneration = 0;
  let disposed = false;
  let selectedBodyId: string | null = null;
  let selection: CadEditorSelectedPole | null = null;
  let selectionTransition: CadEditorSelectionTransition | null = null;
  let pending: CadEditorSnapshot['pending'] = {};
  let prepared: Prepared | null = null;
  let history: HistoryState[] = [{ document: copy(accepted.document), bytes: fileBudget(serialize(accepted)) }];
  let historyIndex = 0;
  let dirty = true;
  let downloadStatus: CadEditorSnapshot['downloadStatus'] = 'Not downloaded';
  let download: { token: string; generation: number } | null = null;
  let lastProvenance: CadEditorSnapshot['lastProvenance'] = [];
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
    accepted, generation, displayGeneration, displayBodyIds, bodyCapabilities,
    selectedBodyId, selection, selectionTransition, pending, candidate: prepared?.candidate ?? null,
    history: { index: historyIndex, count: history.length, bytes: historyBytes(), canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 },
    dirty, downloadStatus, disposed, lastProvenance,
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
    const context = { documentId: document.document.documentId, bodyId: input?.bodyId, field: 'selection-transition' };
    requireEditor(input !== null && typeof input === 'object' && !Array.isArray(input)
      && typeof input.bodyId === 'string', 'INPUT', 'Select an existing document body.', context);
    requireEditor(document.document.bodies.some(body => body.id === input.bodyId), 'INPUT', 'The selected body is missing.', context);
    const reference = input.reference === undefined
      ? native(() => createCadGeometryReference(document, { bodyId: input.bodyId }), 'Native body reference creation failed.', document.document.documentId, context).reference
      : native(() => resolveCadGeometryReference(document, input.reference!), 'Native selection reference resolution failed.', document.document.documentId, context).reference;
    requireEditor(reference.bodyId === input.bodyId, 'INPUT', 'The native reference must match the selected body.', context);
    const resolved = native(() => resolveCadGeometryReference(document, reference), 'Native body reference resolution failed.', document.document.documentId, context);
    if (resolved.geometry.kind === 'curve') {
      requireEditor(input.uIndex === undefined && input.vIndex === undefined, 'INPUT', 'Curve selection has no editable pole indices.', context);
      return { target: { bodyId: input.bodyId, reference } satisfies CadEditorSelectionTarget, pole: null };
    }
    requireEditor((input.uIndex === undefined) === (input.vIndex === undefined), 'INPUT', 'Provide both Surface pole indices.', context);
    const uIndex = input.uIndex === undefined ? (selection?.bodyId === input.bodyId ? selection.uIndex : 0) : input.uIndex;
    const vIndex = input.vIndex === undefined ? (selection?.bodyId === input.bodyId ? selection.vIndex : 0) : input.vIndex;
    const pole = select({ bodyId: input.bodyId, uIndex, vIndex }, document);
    return { target: { bodyId: input.bodyId, uIndex, vIndex, reference } satisfies CadEditorSelectionTarget, pole };
  };
  const switchTarget = (input: CadEditorSelectionTarget) => {
    const resolved = resolveTarget(input);
    selectedBodyId = resolved.target.bodyId; selection = resolved.pole;
  };
  const requestSelection = (input: CadEditorSelectionTarget): CadEditorSelectionTransition | null => {
    live();
    const resolved = resolveTarget(input);
    if (resolved.target.bodyId === selectedBodyId && (resolved.pole === null ? selection === null
      : selection !== null && selection.uIndex === resolved.pole.uIndex && selection.vIndex === resolved.pole.vIndex)) return null;
    prepared = null;
    if (Object.keys(pending).length > 0) {
      selectionTransition = { token: newToken(), baseGeneration: generation, target: copy(resolved.target) };
      const returned = copy(selectionTransition); emit(); return returned;
    }
    selectedBodyId = resolved.target.bodyId; selection = resolved.pole; selectionTransition = null; emit(); return null;
  };
  const requireResolvedDraft = () => requireEditor(Object.keys(pending).length === 0 && selectionTransition === null,
    'INPUT', 'Apply or discard the draft before Open or history.',
    { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'selection-transition' });
  const requireEditable = () => {
    const context = { documentId: accepted.document.documentId, bodyId: selectedBodyId ?? undefined, field: 'edit-capability' };
    requireEditor(selectedBodyId !== null, 'INPUT', 'Select an editable Surface body first.', context);
    const capability = bodyCapabilities.find(body => body.bodyId === selectedBodyId);
    const message = capability?.reason === 'curve' ? 'Curve poles are read-only in this editor.'
        : 'This Surface is outside the supported pole edit profile.';
    requireEditor(capability?.canEditSurfacePole === true, 'UNSUPPORTED', message, context);
  };
  const prepare = (kind: CadEditorCandidate['kind'], result: CadDocumentResult,
    provenance: CadEditorCandidate['provenance'] = [], targetIndex?: number,
    postSelection?: CadEditorSelectionTransition, candidateDisplayIds = displayBodyIds): CadEditorCandidate => {
    prepared = { candidate: { kind, result, provenance, token: newToken(), baseGeneration: generation,
      baseDisplayGeneration: displayGeneration, displayBodyIds: copy(candidateDisplayIds) }, historyIndex: targetIndex,
      selectionTarget: postSelection === undefined ? undefined : {
        bodyId: postSelection.target.bodyId, uIndex: postSelection.target.uIndex, vIndex: postSelection.target.vIndex,
      }, transitionToken: postSelection?.token };
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
    const document = copy(accepted.document);
    document.revision = nextRevision(document.revision);
    document.assets = document.assets.map(asset => {
      const prior = target.assets.find(value => value.id === asset.id);
      requireEditor(prior !== undefined, 'STALE', 'History asset identity does not match the accepted document.');
      return prior.source === asset.source ? asset : { ...asset, source: prior.source, revision: nextRevision(asset.revision) };
    });
    const result = admit(native(() => createCadDocument(document), 'Native history reconstruction failed.', document.documentId));
    return prepare(direction < 0 ? 'undo' : 'redo', result, [], targetIndex);
  };
  const prepareApply = (): CadEditorCandidate | null => {
    live(); requireEditable(); requireEditor(selection !== null, 'INPUT', 'Select an original Surface pole first.');
    invalidatePrepared();
    const transition = selectionTransition;
    if (Object.keys(pending).length === 0) { prepared = null; emit(); return null; }
    const edit: SurfacePoleEdit = { uIndex: selection.uIndex, vIndex: selection.vIndex };
    for (const field of FIELDS) if (Object.hasOwn(pending, field)) {
      const text = pending[field]!.trim();
      const context = { documentId: accepted.document.documentId, bodyId: selection.bodyId, field };
      requireEditor(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text), 'INPUT', 'Pole input must be a decimal or exponent number.', context);
      const value = Number(text);
      requireEditor(Number.isFinite(value), 'INPUT', 'Pole input must be finite.', context);
      edit[field] = value;
    }
    const resolved = native(() => resolveCadGeometryReference(accepted, selection!.reference), 'Native selected Surface resolution failed.', accepted.document.documentId);
    // The complete source is authoritative. The nested one-Surface edit is child proof only.
    const edited = native(() => editSourceSurfaceControlNet({ source: resolved.source, sourceVersion: 0,
      surfaceId: resolved.geometry.id, edits: { poleEdits: [edit] } }),
    'Native complete-source Surface edit failed.', accepted.document.documentId, { bodyId: selection.bodyId });
    native(() => validateSourceSurfaceControlNetEdit(edited), 'Native complete-source edit validation failed.',
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
    return prepare('apply', result, edited.edit.provenance, undefined, transition ?? undefined);
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
      }
      selectionTransition = null; prepared = null; emit(); return null;
    },
    selectSurfacePole(input) {
      requestSelection(input);
    },
    stageSurfacePoleField(field, rawText) {
      live(); requireEditable(); requireEditor(selection !== null, 'INPUT', 'Select an original Surface pole first.');
      requireEditor(FIELDS.includes(field), 'INPUT', 'The pole field is unsupported.');
      requireEditor(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET', 'Pole input must have at most 128 characters.');
      pending = { ...pending, [field]: rawText }; prepared = null; selectionTransition = null; emit();
    },
    discardPending() { live(); pending = {}; prepared = null; selectionTransition = null; emit(); },
    prepareApply,
    prepareOpen(text, options) {
      live(); fileBudget(text);
      const result = admit(native(() => parseCadDocument(text), 'Native document Open failed.'));
      const incomingDisplayIds = sessionDisplayIds(result, options);
      requireResolvedDraft();
      invalidatePrepared();
      return prepare('open', result, [], undefined, undefined, incomingDisplayIds);
    },
    prepareDisplayBodies(bodyIds) {
      live();
      const ids = displayIds(accepted, bodyIds);
      requireEditor(prepared === null && selectionTransition === null, 'INPUT', 'Resolve the current candidate or selection decision first.',
        { documentId: accepted.document.documentId, field: 'display-body-set' });
      return prepare('display', accepted, [], undefined, undefined, ids);
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
        displayBodyIds = copy(current.candidate.displayBodyIds); displayGeneration++; prepared = null;
        const returned = snapshot(); emit(); return returned;
      }
      requireEditor(current.transitionToken === undefined || selectionTransition !== null
        && selectionTransition.token === current.transitionToken && selectionTransition.baseGeneration === generation,
        'STALE', 'The selection decision is no longer current.', { field: 'selection-transition' });
      const target = current.candidate.kind === 'open' || selectedBodyId === null ? null
        : current.selectionTarget ?? { bodyId: selectedBodyId, uIndex: selection?.uIndex, vIndex: selection?.vIndex };
      const nextTarget = target === null ? null : resolveTarget(target, result);
      const nextCapabilities = capabilities(result);
      const state: HistoryState = { document: copy(result.document), bytes: fileBudget(serialize(result)) };
      if (current.candidate.kind === 'open') { history = [state]; historyIndex = 0; }
      else if (current.candidate.kind === 'apply') {
        history = [...history.slice(0, historyIndex + 1), state];
        while (history.length > HISTORY_LIMIT || historyBytes() > HISTORY_BYTES) history.shift();
        historyIndex = history.length - 1;
      } else historyIndex = current.historyIndex!;
      accepted = result; selectedBodyId = nextTarget?.target.bodyId ?? null; selection = nextTarget?.pole ?? null;
      bodyCapabilities = nextCapabilities;
      if (current.candidate.kind === 'open') { displayBodyIds = copy(current.candidate.displayBodyIds); displayGeneration++; }
      generation++; pending = {}; prepared = null; selectionTransition = null;
      lastProvenance = copy(current.candidate.provenance);
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
      disposed = true; prepared = null; selectionTransition = null; download = null; pending = {}; emit(); listeners.clear();
    },
  };
}
