import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { bomView, deriveBom } from '../src/team/assembly';
import { draftBaseline, moveBaseline, readBaselines, verifyBaseline } from '../src/team/baseline';
import { digestOf, partDigests, sha256Hex, sha256Text } from '../src/team/digest';
import { decideEcr, openEcr, readEcrs, userToken, verifyEcrPin } from '../src/team/ecr';
import { readInterfaces } from '../src/team/parts';
import { canonical } from '../src/team/team';
import { runPartsScenario, type PartsScenario } from '../src/team/scripted';

// A8.4b (O32's addendum, O39): approval baselines pinned by content digest. The BOM and interfaces by the SHA-256 of
// their canonical JSON, every part's revision by its own; draft → review → approved | rejected by the user's token only;
// decided, never written again — a later change is a new baseline with the old as its parent, and the old still
// verifies. Tampering is found on read-back, each field named. An approved ECR pins what it approved.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a8/scenarios');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const clean = async () => (await runPartsScenario(JSON.parse(readFileSync(join(CASES, 'parts-clean.json'), 'utf8')) as PartsScenario, evaluate)).final;
const user = (at = '2026-10-20T12:00:00Z') => userToken(at);
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
async function drafted(doc: StudioDoc, parent?: string) { const view = await bomView(doc, evaluate); return draftBaseline(doc, deriveBom(view), view, parent ? { parent } : {}); }
async function approved(doc: StudioDoc, parent?: string) {
  const d = await drafted(doc, parent), r = moveBaseline(d.doc, d.baseline.id, 'review', user());
  return moveBaseline(r.doc, d.baseline.id, 'approved', user());
}

test('the digest: SHA-256, as node:crypto gives it, across the padding boundaries and UTF-8; of the canonical JSON', () => {
  const texts = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(63), 'a'.repeat(64), 'a'.repeat(119), 'a'.repeat(1000), 'Ø4 holes · 2.7 g/cm³ · 승인 기준선 · 🔩'];
  for (const t of texts) assert.equal(sha256Text(t), createHash('sha256').update(t, 'utf8').digest('hex'), JSON.stringify(t.slice(0, 20)));
  const big = new Uint8Array(1 << 20); for (let i = 0; i < big.length; i++) big[i] = (i * 31 + 7) & 255;
  assert.equal(sha256Hex(big), createHash('sha256').update(big).digest('hex'));
  // (Key order does not change a digest; a value does.)
  assert.equal(digestOf({ a: 1, b: [2, { c: 3, d: 4 }] }), digestOf({ b: [2, { d: 4, c: 3 }], a: 1 }));
  assert.notEqual(digestOf({ a: 1 }), digestOf({ a: 1.0000001 }));
  assert.equal(digestOf({ a: 1, b: undefined }), sha256Text(canonical({ a: 1 })));
});

test('a BOM baseline: drafted, sent to review and approved by the user only, in order; pinned and intact; frozen once decided', async () => {
  const doc = await clean(), d = await drafted(doc);
  assert.equal(d.baseline.state, 'draft'); assert.equal(d.baseline.parent, null);
  assert.deepEqual(Object.keys(d.baseline.pins.parts), ['p1', 'p2']); assert.match(d.baseline.pins.bom, /^[0-9a-f]{64}$/);
  assert.equal(d.baseline.pins.interfaces, digestOf(readInterfaces(doc.interfaces)));
  // (An agent's move, and a value claiming to be the user's, refused; out of order refused.)
  assert.throws(() => moveBaseline(d.doc, 'BL1', 'review', { by: 'bom', at: 't' }), /APPROVAL_IS_THE_USERS/);
  for (const forged of [{ by: 'user', at: 't' }, copy(user()), Object.freeze({ by: 'user' as const, at: 't' })]) assert.throws(() => moveBaseline(d.doc, 'BL1', 'review', forged), /APPROVAL_IS_THE_USERS/);
  assert.throws(() => moveBaseline(d.doc, 'BL1', 'approved', user()), /BAD_TRANSITION.*draft: it moves to review/);
  const a = await approved(doc);
  assert.equal(a.baseline.state, 'approved'); assert.deepEqual(a.baseline.moves.map(m => m.to), ['review', 'approved']);
  assert.deepEqual(verifyBaseline(a.doc, 'BL1'), { intact: true, mismatches: [], current: true, changed: [] });
  for (const to of ['review', 'approved', 'rejected'] as const) assert.throws(() => moveBaseline(a.doc, 'BL1', to, user()), /BASELINE_FROZEN.*draft a new baseline with BL1 as its parent/);
  // (Rejected is decided too.)
  const r0 = await drafted(doc), r1 = moveBaseline(r0.doc, 'BL1', 'review', user()), rj = moveBaseline(r1.doc, 'BL1', 'rejected', user());
  assert.equal(rj.baseline.state, 'rejected'); assert.throws(() => moveBaseline(rj.doc, 'BL1', 'approved', user()), /BASELINE_FROZEN/);
  // (A BOM that does not match the assembly is never drafted.)
  const view = await bomView(doc, evaluate), bom = deriveBom(view);
  assert.throws(() => draftBaseline(doc, { ...bom, lines: bom.lines.slice(1) }, view), /BOM_INVALID.*p1 \(bracket\) is on 0 lines/);
});

