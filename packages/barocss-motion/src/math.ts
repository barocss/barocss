import type { Quat } from './index.js';

function normalize(quaternion: number[]): Quat {
  const norm = Math.hypot(...quaternion);
  return quaternion.map((component) => component / norm) as Quat;
}

/** Shared interior SLERP policy for keyed sampling and two-clip blending. */
export function slerpQuaternion(left: readonly number[], after: readonly number[], fraction: number): Quat {
  const rightValue = [...after];
  let dot = left.reduce((sum, component, index) => sum + component * rightValue[index], 0);
  if (dot < 0) {
    for (let index = 0; index < 4; index += 1) rightValue[index] = -rightValue[index];
    dot = -dot;
  }
  if (dot > 1 - 1e-8) {
    return normalize(left.map((component, index) => component + (rightValue[index] - component) * fraction));
  }
  const angle = Math.acos(Math.min(1, dot));
  const denominator = Math.sin(angle);
  const leftWeight = Math.sin((1 - fraction) * angle) / denominator;
  const rightWeight = Math.sin(fraction * angle) / denominator;
  return normalize(left.map((component, index) => component * leftWeight + rightValue[index] * rightWeight));
}
