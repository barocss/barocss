/** Two-halfstep forced flow for the admitted one-step rotor; no retained state. */
import type { Body, Quat, Vec3 } from './internal-types.js';
import { error } from './validation.js';

type Rotation = [Vec3, Vec3, Vec3];
type ForcedResult = { orientation: Quat; angularVelocityRadps: Vec3 };

/** Proper homogeneous body-to-world rotation. The quaternion passed to the RHS stays raw. */
function rotation(q: Quat): Rotation {
  const [x, y, z, w] = q;
  const n = x * x + y * y + z * z + w * w;
  if (!q.every(Number.isFinite) || !Number.isFinite(n) || n <= 0) {
    error('NUMERIC_LIMIT', 'invalid forced stage quaternion');
  }
  return [[(w*w+x*x-y*y-z*z)/n, 2*(x*y-z*w)/n, 2*(x*z+y*w)/n],
    [2*(x*y+z*w)/n, (w*w-x*x+y*y-z*z)/n, 2*(y*z-x*w)/n],
    [2*(x*z-y*w)/n, 2*(y*z+x*w)/n, (w*w-x*x-y*y+z*z)/n]];
}

function product(r: Rotation, v: Vec3, transpose = false): Vec3 {
  return [0, 1, 2].map(i => [0, 1, 2].reduce((s, j) =>
    s + (transpose ? r[j][i] : r[i][j]) * v[j], 0)) as Vec3;
}

function movement(omega: Vec3, dt: number): void {
  if (omega.some(x => !Number.isFinite(x) || Math.abs(x) > 1000) ||
      Math.hypot(...omega) * dt > 10) {
    error('NUMERIC_LIMIT', 'forced rotation exceeded angular movement limit');
  }
}

/** World applies J once before this call. Zero torque stays on the unchanged S8 path. */
export function prepareForcedBoxRotation(body: Body, dt: number, torque: Vec3): ForcedResult | null {
  if (body.kind !== 'dynamic' || body.shape.kind !== 'box' || torque.every(x => x === 0)) return null;
  const moments = body.inertiaDiagonalKgM2;
  if (!moments || !moments.every(x => Number.isFinite(x) && x > 0) ||
      !Number.isFinite(dt) || dt <= 0 || dt > 1 / 60 ||
      torque.some(x => !Number.isFinite(x) || Math.abs(x) > 1000000)) {
    error('NUMERIC_LIMIT', 'forced rotation outside finite time/inertia/load bounds');
  }
  movement(body.angularVelocityRadps, dt);
  const r0 = rotation(body.orientation);
  const localOmega = product(r0, body.angularVelocityRadps, true);
  const momentum = product(r0, localOmega.map((x, i) => x * moments[i]) as Vec3);
  if (!momentum.every(Number.isFinite)) error('NUMERIC_LIMIT', 'nonfinite forced initial momentum');
  const omegaAt = (q: Quat, time: number): Vec3 => {
    const r = rotation(q);
    const stageL = momentum.map((x, i) => x + torque[i] * time) as Vec3;
    // A finite guard for this candidate, not a public qualified input envelope.
    if (!stageL.every(Number.isFinite) || Math.hypot(...stageL) / (1 / 16) >= 15 / 16) {
      error('NUMERIC_LIMIT', 'forced stage momentum exceeded finite candidate bound');
    }
    const localL = product(r, stageL, true);
    const omega = product(r, localL.map((x, i) => x / moments[i]) as Vec3);
    movement(omega, dt);
    return omega;
  };
  const rhs = (q: Quat, time: number): Quat => {
    const [a, b, c] = omegaAt(q, time), [x, y, z, w] = q;
    // LEFT Hamilton product [omega_world,0] * raw q, exactly eight calls below.
    const rate: Quat = [(a*w+b*z-c*y)/2, (-a*z+b*w+c*x)/2,
      (a*y-b*x+c*w)/2, (-a*x-b*y-c*z)/2];
    if (!rate.every(Number.isFinite)) error('NUMERIC_LIMIT', 'nonfinite forced quaternion rate');
    return rate;
  };
  const offset = (q: Quat, rate: Quat, h: number): Quat =>
    q.map((x, i) => x + h * rate[i]) as Quat;
  let q = [...body.orientation] as Quat;
  const h = dt / 2;
  for (let half = 0; half < 2; half++) {
    const t = half * h;
    const k1 = rhs(q, t);
    const k2 = rhs(offset(q, k1, h / 2), t + h / 2);
    const k3 = rhs(offset(q, k2, h / 2), t + h / 2);
    const k4 = rhs(offset(q, k3, h), t + h);
    const next = q.map((x, i) => x + h / 6 * (k1[i] + 2*k2[i] + 2*k3[i] + k4[i])) as Quat;
    const norm = Math.hypot(...next);
    if (!next.every(Number.isFinite) || !Number.isFinite(norm) || norm <= 0) {
      error('NUMERIC_LIMIT', 'nonfinite forced halfstep orientation');
    }
    q = next.map(x => x / norm) as Quat;
  }
  const angularVelocityRadps = omegaAt(q, dt);
  if (Math.abs(q.reduce((s, x) => s + x*x, 0) - 1) > 1e-12) {
    error('NUMERIC_LIMIT', 'forced final quaternion exceeded norm limit');
  }
  return { orientation: q, angularVelocityRadps };
}
