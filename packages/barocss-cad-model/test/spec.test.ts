import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { runTool, type ChatState } from '../src/chat/tools';
import { readStudioDoc } from '../src/engine/migrate';

// Requirements as declarative checks (A3.1): kept in the document, run by check_spec.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const BRIEF = [
  { id: 'R1', source: 'a 40 mm long plate', hard: true, basis: 'stated', check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1, unit: 'mm' } },
  { id: 'R2', source: 'no thicker than 6 mm', hard: true, basis: 'stated', check: { op: '<=', query: { fn: 'bbox', axis: 'z' }, value: 6, unit: 'mm' } },
  { id: 'R3', source: 'an 8 mm hole', hard: true, basis: 'stated', check: { op: '==', query: { fn: 'hole_diameter', face: { feature: 2, role: 'side0' } }, value: 8, tol: 0.01, unit: 'mm' } },
  { id: 'R4', source: 'under 20 g', hard: false, basis: 'stated', check: { op: '<=', query: { fn: 'mass' }, value: 20, unit: 'g' } },
  { id: 'R5', source: 'faces 8 apart', hard: false, basis: 'assumed', check: { op: '==', query: { fn: 'distance_between', a: { feature: 1, role: 'top' }, b: { normal: [0, 0, -1] } }, value: 8, tol: 0.01, unit: 'mm' } },
  { id: 'R6', source: 'walls at least 2 mm', hard: true, check: { op: '>=', query: { fn: 'min_wall' }, value: 2, unit: 'mm' } },
  { id: 'R7', source: 'one piece', hard: true, check: { op: '==', query: { fn: 'count_solids' }, value: 1 } },
];

test('requirements: kept in the document, run as checks; failures in full, passes as counts, assumed mass unknown', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 20, y: 10 } }, evaluate)).state;
  let r = await runTool(s, 'set_requirements', { requirements: BRIEF }, evaluate);
  assert.ok(!r.isError, r.content); assert.ok(r.changed); s = r.state;
  assert.equal(s.doc.requirements!.length, 7);
  const rep = parse((await runTool(s, 'check_spec', {}, evaluate)).content);
  assert.deepEqual(rep.summary, { pass: 5, fail: 1, unknown: 1, hard_failing: 1 });
  assert.equal(rep.model_hash.length, 8);
  const [f] = rep.failures;
  assert.deepEqual([f.req_id, f.check, f.measured, f.expected, f.delta], ['R2', 'bbox', 8, '<= 6 mm', 2]);
  assert.match(f.hint, /hard: "no thicker than 6 mm"/);
  assert.equal(rep.unknowns[0].req_id, 'R4'); assert.match(rep.unknowns[0].why, /material of b\d+ is not set/);
  // A malformed one is refused, saying what is missing.
  r = await runTool(s, 'set_requirements', { requirements: [{ id: 'R9', source: 'x', hard: true, check: { op: '<=', query: { fn: 'bbox' }, value: 1 } }] }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /bbox takes an axis/);
  r = await runTool(s, 'set_requirements', { requirements: [{ id: 'R9', source: 'x', hard: true, check: { op: 'eval', query: { fn: 'bbox', axis: 'x' }, value: 1 } }] }, evaluate);
  assert.ok(r.isError);
});

// The A3 conformance cases (conformance/a3): a document with its requirements, and the report.
const a3 = join(resolve(import.meta.dirname, '..'), 'conformance', 'a3');
for (const file of readdirSync(a3).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a3, file), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, async () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read);
    const rep = parse((await runTool(await stateOf(read.doc), 'check_spec', {}, evaluate)).content);
    assert.deepEqual(rep.summary, c.expect.summary);
    assert.deepEqual(rep.failures.map((f: Record<string, unknown>) => ({ req_id: f.req_id, check: f.check, measured: f.measured, expected: f.expected, delta: f.delta })), c.expect.failures);
    assert.deepEqual(rep.unknowns.map((u: { req_id: string }) => u.req_id), c.expect.unknowns);
  });
}

test('mutation check: a check that cannot fail is vacuous, a declared invariant is not, one with too few usable mutants is unverified', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 20, y: 10 } }, evaluate)).state;
  s = (await runTool(s, 'set_requirements', { requirements: [
    { id: 'L', source: '40 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1 } },
    { id: 'H', source: 'an 8 mm hole', hard: true, check: { op: '==', query: { fn: 'hole_diameter', face: { feature: 2, role: 'side0' } }, value: 8, tol: 0.01 } },
    { id: 'Z', source: 'under 100 tall', hard: false, check: { op: '<=', query: { fn: 'bbox', axis: 'z' }, value: 100 } },
    { id: 'ONE', source: 'one piece', hard: true, invariant: true, invariant_reason: 'one piece whatever its sizes', check: { op: '==', query: { fn: 'count_solids' }, value: 1 } },
  ] }, evaluate)).state;
  const rep = parse((await runTool(s, 'check_spec', { validate: true }, evaluate)).content);
  assert.equal(rep.summary.pass, 4);
  assert.ok(rep.mutants.built >= 4 && rep.mutants.tried <= 8, JSON.stringify(rep.mutants));
  assert.deepEqual(rep.vacuous.map((v: { req_id: string }) => v.req_id), ['Z']);
  assert.deepEqual(rep.invariant, [{ req_id: 'ONE', reason: 'one piece whatever its sizes' }]);
  assert.deepEqual(rep.unverified, []);
  // No mutant builds: every passing check is unverified, never vacuous.
  const onlyModel = async (d: StudioDoc) => d === s.doc ? evaluate(d) : null;
  const rep2 = parse((await runTool(s, 'check_spec', { validate: true }, onlyModel)).content);
  assert.equal(rep2.mutants.built, 0); assert.deepEqual(rep2.vacuous, []);
  assert.deepEqual(rep2.unverified.map((v: { req_id: string }) => v.req_id).sort(), ['H', 'L', 'Z']);
  assert.ok(typeof rep.mutants.ms === 'number');
});

