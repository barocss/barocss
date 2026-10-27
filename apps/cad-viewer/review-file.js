/** App file format. SDK admission remains the authority for scene and native parameters. */
export const REVIEW_FILE_LIMIT = 32 * 1024;
const FILE_SCHEMA = 'barocss-cad-viewer-review';
const REVIEW_SCHEMA = 'barocss-viewer-review';
const CANDIDATE_SCHEMA = 'barocss-viewer-measured-review';
const encoder = new TextEncoder();
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

/** Identifies a valid review that belongs to a different loaded CAD source. */
export class ReviewSourceMismatchError extends RangeError {
  constructor(code, message) {
    super(message);
    this.name = 'ReviewSourceMismatchError';
    this.code = code;
  }
}

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

function copyAssemblyPointQuery(input, scene, label) {
  const value = record(input, ['assemblyId', 'assemblyRevision', 'instanceId', 'reference', 'query'], label);
  string(value.assemblyId, `${label}.assemblyId`);
  string(value.instanceId, `${label}.instanceId`);
  if (!Number.isInteger(value.assemblyRevision) || value.assemblyRevision < 0 || value.assemblyRevision > 2147483647)
    refuse(`${label}.assemblyRevision must be a valid revision.`);
  if (value.assemblyId !== scene.id || value.assemblyRevision !== scene.revision)
    refuse(`${label} must match the review assembly identity and revision.`);
  const reference = record(value.reference, ['schema', 'version', 'documentId', 'documentRevision', 'bodyId',
    'assetId', 'assetRevision', 'geometryId', 'geometryKind', 'sourceVersion', 'sourceFrame', 'lengthUnit'],
  `${label}.reference`);
  if (reference.schema !== 'barocss-cad-geometry-reference' || reference.version !== 0
    || reference.sourceVersion !== 0 || reference.sourceFrame !== 'authored-xyz-no-axis-conversion'
    || reference.lengthUnit !== 'mm' || !['curve', 'surface'].includes(reference.geometryKind))
    refuse(`${label}.reference is unsupported.`);
  for (const key of ['documentId', 'bodyId', 'assetId', 'geometryId']) string(reference[key], `${label}.reference.${key}`);
  for (const key of ['documentRevision', 'assetRevision']) {
    if (!Number.isInteger(reference[key]) || reference[key] < 0 || reference[key] > 2147483647)
      refuse(`${label}.reference.${key} must be a valid revision.`);
  }
  const query = record(value.query, reference.geometryKind === 'curve' ? ['kind', 'parameter'] : ['kind', 'u', 'v'],
    `${label}.query`);
  if (query.kind !== reference.geometryKind) refuse(`${label}.query kind must match the reference.`);
  for (const key of query.kind === 'curve' ? ['parameter'] : ['u', 'v']) finite(query[key], `${label}.query.${key}`);
  return { assemblyId: value.assemblyId, assemblyRevision: value.assemblyRevision,
    instanceId: value.instanceId, reference, query };
}

