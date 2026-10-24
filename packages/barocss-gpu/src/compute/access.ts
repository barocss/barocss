// G25b (G-R12), EXPERIMENTAL: may change without a version bump. A 3-axis mill's access on the GPU, CNC4's rule one to one
// (cad-model machining/access.ts): every display triangle split into n² equal parts (n from its longest edge over the
// step, at most 48), each part's centre 0.01 mm off the face along its normal; from it, a ray along each of ±X, ±Y, ±Z
// on the face's side (n · d ≥ −1e-9) — reached when the ray leaves the part. The samples are laid out on the CPU (cheap),
// their six rays run one invocation a sample on the GPU, and the masks fold back per triangle on the CPU: the share of its
// area no direction reaches and the OR of its masks. Display only: the exact values stay the CPU's.

import { packedRayHit, type PackedBvh } from './bvhPack.js';
import { BVH_WGSL } from './bvhWgsl.js';
import { runCompute, type ComputeDevice } from './dispatch.js';

export const ACCESS_DIRECTIONS: readonly (readonly [number, number, number])[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const OFF = 0.01, MAX_N = 48;

/** The samples: their points (3 a sample), the directions on their face's side (6-bit), their triangle and area share. */
export interface AccessSamples { readonly points: Float32Array; readonly side: Uint32Array; readonly triangle: Uint32Array; readonly area: Float32Array; readonly count: number; readonly triangles: number }

/** CNC4's samples of a mesh at `step` mm apart (accessOf's: the parts of each triangle, in its order). */
export function accessSampleSet(positions: ArrayLike<number>, indices: ArrayLike<number>, step: number): AccessSamples {
  const T = Math.floor(indices.length / 3);
  // (Counted first, so the arrays are allocated once.)
  let S = 0;
  for (let t = 0; t < T; t++) S += partsOf(positions, indices, t, step);
  const points = new Float32Array(3 * S), side = new Uint32Array(S), triangle = new Uint32Array(S), area = new Float32Array(S);
  let k = 0;
  for (let t = 0; t < T; t++) {
    const a = 3 * indices[3 * t], b = 3 * indices[3 * t + 1], c = 3 * indices[3 * t + 2];
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (!(l > 0)) continue;
    const n = sides(positions, indices, t, step), cell = l / 2 / (n * n), ex = nx / l, ey = ny / l, ez = nz / l;
    let mask = 0;
    for (let d = 0; d < 6; d++) if (ex * ACCESS_DIRECTIONS[d][0] + ey * ACCESS_DIRECTIONS[d][1] + ez * ACCESS_DIRECTIONS[d][2] >= -1e-9) mask |= 1 << d;
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) for (let up = 0; up < 2; up++) {
      if (up === 1 && i + j > n - 2) continue;
      const s = (i + (up ? 2 : 1) / 3) / n, r = (j + (up ? 2 : 1) / 3) / n;
      points[3 * k] = positions[a] + s * ux + r * vx + OFF * ex; points[3 * k + 1] = positions[a + 1] + s * uy + r * vy + OFF * ey; points[3 * k + 2] = positions[a + 2] + s * uz + r * vz + OFF * ez;
      side[k] = mask; triangle[k] = t; area[k] = cell; k++;
    }
  }
  return { points, side, triangle, area, count: S, triangles: T };
}
/** A triangle's n (parts along an edge): its longest edge over the step, 1 to 48. */
function sides(P: ArrayLike<number>, I: ArrayLike<number>, t: number, h: number): number {
  const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
  const e = Math.max(Math.hypot(P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]), Math.hypot(P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]), Math.hypot(P[c] - P[b], P[c + 1] - P[b + 1], P[c + 2] - P[b + 2]));
  return Math.min(MAX_N, Math.max(1, Math.ceil(e / h)));
}
/** The number of parts of a triangle (n², or none for a degenerate one). */
function partsOf(P: ArrayLike<number>, I: ArrayLike<number>, t: number, h: number): number {
  const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
  if (!(Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) > 0)) return 0;
  const n = sides(P, I, t, h);
  return n * n;
}

/** The CPU mirror of the GPU pass: each sample's 6-bit mask of the directions that reach it. */
export function cpuAccessMasks(bvh: PackedBvh, s: AccessSamples): Uint32Array {
  const out = new Uint32Array(s.count), p = s.points;
  for (let k = 0; k < s.count; k++) {
    let mask = 0;
    for (let d = 0; d < 6; d++) {
      if (!(s.side[k] & (1 << d))) continue;
      const v = ACCESS_DIRECTIONS[d];
      if (packedRayHit(bvh, p[3 * k], p[3 * k + 1], p[3 * k + 2], v[0], v[1], v[2]) === Infinity) mask |= 1 << d;
    }
    out[k] = mask;
  }
  return out;
}

/** Per triangle: the share of its area no direction reaches, and the OR of its samples' masks (accessSamples' output). */
export function accessByTriangle(s: AccessSamples, masks: Uint32Array): { unreachedShare: Float32Array; mask: Uint8Array } {
  const none = new Float64Array(s.triangles), area = new Float64Array(s.triangles), mask = new Uint8Array(s.triangles);
  for (let k = 0; k < s.count; k++) { const t = s.triangle[k]; area[t] += s.area[k]; if (!masks[k]) none[t] += s.area[k]; mask[t] |= masks[k]; }
  const unreachedShare = new Float32Array(s.triangles);
  for (let t = 0; t < s.triangles; t++) unreachedShare[t] = area[t] > 0 ? none[t] / area[t] : 0;
  return { unreachedShare, mask };
}

/** The compute shader: one invocation a sample, its six rays (minT 1e-6, no triangle skipped, as accessOf's rayHit). */
export const ACCESS_WGSL = /* wgsl */ BVH_WGSL + `
struct Params { count: u32, pad0: u32, pad1: u32, pad2: u32 };
@group(0) @binding(2) var<storage, read> points: array<f32>;
@group(0) @binding(3) var<storage, read> side: array<u32>;
@group(0) @binding(4) var<storage, read_write> outMask: array<u32>;
@group(0) @binding(5) var<uniform> params: Params;
// (Direction d: axis d / 2, + for even d and − for odd — DIRECTIONS' order; built, not a const array indexed at run time.)
fn direction(d: u32) -> vec3<f32> {
  var v = vec3<f32>(0.0);
  v[d / 2u] = select(1.0, -1.0, (d & 1u) == 1u);
  return v;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let k = gid.x;
  if (k >= params.count) { return; }
  let p = vec3<f32>(points[3u * k], points[3u * k + 1u], points[3u * k + 2u]);
  var mask: u32 = 0u;
  for (var d: u32 = 0u; d < 6u; d = d + 1u) {
    if ((side[k] & (1u << d)) == 0u) { continue; }
    if (rayHit(p, direction(d), 1e-6, 0xffffffffu) >= INF) { mask = mask | (1u << d); }
  }
  outMask[k] = mask;
}
`;

/** The samples' masks on the GPU (one invocation a sample). */
export async function gpuAccessMasks(device: ComputeDevice, bvh: PackedBvh, s: AccessSamples): Promise<Uint32Array> {
  const params = new ArrayBuffer(16); new Uint32Array(params, 0, 1)[0] = s.count;
  const [m] = await runCompute(device, { code: ACCESS_WGSL, label: 'access', inputs: [bvh.nodes, bvh.triangles, s.points, s.side], params, outputs: [4 * s.count], invocations: s.count });
  return new Uint32Array(m);
}
