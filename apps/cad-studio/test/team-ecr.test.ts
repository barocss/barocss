import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import type { ChatState } from '../src/chat/tools';
import { integratePart, interfacesRevision, readInterfaces, type Interfaces, type Lease, type PartPatch } from '../src/team/parts';
import { decideEcr, openEcr, readEcrs, renewLeases, userToken } from '../src/team/ecr';
import { runPartsScenario, type PartsScenario } from '../src/team/scripted';

// A8.3 (O35): ECRs. A change to the interfaces is an ECR whose impact is computed — the parts, the requirements on a
// changed datum or keep-out, the open patches made on the old contract, the leases — and only the user decides it:
// approved, the interfaces move and the touched leases expire (the open patch is then refused CONTRACT_MOVED, until
// the Architect renews); rejected, nothing changes; an agent's decision refused.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a8');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const fixture = JSON.parse(readFileSync(join(CASES, 'ecr-move-pattern.json'), 'utf8'));

async function afterClean() {
  const sc = JSON.parse(readFileSync(join(CASES, fixture.from), 'utf8')) as PartsScenario, run = await runPartsScenario(sc, evaluate);
  const leases = new Map(run.leases.map(l => [l.part, l])), e = await evaluate(run.final);
  const state: ChatState = { doc: run.final, bodies: e?.ok ? e.bodies : [] };
  // (The board's open patch: a 1 mm chamfer-less thickening, made on the contract as it was.)
  const open: PartPatch = { id: fixture.open_patch.id, by: fixture.open_patch.by, part: fixture.open_patch.part, contract: interfacesRevision(run.final), ops: [{ tool: 'edit_feature', args: { index: 1, values: { h: 3 } } }] };
  const cur = readInterfaces(run.final.interfaces), moved: Interfaces = { ...cur, holePatterns: cur.holePatterns.map(p => (p.id === fixture.ecr.move.pattern ? { ...p, positions: p.positions.map(q => [q[0] + fixture.ecr.move.dx, q[1], q[2]] as [number, number, number]) } : p)) };
  return { state, leases, open, moved };
}

test('an ECR\'s changes and impact computed (the fixture\'s: both parts, the open patch, both leases); approved by the user it moves the interfaces and expires the leases; the open patch then CONTRACT_MOVED', async () => {
  const { state, leases, open, moved } = await afterClean(), before = interfacesRevision(state.doc);
  const { doc, ecr } = openEcr(state.doc, fixture.ecr.by, moved, { open: [open], leases, reason: 'the board vendor moved the mounting holes' });
  assert.deepEqual(ecr.changes, fixture.expect.changes); assert.deepEqual(ecr.impact, fixture.expect.impact);
  assert.equal(ecr.status, 'open'); assert.equal(interfacesRevision(doc), before, 'opening changes nothing yet');
  // (An agent may open one, not decide it.)
  assert.throws(() => decideEcr(doc, ecr.id, true, { by: 'architect', at: 't' }, leases), /APPROVAL_IS_THE_USERS/);
  const ok = decideEcr(doc, ecr.id, true, userToken('2026-10-20T12:00:00Z'), leases);
  assert.notEqual(interfacesRevision(ok.doc), before); assert.deepEqual(readInterfaces(ok.doc.interfaces), moved);
  assert.ok([...ok.leases.values()].every(l => l.expiredBy === ecr.id && l.contract === before), 'both leases left on the old contract');
  assert.deepEqual(readEcrs(ok.doc.ecrs).ecrs[0].decided, userToken('2026-10-20T12:00:00Z'));
  // (The open patch, made on the old contract: refused.)
  const st: ChatState = { ...state, doc: ok.doc }, r = await integratePart(st, open, ok.leases, evaluate, 5);
  assert.equal(r.trace.decision, fixture.expect.after_approval.open_patch);
  assert.equal(r.trace.gates[0].findings[0].code, fixture.expect.after_approval.code, JSON.stringify(r.trace.gates[0]));
  // (Renewed on the new contract, a patch on it: the board's holes are now off the moved pattern — the part must follow.)
  const renewed = renewLeases(ok.doc, ok.leases, 99), again = await integratePart(st, { ...open, contract: interfacesRevision(ok.doc) }, renewed, evaluate, 6);
  assert.equal(again.trace.decision, 'rejected'); assert.ok(again.trace.gates.find(g => g.gate === 'contract')!.findings.some(f => f.code === 'HOLE_OFF_PATTERN'));
  assert.throws(() => decideEcr(ok.doc, ecr.id, false, userToken('t'), leases), /DECIDED/);
});

