import {
  compileCadModel, createCadDocument, createCadGeometryReference, editSurfaceControlNet,
  parseCadDocument, resolveCadGeometryReference, serializeCadDocument,
  validateCadDocumentResult, validateCurve, validateSurface,
} from '@barocss/cad';
import type { CadDocumentResult, CadDocumentV1, Surface, SurfacePoleEdit } from '@barocss/cad';
import { CadEditorError } from './types.js';
import type {
  CadEditorCandidate, CadEditorDiagnosticCode, CadEditorPoleField, CadEditorSelectedPole,
  CadEditorSession, CadEditorSnapshot, CadEditorSurfaceSelection,
} from './types.js';

const FILE_LIMIT = 524288;
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
    throw new CadEditorError('NATIVE', message, { documentId, ...context }, cause);
  }
}

function fileBudget(text: string): number {
  requireEditor(typeof text === 'string', 'INPUT', 'Native document text is required.');
  requireEditor(text.length <= FILE_LIMIT, 'BUDGET', 'Document exceeds 524288 code units.');
  const bytes = utf8Bytes(text);
  requireEditor(bytes <= FILE_LIMIT, 'BUDGET', 'Document exceeds 524288 UTF-8 bytes.');
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
  requireEditor(result.document.assets.length === 2 && result.document.bodies.length === 2,
    'UNSUPPORTED', 'This editor requires two assets and two bodies: one original Surface and one original Curve.');
  const kinds: string[] = [];
  for (const asset of result.document.assets) {
    const compiled = native(() => compileCadModel(asset.source, { sourceVersion: 0 }), 'Native source compilation failed.', documentId);
    requireEditor(compiled.ok, 'NATIVE', 'Native source compilation refused the asset.');
    requireEditor(compiled.ast.declarations.length === 1 && compiled.constructions.length === 0
      && compiled.ir.nodes.length === 1 && compiled.ir.dependencies.length === 0
      && compiled.model.objects.length === 1,
    'UNSUPPORTED', 'Each asset must contain one original geometry object without construction nodes.');
    const geometry = compiled.model.objects[0];
    requireEditor(compiled.ast.declarations[0].kind === geometry.kind && compiled.ir.nodes[0].kind === geometry.kind,
      'UNSUPPORTED', 'Only original Surface and Curve declarations are supported.');
    const bodies = result.document.bodies.filter(body => body.assetId === asset.id);
    requireEditor(bodies.length === 1 && bodies[0].geometryId === geometry.id,
      'UNSUPPORTED', 'Each body must reference its complete original asset geometry.');
    kinds.push(geometry.kind);
    if (geometry.kind === 'surface') {
      native(() => validateSurface(geometry), 'Native Surface validation failed.', documentId);
      requireEditor(geometry.id.length <= 48 && geometry.degreeU <= 3 && geometry.degreeV <= 3,
        'UNSUPPORTED', 'Surface IDs must have at most 48 characters. Surface degrees must be 1 through 3.');
      requireEditor(geometry.controlPoints.every(row => row.every(point => point.every(value => Math.abs(value) <= 10000))),
        'UNSUPPORTED', 'Surface coordinates must be within 10000 mm of zero.');
    } else {
      native(() => validateCurve(geometry), 'Native Curve validation failed.', documentId);
      let spans = 0;
      for (let index = geometry.degree; index < geometry.controlPoints.length; index++)
        if (geometry.knots[index] < geometry.knots[index + 1]) spans++;
      requireEditor(geometry.id.length <= 48 && geometry.degree <= 3 && geometry.controlPoints.length <= 16 && spans <= 8,
        'UNSUPPORTED', 'Curve display requires IDs of at most 48 characters, degree 1 through 3, at most 16 poles and at most 8 spans.');
      requireEditor(geometry.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)),
        'UNSUPPORTED', 'Curve display coordinates must be within 10000 mm of zero.');
    }
  }
  requireEditor(kinds.filter(kind => kind === 'surface').length === 1 && kinds.filter(kind => kind === 'curve').length === 1,
    'UNSUPPORTED', 'This editor requires one Surface asset and one separate Curve asset.');
  serialize(result);
  return result;
}

function nextRevision(revision: number): number {
  requireEditor(revision < REVISION_LIMIT, 'REVISION', 'Native revision limit reached.');
  return revision + 1;
}

interface HistoryState { document: CadDocumentV1; bytes: number }
interface Prepared { candidate: CadEditorCandidate; historyIndex?: number }

