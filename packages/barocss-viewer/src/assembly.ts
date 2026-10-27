import { resolveCadGeometryReference, validateCadAssemblyResult } from '@barocss/cad';
import type { AdaptiveCurveSamplingResult, WideAdaptiveCurveSamplingResult,
  CadAssemblyResult, CadAssemblyMatrix, CadGeometryReferenceV0 } from '@barocss/cad';
import { prepareBaroCadDocumentPrimitiveNativeRefsV2 } from '@barocss/cad-interop/document';
import type { BaroCadNativeCapacityV1, BaroCadParseOptions } from '@barocss/cad-interop/native';
import type { NativeLoadOptions, ViewerNativeCurveLoadOptions, ViewerNativeCurveLoadOptionsV1,
  ViewerGeometryRef, ViewerGeometryDisplayPose, ViewerGeometryMotionState, ViewerPacket } from './index.js';

export interface ViewerAssemblyLoadOptions {
  native: (NativeLoadOptions | ViewerNativeCurveLoadOptions | ViewerNativeCurveLoadOptionsV1)
    & { nativeCapacity?: BaroCadNativeCapacityV1 };
  basis: 'authored-xyz-matches-rhyup';
  instanceIds: string[];
}
export interface ViewerAssemblyInstanceBinding {
  ref: ViewerGeometryRef;
  assemblyId: string;
  assemblyRevision: number;
  instanceId: string;
  parentId: string | null;
  ancestors: string[];
  reference: CadGeometryReferenceV0;
  localMatrix: CadAssemblyMatrix;
  worldMatrix: CadAssemblyMatrix;
  displayPose: ViewerGeometryDisplayPose;
}
type AssemblyCurveEntry = { modelId: string } & (
  | { sampleVersion: 0; sample: AdaptiveCurveSamplingResult }
  | { sampleVersion: 1; sample: WideAdaptiveCurveSamplingResult });

function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Viewer assembly: ' + message);
}
function selectedIds(input: unknown): string[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    'instanceIds must be an ordinary dense array');
  const size = Object.getOwnPropertyDescriptor(input, 'length');
  check(size && 'value' in size && Number.isInteger(size.value)
    && size.value >= 1 && size.value <= 4, 'select1..4 instances');
  check(Reflect.ownKeys(input).length === size.value + 1, 'instanceIds has extra fields');
  const ids: string[] = [];
  for (let index = 0; index < size.value; index++) {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    check(field && field.enumerable && 'value' in field && typeof field.value === 'string'
      && /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/.test(field.value), 'instanceIds must contain own authored ASCII IDs');
    ids.push(field.value);
  }
  check(new Set(ids).size === ids.length, 'duplicate instanceId');
  return ids;
}
function namespace(instanceId: string): string {
  return 'assembly.' + Array.from(instanceId, character =>
    character.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}
/** Compare validated native data without discarding signed-zero coefficient bits. */
function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Reflect.ownKeys(a), other = Reflect.ownKeys(b);
  return keys.length === other.length && keys.every(key => other.includes(key)
    && sameData(Object.getOwnPropertyDescriptor(a, key)?.value,
      Object.getOwnPropertyDescriptor(b, key)?.value));
}
function rotation(matrix: CadAssemblyMatrix): [number, number, number, number] {
  const [m00, m01, m02] = matrix, m10 = matrix[4], m11 = matrix[5], m12 = matrix[6];
  const m20 = matrix[8], m21 = matrix[9], m22 = matrix[10], trace = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = 2 * Math.sqrt(trace + 1);
    x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; w = s / 4;
  } else if (m00 >= m11 && m00 >= m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s; w = (m21 - m12) / s;
  } else if (m11 >= m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s; w = (m02 - m20) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4; w = (m10 - m01) / s;
  }
  const length = Math.hypot(x, y, z, w);
  check(Number.isFinite(length) && length > 0, 'world rotation has no finite quaternion');
  x /= length; y /= length; z /= length; w /= length;
  const rebuilt = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  const original = [m00, m01, m02, m10, m11, m12, m20, m21, m22];
  check(rebuilt.every((value, index) => Number.isFinite(value)
    && Math.abs(value - original[index]) <= 1e-9), 'quaternion differs from authored world rotation');
  return [x, y, z, w];
}

