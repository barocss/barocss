import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
const a3 = join(process.cwd(), 'conformance', 'a3');
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
