import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { rectanglePart, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { withLook } from '../src/app/bodies';
import type { Requirement } from '../src/chat/spec';
import { bomView, deriveBom } from '../src/team/assembly';
import { draftBaseline, moveBaseline } from '../src/team/baseline';
import { userToken } from '../src/team/ecr';
import { bomResult, currentOf, displayOf, dfmResult, drawingResult, emptyStore, freshnessOf, inertiaResult, keepoutResult, massResult, numericOf, openRun, passes, recordResult, requirementResults, stamp, summaryOf, type Freshness, type Result } from '../src/team/freshness';
import { runPartsScenario, type PartsScenario } from '../src/team/scripted';

// A8.5b (O32's addendum, O39): every result stamped with what it read; read back current, stale (the changed input
// named) or unresolved (a face gone, ambiguous, or renamed — never re-targeted; A1's own re-match failure carried in).
// A stale result is never shown as current nor approved on; a late result belongs to its own run; a result that
// failed, is not supported or did not converge never reads as 0 or as a pass.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const req = (id: string, query: Requirement['check']['query'], op: Requirement['check']['op'], value: number, tol = 0): Requirement => ({ id, source: id, hard: true, basis: 'stated', check: { op, query, value, tol } });
async function bodiesOf(doc: StudioDoc) { const e = await evaluate(doc); assert.ok(e.ok); return e.bodies; }

/** A 40 × 20 × 5 plate, aluminium, FDM, a keep-out 10 mm above it, three requirements (a size, a mass, a face distance). */
async function plate(): Promise<StudioDoc> {
  let doc: StudioDoc = { ...rectanglePart(40, 20, 5), process: 'fdm', requirements: [
    req('R-height', { fn: 'bbox', axis: 'z' }, '==', 5, 1e-6), req('R-mass', { fn: 'mass' }, '<=', 100), req('R-faces', { fn: 'distance_between', a: 'n1.top', b: 'n1.bottom' }, '==', 5, 1e-6)] };
  doc = withLook(doc, (await bodiesOf(doc))[0], { material: 'al6061' });
  const s: ChatState = { doc, bodies: await bodiesOf(doc) };
  const r = await dispatchTool(s, 'add_keepout', { name: 'above', box: { frame: { origin: [0, 0, 15], normal: [0, 0, 1], xAxis: [1, 0, 0] }, size: [40, 20, 10] } }, evaluate);
  assert.ok(!r.isError, r.content);
  return r.state.doc;
}
async function allOf(doc: StudioDoc, run: string): Promise<Result[]> {
  return [...await requirementResults(doc, evaluate, run), await keepoutResult(doc, 'K1', evaluate, run), await massResult(doc, evaluate, run), await inertiaResult(doc, evaluate, run), await dfmResult(doc, evaluate, run), drawingResult(doc, run)];
}
async function states(rs: readonly Result[], doc: StudioDoc): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const r of rs) { const f = await freshnessOf(r, doc, evaluate); out[`${r.kind}:${r.subject}`] = f.state === 'stale' ? `stale ${f.changed.join('+')}` : f.state; }
  return out;
}

