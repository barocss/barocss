import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { readDuty, treeOfDoc } from '@barocss/cad-model/chat/robot';
import { dutyJson, type PublicDuty, type PublicHarnessReport } from '@barocss/cad-model/robot/reports';
import * as L3 from '../server/robotL3/main';
import { robotCheckCall, robotCheckListed, withRatings } from '../server/robotL3/tool';

const conformance = resolve(process.cwd(), '../../packages/barocss-cad/conformance');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function fixture() {
  const s = L3.start(conformance), e = await evaluate(s.doc);
  assert.ok(e.ok);
  const tree = await treeOfDoc(s.doc, e.bodies, evaluate);
  return { ...s, bodies: e.bodies, tree, canonical: dutyJson(tree, s.duty) };
}
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-9, `${a} != ${b}`);
function publicReport(r: PublicHarnessReport) {
  assert.ok(r.margins.some(m => m.unit === 'N·mm'));
  assert.ok(r.margins.every(m => !['rad', 'rad/s', 'N·m', 'rpm', 'h'].includes(m.unit)));
  assert.ok(r.consistency.length > 0);
  assert.ok(r.consistency.every(c => 'errorRatio' in c && c.limitRatio === 1 && !('value' in c) && !('tol' in c)));
}

test('L3 start preserves 1 rad/s and 1 Nm internally; prompt and help use public degree, Nmm and seconds', async () => {
  const f = await fixture(), before = JSON.stringify(f.doc);
  for (const key of ['base~l1', 'l1~l2', 'l2~l3']) {
    close(f.doc.robot!.joints![key].velocity!, 57.29577951308232);
    assert.equal(f.doc.robot!.joints![key].effort, 1000);
    close(f.tree.joints.find(j => j.key === key)!.limit!.velocity!, 1);
    close(f.tree.joints.find(j => j.key === key)!.limit!.effort!, 1);
  }
  assert.equal(f.canonical.serviceLife, 72000000);
  assert.equal(f.canonical.moves[0].dwell, 0.5);
  assert.equal(f.canonical.moves[0].to['base~l1'], 57.295779513);
  close(f.canonical.moves[0].joint_limits['base~l1'].velocity, 343.77467707849394);
  close(f.canonical.moves[0].joint_limits['base~l1'].acceleration, 3437.7467707849396);
  const text = L3.prompt(f.canonical);
  assert.ok(text.includes(JSON.stringify(f.canonical)));
  assert.match(text, /1700 g/);
  assert.match(robotCheckListed().description, /degree\/s/);
  assert.match(robotCheckListed().description, /N·mm/);
  assert.match(robotCheckListed().description, /serviceLife/);
  assert.doesNotMatch(robotCheckListed().description, /rad\/s|life_h/);
  assert.equal(JSON.stringify(f.doc), before);
});

