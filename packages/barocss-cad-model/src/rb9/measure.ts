// What the RB9 checkers measure on a part (O70): exact quantities from the kernel — volumes from its mass properties,
// cylinders from the B-rep's exact faces — and the studio's own checks (check_spec queries) run on a copy of the part
// with the checker's requirements, never the agent's.
import type { StudioDoc } from '../engine/doc';
import type { BodyResult } from '../engine/evaluate';
import type { Vec3 } from '../engine/mesh';
import { checkSpec, type Requirement } from '../chat/spec';
import type { Evaluate, Outcome } from './core';
import { boundsOf } from '../engine/bounds';

export const volumeOf = (bodies: readonly BodyResult[]) => bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0);
/** The parts' box (the display meshes', to their single precision: 1e-4 mm on these sizes). */
export function boxOf(bodies: readonly BodyResult[]): { min: Vec3; max: Vec3 } | null {
  if (!bodies.length) return null;
  return boundsOf(bodies);
}
export interface Cylinder { c: Vec3; a: Vec3; r: number; zMin: number; zMax: number; body: number; face: number }
/** Every exact cylindrical face (the B-rep's own, A6.3), with its extent along its axis from its mesh. */
export function cylindersOf(bodies: readonly BodyResult[]): Cylinder[] {
  const out: Cylinder[] = [];
  bodies.forEach((b, bi) => {
    const m = b.mesh;
    for (const f of m.faces) {
      const e = f.exact; if (e?.kind !== 'cylinder') continue;
      const l = Math.hypot(...e.a), a: Vec3 = [e.a[0] / l, e.a[1] / l, e.a[2] / l];
      let lo = Infinity, hi = -Infinity;
      for (let v = 0; v < m.faceOfVertex.length; v++) if (m.faceOfVertex[v] === f.index) { const s = (m.positions[v * 3] - e.c[0]) * a[0] + (m.positions[v * 3 + 1] - e.c[1]) * a[1] + (m.positions[v * 3 + 2] - e.c[2]) * a[2]; lo = Math.min(lo, s); hi = Math.max(hi, s); }
      out.push({ c: e.c, a, r: e.r, zMin: lo, zMax: hi, body: bi, face: f.index });
    }
  });
  return out;
}
/** The distinct cylinders: one a radius and axis line (a face the kernel splits in halves counted once). */
export function distinctCylinders(cs: readonly Cylinder[]): Cylinder[] {
  const out: Cylinder[] = [];
  for (const c of cs) {
    const same = out.find(o => Math.abs(o.r - c.r) <= 1e-9 && parallel(o.a, c.a) && axisDistance(o, c.c) <= 1e-9);
    if (same) { same.zMin = Math.min(same.zMin, c.zMin); same.zMax = Math.max(same.zMax, c.zMax); } else out.push({ ...c });
  }
  return out;
}
/** A named face's exact plane and its box (its mesh's vertices), on whichever body has it; null when none does. */
export function planeFace(bodies: readonly BodyResult[], name: string): { o: Vec3; n: Vec3; min: Vec3; max: Vec3 } | null {
  for (const b of bodies) {
    const m = b.mesh, f = m.faces.find(x => x.name.replace(/#\d+$/, '') === name), e = f?.exact;
    if (!f || e?.kind !== 'plane') continue;
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < m.faceOfVertex.length; v++) if (m.faceOfVertex[v] === f.index) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], m.positions[v * 3 + k]); max[k] = Math.max(max[k], m.positions[v * 3 + k]); }
    return { o: e.o, n: e.n, min, max };
  }
  return null;
}
/** A point's distance from a cylinder's axis line. */
export function axisDistance(c: Cylinder, p: readonly number[]): number {
  const d = [p[0] - c.c[0], p[1] - c.c[1], p[2] - c.c[2]], s = d[0] * c.a[0] + d[1] * c.a[1] + d[2] * c.a[2];
  return Math.hypot(d[0] - s * c.a[0], d[1] - s * c.a[1], d[2] - s * c.a[2]);
}
export const parallel = (a: readonly number[], b: readonly number[]) => Math.abs(Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) - 1) <= 1e-12;

/** An outcome from a number against its expectation. */
export function near(id: string, measured: number | null, expected: number, tol: number, rel = false, hard = true): Outcome {
  const ok = measured !== null && Number.isFinite(measured) && Math.abs(measured - expected) <= tol * (rel ? Math.max(1, Math.abs(expected)) : 1);
  return { id, hard, pass: ok, measured, expected: `${expected} ± ${tol}${rel ? ' relative' : ''}` };
}
export function holds(id: string, ok: boolean, measured: unknown, expected: string, hard = true): Outcome { return { id, hard, pass: ok, measured, expected }; }
/** The box against (x, y, z) from the origin: its size and its corner. */
export function boxIs(id: string, bodies: readonly BodyResult[], size: readonly number[], corner: readonly number[] = [0, 0, 0], tol = 1e-4): Outcome {
  const b = boxOf(bodies);
  const ok = !!b && [0, 1, 2].every(k => Math.abs(b.max[k] - b.min[k] - size[k]) <= tol && Math.abs(b.min[k] - corner[k]) <= tol);
  return { id, hard: true, pass: ok, measured: b ? { size: [0, 1, 2].map(k => +(b.max[k] - b.min[k]).toFixed(6)), min: b.min.map(v => +v.toFixed(6)) } : null, expected: `size ${size.join(' × ')} at ${corner.join(', ')} ± ${tol}` };
}
/** The studio's own checks, run on a copy of the part with the checker's requirements (and its process or print direction). */
export async function studioChecks(doc: StudioDoc, evaluate: Evaluate, reqs: Requirement[], extra: Partial<StudioDoc> = {}): Promise<Outcome[]> {
  const copy = { ...doc, ...extra, requirements: reqs }, r = await evaluate(copy);
  if (!r.ok) return reqs.map(q => ({ id: q.id, hard: !!q.hard, pass: false, measured: 'the part does not evaluate', expected: q.source }));
  const spec = await checkSpec(copy, r.bodies, evaluate);
  return reqs.map(q => { const o = spec.outcomes.get(q.id) as { status?: string; measured?: unknown } | undefined; return { id: q.id, hard: !!q.hard, pass: o?.status === 'pass', measured: o?.measured ?? o?.status ?? 'unknown', expected: q.source }; });
}