/** Create an owned source-authoritative editor. No renderer or browser resources are created. */
export function createCadEditorSession(initialDocument: CadDocumentV1): CadEditorSession {
  let accepted = admit(native(() => createCadDocument(initialDocument), 'Initial native document creation failed.'));
  const sessionId = ++sessionSequence;
  let tokenSequence = 0;
  let generation = 0;
  let disposed = false;
  let selection: CadEditorSelectedPole | null = null;
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
    accepted, generation, selection, pending, candidate: prepared?.candidate ?? null,
    history: { index: historyIndex, count: history.length, bytes: historyBytes(), canUndo: historyIndex > 0, canRedo: historyIndex < history.length - 1 },
    dirty, downloadStatus, disposed, lastProvenance,
  });
  const select = (input: CadEditorSurfaceSelection, document = accepted): CadEditorSelectedPole => {
    requireEditor(input !== null && typeof input === 'object' && typeof input.bodyId === 'string', 'INPUT', 'Surface body selection is required.');
    const reference = native(() => createCadGeometryReference(document, { bodyId: input.bodyId }), 'Native body reference creation failed.', document.document.documentId).reference;
    const resolved = native(() => resolveCadGeometryReference(document, reference), 'Native body reference resolution failed.', document.document.documentId);
    requireEditor(resolved.geometry.kind === 'surface', 'UNSUPPORTED', 'Curve poles are read-only in this editor.');
    const surface = resolved.geometry;
    const countU = surface.controlPoints.length, countV = surface.controlPoints[0].length;
    requireEditor(Number.isInteger(input.uIndex) && input.uIndex >= 0 && input.uIndex < countU
      && Number.isInteger(input.vIndex) && input.vIndex >= 0 && input.vIndex < countV, 'INPUT', 'Pole indices must be inside the original Surface grid.');
    const point = surface.controlPoints[input.uIndex][input.vIndex];
    return { bodyId: input.bodyId, uIndex: input.uIndex, vIndex: input.vIndex, reference, countU, countV,
      accepted: { xMM: point[0], yMM: point[1], zMM: point[2], weight: surface.weights[input.uIndex][input.vIndex] } };
  };
  const prepare = (kind: CadEditorCandidate['kind'], result: CadDocumentResult,
    provenance: CadEditorCandidate['provenance'] = [], targetIndex?: number): CadEditorCandidate => {
    prepared = { candidate: { kind, result, provenance, token: newToken(), baseGeneration: generation }, historyIndex: targetIndex };
    const returned = copy(prepared.candidate);
    emit();
    return returned;
  };
  const restore = (direction: -1 | 1): CadEditorCandidate => {
    live();
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

  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      live(); requireEditor(typeof listener === 'function', 'INPUT', 'A subscription listener is required.');
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    selectSurfacePole(input) {
      live(); const next = select(input);
      selection = next; pending = {}; prepared = null; emit();
    },
    stageSurfacePoleField(field, rawText) {
      live(); requireEditor(selection !== null, 'INPUT', 'Select an original Surface pole first.');
      requireEditor(FIELDS.includes(field), 'INPUT', 'The pole field is unsupported.');
      requireEditor(typeof rawText === 'string' && rawText.length <= 128, 'BUDGET', 'Pole input must have at most 128 characters.');
      pending = { ...pending, [field]: rawText }; prepared = null; emit();
    },
    discardPending() { live(); pending = {}; prepared = null; emit(); },
    prepareApply() {
      live(); requireEditor(selection !== null, 'INPUT', 'Select an original Surface pole first.');
      invalidatePrepared();
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
      // Finite authored scalars reach the actual native complete-grid/range validator.
      const edited = native(() => editSurfaceControlNet(resolved.geometry as Surface, { poleEdits: [edit] }),
        'Native Surface control-net edit failed.', accepted.document.documentId, { bodyId: selection.bodyId });
      if (edited.provenance.every(pole => pole.changedFields.length === 0)) { pending = {}; prepared = null; emit(); return null; }
      const document = copy(accepted.document);
      document.revision = nextRevision(document.revision);
      document.assets = document.assets.map(asset => asset.id === selection!.reference.assetId
        ? { ...asset, source: edited.source, revision: nextRevision(asset.revision) } : asset);
      const result = admit(native(() => createCadDocument(document), 'Native edited document creation failed.', document.documentId));
      return prepare('apply', result, edited.provenance);
    },
    prepareOpen(text) {
      live(); invalidatePrepared(); fileBudget(text);
      const result = admit(native(() => parseCadDocument(text), 'Native document Open failed.'));
      return prepare('open', result);
    },
    prepareUndo() { return restore(-1); },
    prepareRedo() { return restore(1); },
    acceptCandidate(token) {
      live();
      requireEditor(prepared !== null && prepared.candidate.token === token && prepared.candidate.baseGeneration === generation,
        'STALE', 'The prepared candidate is no longer current.');
      const current = prepared;
      const result = current.candidate.result;
      const nextSelection = current.candidate.kind === 'open' || selection === null ? null : select(selection, result);
      const state: HistoryState = { document: copy(result.document), bytes: fileBudget(serialize(result)) };
      if (current.candidate.kind === 'open') { history = [state]; historyIndex = 0; }
      else if (current.candidate.kind === 'apply') {
        history = [...history.slice(0, historyIndex + 1), state];
        while (history.length > HISTORY_LIMIT || historyBytes() > HISTORY_BYTES) history.shift();
        historyIndex = history.length - 1;
      } else historyIndex = current.historyIndex!;
      accepted = result; selection = nextSelection; generation++; pending = {}; prepared = null;
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
      disposed = true; prepared = null; download = null; pending = {}; emit(); listeners.clear();
    },
  };
}
