import { prepareCamera, type MeshCamera } from '@barocss/gpu';

type Triple = [number, number, number];
type CssPoint = { xCss: number; yCss: number };
interface Plane { originMM: Triple; uAxis: Triple; vAxis: Triple }
export interface DrivingAnchorProjectionInput {
  anchorMM: Triple; plane: Plane; camera: MeshCamera; mmToSceneUnit: number;
  cssWidth: number; cssHeight: number; pixelWidth: number; pixelHeight: number;
}
/** Copied camera/workplane display math. This does not edit or certify native geometry. */
export interface DrivingAnchorProjection {
  readonly anchorMM: readonly number[];
  readonly plane: { readonly originMM: readonly number[]; readonly uAxis: readonly number[]; readonly vAxis: readonly number[] };
  readonly normal: readonly number[]; readonly eyeScene: readonly number[];
  readonly inverseView: readonly number[]; readonly view: readonly number[]; readonly projection: readonly number[];
  readonly mmToSceneUnit: number; readonly cssWidth: number; readonly cssHeight: number;
  readonly xCss: number; readonly yCss: number;
}
function own(input: unknown, keys: string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new RangeError('Anchor projection requires plain own data.');
  const descriptors = Object.getOwnPropertyDescriptors(input), actual = Reflect.ownKeys(input);
  if (actual.length !== keys.length || actual.some(key => typeof key !== 'string' || !keys.includes(key)
    || !descriptors[key].enumerable || !('value' in descriptors[key]))) throw new RangeError('Anchor projection requires exact own fields.');
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
function finite(input: unknown): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) throw new RangeError('Anchor projection values must be finite.');
  return input;
}
function positive(input: unknown): number { const value = finite(input); if (value <= 0) throw new RangeError('Camera scale and sizes must be positive.'); return value; }
function triple(input: unknown): Triple {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype || input.length !== 3
    || Reflect.ownKeys(input).length !== 4) throw new RangeError('Dense XYZ numbers are required.');
  return [0, 1, 2].map(index => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!descriptor?.enumerable || !('value' in descriptor)) throw new RangeError('XYZ fields must be own data.');
    return finite(descriptor.value);
  }) as Triple;
}
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const multiply = (matrix: readonly number[], vector: readonly number[]): Triple => [0, 1, 2].map(row =>
  matrix[row * 3] * vector[0] + matrix[row * 3 + 1] * vector[1] + matrix[row * 3 + 2] * vector[2]) as Triple;
