import { createCadGeometryReference, queryCadDocumentPoint } from '@barocss/cad';

function refuse(message) { throw new RangeError(message); }
function field(input, key, label) {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype)
    refuse(`${label} must be own plain data.`);
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) refuse(`${label}.${key} must be data.`);
  return descriptor.value;
}
function sameData(left, right, remaining = { count: 1048576 }, depth = 0) {
  if (--remaining.count < 0 || depth > 64) return false;
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const array = Array.isArray(left);
  if (array !== Array.isArray(right) || Object.getPrototypeOf(left) !== (array ? Array.prototype : Object.prototype)
    || Object.getPrototypeOf(right) !== (array ? Array.prototype : Object.prototype)) return false;
  const keys = Reflect.ownKeys(left), other = Reflect.ownKeys(right);
  if (keys.length !== other.length || !keys.every(key => typeof key === 'string' && other.includes(key))) return false;
  return keys.every(key => {
    const a = Object.getOwnPropertyDescriptor(left, key), b = Object.getOwnPropertyDescriptor(right, key);
    return a && b && 'value' in a && 'value' in b && a.enumerable === b.enumerable
      && sameData(a.value, b.value, remaining, depth + 1);
  });
}
function sameRef(left, right) {
  return sameData(left, right);
}

/** Resolve one current visible document body to its exact original native binding. */
export function resolveDocumentInspection(source, state) {
  if (field(source, 'kind', 'CAD source') !== 'document') refuse('Native point inspection requires a CAD document.');
  if (field(state, 'status', 'Viewer state') !== 'ready') refuse('Native point inspection requires a ready Viewer.');
  const sourceResult = field(source, 'result', 'CAD source');
  const sourceDocument = field(sourceResult, 'document', 'CAD document result');
  const accepted = field(state, 'document', 'Viewer state');
  if (!accepted || field(state, 'assembly', 'Viewer state') !== null)
    refuse('Native point inspection requires an accepted CAD document.');
  const acceptedDocument = field(accepted, 'document', 'Accepted CAD document');
  if (field(source, 'id', 'CAD source') !== field(sourceDocument, 'documentId', 'CAD document')
    || field(source, 'revision', 'CAD source') !== field(sourceDocument, 'revision', 'CAD document')
    || field(acceptedDocument, 'documentId', 'Accepted CAD document') !== field(sourceDocument, 'documentId', 'CAD document')
    || field(acceptedDocument, 'revision', 'Accepted CAD document') !== field(sourceDocument, 'revision', 'CAD document'))
    refuse('The document identity or revision differs from the accepted source.');
  if (!sameData(field(source, 'source', 'CAD source'), sourceDocument) || !sameData(accepted, sourceResult))
    refuse('The document source differs from the accepted Viewer document.');
  const selected = field(state, 'selectedGeometry', 'Viewer state');
  if (!selected) refuse('Select a visible admitted document body first.');
  const visible = field(state, 'visibleGeometry', 'Viewer state');
  const bodies = field(state, 'documentBodies', 'Viewer state');
  if (!Array.isArray(visible) || !visible.some(ref => sameRef(ref, selected)))
    refuse('Native point inspection requires a visible document body.');
  if (!Array.isArray(bodies)) refuse('The accepted document body bindings are unavailable.');
  const body = bodies.find(entry => sameRef(field(entry, 'ref', 'Document body'), selected));
  if (!body) refuse('Native point inspection requires an admitted document body.');
  const binding = field(body, 'binding', 'Document body');
  const original = createCadGeometryReference(sourceResult, { bodyId: field(binding, 'bodyId', 'Document binding') });
  const reference = original.reference;
  const assets = field(sourceDocument, 'assets', 'CAD document');
  const compiledAssets = field(sourceResult, 'compiledAssets', 'CAD document result');
  const asset = assets.find(value => field(value, 'id', 'CAD asset') === reference.assetId);
  const compiled = compiledAssets.find(value => field(value, 'assetId', 'Compiled CAD asset') === reference.assetId);
  if (!asset || !compiled) refuse('The original native asset binding is unavailable.');
  const model = field(compiled, 'model', 'Compiled CAD asset');
  const geometryField = reference.geometryKind === 'surface' ? 'surfaceId' : 'curveId';
  const inventory = field(state, reference.geometryKind === 'surface' ? 'surfaces' : 'curves', 'Viewer state');
  const displayModelId = field(selected, 'modelId', 'Selected geometry');
  const displayed = Array.isArray(inventory) && inventory.some(entry =>
    field(entry, 'modelId', 'Displayed geometry') === displayModelId
    && field(entry, geometryField, 'Displayed geometry') === reference.geometryId);
  const expectedBinding = { documentId: reference.documentId, documentRevision: reference.documentRevision,
    nativeFrame: field(sourceDocument, 'nativeFrame', 'CAD document'), bodyId: reference.bodyId,
    assetId: reference.assetId, assetRevision: reference.assetRevision, sourceFrame: reference.sourceFrame,
    modelId: field(model, 'name', 'Original native model'), geometryKind: reference.geometryKind, geometryId: reference.geometryId };
  if (!displayed || field(selected, 'kind', 'Selected geometry') !== reference.geometryKind
    || field(selected, geometryField, 'Selected geometry') !== reference.geometryId || !sameData(binding, expectedBinding)
    || field(asset, 'revision', 'CAD asset') !== reference.assetRevision
    || field(asset, 'source', 'CAD asset') !== field(compiled, 'source', 'Compiled CAD asset'))
    refuse('The selected native body reference differs from the accepted document binding.');
  return { result: sourceResult, reference, geometry: original.geometry };
}

/** Inspect one current selected document body in original authored XYZ/mm. No display query is used. */
export function inspectDocumentPoint(source, state, query) {
  const { result, reference } = resolveDocumentInspection(source, state);
  return queryCadDocumentPoint(result, reference, query);
}
