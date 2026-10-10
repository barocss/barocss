import { prepareQualifiedFaceScene } from '@barocss/gpu';
import type { MeshCamera, QualifiedFaceAssetV0, QualifiedFaceSceneV0 } from '@barocss/gpu';

export interface ViewerQualifiedFaceInputV0 {
  version: 0;
  basis: 'authored-xyz-matches-rhyup';
  assets: QualifiedFaceAssetV0[];
  countU: number;
  countV: number;
  camera: MeshCamera;
  translateScene: [number, number, number];
}

/** The public provider validates and copies every complete original source/Face asset. */
export function prepareViewerQualifiedFaces(input: ViewerQualifiedFaceInputV0, mmToSceneUnit: number,
  background: [number, number, number]): QualifiedFaceSceneV0 {
  const fields = ['version', 'basis', 'assets', 'countU', 'countV', 'camera', 'translateScene'];
  if (input === null || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype)
    throw new RangeError('Viewer qualified Face input must be plain own data');
  const keys = Reflect.ownKeys(input);
  if (keys.length !== fields.length || !keys.every(key => typeof key === 'string' && fields.includes(key)))
    throw new RangeError('Viewer qualified Face input has missing or unsupported fields');
  const data: Record<string, unknown> = {};
  for (const key of fields) {
    const field = Object.getOwnPropertyDescriptor(input, key);
    if (!field || !field.enumerable || !('value' in field))
      throw new RangeError('Viewer qualified Face ' + key + ' must be own data');
    data[key] = field.value;
  }
  if (data.version !== 0 || data.basis !== 'authored-xyz-matches-rhyup')
    throw new RangeError('Viewer qualified Face input requires version0 and explicit authored XYZ basis');
  return prepareQualifiedFaceScene({ format: 'barocss-gpu-qualified-face-scene', version: 0,
    profile: 'source-qualified-forward-face-v0', sourceVersion: 0, basis: 'authored-xyz-matches-rhyup',
    assets: data.assets, countU: data.countU, countV: data.countV, camera: data.camera,
    mmToSceneUnit, translate: data.translateScene, background });
}
