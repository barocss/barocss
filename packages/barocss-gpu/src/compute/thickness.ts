// G25a (G-R11), EXPERIMENTAL: may change without a version bump. Wall thickness on the GPU, the studio's IM4 rule one to
// one: per display triangle, a ray from its centre inward along its normal (skipping it) to the next wall — the depth —
// and twice the distance from that ray's midpoint to the nearest surface, at most the depth: the inscribed sphere there,
// the local thickness. Display only: the exact values stay the CPU's. A WGSL compute pass over the packed hierarchy
// (bvhPack.ts), a fixed 64-entry stack; `cpuWallThickness` is its mirror on the same words for checks.

import { packedNearestDistance2, packedRayHit, type PackedBvh } from './bvhPack.js';
import { BVH_WGSL } from './bvhWgsl.js';
import { runCompute, type ComputeDevice } from './dispatch.js';

/** Per triangle: its centre and unit inward normal (zero for a degenerate one: no ray), and its index (the ray's skip). */
export interface WallRays { readonly origins: Float32Array; readonly dirs: Float32Array; readonly count: number }
/** Per triangle: the ray's depth to the next wall (Infinity for none) and the local thickness (Infinity where the depth is). */
export interface WallThickness { readonly depth: Float32Array; readonly local: Float32Array }

/** The IM4 rays of a mesh: each triangle's centre, and its normal reversed (inward for an outward-wound solid). */
export function wallRays(positions: ArrayLike<number>, indices: ArrayLike<number>): WallRays {
  const count = Math.floor(indices.length / 3), origins = new Float32Array(3 * count), dirs = new Float32Array(3 * count);
  for (let t = 0; t < count; t++) {
    const a = 3 * indices[3 * t], b = 3 * indices[3 * t + 1], c = 3 * indices[3 * t + 2];
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const e1x = positions[b] - ax, e1y = positions[b + 1] - ay, e1z = positions[b + 2] - az, e2x = positions[c] - ax, e2y = positions[c + 1] - ay, e2z = positions[c + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, l = Math.hypot(nx, ny, nz);
    origins[3 * t] = (ax + positions[b] + positions[c]) / 3; origins[3 * t + 1] = (ay + positions[b + 1] + positions[c + 1]) / 3; origins[3 * t + 2] = (az + positions[b + 2] + positions[c + 2]) / 3;
    // (A degenerate triangle keeps a zero direction — no ray: WGSL may not keep a NaN test.)
    if (l > 0) { dirs[3 * t] = -nx / l; dirs[3 * t + 1] = -ny / l; dirs[3 * t + 2] = -nz / l; }
  }
  return { origins, dirs, count };
}

/** The CPU mirror of the GPU pass, on the same packed words and rays. */
export function cpuWallThickness(bvh: PackedBvh, rays: WallRays, minT = 1e-6): WallThickness {
  const depth = new Float32Array(rays.count).fill(Infinity), local = new Float32Array(rays.count).fill(Infinity), o = rays.origins, d = rays.dirs;
  for (let t = 0; t < rays.count; t++) {
    const k = 3 * t, dx = d[k], dy = d[k + 1], dz = d[k + 2];
    if (dx === 0 && dy === 0 && dz === 0) continue;
    const h = packedRayHit(bvh, o[k], o[k + 1], o[k + 2], dx, dy, dz, minT, t);
    depth[t] = h;
    if (Number.isFinite(h)) local[t] = 2 * Math.sqrt(packedNearestDistance2(bvh, o[k] + dx * h / 2, o[k + 1] + dy * h / 2, o[k + 2] + dz * h / 2, h * h / 4));
  }
  return { depth, local };
}

/** The compute shader: one invocation a triangle; `params.x` the ray's minT, `params.y` the ray count (as bits). */
export const WALL_THICKNESS_WGSL = /* wgsl */ BVH_WGSL + `
struct Params { minT: f32, count: u32, pad0: u32, pad1: u32 };
@group(0) @binding(2) var<storage, read> origins: array<f32>;
@group(0) @binding(3) var<storage, read> dirs: array<f32>;
@group(0) @binding(4) var<storage, read_write> outDepth: array<f32>;
@group(0) @binding(5) var<storage, read_write> outLocal: array<f32>;
@group(0) @binding(6) var<uniform> params: Params;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let t = gid.x;
  if (t >= params.count) { return; }
  let o = vec3<f32>(origins[3u * t], origins[3u * t + 1u], origins[3u * t + 2u]);
  let d = vec3<f32>(dirs[3u * t], dirs[3u * t + 1u], dirs[3u * t + 2u]);
  outDepth[t] = INF; outLocal[t] = INF;
  if (all(d == vec3<f32>(0.0))) { return; }
  let h = rayHit(o, d, params.minT, t);
  outDepth[t] = h;
  if (h < INF) { outLocal[t] = 2.0 * sqrt(nearest2(o + d * (h * 0.5), h * h * 0.25)); }
}
`;

/** The wall thickness of the packed mesh's rays on the GPU (each triangle one invocation). Its buffers are released after. */
export async function gpuWallThickness(device: ComputeDevice, bvh: PackedBvh, rays: WallRays, minT = 1e-6): Promise<WallThickness> {
  const params = new ArrayBuffer(16); new Float32Array(params, 0, 1)[0] = minT; new Uint32Array(params, 4, 1)[0] = rays.count;
  const [d, l] = await runCompute(device, { code: WALL_THICKNESS_WGSL, label: 'wall thickness', inputs: [bvh.nodes, bvh.triangles, rays.origins, rays.dirs], params, outputs: [4 * rays.count, 4 * rays.count], invocations: rays.count });
  const depth = new Float32Array(d), local = new Float32Array(l);
  // (The shader's INF is f32's largest: read back as Infinity, as the CPU's.)
  for (let i = 0; i < rays.count; i++) { if (depth[i] >= 3.4e38) depth[i] = Infinity; if (local[i] >= 3.4e38) local[i] = Infinity; }
  return { depth, local };
}