test('tampering found on read-back, each named: a BOM quantity, the state, the interfaces, a pin, the parent\'s content', async () => {
  const doc = await clean(), one = await approved(doc);
  // (A later change: the board moved, a second baseline on it with BL1 as its parent.)
  const moved: StudioDoc = { ...one.doc, instances: one.doc.instances!.map(i => (i.id === 'p2' ? { ...i, position: [0, 0, 24] as [number, number, number] } : i)) };
  const two = await approved(moved, 'BL1');
  assert.deepEqual(verifyBaseline(two.doc, 'BL2'), { intact: true, mismatches: [], current: true, changed: [] });
  const tamper = (edit: (log: ReturnType<typeof readBaselines>) => void) => { const d = copy(two.doc); edit(readBaselines(d.baselines)); return verifyBaseline(d, 'BL2'); };
  assert.deepEqual(tamper(l => { l.baselines[1].content.bom.lines[0].qty = 2; }).mismatches, ['BL2: content.bom', 'BL2: record']);
  assert.deepEqual(tamper(l => { l.baselines[1].state = 'review'; }).mismatches, ['BL2: record']);
  assert.deepEqual(tamper(l => { l.baselines[1].content.interfaces.budgets.massG = 1e6; }).mismatches, ['BL2: content.interfaces', 'BL2: record']);
  assert.deepEqual(tamper(l => { l.baselines[1].pins.parts.p2 = l.baselines[1].pins.parts.p1; }).mismatches, ['BL2: record']);
  // (The parent's content changed, and its pins and digest rewritten to match: the child's parent digest still catches it.)
  const parent = tamper(l => {
    const p = l.baselines[0]; p.content.bom.lines[0].massG += 1; p.pins.bom = digestOf(p.content.bom);
    const { digest: _d, ...rest } = p; void _d; p.digest = digestOf(rest);
  });
  assert.deepEqual(parent.mismatches, ['BL2: parent BL1']);
  assert.deepEqual(tamper(l => { l.baselines.splice(0, 1); }).mismatches, ['BL2: parent BL1 missing']);
});

test('a change after approval: the baseline intact but not current, the part named; a new baseline with it as parent; the old still verifies', async () => {
  const doc = await clean(), one = await approved(doc);
  const moved: StudioDoc = { ...one.doc, instances: one.doc.instances!.map(i => (i.id === 'p2' ? { ...i, position: [0, 0, 24] as [number, number, number] } : i)) };
  assert.deepEqual(verifyBaseline(moved, 'BL1'), { intact: true, mismatches: [], current: false, changed: ['part p2'] });
  // (A draft made before the change cannot be approved after it.)
  const early = await drafted(doc), sent = moveBaseline(early.doc, 'BL1', 'review', user());
  const later: StudioDoc = { ...sent.doc, instances: moved.instances };
  assert.throws(() => moveBaseline(later, 'BL1', 'approved', user()), /STALE_BASELINE.*part p2 changed since/);
  // (A draft cannot follow a draft.)
  const v0 = await bomView(doc, evaluate);
  assert.throws(() => draftBaseline(early.doc, early.baseline.content.bom, v0, { parent: 'BL1' }), /BAD_TRANSITION.*BL1 is still draft/);
  const two = await approved(moved, 'BL1');
  assert.equal(two.baseline.parent, 'BL1'); assert.equal(two.baseline.parentDigest, readBaselines(one.doc.baselines).baselines[0].digest);
  assert.notEqual(two.baseline.pins.parts.p2, one.baseline.pins.parts.p2); assert.equal(two.baseline.pins.parts.p1, one.baseline.pins.parts.p1);
  assert.deepEqual(verifyBaseline(two.doc, 'BL2'), { intact: true, mismatches: [], current: true, changed: [] });
  assert.deepEqual(verifyBaseline(two.doc, 'BL1'), { intact: true, mismatches: [], current: false, changed: ['part p2'] });
  // (The old record is exactly what was approved: byte for byte.)
  assert.equal(JSON.stringify(readBaselines(two.doc.baselines).baselines[0]), JSON.stringify(one.baseline));
  // (A part added, or one gone, named so.)
  const fewer: StudioDoc = { ...two.doc, instances: two.doc.instances!.filter(i => i.id !== 'p1') };
  assert.deepEqual(verifyBaseline(fewer, 'BL2').changed, ['part p1 (gone)']);
});

test('an approved ECR pins the interfaces it approved and the part revisions it was approved against; a tampered one caught', async () => {
  const doc = await clean(), ifc = readInterfaces(doc.interfaces);
  const next = { ...ifc, holePatterns: ifc.holePatterns.map(p => ({ ...p, positions: p.positions.map(q => [q[0] + 2, q[1], q[2]] as [number, number, number]) })) };
  const o = openEcr(doc, 'architect', next), ok = decideEcr(o.doc, o.ecr.id, true, user(), new Map());
  assert.deepEqual(ok.ecr.pin && { interfaces: ok.ecr.pin.interfaces, parts: ok.ecr.pin.parts }, { interfaces: digestOf(next), parts: partDigests(doc) });
  assert.deepEqual(verifyEcrPin(readEcrs(ok.doc.ecrs).ecrs[0]), []);
  const bad = copy(readEcrs(ok.doc.ecrs).ecrs[0]); bad.next.holePatterns[0].diameter = 5;
  assert.deepEqual(verifyEcrPin(bad), ['ECR1: next', 'ECR1: record']);
  const flipped = copy(readEcrs(ok.doc.ecrs).ecrs[0]); flipped.impact.parts = [];
  assert.deepEqual(verifyEcrPin(flipped), ['ECR1: record']);
  // (Rejected: nothing approved, nothing pinned.)
  const no = decideEcr(o.doc, o.ecr.id, false, user(), new Map());
  assert.equal(no.ecr.pin, undefined); assert.deepEqual(verifyEcrPin(no.ecr), []);
});
