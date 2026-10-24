import type { QualifiedFaceSceneV0 } from '@barocss/gpu';
import { evaluateViewerQualifiedFacePoint } from './qualified-face-measurement.js';
import type { ViewerQualifiedFacePoint } from './qualified-face-measurement.js';

export interface ViewerQualifiedFacePointProjection {
  version: 0;
  point: ViewerQualifiedFacePoint;
  xCss: number;
  yCss: number;
  depthScene: number;
  coordinateSpace: 'canvas-css-bounding-box';
  approximate: true;
  occlusion: 'not-tested';
}
type Vec3 = [number, number, number];
/** A vector only read (gpu's readonly Vec3 passes as one, R7.3c). */
type ReadVec3 = readonly [number, number, number];
function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Qualified Face projection: ' + message);
}
function finiteVector<T extends ReadVec3>(value: T): T {
  check(value.every(Number.isFinite), 'camera or point intermediate is not finite');
  return value;
}
function subtract(a: ReadVec3, b: ReadVec3): Vec3 {
  return finiteVector([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
}
function cross(a: ReadVec3, b: ReadVec3): Vec3 {
  return finiteVector([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]]);
}
function unit(value: ReadVec3): Vec3 {
  const length = Math.hypot(...finiteVector(value));
  check(Number.isFinite(length) && length > 0, 'camera basis is degenerate or not finite');
  return finiteVector(value.map(component => component / length) as Vec3);
}
function dot(a: ReadVec3, b: ReadVec3): number {
  const value = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  check(Number.isFinite(value), 'camera projection dot product is not finite');
  return value;
}

/** Analytic binary64 camera mapping only; it does not test rendered occlusion or sample pixels. */
export function projectViewerQualifiedFacePoint(scene: QualifiedFaceSceneV0, input: unknown,
  backingWidth: number, backingHeight: number, cssWidth: number,
  cssHeight: number): ViewerQualifiedFacePointProjection | null {
  const point = evaluateViewerQualifiedFacePoint(scene, input);
  check(Number.isFinite(cssWidth) && Number.isFinite(cssHeight)
    && cssWidth > 0 && cssHeight > 0 && cssWidth <= 4096 && cssHeight <= 4096,
  'canvas CSS bounding-box dimensions must be finite positive values≤4096');
  check(Number.isFinite(backingWidth) && Number.isFinite(backingHeight)
    && backingWidth > 0 && backingHeight > 0, 'canvas backing dimensions must be finite and positive');
  const camera = scene.camera;
  finiteVector(camera.eye); finiteVector(camera.target); finiteVector(camera.up);
  check(Number.isFinite(camera.near) && Number.isFinite(camera.far)
    && camera.near > 0 && camera.far > camera.near && Number.isFinite(camera.fovYDegrees)
    && camera.fovYDegrees > 0 && camera.fovYDegrees < 180, 'accepted camera clipping/FOV data are invalid');
  const backward = unit(subtract(camera.eye, camera.target));
  const forward = backward.map(value => -value) as Vec3;
  const right = unit(cross(camera.up, backward)), up = cross(backward, right);
  const offset = subtract(point.pointScene, camera.eye), depthScene = dot(offset, forward);
  if (depthScene <= 0 || depthScene < camera.near || depthScene > camera.far) return null;
  const tangent = Math.tan(camera.fovYDegrees * Math.PI / 360), aspect = backingWidth / backingHeight;
  const horizontal = depthScene * tangent * aspect, vertical = depthScene * tangent;
  check(Number.isFinite(tangent) && tangent > 0 && Number.isFinite(aspect) && aspect > 0
    && Number.isFinite(horizontal) && horizontal > 0 && Number.isFinite(vertical) && vertical > 0,
  'projection denominator is not finite and positive');
  const x = dot(offset, right) / horizontal, y = dot(offset, up) / vertical;
  check(Number.isFinite(x) && Number.isFinite(y), 'normalized projection is not finite');
  if (x < -1 || x > 1 || y < -1 || y > 1) return null;
  const xCss = cssWidth * (1 + x) / 2, yCss = cssHeight * (1 - y) / 2;
  check(Number.isFinite(xCss) && Number.isFinite(yCss), 'CSS projection is not finite');
  return { version: 0, point, xCss, yCss, depthScene, coordinateSpace: 'canvas-css-bounding-box',
    approximate: true, occlusion: 'not-tested' };
}
