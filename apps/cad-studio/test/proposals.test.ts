import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, previewProposal, runTool, type ChatState } from '../src/chat/tools';
import { compactHistory, HISTORY_BYTES, rejectProposal, PROMPT_CHARS, stripHistory, withHistory, type HistoryEntry } from '../src/chat/proposals';
import { modelHash } from '../src/chat/spec';
import { readStudioDoc } from '../src/engine/migrate';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Proposals and the design history (A4.2): a change proposed is worked out on a copy, the part unchanged; a
// person accepts (its ops replayed) or rejects it (kept); the history is compact, capped and under a budget.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const HOLE = { tool: 'run_command', args: { command: 'hole', faces: ['n1.top'], values: { d: 6, x: 10, y: 10 } } };
const R1 = { id: 'R1', source: '40 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 40, tol: 0.1 } };
const R2 = { id: 'R2', source: 'at most 6000 mm³', hard: true, check: { op: '<=', query: { fn: 'volume' }, value: 6000 } };

test('propose: worked out on a copy (diff, checks before and after, risk), the part unchanged, kept in the document', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'set_requirements', { requirements: [R1, R2] }, evaluate)).state;
  const before = modelHash(s.doc);
  const r = await runTool(s, 'propose', { title: 'Lighter: a Ø6 hole', ops: [HOLE], plan: 'A through hole takes 226 mm³ off.', requirements: ['R2'] }, evaluate), out = parse(r.content);
  assert.ok(!r.isError, r.content);
  assert.equal(modelHash(r.state.doc), before, 'the model is unchanged');
  assert.equal(r.state.doc.nodes, s.doc.nodes);
  assert.deepEqual(out.diff.added.map((a: { id: string }) => a.id), ['n2']);
  assert.ok(out.change.volume_mm3 < 0);
  // 40·20·8 = 6400 mm³ fails R2; the hole (π·9·8 ≈ 226) still leaves 6174: R2 still fails, R1 passes both.
  assert.deepEqual([out.checks.before.pass, out.checks.after.pass], [1, 1]);
  assert.deepEqual(out.risk, { level: 'low', features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] });
  const p = r.state.doc.proposals![0];
  assert.deepEqual([p.id, p.status, p.base, p.requirements, p.ops.length], ['P1', 'open', before, ['R2'], 1]);
  assert.match(p.summary, /1 added, checks 1\/1\/0 → 1\/1\/0/);
  assert.deepEqual(r.state.doc.history!.map(h => [h.id, h.kind, h.proposal]), [['h1', 'proposal', 'P1']]);
  // Unknown requirement ids, a missing title and a refused op are refused, nothing kept.
  assert.ok((await runTool(s, 'propose', { title: 'x', ops: [HOLE], requirements: ['R9'] }, evaluate)).isError);
  assert.ok((await runTool(s, 'propose', { ops: [HOLE] }, evaluate)).isError);
  const bad = await runTool(s, 'propose', { title: 'x', ops: [{ tool: 'run_command', args: { command: 'hole', faces: ['n9.top'], values: { d: 6 } } }] }, evaluate);
  assert.ok(bad.isError); assert.equal(bad.state, s);
  // A bigger hole makes R2 pass: newly passing, a hard requirement changed, the risk high.
  const big = parse((await runTool(s, 'propose', { title: 'Ø12', ops: [{ ...HOLE, args: { ...HOLE.args, values: { d: 12, x: 10, y: 10 } } }] }, evaluate)).content);
  assert.deepEqual([big.checks.newly_passing, big.risk.hard_requirements_changed, big.risk.level], [['R2'], ['R2'], 'high']);
  // Listed: open ones, then stale once the part changes.
  const listed = parse((await runTool(r.state, 'list_proposals', {}, evaluate)).content).proposals;
  assert.deepEqual(listed.map((q: { id: string; stale: boolean; ops: number }) => [q.id, q.stale, q.ops]), [['P1', false, 1]]);
  const edited = (await runTool(r.state, 'edit_feature', { index: 1, values: { h: 10 } }, evaluate)).state;
  assert.equal(parse((await runTool(edited, 'list_proposals', {}, evaluate)).content).proposals[0].stale, true);
});

