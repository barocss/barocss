import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { metricsOf, type Labelled } from '../src/team/metrics';
import { runPartsScenario, runScenario, type PartsScenario, type Scenario } from '../src/team/scripted';
import { cliMain } from '../server/cadCli';

// A8.5 (O37): per-role precision and recall on the seeded defects. Every detector over the A7 and A8 scenarios against
// their labels — the scripted roles at 1.0 and 1.0, the confusion counts as computed; the metric itself checked on
// mislabels (a miss, a defect past a detector that never ran) and on a Verifier that rejects everything (false alarms).

const ROOT = resolve(process.cwd(), '../../packages/barocss-cad/conformance');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
type Sc = (Scenario | PartsScenario) & { expect: { seeded?: (string | string[] | null)[] } };
async function runsOf(edit?: (sc: Sc) => Sc): Promise<Labelled[]> {
  const out: Labelled[] = [];
  for (const dir of ['a7', 'a8']) for (const f of readdirSync(join(ROOT, dir)).filter(n => n.endsWith('.json')).sort()) {
    let sc = JSON.parse(readFileSync(join(ROOT, dir, f), 'utf8')) as Sc; if (!sc.expect?.seeded) continue;
    if (edit) sc = edit(sc);
    const traces = 'architect' in sc ? (await runPartsScenario(sc as PartsScenario, evaluate)).traces : (await runScenario(sc as Scenario, evaluate)).traces;
    out.push({ case: sc.case, traces, seeded: sc.expect.seeded! });
  }
  return out;
}

test('the scripted roles on the seeded defects: every detector at precision 1 and recall 1; the counts', async () => {
  const runs = await runsOf(), m = metricsOf(runs);
  assert.equal(runs.length, 29);
  const table = Object.fromEntries(m.map(x => [x.detector, [x.tp, x.fp, x.fn, x.tn]]));
  assert.deepEqual(table, {
    analysis: [2, 0, 0, 17], assembly: [2, 0, 0, 5], contract: [3, 0, 0, 7], dfm: [1, 0, 0, 23], interfaces: [1, 0, 0, 24], interference: [3, 0, 0, 24],
    lease: [5, 0, 0, 10], 'reviewer-analysis': [3, 0, 0, 6], 'reviewer-dfm': [5, 0, 0, 4], validity: [4, 0, 0, 38], verifier: [1, 0, 0, 2],
  });
  for (const x of m) { assert.equal(x.precision, 1, x.detector); assert.equal(x.recall, 1, x.detector); }
});

test('the metric itself: a mislabel is a miss and a false alarm; a defect past a detector that never ran is a miss; a Verifier rejecting all, false alarms', async () => {
  // (clean-run's design patch labelled an interference defect: interference misses it.)
  const mis = metricsOf(await runsOf(sc => (sc.case === 'clean-run' ? { ...sc, expect: { ...sc.expect, seeded: [null, 'interference'] } } : sc)));
  const i = mis.find(x => x.detector === 'interference')!;
  assert.deepEqual([i.tp, i.fn, i.misses], [3, 1, ['clean-run #1']]); assert.equal(i.recall, 0.75);
  // (op-refused's defect labelled for analysis, a gate the validity fail never let it reach: a miss, "not run".)
  const nr = metricsOf(await runsOf(sc => (sc.case === 'op-refused' ? { ...sc, expect: { ...sc.expect, seeded: [null, null, 'analysis'] } } : sc)));
  const a = nr.find(x => x.detector === 'analysis')!, v = nr.find(x => x.detector === 'validity')!;
  assert.ok(a.misses.includes('op-refused #2 (not run)')); assert.ok(v.falseAlarms.includes('op-refused #2'), 'validity flagged a patch now labelled for another detector');
  // (A Verifier that rejects every patch: false alarms on the clean ones.)
  const harsh = metricsOf(await runsOf(sc => (!('architect' in sc) && (sc as Scenario).verifier ? { ...sc, verifier: { ...(sc as Scenario).verifier!, rules: [{ kind: 'max_mass_g', value: 0 }] } } as Sc : sc)));
  const ver = harsh.find(x => x.detector === 'verifier')!;
  assert.ok(ver.fp >= 1 && ver.precision! < 1, JSON.stringify(ver));
});

test('cad-cli team --metrics prints the same table', async () => {
  let text = ''; const io = { stdout: new Writable({ write(c, _e, cb) { text += c; cb(); } }), stderr: new Writable({ write(_c, _e, cb) { cb(); } }) };
  assert.equal(await cliMain(['team', '--metrics', join(ROOT, 'a7'), join(ROOT, 'a8')], io), 0);
  const j = JSON.parse(text);
  assert.equal(j.scenarios, 29); assert.ok(j.detectors.every((x: { precision: number; recall: number }) => x.precision === 1 && x.recall === 1));
});
