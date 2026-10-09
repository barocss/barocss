import { parseBaroCadSource } from '@barocss/cad-interop/native';
import type { BaroCadNativeResult } from '@barocss/cad-interop/native';
import { prepareMixedDepthFrame } from '@barocss/gpu';
import type { MeshCamera, MixedDepthFrameV0 } from '@barocss/gpu';
import type { NativeLoadOptions, ViewerRef } from './index.js';

export interface ViewerMixedDepthInputV0 {
  version: 0;
  sphereSource: string;
  nativeSource: string;
  native: NativeLoadOptions;
  surface: ViewerRef;
  surfaceColor: [number, number, number];
  nativeTranslateScene: [number, number, number];
  camera: MeshCamera;
  basis: 'authored-xyz-matches-rhyup';
}
export interface ViewerMixedDepthState {
  native: BaroCadNativeResult;
  frame: MixedDepthFrameV0;
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Viewer mixed depth: ' + message);
}
function record(input: unknown, fields: string[], label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    label + ' must be plain own data');
  const keys = Reflect.ownKeys(input);
  check(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)),
    label + ' has missing or unsupported fields');
  return Object.fromEntries(fields.map(key => {
    const field = Object.getOwnPropertyDescriptor(input, key);
    check(field && field.enumerable && 'value' in field, label + '.' + key + ' must be own data');
    return [key, field.value];
  }));
}
function text(input: unknown, label: string): string {
  check(typeof input === 'string' && input.length > 0 && input.length <= 65536
    && new TextEncoder().encode(input).length <= 65536, label + ' must retain complete text within65536bytes/code units');
  return input;
}
function triple(input: unknown, label: string, minimum: number, maximum: number): [number, number, number] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype
    && input.length === 3 && Reflect.ownKeys(input).length === 4, label + ' must be a dense ordinary triple');
  return [0, 1, 2].map(index => {
    const field = Object.getOwnPropertyDescriptor(input, String(index));
    check(field && field.enumerable && 'value' in field && typeof field.value === 'number'
      && Number.isFinite(field.value) && field.value >= minimum && field.value <= maximum,
    label + '[' + index + '] must be own finite data in range');
    return field.value;
  }) as [number, number, number];
}
/** Rebuild original CAD authority before asking the public GPU provider to prepare its mixed frame. */
export function prepareViewerMixedDepth(input: ViewerMixedDepthInputV0, mmToSceneUnit: number): ViewerMixedDepthState {
  const data = record(input, ['version', 'sphereSource', 'nativeSource', 'native', 'surface',
    'surfaceColor', 'nativeTranslateScene', 'camera', 'basis'], 'Mixed input');
  check(data.version === 0 && data.basis === 'authored-xyz-matches-rhyup', 'version0/explicit authored XYZ basis required');
  const sphereSource = text(data.sphereSource, 'Sphere source'), nativeSource = text(data.nativeSource, 'Native source');
  const options = record(data.native, ['sourceVersion', 'countU', 'countV'], 'Native options');
  check(options.sourceVersion === 0, 'Native sourceVersion0 required');
  for (const key of ['countU', 'countV']) check(typeof options[key] === 'number'
    && Number.isInteger(options[key]) && (options[key] as number) >= 2 && (options[key] as number) <= 17,
  'Native grid counts must be integers2..17');
  const ref = record(data.surface, ['modelId', 'surfaceId'], 'Surface ref'), id = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
  check(typeof ref.modelId === 'string' && typeof ref.surfaceId === 'string'
    && id.test(ref.modelId) && id.test(ref.surfaceId), 'Original selected IDs require Viewer ASCII1..64');
  const color = triple(data.surfaceColor, 'Surface color', 0, 1);
  const translate = triple(data.nativeTranslateScene, 'Native scene translation', -1000, 1000);
  const native = parseBaroCadSource(nativeSource, { sourceVersion: 0,
    countU: options.countU as number, countV: options.countV as number, unitsPerMillimeter: 1 });
  check(native.model.name === ref.modelId, 'Selected model differs from original native source');
  const surface = native.surfaces.find(value => value.surfaceId === ref.surfaceId);
  check(surface && native.model.objects.some(value => value.kind === 'surface' && value.id === ref.surfaceId),
    'Selected original Surface is missing');
  const frame = prepareMixedDepthFrame({ format: 'barocss-gpu-mixed-depth-frame', version: 0,
    profile: 'sdf-sphere-native-surface-v0', sourceVersion: 1, source: sphereSource,
    surface: { ref: { modelId: ref.modelId, geometryId: ref.surfaceId }, packet: surface.packet, color },
    camera: data.camera, mmToSceneUnit, translate });
  return { native, frame };
}
