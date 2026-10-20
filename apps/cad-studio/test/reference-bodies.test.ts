import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, stepFor } from '../src/engine/evaluate';
import { emptyDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { chordOf, datumWorld, readReferences, referenceLocal, verdictOf, verifyDatums } from '../src/chat/references';

// A6.3 (O26): a STEP or mesh file as a locked reference body, its datums and keep-outs. Datums against the faces'
// closed forms to 1e-9 (placed and turned); the reference locked (typed refusals) and in no mass, export or tree; keep-out
// verdicts against closed forms — overlap exact, clearance exact on the meshes, the chord tolerance an upper bound
// checked on the cylinder's own triangles, "undecided" within it; datums as sketch planes and measure subjects; kept
// through a save, verified on open.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a6/references');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const call = (s: ChatState, tool: string, args: object) => dispatchTool(s, tool, args, evaluate);
const ok = async (s: ChatState, tool: string, args: object) => { const r = await call(s, tool, args); assert.ok(!r.isError, `${tool}: ${r.content}`); return r; };
const code = (content: string) => (/^\[([A-Z_]+)\]/.exec(JSON.parse(content).error ?? '') ?? [])[1];
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** A 40 × 30 × 10 block with a Ø8 hole through it at (12, 15), written as STEP by the studio. */
async function blockStep(): Promise<string> {
  let s: ChatState = { doc: emptyDoc(), bodies: [] };
  s = (await ok(s, 'run_command', { command: 'box', values: { w: 40, d: 30, h: 10, x: 0, y: 0, z: 0 } })).state;
  s = (await ok(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 12, y: 15 } })).state;
  const r = stepFor(s.doc, 'block'); assert.ok('text' in r); return r.text;
}
/** The part: a 10 mm cube at the origin. */
async function cube(): Promise<ChatState> { return (await ok({ doc: emptyDoc(), bodies: [] }, 'run_command', { command: 'box', values: { w: 10, d: 10, h: 10, x: 0, y: 0, z: 0 } })).state; }

test('datums from a STEP reference\'s faces against their closed forms (1e-9): the top plane, the hole\'s axis and radius, a vertex — placed and turned', async () => {
  const step = await blockStep();
  let s = await cube();
  // (Placed at (100, 0, 0) and turned 90° about Z: local (x, y, z) → (100 − y, x, z).)
  s = (await ok(s, 'add_reference', { name: 'block', step, at: { position: [100, 0, 0], rotation: [0, 0, 90] } })).state;
  const set = readReferences(s.doc.references), local = await referenceLocal(set.references[0], evaluate);
  const faces = local[0].mesh.faces, top = faces.find(f => f.kind === 'plane' && near(f.normal[2], 1, 1e-12) && near(f.centroid[2], 10, 1e-12))!, bore = faces.find(f => f.kind === 'curved')!;
  assert.ok(top && bore, faces.map(f => f.name).join());
  const p = JSON.parse((await ok(s, 'add_datum', { reference: 'ref1', face: top.name, kind: 'plane', name: 'board top' })).content);
  assert.ok(near(p.normal[0], 0) && near(p.normal[1], 0) && near(p.normal[2], 1) && near(p.origin[2], 10) && p.residual_mm < 1e-9, JSON.stringify(p));
  s = (await ok(s, 'add_datum', { reference: 'ref1', face: top.name, kind: 'plane' })).state;
  const a = JSON.parse((await ok(s, 'add_datum', { reference: 'ref1', face: bore.name, kind: 'axis' })).content);
  // (The hole's axis at local (12, 15): placed at (100 − 15, 12) = (85, 12); along ±Z; radius 4.)
  assert.ok(near(Math.abs(a.direction[2]), 1) && near(a.origin[0], 85) && near(a.origin[1], 12) && near(a.radius, 4) && a.residual_mm < 1e-9, JSON.stringify(a));
  s = (await ok(s, 'add_datum', { reference: 'ref1', face: bore.name, kind: 'axis' })).state;
  const v = JSON.parse((await ok(s, 'add_datum', { reference: 'ref1', vertex: [40.3, 30.2, 9.9] })).content);
  // (The corner (40, 30, 10) placed: (100 − 30, 40, 10).)
  assert.ok(near(v.origin[0], 70) && near(v.origin[1], 40) && near(v.origin[2], 10), JSON.stringify(v));
  // (Refused, typed: an axis from a flat face, a plane from the bore, a face that is not there, a vertex too far.)
  assert.equal(code((await call(s, 'add_datum', { reference: 'ref1', face: top.name, kind: 'axis' })).content), 'DATUM_FIT');
  assert.equal(code((await call(s, 'add_datum', { reference: 'ref1', face: bore.name, kind: 'plane' })).content), 'DATUM_FIT');
  assert.equal(code((await call(s, 'add_datum', { reference: 'ref1', face: 'ref1.face999', kind: 'plane' })).content), 'NO_REFERENCE');
  assert.equal(code((await call(s, 'add_datum', { reference: 'ref1', vertex: [20, 15, 30] })).content), 'NO_REFERENCE');
  // (Kept through a save; verified on open.)
  const back = JSON.parse(JSON.stringify(s.doc)) as StudioDoc;
  assert.deepEqual(await verifyDatums(readReferences(back.references), evaluate), []);
  const moved = readReferences(back.references); moved.datums[0] = { ...moved.datums[0], origin: [0, 0, 10.001] };
  assert.equal((await verifyDatums(moved, evaluate))[0]?.datum, 'D1');
});

