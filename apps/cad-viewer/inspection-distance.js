import { inspectDocumentPoint } from './native-inspection.js';

function data(input, key, label) {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype)
    throw new RangeError(`${label} must be own plain data.`);
  const descriptor = Object.getOwnPropertyDescriptor(input, key);
  if (!descriptor?.enumerable || !('value' in descriptor)) throw new RangeError(`${label}.${key} must be data.`);
  return descriptor.value;
}
function sameReference(actual, expected) {
  if (!actual || typeof actual !== 'object' || Object.getPrototypeOf(actual) !== Object.prototype) return false;
  const keys = Object.keys(expected);
  return Reflect.ownKeys(actual).length === keys.length && keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(actual, key);
    return descriptor?.enumerable && 'value' in descriptor && Object.is(descriptor.value, expected[key]);
  });
}
function sameRef(left, right) {
  return left.kind === right.kind && left.modelId === right.modelId
    && (left.kind === 'surface' ? left.surfaceId === right.surfaceId : left.curveId === right.curveId);
}
function inputRef(input) {
  const kind = data(input, 'kind', 'Point A');
  if (kind !== 'surface' && kind !== 'curve') throw new RangeError('Point A must be a native Surface or Curve point.');
  const modelId = data(input, 'modelId', 'Point A');
  return kind === 'surface' ? { kind, modelId, surfaceId: data(input, 'surfaceId', 'Point A') }
    : { kind, modelId, curveId: data(input, 'curveId', 'Point A') };
}

/** Re-evaluate the accepted inspection query without writing a Viewer query cache. */
export function prepareInspectedDistancePoint(source, state, inspection) {
  const bodyId = data(inspection, 'bodyId', 'Native inspection');
  const accepted = data(inspection, 'result', 'Native inspection');
  const query = data(accepted, 'query', 'Accepted native point');
  const reference = data(accepted, 'reference', 'Accepted native point');
  const evaluated = inspectDocumentPoint(source, state, query);
  if (bodyId !== evaluated.reference.bodyId || !sameReference(reference, evaluated.reference))
    throw new RangeError('The accepted native point differs from the current document body or revision.');
  const body = state.documentBodies.find(entry => entry.binding.bodyId === bodyId);
  const ref = body.ref;
  const input = evaluated.query.kind === 'surface'
    ? { kind: 'surface', modelId: ref.modelId, surfaceId: ref.surfaceId,
      u: evaluated.query.u, v: evaluated.query.v }
    : { kind: 'curve', modelId: ref.modelId, curveId: ref.curveId, t: evaluated.query.parameter };
  return { input, point: { pointMM: [...evaluated.pointMM] } };
}

/** Complete the existing native distance only after both current display refs are admitted and visible. */
export function measureInspectedDistance(viewer, source, inspection, firstInput) {
  const state = viewer.getState();
  const point = prepareInspectedDistancePoint(source, state, inspection);
  const first = inputRef(firstInput);
  if (!state.documentBodies.some(body => sameRef(body.ref, first)))
    throw new RangeError('Point A must reference a currently admitted document body.');
  if (!state.visibleGeometry.some(ref => sameRef(ref, first)))
    throw new RangeError('Show the document body for point A first.');
  if (first.modelId !== point.input.modelId)
    throw new RangeError('Choose the second point in the same asset as point A.');
  const result = viewer.measureNativePoints(firstInput, point.input);
  return { point, result };
}
