import { prepareCamera, type MeshCamera } from '@barocss/gpu';

type Homogeneous = readonly [number, number, number, number];

export interface SolidSplitCutProjectionInput {
  camera: MeshCamera;
  bounds: { min: readonly number[]; max: readonly number[] };
  cutY: number;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
}

/** Internal display-only snapshot, captured once at the beginning of a gesture. */
export interface SolidSplitCutProjection {
  readonly xCss: number;
  readonly yCss: number;
  readonly cutY: number;
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly clip: Homogeneous;
  readonly clipDerivative: Homogeneous;
  readonly numeratorDerivativeX: number;
  readonly numeratorDerivativeY: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly axisLength: number;
}

const SINGULARITY_EPSILON = 1e-10;
const MIN_AXIS_PIXELS_PER_UNIT = 1e-8;

function transform(matrix: Float32Array, point: Homogeneous): Homogeneous {
  return [0, 1, 2, 3].map(row => matrix[row] * point[0] + matrix[4 + row] * point[1]
    + matrix[8 + row] * point[2] + matrix[12 + row] * point[3]) as [number, number, number, number];
}

function visiblePoint(clip: Homogeneous, cssWidth: number, cssHeight: number): {
  xCss: number; yCss: number;
} | null {
  const [x, y, z, w] = clip;
  if (!clip.every(Number.isFinite) || w <= 0) return null;
  // prepareCamera uses the OpenGL frustum, including -w <= z <= w.
  if (x < -w || x > w || y < -w || y > w || z < -w || z > w) return null;
  const xCss = cssWidth * ((x / w + 1) / 2), yCss = cssHeight * ((1 - y / w) / 2);
  if (![xCss, yCss].every(Number.isFinite)
    || xCss < 0 || xCss > cssWidth || yCss < 0 || yCss > cssHeight) return null;
  return { xCss, yCss };
}

/** Approximate draft guide only: native Y maps to scene -Z at the complete bounds' XY centre. */
export function projectSolidSplitCut(input: SolidSplitCutProjectionInput): SolidSplitCutProjection | null {
  const { camera, bounds, cutY, cssWidth, cssHeight, pixelWidth, pixelHeight } = input;
  if (!camera || !Number.isFinite(cutY)
    || ![cssWidth, cssHeight, pixelWidth, pixelHeight].every(value => Number.isFinite(value) && value > 0)
    || !Number.isSafeInteger(pixelWidth) || !Number.isSafeInteger(pixelHeight)
    || !bounds || !Array.isArray(bounds.min) || !Array.isArray(bounds.max)
    || bounds.min.length !== 3 || bounds.max.length !== 3
    || ![0, 1, 2].every(axis => Number.isFinite(bounds.min[axis]) && Number.isFinite(bounds.max[axis])
      && bounds.min[axis] <= bounds.max[axis])) return null;

  let matrices: ReturnType<typeof prepareCamera>;
  try { matrices = prepareCamera(camera, pixelWidth / pixelHeight); }
  catch { return null; }

  // Halving before addition avoids overflowing the centre of finite bounds.
  const position: Homogeneous = [bounds.min[0] / 2 + bounds.max[0] / 2,
    bounds.min[1] / 2 + bounds.max[1] / 2, -cutY, 1];
  const clip = transform(matrices.projection, transform(matrices.view, position));
  const clipDerivative = transform(matrices.projection, transform(matrices.view, [0, 0, -1, 0]));
  const point = visiblePoint(clip, cssWidth, cssHeight);
  if (!point || !clipDerivative.every(Number.isFinite)) return null;

  // CSS coordinates are n(Y)/w(Y), with both n and w affine in native Y.
  const numeratorDerivativeX = cssWidth / 2 * (clipDerivative[0] + clipDerivative[3]);
  const numeratorDerivativeY = cssHeight / 2 * (clipDerivative[3] - clipDerivative[1]);
  const bx = numeratorDerivativeX - point.xCss * clipDerivative[3];
  const by = numeratorDerivativeY - point.yCss * clipDerivative[3];
  const axisLength = Math.hypot(bx, by);
  const derivativeScale = Math.max(Math.abs(numeratorDerivativeX), Math.abs(numeratorDerivativeY),
    Math.abs(point.xCss * clipDerivative[3]), Math.abs(point.yCss * clipDerivative[3]));
  if (![numeratorDerivativeX, numeratorDerivativeY, axisLength, derivativeScale].every(Number.isFinite)
    || axisLength <= derivativeScale * SINGULARITY_EPSILON
    || axisLength / clip[3] <= MIN_AXIS_PIXELS_PER_UNIT) return null;

  return Object.freeze({ ...point, cutY, cssWidth, cssHeight,
    clip: Object.freeze(clip), clipDerivative: Object.freeze(clipDerivative),
    numeratorDerivativeX, numeratorDerivativeY, dirX: bx / axisLength, dirY: by / axisLength, axisLength });
}

/** Invert start-relative CSS displacement along the frozen projected axis, without clamping. */
export function moveSolidSplitCut(projection: SolidSplitCutProjection, dxCss: number, dyCss: number): number | null {
  if (![dxCss, dyCss].every(Number.isFinite)) return null;
  if (dxCss === 0 && dyCss === 0) return projection.cutY;
  const s = dxCss * projection.dirX + dyCss * projection.dirY;
  if (!Number.isFinite(s)) return null;
  if (s === 0) return projection.cutY;
  const depthTerm = s * projection.clipDerivative[3];
  const denominator = projection.axisLength - depthTerm;
  const denominatorScale = Math.max(projection.axisLength, Math.abs(depthTerm));
  if (!Number.isFinite(denominator) || denominator <= denominatorScale * SINGULARITY_EPSILON) return null;

  // q(Y0 + delta) - q(Y0) = b * delta / (w0 + delta * dw/dY).
  const delta = s * projection.clip[3] / denominator;
  if (!Number.isFinite(delta)) return null;
  if (delta === 0) return projection.cutY;
  const cutY = projection.cutY + delta;
  if (!Number.isFinite(cutY)) return null;

  // Reproject the returned number, including its rounding, against the captured frustum.
  const actualDelta = cutY - projection.cutY;
  const clip = projection.clip.map((value, axis) =>
    value + actualDelta * projection.clipDerivative[axis]) as [number, number, number, number];
  if (clip[3] <= projection.clip[3] * SINGULARITY_EPSILON
    || !visiblePoint(clip, projection.cssWidth, projection.cssHeight)) return null;
  return actualDelta === 0 ? projection.cutY : cutY;
}