/** Prepare owned source projections and authored poses without presenting or changing Viewer state. */
export function prepareViewerAssembly(input: CadAssemblyResult, instanceIds: unknown,
  native: BaroCadParseOptions): {
    assembly: CadAssemblyResult; instances: ViewerAssemblyInstanceBinding[];
    packets: ViewerPacket[]; curves: AssemblyCurveEntry[]; geometryMotion: ViewerGeometryMotionState;
  } {
  validateCadAssemblyResult(input);
  const assembly = structuredClone(input);
  const ids = selectedIds(instanceIds);
  const packets: ViewerPacket[] = [], curves: AssemblyCurveEntry[] = [];
  const instances: ViewerAssemblyInstanceBinding[] = [];
  check(native.unitsPerMillimeter === 1, 'native projection requires one unit per millimetre');
  for (const instanceId of ids) {
    const instance = assembly.instances.find(value => value.instanceId === instanceId);
    check(instance, 'selected instanceId does not exist');
    const reference = instance.reference;
    const document = assembly.documents.find(value => value.document.documentId === reference.documentId);
    check(document, 'instance document is missing');
    const resolved = resolveCadGeometryReference(document, reference);
    const compiled = document.compiledAssets.find(value => value.assetId === reference.assetId);
    const asset = document.document.assets.find(value => value.id === reference.assetId);
    const original = compiled?.model.objects.find(value => value.kind === reference.geometryKind
      && value.id === reference.geometryId);
    check(compiled && asset && original && resolved.source === asset.source
      && compiled.source === asset.source && sameData(resolved.reference, reference)
      && sameData(resolved.geometry, original), 'resolved reference differs from original model/source');
    const projected = prepareBaroCadDocumentPrimitiveNativeRefsV2(document, {
      native, basis: 'authored-xyz-matches-rhyup', bodyIds: [reference.bodyId] });
    check(projected.length === 1, 'instance requires one original body preview');
    const entry = projected[0], binding = entry.binding;
    check(binding.documentId === reference.documentId && binding.documentRevision === reference.documentRevision
      && binding.bodyId === reference.bodyId && binding.assetId === reference.assetId
      && binding.assetRevision === reference.assetRevision && binding.geometryId === reference.geometryId
      && binding.geometryKind === reference.geometryKind && entry.kind === reference.geometryKind
      && binding.nativeFrame === 'authored-xyz-no-axis-conversion'
      && binding.sourceFrame === reference.sourceFrame && binding.modelId === compiled.model.name
      && asset.revision === reference.assetRevision && asset.sourceVersion === reference.sourceVersion
      && entry.ref.modelId === reference.assetId.replaceAll('-', '.')
      && entry.ref.geometryId === reference.geometryId, 'preview provenance differs from full native reference');
    const modelId = namespace(instanceId);
    const ref: ViewerGeometryRef = entry.kind === 'surface'
      ? { kind: 'surface', modelId, surfaceId: reference.geometryId }
      : { kind: 'curve', modelId, curveId: reference.geometryId };
    const translation: [number, number, number] =
      [instance.worldMatrix[3], instance.worldMatrix[7], instance.worldMatrix[11]];
    check(translation.every(value => Number.isFinite(value) && Math.abs(value) <= 10000),
      'authored world translation exceeds GPU10000mm limit');
    const displayPose: ViewerGeometryDisplayPose = { ref, translation,
      rotationXYZW: rotation(instance.worldMatrix), scale: [1, 1, 1] };
    if (entry.kind === 'surface') {
      check(entry.packet.surfaceId === reference.geometryId, 'Surface packet lost original ID');
      packets.push({ modelId, packet: entry.packet });
    } else {
      check(sameData(entry.sample.curve, original), 'Curve preview lost original native coefficients');
      curves.push(entry.sampleVersion === 1
        ? { modelId, sampleVersion: 1, sample: entry.sample }
        : { modelId, sampleVersion: 0, sample: entry.sample });
    }
    instances.push({ ref, assemblyId: assembly.assembly.assemblyId,
      assemblyRevision: assembly.assembly.revision, instanceId, parentId: instance.parentId,
      ancestors: [...instance.ancestors], reference: structuredClone(reference),
      localMatrix: [...instance.localMatrix] as CadAssemblyMatrix,
      worldMatrix: [...instance.worldMatrix] as CadAssemblyMatrix, displayPose });
  }
  const geometryMotion: ViewerGeometryMotionState = { basis: 'part-xyz-matches-rhyup',
    frame: { contextId: 'viewer_assembly', timeSeconds: 0, poses: instances.map(instance => ({
      targetId: instance.ref.modelId, translation: [...instance.displayPose.translation],
      rotation: [...instance.displayPose.rotationXYZW], scale: [1, 1, 1] })) },
    bindings: instances.map(instance => ({ contextId: 'viewer_assembly',
      targetId: instance.ref.modelId, ref: instance.ref })),
    displayPoses: instances.map(instance => instance.displayPose) };
  return { assembly, instances, packets, curves, geometryMotion };
}