test('policy: the best snapshot, rounds without progress and a restart hint; a change breaking a passed hard requirement is refused unless it says why', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'set_requirements', { requirements: [
    { id: 'L', source: '40 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1 } },
    { id: 'T', source: 'at most 6 thick', hard: true, check: { op: '<=', query: { fn: 'bbox', axis: 'z' }, value: 6 } },
  ] }, evaluate)).state;
  let rep: Record<string, any> = {};
  for (let k = 0; k < 3; k++) { const r = await runTool(s, 'check_spec', {}, evaluate); s = r.state; rep = parse(r.content); }
  assert.deepEqual(rep.policy.rounds_without_progress, { T: 2 });
  assert.match(rep.policy.hint, /no progress on T for 2 rounds: start again from the brief/);
  assert.equal(rep.policy.best.this_is_best, true); assert.ok(rep.policy.tool_calls >= 4);
  // Scaling the plate breaks L (passed, hard): refused; with a reason, made.
  const scale = { command: 'scale', bodies: ['b1'], values: { factor: 1.5 } };
  let r = await runTool(s, 'run_command', scale, evaluate);
  assert.ok(r.isError, r.content); assert.match(parse(r.content).error, /breaks hard requirement that passed: L \("40 long": measured 60/);
  r = await runTool(s, 'run_command', { ...scale, because: 'trying a bigger plate' }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  // The best snapshot is the one before: restore_best puts it back.
  s = (await runTool(s, 'check_spec', {}, evaluate)).state;
  r = await runTool(s, 'restore_best', {}, evaluate);
  assert.ok(!r.isError, r.content);
  assert.equal(parse(r.content).facts.bbox.max[0], 40);
});

test('gear queries (R6a.4b, D56): centre distance, backlash, contact ratio and clearance of two gears as placed; a crossing measured as minus its depth; not gears, unknown', async () => {
  const { commands } = await import('../src/app/commands');
  const gear = commands.find(c => c.id === 'gear')!, mesh = commands.find(c => c.id === 'gear-mesh')!;
  const ctx0 = { doc: { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nodes: [], outputs: {}, nextId: 0 } as StudioDoc, bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const one = gear.build!(ctx0, { ...gear.defaults!(ctx0), m: 2, teeth: 20, b: 10, bore: 8, x: 0, y: 0, z: 0 }), r1 = await evaluate(one); assert.ok(r1.ok);
  const doc = mesh.build!({ doc: one, bodies: r1.ok ? r1.bodies : [], selection: { faces: [], edges: [], bodies: [0] } }, { teeth: 40, dir: 0, bore: 8 });
  let s = await stateOf({ ...doc, nodes: [{ ...doc.nodes[0], thicknessReduction: 0.1 } as typeof doc.nodes[number], { ...doc.nodes[1], thicknessReduction: 0.1 } as typeof doc.nodes[number]] });
  const q = (fn: string) => ({ fn, a: 'n0', b: 'n1' });
  const reqs = [
    { id: 'G1', source: 'shafts 60 mm apart', hard: true, check: { op: '==', query: q('gear_center_distance'), value: 60, tol: 1e-6, unit: 'mm' } },
    { id: 'G2', source: 'backlash 0.1–0.3 mm', hard: true, check: { op: 'between', query: q('gear_backlash'), min: 0.1, max: 0.3, unit: 'mm' } },
    { id: 'G3', source: 'contact ratio at least 1.4', hard: true, check: { op: '>=', query: q('gear_contact_ratio'), value: 1.4 } },
    { id: 'G4', source: 'teeth never touch', hard: true, check: { op: '>=', query: q('gear_clearance'), value: 0.05, unit: 'mm' } },
    { id: 'G5', source: 'a gear pair', hard: false, check: { op: '>=', query: { fn: 'gear_backlash', a: 'n0', b: 'n9' }, value: 0 } },
  ];
  let r = await runTool(s, 'set_requirements', { requirements: reqs }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  let rep = parse((await runTool(s, 'check_spec', {}, evaluate)).content);
  // (Each tooth 0.1 mm thinner: backlash 0.2 mm on the pitch circle; the least clearance the normal one, j·cos 20° / 2.)
  assert.deepEqual(rep.summary, { pass: 4, fail: 0, unknown: 1, hard_failing: 0 }, JSON.stringify(rep));
  assert.match(rep.unknowns[0].why, /n9 is not a spur gear or rack body/);
  // Half a pitch out: the teeth cross, the clearance negative (minus the depth).
  s = { ...s, doc: { ...s.doc, nodes: [s.doc.nodes[0], { ...s.doc.nodes[1], mesh: { gear: 0, phase: 4.5 } } as typeof s.doc.nodes[number]] } };
  const re = await evaluate(s.doc); assert.ok(re.ok); s = { ...s, bodies: re.ok ? re.bodies : [] };
  rep = parse((await runTool(s, 'check_spec', {}, evaluate)).content);
  const f = rep.failures.find((x: { req_id: string }) => x.req_id === 'G4');
  assert.ok(f && f.measured < -1, JSON.stringify(rep.failures)); assert.match(f.hint, /the teeth cross/);
  // Malformed: a and b are feature ids.
  r = await runTool(s, 'set_requirements', { requirements: [{ id: 'G9', source: 'x', hard: true, check: { op: '>=', query: { fn: 'gear_backlash', a: 'n0' }, value: 0 } }] }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /gear_backlash takes two spur gears' feature ids/);
});
