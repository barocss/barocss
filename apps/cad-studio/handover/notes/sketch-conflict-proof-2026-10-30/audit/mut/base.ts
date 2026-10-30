// Exact conflict proof for rectilinear outlines (D350). The kernel's solver reports a contradiction only as
// NONCONVERGENCE, which proves nothing. For horizontal / vertical edges, their lengths, axis distances and fixed
// points the equations never mix the X and Y axes and every one is a difference of two coordinates (or an
// absolute difference), so each axis is a system of difference constraints per sign choice: feasible iff its
// constraint graph has no negative cycle. Everything is exact (binary64 inputs as BigInt dyadic rationals).
//
// Every equation is relaxed to an interval of half-width s = 4 × the kernel's linear tolerance
// (`tolerances.linear` = 1e-7 mm in packages/barocss-cad/src/sketch/xy-numerical-sketch-solver-internal.ts; not
// exported publicly, so the literal is repeated here). The kernel measures a length as a hypot with the H/V
// residual ≤ t and an axis distance through helper ties, so its acceptance region lies inside these relaxed
// intervals; a conflict of the relaxed system therefore proves that no configuration the kernel could accept exists.
import { inferredHV, type OutlineConstraints, type P2 } from '/Users/user/github/barocss/barocss/.claude/worktrees/agent-a2c21c62b8d80f041/packages/barocss-cad-model/src/sketch/profile.ts';

export type ConflictProof = { proven: true } | { proven: false; why: 'outside-class' | 'feasible' | 'budget' };

const SLACK = 4 * 1e-7;
const MAX_CHECKS = 4096;

/** An exact value m × 2^e. */
interface Dy { m: bigint; e: number }
const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
function dy(v: number): Dy {
  f64[0] = v; const bits = u64[0], exp = Number((bits >> 52n) & 0x7ffn), frac = bits & 0xfffffffffffffn;
  const m = exp === 0 ? frac : frac | (1n << 52n), e = exp === 0 ? -1074 : exp - 1075;
  return { m: bits >> 63n ? -m : m, e };
}
const dyAdd = (a: Dy, b: Dy): Dy => a.e <= b.e ? { m: a.m + (b.m << BigInt(b.e - a.e)), e: a.e } : { m: (a.m << BigInt(a.e - b.e)) + b.m, e: b.e };
const dyNeg = (a: Dy): Dy => ({ m: -a.m, e: a.e });
const S = dy(SLACK);

/** lo ≤ u[to] − u[from] ≤ hi. */
interface Diff { from: number; to: number; lo: Dy; hi: Dy }
/** |u[to] − u[from]| ∈ [lo, hi] (lo already clamped at 0). */
interface Abs { from: number; to: number; lo: Dy; hi: Dy }
interface Axis { fixed: Diff[]; abs: Abs[] }

/** Relaxed equality u[to] − u[from] = c. */
const around = (from: number, to: number, c: number): Diff => { const d = dy(c); return { from, to, lo: dyAdd(d, dyNeg(S)), hi: dyAdd(d, S) }; };
const absAround = (from: number, to: number, c: number): Abs => {
  const d = dy(c), lo = dyAdd(d, dyNeg(S));
  return { from, to, lo: lo.m < 0n ? { m: 0n, e: 0 } : lo, hi: dyAdd(d, S) };
};

/** Bellman–Ford over scaled integer weights; true when there is no negative cycle. Edges are [a, b, w]. */
function feasible(nodes: number, edges: [number, number, bigint][]): boolean {
  const dist = new Array<bigint>(nodes).fill(0n);
  for (let pass = 1; pass <= nodes; pass++) {
    let changed = false;
    for (let k = 0; k < edges.length; k++) {
      const e = edges[k], d = dist[e[0]] + e[2];
      if (d < dist[e[1]]) { dist[e[1]] = d; changed = true; }
    }
    if (!changed) return true;
  }
  return false;
}

interface Search { checks: number; budget: boolean }

const scaled = (d: Dy, minE: number) => d.m << BigInt(d.e - minE);
function pushDiff(edges: [number, number, bigint][], from: number, to: number, lo: bigint, hi: bigint) { edges.push([from, to, hi], [to, from, -lo]); }