test('"the user" is the channel, not a claim: a role\'s {by: "user"} and a JSON copy of a real token are refused (APPROVAL_IS_THE_USERS); only a minted token decides', async () => {
  const { state, leases, moved } = await afterClean(), { doc, ecr } = openEcr(state.doc, 'architect', moved, { leases });
  // (What a role could return: plain data, however it is labelled.)
  for (const forged of [{ by: 'user', at: 't' }, JSON.parse(JSON.stringify(userToken('t'))), Object.freeze({ by: 'user' as const, at: 't' }), { by: 'architect', at: 't' }])
    assert.throws(() => decideEcr(doc, ecr.id, true, forged, leases), /APPROVAL_IS_THE_USERS/, JSON.stringify(forged));
  assert.equal(decideEcr(doc, ecr.id, true, userToken('t'), leases).ecr.status, 'approved');
});

test('rejected, nothing changes; a stale ECR cannot be approved; an ECR with no change refused; the total budget touches every part, a removed keep-out its requirements', async () => {
  const { state, leases, moved } = await afterClean(), before = interfacesRevision(state.doc);
  const { doc, ecr } = openEcr(state.doc, 'architect', moved, { leases });
  const no = decideEcr(doc, ecr.id, false, userToken('t'), leases);
  assert.equal(interfacesRevision(no.doc), before); assert.deepEqual([...no.leases.values()], [...leases.values()]); assert.equal(readEcrs(no.doc.ecrs).ecrs[0].status, 'rejected');
  assert.throws(() => openEcr(state.doc, 'architect', readInterfaces(state.doc.interfaces)), /NO_CHANGE/);
  // (Two ECRs on one base: the second goes stale once the first is approved.)
  const a = openEcr(state.doc, 'architect', moved, { leases }), b = openEcr(a.doc, 'p1-agent', { ...readInterfaces(state.doc.interfaces), budgets: { ...readInterfaces(state.doc.interfaces).budgets, massG: 70 } }, { leases });
  assert.deepEqual(b.ecr.impact.parts, ['p1', 'p2'], 'the total budget touches every part');
  const first = decideEcr(b.doc, a.ecr.id, true, userToken('t'), leases);
  assert.throws(() => decideEcr(first.doc, b.ecr.id, true, userToken('t'), first.leases), /STALE_ECR/);
  // (An ECR on one part's envelope only: that lease left behind, the other moved to the new revision.)
  const env = readInterfaces(state.doc.interfaces), one = openEcr(state.doc, 'architect', { ...env, envelopes: env.envelopes.map(e => (e.part === 'p1' ? { ...e, max: [61, 40, 10] as [number, number, number] } : e)) }, { leases });
  const d1 = decideEcr(one.doc, one.ecr.id, true, userToken('t'), leases);
  assert.equal(d1.leases.get('p1')!.contract, before); assert.equal(d1.leases.get('p2')!.contract, interfacesRevision(d1.doc));
  // (A keep-out taken out of the interfaces: the requirements that check it are impacted.)
  const withK: StudioDoc = { ...state.doc, interfaces: { ...readInterfaces(state.doc.interfaces), keepouts: ['K1'] }, requirements: [{ id: 'KR', source: 'clear of the lid', hard: true, check: { op: '>=', query: { fn: 'keepout', keepout: 'K1' }, value: 0 } }] };
  const k = openEcr(withK, 'architect', { ...readInterfaces(withK.interfaces), keepouts: [] }, { leases: new Map<string, Lease>() });
  assert.deepEqual(k.ecr.changes, [{ item: 'keep-out K1', kind: 'removed', parts: [] }]); assert.deepEqual(k.ecr.impact.requirements, ['KR']);
});