function inverse(view: Float32Array): number[] {
  const [a, b, c, d, e, f, g, h, i] = [view[0], view[4], view[8], view[1], view[5], view[9], view[2], view[6], view[10]];
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) throw new RangeError('The camera view is singular.');
  return [e * i - f * h, c * h - b * i, b * f - c * e, f * g - d * i, a * i - c * g,
    c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d].map(value => value / determinant);
}
function project(frame: Pick<DrivingAnchorProjection, 'view' | 'projection' | 'cssWidth' | 'cssHeight' | 'mmToSceneUnit'>,
  pointMM: readonly number[]): CssPoint | null {
  const point = pointMM.map(value => value * frame.mmToSceneUnit), v = frame.view, p = frame.projection;
  const x = v[0] * point[0] + v[4] * point[1] + v[8] * point[2] + v[12];
  const y = v[1] * point[0] + v[5] * point[1] + v[9] * point[2] + v[13];
  const z = v[2] * point[0] + v[6] * point[1] + v[10] * point[2] + v[14], depth = -z;
  const nx = p[0] * x / depth, ny = p[5] * y / depth, nz = (p[10] * z + p[14]) / depth;
  if (depth <= 0 || ![depth, nx, ny, nz].every(Number.isFinite) || Math.abs(nx) > 1 || Math.abs(ny) > 1 || nz < -1 || nz > 1) return null;
  return { xCss: frame.cssWidth * (1 + nx) / 2, yCss: frame.cssHeight * (1 - ny) / 2 };
}
export function prepareDrivingAnchorProjection(input: DrivingAnchorProjectionInput): DrivingAnchorProjection | null {
  const data = own(input, ['anchorMM', 'plane', 'camera', 'mmToSceneUnit', 'cssWidth', 'cssHeight', 'pixelWidth', 'pixelHeight']);
  const planeData = own(data.plane, ['originMM', 'uAxis', 'vAxis']);
  const anchorMM = triple(data.anchorMM), originMM = triple(planeData.originMM), uAxis = triple(planeData.uAxis), vAxis = triple(planeData.vAxis);
  if (Math.abs(Math.hypot(...uAxis) - 1) > 1e-7 || Math.abs(Math.hypot(...vAxis) - 1) > 1e-7 || Math.abs(dot(uAxis, vAxis)) > 1e-7)
    throw new RangeError('The authored workplane axes must be orthonormal.');
  const normal = [uAxis[1] * vAxis[2] - uAxis[2] * vAxis[1], uAxis[2] * vAxis[0] - uAxis[0] * vAxis[2], uAxis[0] * vAxis[1] - uAxis[1] * vAxis[0]];
  if (Math.abs(dot(anchorMM.map((value, axis) => value - originMM[axis]), normal)) > 1e-6)
    throw new RangeError('The actual anchor must lie on the authored workplane.');
  const mmToSceneUnit = positive(data.mmToSceneUnit), cssWidth = positive(data.cssWidth), cssHeight = positive(data.cssHeight);
  const pixelWidth = positive(data.pixelWidth), pixelHeight = positive(data.pixelHeight);
  if (!Number.isInteger(pixelWidth) || !Number.isInteger(pixelHeight)) throw new RangeError('Physical canvas sizes must be integers.');
  if (data.camera === undefined) throw new RangeError('The actual displayed camera is required.');
  const matrices = prepareCamera(data.camera as MeshCamera, pixelWidth / pixelHeight), inverseView = inverse(matrices.view);
  const view = Array.from(matrices.view), projection = Array.from(matrices.projection);
  const point = project({ view, projection, cssWidth, cssHeight, mmToSceneUnit }, anchorMM);
  if (!point) return null;
  const backward = [view[2], view[6], view[10]];
  if (Math.abs(dot(normal, backward)) / Math.hypot(...normal) / Math.hypot(...backward) < .12) return null;
  const eyeScene = multiply(inverseView, [-view[12], -view[13], -view[14]]);
  return Object.freeze({ anchorMM: Object.freeze(anchorMM),
    plane: Object.freeze({ originMM: Object.freeze(originMM), uAxis: Object.freeze(uAxis), vAxis: Object.freeze(vAxis) }),
    normal: Object.freeze(normal), eyeScene: Object.freeze(eyeScene), inverseView: Object.freeze(inverseView),
    view: Object.freeze(view), projection: Object.freeze(projection), mmToSceneUnit, cssWidth, cssHeight, ...point });
}
/** Display-only local displacement through the original authored workplane basis. */
export function projectDrivingAnchor(frame: DrivingAnchorProjection, localOffsetMM: [number, number] = [0, 0]): CssPoint | null {
  if (!Array.isArray(localOffsetMM) || localOffsetMM.length !== 2 || !localOffsetMM.every(Number.isFinite)) throw new RangeError('Finite local XY offsets are required.');
  const point = frame.anchorMM.map((value, axis) => localOffsetMM[0] === 0 && localOffsetMM[1] === 0 ? value
    : value + frame.plane.uAxis[axis] * localOffsetMM[0] + frame.plane.vAxis[axis] * localOffsetMM[1]);
  return project(frame, point);
}
function intersection(frame: DrivingAnchorProjection, input: CssPoint): Triple | null {
  const data = own(input, ['xCss', 'yCss']), x = finite(data.xCss), y = finite(data.yCss);
  if (x < 0 || y < 0 || x > frame.cssWidth || y > frame.cssHeight) return null;
  const ray = multiply(frame.inverseView, [(2 * x / frame.cssWidth - 1) / frame.projection[0], (1 - 2 * y / frame.cssHeight) / frame.projection[5], -1]);
  const denominator = dot(ray, frame.normal), rayLength = Math.hypot(...ray);
  if (!Number.isFinite(denominator) || !Number.isFinite(rayLength) || rayLength === 0 || Math.abs(denominator) <= rayLength * Math.hypot(...frame.normal) * 1e-8) return null;
  const originScene = frame.plane.originMM.map(value => value * frame.mmToSceneUnit);
  const t = dot(originScene.map((value, axis) => value - frame.eyeScene[axis]), frame.normal) / denominator;
  if (!Number.isFinite(t) || t <= 0) return null;
  const hit = frame.eyeScene.map((value, axis) => (value + ray[axis] * t) / frame.mmToSceneUnit) as Triple;
  return hit.every(Number.isFinite) && project(frame, hit) ? hit : null;
}
/** Unsnapped local mm only. The UI owns its declared 1 mm movement step. */
export function drivingAnchorDisplacement(frame: DrivingAnchorProjection, startCss: CssPoint, currentCss: CssPoint): [number, number] | null {
  const start = intersection(frame, startCss), current = intersection(frame, currentCss);
  if (!start || !current) return null;
  if (startCss.xCss === currentCss.xCss && startCss.yCss === currentCss.yCss) return [0, 0];
  const delta = current.map((value, axis) => value - start[axis]);
  const result: [number, number] = [dot(delta, frame.plane.uAxis), dot(delta, frame.plane.vAxis)];
  return result.every(Number.isFinite) && projectDrivingAnchor(frame, result) ? result : null;
}