test('the reference is locked: no feature may use it (REFERENCE_LOCKED), it is not in the tree, the mass, the facts or the STEP export', async () => {
  const step = await blockStep();
  let s = await cube();
  const before = { nodes: JSON.stringify(s.doc.nodes), mass: JSON.parse((await ok(s, 'mass_properties', {})).content), step: stepFor(s.doc, 'p') };
  s = (await ok(s, 'add_reference', { name: 'block', step })).state;
  const face = (await referenceLocal(readReferences(s.doc.references).references[0], evaluate))[0].mesh.faces[0].name;
  assert.match(face, /^ref1\./);
  for (const [tool, args] of [['run_command', { command: 'fillet', edges: [`${face}|n1.top`], values: { radius: 1 } }], ['run_command', { command: 'hole', faces: [face], values: { d: 3, x: 1, y: 1 } }],
    ['add_features', { features: [{ kind: 'extrude', sketch: 0, height: 2, on: 'ref1' }] }], ['apply_ops', { ops: [{ tool: 'run_command', args: { command: 'hole', faces: [face], values: { d: 3, x: 1, y: 1 } } }] }],
    ['delete_reference_item', { id: 'ref1' }]] as const) {
    const r = await call(s, tool, args); assert.ok(r.isError, `${tool} refused`);
    assert.match(r.content, /REFERENCE_LOCKED/, `${tool}: ${r.content}`); assert.equal(r.state, s);
  }
  assert.equal(JSON.stringify(s.doc.nodes), before.nodes, 'not a node of the part');
  assert.deepEqual(JSON.parse((await ok(s, 'mass_properties', {})).content), before.mass, 'not in the mass');
  assert.equal(s.bodies.length, 1);
  const after = stepFor(s.doc, 'p'); assert.ok('text' in after && 'text' in before.step && after.text.replace(/\d{4}-\d\d-\d\dT[\d:]+/g, '') === before.step.text.replace(/\d{4}-\d\d-\d\dT[\d:]+/g, ''), 'not in the STEP export');
  const g = JSON.parse((await ok(s, 'get_references', {})).content);
  assert.ok(g.references[0].id === 'ref1' && g.references[0].faces.length >= 7 && g.references[0].kind === 'step', JSON.stringify(g.references[0]).slice(0, 300));
});