test('accept replays the ops (on a changed part too, said so); reject keeps the proposal; both in the history', async () => {
  const s0 = await stateOf(rectanglePart(40, 20, 8));
  let s = (await runTool(s0, 'propose', { title: 'hole', ops: [HOLE] }, evaluate)).state;
  s = (await runTool(s, 'propose', { title: 'another hole', ops: [{ ...HOLE, args: { ...HOLE.args, values: { d: 4, x: 30, y: 10 } } }] }, evaluate)).state;
  const ghost = await previewProposal(s, 'P1', evaluate);
  assert.ok('bodies' in ghost, JSON.stringify(ghost)); assert.ok(ghost.bodies[0].volumeMM3! < s.bodies[0].volumeMM3!, `${ghost.bodies[0].volumeMM3} ${s.bodies[0].volumeMM3}`);
  const a = await acceptProposal(s, 'P1', evaluate);
  assert.ok('state' in a, JSON.stringify(a));
  assert.equal(a.state.doc.nodes.length, 3);
  const p1 = a.state.doc.proposals![0];
  assert.deepEqual([p1.status, p1.decided?.by, p1.decided?.model_hash, p1.decided?.note], ['accepted', 'user', modelHash(a.state.doc), undefined]);
  // P2 was made on the part before P1: accepted after it, it is replayed on the changed part, and that is said.
  const b = await acceptProposal(a.state, 'P2', evaluate);
  assert.ok('state' in b, JSON.stringify(b)); assert.equal(b.state.doc.nodes.length, 4);
  assert.match(b.state.doc.proposals![1].decided!.note!, /replayed on a part changed/);
  assert.ok('error' in await acceptProposal(b.state, 'P1', evaluate), 'decided once');
  // Rejected: kept, with the reason.
  const s3r = await runTool(b.state, 'propose', { title: 'third', ops: [{ ...HOLE, args: { ...HOLE.args, values: { d: 3, x: 20, y: 5 } } }] }, evaluate), s3 = s3r.state;
  assert.ok(!s3r.isError, s3r.content);
  const rej = rejectProposal(s3.doc, 'P3', 'not needed');
  assert.ok(!('error' in rej), JSON.stringify(rej));
  assert.deepEqual(rej.proposals!.map(q => q.status), ['accepted', 'accepted', 'rejected']);
  assert.deepEqual(rej.history!.map(h => h.kind), ['proposal', 'proposal', 'accept', 'accept', 'proposal', 'reject']);
  assert.equal(rej.history!.find(h => h.kind === 'accept')!.model_hash, p1.decided!.model_hash);
  // A proposal whose ops no longer apply (its face gone) is refused on accept, nothing changed.
  const gone = (await runTool(s0, 'propose', { title: 'on n1.top', ops: [HOLE] }, evaluate)).state;
  const moved = { ...gone, doc: { ...gone.doc, proposals: gone.doc.proposals!.map(q => ({ ...q, ops: [{ ...HOLE, args: { ...HOLE.args, faces: ['n9.top'] } }] })) } };
  const refused = await acceptProposal(moved, 'P1', evaluate);
  assert.ok('error' in refused && /n9\.top/.test(refused.error), JSON.stringify(refused));
  // Saved and opened, the proposals and history are the same.
  const read = readStudioDoc(JSON.stringify(rej)); assert.ok('doc' in read);
  assert.deepEqual([read.doc.proposals, read.doc.history], [rej.proposals, rej.history]);
});

