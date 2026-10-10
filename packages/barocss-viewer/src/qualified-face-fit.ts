import { tessellateSurface } from '@barocss/cad';
import type { Surface } from '@barocss/cad';
import { prepareMesh, prepareQualifiedFaceScene } from '@barocss/gpu';
import type { QualifiedFaceAssetV0, QualifiedFaceSceneV0 } from '@barocss/gpu';

type Vec3 = [number, number, number];
export interface ViewerQualifiedFaceFitInput {
  sourceId: string;
  expectedSource: string;
  faceId: string;
  modelId: string;
  surfaceId: string;
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Viewer qualified Face fit: ' + message);
}
function fitPin(input: unknown): ViewerQualifiedFaceFitInput {
  check(input !== null && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype,
    'pin must be plain own data');
  const fields = ['sourceId', 'expectedSource', 'faceId', 'modelId', 'surfaceId'];
  const keys = Reflect.ownKeys(input);
  check(keys.length === fields.length && keys.every(key => typeof key === 'string' && fields.includes(key)),
    'pin requires exact sourceId/expectedSource/faceId/modelId/surfaceId fields');
  const data: Record<string, string> = {};
  for (const key of fields) {
    const field = Object.getOwnPropertyDescriptor(input, key);
    check(field && field.enumerable && 'value' in field && typeof field.value === 'string',
      key + ' must be own string data');
    const limit = key === 'expectedSource' ? 65536 : key === 'sourceId' ? 48 : 128;
    check(field.value.length >= 1 && field.value.length <= limit, key + ' length is outside the supported range');
    data[key] = field.value;
  }
  check(new TextEncoder().encode(data.expectedSource).length <= 65536, 'expectedSource exceeds65536UTF8bytes');
  try { structuredClone(input); }
  catch (cause) { throw new RangeError('Viewer qualified Face fit: pin cannot be copied', { cause }); }
  return { sourceId: data.sourceId, expectedSource: data.expectedSource, faceId: data.faceId,
    modelId: data.modelId, surfaceId: data.surfaceId };
}

function displayBounds(scene: QualifiedFaceSceneV0, assets: QualifiedFaceAssetV0[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const asset of assets) {
    const surface = asset.face.geometry.objects.find((object): object is Surface =>
      object.id === asset.face.topology.face.surfaceId && 'degreeU' in object);
    if (!surface) throw new RangeError('Viewer qualified Face fit: current original Face Surface is missing');
    const tessellation = tessellateSurface(surface, { countU: scene.countU, countV: scene.countV, revision: 0 });
    const buffers = prepareMesh(tessellation.packet, { camera: scene.camera, mmToSceneUnit: scene.mmToSceneUnit,
      translate: scene.translate, background: scene.background, color: asset.color });
    for (let offset = 0; offset < buffers.positions.length; offset += 3) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], buffers.positions[offset + axis]);
        max[axis] = Math.max(max[axis], buffers.positions[offset + axis]);
      }
    }
  }
  return { min, max };
}

/** Sampled filled display bounds only; original control hulls and unshown Curves are excluded. */
export function qualifiedFaceDisplayBounds(input: QualifiedFaceSceneV0): { min: Vec3; max: Vec3 } {
  const scene = prepareQualifiedFaceScene(input);
  return displayBounds(scene, scene.assets);
}

/** Validate the complete current scene before bounding one exact original asset. */
export function qualifiedFaceAssetDisplayBounds(input: QualifiedFaceSceneV0,
  pinInput: unknown): { min: Vec3; max: Vec3 } {
  const pin = fitPin(pinInput);
  const scene = prepareQualifiedFaceScene(input);
  const asset = scene.assets.find(value => value.sourceId === pin.sourceId
    && value.source === pin.expectedSource && value.face.topology.face.id === pin.faceId
    && value.face.geometry.name === pin.modelId && value.face.topology.face.surfaceId === pin.surfaceId);
  check(asset, 'pin does not match one current original qualified Face');
  return displayBounds(scene, [asset]);
}