test('a mesh reference: a datum plane from a flat region exact, an axis refused from it; its chord tolerance 0', async () => {
  // (A 20 × 20 × 5 slab as a mesh, 12 triangles.)
  const P = [0, 0, 0, 20, 0, 0, 20, 20, 0, 0, 20, 0, 0, 0, 5, 20, 0, 5, 20, 20, 5, 0, 20, 5], I = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
  let s = await cube();
  s = (await ok(s, 'add_reference', { name: 'slab', mesh: { positions: P, indices: I }, at: { position: [0, 0, 20], rotation: [0, 0, 0] } })).state;
  const local = await referenceLocal(readReferences(s.doc.references).references[0], evaluate);
  assert.equal(chordOf(local[0].mesh), 0);
  const top = local[0].mesh.faces.find(f => near(f.normal[2], 1, 1e-12))!;
  const d = JSON.parse((await ok(s, 'add_datum', { reference: 'ref1', face: top.name, kind: 'plane' })).content);
  assert.ok(near(d.origin[2], 25) && near(d.normal[2], 1), JSON.stringify(d));
  assert.equal(code((await call(s, 'add_datum', { reference: 'ref1', face: top.name, kind: 'axis' })).content), 'DATUM_FIT');
  assert.equal(code((await call(s, 'add_reference', { name: 'bad', mesh: { positions: [0, 0, 0], indices: [0, 1, 2] } })).content), 'BAD_REFERENCE');
});

test('keep-out verdicts against closed forms: box ∩ box overlap 125 mm³ exact; a box 2 mm away; a cylinder 5 mm away within its chord tolerance undecided', async () => {
  let s = await cube();
  const frame = (o: number[]) => ({ origin: o, normal: [0, 0, 1], xAxis: [1, 0, 0] });
  s = (await ok(s, 'add_keepout', { name: 'overlapping', box: { frame: frame([5, 5, 5]), size: [10, 10, 10] } })).state;
  s = (await ok(s, 'add_keepout', { name: 'beside', box: { frame: frame([12, 0, 0]), size: [5, 10, 10] }, clearance: 2 })).state;
  s = (await ok(s, 'add_keepout', { name: 'post', cylinder: { frame: frame([20, 5, 0]), radius: 5, height: 10 }, clearance: 5 })).state;
  type KR = { keepout: string; verdict: string; overlap_mm3: number; clearance_mm: number; chord_tolerance_mm: number; why: string };
  const r = JSON.parse((await ok(s, 'check_keepouts', {})).content).results as KR[];
  const by = (k: string) => r.find(x => x.keepout === k)!;
  assert.ok(by('K1').verdict === 'violated' && near(by('K1').overlap_mm3, 125, 1e-9), JSON.stringify(by('K1')));
  assert.ok(by('K2').verdict === 'clear' && near(by('K2').clearance_mm, 2, 1e-12) && by('K2').chord_tolerance_mm === 0, JSON.stringify(by('K2')));
  // (The post's nearest surface is 5 mm from the cube; its mesh's chord tolerance ≈ r(1 − cos π/32) ≈ 0.024 mm — since O55
  // bounded from the mesh's own normals, the cylinder's edge sag, to 1e-4 of that: 5 required is undecided.)
  const chord = by('K3').chord_tolerance_mm;
  assert.ok(by('K3').verdict === 'undecided' && Math.abs(chord - 5 * (1 - Math.cos(Math.PI / 32))) < 1e-4 && Math.abs(by('K3').clearance_mm - 5) <= chord, JSON.stringify(by('K3')));
  assert.match(by('K3').why, /chord tolerance 0\.0241 mm/);
  // (The tolerance is an upper bound: every point of the cylinder's mesh is within it of the true surface.)
  const { withKeepout } = await import('../src/chat/references'), probe = withKeepout(s.doc, readReferences(s.doc.references).keepouts[2]), ev = await evaluate(probe.doc);
  assert.ok(ev.ok); const m = ev.bodies.at(-1)!.mesh;
  let worst = 0;
  for (let t = 0; t < m.indices.length / 3; t++) {
    const c = [0, 1, 2].map(k => (m.positions[3 * m.indices[3 * t] + k] + m.positions[3 * m.indices[3 * t + 1] + k] + m.positions[3 * m.indices[3 * t + 2] + k]) / 3), rr = Math.hypot(c[0] - 20, c[1] - 5);
    if (c[2] > 1e-6 && c[2] < 10 - 1e-6 && rr > 1) worst = Math.max(worst, 5 - rr);
  }
  assert.ok(worst > 0 && worst <= chord + 1e-12, `the side's chord ${worst} vs ${chord}`);
  // (The verdict rule: clear when d − δ ≥ c, violated when d + δ < c, else undecided.)
  assert.deepEqual(['clear', 'violated', 'undecided', 'violated'].map(String), [verdictOf(0, 5, 4.9, chord).verdict, verdictOf(0, 5, 5.1, chord).verdict, verdictOf(0, 5, 5, chord).verdict, verdictOf(1, 9, 0, 0).verdict]);
  assert.equal(verdictOf(0, 5, 1, Infinity).verdict, 'undecided');
  // (Refused, typed: a frame that is not one, a size of 0, two shapes at once.)
  for (const bad of [{ box: { frame: { origin: [0, 0, 0], normal: [0, 0, 2], xAxis: [1, 0, 0] }, size: [1, 1, 1] } }, { box: { frame: frame([0, 0, 0]), size: [1, 0, 1] } }, { box: { frame: frame([0, 0, 0]), size: [1, 1, 1] }, cylinder: { frame: frame([0, 0, 0]), radius: 1, height: 1 } }])
    assert.equal(code((await call(s, 'add_keepout', bad)).content), 'BAD_KEEPOUT');
});