/** DFS over the sign of every absolute equation; true when some sign assignment is feasible. */
function anyFeasible(nodes: number, axis: Axis, minE: number, edges: [number, number, bigint][], depth: number, run: Search): boolean {
  if (run.checks >= MAX_CHECKS) { run.budget = true; return false; }
  run.checks++;
  if (!feasible(nodes, edges)) return false;
  if (depth === axis.abs.length) return true;
  const a = axis.abs[depth], lo = scaled(a.lo, minE), hi = scaled(a.hi, minE), size = edges.length;
  for (let sign = 0; sign < 2; sign++) {
    if (sign === 0) pushDiff(edges, a.from, a.to, lo, hi); else pushDiff(edges, a.from, a.to, -hi, -lo);
    const ok = anyFeasible(nodes, axis, minE, edges, depth + 1, run);
    edges.length = size;
    if (ok) return true;
    if (run.budget) return false;
  }
  return false;
}

const lowestExp = (axis: Axis): number => {
  let minE = Infinity;
  for (const c of axis.fixed) minE = Math.min(minE, c.lo.e, c.hi.e);
  for (const a of axis.abs) minE = Math.min(minE, a.lo.e, a.hi.e);
  return minE;
};

function axisFeasible(nodes: number, axis: Axis, run: Search): boolean {
  const minE = lowestExp(axis), edges: [number, number, bigint][] = [];
  for (const c of axis.fixed) pushDiff(edges, c.from, c.to, scaled(c.lo, minE), scaled(c.hi, minE));
  return anyFeasible(nodes, axis, minE, edges, 0, run);
}

const finite = (...v: number[]) => v.every(Number.isFinite);

/**
 * Whether the outline's constraints are provably contradictory (see the header). `outside-class`: the
 * constraints use something this proof does not model; `feasible`: some sign choice satisfies the relaxed
 * system on both axes (nothing is proven); `budget`: the sign search ran out of its 4096 feasibility checks.
 */
export function rectilinearConflict(points: P2[], c: OutlineConstraints, bulges: number[] = []): ConflictProof {
  const n = points.length, out: ConflictProof = { proven: false, why: 'outside-class' };
  if (!n || bulges.some(Boolean) || c.circles?.length || c.circleRadii?.length || Object.keys(c.radii ?? {}).length
    || c.tangents?.length || c.equalRadii?.length || c.concentric?.length) return out;
  if (!points.every(p => finite(p[0], p[1]))) return out;
  const hv = c.hv ?? inferredHV(points, bulges), isH = new Set(hv.h), isV = new Set(hv.v);
  const lengths = Object.entries(c.lengths ?? {});
  for (const [i, v] of lengths) if (!finite(v) || !(isH.has(+i) !== isV.has(+i))) return out;
  const rules = c.rules ?? [];
  for (const r of rules) {
    if (r.kind !== 'fix' && r.kind !== 'dx' && r.kind !== 'dy') return out;
    if (r.kind === 'fix' ? !finite(r.at[0], r.at[1]) : !finite(r.value)) return out;
  }
  const ground = n, axes: Axis[] = [{ fixed: [], abs: [] }, { fixed: [], abs: [] }];
  for (let k = 0; k < 2; k++) axes[k].fixed.push(around(ground, 0, points[0][k]));
  // H edges keep Y equal, V edges keep X equal; a length is measured along the other axis.
  for (const i of isH) if (i >= 0 && i < n) axes[1].fixed.push(around(i, (i + 1) % n, 0));
  for (const i of isV) if (i >= 0 && i < n) axes[0].fixed.push(around(i, (i + 1) % n, 0));
  for (const [i, v] of lengths) axes[isH.has(+i) ? 0 : 1].abs.push(absAround(+i, (+i + 1) % n, v));
  for (const r of rules) {
    if (r.kind === 'fix') { if (r.point >= 0 && r.point < n) for (let k = 0; k < 2; k++) axes[k].fixed.push(around(ground, r.point, r.at[k])); }
    else if ((r.kind === 'dx' || r.kind === 'dy') && r.a >= 0 && r.b >= 0 && r.a < n && r.b < n && r.a !== r.b) axes[r.kind === 'dx' ? 0 : 1].abs.push(absAround(r.a, r.b, r.value));
  }
  const run: Search = { checks: 0, budget: false };
  for (const axis of axes) {
    if (axisFeasible(n + 1, axis, run)) continue;
    if (run.budget) return { proven: false, why: 'budget' };
    return { proven: true };
  }
  return { proven: false, why: 'feasible' };
}
