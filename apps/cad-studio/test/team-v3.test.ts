import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { holesOff, interfacesRevision, placedBodies, readInterfaces } from '@barocss/cad-model/team/parts';
import { partsSummary, runPartsScenario, type PartsScenario } from '@barocss/cad-model/team/scripted';

// A8.2 (O34): the Architect's interfaces and Part agents under leases. The v3 scenarios (conformance/a8, step A8.2): each
// refusal typed at its gate — lease (NO_LEASE, LEASE_EXPIRED, CONTRACT_MOVED, OUT_OF_PART) or contract (OUT_OF_ENVELOPE,
// HOLE_OFF_PATTERN, OVER_BUDGET) — the clean run applied; byte-identical on a rerun. The hole-pattern check against
// the exact cylinders, placed.

const CASES = resolve(process.cwd(), '../../packages/barocss-cad/conformance/a8/scenarios');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
type Expect = { decisions: string[]; stops: ([string, string] | null)[] };
const load = (f: string) => JSON.parse(readFileSync(join(CASES, f), 'utf8')) as PartsScenario & { expect: Expect };

test('the v3 part scenarios: leases and contracts, each refusal at its gate, typed; the later gates not reached; byte-identical on a rerun', async () => {
  const files = readdirSync(CASES).filter(f => f.endsWith('.json') && JSON.parse(readFileSync(join(CASES, f), 'utf8')).step === 'A8.2');
  assert.ok(files.length >= 8, files.join());
  for (const f of files) {
    const sc = load(f), run = await runPartsScenario(sc, evaluate), out = JSON.stringify(partsSummary(run));
    assert.deepEqual(run.traces.map(t => t.decision), sc.expect.decisions, `${sc.case}: ${out.slice(0, 900)}`);
    run.traces.forEach((t, i) => {
      const want = sc.expect.stops[i], stop = t.gates.find(g => g.verdict === 'fail');
      if (!want) { assert.ok(!stop, `${sc.case} #${i}: ${JSON.stringify(stop)}`); return; }
      assert.equal(stop?.gate, want[0], `${sc.case} #${i}: ${JSON.stringify(t.gates)}`);
      assert.ok(stop!.findings.some(x => x.code === want[1]), `${sc.case} #${i}: ${JSON.stringify(stop!.findings)}`);
      for (const g of t.gates.slice(t.gates.indexOf(stop!) + 1)) assert.equal(g.verdict, 'skipped');
    });
    // (A refused patch leaves the part as it was: its revision after only when applied.)
    for (const t of run.traces) assert.equal(t.revisionAfter !== null, t.decision === 'applied');
    assert.equal(JSON.stringify(partsSummary(await runPartsScenario(sc, evaluate))), out, `${sc.case}: a rerun differs`);
  }
});

test('the clean run: both parts on the pattern (the exact cylinders, placed), inside their envelopes; the interfaces\' revision their leases name', async () => {
  const sc = load('parts-clean.json'), run = await runPartsScenario(sc, evaluate), ifc = readInterfaces(run.final.interfaces);
  assert.equal(run.accepted, 2);
  for (const id of ['p1', 'p2']) {
    const inst = run.final.instances!.find(i => i.id === id)!, bodies = await placedBodies(inst, evaluate);
    assert.deepEqual(holesOff(bodies, ifc.holePatterns[0]), [], `${id} on H1`);
    // (Moved 2 mm, the pattern is missed at both positions.)
    assert.equal(holesOff(bodies, { ...ifc.holePatterns[0], positions: ifc.holePatterns[0].positions.map(p => [p[0] + 2, p[1], p[2]] as [number, number, number]) }).length, 2);
  }
  assert.ok(run.leases.every(l => l.contract === interfacesRevision(run.final)));
  // (The board's holes at its placed height: the pattern's axis runs through them, 20 mm up.)
  const board = await placedBodies(run.final.instances!.find(i => i.id === 'p2')!, evaluate);
  assert.ok(board[0].mesh.bounds.min[2] === 20 && board[0].mesh.bounds.max[2] === 22, JSON.stringify(board[0].mesh.bounds));
});
