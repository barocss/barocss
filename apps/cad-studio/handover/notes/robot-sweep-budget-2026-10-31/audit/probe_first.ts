// Item 2: the !(step > 1e-12) contact branch reports contact whenever d <= tol + 1e-12·rate at a sample. A body sliding
// parallel past another at a constant gap g (or a disk spinning above a plate): d = g at every s, rate = travel (prismatic) /
// dq·reach (revolute). So g in (tol, tol + 1e-12·rate] -> contact at s = 0 (one sample) though the true clearance g > tol.
const T = '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model';
import { evaluatePart, placeBody, type BodyResult } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/evaluate';
import { rectanglePart } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/doc';
import { rotationMatrix } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/engine/placement';
import { convexHull } from '@barocss/cad';
import { sweepPath, type SweepLink } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/robot/sweep';
import { sweepTimed, CCD_TOLERANCE } from '/Users/user/github/barocss/barocss/.claude/worktrees/heuristic-gould-b94e20/packages/barocss-cad-model/src/robot/ccd';
async function box(w: number, d: number, h: number, at: [number, number, number]): Promise<SweepLink & { id?: string }> {
  const e = await evaluatePart(rectanglePart(w, d, h), 1); if (!e.ok) throw new Error('eval');
  const bodies: BodyResult[] = e.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix([0, 0, 0]), at));
  let nv = 0, ni = 0; for (const b of bodies) { nv += b.mesh.positions.length; ni += b.mesh.indices.length; }
  const positions = new Float64Array(nv), indices = new Uint32Array(ni); let vo = 0, io = 0;
  for (const b of bodies) { const base = vo / 3; positions.set(b.mesh.positions, vo); vo += b.mesh.positions.length; for (const k of b.mesh.indices) indices[io++] = k + base; }
  return { link: '', positions, indices, hull: convexHull(positions).positions } as SweepLink;
}
const bbox = (p: ArrayLike<number>) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < p.length; i++) { lo[i % 3] = Math.min(lo[i % 3], p[i]); hi[i % 3] = Math.max(hi[i % 3], p[i]); } return { lo, hi }; };
const tree = (type: 'prismatic' | 'revolute' | 'continuous', axis: [number, number, number], origin: [number, number, number] = [0, 0, 0]) => ({ version: 1, base: 'still', links: [{ id: 'still', part: null, name: 'still' }, { id: 'fixed', part: 'fixed', name: 'fixed' }, { id: 'moving', part: 'moving', name: 'moving' }],
  joints: [{ key: 'still~fixed', type: 'fixed', parent: 'still', child: 'fixed', origin: [0, 0, 0], axis: [0, 0, 1], mates: [] }, { key: 'still~moving', type, parent: 'still', child: 'moving', origin, axis, mates: [] }], loops: [], couplings: [], problems: [], notes: [] }) as any;
const brief = (r: any) => JSON.stringify({ clear: r.clear, contact: r.contact && { s: r.contact.s, links: r.contact.links }, exhausted: r.exhausted && { s: r.exhausted.s }, toi: r.toi, min: r.minClearance?.mm, samples: r.samples });

for (const [label, y] of [['overlap 1 mm', 9], ['gap 0.5e-6 (< tol)', 10 + 5e-7], ['gap 5 mm', 15]] as [string, number][]) {
  const F = { ...(await box(10, 10, 10, [0, 0, 0])), link: 'fixed' }, M = { ...(await box(10, 10, 10, [0, y, 0])), link: 'moving' };
  for (const m of [1, 2]) {
    const r = sweepPath(tree('prismatic', [1, 0, 0]), [F, M], {}, { 'still~moving': 30 }, { maxSamples: m });
    const st = sweepTimed(tree('prismatic', [1, 0, 0]), [F, M], { waypoints: [{}, { 'still~moving': 30 }], profile: 'trapezoid', limits: { default: { v: 100, a: 200, j: 2000 } } } as any, { maxSamples: m });
    console.log(label, 'maxSamples', m, 'sweepPath', brief(r), '| sweepTimed', brief(st));
  }
}