test('the requirement query keepout (undecided within the chord tolerance), datum_distance, a sketch on a datum plane; the conformance case (a6/references/block-keepout)', async () => {
  const step = await blockStep();
  let s = await cube();
  s = (await ok(s, 'add_reference', { name: 'block', step, at: { position: [0, 0, 30], rotation: [0, 0, 0] } })).state;
  const local = await referenceLocal(readReferences(s.doc.references).references[0], evaluate), bottom = local[0].mesh.faces.find(f => near(f.normal[2], -1, 1e-12))!;
  s = (await ok(s, 'add_datum', { reference: 'ref1', face: bottom.name, kind: 'plane', name: 'block underside' })).state;
  // (The block's envelope grown 2 mm: from z 28; the cube's top at 10 is 18 mm from it.)
  s = (await ok(s, 'add_keepout', { around: 'ref1', offset: 2, shape: 'box', clearance: 3 })).state;
  s = (await ok(s, 'set_requirements', { requirements: [
    { id: 'K', source: 'stay 3 mm clear of the block', hard: true, check: { op: '>=', query: { fn: 'keepout', keepout: 'K1' }, value: 3 } },
    { id: 'U', source: 'exactly at the limit', hard: false, basis: 'assumed', check: { op: '>=', query: { fn: 'keepout', keepout: 'K1' }, value: 18 } },
    { id: 'D', source: 'the block 20 above the top', hard: true, check: { op: '==', query: { fn: 'datum_distance', datum: 'D1', face: 'n1.top' }, value: 20, tol: 1e-9 } }] })).state;
  const rep = JSON.parse((await ok(s, 'check_spec', {})).content);
  // (U: 18 against 18 with a flat block and cube, chord 0: decided, pass; the band only where there is a chord.)
  assert.equal(rep.summary.pass, 3, JSON.stringify(rep)); assert.equal(rep.summary.fail, 0);
  // (A sketch on the datum plane, extruded: the new body starts at z 30, the block's underside.)
  const sk = await ok(s, 'add_features', { features: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [5, 5], plane: { datum: 'D1' } }] });
  const node = sk.state.doc.nodes.at(-1) as { plane: { origin: number[]; normal: number[] } };
  assert.ok(near(node.plane.origin[2], 30) && near(node.plane.normal[2], -1), JSON.stringify(node.plane));
  assert.equal(code((await call(s, 'add_features', { features: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [5, 5], plane: { datum: 'D9' } }] })).content), 'NO_REFERENCE');
  const m = JSON.parse((await ok(s, 'measure', { a: 'D1', b: 'n1.top' })).content);
  assert.ok(near(m.distance, 20) && m.angle_deg < 1e-6, JSON.stringify(m));
  const dir = join(CASES, 'block-keepout');
  if (process.env.UPDATE_A6_FIXTURES) {
    mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'block.step'), step);
    writeFileSync(join(dir, 'case.json'), JSON.stringify({ case: 'block-keepout', step: 'A6.3', note: 'A 10 mm cube; the studio\'s 40 × 30 × 10 block with a Ø8 hole (block.step) as a locked reference at z 30. Closed forms: the underside datum plane at z 30, normal −Z (20 mm from the cube\'s top); the block\'s envelope grown 2 mm starts at z 28, 18 mm from the cube (flat faces both: chord 0), so a 3 mm clearance is clear; a sketch on the datum lies at z 30.', input: { part: 'box 10 × 10 × 10 at the origin', reference: { file: 'block.step', at: { position: [0, 0, 30], rotation: [0, 0, 0] } }, datum: 'the reference face with normal −Z, as a plane', keepout: { around: 'ref1', offset: 2, shape: 'box', clearance: 3 } }, expect: { datum_origin_z: 30, datum_normal: [0, 0, -1], keepout_clearance_mm: 18, verdict: 'clear', chord_tolerance_mm: 0, tol: 1e-9 } }, null, 1) + '\n');
  }
  const c = JSON.parse(readFileSync(join(dir, 'case.json'), 'utf8')), k = JSON.parse((await ok(s, 'check_keepouts', {})).content).results[0];
  assert.ok(k.verdict === c.expect.verdict && near(k.clearance_mm, c.expect.keepout_clearance_mm) && k.chord_tolerance_mm === c.expect.chord_tolerance_mm, JSON.stringify(k));
  const w = datumWorld(readReferences(s.doc.references), readReferences(s.doc.references).datums[0]);
  assert.ok(near(w.origin[2], c.expect.datum_origin_z) && w.normal!.every((x, i) => near(x, c.expect.datum_normal[i])));
});