test('history: prompts capped, the oldest folded under the budget (said so), stripped for sharing', () => {
  let doc: StudioDoc = rectanglePart(10, 10, 10);
  doc = withHistory(doc, { kind: 'prompt', by: { agent: 'chat', model: 'm' }, prompt: 'x'.repeat(5000) });
  assert.equal(doc.history![0].prompt!.length, PROMPT_CHARS);
  // 200 entries of ~2 kB under a 40 kB budget: folded, the newest kept as they were.
  for (let i = 0; i < 200; i++) doc = withHistory(doc, { kind: i % 2 ? 'change' : 'prompt', by: { agent: 'chat' }, prompt: `p${i} ` + 'y'.repeat(1900), model_hash: String(i) }, 40_000);
  const h = doc.history!;
  assert.ok(JSON.stringify(h).length <= 40_000, `${JSON.stringify(h).length}`);
  assert.equal(h[0].kind, 'compacted');
  assert.equal(h[0].compacted!.entries + h.length - 1, 201, 'every entry is accounted for');
  assert.equal(h[h.length - 1].model_hash, '199');
  assert.equal(new Set(h.map(e => e.id)).size, h.length, 'ids unique');
  // Ids keep counting after a fold.
  assert.equal(withHistory(doc, { kind: 'change', by: { agent: 'user' } }).history!.at(-1)!.id, 'h202');
  // The default budget is a tenth of the 4 MiB file limit.
  assert.equal(HISTORY_BYTES, 419430);
  const small: HistoryEntry[] = [{ id: 'h1', at: 't', kind: 'prompt', by: { agent: 'chat' } }];
  assert.equal(compactHistory(small, 1), small, 'one entry is never folded');
  // Stripped: no history, no prompts or plans in the proposals.
  const shared = stripHistory({ ...doc, proposals: [{ id: 'P1', title: 't', status: 'open', by: { agent: 'chat' }, at: 't', prompt: 'secret', plan: 'plan', base: '0', ops: [], summary: '', risk: { level: 'low', features_touched: 0, references_broken: 0, hard_requirements_changed: [], approval: [] } }] });
  assert.equal(shared.history, undefined);
  assert.ok(!JSON.stringify(shared).includes('secret') && !JSON.stringify(shared).includes('"plan"'));
});

test('risk: an assembly, mates, a drawing or a part from a file always need approval', async () => {
  const s = await stateOf({ ...rectanglePart(40, 20, 8), instances: [{ id: 'i1', name: 'pin', doc: rectanglePart(4, 4, 10), position: [0, 0, 20], rotation: [0, 0, 0], part: { id: 'pin', rev: 'A', source: 'pin.bcad' } }] });
  const out = parse((await runTool(s, 'propose', { title: 'hole', ops: [HOLE] }, evaluate)).content);
  assert.deepEqual(out.risk.approval, ['assembly', 'locked part']);
});

// The A4 conformance cases (conformance/a4): a document, a proposal, what it would do, and its acceptance.
const a4 = join(process.cwd(), 'conformance', 'a4');
for (const file of readdirSync(a4).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a4, file), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, async () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read);
    const s = await stateOf(read.doc);
    const r = await runTool(s, c.input.call.tool, c.input.call.args, evaluate), out = parse(r.content);
    assert.ok(!r.isError, r.content);
    assert.equal(modelHash(r.state.doc) === modelHash(s.doc), c.expect.model_unchanged);
    assert.deepEqual(out.diff.added.map((a: { id: string }) => a.id), c.expect.added);
    assert.deepEqual(out.checks, c.expect.checks);
    assert.deepEqual(out.risk, c.expect.risk);
    assert.equal(r.state.doc.proposals!.at(-1)!.summary, c.expect.summary);
    const a = await acceptProposal(r.state, out.proposal, evaluate); assert.ok('state' in a, JSON.stringify(a));
    assert.equal(a.state.doc.nodes.length, c.expect.accepted.features);
    assert.deepEqual(a.state.doc.history!.map(h => h.kind), c.expect.accepted.history);
  });
}
