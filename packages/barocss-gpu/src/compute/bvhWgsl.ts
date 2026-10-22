// G25 (G-R12), EXPERIMENTAL: the packed hierarchy's WGSL (bvhPack.ts' layout) — its structs, its two storage bindings
// (group 0, bindings 0 and 1) and the two queries: rayHit (the nearest crossing beyond minT, a triangle skipped) and
// nearest2 (the squared surface distance under a bound). Fixed 64-entry stacks; the kernel's algorithms.
import { BVH_STACK } from './bvhPack.js';

/** No triangle skipped: rayHit's `skip` for a ray from off the surface. */
export const NO_SKIP = 0xffffffff;
export const BVH_WGSL = /* wgsl */ `
struct Node { lo: vec3<f32>, link: i32, hi: vec3<f32>, count: i32 };
struct Tri { a: vec3<f32>, id: u32, b: vec3<f32>, p0: u32, c: vec3<f32>, p1: u32 };
@group(0) @binding(0) var<storage, read> nodes: array<Node>;
@group(0) @binding(1) var<storage, read> tris: array<Tri>;
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

`;
