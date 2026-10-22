// G25a (G-R11), EXPERIMENTAL: may change without a version bump. Wall thickness on the GPU, the studio's IM4 rule one to
// one: per display triangle, a ray from its centre inward along its normal (skipping it) to the next wall — the depth —
// and twice the distance from that ray's midpoint to the nearest surface, at most the depth: the inscribed sphere there,
// the local thickness. Display only: the exact values stay the CPU's. A WGSL compute pass over the packed hierarchy
// (bvhPack.ts), a fixed 64-entry stack; `cpuWallThickness` is its mirror on the same words for checks.

import { BVH_STACK, packedNearestDistance2, packedRayHit, type PackedBvh } from './bvhPack.js';

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
export const WALL_THICKNESS_WGSL = /* wgsl */ `
struct Node { lo: vec3<f32>, link: i32, hi: vec3<f32>, count: i32 };
struct Tri { a: vec3<f32>, id: u32, b: vec3<f32>, p0: u32, c: vec3<f32>, p1: u32 };
struct Params { minT: f32, count: u32, pad0: u32, pad1: u32 };
@group(0) @binding(0) var<storage, read> nodes: array<Node>;
@group(0) @binding(1) var<storage, read> tris: array<Tri>;
@group(0) @binding(2) var<storage, read> origins: array<f32>;
@group(0) @binding(3) var<storage, read> dirs: array<f32>;
@group(0) @binding(4) var<storage, read_write> outDepth: array<f32>;
@group(0) @binding(5) var<storage, read_write> outLocal: array<f32>;
@group(0) @binding(6) var<uniform> params: Params;
const INF: f32 = 3.4028235e38;
const DET_TOL: f32 = 1e-14;

fn rayHit(o: vec3<f32>, d: vec3<f32>, minT: f32, skip: u32) -> f32 {
  var stack: array<i32, ${BVH_STACK}>;
  var top: i32 = 0;
  stack[0] = 0; top = 1;
  var best: f32 = INF;
  let inv = vec3<f32>(1.0) / d;
  let flat = d == vec3<f32>(0.0);
  loop {
    if (top == 0) { break; }
    top = top - 1;
    let n = nodes[stack[top]];
    var lo: f32 = -INF; var hi: f32 = INF;
    var skipNode = false;
    for (var k: i32 = 0; k < 3; k = k + 1) {
      if (flat[k]) { if (o[k] < n.lo[k] || o[k] > n.hi[k]) { skipNode = true; } }
      else {
        let t0 = (n.lo[k] - o[k]) * inv[k]; let t1 = (n.hi[k] - o[k]) * inv[k];
        lo = max(lo, min(t0, t1)); hi = min(hi, max(t0, t1));
      }
    }
    if (skipNode || !(hi >= max(lo, 0.0)) || lo > best) { continue; }
    if (n.link >= 0) { stack[top] = n.link; stack[top + 1] = n.link + 1; top = top + 2; continue; }
    let start = -1 - n.link;
    for (var i: i32 = start; i < start + n.count; i = i + 1) {
      let tr = tris[i];
      if (tr.id == skip) { continue; }
      let e1 = tr.b - tr.a; let e2 = tr.c - tr.a;
      let h = cross(d, e2); let det = dot(e1, h);
      if (det > -DET_TOL && det < DET_TOL) { continue; }
      let s = o - tr.a; let u = dot(s, h) / det;
      if (u < 0.0 || u > 1.0) { continue; }
      let q = cross(s, e1); let v = dot(d, q) / det;
      if (v < 0.0 || u + v > 1.0) { continue; }
      let t = dot(e2, q) / det;
      if (t > minT && t < best) { best = t; }
    }
  }
  return best;
}

fn box2(n: Node, p: vec3<f32>) -> f32 {
  let d = max(max(n.lo - p, vec3<f32>(0.0)), p - n.hi);
  return dot(d, d);
}
fn tri2(tr: Tri, p: vec3<f32>) -> f32 {
  let ab = tr.b - tr.a; let ac = tr.c - tr.a; let ap = p - tr.a;
  let d1 = dot(ab, ap); let d2 = dot(ac, ap);
  var q: vec3<f32>;
  if (d1 <= 0.0 && d2 <= 0.0) { q = tr.a; }
  else {
    let bp = p - tr.b; let d3 = dot(ab, bp); let d4 = dot(ac, bp);
    let cp = p - tr.c; let d5 = dot(ab, cp); let d6 = dot(ac, cp);
    let vc = d1 * d4 - d3 * d2; let vb = d5 * d2 - d1 * d6; let va = d3 * d6 - d5 * d4;
    if (d3 >= 0.0 && d4 <= d3) { q = tr.b; }
    else if (d6 >= 0.0 && d5 <= d6) { q = tr.c; }
    else if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0) { q = tr.a + ab * (d1 / (d1 - d3)); }
    else if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0) { q = tr.a + ac * (d2 / (d2 - d6)); }
    else if (va <= 0.0 && d4 - d3 >= 0.0 && d5 - d6 >= 0.0) { q = tr.b + (tr.c - tr.b) * ((d4 - d3) / ((d4 - d3) + (d5 - d6))); }
    else { let den = 1.0 / (va + vb + vc); q = tr.a + ab * (vb * den) + ac * (vc * den); }
  }
  let e = p - q;
  return dot(e, e);
}
fn nearest2(p: vec3<f32>, bound2: f32) -> f32 {
  var stack: array<i32, ${BVH_STACK}>;
  var top: i32 = 1;
  stack[0] = 0;
  var best: f32 = bound2;
  loop {
    if (top == 0) { break; }
    top = top - 1;
    let n = nodes[stack[top]];
    if (box2(n, p) >= best) { continue; }
    if (n.link < 0) {
      let start = -1 - n.link;
      for (var i: i32 = start; i < start + n.count; i = i + 1) { best = min(best, tri2(tris[i], p)); }
      continue;
    }
    let l = n.link; let r = n.link + 1;
    let dl = box2(nodes[l], p); let dr = box2(nodes[r], p);
    if (dl < dr) {
      if (dr < best) { stack[top] = r; top = top + 1; }
      if (dl < best) { stack[top] = l; top = top + 1; }
    } else {
      if (dl < best) { stack[top] = l; top = top + 1; }
      if (dr < best) { stack[top] = r; top = top + 1; }
    }
  }
  return best;
}

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

// ---- The WebGPU dispatch (structural types: the package does not depend on @webgpu/types) ---------------------------------
interface ComputeBuffer { destroy(): void; mapAsync(mode: number): Promise<void>; getMappedRange(): ArrayBuffer; unmap(): void }
interface ComputePass { setPipeline(p: object): void; setBindGroup(i: number, g: object): void; dispatchWorkgroups(x: number): void; end(): void }
interface ComputeEncoder { beginComputePass(): ComputePass; copyBufferToBuffer(a: ComputeBuffer, ao: number, b: ComputeBuffer, bo: number, size: number): void; finish(): object }
/** What the pass needs of a GPUDevice. */
export interface ComputeDevice {
  readonly queue: { writeBuffer(b: ComputeBuffer, offset: number, data: ArrayBufferView | ArrayBuffer): void; submit(commands: object[]): void };
  createBuffer(d: { size: number; usage: number; label?: string }): ComputeBuffer;
  createShaderModule(d: { code: string; label?: string }): object;
  createComputePipelineAsync(d: object): Promise<{ getBindGroupLayout(i: number): object }>;
  createBindGroup(d: object): object;
  createCommandEncoder(): ComputeEncoder;
}
const STORAGE = 128, COPY_SRC = 4, COPY_DST = 8, UNIFORM = 64, MAP_READ = 1;
const pipelines = new WeakMap<object, Promise<{ getBindGroupLayout(i: number): object }>>();

function storage(device: ComputeDevice, data: ArrayBuffer | ArrayBufferView, owned: ComputeBuffer[], label: string): ComputeBuffer {
  const bytes = Math.max(16, Math.ceil(data.byteLength / 4) * 4), b = device.createBuffer({ size: bytes, usage: STORAGE | COPY_DST, label });
  owned.push(b); if (data.byteLength) device.queue.writeBuffer(b, 0, data);
  return b;
}
/** The wall thickness of the packed mesh's rays on the GPU (each triangle one invocation). Its buffers are released after. */
export async function gpuWallThickness(device: ComputeDevice, bvh: PackedBvh, rays: WallRays, minT = 1e-6): Promise<WallThickness> {
  let pipeline = pipelines.get(device);
  if (!pipeline) {
    pipeline = device.createComputePipelineAsync({ layout: 'auto', compute: { module: device.createShaderModule({ code: WALL_THICKNESS_WGSL, label: 'wall thickness' }), entryPoint: 'main' } });
    pipelines.set(device, pipeline);
  }
  const p = await pipeline, owned: ComputeBuffer[] = [], n = rays.count, bytes = Math.max(16, 4 * n);
  try {
    const params = new ArrayBuffer(16); new Float32Array(params, 0, 1)[0] = minT; new Uint32Array(params, 4, 1)[0] = n;
    const uniform = device.createBuffer({ size: 16, usage: UNIFORM | COPY_DST, label: 'wall thickness params' }); owned.push(uniform); device.queue.writeBuffer(uniform, 0, params);
    const nodes = storage(device, bvh.nodes, owned, 'bvh nodes'), tris = storage(device, bvh.triangles, owned, 'bvh triangles');
    const origins = storage(device, rays.origins, owned, 'wall origins'), dirs = storage(device, rays.dirs, owned, 'wall dirs');
    const outDepth = device.createBuffer({ size: bytes, usage: STORAGE | COPY_SRC, label: 'wall depth' }), outLocal = device.createBuffer({ size: bytes, usage: STORAGE | COPY_SRC, label: 'wall local' });
    const readDepth = device.createBuffer({ size: bytes, usage: MAP_READ | COPY_DST }), readLocal = device.createBuffer({ size: bytes, usage: MAP_READ | COPY_DST });
    owned.push(outDepth, outLocal, readDepth, readLocal);
    const group = device.createBindGroup({ layout: p.getBindGroupLayout(0), entries: [nodes, tris, origins, dirs, outDepth, outLocal, uniform].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const enc = device.createCommandEncoder(), pass = enc.beginComputePass();
    pass.setPipeline(p); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(n / 64)); pass.end();
    enc.copyBufferToBuffer(outDepth, 0, readDepth, 0, bytes); enc.copyBufferToBuffer(outLocal, 0, readLocal, 0, bytes);
    device.queue.submit([enc.finish()]);
    await Promise.all([readDepth.mapAsync(MAP_READ), readLocal.mapAsync(MAP_READ)]);
    const depth = new Float32Array(readDepth.getMappedRange().slice(0, 4 * n)), local = new Float32Array(readLocal.getMappedRange().slice(0, 4 * n));
    readDepth.unmap(); readLocal.unmap();
    // (The shader's INF is f32's largest: read back as Infinity, as the CPU's.)
    for (let i = 0; i < n; i++) { if (depth[i] >= 3.4e38) depth[i] = Infinity; if (local[i] >= 3.4e38) local[i] = Infinity; }
    return { depth, local };
  } finally { for (const b of owned) b.destroy(); }
}
