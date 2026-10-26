/** App file format. SDK admission remains the authority for scene and native parameters. */
export const REVIEW_FILE_LIMIT = 32 * 1024;
const FILE_SCHEMA = 'barocss-cad-viewer-review';
const REVIEW_SCHEMA = 'barocss-viewer-review';
const CANDIDATE_SCHEMA = 'barocss-viewer-measured-review';
const encoder = new TextEncoder();
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

function refuse(message) { throw new RangeError(message); }

function record(input, keys, label) {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype)
    refuse(`${label} must be own plain data.`);
  const actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || !actual.every(key => typeof key === 'string' && keys.includes(key)))
    refuse(`${label} has missing or unsupported fields.`);
  const output = {};
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field?.enumerable || !('value' in field)) refuse(`${label}.${key} must be data.`);
    output[key] = field.value;
  }
  return output;
}

function array(input, label) {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype
    || Reflect.ownKeys(input).length !== input.length + 1)
    refuse(`${label} must be a dense plain array.`);
  const output = [];
  for (let index = 0; index < input.length; index++) {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    if (!field?.enumerable || !('value' in field)) refuse(`${label}[${index}] must be data.`);
    output.push(field.value);
  }
  return output;
}

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) refuse(`${label} must be finite.`);
  return value;
}

function string(value, label) {
  if (typeof value !== 'string') refuse(`${label} must be a string.`);
  return value;
}

function tagged(input, surfaceKeys, curveKeys, label) {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype)
    refuse(`${label} must be own plain data.`);
  const kind = Object.getOwnPropertyDescriptor(input, 'kind');
  if (!kind?.enumerable || !('value' in kind) || !['surface', 'curve'].includes(kind.value))
    refuse(`${label}.kind must be surface or curve data.`);
  const value = record(input, kind.value === 'surface' ? surfaceKeys : curveKeys, label);
  string(value.modelId, `${label}.modelId`);
  string(value.kind === 'surface' ? value.surfaceId : value.curveId, `${label} object ID`);
  return value;
}

function copyRef(input, label) {
  return tagged(input, ['kind', 'modelId', 'surfaceId'], ['kind', 'modelId', 'curveId'], label);
}

function copyNativeInput(input, label) {
  const value = tagged(input, ['kind', 'modelId', 'surfaceId', 'u', 'v'],
    ['kind', 'modelId', 'curveId', 't'], label);
  for (const key of value.kind === 'surface' ? ['u', 'v'] : ['t']) finite(value[key], `${label}.${key}`);
  return value;
}

function copyMeasurement(input, sceneKind) {
  if (input === null) return null;
  if (sceneKind === 'assembly') refuse('Native measurement reviews are unavailable for assemblies.');
  const value = record(input, ['first', 'second', 'distanceMM', 'metric', 'space', 'certification'], 'Measurement');
  if (value.metric !== 'straight-line' || value.space !== 'native-authored'
    || value.certification !== 'not-certified') refuse('Unsupported measurement metadata.');
  if (finite(value.distanceMM, 'Measurement.distanceMM') < 0) refuse('Measurement.distanceMM must not be negative.');
  return { first: copyNativeInput(value.first, 'Measurement.first'),
    second: copyNativeInput(value.second, 'Measurement.second'), distanceMM: value.distanceMM,
    metric: value.metric, space: value.space, certification: value.certification };
}

function copyLighting(input) {
  if (input === null) return null;
  const value = record(input, ['ambientStrength', 'directionalStrength', 'direction'], 'Lighting');
  for (const key of ['ambientStrength', 'directionalStrength']) {
    if (finite(value[key], `Lighting.${key}`) < 0 || value[key] > 1)
      refuse(`Lighting.${key} must be between zero and one.`);
  }
  if (value.ambientStrength + value.directionalStrength > 1)
    refuse('Lighting strengths must total one or less.');
  value.direction = array(value.direction, 'Lighting.direction');
  if (value.direction.length !== 3) refuse('Lighting.direction requires three coordinates.');
  for (const coordinate of value.direction) {
    if (Math.abs(finite(coordinate, 'Lighting.direction')) > 1000)
      refuse('Lighting.direction coordinates must be between -1000 and 1000.');
  }
  if (!value.direction.some(coordinate => coordinate !== 0)) refuse('Lighting.direction must not be zero.');
  return value;
}

