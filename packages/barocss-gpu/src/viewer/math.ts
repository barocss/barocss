// Small vector and matrix helpers for the viewer. Matrices are column-major (WGSL and WebGPU order):
// element (row r, column c) is at index c * 4 + r. Depth is WebGPU's [0, 1], reversed (near → 1).
export type Vec3 = readonly [number, number, number];
export type Mat4 = Float64Array;

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => { const l = length(a); return l > 0 ? scale(a, 1 / l) : [0, 0, 0]; };

export function identity(): Mat4 { const m = new Float64Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    out[c * 4 + r] = s;
  }
  return out;
}

export function translation(t: Vec3): Mat4 { const m = identity(); m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; return m; }

/** A right-handed view matrix looking from eye at target. */
export function lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const z = normalize(sub(eye, target));
  let x = normalize(cross(up, z));
  if (length(x) === 0) x = normalize(cross(Math.abs(z[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], z));
  const y = cross(z, x), m = identity();
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
  m[12] = -dot(x, eye); m[13] = -dot(y, eye); m[14] = -dot(z, eye);
  return m;
}

/** Perspective with reversed depth and an infinite far plane: view depth −near → 1, −∞ → 0. */
export function perspectiveReversed(fovYRadians: number, aspect: number, near: number): Mat4 {
  const f = 1 / Math.tan(fovYRadians / 2), m = new Float64Array(16);
  m[0] = f / aspect; m[5] = f; m[11] = -1; m[14] = near;
  return m;
}

/** Orthographic with reversed depth: view depth −near → 1, −far → 0 (near may be negative). */
export function orthographicReversed(halfWidth: number, halfHeight: number, near: number, far: number): Mat4 {
  const m = identity();
  m[0] = 1 / halfWidth; m[5] = 1 / halfHeight;
  m[10] = 1 / (far - near); m[14] = far / (far - near);
  return m;
}

export function invert(m: Mat4): Mat4 {
  const a = m, out = new Float64Array(16);
  const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4];
  const b03 = a[1] * a[6] - a[2] * a[5], b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
  const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12], b08 = a[8] * a[15] - a[11] * a[12];
  const b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) throw new RangeError('Matrix is not invertible');
  const d = 1 / det;
  out[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d;
  out[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d;
  out[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d;
  out[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
  out[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d;
  out[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d;
  out[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d;
  out[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
  out[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d;
  out[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d;
  out[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d;
  out[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
  out[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d;
  out[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d;
  out[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d;
  out[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
  return out;
}

/** The inverse transpose of the upper 3×3 (for normals), padded to a 4×4. */
export function normalMatrix(m: Mat4): Mat4 {
  const i = invert(m), out = identity();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[c * 4 + r] = i[r * 4 + c];
  return out;
}

export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [x / w, y / w, z / w];
}
export function transformDirection(m: Mat4, d: Vec3): Vec3 {
  return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
}

/** A rotation of angle radians about a unit axis. */
export function rotation(axis: Vec3, angle: number): Mat4 {
  const [x, y, z] = normalize(axis), c = Math.cos(angle), s = Math.sin(angle), t = 1 - c, m = identity();
  m[0] = t * x * x + c; m[1] = t * x * y + s * z; m[2] = t * x * z - s * y;
  m[4] = t * x * y - s * z; m[5] = t * y * y + c; m[6] = t * y * z + s * x;
  m[8] = t * x * z + s * y; m[9] = t * y * z - s * x; m[10] = t * z * z + c;
  return m;
}

/** sRGB (0–1) to linear light. */
export const srgbToLinear = (c: number): number => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
