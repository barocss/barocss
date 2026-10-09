import type { ClothLayerV0 } from '@barocss/gpu';

/** Copied derived display data. The caller owns the simulation clock and identity. */
export interface ViewerClothFrameV0 {
  version: 0;
  layerId: string;
  contextId: string;
  sceneRevision: string;
  stepIndex: number;
  vertexCount: 289;
  triangleCount: 512;
  positionsM: Float64Array;
  triangles: Uint16Array;
}

const FIELDS = ['version', 'layerId', 'contextId', 'sceneRevision', 'stepIndex',
  'vertexCount', 'triangleCount', 'positionsM', 'triangles'];
const TAG = /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/;
const typedPrototype = Object.getPrototypeOf(Float64Array.prototype);
const typedBrand = Object.getOwnPropertyDescriptor(typedPrototype, Symbol.toStringTag)!.get!;
const typedLength = Object.getOwnPropertyDescriptor(typedPrototype, 'length')!.get!;
const typedBuffer = Object.getOwnPropertyDescriptor(typedPrototype, 'buffer')!.get!;
const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!;

function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Cloth frame: ' + message);
}

function record(input: unknown): Record<string, unknown> {
  check(input !== null && typeof input === 'object'
    && Object.getPrototypeOf(input) === Object.prototype, 'plain own DTO required');
  const keys = Reflect.ownKeys(input);
  check(keys.length === FIELDS.length
    && keys.every(key => typeof key === 'string' && FIELDS.includes(key)), 'exact own fields required');
  const values: Record<string, unknown> = {};
  for (const key of FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && descriptor.enumerable && 'value' in descriptor, key + ' must be own data');
    values[key] = descriptor.value;
  }
  return values;
}

function typedValues(input: unknown, brand: 'Float64Array' | 'Uint16Array',
  length: number, label: string): number[] {
  let actualBrand: unknown, actualLength: unknown, buffer: unknown;
  try {
    // Intrinsic accessors reject proxies and spoofed views before inspecting caller properties.
    actualBrand = typedBrand.call(input);
    actualLength = typedLength.call(input);
    buffer = typedBuffer.call(input);
    bufferLength.call(buffer);
  } catch {
    throw new RangeError('Cloth frame: ' + label + ' must be a nonshared typed-array view');
  }
  const prototype = brand === 'Float64Array' ? Float64Array.prototype : Uint16Array.prototype;
  check(actualBrand === brand && actualLength === length
    && Object.getPrototypeOf(input) === prototype, label + ' has an invalid brand, prototype or length');
  check(buffer instanceof ArrayBuffer && Object.getPrototypeOf(buffer) === ArrayBuffer.prototype,
    label + ' requires an ordinary same-realm ArrayBuffer');
  check(Reflect.ownKeys(input as object).length === length, label + ' has extra own fields');
  const values: number[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && descriptor.enumerable && 'value' in descriptor
      && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value),
    label + '[' + index + '] must be own finite numeric data');
    values.push(descriptor.value);
  }
  return values;
}

/** Pure admission/copy/unit adapter. GPU owns triangle-area, Float32 and normal validation. */
export function prepareViewerClothFrame(input: unknown, mmToSceneUnit: number,
  prior: ViewerClothFrameV0 | null): {
    frame: ViewerClothFrameV0; layer: ClothLayerV0; unchanged: boolean;
  } {
  const data = record(input);
  check(data.version === 0 && data.vertexCount === 289 && data.triangleCount === 512,
    'version 0 and 289 vertices/512 triangles required');
  for (const key of ['layerId', 'contextId', 'sceneRevision']) {
    check(typeof data[key] === 'string' && TAG.test(data[key] as string), key + ' requires an ASCII tag1..128');
  }
  check(typeof data.stepIndex === 'number' && Number.isInteger(data.stepIndex)
    && data.stepIndex >= 0 && data.stepIndex <= 240, 'stepIndex must be an integer0..240');
  check(typeof mmToSceneUnit === 'number' && Number.isFinite(mmToSceneUnit)
    && mmToSceneUnit >= 1e-6 && mmToSceneUnit <= 1, 'mmToSceneUnit must be finite in1e-6..1');
  const metres = typedValues(data.positionsM, 'Float64Array', 867, 'positionsM');
  const indices = typedValues(data.triangles, 'Uint16Array', 1536, 'triangles');
  let offset = 0;
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const a = z * 17 + x;
    for (const expected of [a, a + 17, a + 1, a + 1, a + 17, a + 18]) {
      check(Object.is(indices[offset++], expected), 'triangles must match canonical17x17 order');
    }
  }
  const positions = metres.map(metre => {
    const scene = metre * 1000 * mmToSceneUnit;
    check(Number.isFinite(scene) && Math.abs(scene) <= 1000, 'scene position exceeds GPU bounds');
    return scene;
  });
  let unchanged = false;
  if (prior) {
    check(data.layerId === prior.layerId && data.contextId === prior.contextId
      && data.sceneRevision === prior.sceneRevision, 'identity change requires explicit clear or scene replacement');
    check(data.stepIndex >= prior.stepIndex, 'step regressed');
    if (data.stepIndex === prior.stepIndex) {
      check(metres.every((value, index) => Object.is(value, prior.positionsM[index]))
        && indices.every((value, index) => Object.is(value, prior.triangles[index])),
      'equal step changed original metre positions or topology');
      unchanged = true;
    }
  }
  const frame: ViewerClothFrameV0 = { version: 0, layerId: data.layerId as string,
    contextId: data.contextId as string, sceneRevision: data.sceneRevision as string,
    stepIndex: data.stepIndex, vertexCount: 289, triangleCount: 512,
    positionsM: new Float64Array(metres), triangles: new Uint16Array(indices) };
  const layer: ClothLayerV0 = { version: 0, kind: 'simulation-cloth', layerId: frame.layerId,
    contextId: frame.contextId, sceneRevision: frame.sceneRevision, stepIndex: frame.stepIndex,
    coordinateSystem: 'right-handed-y-up-scene-units', positions, indices };
  return { frame, layer, unchanged };
}