test('L3 local tool projects original harness and preserves validated canonical numbers through file reuse and refusals', async () => {
  const f = await fixture(), before = JSON.stringify(f.doc), dir = mkdtempSync(join(tmpdir(), 'l3-contract-'));
  const keys = ['CAD_ROBOT_L3_DUTY', 'CAD_ROBOT_L3_LOG'], was = keys.map(k => process.env[k]);
  const path = join(dir, 'duty.json'), log = join(dir, 'checks.jsonl');
  Object.assign(process.env, { CAD_ROBOT_L3_DUTY: path, CAD_ROBOT_L3_LOG: log });
  try {
    const raw = structuredClone(f.canonical);
    raw.moves[0].to['base~l1'] = 57.29577951300001;
    const parsed = readDuty(f.tree, raw); assert.ok(!('error' in parsed));
    assert.notEqual(dutyJson(f.tree, parsed).moves[0].to['base~l1'], raw.moves[0].to['base~l1'], 'fixture detects a lossy second projection');
    const first = await robotCheckCall(f.doc, f.bodies, evaluate, { duty: raw });
    assert.equal(first.isError, false, first.text);
    const report: PublicHarnessReport = JSON.parse(first.text); publicReport(report);
    assert.equal(report.ok, false, 'the undersized start remains undersized');
    assert.equal(report.margins.find(m => m.check === 'joint effort' && m.joint === 'l1~l2')!.limit, 1000);
    close(report.margins.find(m => m.check === 'joint velocity' && m.joint === 'l1~l2')!.limit!, 57.295779513);
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), raw);
    const second = await robotCheckCall(f.doc, f.bodies, evaluate, {});
    assert.equal(second.isError, false); assert.equal(second.text, first.text);
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), raw);
    assert.equal(readFileSync(log, 'utf8').trim().split('\n').length, 2);
    const saved = readFileSync(path, 'utf8'), records = readFileSync(log, 'utf8');
    for (const duty of [f.duty, { ...raw, serviceLife: -1 }, { ...raw, moves: [{ ...raw.moves[0], dwell_s: 0.5 }] }]) {
      const refused = await robotCheckCall(f.doc, f.bodies, evaluate, { duty });
      assert.equal(refused.isError, true); assert.match(refused.text, /duty:/);
    }
    assert.equal((await robotCheckCall(f.doc, f.bodies, evaluate, { duty: raw, joints: { 'base~l1': { effort: 0 } } })).isError, true);
    assert.equal(readFileSync(path, 'utf8'), saved); assert.equal(readFileSync(log, 'utf8'), records);
    assert.equal(JSON.stringify(f.doc), before);
  } finally {
    keys.forEach((k, i) => { if (was[i] === undefined) delete process.env[k]; else process.env[k] = was[i]; });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('L3 real sizer script supplies two canonical calls; local tool saves a brief-preserving design that a fresh CLI checks', async t => {
  const f = await fixture();
  assert.equal(typeof L3.sizerScript, 'function');
  const script = await L3.sizerScript(f);
  assert.ok(script.startsWith('script '));
  const { calls } = JSON.parse(script.slice(7)) as { calls: { tool: string; args: { duty: PublicDuty; joints?: Record<string, { velocity: number; effort: number }> } }[] };
  assert.equal(calls.length, 2); assert.ok(calls.every(c => c.tool === 'robot_check'));
  assert.deepEqual(calls[0].args.duty, f.canonical);
  for (const c of calls) {
    assert.ok(!('error' in readDuty(f.tree, c.args.duty)));
    assert.equal(L3.keepsBrief(c.args.duty, f.canonical), null);
  }
  const dir = mkdtempSync(join(tmpdir(), 'l3-fresh-')), path = join(dir, 'duty.json');
  const wasDuty = process.env.CAD_ROBOT_L3_DUTY, wasLog = process.env.CAD_ROBOT_L3_LOG;
  process.env.CAD_ROBOT_L3_DUTY = path; delete process.env.CAD_ROBOT_L3_LOG;
  try {
    for (const [i, c] of calls.entries()) {
      const reply = await robotCheckCall(f.doc, f.bodies, evaluate, c.args);
      assert.equal(reply.isError, false, reply.text);
      const report: PublicHarnessReport = JSON.parse(reply.text); publicReport(report);
      assert.equal(report.ok, i === 1, JSON.stringify(report.least));
    }
    const saved = JSON.parse(readFileSync(path, 'utf8')) as PublicDuty;
    assert.deepEqual(saved, calls[1].args.duty);
    assert.equal(L3.keepsBrief(saved, f.canonical), null);
    const ratings = JSON.parse(readFileSync(join(dir, 'duty.joints.json'), 'utf8'));
    const part = join(dir, 'sized.bcad'); writeFileSync(part, encodeStudioFile(withRatings(f.doc, ratings)));
    const fresh = await new Promise<{ code: number | null; stdout: string; stderr: string }>(res => execFile(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), 'robot-check', part, path], { encoding: 'utf8', maxBuffer: 64 << 20 }, (e, stdout, stderr) => res({ code: e ? typeof e.code === 'number' ? e.code : null : 0, stdout, stderr })));
    assert.equal(fresh.code, 0, fresh.stderr + fresh.stdout);
    const report: PublicHarnessReport = JSON.parse(fresh.stdout); assert.equal(report.ok, true); publicReport(report);
    t.diagnostic(`fresh local CLI exit=${fresh.code}, margins=${report.margins.length}, serviceLife=${saved.serviceLife}; no model or budget run`);
  } finally {
    if (wasDuty === undefined) delete process.env.CAD_ROBOT_L3_DUTY; else process.env.CAD_ROBOT_L3_DUTY = wasDuty;
    if (wasLog === undefined) delete process.env.CAD_ROBOT_L3_LOG; else process.env.CAD_ROBOT_L3_LOG = wasLog;
    rmSync(dir, { recursive: true, force: true });
  }
});
