// Private raster representation. Public geometry, transforms, cameras and CPU queries stay world based.
import { Camera } from './camera.js';
import { rasterNormalsSupplied, type PreparedGeometry } from './geometry.js';
import type { Geometry, Mesh } from './scene.js';
import type { GridOptions } from './viewer.js';
import type { ClipFrame, Environment, GridFrame, Light } from './lights.js';
import { cross, dot, invert, lookAt, multiply, normalMatrixInto, normalize, sub, transformPoint, type Mat4, type Vec3 } from './math.js';

export interface RasterCapture {
  origin: Vec3;
  viewProjection: Mat4;
  inverse: Mat4;
  camera: Camera;
  grid: GridFrame | null;
  gridPhase: readonly [number, number, number, number];
  gridAxis: Vec3;
  origins: Map<Geometry, Vec3>;
}
const LIMIT = 65536;
const rasterNormal = new Float64Array(16);
function packedCoordinatesFinite(values: readonly number[]): boolean {
  for (const value of values) if (!Number.isFinite(Math.fround(value))) return false;
  return true;
}
export const ZERO_RASTER_ORIGIN: Vec3 = [0, 0, 0];

/** B*q = M*P-O, q=P-G. Compose in Number before any Float32 write. */
export function rasterModel(M: Mat4, G: Vec3, O: Vec3): Mat4 {
  const B = M.slice();
  for (let k = 0; k < 3; k++) B[12 + k] = M[k] * G[0] + M[4 + k] * G[1] + M[8 + k] * G[2] + (M[12 + k] - O[k]);
  return B;
}
export function geometryRasterOrigin(g: PreparedGeometry): Vec3 | null {
  const b = g.bounds;
  if (!b) return [0, 0, 0];
  const G: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const span = b.max[k] - b.min[k];
    G[k] = b.min[k] + span / 2;
    if (!(span >= 0) || !Number.isFinite(span) || !Number.isFinite(Math.fround(G[k]))) return null;
  }
  return G;
}
function supportedGeometry(g: PreparedGeometry, G: Vec3): boolean {
  if (g.topology === 'labels' || g.scalars) return false;
  if (g.topology === 'triangles' && g.elementCount) {
    if (!rasterNormalsSupplied(g)) return false;
    for (let i = 0; i < g.elementCount; i++) {
      const v = 3 * (g.indices ? g.indices[i] : i), n = g.normals;
      if (!Number.isFinite(n[v]) || !Number.isFinite(n[v + 1]) || !Number.isFinite(n[v + 2]) || (n[v] === 0 && n[v + 1] === 0 && n[v + 2] === 0)) return false;
    }
  }
  const P = g.positions;
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) if (!Number.isFinite(Math.fround(P[i + k] - G[k]))) return false;
  return true;
}
function supportedMesh(m: Mesh, O: Vec3, G: Vec3): boolean {
  const M = m.transform, mat = m.material;
  if (m.instances || m.colorMap || !M.every(Number.isFinite) || M[3] !== 0 || M[7] !== 0 || M[11] !== 0 || M[15] !== 1) return false;
  if (mat.shader || mat.map || mat.normalMap || mat.roughnessMap || mat.metallicMap || mat.finish || (mat.clearcoat ?? 0) !== 0 || (mat.film ?? 0) !== 0) return false;
  const b = m.bounds;
  if (b) for (let k = 0; k < 3; k++) if (!Number.isFinite(b.min[k]) || !Number.isFinite(b.max[k]) || Math.abs(b.min[k] - O[k]) > LIMIT || Math.abs(b.max[k] - O[k]) > LIMIT) return false;
  const B = rasterModel(M, G, O), N = normalMatrixInto(rasterNormal, M);
  for (let k = 0; k < 16; k++) if (!Number.isFinite(Math.fround(B[k])) || !Number.isFinite(Math.fround(N[k]))) return false;
  return true;
}
function cardinal(up: Vec3): boolean {
  return (Math.abs(up[0]) === 1 && up[1] === 0 && up[2] === 0)
    || (Math.abs(up[1]) === 1 && up[0] === 0 && up[2] === 0)
    || (Math.abs(up[2]) === 1 && up[0] === 0 && up[1] === 0);
}
/** Keep the equivalent periodic residual near zero before binary32 addition to the local grid point. */
export function balancedRasterPhase(value: number, period: number): number {
  const r = value % period, half = period / 2;
  return r > half ? r - period : r < -half ? r + period : r;
}
/** All-or-nothing selection; no visible feature is suppressed to admit the candidate. */
export function captureRaster(meshes: readonly Mesh[], camera: Camera, grid: GridFrame | null, lights: readonly Light[], environment: Environment, clip: ClipFrame | null, aspect: number): RasterCapture | null {
  if (camera.autoClip === false || clip || (environment.softShadows ?? 0) > 0 || !camera.position.every(Number.isFinite) || !camera.target.every(Number.isFinite) || !camera.up.every(Number.isFinite)) return null;
  const O: Vec3 = [...camera.target];
  if (Math.max(Math.abs(O[0]), Math.abs(O[1]), Math.abs(O[2])) < LIMIT || !packedCoordinatesFinite(O)) return null;
  for (const l of lights) {
    if (l.kind !== 'directional' || !l.direction.every(Number.isFinite)
      || (l.direction[0] === 0 && l.direction[1] === 0 && l.direction[2] === 0)) return null;
    const d = normalize(l.direction);
    if (!d.every(Number.isFinite) || (d[0] === 0 && d[1] === 0 && d[2] === 0)) return null;
  }
  let native = false;
  const origins = new Map<Geometry, Vec3>();
  for (const m of meshes) {
    if (m.geometry.disposed) continue;
    const g = m.geometry.data;
    if (g.positions instanceof Float64Array && g.elementCount) native = true;
    let G = origins.get(m.geometry);
    if (!G) { const center = geometryRasterOrigin(g); if (!center || !supportedGeometry(g, center)) return null; G = center; origins.set(m.geometry, G); }
    if (!supportedMesh(m, O, G)) return null;
  }
  if (!native) return null;
  const up = normalize(camera.up), phase: [number, number, number, number] = [0, 0, 0, 0], axis: [number, number, number] = [0, 0, 0];
  if (!packedCoordinatesFinite(up)) return null;
  let localGrid = grid;
  if (grid) {
    if (!cardinal(up)) return null;
    const c = Math.fround(grid.cell), major = Math.fround(c * Math.fround(grid.major));
    if (!(c > 0 && major > 0) || !Number.isFinite(c) || !Number.isFinite(major) || !Number.isFinite(grid.fade) || !Number.isFinite(grid.height)) return null;
    const e2 = normalize(cross(up, Math.abs(up[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0])), e1 = cross(e2, up);
    const x = dot(O, e1), y = dot(O, e2);
    phase[0] = balancedRasterPhase(x, c); phase[1] = balancedRasterPhase(y, c);
    phase[2] = balancedRasterPhase(x, major); phase[3] = balancedRasterPhase(y, major);
    axis[0] = x; axis[1] = y;
    localGrid = { ...grid, height: grid.height - dot(O, up) };
    if (!Number.isFinite(Math.fround(localGrid.height)) || !Number.isFinite(Math.fround(localGrid.fade)) || !packedCoordinatesFinite(phase) || !packedCoordinatesFinite(axis)) return null;
  }
  const local = new Camera({ position: sub(camera.position, O), target: sub(camera.target, O), up: camera.up, projection: camera.projection, fovY: camera.fovY });
  local.near = camera.near; local.far = camera.far; local.autoClip = camera.autoClip;
  const b = camera.basis();
  if (!packedCoordinatesFinite(local.position) || !packedCoordinatesFinite(b.forward) || (b.forward[0] === 0 && b.forward[1] === 0 && b.forward[2] === 0)) return null;
  const projection = camera.projectionMatrix(aspect);
  if (!projection.every(Number.isFinite) || projection[0] === 0 || projection[5] === 0) return null;
  if (camera.projection === 'orthographic') {
    const span = camera.far - camera.near, a = Math.fround(span), b = Math.fround(-camera.far);
    if (!(span > 0 && a > 0) || !Number.isFinite(a) || !Number.isFinite(b) || Math.fround(b + a) === b) return null;
  } else if (!(camera.near > 0 && projection[14] > 0)) return null;
  const vp = multiply(projection, lookAt(local.position, local.target, local.up));
  // The inverse/decode belongs to the actual uploaded binary32 coefficients, not the mutable world camera.
  const packed = Float64Array.from(Float32Array.from(vp));
  if (!packed.every(Number.isFinite)) return null;
  let inverse: Mat4;
  try { inverse = invert(packed); } catch { return null; }
  if (!inverse.every(Number.isFinite)) return null;
  const inverse32 = Float64Array.from(Float32Array.from(inverse));
  if (!inverse32.every(Number.isFinite)) return null;
  try { if (!invert(inverse32).every(Number.isFinite)) return null; } catch { return null; }
  return { origin: O, viewProjection: packed, inverse, camera: local, grid: localGrid, gridPhase: phase, gridAxis: axis, origins };
}
/** Metadata is appended; the legacy frame prefix retains its old values. */
export function packRasterMetadata(f: Float32Array, raster: RasterCapture | null, grid = true): void {
  if (!raster) return;
  f[580] = raster.origin[0]; f[581] = raster.origin[1]; f[582] = raster.origin[2]; f[583] = 1;
  if (grid) { f.set(raster.gridPhase, 584); f.set(raster.gridAxis, 588); }
}
export function decodeRasterPoint(capture: RasterCapture, x: number, y: number, depth: number): Vec3 {
  const p = transformPoint(capture.inverse, [x, y, depth]), O = capture.origin;
  return [p[0] + O[0], p[1] + O[1], p[2] + O[2]];
}
function appendRasterVector(key: unknown[], value: readonly number[] | null | undefined): void {
  key.push(value);
  if (value) for (let i = 0; i < value.length; i++) key.push(value[i]);
}
/** Snapshot actual values, including nonfinite and signed-zero transitions, without JSON coercion. */
export function rasterInputs(meshes: readonly Mesh[], camera: Camera, grid: GridOptions | null | undefined, lights: readonly Light[], environment: Environment, clip: ClipFrame | null): unknown[] {
  const key: unknown[] = [camera, ...camera.position, ...camera.target, ...camera.up, camera.projection, camera.fovY, camera.near, camera.far, camera.autoClip, clip,
    grid?.visible, grid?.cell, grid?.major, grid?.height, grid?.opacity, environment.softShadows];
  const color = grid?.color;
  if (typeof color === 'string') key.push(color); else appendRasterVector(key, color);
  key.push(lights.length);
  for (const light of lights) {
    key.push(light, light?.kind, light?.intensity, light?.castShadow);
    if (!light) continue;
    if (typeof light.color === 'string') key.push(light.color); else appendRasterVector(key, light.color);
    if (light.kind === 'directional') appendRasterVector(key, light.direction);
    else {
      appendRasterVector(key, light.position); key.push(light.range, light.shadowRadius);
      if (light.kind === 'spot') { appendRasterVector(key, light.direction); key.push(light.angle, light.penumbra); }
    }
  }
  for (const m of meshes) {
    const g = m.geometry, a = m.material;
    key.push(m, g, g.disposed, g.data.scalars, m.instances, m.colorMap, m.visible, m.pickable, ...m.transform, a, a.shader, a.map, a.normalMap, a.roughnessMap, a.metallicMap, a.finish, a.clearcoat, a.film);
  }
  return key;
}
export function sameRasterInputs(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}
