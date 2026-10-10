import { prepareCamera, type MeshCamera } from '@barocss/gpu';
import { projectCurvePole, type PolePoint } from './curve-pole-projection.js';

export type PoleAxis = 0 | 1 | 2;

export interface PoleAxisProjection {
  axis: PoleAxis;
  originMM: PolePoint;
  xCss: number;
  yCss: number;
  dirX: number;
  dirY: number;
  depth: number;
  cameraAxisDepth: number;
  lengthCoefficient: number;
  mmToSceneUnit: number;
}

/** Map a positive world axis through the actual display camera, without evaluating geometry. */
export function projectPoleAxis(pointMM: PolePoint, camera: MeshCamera, mmToSceneUnit: number,
  cssWidth: number, cssHeight: number, pixelWidth: number, pixelHeight: number,
  axis: PoleAxis): PoleAxisProjection | null {
  requireAxis(axis);
  const point = projectCurvePole(pointMM, camera, mmToSceneUnit,
    cssWidth, cssHeight, pixelWidth, pixelHeight);
  if (point === null) return null;
  const { view, projection } = prepareCamera(camera, pixelWidth / pixelHeight);
  const p = pointMM.map(value => value * mmToSceneUnit);
  const x = view[0] * p[0] + view[4] * p[1] + view[8] * p[2] + view[12];
  const y = view[1] * p[0] + view[5] * p[1] + view[9] * p[2] + view[13];
  const depth = -(view[2] * p[0] + view[6] * p[1] + view[10] * p[2] + view[14]);
  const a = view[axis * 4], b = view[axis * 4 + 1], c = view[axis * 4 + 2];
  if (Math.abs(c) > 0.985) return null;
  const kX = cssWidth / 2 * projection[0] * (a * depth + x * c);
  const kY = -cssHeight / 2 * projection[5] * (b * depth + y * c);
  const normK = Math.hypot(kX, kY);
  const lengthCoefficient = normK / depth;
  if (!Number.isFinite(lengthCoefficient) || lengthCoefficient <= 1e-8) return null;
  return {
    axis, originMM: [...pointMM], xCss: point.xCss, yCss: point.yCss,
    dirX: kX / normK, dirY: kY / normK, depth,
    cameraAxisDepth: c, lengthCoefficient, mmToSceneUnit,
  };
}

/** Original-point-relative world-axis parameter in mm, including perspective depth change. */
export function axisPointerParameter(projection: PoleAxisProjection, xCss: number, yCss: number): number {
  if (![xCss, yCss, projection.xCss, projection.yCss, projection.dirX, projection.dirY,
    projection.depth, projection.cameraAxisDepth, projection.lengthCoefficient,
    projection.mmToSceneUnit].every(Number.isFinite)
    || projection.depth <= 0 || projection.lengthCoefficient <= 0 || projection.mmToSceneUnit <= 0) {
    throw new RangeError('A finite pointer and axis projection are required.');
  }
  const s = (xCss - projection.xCss) * projection.dirX + (yCss - projection.yCss) * projection.dirY;
  const depthTerm = s * projection.cameraAxisDepth;
  const denominator = projection.lengthCoefficient + depthTerm;
  const denominatorScale = Math.max(projection.lengthCoefficient, Math.abs(depthTerm));
  if (!Number.isFinite(denominator) || denominator <= denominatorScale * 1e-10) {
    throw new RangeError('Axis movement cannot cross the camera horizon.');
  }
  const sceneDelta = s * projection.depth / denominator;
  const remainingDepth = projection.depth - sceneDelta * projection.cameraAxisDepth;
  const deltaMM = sceneDelta / projection.mmToSceneUnit;
  if (!Number.isFinite(deltaMM) || !Number.isFinite(remainingDepth)
    || remainingDepth <= projection.depth * 1e-10) {
    throw new RangeError('Axis movement is outside the finite camera projection.');
  }
  return deltaMM;
}

/** Snap displacement from the captured pointer start; untouched native coefficients retain their bits. */
export function movePoleOnAxis(projection: PoleAxisProjection, axis: PoleAxis,
  startX: number, startY: number, currentX: number, currentY: number,
  snapStepMM: number | null): PolePoint {
  requireAxis(axis);
  if (axis !== projection.axis) throw new RangeError('The movement axis must match its captured projection.');
  if (snapStepMM !== null) requireSnapStep(snapStepMM);
  let delta = axisPointerParameter(projection, currentX, currentY)
    - axisPointerParameter(projection, startX, startY);
  if (snapStepMM !== null) delta = Math.round(delta / snapStepMM) * snapStepMM;
  if (!Number.isFinite(delta)) throw new RangeError('Axis displacement must be finite.');
  const result: PolePoint = [...projection.originMM];
  if (delta === 0) return result;
  result[axis] = projection.originMM[axis] + delta;
  if (!Number.isFinite(result[axis])) throw new RangeError('The moved control point is not finite.');
  return result;
}

export function parseMovementSnapStep(raw: string): number {
  if (typeof raw !== 'string' || raw.length > 128 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) {
    throw new RangeError('Enter a plain decimal movement step from 0.000001 to 1000000 mm.');
  }
  const step = Number(raw);
  requireSnapStep(step);
  return step;
}

function requireAxis(axis: PoleAxis): void {
  if (axis !== 0 && axis !== 1 && axis !== 2) throw new RangeError('A world X, Y or Z axis is required.');
}

function requireSnapStep(step: number): void {
  if (!Number.isFinite(step) || step < 0.000001 || step > 1000000) {
    throw new RangeError('Enter a plain decimal movement step from 0.000001 to 1000000 mm.');
  }
}
