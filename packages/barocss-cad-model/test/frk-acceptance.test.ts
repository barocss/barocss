import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { toPartDocument } from '../src/engine/part';
import { evaluateCadPart } from '@barocss/cad';
// (The I section's area by signed triangles and circular sectors, no kernel code: FRk3's oracle, D172.)
import { sectionOracle } from '../../barocss-cad/test/frk3-oracle.mjs';

// FRk9 (D183): the FRk track's acceptance by the agent — a welded table frame made a weldment (gussets, caps, beads), a
// portal of tapered I beams, a bent-tube handrail — each built in one turn by the scripted agent's v2 calls in
// test/fixtures (dispatchTool, as the chat sends them). Accepted by closed forms of their dimensions, none read from the
// build: members A·L, a gusset (l₁l₂ − c²)/2·t, a cap's outline × t, a bead's runs a·z²/2 (D166), the I section's area by
// the kernel-independent triangle/sector oracle (test/frk3-oracle.mjs, D172), a bend by Pappus.
const root = resolve(import.meta.dirname, '..'), conformance = join(root, '../../packages/barocss-cad/conformance/frk');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function build(name: string): Promise<{ state: ChatState; results: Record<string, unknown>[] }> {
  const { calls } = JSON.parse(readFileSync(join(root, 'test/fixtures', `${name}.calls.json`), 'utf8')) as { calls: { tool: string; args: Record<string, unknown> }[] };
  let state: ChatState = { doc: emptyDoc(), bodies: [] } as never as ChatState;
  const results: Record<string, unknown>[] = [];
  for (const c of calls) { const r = await dispatchTool(state, c.tool, c.args, evaluate); assert.ok(!r.isError, `${c.tool} ${JSON.stringify(c.args).slice(0, 120)}: ${r.content}`); state = r.state; results.push(JSON.parse(r.content) as Record<string, unknown>); }
  return { state, results };
}
const close = (a: number, b: number, tol: number, what: string) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
/**
 * The kernel case `frk/<name>.json` holds the part the agent built (WRITE_ACCEPTANCE=1 writes it): each output's volume by
 * the closed form given (relTol 1e-9); its centroid and topology by this kernel (regression values, not the oracle).
 */
function caseFile(name: string, doc: StudioDoc, about: string, volumeOf: (id: string) => number, oracle: string) {
  const file = join(conformance, `${name}.json`), partDocument = toPartDocument(doc), snap = evaluateCadPart(partDocument);
  const outputs = snap.outputs.map(o => { const m = o.massProperties(1), r = o.validate(); close(m.volumeMM3, volumeOf(o.id), 1e-9, `kernel ${o.id}`); assert.equal(r.valid, true, `${o.id} valid`);
    return { volumeMM3: { value: volumeOf(o.id), relTol: 1e-9 }, centroidMM: { value: m.centroidMM, absTol: 1e-6 }, bodies: o.bodyCount, topology: r.topology.map(t => ({ shells: t.shells, genus: t.genus })) }; });
  if (process.env.WRITE_ACCEPTANCE) writeFileSync(file, JSON.stringify({ id: `frk-${name}`, step: 'FRk', decisions: ['D183'], about, input: { partDocument }, expect: { outputs }, oracle }, null, 2) + '\n');
  const kept = JSON.parse(readFileSync(file, 'utf8')) as { input: { partDocument: unknown }; expect: { outputs: { volumeMM3: { value: number } }[] } };
  assert.deepEqual(kept.input.partDocument, JSON.parse(JSON.stringify(partDocument)), `${name}: the conformance case holds the part the agent built`);
  assert.deepEqual(kept.expect.outputs.map(o => o.volumeMM3.value), outputs.map(o => o.volumeMM3.value), `${name}: its volumes are the closed forms`);
}
type Row = { quantity: number; axisLengthMM: number; ends: { kind: string }[] };
const rowsOf = (rows: Row[]) => rows.map(r => [r.quantity, Math.round(r.axisLengthMM * 1e9) / 1e9, r.ends[0].kind, r.ends[1].kind]);