function copyReview(input) {
  const value = record(input, ['schema', 'version', 'scene', 'camera', 'visibleGeometry', 'selectedGeometry'], 'Review');
  if (value.schema !== REVIEW_SCHEMA || value.version !== 1) refuse('Unsupported Viewer review format.');
  const scene = record(value.scene, ['kind', 'id', 'revision', 'mmToSceneUnit', 'members'], 'Review scene');
  if (!['document', 'assembly'].includes(scene.kind)) refuse('Unsupported review scene kind.');
  string(scene.id, 'Review scene.id'); finite(scene.revision, 'Review scene.revision');
  finite(scene.mmToSceneUnit, 'Review scene.mmToSceneUnit');
  scene.members = array(scene.members, 'Review scene.members').map(member => string(member, 'Review member'));
  const camera = record(value.camera, ['eye', 'target', 'up', 'fovY', 'near', 'far'], 'Review camera');
  for (const key of ['eye', 'target', 'up']) {
    camera[key] = array(camera[key], `Review camera.${key}`);
    if (camera[key].length !== 3) refuse(`Review camera.${key} requires three coordinates.`);
    camera[key].forEach(coordinate => finite(coordinate, `Review camera.${key}`));
  }
  for (const key of ['fovY', 'near', 'far']) finite(camera[key], `Review camera.${key}`);
  return { schema: value.schema, version: value.version, scene, camera,
    visibleGeometry: array(value.visibleGeometry, 'Review visible geometry').map(ref => copyRef(ref, 'Review geometry')),
    selectedGeometry: value.selectedGeometry === null ? null : copyRef(value.selectedGeometry, 'Review selection') };
}

/** Copy source JSON without invoking accessors, toJSON, or retaining caller references. */
function copySource(input, ancestors = new Set(), depth = 0) {
  if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
  if (typeof input === 'number') return finite(input, 'Source number');
  if (typeof input !== 'object' || depth > 64 || ancestors.has(input)) refuse('Source must be finite JSON data.');
  ancestors.add(input);
  try {
    if (Array.isArray(input))
      return array(input, 'Source array').map(value => copySource(value, ancestors, depth + 1));
    if (Object.getPrototypeOf(input) !== Object.prototype) refuse('Source must be own plain data.');
    const output = {};
    for (const key of Reflect.ownKeys(input)) {
      if (typeof key !== 'string' || forbiddenKeys.has(key)) refuse('Unsupported source field.');
      const field = Object.getOwnPropertyDescriptor(input, key);
      if (!field?.enumerable || !('value' in field)) refuse('Source fields must be data.');
      output[key] = copySource(field.value, ancestors, depth + 1);
    }
    return output;
  } finally { ancestors.delete(input); }
}

function sourceText(sourceDocument, sceneKind) {
  if (!sourceDocument || typeof sourceDocument !== 'object' || Array.isArray(sourceDocument))
    refuse('The loaded CAD source is required.');
  const source = copySource(sourceDocument);
  const expectedKind = source.schema === 'barocss-cad-assembly' ? 'assembly'
    : source.schema === 'barocss-cad-document' ? 'document' : null;
  if (expectedKind !== null && sceneKind !== expectedKind)
    refuse('The review scene kind differs from the loaded CAD source.');
  return JSON.stringify(source);
}

function bounded(text) {
  if (text.length > REVIEW_FILE_LIMIT || encoder.encode(text).length > REVIEW_FILE_LIMIT)
    refuse('Choose a review file of 32 KiB or less.');
}

async function sha256(text) {
  const bytes = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(text)));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Snapshot all inputs before hashing. The file contains no CAD source or derived point coordinates. */
export async function createReviewFile(review, measurement, sourceDocument, lighting) {
  const capturedReview = copyReview(review);
  const file = { schema: FILE_SCHEMA, version: 1, sourceSHA256: '0'.repeat(64),
    review: capturedReview, measurement: copyMeasurement(measurement, capturedReview.scene.kind) };
  if (lighting !== undefined) file.lighting = copyLighting(lighting);
  bounded(JSON.stringify(file));
  const capturedSource = sourceText(sourceDocument, capturedReview.scene.kind);
  file.sourceSHA256 = await sha256(capturedSource);
  return file;
}

/** Validate the file and source hash before returning a candidate for atomic SDK admission. */
export async function readReviewFile(text, sourceDocument) {
  if (typeof text !== 'string') refuse('Review text is required.');
  bounded(text);
  let input;
  try { input = JSON.parse(text); }
  catch { refuse('The review file is not valid JSON.'); }
  if (input?.schema === REVIEW_SCHEMA) {
    return { candidate: { schema: CANDIDATE_SCHEMA, version: 1,
      review: copyReview(input), measurement: null }, legacy: true };
  }
  const hasLighting = input !== null && typeof input === 'object' && Object.hasOwn(input, 'lighting');
  const keys = ['schema', 'version', 'sourceSHA256', 'review', 'measurement'];
  if (hasLighting) keys.push('lighting');
  const file = record(input, keys, 'Review file');
  if (file.schema !== FILE_SCHEMA || file.version !== 1) refuse('Unsupported CAD Viewer review file.');
  if (typeof file.sourceSHA256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sourceSHA256))
    refuse('The review source hash is invalid.');
  const capturedReview = copyReview(file.review);
  const candidate = { schema: CANDIDATE_SCHEMA, version: 1,
    review: capturedReview, measurement: copyMeasurement(file.measurement, capturedReview.scene.kind) };
  if (hasLighting) candidate.lighting = copyLighting(file.lighting);
  const capturedSource = sourceText(sourceDocument, capturedReview.scene.kind);
  if (await sha256(capturedSource) !== file.sourceSHA256)
    refuse('The review source differs from the loaded CAD source.');
  return { candidate, legacy: false };
}
