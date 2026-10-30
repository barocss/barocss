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
// 1. Prismatic parallel slide: fixed 10x10x10 at origin; moving 10x10x10 at y = 10 + g; slide along +x by L.
for (const [tol, L] of [[1e-6, 1000], [1e-9, 1000], [1e-9, 2000], [1e-6, 1e6]] as [number, number][]) {
  for (const k of [0.5, 0.9, 1.1, 2]) {
    const g = tol + k * 1e-12 * L;
    const F = { ...(await box(10, 10, 10, [0, 0, 0])), link: 'fixed' }, M = { ...(await box(10, 10, 10, [0, 10 + g, 0])), link: 'moving' };
    const bf = bbox(F.positions), bm = bbox(M.positions);
    const gapRaw = bm.lo[1] - bf.hi[1];
    const r = sweepPath(tree('prismatic', [1, 0, 0]), [F, M], {}, { 'still~moving': L }, { tolerance: tol, maxSamples: 20000 });
    console.log(`slide tol=${tol} L=${L} g=tol+${k}e-12*L=${g.toExponential(6)} raw gap ${gapRaw.toExponential(6)} (gap/tol ${(gapRaw / tol).toFixed(3)}): ${brief(r)}`);
  }
}
// 2. Revolute spin of a 10x10x10 box about z above a plate at z gap g: tol = CCD 1e-9 (sweepTimed's), dq = 2*pi*turns.
for (const turns of [1, 10, 160]) {
  const rch = Math.hypot(5, 5, 10), dq = 2 * Math.PI * turns, rate = dq * rch;
  for (const k of [0.5, 2]) {
    const g = CCD_TOLERANCE + k * 1e-12 * rate;
    const F = { ...(await box(40, 40, 5, [-20, -20, -5])), link: 'fixed' }, M = { ...(await box(10, 10, 10, [-5, -5, g])), link: 'moving' };
    const r = sweepPath(tree('continuous', [0, 0, 1]), [F, M], { 'still~moving': 0 }, { 'still~moving': dq }, { tolerance: CCD_TOLERANCE });
    const st = sweepTimed(tree('continuous', [0, 0, 1]), [F, M], { waypoints: [{ 'still~moving': 0 }, { 'still~moving': dq }], profile: 'trapezoid', limits: { default: { v: 1, a: 2, j: 20 } } } as any);
    console.log(`spin turns=${turns} rate≈${rate.toFixed(1)} g=${g.toExponential(4)} (g/tol ${(g / CCD_TOLERANCE).toFixed(2)}): sweepPath ${brief(r)} | sweepTimed ${brief(st)}`);
  }
}
