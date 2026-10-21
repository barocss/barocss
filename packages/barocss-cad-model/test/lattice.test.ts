import { marchingTetrahedra, meshVolume, voxelInsideFlags } from '@barocss/cad';
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart, stepFor, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { interference, massProperties } from '../src/chat/analysis';
import { threeMfModelOf } from '../src/print/export3mf';
import { cavityField, planHollow } from '../src/print/hollow';
import { awayFromZero, gyroid, gyroidFraction, gyroidGradient, latticeField, LatticeError, mixedTetrahedra, planLattice, weldTau } from '../src/print/lattice';

// AM7b (O57): a gyroid lattice infill, a separate mesh body inside an exactly hollowed part. Its solid fraction against the
// gyroid's own f(k) within the derived ε_MT + ε_mix + 4σ; the solid one component, nothing loose; every empty region
// drained (a sheet gyroid's two labyrinths); no overlap with the shell; refusals typed.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function hollowBox(w: number, d: number, hgt: number, t: number, drain = 3): Promise<{ doc: StudioDoc; bodies: BodyResult[] }> {
  const s: ChatState = { doc: emptyDoc(), bodies: [] }, r = await dispatchTool(s, 'run_command', { command: 'box', values: { w, d, h: hgt, x: 0, y: 0, z: 0 } }, evaluate); assert.ok(!r.isError, r.content);
  const e = await evaluate(r.state.doc); assert.ok(e.ok);
  const hol = planHollow(r.state.doc, e.bodies, { t, drain }); assert.equal(hol.report.route, 'exact');
  const e2 = await evaluate(hol.doc); assert.ok(e2.ok); return { doc: hol.doc, bodies: e2.bodies };
}
// (The coarse case for the kernel's intersection: its mesh Boolean takes minutes past a few thousand triangles.)
const COARSE = { w: 24, d: 24, h: 18, t: 3, drain: 6, L: 12, k: 0.8, vox: 3 };
const code = (f: () => unknown) => { try { f(); return 'none'; } catch (e) { return e instanceof LatticeError ? e.code : String(e); } };
const area = (m: { positions: ArrayLike<number>; indices: ArrayLike<number> }) => { let A = 0; const P = m.positions, I = m.indices; for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3, u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]; A += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; } return A; };

test('the solid fraction on whole cells: a 24 × 24 × 12 cavity of 6 mm cells, k 0.6 — the lattice over the cavity is f(k) within ε_MT + ε_mix + 4σ', () => {
  // (The cavity's field alone, no drains: a 30 × 30 × 18 box with a 3 mm wall, its cavity's corner the gyroid's phase.)
  const L = 6, k = 0.6, h = 0.5, t = 3, box = evaluatePart({ ...emptyDoc(), nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 30] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 18 }], nextId: 2 } as StudioDoc, 0);
  assert.ok(box.ok);
  const cav = cavityField(box.bodies[0].mesh, t, h), { psi, active } = latticeField(cav, [3, 3, 3], L, k, [], 2), tau = weldTau(30, L);
  awayFromZero(psi, tau);
  const mesh = marchingTetrahedra({ ...cav, phi: psi });
  const V = 24 * 24 * 12, vol = meshVolume(mesh.positions, mesh.indices), f = gyroidFraction(k), sigma = Math.sqrt(f * (1 - f) / 1e6);
  // (g: the least |∇G| over the mesh's band vertices — those on |G| = k, not on the cavity's walls.)
  let g = Infinity;
  for (let v = 0; v < mesh.positions.length; v += 3) { const p = [mesh.positions[v], mesh.positions[v + 1], mesh.positions[v + 2]]; if (Math.abs(Math.abs(gyroid(p, [3, 3, 3], L)) - k) < 0.05 * k && p.every((x, q) => x > 3 + h && x < (q === 2 ? 15 : 27) - h)) g = Math.min(g, gyroidGradient(p, [3, 3, 3], L)); }
  const w = 2 * Math.PI / L, A = area(mesh), N = mixedTetrahedra(cav, psi, active), eMT = A * (3 * w * w * h * h / 2 + tau) / g, eMix = N * h ** 3 / 6;
  console.log(`AM7b fraction: lattice ${(vol / V).toFixed(5)} vs f(k) ${f.toFixed(5)} (|Δ| ${Math.abs(vol / V - f).toFixed(5)}; ε_MT ${(eMT / V).toFixed(5)}, ε_mix ${(eMix / V).toFixed(5)} (${N} tets), 4σ ${(4 * sigma).toFixed(5)}); g ${g.toFixed(3)}, A ${A.toFixed(0)} mm², ${mesh.indices.length / 3} triangles`);
  assert.ok(Math.abs(vol / V - f) <= (eMT + eMix) / V + 4 * sigma, `${vol / V} vs ${f}`);
});