test('FRk9 the welded table made a weldment by the agent: 4 clipped gussets (29437.5 each), 4 caps over the feet (6400 each), 8 fillet beads on the butts (540 nominal, 450 owned: two of the three 40 mm runs its own, the third shared by halves) — the members as FR4b', async () => {
  const { state, results } = await build('frk-weldment-table'), bodies = state.bodies;
  const A = 1600 - 34 * 34, z = 3, a = 40, run = a * z * z / 2;
  const lengths = [1000, 600, 1000, 600, 730, 730, 730, 730, 960, 560, 960, 560];
  const members = bodies.filter(b => b.cutPiece), kinds = (k: string) => bodies.filter(b => b.element?.kind === k);
  assert.equal(members.length, 12);
  members.forEach((b, k) => close(b.volumeMM3!, A * lengths[k], 1e-12, `member ${k}`));
  assert.equal(kinds('gusset').length, 4); for (const g of kinds('gusset')) close(g.volumeMM3!, (120 * 100 - 15 * 15) / 2 * 5, 1e-12, 'gusset');
  assert.equal(kinds('end-cap').length, 4); for (const c of kinds('end-cap')) close(c.volumeMM3!, 40 * 40 * 4, 1e-12, 'cap');
  // The beads: a lower rail's end on its leg's face — its outer side flush with the leg's (no fillet), its top and bottom
  // runs on the leg, its inner side on the other rail's side face, coplanar with the leg's: that fillet is the one the
  // two rails' beads share at the leg's corner, owned by halves (equal-length). Its outline's corners land on nothing.
  const beads = kinds('weld-bead');
  assert.equal(beads.length, 8);
  for (const b of beads) close(b.volumeMM3!, 2 * run + run / 2, 1e-9, `bead ${b.key}`);
  type Welds = { joints: { kind: string; bead?: { nominalVolumeMM3: number; flushMM: number; seamMM: number } }[]; totals: { beads: { complete: boolean; bodyCount: number; nominalVolumeMM3: number; ownedVolumeMM3: number; sharedSeamCount: number } } };
  const list = await dispatchTool(state, 'query', { action: 'welds' }, evaluate), w = JSON.parse(list.content) as Welds;
  for (const j of w.joints.filter(j => j.kind === 'butt')) { close(j.bead!.nominalVolumeMM3, 3 * run, 1e-9, 'nominal'); assert.equal(j.bead!.flushMM, a); assert.equal(j.bead!.seamMM, 4 * a); }
  const t = w.totals.beads;
  assert.deepEqual([t.complete, t.bodyCount, t.sharedSeamCount], [true, 8, 4]);
  close(t.ownedVolumeMM3, 4 * 5 * run, 1e-9, 'owned: five fillets of 40 at each leg'); close(t.nominalVolumeMM3, 8 * 3 * run, 1e-9, 'nominal');
  // The cut list: FR4b's rows, the members only.
  const cut = results.at(-1) as { rows: Row[]; totals: { quantity: number; axisLengthMM: number } };
  assert.deepEqual(rowsOf(cut.rows), [[2, 1000, 'mitre', 'mitre'], [2, 600, 'mitre', 'mitre'], [4, 730, 'square', 'square'], [2, 960, 'butt', 'butt'], [2, 560, 'butt', 'butt']]);
  assert.equal(cut.totals.quantity, 12); close(cut.totals.axisLengthMM, 9160, 1e-12, 'total length');
  const volume = (id: string) => id.startsWith('bead_') ? 2 * run + run / 2 : id.startsWith('n0/') ? A * lengths[Number(id.slice(3))] : ['n1', 'n2', 'n3', 'n4'].includes(id) ? (120 * 100 - 15 * 15) / 2 * 5 : 40 * 40 * 4;
  caseFile('accept-weldment-table', state.doc, 'FRk9 acceptance: the weldment the agent makes of FR4b\'s welded table (test/fixtures/frk-weldment-table.calls.json, cad-model): 4 clipped gussets at the top corners, 4 caps over the legs\' feet, 8 fillet beads (leg 3) on the lower rails\' butts with equal-length ownership of their shared seams.', volume,
    'Closed forms: members A·L (A = 40² − 34²; FR4b\'s lengths); a gusset (120·100 − 15²)/2·5; a cap 40²·4; a bead 2·40·3²/2 + ½·40·3²/2 (two runs its own, the leg\'s corner fillet shared by halves). Centroids and topology by this kernel.');
});

test('FRk9 a portal of tapered I beams by the agent: two posts and a beam butted at the corners — A_I by the independent oracle × the butt rule\'s lengths (the first post through by half the beam\'s depth, 2100; the beam on its flange and through the second post, 3000; the second post under it, 1900)', async () => {
  const { state, results } = await build('frk-tapered-portal'), bodies = state.bodies;
  const AI = sectionOracle({ kind: 'i-beam', height: 200, width: 90, web: 7, flange: 11, flangeSlope: 0.14, rootRadius: 9, toeRadius: 4.5 }).A, lengths = [2100, 3000, 1900];
  assert.equal(bodies.length, 3);
  bodies.forEach((b, k) => close(b.volumeMM3!, AI * lengths[k], 1e-9, `member ${k}`));
  const cut = results.at(-1) as { rows: Row[]; totals: { quantity: number; axisLengthMM: number } };
  assert.deepEqual(rowsOf(cut.rows), [[1, 2100, 'square', 'through'], [1, 3000, 'butt', 'through'], [1, 1900, 'butt', 'square']]);
  close(cut.totals.axisLengthMM, 7000, 1e-12, 'total length');
  caseFile('accept-tapered-portal', state.doc, 'FRk9 acceptance: the portal of tapered I beams the agent builds (test/fixtures/frk-tapered-portal.calls.json, cad-model): posts 2000 and a 3000 beam, butt corners; the section\'s dimensions are test values (D172\'s first case).', id => AI * lengths[Number(id.slice(3))],
    'Closed forms: A_I by signed triangles and circular sectors (test/frk3-oracle.mjs, no kernel code) × the butt rule\'s lengths 2100, 3000, 1900. Centroids and topology by this kernel.');
});

test('FRk9 a bent-tube handrail by the agent: Ø42.4 × 2.6, 1200 along X, bent 90° on R 150, 800 along Y — A(L₁ + L₂ − 2R) + A·πR/2 (Pappus: the annulus\'s centroid on the centreline)', async () => {
  const { state, results } = await build('frk-bent-rail'), bodies = state.bodies;
  const A = Math.PI * (21.2 ** 2 - 18.6 ** 2), L = 1200 + 800 - 2 * 150 + Math.PI / 2 * 150;
  assert.equal(bodies.length, 1);
  close(bodies[0].volumeMM3!, A * L, 1e-9, 'the rail');
  const cut = results.at(-1) as { rows: Row[] };
  assert.deepEqual(rowsOf(cut.rows), [[1, Math.round(L * 1e9) / 1e9, 'square', 'square']]);
  caseFile('accept-bent-rail', state.doc, 'FRk9 acceptance: the bent-tube handrail the agent builds (test/fixtures/frk-bent-rail.calls.json, cad-model): a Ø42.4 × 2.6 tube (test values), 1200 along X, a 90° tangent bend on R 150, 800 along Y.', () => A * L,
    'Closed form: A(L₁ + L₂ − 2R) + A·πR/2 by Pappus, A = π(21.2² − 18.6²). Centroid and topology by this kernel.');
});