test('O75 (A6.3): datums as mate targets — a pin on an axis datum and flush on a plane datum through add_mate; get_assembly lists them on the base part; a point datum does not mate', async () => {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  s = (await ok(s, 'run_command', { command: 'box', values: { w: 60, d: 60, h: 10, x: 0, y: 0, z: 0 } })).state;
  s = (await ok(s, 'add_datum', { kind: 'plane', origin: [0, 0, 20], normal: [0, 0, 1], name: 'deck' })).state;
  s = (await ok(s, 'add_datum', { kind: 'axis', origin: [30, 25, 0], direction: [0, 0, 1], name: 'spindle' })).state;
  s = (await ok(s, 'add_datum', { kind: 'point', origin: [5, 5, 5], name: 'mark' })).state;
  const ids = readReferences(s.doc.references).datums.map(d => d.id), [P, A, M] = ids;
  assert.equal(ids.length, 3);
  const faces = JSON.parse((await ok(s, 'get_assembly', { faces_of: 'base' })).content).base.faces.map((f: { name: string }) => f.name);
  assert.ok(faces.includes(`datum:${P}`) && faces.includes(`datum:${A}`) && !faces.includes(`datum:${M}`), faces.join(' '));
  s = (await ok(s, 'add_part', { name: 'Pin' })).state;
  s = (await ok(s, 'run_command', { part: 'p1', command: 'cylinder', values: { r: 4, h: 15, x: 0, y: 0, z: 0 } })).state;
  s = (await ok(s, 'add_mate', { kind: 'concentric', a: { part: 'base', face: `datum:${A}` }, b: { part: 'p1', face: 'n1.side0' } })).state;
  const flush = await ok(s, 'add_mate', { kind: 'coincident', a: { part: 'base', face: `datum:${P}` }, b: { part: 'p1', face: 'n1.bottom' }, flip: true }); s = flush.state;
  // (On the spindle's axis, its bottom on the deck facing down: the pin stands from z = 20.)
  const pin = s.doc.instances![0], w = JSON.parse((await ok(s, 'get_assembly', {})).content).instances[0].world_bounds;
  assert.deepEqual(w, { min: [26, 21, 20], max: [34, 29, 35] }, JSON.stringify([pin.position, pin.rotation]));
  assert.deepEqual(JSON.parse(flush.content).freedom_left, { turns: 1, slides: 0 });
  const bad = await call(s, 'add_mate', { kind: 'coincident', a: { part: 'base', face: `datum:${M}` }, b: { part: 'p1', face: 'n1.top' } });
  assert.ok(bad.isError); assert.match(JSON.parse(bad.content).error, /is not a flat or round face of base/);
});
