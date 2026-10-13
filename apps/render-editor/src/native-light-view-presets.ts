import {prepareCamera, validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';

export type NativeLightViewPreset = 'front' | 'right' | 'top';

/**
 * Derive a local perspective inspection camera; never change the authored camera.
 * Right-handed Y-up scene coordinates: front +Z, right +X, top +Y.
 */
export function deriveNativeLightViewPreset(camera: MeshCamera, preset: NativeLightViewPreset,
  aspect: number): MeshCamera {
  const current = validateMeshCamera(camera);
  if (!Number.isFinite(aspect) || aspect <= 0) throw new RangeError('View preset requires a positive finite Canvas aspect.');
  const target = [...current.target] as [number, number, number];
  const distance = Math.hypot(...current.eye.map((n, index) => n - target[index]!));
  const direction = preset === 'front' ? [0, 0, 1] : preset === 'right' ? [1, 0, 0]
    : preset === 'top' ? [0, 1, 0] : null;
  if (!direction) throw new RangeError('Unknown Native Light view preset.');
  const eye = target.map((n, index) => n + direction[index]! * distance) as [number, number, number];
  const up: [number, number, number] = preset === 'top' ? [0, 0, -1] : [0, 1, 0];
  const candidate = validateMeshCamera({...current, eye, target, up});
  prepareCamera(candidate, aspect); // Qualify the actual intended Canvas aspect.
  return candidate;
}
