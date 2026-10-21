import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { acceptProposal, agentMayNotAccept, dispatchTool, leaveOutClosure, previewProposal, proposalParts, rebaseProposal, runTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { approvalOf, compactHistory, HISTORY_BYTES, rejectProposal, PROMPT_CHARS, stripHistory, withHistory, type HistoryEntry } from '@barocss/cad-model/chat/proposals';
import { modelHash } from '@barocss/cad-model/chat/spec';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import { defaultDrawing } from '@barocss/cad-model/drawing/types';
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

test('accept replays the ops; a stale one is refused until rebased (recomputed, both bases kept); reject keeps the proposal; all in the history', async () => {
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
  // P2 was made on the part before P1: stale, refused blind; rebased, its diff and risk made again on the part
  // as it is (both bases kept), then accepted.
  const blind = await acceptProposal(a.state, 'P2', evaluate);
  assert.ok('error' in blind && blind.stale, JSON.stringify(blind));
  const re = await rebaseProposal(a.state, 'P2', evaluate);
  assert.ok('state' in re, JSON.stringify(re));
  const p2 = re.state.doc.proposals![1];
  assert.deepEqual([p2.base, p2.rebased!.original, p2.rebased!.from, p2.status], [modelHash(a.state.doc), s.doc.proposals![1].base, s.doc.proposals![1].base, 'open']);
  assert.equal(re.state.doc.nodes.length, 3, 'a rebase changes nothing');
  assert.ok('error' in await rebaseProposal(re.state, 'P2', evaluate), 'nothing to rebase once current');
  const b = await acceptProposal(re.state, 'P2', evaluate);
  assert.ok('state' in b, JSON.stringify(b)); assert.equal(b.state.doc.nodes.length, 4);
  assert.match(b.state.doc.proposals![1].decided!.note!, /rebased before/);
  const acc = b.state.doc.history!.at(-1)!;
  assert.deepEqual([acc.kind, acc.base_was, acc.proposed_by?.agent], ['accept', s.doc.proposals![1].base, 'chat']);
  assert.ok('error' in await acceptProposal(b.state, 'P1', evaluate), 'decided once');
  // Rejected: kept, with the reason.
  const s3r = await runTool(b.state, 'propose', { title: 'third', ops: [{ ...HOLE, args: { ...HOLE.args, values: { d: 3, x: 20, y: 5 } } }] }, evaluate), s3 = s3r.state;
  assert.ok(!s3r.isError, s3r.content);
  const rej = rejectProposal(s3.doc, 'P3', 'not needed');
  assert.ok(!('error' in rej), JSON.stringify(rej));
  assert.deepEqual(rej.proposals!.map(q => q.status), ['accepted', 'accepted', 'rejected']);
  assert.deepEqual(rej.history!.map(h => h.kind), ['proposal', 'proposal', 'accept', 'rebase', 'accept', 'proposal', 'reject']);
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

test('risk: changes to an assembly, its mates, the drawing or a part from a file always need approval; a change beside them does not', async () => {
  const s = await stateOf({ ...rectanglePart(40, 20, 8), instances: [{ id: 'i1', name: 'pin', doc: rectanglePart(4, 4, 10), position: [0, 0, 20], rotation: [0, 0, 0], part: { id: 'pin', rev: 'A', source: 'pin.bcad' } }] });
  // A hole in the base part: the placed part untouched, nothing needing approval.
  assert.deepEqual(parse((await runTool(s, 'propose', { title: 'hole', ops: [HOLE] }, evaluate)).content).risk.approval, []);
  // The placed part (from a file) moved: the assembly and a locked part.
  const moved = parse((await runTool(s, 'propose', { title: 'move', ops: [{ tool: 'place_part', args: { part: 'i1', position: [5, 0, 20] } }] }, evaluate)).content);
  assert.deepEqual(moved.risk.approval, ['assembly', 'locked part']);
  // Directly, refused at every level, the state the same.
  const direct = await runTool(s, 'place_part', { part: 'i1', position: [5, 0, 20] }, evaluate);
  assert.ok(direct.isError); assert.equal(parse(direct.content).code, 'needs_approval'); assert.equal(direct.state, s);
  assert.deepEqual(approvalOf(s.doc, { ...s.doc, drawing: defaultDrawing() }), ['drawing']);
});

// The A4 conformance cases (conformance/a4): a document, a proposal, what it would do, and its acceptance.
const a4 = join(process.cwd(), 'conformance', 'a4');
for (const file of readdirSync(a4).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a4, file), 'utf8'));
  test(`conformance ${c.id}: ${c.about}`, async () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read);
    const s = await stateOf(read.doc);
    if (c.input.l2) {
      // (Each turn from the file's part; a call applied carries on, a refused one leaves the part as it was.)
      const was = process.env.CAD_AUTONOMY;
      try {
        process.env.CAD_AUTONOMY = String(c.expect.level);
        // (A turn starts from the file's part, an empty part, or where the turn before left it.)
        let previous = s;
        for (const turn of c.input.l2.turns) {
          const start = Array.isArray(turn) ? s : turn.start === 'empty' ? { doc: emptyDoc(), bodies: [] } : turn.start === 'previous' ? previous : s;
          let st: ChatState = { ...start, turnBase: start.doc };
          for (const call of Array.isArray(turn) ? turn : turn.calls) {
            const r = await runTool(st, call.tool, call.args, evaluate);
            if (call.expect === 'applied') { assert.ok(!r.isError, r.content); st = r.state; continue; }
            const e = parse(r.content);
            assert.ok(r.isError); assert.equal(e.code, call.expect); assert.match(e.error, new RegExp(call.why)); assert.equal(r.state, st);
          }
          if (!Array.isArray(turn) && turn.nodes !== undefined) assert.equal(st.doc.nodes.length, turn.nodes);
          previous = st;
        }
      } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
      return;
    }
    if (c.input.direct) {
      const was = process.env.CAD_AUTONOMY;
      try {
        for (const level of c.input.direct.levels) {
          process.env.CAD_AUTONOMY = String(level);
          const d = await runTool(s, c.input.direct.tool, c.input.direct.args, evaluate), why = parse(d.content);
          assert.ok(d.isError); assert.equal(d.state, s);
          // (L1 refuses any change first; from L2 the approval rule.)
          if (level > 1) assert.deepEqual({ code: why.code, approval: why.approval }, c.expect.refusal);
        }
        const p = await runTool(s, 'propose', { title: 'move', ops: [{ tool: c.input.direct.tool, args: c.input.direct.args }] }, evaluate), out = parse(p.content);
        assert.deepEqual(out.risk.approval, c.expect.proposed_approval);
        process.env.CAD_AUTONOMY = '4';
        assert.match(parse((await runTool(p.state, 'accept_proposal', { id: out.proposal }, evaluate)).content).error, new RegExp(c.expect.agent_accept));
        const a = await acceptProposal(p.state, out.proposal, evaluate); assert.ok('state' in a, JSON.stringify(a));
        assert.deepEqual(a.state.doc.instances![0].position, c.expect.accepted_position);
      } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
      return;
    }
    if (c.input.accept) {
      const blind = await acceptProposal(s, c.input.accept.id, evaluate);
      assert.equal('error' in blind && blind.stale === true, c.expect.stale);
      const re = await rebaseProposal(s, c.input.accept.id, evaluate); assert.ok('state' in re, JSON.stringify(re));
      const q = re.state.doc.proposals!.find(x => x.id === c.input.accept.id)!;
      assert.deepEqual([q.rebased!.original, re.made.diff.added.map(a => a.id), q.risk, q.checks], [c.expect.rebased.original, c.expect.rebased.added, c.expect.rebased.risk, c.expect.rebased.checks]);
      const a = await acceptProposal(re.state, c.input.accept.id, evaluate, { leaveOut: c.input.accept.leave_out }); assert.ok('state' in a, JSON.stringify(a));
      assert.deepEqual([a.state.doc.nodes.map(n => n.kind), a.leftOut, a.state.doc.history!.map(h => h.kind)], [c.expect.accepted.kinds, c.expect.accepted.left_out, c.expect.accepted.history]);
      return;
    }
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

test('accept in part: a feature left out takes what depends on it; a changed one is put back as it was', async () => {
  const s0 = await stateOf(rectanglePart(40, 20, 8));
  // A hole, a fillet on the hole's rim edge (depends on it), a second box, and the plate made 10 tall.
  const ops = [HOLE, { tool: 'add_features', args: { features: [{ kind: 'sketch', profile: 'rectangle', min: [50, 0], max: [60, 10] }, { kind: 'extrude', sketch: 3, height: 5 }] } },
    { tool: 'edit_feature', args: { index: 1, values: { h: 10 } } }];
  const r = await runTool(s0, 'propose', { title: 'three things', ops }, evaluate);
  assert.ok(!r.isError, r.content);
  const s = r.state, ghost = await previewProposal(s, 'P1', evaluate); assert.ok('doc' in ghost);
  const parts = proposalParts(s.doc, ghost.doc);
  assert.deepEqual(parts.map(q => [q.id, q.kind]), [['n2', 'added'], ['n4', 'added'], ['n1', 'changed']]);
  assert.deepEqual(leaveOutClosure(parts, ['n2']), ['n2']);
  // Without the hole: the box and the taller plate.
  const a = await acceptProposal(s, 'P1', evaluate, { leaveOut: ['n2'] });
  assert.ok('state' in a, JSON.stringify(a));
  assert.deepEqual(a.leftOut, ['n2']);
  assert.ok(!a.state.doc.nodes.some(n => n.kind === 'hole'));
  assert.equal(a.state.bodies.reduce((m, b) => Math.max(m, b.mesh.bounds.max[2]), 0), 10);
  assert.deepEqual(a.state.doc.proposals![0].decided!.left_out, ['n2']);
  // Without the edit: the plate put back as it was (8 tall), the hole and box kept.
  const b = await acceptProposal(s, 'P1', evaluate, { leaveOut: ['n1'] });
  assert.ok('state' in b, JSON.stringify(b));
  assert.equal(b.state.bodies.find(x => x.key !== 'b4')!.mesh.bounds.max[2], 8);
  assert.ok(b.state.doc.nodes.some(n => n.kind === 'hole'));
  assert.ok('error' in await acceptProposal(s, 'P1', evaluate, { leaveOut: ['n9'] }), 'not a part of it');
  // A parent left out unticks its children: a fillet on the new box's edge goes with the box.
  const withFillet = [...ops, { tool: 'run_command', args: { command: 'fillet', edges: ['n4.side0|n4.side1'], values: { radius: 1 } } }];
  const s2 = (await runTool(s0, 'propose', { title: 'with a fillet', ops: withFillet }, evaluate)).state;
  const g2 = await previewProposal(s2, 'P1', evaluate); assert.ok('doc' in g2);
  const parts2 = proposalParts(s2.doc, g2.doc);
  assert.deepEqual(parts2.find(q => q.id === 'n4')!.children, ['n5']);
  assert.deepEqual(leaveOutClosure(parts2, ['n4']), ['n4', 'n5']);
  const c = await acceptProposal(s2, 'P1', evaluate, { leaveOut: ['n4'] });
  assert.ok('state' in c, JSON.stringify(c));
  assert.deepEqual(c.leftOut, ['n4', 'n5']);
  assert.ok(!c.state.doc.nodes.some(n => n.kind === 'fillet'));
});

test('autonomy: L1 only proposes; L2 leaves proposals to the user; L3 accepts low or medium risk; L4 anything breaking no hard requirement; approval reasons are always the user\'s', async () => {
  const s0 = await stateOf(rectanglePart(40, 20, 8));
  const was = process.env.CAD_AUTONOMY;
  try {
    process.env.CAD_AUTONOMY = '1';
    const refused = await runTool(s0, 'run_command', HOLE.args, evaluate);
    assert.ok(refused.isError); assert.match(parse(refused.content).error, /L1 the agent only proposes/);
    assert.ok(!(await runTool(s0, 'apply_ops', { ops: [HOLE], dryRun: true }, evaluate)).isError, 'a dry run changes nothing');
    assert.ok(!(await runTool(s0, 'set_requirements', { requirements: [R1] }, evaluate)).isError, 'requirements are the brief');
    const prop = await runTool(s0, 'propose', { title: 'hole', ops: [HOLE] }, evaluate);
    assert.ok(!prop.isError);
    assert.match(parse((await runTool(prop.state, 'accept_proposal', { id: 'P1' }, evaluate)).content).error, /L1 the user accepts/);
    process.env.CAD_AUTONOMY = '2';
    assert.ok((await runTool(prop.state, 'accept_proposal', { id: 'P1' }, evaluate)).isError);
    process.env.CAD_AUTONOMY = '3';
    const ok = await runTool(prop.state, 'accept_proposal', { id: 'P1' }, evaluate);
    assert.ok(!ok.isError, ok.content);
    assert.deepEqual([ok.state.doc.nodes.length, ok.state.doc.proposals![0].decided!.by, ok.state.doc.history!.at(-1)!.by.agent], [3, 'chat', 'chat']);
    // Stale: the first call rebases and shows it, the second accepts.
    let st = (await runTool(s0, 'propose', { title: 'a', ops: [HOLE] }, evaluate)).state;
    st = (await runTool(st, 'propose', { title: 'b', ops: [{ ...HOLE, args: { ...HOLE.args, values: { d: 4, x: 30, y: 10 } } }] }, evaluate)).state;
    st = (await runTool(st, 'accept_proposal', { id: 'P1' }, evaluate)).state;
    const first = await runTool(st, 'accept_proposal', { id: 'P2' }, evaluate), f = parse(first.content);
    assert.ok(!first.isError, first.content);
    assert.deepEqual([f.rebased, f.accepted, f.may_accept, first.state.doc.nodes.length], ['P2', false, true, 3]);
    const second = await runTool(first.state, 'accept_proposal', { id: 'P2' }, evaluate);
    assert.ok(!second.isError, second.content); assert.equal(second.state.doc.nodes.length, 4);
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
  // The rules themselves.
  const base = { id: 'P1', title: 't', status: 'open' as const, by: { agent: 'chat' }, at: 't', base: '0', ops: [], summary: '' };
  const risk = (level: 'low' | 'medium' | 'high', extra = {}) => ({ level, features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [], ...extra });
  assert.equal(agentMayNotAccept({ ...base, risk: risk('medium') }, 3), null);
  assert.match(agentMayNotAccept({ ...base, risk: risk('high') }, 3)!, /L3/);
  assert.equal(agentMayNotAccept({ ...base, risk: risk('high', { hard_requirements_changed: ['R2'] }), checks: { before: { pass: 0, fail: 1, unknown: 0 }, after: { pass: 1, fail: 0, unknown: 0 }, newly_failing: [], newly_passing: ['R2'] } }, 4), null, 'L4: a hard requirement newly passing');
  assert.match(agentMayNotAccept({ ...base, risk: risk('high', { hard_requirements_changed: ['R2'] }), checks: { before: { pass: 1, fail: 0, unknown: 0 }, after: { pass: 0, fail: 1, unknown: 0 }, newly_failing: ['R2'], newly_passing: [] } }, 4)!, /breaks hard requirement R2/);
  assert.match(agentMayNotAccept({ ...base, risk: risk('low', { approval: ['drawing'] }) }, 4)!, /always needs the user/);
  assert.match(agentMayNotAccept({ ...base, risk: risk('medium'), rebased: { original: 'a', from: 'a', at: 't', risk_was: risk('low') } }, 4)!, /rebased and its risk rose/);
  assert.equal(agentMayNotAccept({ ...base, risk: risk('low'), rebased: { original: 'a', from: 'a', at: 't', risk_was: risk('medium') } }, 3), null);
});

test('autonomy L2, the owner\'s option b (D41): values of one feature or of parameters apply directly; more features, a new feature, a reference change or a broken hard requirement in the turn become a proposal', async () => {
  // The turn's base: a 40 × 20 × 8 box with a Ø6 hole, and R1 (40 long, hard) passing.
  const made = await dispatchTool(await stateOf(rectanglePart(40, 20, 8)), HOLE.tool, HOLE.args, evaluate);
  const s0: ChatState = { ...made.state, doc: { ...made.state.doc, requirements: [R1] as StudioDoc['requirements'] } };
  const turn: ChatState = { ...s0, turnBase: s0.doc };
  const was = process.env.CAD_AUTONOMY;
  try {
    process.env.CAD_AUTONOMY = '2';
    // A value of one feature (the hole's diameter): applied.
    const dia = await runTool(turn, 'edit_feature', { index: 2, values: { dia: 8 } }, evaluate);
    assert.ok(!dia.isError, dia.content); assert.equal((dia.state.doc.nodes[2] as { radius: number }).radius, 4);
    // The same feature again in the turn: still one feature.
    const again = await runTool(dia.state, 'edit_feature', { index: 2, values: { dia: 7 } }, evaluate);
    assert.ok(!again.isError, again.content);
    // A second feature in the same turn (the box's height): the turn now touches two, so a proposal.
    const second = await runTool(again.state, 'edit_feature', { index: 1, values: { h: 10 } }, evaluate), e2 = parse(second.content);
    assert.ok(second.isError); assert.equal(e2.code, 'needs_proposal'); assert.match(e2.error, /changes 2 features/);
    assert.equal(second.state, again.state, 'the part is unchanged');
    // The box alone: its sketch and its extrude are one feature (width and height together) — applied.
    const box = await runTool(turn, 'edit_feature', { index: 1, values: { h: 10, d: 25 } }, evaluate);
    assert.ok(!box.isError, box.content);
    // Unless it breaks a hard requirement that passed at the turn's start (R1: 40 long).
    const wide = await runTool(turn, 'edit_feature', { index: 1, values: { w: 50 } }, evaluate);
    assert.ok(wide.isError); assert.match(parse(wide.content).error, /hard requirement R1 failing/);
    // A new feature, or two edits in one batch: proposals.
    const hole = await runTool(turn, HOLE.tool, { ...HOLE.args, values: { d: 4, x: 30, y: 10 } }, evaluate);
    assert.ok(hole.isError); assert.match(parse(hole.content).error, /adds 1 feature/);
    const batch = await runTool(turn, 'apply_ops', { ops: [{ tool: 'edit_feature', args: { index: 2, values: { dia: 5 } } }, { tool: 'edit_feature', args: { index: 1, values: { h: 9 } } }] }, evaluate);
    assert.ok(batch.isError); assert.match(parse(batch.content).error, /changes 2 features/);
    // Proposing it is how: the part unchanged, the proposal open for the user.
    const prop = await runTool(turn, 'propose', { title: 'another hole', ops: [{ ...HOLE, args: { ...HOLE.args, values: { d: 4, x: 30, y: 10 } } }] }, evaluate);
    assert.ok(!prop.isError, prop.content); assert.equal(prop.state.doc.nodes.length, 3);
    // The owner's exception: a turn starting on an empty part builds it directly, as many features as it takes.
    const blank: ChatState = { doc: emptyDoc(), bodies: [] };
    const firstBox = await runTool({ ...blank, turnBase: blank.doc }, 'run_command', { command: 'box', values: { w: 40, d: 20, h: 8, x: 0, y: 0, z: 0 } }, evaluate);
    assert.ok(!firstBox.isError, firstBox.content);
    const more = await runTool(firstBox.state, HOLE.tool, HOLE.args, evaluate);
    assert.ok(!more.isError, more.content); assert.equal(more.state.doc.nodes.length, 3);
    // The next turn starts from that part: a new feature is a proposal again.
    const next = await runTool({ ...more.state, turnBase: more.state.doc }, HOLE.tool, { ...HOLE.args, values: { d: 4, x: 30, y: 10 } }, evaluate);
    assert.ok(next.isError); assert.equal(parse(next.content).code, 'needs_proposal');
    // L3 changes the part as before.
    process.env.CAD_AUTONOMY = '3';
    assert.ok(!(await runTool(turn, HOLE.tool, { ...HOLE.args, values: { d: 4, x: 30, y: 10 } }, evaluate)).isError);
  } finally { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }
});