test('every kind stamped with what it reads; a material, a process and a keep-out change each make the right results stale, naming the input; a colour changes none', async () => {
  const doc = await plate(), rs = await allOf(doc, 'R1');
  const reads = Object.fromEntries(rs.map(r => [`${r.kind}:${r.subject}`, Object.keys(r.fingerprint.inputs).join(',')]));
  assert.deepEqual(reads, {
    'requirement:R-height': 'model,requirement', 'requirement:R-mass': 'material,model,requirement', 'requirement:R-faces': 'model,requirement',
    'check_spec:all': 'drafts,material,model,process,references,requirements', 'keepout:K1': 'model,references', 'mass:base': 'material,model', 'inertia:base': 'material,model',
    'dfm:base': 'material,model,process', 'drawing:sheet': 'drawing,model',
  });
  assert.deepEqual(Object.keys(rs.find(r => r.subject === 'R-faces')!.fingerprint.faces ?? {}), ['n1.top', 'n1.bottom'], 'the faces it names, by signature');
  assert.ok(rs.every(r => r.status === 'ok'), JSON.stringify(rs.filter(r => r.status !== 'ok')));
  assert.deepEqual(Object.values(await states(rs, doc)).filter(s => s !== 'current'), []);
  const body = (await bodiesOf(doc))[0];
  const steel = withLook(doc, body, { material: 'steel' });
  assert.deepEqual(await states(rs, steel), {
    'requirement:R-height': 'current', 'requirement:R-mass': 'stale material', 'requirement:R-faces': 'current', 'check_spec:all': 'stale material', 'keepout:K1': 'current',
    'mass:base': 'stale material', 'inertia:base': 'stale material', 'dfm:base': 'stale material', 'drawing:sheet': 'current',
  });
  const sla: StudioDoc = { ...doc, process: 'sla' }, st = await states(rs, sla);
  assert.deepEqual(Object.entries(st).filter(([, v]) => v !== 'current'), [['check_spec:all', 'stale process'], ['dfm:base', 'stale process']]);
  const moved = (await dispatchTool({ doc, bodies: await bodiesOf(doc) }, 'add_keepout', { name: 'beside', box: { frame: { origin: [50, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] }, size: [5, 5, 5] } }, evaluate)).state.doc;
  assert.deepEqual(Object.entries(await states(rs, moved)).filter(([, v]) => v !== 'current'), [['check_spec:all', 'stale references'], ['keepout:K1', 'stale references']]);
  // (A look is not an input: a colour, a name, an appearance change nothing.)
  const red = withLook(doc, body, { color: '#d9534f', name: 'Steel bracket' });
  assert.deepEqual(Object.values(await states(rs, red)).filter(s => s !== 'current'), []);
  // (A geometry change: every result reading the model.)
  const taller: StudioDoc = { ...doc, nodes: doc.nodes.map((n, i) => (i === 1 ? { ...n, height: 6 } as ModelNode : n)) };
  assert.ok(Object.values(await states(rs, taller)).every(s => s.startsWith('stale model') || s === 'unresolved'), JSON.stringify(await states(rs, taller)));
});