test('filled: the solid one component, nothing loose; every empty region drained (the two labyrinths); in the mass beside the exact shell', async () => {
  const { doc, bodies } = await hollowBox(30, 30, 18, 3), shellVolume = bodies[0].volumeMM3!;
  const { doc: out, report } = planLattice(doc, bodies, { cell: 6, k: 0.6, h: 0.5 }), e = await evaluate(out); assert.ok(e.ok, JSON.stringify(!e.ok && e).slice(0, 400));
  console.log(`AM7b fill: ${report.pieces} piece(s), ${report.dropped.count} dropped (${report.dropped.volume.toFixed(2)} mm³), ${report.drains.length} drain(s) added (${report.joined} joined), ${report.snapped} wall vertices snapped, ${report.triangles} triangles, lattice ${report.volume.toFixed(1)} mm³, ${report.mixed} mixed tets`);
  // (The lattice: the facet bodies, its pieces, their volumes its own; the shell: the B-rep, its drains added.)
  const lats = e.bodies.filter(b => b.family === 'faceted'), shell = e.bodies.find(b => b.family !== 'faceted')!;
  assert.equal(lats.length, report.pieces); assert.ok(Math.abs(lats.reduce((s, b) => s + b.volumeMM3!, 0) - report.volume) <= 1e-6 * report.volume);
  assert.ok(report.drains.length >= 1, 'a sheet gyroid leaves two labyrinths: at least one more drain');
  assert.ok(shell.volumeMM3! < shellVolume, 'the new drains cut through the shell');
  // (Each body's voxels at h/4, OR'd — one triangle soup's parity would flip where the lattice meets the shell's wall: the
  // solid one 6-connected component; every empty voxel reached from outside.)
  const hc = 0.25, lo = shell.mesh.bounds.min, hi = shell.mesh.bounds.max, o: [number, number, number] = [lo[0] - 0.8, lo[1] - 0.87, lo[2] - 0.91], n = [0, 1, 2].map(q => Math.ceil((hi[q] - o[q] + 0.8) / hc) + 1);
  const solid = new Uint8Array(n[0] * n[1] * n[2]);
  for (const b of [shell, ...lats]) { const f = voxelInsideFlags(b.mesh.positions, b.mesh.indices, o, hc, n); for (let s = 0; s < f.length; s++) solid[s] |= f[s]; }
  const step = [1, n[0], n[0] * n[1]], flood = (seed: number, want: number, seen: Uint8Array) => { const stack = [seed]; seen[seed] = 1; while (stack.length) { const v = stack.pop()!, i = v % n[0], r = (v - i) / n[0], j = r % n[1], kk = (r - j) / n[1], ijk = [i, j, kk]; for (let ax = 0; ax < 3; ax++) for (const d of [-1, 1]) { const q = ijk[ax] + d; if (q < 0 || q >= n[ax]) continue; const w = v + d * step[ax]; if (solid[w] === want && !seen[w]) { seen[w] = 1; stack.push(w); } } } };
  const outside = new Uint8Array(solid.length); flood(0, 0, outside);
  let voids = 0; for (let s = 0; s < solid.length; s++) if (!solid[s] && !outside[s]) voids++;
  assert.equal(voids, 0, 'every empty region drained');
  let comps = 0; const seen = new Uint8Array(solid.length);
  for (let s = 0; s < solid.length; s++) if (solid[s] && !seen[s]) { comps++; flood(s, 1, seen); }
  assert.equal(comps, 1, 'the shell and its lattice, one solid');
  assert.equal(shell.innerShells ?? 0, 0);
});

