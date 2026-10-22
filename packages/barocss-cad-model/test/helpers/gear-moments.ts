// Independent 2D Green integrals of the generated outer profile; analytic radius-4 bore.
// No B-rep mass quadrature, mesh or exported inertial value enters the reference.
import { spurGearProfile, type Curve } from '@barocss/cad';

function gauss(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 1; i <= n; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), derivative = 0;
    for (let k = 0; k < 30; k++) {
      let p0 = 1, p1 = x;
      for (let j = 2; j <= n; j++) { const p = ((2 * j - 1) * x * p1 - (j - 1) * p0) / j; p0 = p1; p1 = p; }
      derivative = n * (x * p1 - p0) / (x * x - 1);
      const delta = p1 / derivative; x -= delta; if (Math.abs(delta) < 2e-16) break;
    }
    out.push([x, 2 / ((1 - x * x) * derivative * derivative)]);
  }
  return out;
}
function curveAt(c: Curve, t: number): [number, number, number, number] {
  const U = c.knots, p = c.degree;
  const N = (i: number, d: number): number => d === 0 ? (t >= U[i] && t < U[i + 1] ? 1 : 0)
    : ((U[i + d] === U[i] ? 0 : (t - U[i]) / (U[i + d] - U[i]) * N(i, d - 1))
      + (U[i + d + 1] === U[i + 1] ? 0 : (U[i + d + 1] - t) / (U[i + d + 1] - U[i + 1]) * N(i + 1, d - 1)));
  let W = 0, dW = 0, X = 0, Y = 0, dX = 0, dY = 0;
  c.controlPoints.forEach(([x, y], i) => {
    const B = N(i, p) * c.weights[i];
    const D = ((U[i + p] === U[i] ? 0 : p / (U[i + p] - U[i]) * N(i, p - 1))
      - (U[i + p + 1] === U[i + 1] ? 0 : p / (U[i + p + 1] - U[i + 1]) * N(i + 1, p - 1))) * c.weights[i];
    W += B; dW += D; X += B * x; Y += B * y; dX += D * x; dY += D * y;
  });
  return [X / W, Y / W, (dX * W - X * dW) / (W * W), (dY * W - Y * dW) / (W * W)];
}

/** The two frozen gears: module 2, face width 8, bore diameter 8, schematic root. Units: kg, m, kg m2. */
export function gearMoments(teeth: 20 | 30, order: 32 | 48) {
  const { pieces } = spurGearProfile({ moduleMM: 2, teeth, faceWidthMM: 8, boreDiameterMM: 8 });
  const sum = [0, 0, 0, 0, 0, 0], compensation = sum.map(() => 0), quadrature = gauss(order);
  const add = (values: number[]) => values.forEach((v, i) => { const y = v - compensation[i], t = sum[i] + y; compensation[i] = (t - sum[i]) - y; sum[i] = t; });
  for (const { curve } of pieces) for (let k = curve.degree; k < curve.controlPoints.length; k++) {
    const a = curve.knots[k], b = curve.knots[k + 1]; if (!(b > a)) continue;
    for (const [g, weight] of quadrature) {
      const [x, y, dx, dy] = curveAt(curve, (a + b) / 2 + g * (b - a) / 2), w = weight * (b - a) / 2;
      add([0.5 * (x * dy - y * dx) * w, x * x * dy * w / 2, -y * y * dx * w / 2,
        x ** 3 * dy * w / 3, -(y ** 3) * dx * w / 3, x * x * y * dy * w / 2]);
    }
  }
  const A = sum[0] - Math.PI * 4 ** 2, c = [sum[1] / A, sum[2] / A];
  const Qxx = sum[3] - Math.PI * 4 ** 4 / 4 - A * c[0] ** 2, Qyy = sum[4] - Math.PI * 4 ** 4 / 4 - A * c[1] ** 2;
  const Qxy = sum[5] - A * c[0] * c[1], rho = 2.7e-6, h = 8, mass = rho * h * A, transverseZ = mass * h * h / 12;
  return { volumeMM3: A * h, mass, centreMM: [c[0], c[1], h / 2], inertia: [
    (rho * h * Qyy + transverseZ) * 1e-6, -rho * h * Qxy * 1e-6, 0,
    -rho * h * Qxy * 1e-6, (rho * h * Qxx + transverseZ) * 1e-6, 0, 0, 0, rho * h * (Qxx + Qyy) * 1e-6] };
}