test('a stale result is shown as stale, its input named, never as current; and never approved on (STALE_RESULT); a result not ok is not either', async () => {
  const doc = await plate(), [mass] = [await massResult(doc, evaluate, 'R1')], body = (await bodiesOf(doc))[0];
  const now = await freshnessOf(mass, doc, evaluate);
  assert.equal(displayOf(mass, now), `mass base: ${mass.number}`); assert.ok(passes({ ...mass, verdict: 'pass' }, now));
  const steel = withLook(doc, body, { material: 'steel' }), f = await freshnessOf(mass, steel, evaluate);
  assert.match(displayOf(mass, f), /^mass base: STALE — material changed since; it was /); assert.equal(passes({ ...mass, verdict: 'pass' }, f), false);
  // (A BOM baseline on the clean assembly citing p1's mass: approved while current; refused once p1's material changes.)
  const sc = JSON.parse(readFileSync(join(resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/a8/scenarios'), 'parts-clean.json'), 'utf8')) as PartsScenario;
  const asm = (await runPartsScenario(sc, evaluate)).final, m1 = await massResult(asm, evaluate, 'R1', 'p1');
  const draft = async (d: StudioDoc, cites: Result[]) => { const view = await bomView(d, evaluate), b = draftBaseline(d, deriveBom(view), view, { cites }); return moveBaseline(b.doc, b.baseline.id, 'review', userToken('t')); };
  const ok = await draft(asm, [m1]);
  assert.equal((await moveBaseline(ok.doc, 'BL1', 'approved', userToken('t'), evaluate)).baseline.state, 'approved');
  // (p1's material changed after the draft: the baseline's own pins catch it first — the part named.)
  const p1 = asm.instances!.find(i => i.id === 'p1')!, p1b = (await bodiesOf(p1.doc))[0];
  const restyled: StudioDoc = { ...ok.doc, instances: ok.doc.instances!.map(i => (i.id === 'p1' ? { ...i, doc: withLook(i.doc, p1b, { material: 'steel' }) } : i)) };
  await assert.rejects(() => moveBaseline(restyled, 'BL1', 'approved', userToken('t'), evaluate), /STALE_BASELINE.*part p1/);
  // (Drafted on the new state but citing the old result: STALE_RESULT, the input named.)
  const again = await draft(restyled, [m1]);
  await assert.rejects(() => moveBaseline(again.doc, again.baseline.id, 'approved', userToken('t'), evaluate), /STALE_RESULT.*mass:p1\/p1@R1, stale: material changed since/);
  // (Citing a failed result: RESULT_NOT_OK.)
  const failed = stamp(asm, [], { id: 'mass:x@R2', kind: 'mass', subject: 'x', run: 'R2', status: 'failed', why: 'the part does not evaluate' });
  const bad = await draft(asm, [failed]);
  await assert.rejects(() => moveBaseline(bad.doc, 'BL1', 'approved', userToken('t'), evaluate), /RESULT_NOT_OK.*failed \(the part does not evaluate\)/);
});

test('a late result belongs to its own run only: the latest run is pending until its result arrives, never filled by an earlier one', async () => {
  const doc = await plate();
  let s = emptyStore(); const a = openRun(s, 'mass', 'base'); s = a.store;
  const b = openRun(s, 'mass', 'base'); s = b.store;
  assert.equal(currentOf(s, 'mass', 'base'), 'pending');
  // (Run 1's result arrives after run 2 opened: kept under run 1, marked late; run 2 still pending.)
  s = recordResult(s, await massResult(doc, evaluate, a.run));
  assert.equal(currentOf(s, 'mass', 'base'), 'pending'); assert.equal(s.results.find(r => r.run === a.run)?.late, true);
  const steel = withLook(doc, (await bodiesOf(doc))[0], { material: 'steel' });
  s = recordResult(s, await massResult(steel, evaluate, b.run));
  const cur = currentOf(s, 'mass', 'base') as Result;
  assert.equal(cur.run, b.run); assert.equal(cur.late, undefined); assert.ok(cur.number! > (s.results.find(r => r.run === a.run)!.number!), 'steel, the later run');
  // (Another subject is untouched; a result for a run of another subject is refused.)
  assert.equal(currentOf(s, 'mass', 'p1'), null);
  assert.throws(() => recordResult(s, { ...cur, subject: 'p9' }), /NO_RUN/);
});

test('a result that failed, is not supported or did not converge never reads as 0 or as a pass', async () => {
  const empty: StudioDoc = { ...rectanglePart(1, 1, 1), nodes: [] };
  const failed = await massResult(empty, evaluate, 'R1');
  assert.deepEqual([failed.status, failed.number, failed.value, failed.verdict], ['failed', null, null, undefined]); assert.match(failed.why!, /no body/);
  // (A mass requirement on a body without a material: not measurable — unsupported, not a pass and not 0.)
  const bare: StudioDoc = { ...rectanglePart(10, 10, 10), requirements: [req('R-m', { fn: 'mass' }, '<=', 1e9)] };
  const [rm] = await requirementResults(bare, evaluate, 'R1');
  assert.equal(rm.status, 'unsupported'); assert.equal(numericOf(rm), null); assert.match(rm.why!, /material/);
  // (Printability with no process: unsupported.)
  const dfm = await dfmResult(bare, evaluate, 'R1'); assert.equal(dfm.status, 'unsupported'); assert.match(dfm.why!, /no process/);
  // (A drawing of nothing: failed.)
  assert.equal(drawingResult(empty, 'R1').status, 'failed');
  // (Non-converged — no producer reports it today; the status holds the same rule.)
  const nc = stamp(bare, [], { id: 'x', kind: 'inertia', subject: 'base', run: 'R1', status: 'non_converged', value: { massKg: 0 }, number: 0, verdict: 'pass', why: 'the eigen-solve stopped at its sweep limit' });
  assert.deepEqual([nc.number, nc.value, nc.verdict], [null, null, undefined], 'a not-ok result keeps no number, value or verdict');
  const cur: Freshness = { state: 'current', changed: [], unresolved: [] };
  for (const r of [failed, rm, dfm, nc]) { assert.equal(numericOf(r), null); assert.equal(passes(r, cur), false); assert.doesNotMatch(displayOf(r, cur), /: 0\b|\(pass\)/); }
  assert.equal(displayOf(nc, cur), 'inertia base: non-converged — the eigen-solve stopped at its sweep limit');
  assert.deepEqual(summaryOf([failed, rm, dfm, nc].map(result => ({ result, freshness: cur }))), { pass: 0, fail: 0, unknown: 0, stale: 0, unresolved: 0, failed: 1, unsupported: 2, non_converged: 1 });
  // (A BOM of a part that does not evaluate: failed, its total not 0.)
  const sc = JSON.parse(readFileSync(join(resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/a8/scenarios'), 'parts-clean.json'), 'utf8')) as PartsScenario;
  const asm = (await runPartsScenario(sc, evaluate)).final, broken: StudioDoc = { ...asm, instances: asm.instances!.map(i => (i.id === 'p2' ? { ...i, doc: empty } : i)) };
  const bom = await bomResult(broken, evaluate, 'R1'); assert.deepEqual([bom.status, bom.number], ['failed', null]); assert.match(bom.why!, /^p2: /);
  assert.equal((await bomResult(asm, evaluate, 'R1')).verdict, 'pass');
});

test('faces lost to a topology change: the result unresolved — gone, ambiguous with candidates, or renamed — never re-targeted; A1\'s ambiguous re-match carried in', async () => {
  const box = (min: [number, number], max: [number, number], id = 'n0') => ({ id, kind: 'sketch', profile: 'rectangle', min, max }) as ModelNode;
  const ext = (sketch: number, id = 'n1') => ({ id, kind: 'extrude', sketch, height: 5 }) as ModelNode;
  const two = (a: [number, number, number, number], b: [number, number, number, number]): StudioDoc => ({ ...rectanglePart(1, 1, 1), nodes: [box([a[0], a[1]], [a[2], a[3]]), ext(0), box([b[0], b[1]], [b[2], b[3]], 'n2'), ext(2, 'n3')], nextId: 4 } as StudioDoc);
  const wide: StudioDoc = { ...rectanglePart(1, 1, 1), nodes: [box([0, 0], [30, 10]), ext(0)], nextId: 2, requirements: [req('R-top', { fn: 'distance_between', a: 'n1.top', b: 'n1.bottom' }, '==', 5, 1e-6)] } as StudioDoc;
  const read = (d: StudioDoc) => (readStudioDoc(JSON.stringify(d)) as { doc: StudioDoc }).doc;
  const [r] = await requirementResults(read(wide), evaluate, 'R1');
  assert.equal(r.verdict, 'pass', JSON.stringify(r)); assert.deepEqual(Object.keys(r.fingerprint.faces!), ['n1.top', 'n1.bottom']);
  // (Split in two alike tops, each 10 mm from where it was: ambiguous, both candidates.)
  const split = read({ ...two([0, 0, 10, 10], [20, 0, 30, 10]), requirements: wide.requirements });
  const f = await freshnessOf(r, split, evaluate);
  assert.equal(f.state, 'unresolved'); assert.deepEqual(f.unresolved.map(u => [u.face, u.why, u.candidates]), [['n1.top', 'ambiguous', ['n1.top', 'n3.top']], ['n1.bottom', 'ambiguous', ['n1.bottom', 'n3.bottom']]]);
  assert.match(displayOf(r, f), /UNRESOLVED — n1.top could be n1.top or n3.top/);
  // (The box moved away and another put where it was: clearly n3's faces now — renamed, not re-targeted.)
  const narrow: StudioDoc = { ...wide, nodes: [box([0, 0], [10, 10]), ext(0)] }, [rn] = await requirementResults(read(narrow), evaluate, 'R1');
  const swapped = read({ ...two([100, 0, 110, 10], [0, 0, 10, 10]), requirements: wide.requirements });
  const g = await freshnessOf(rn, swapped, evaluate);
  assert.deepEqual(g.unresolved.map(u => [u.face, u.why, u.candidates]), [['n1.top', 'renamed', ['n3.top']], ['n1.bottom', 'renamed', ['n3.bottom']]]);
  assert.match(g.unresolved[0].message, /n1.top is now named n3.top: the result is not moved to it/);
  // (Nothing alike left — a sphere: gone.)
  const sphere = (await dispatchTool({ doc: { ...rectanglePart(1, 1, 1), nodes: [], nextId: 0 } as StudioDoc, bodies: [] }, 'run_command', { command: 'sphere', values: { r: 5, x: 0, y: 0, z: 0 } }, evaluate)).state.doc;
  assert.deepEqual((await freshnessOf(rn, sphere, evaluate)).unresolved.map(u => [u.face, u.why]), [['n1.top', 'gone'], ['n1.bottom', 'gone']]);
  // (A1's conformance case: a mate as near two tops. A result relying on it takes A1's state, with A1's candidates.)
  const a1 = JSON.parse(readFileSync(join(resolve(import.meta.dirname, '..'), 'conformance', 'a1', 'refs-ambiguous.json'), 'utf8')), doc = read(a1.input.file);
  const onMate = stamp(doc, await bodiesOf(doc), { id: 'mass:base@R1', kind: 'mass', subject: 'base', run: 'R1', status: 'ok', number: 1 }, { refs: ['mate m1'] });
  const h = await freshnessOf(onMate, doc, evaluate);
  assert.equal(h.state, 'unresolved'); assert.deepEqual(h.unresolved.map(u => u.candidates), a1.expect.problems.map((p: { candidates: string[] }) => p.candidates));
  assert.match(h.unresolved[0].message, /^mate m1: "n1.top" could be n1.top or n3.top$/);
});