/** Copy file data only. The Viewer re-evaluates both points before admission. */
function copyAssemblyMeasurement(input, scene) {
  if (scene.kind !== 'assembly') refuse('Assembly measurements require an assembly review.');
  if (input === null) return null;
  const value = record(input, ['first', 'second', 'distanceMM', 'metric', 'space', 'certification'], 'Assembly measurement');
  if (value.metric !== 'straight-line' || value.space !== 'assembly-space-xyz'
    || value.certification !== 'not-certified') refuse('Unsupported assembly measurement metadata.');
  if (finite(value.distanceMM, 'Assembly measurement.distanceMM') < 0)
    refuse('Assembly measurement.distanceMM must not be negative.');
  return { first: copyAssemblyPointQuery(value.first, scene, 'Assembly measurement.first'),
    second: copyAssemblyPointQuery(value.second, scene, 'Assembly measurement.second'),
    distanceMM: value.distanceMM, metric: value.metric, space: value.space, certification: value.certification };
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

function copyScene(input) {
  const scene = record(input, ['kind', 'id', 'revision', 'mmToSceneUnit', 'members'], 'Review scene');
  if (!['document', 'assembly'].includes(scene.kind)) refuse('Unsupported review scene kind.');
  string(scene.id, 'Review scene.id'); finite(scene.revision, 'Review scene.revision');
  finite(scene.mmToSceneUnit, 'Review scene.mmToSceneUnit');
  scene.members = array(scene.members, 'Review scene.members').map(member => string(member, 'Review member'));
  return scene;
}

function copyReview(input) {
  const value = record(input, ['schema', 'version', 'scene', 'camera', 'visibleGeometry', 'selectedGeometry'], 'Review');
  if (value.schema !== REVIEW_SCHEMA || value.version !== 1) refuse('Unsupported Viewer review format.');
  const scene = copyScene(value.scene);
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

/** Copy file-shaped named views. SDK preflight remains the authority for display and native semantics. */
export function copyNamedViews(input, scene) {
  const expected = copyScene(scene);
  if (!Array.isArray(input) || input.length > 8) refuse('Named views require an array of zero to eight entries.');
  const names = new Set();
  return array(input, 'Named views').map((entry, index) => {
    const hasLighting = entry !== null && typeof entry === 'object' && Object.hasOwn(entry, 'lighting');
    const keys = ['name', 'review', 'measurement'];
    if (hasLighting) keys.push('lighting');
    const value = record(entry, keys, `Named view ${index + 1}`);
    const name = string(value.name, 'Named view name');
    if (name.length < 1 || name.length > 64 || name.trim() !== name || /[\x00-\x1f\x7f-\x9f]/.test(name))
      refuse('Named view names require 1 to 64 trimmed characters without control characters.');
    if (names.has(name)) refuse('Named view names must be unique.');
    names.add(name);
    const review = copyReview(value.review), actual = review.scene;
    if (actual.kind !== expected.kind || actual.id !== expected.id || actual.revision !== expected.revision
      || actual.mmToSceneUnit !== expected.mmToSceneUnit || actual.members.length !== expected.members.length
      || actual.members.some((member, memberIndex) => member !== expected.members[memberIndex]))
      refuse('Named view scene differs from the current review scene.');
    const copied = { name, review, measurement: copyMeasurement(value.measurement, actual.kind) };
    if (hasLighting) copied.lighting = copyLighting(value.lighting);
    return copied;
  });
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

/** The caller computes the hash from the original IGES bytes before conversion. */
function copyOrigin(input) {
  const origin = record(input, ['format', 'sourceSHA256', 'mappings'], 'Review origin');
  if (origin.format !== 'iges-5.3-126-128') refuse('Unsupported review origin format.');
  if (typeof origin.sourceSHA256 !== 'string' || !/^[a-f0-9]{64}$/.test(origin.sourceSHA256))
    refuse('The original IGES hash is invalid.');
  const mappings = array(origin.mappings, 'Review origin mappings');
  if (mappings.length < 1 || mappings.length > 16) refuse('Review origin requires 1 to 16 IGES mappings.');
  const nativeIds = new Set(), bodyIds = new Set();
  const copied = mappings.map((inputMapping, index) => {
    const mapping = record(inputMapping, ['directoryPointer', 'nativeId', 'bodyId'], `Review origin mapping ${index + 1}`);
    if (mapping.directoryPointer !== 2 * index + 1)
      refuse('Review origin mappings require ordered IGES Directory pointers.');
    for (const key of ['nativeId', 'bodyId']) {
      if (typeof mapping[key] !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(mapping[key]))
        refuse(`Review origin mapping ${key} must be a bounded ASCII identifier.`);
    }
    if (nativeIds.has(mapping.nativeId) || bodyIds.has(mapping.bodyId))
      refuse('Review origin mappings must have unique native and body IDs.');
    nativeIds.add(mapping.nativeId); bodyIds.add(mapping.bodyId);
    return mapping;
  });
  return { format: origin.format, sourceSHA256: origin.sourceSHA256, mappings: copied };
}

function checkOriginDocument(origin, sourceDocument, scene) {
  if (scene.kind !== 'document') refuse('An IGES origin requires a document review.');
  const source = copySource(sourceDocument);
  if (source?.schema !== 'barocss-cad-document' || !Array.isArray(source.assets) || source.assets.length !== 1
    || !Array.isArray(source.bodies) || source.bodies.length !== origin.mappings.length)
    refuse('The IGES origin requires its generated CAD document.');
  origin.mappings.forEach((mapping, index) => {
    const body = source.bodies[index];
    if (!body || body.id !== mapping.bodyId || body.geometryId !== mapping.nativeId
      || body.assetId !== source.assets[0]?.id || body.kind !== 'direct-geometry-object')
      refuse('The IGES origin mapping differs from its generated CAD document.');
  });
}

function originMismatch() {
  throw new ReviewSourceMismatchError('SOURCE_ORIGIN_MISMATCH', 'The review original source or IGES mapping differs.');
}

function sourceText(sourceDocument, sceneKind, classifyMismatch = false) {
  if (!sourceDocument || typeof sourceDocument !== 'object' || Array.isArray(sourceDocument))
    refuse('The loaded CAD source is required.');
  const source = copySource(sourceDocument);
  const expectedKind = source.schema === 'barocss-cad-assembly' ? 'assembly'
    : source.schema === 'barocss-cad-document' ? 'document' : null;
  if (expectedKind !== null && sceneKind !== expectedKind) {
    const message = 'The review scene kind differs from the loaded CAD source.';
    if (classifyMismatch) throw new ReviewSourceMismatchError('SOURCE_KIND_MISMATCH', message);
    refuse(message);
  }
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
export async function createReviewFile(review, measurement, sourceDocument, lighting, namedViews, assemblyMeasurement, origin) {
  const capturedReview = copyReview(review);
  const file = { schema: FILE_SCHEMA, version: 1, sourceSHA256: '0'.repeat(64),
    review: capturedReview, measurement: copyMeasurement(measurement, capturedReview.scene.kind) };
  if (lighting !== undefined) file.lighting = copyLighting(lighting);
  if (namedViews !== undefined) file.namedViews = copyNamedViews(namedViews, capturedReview.scene);
  if (assemblyMeasurement !== undefined) file.assemblyMeasurement = copyAssemblyMeasurement(assemblyMeasurement, capturedReview.scene);
  if (origin !== undefined) {
    file.origin = copyOrigin(origin);
    checkOriginDocument(file.origin, sourceDocument, capturedReview.scene);
  }
  bounded(JSON.stringify(file));
  const capturedSource = sourceText(sourceDocument, capturedReview.scene.kind);
  file.sourceSHA256 = await sha256(capturedSource);
  return file;
}

/** Validate the file and source hash before returning a candidate for atomic SDK admission. */
export async function readReviewFile(text, sourceDocument, expectedOrigin) {
  if (typeof text !== 'string') refuse('Review text is required.');
  bounded(text);
  const capturedOrigin = expectedOrigin === undefined ? null : copyOrigin(expectedOrigin);
  let input;
  try { input = JSON.parse(text); }
  catch { refuse('The review file is not valid JSON.'); }
  if (input?.schema === REVIEW_SCHEMA) {
    if (capturedOrigin) originMismatch();
    return { candidate: { schema: CANDIDATE_SCHEMA, version: 1,
      review: copyReview(input), measurement: null }, legacy: true };
  }
  const hasLighting = input !== null && typeof input === 'object' && Object.hasOwn(input, 'lighting');
  const hasNamedViews = input !== null && typeof input === 'object' && Object.hasOwn(input, 'namedViews');
  const hasAssemblyMeasurement = input !== null && typeof input === 'object' && Object.hasOwn(input, 'assemblyMeasurement');
  const hasOrigin = input !== null && typeof input === 'object' && Object.hasOwn(input, 'origin');
  const keys = ['schema', 'version', 'sourceSHA256', 'review', 'measurement'];
  if (hasLighting) keys.push('lighting');
  if (hasNamedViews) keys.push('namedViews');
  if (hasAssemblyMeasurement) keys.push('assemblyMeasurement');
  if (hasOrigin) keys.push('origin');
  const file = record(input, keys, 'Review file');
  if (file.schema !== FILE_SCHEMA || file.version !== 1) refuse('Unsupported CAD Viewer review file.');
  if (typeof file.sourceSHA256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sourceSHA256))
    refuse('The review source hash is invalid.');
  const capturedReview = copyReview(file.review);
  const fileOrigin = hasOrigin ? copyOrigin(file.origin) : null;
  if (Boolean(fileOrigin) !== Boolean(capturedOrigin)
    || fileOrigin && JSON.stringify(fileOrigin) !== JSON.stringify(capturedOrigin)) originMismatch();
  if (fileOrigin) checkOriginDocument(fileOrigin, sourceDocument, capturedReview.scene);
  const candidate = { schema: CANDIDATE_SCHEMA, version: 1,
    review: capturedReview, measurement: copyMeasurement(file.measurement, capturedReview.scene.kind) };
  if (hasLighting) candidate.lighting = copyLighting(file.lighting);
  const namedViews = hasNamedViews ? copyNamedViews(file.namedViews, capturedReview.scene) : undefined;
  const assemblyMeasurement = hasAssemblyMeasurement ? copyAssemblyMeasurement(file.assemblyMeasurement, capturedReview.scene) : undefined;
  const capturedSource = sourceText(sourceDocument, capturedReview.scene.kind, true);
  if (await sha256(capturedSource) !== file.sourceSHA256)
    throw new ReviewSourceMismatchError('SOURCE_HASH_MISMATCH', 'The review source differs from the loaded CAD source.');
  return { candidate, legacy: false, ...(hasNamedViews ? { namedViews } : {}),
    ...(hasAssemblyMeasurement ? { assemblyMeasurement } : {}) };
}
