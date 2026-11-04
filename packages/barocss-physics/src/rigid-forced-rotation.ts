/** Eighth-order modified-midpoint extrapolation for constant world torque. */
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

/** World applies the angular impulse and motors once before this continuous flow. */
export function prepareForcedRotation(body: Body, dt: number, torque: Vec3): ForcedResult | null {
  if (body.kind !== 'dynamic' || torque.every(x => x === 0)) return null;
  const moments: Vec3 = body.inertiaDiagonalKgM2 ??
    [body.inertiaKgM2!, body.inertiaKgM2!, body.inertiaKgM2!];
  if (!moments.every(x => Number.isFinite(x) && x > 0) ||
      !Number.isFinite(dt) || dt <= 0 || !torque.every(Number.isFinite)) {
    error('NUMERIC_LIMIT', 'forced rotation outside finite time/inertia/load bounds');
  }
  movement(body.angularVelocityRadps, dt);
  const r0 = rotation(body.orientation);
  const localOmega = product(r0, body.angularVelocityRadps, true);
  const momentum = product(r0, localOmega.map((x, i) => x * moments[i]) as Vec3);
  if (!momentum.every(Number.isFinite)) error('NUMERIC_LIMIT', 'nonfinite forced initial momentum');
  const angularRateBound = (Math.hypot(...momentum) + dt * Math.hypot(...torque)) / Math.min(...moments);
  const subdivisions = Math.max(1, Math.ceil(dt * angularRateBound / (1 / 8)));
  if (!Number.isFinite(subdivisions) || subdivisions > 64) {
    error('NUMERIC_LIMIT', 'forced rotation exceeded internal subdivision limit');
  }
  const omegaAt = (q: Quat, time: number): Vec3 => {
    const r = rotation(q);
    const stageL = momentum.map((x, i) => x + torque[i] * time) as Vec3;
    if (!stageL.every(Number.isFinite)) error('NUMERIC_LIMIT', 'nonfinite forced stage momentum');
    const localL = product(r, stageL, true);
    const omega = product(r, localL.map((x, i) => x / moments[i]) as Vec3);
    movement(omega, dt);
    return omega;
  };
  const rhs = (q: Quat, time: number): Quat => {
    const [a, b, c] = omegaAt(q, time), [x, y, z, w] = q;
    const rate: Quat = [(a*w+b*z-c*y)/2, (-a*z+b*w+c*x)/2,
      (a*y-b*x+c*w)/2, (-a*x-b*y-c*z)/2];
    if (!rate.every(Number.isFinite)) error('NUMERIC_LIMIT', 'nonfinite forced quaternion rate');
    return rate;
  };
  const offset = (q: Quat, rate: Quat, h: number): Quat =>
    q.map((x, i) => x + h * rate[i]) as Quat;
  const levels = [2, 4, 6, 8];
  let q = [...body.orientation] as Quat;
  const macroStep = dt / subdivisions;
  for (let macro = 0; macro < subdivisions; macro++) {
    const start = macro * macroStep;
    const table: Quat[][] = [];
    for (let k = 0; k < levels.length; k++) {
      const count = levels[k], h = macroStep / count;
      let previous = q;
      let current = offset(q, rhs(q, start), h);
      for (let m = 1; m < count; m++) {
        const next = offset(previous, rhs(current, start + m * h), 2 * h);
        previous = current;
        current = next;
      }
      const endpointRate = rhs(current, start + macroStep);
      const row: Quat[] = [current.map((x, i) =>
        (x + previous[i] + h * endpointRate[i]) / 2) as Quat];
      for (let j = 1; j <= k; j++) {
        const denominator = (count / levels[k - j]) ** 2 - 1;
        row.push(row[j - 1].map((x, i) =>
          x + (x - table[k - 1][j - 1][i]) / denominator) as Quat);
      }
      table.push(row);
    }
    // Normalize only the complete extrapolated macro step, never a level or RHS stage.
    const next = table[3][3];
    const norm = Math.hypot(...next);
    if (!next.every(Number.isFinite) || !Number.isFinite(norm) || norm <= 0) {
      error('NUMERIC_LIMIT', 'nonfinite forced extrapolated orientation');
    }
    q = next.map(x => x / norm) as Quat;
  }
  const angularVelocityRadps = omegaAt(q, dt);
  if (Math.abs(q.reduce((s, x) => s + x*x, 0) - 1) > 1e-12) {
    error('NUMERIC_LIMIT', 'forced final quaternion exceeded norm limit');
  }
  return { orientation: q, angularVelocityRadps };
}
