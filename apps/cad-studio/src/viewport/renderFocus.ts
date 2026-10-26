import type { OrbitCamera } from './camera';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

/** Focus is distance along the view axis, not the longer off-axis eye-to-point distance. */
export function renderFocusDistance(camera: Pick<OrbitCamera, 'basis'>, point: Vec3): number | null {
  const { eye, forward } = camera.basis();
  const focus = (point[0] - eye[0]) * forward[0] + (point[1] - eye[1]) * forward[1] + (point[2] - eye[2]) * forward[2];
  return Number.isFinite(focus) && focus > 0 ? focus : null;
}
