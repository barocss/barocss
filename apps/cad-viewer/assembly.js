import { parseBaroCadAssembly } from '@barocss/cad-interop/assembly';
import { curveDomain, surfaceDomain } from '@barocss/cad';

const FILE_LIMIT = 2 * 1024 * 1024;
const INSTANCE_ID = /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/;
const PREFERRED_INSTANCES = ['child', 'surface_grandchild', 'shared_root', 'asset_b_instance'];
const midpoint = domain => domain[0] / 2 + domain[1] / 2;

/** Keep all original occurrences. The SDK remains the final display admission authority. */
export function parseAssembly(text, label = 'CAD assembly') {
  if (typeof text !== 'string') throw new TypeError('CAD assembly text is required.');
  if (text.length > FILE_LIMIT || new TextEncoder().encode(text).length > FILE_LIMIT)
    throw new RangeError('Choose a CAD assembly of 2 MiB or less.');
  const result = parseBaroCadAssembly(text);
  const { assembly, documents, instances } = result;
  const catalog = instances.map(instance => {
    const reference = instance.reference;
    const part = documents.find(value => value.document.documentId === reference.documentId);
    const document = part?.document;
    const body = document?.bodies.find(value => value.id === reference.bodyId);
    const asset = document?.assets.find(value => value.id === reference.assetId);
    const compiled = part?.compiledAssets.find(value => value.assetId === reference.assetId);
    const binding = part?.bodyBindings.find(value => value.bodyId === reference.bodyId);
    const geometry = compiled?.model.objects.find(value => value.id === reference.geometryId
      && value.kind === reference.geometryKind);
    let reason = '', nativeQuery, nativeDomain;
    if (assembly.lengthUnit !== 'mm' || assembly.rotationUnit !== 'deg' || assembly.frame !== 'assembly-space-xyz')
      reason = 'This Viewer requires assembly millimetres, degrees and the authored XYZ frame.';
    else if (document?.units.length !== 'mm' || document.units.angle !== 'rad')
      reason = 'The original part must use millimetres and radians.';
    else if (body?.kind !== 'direct-geometry-object' || !['surface', 'curve'].includes(reference.geometryKind))
      reason = 'This Viewer supports direct native Surfaces and Curves.';
    else if (!asset || !compiled || !binding || !geometry || binding.assetId !== reference.assetId
      || binding.geometryId !== reference.geometryId || binding.geometryKind !== reference.geometryKind)
      reason = 'The original native body binding is incomplete.';
    else if (document.nativeFrame !== 'authored-xyz-no-axis-conversion'
      || asset.sourceFrame !== 'authored-xyz-no-axis-conversion')
      reason = 'The original part must use the authored XYZ frame.';
    else if (compiled.model.objects.length > 16)
      reason = 'The source asset exceeds the current 16 native object limit.';
    else if ([3, 7, 11].some(index => !Number.isFinite(instance.worldMatrix[index])
      || Math.abs(instance.worldMatrix[index]) > 10000))
      reason = 'The authored world translation exceeds the current ±10000 mm display limit.';
    if (geometry) {
      try {
        if (geometry.kind === 'curve') {
          const domain = curveDomain(geometry);
          nativeDomain = { kind: 'curve', parameter: [...domain] };
          nativeQuery = { kind: 'curve', parameter: midpoint(domain) };
        } else if (geometry.kind === 'surface') {
          const domain = surfaceDomain(geometry);
          nativeDomain = { kind: 'surface', u: [...domain.u], v: [...domain.v] };
          nativeQuery = { kind: 'surface', u: midpoint(domain.u), v: midpoint(domain.v) };
        }
      } catch {
        reason ||= 'The original native parameter domain is unavailable.';
      }
    }
    return { id: instance.instanceId, name: instance.instanceId, kind: reference.geometryKind,
      geometryId: reference.geometryId, assetId: reference.assetId, assetRevision: reference.assetRevision,
      supported: reason === '', reason, parentId: instance.parentId, ancestors: [...instance.ancestors],
      reference: structuredClone(reference), localMatrix: [...instance.localMatrix], worldMatrix: [...instance.worldMatrix],
      ...(nativeQuery ? { nativeQuery, nativeDomain } : {}) };
  });
  const preferred = PREFERRED_INSTANCES.filter(id => catalog.some(entry => entry.id === id && entry.supported));
  const defaultBodyIds = preferred.length ? preferred : catalog.filter(entry => entry.supported).slice(0, 4).map(entry => entry.id);
  return { kind: 'assembly', result, id: assembly.assemblyId, revision: assembly.revision,
    label: typeof label === 'string' && label.trim() ? label : 'CAD assembly',
    catalog, defaultBodyIds, source: assembly };
}

/** Exact public loadAssembly options. Native units are fixed internally by the SDK. */
export function assemblyLoadOptions(instanceIds) {
  if (!Array.isArray(instanceIds) || Object.getPrototypeOf(instanceIds) !== Array.prototype)
    throw new RangeError('Choose 1 to 4 distinct supported instances.');
  const length = Object.getOwnPropertyDescriptor(instanceIds, 'length');
  if (!length || !('value' in length) || !Number.isInteger(length.value) || length.value < 1 || length.value > 4
    || Reflect.ownKeys(instanceIds).length !== length.value + 1)
    throw new RangeError('Choose 1 to 4 distinct supported instances.');
  const ids = [];
  for (let index = 0; index < length.value; index++) {
    const field = Object.getOwnPropertyDescriptor(instanceIds, String(index));
    if (!field?.enumerable || !('value' in field) || typeof field.value !== 'string' || !INSTANCE_ID.test(field.value))
      throw new RangeError('Choose 1 to 4 distinct supported instances.');
    ids.push(field.value);
  }
  if (new Set(ids).size !== ids.length) throw new RangeError('Choose 1 to 4 distinct supported instances.');
  // A Proxy must not become an ordinary admitted ID list through this copy.
  structuredClone(instanceIds);
  return {
    native: { sourceVersion: 0, countU: 8, countV: 8,
      nativeCapacity: { version: 1, maximumObjects: 16 },
      curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
    basis: 'authored-xyz-matches-rhyup', instanceIds: ids,
  };
}