test('no overlap with the shell by the kernel\'s intersection, every piece touching it (a coarse lattice, the kernel\'s mesh Boolean slow past ~1000 triangles); refusals typed', async () => {
  const { doc, bodies } = await hollowBox(COARSE.w, COARSE.d, COARSE.h, COARSE.t, COARSE.drain), { doc: out, report } = planLattice(doc, bodies, { cell: COARSE.L, k: COARSE.k, h: COARSE.vox });
  console.log(`AM7b coarse: ${report.triangles} triangles, ${report.pieces} piece(s), ${report.dropped.count} dropped, ${report.drains.length} drain(s) added`);
  const e = await evaluate(out); assert.ok(e.ok, JSON.stringify(!e.ok && e).slice(0, 400));
  const shell = e.bodies.find(b => b.family !== 'faceted')!, pairs = await interference(out, e.bodies, evaluate);
  assert.deepEqual(pairs.filter(p => 'overlap_mm3' in p), [], JSON.stringify(pairs));
  // (Each piece against the shell: touching — its wall vertices on the wall — and the pieces apart from one another.)
  const withShell = pairs.filter(p => p.a === shell.key || p.b === shell.key);
  assert.equal(withShell.length, report.pieces);
  for (const p of withShell) assert.ok((p.clearance_mm as number) <= 1e-3, JSON.stringify(p));
  // (Refusals.)
  const plain = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'run_command', { command: 'box', values: { w: 30, d: 30, h: 18, x: 0, y: 0, z: 0 } }, evaluate), pe = await evaluate(plain.state.doc); assert.ok(pe.ok);
  assert.equal(code(() => planLattice(plain.state.doc, pe.bodies, { cell: 6, k: 0.6 })), 'NOT_HOLLOW');
  const fine = await hollowBox(30, 30, 18, 3);
  // (h > L/4; and h past the drain's radius 1.5 mm, its column holding no node.)
  for (const bad of [{ cell: 0, k: 0.6 }, { cell: 6, k: 0 }, { cell: 6, k: 1.6 }, { cell: 6, k: 0.6, h: 2 }, { cell: 12, k: 0.6, h: 2 }]) assert.equal(code(() => planLattice(fine.doc, fine.bodies, bad)), 'BAD_VALUES', JSON.stringify(bad));
});

// O60: STEP is the exact part. The lattice body's `infill` role (not its name) leaves it out of STEP, which says so; 3MF and
// the mass keep it; renamed, it is still left out.
test('STEP leaves the infill out and says so (by its role, not its name); 3MF and the mass keep it', async () => {
  const { doc, bodies } = await hollowBox(COARSE.w, COARSE.d, COARSE.h, COARSE.t, COARSE.drain), { doc: out } = planLattice(doc, bodies, { cell: COARSE.L, k: COARSE.k, h: COARSE.vox });
  const e = await evaluate(out); assert.ok(e.ok);
  const lats = e.bodies.filter(b => b.role === 'infill'), solids = (t: string) => (t.match(/=\s*(MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS|TESSELLATED_SOLID)\(/g) ?? []).length;
  assert.ok(lats.length >= 1 && lats.length === e.bodies.length - 1, 'every lattice piece is infill, the shell not');
  const step = stepFor(out, 'part'); assert.ok('text' in step, JSON.stringify(step));
  assert.equal(solids(step.text), 1, 'the shell alone'); assert.doesNotMatch(step.text, /TRIANGULATED_FACE|TESSELLATED_SHELL/);
  assert.match(step.omitted?.join(' ') ?? '', /lattice infill not included \(.+\); 3MF carries it/);
  // (Without the role, the same doc's STEP carries every piece.)
  const plain = { ...out, nodes: out.nodes.map(n => n.kind === 'mesh' ? { ...n, role: undefined } : n) }, all = stepFor(plain, 'part'); assert.ok('text' in all);
  assert.equal(solids(all.text), 1 + lats.length); assert.equal(all.omitted, undefined);
  // (Renamed: still left out.)
  const renamed = { ...out, nodes: out.nodes.map(n => n.kind === 'mesh' ? { ...n, name: 'my infill' } : n) }, r = stepFor(renamed, 'part'); assert.ok('text' in r);
  assert.equal(solids(r.text), 1);
  // (3MF: an object for the shell and each piece; the mass: every body, the lattice's volume in it.)
  const model = threeMfModelOf(out, [{ doc: out, bodies: e.bodies }], 'part'); assert.ok(typeof model !== 'string', String(model));
  assert.equal(model.objects.length, e.bodies.length);
  assert.equal(massProperties(out, e.bodies).length, e.bodies.length);
});
