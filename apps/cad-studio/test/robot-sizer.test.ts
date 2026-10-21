import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { readStudioFile } from '../src/engine/container';
import { robotCheckOfDoc, robotSizeOfDoc } from '@barocss/cad-model/chat/robot';
import type { Duty } from '@barocss/cad-model/robot/harness';
import { capability } from '@barocss/cad-model/robot/sizer';
import { MOTORS, REDUCERS } from '@barocss/cad-model/robot/actuators';

// RD10 (O46, O48), the deterministic part: RD9's arm-3r taken from an undersized start — ratings too low, every joint on
// 100:1, a fast duty — to every harness margin above 0 by the scripted sizer, one change a round, each round naming the
// check that drove it; the saved design passes a fresh harness run; a brief no sizing fixes stops BRIEF_INFEASIBLE.
// The L3 run (a live model sizing the same arm with the harness as its tool) waits for the owner (O46's protocol).

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const DIR = resolve(process.cwd(), '../../packages/barocss-cad/conformance/rd/arm-3r');
async function bodiesOf(doc: StudioDoc) { const e = await evaluate(doc); assert.ok(e.ok); return e.bodies; }
function arm(): StudioDoc { const r = readStudioDoc(readFileSync(join(DIR, 'robot.bcad'), 'utf8')); assert.ok('doc' in r); return r.doc; }
const on = (ratio: number) => ({ motor: 'maxon-608131', reducer: `hd-csg-14-${ratio}-2a-r-bb-lw` });
const P1 = { 'base~l1': 1, 'l1~l2': 0.9, 'l2~l3': 0.6 }, P2 = { 'base~l1': -0.8, 'l1~l2': -1, 'l2~l3': -0.7 };
/** The brief: arm-3r between two poses, 0.5 s dwells, 20 000 h, at 6 rad/s and 60 rad/s². */
const BRIEF: Duty = { moves: [{ from: {}, to: P1, profile: 'trapezoid', limits: { velocity: 6, acceleration: 60 }, dwell_s: 0.5 }, { from: P1, to: P2, profile: 'trapezoid', limits: { velocity: 6, acceleration: 60 }, dwell_s: 0.5 }], life_h: 20000 };
function undersized(): { doc: StudioDoc; duty: Duty } {
  const doc = arm(), joints = Object.fromEntries(Object.entries(doc.robot!.joints!).map(([k, v]) => [k, { ...v, velocity: 1, effort: 1 }]));
  return { doc: { ...doc, robot: { version: 1, joints } }, duty: { ...BRIEF, actuators: { 'base~l1': on(100), 'l1~l2': on(100), 'l2~l3': on(100) } } };
}

test('from an undersized start to every margin above 0 within 10 rounds, one change a round, each naming its check; the saved design passes a fresh harness run; deterministic', async () => {
  const { doc, duty } = undersized(), before = await robotCheckOfDoc(doc, await bodiesOf(doc), evaluate, duty);
  assert.equal(before.ok, false); const failingBefore = before.margins.filter(m => !m.ok).length; assert.ok(failingBefore >= 3, String(failingBefore));
  const { sized, doc: out } = await robotSizeOfDoc(doc, await bodiesOf(doc), evaluate, duty);
  console.log(`RD10: ${failingBefore} failing margins at the start; ${sized.rounds} rounds:\n${sized.trace.map(t => `  ${t.round}. ${t.check}${t.joint ? ` ${t.joint}` : ''} (${t.margin}) → ${t.change}`).join('\n')}\n  least after: ${JSON.stringify(sized.report.least)}`);
  assert.equal(sized.ok, true, JSON.stringify(sized.stopped)); assert.ok(sized.rounds >= 1 && sized.rounds <= 10, String(sized.rounds));
  assert.ok(sized.report.margins.every(m => m.margin > 0) && !sized.report.unknowns.length);
  // (Each round's check was failing, or unknown, when it was taken: replayed round by round.)
  assert.ok(sized.trace.every(t => t.margin === null || t.margin <= 0), JSON.stringify(sized.trace));
  // (Every joint's ratings within its final actuator's capability: none rated past what its pair can give.)
  for (const [k, a] of Object.entries(sized.duty.actuators!)) {
    const cap = capability(MOTORS.find(m => m.id === a.motor)!, REDUCERS.find(r => r.id === a.reducer)!), j = out.robot!.joints![k];
    assert.ok(j.velocity! <= cap.velocity + 1e-9 && j.effort! <= cap.effort + 1e-9, `${k}: ${JSON.stringify(j)} vs ${JSON.stringify(cap)}`);
  }
  // (Saved and opened again, a fresh harness run on the sized document and duty.)
  const reopened = (readStudioDoc(JSON.stringify(out)) as { doc: StudioDoc }).doc, fresh = await robotCheckOfDoc(reopened, await bodiesOf(reopened), evaluate, sized.duty);
  assert.equal(fresh.ok, true, JSON.stringify(fresh.least)); assert.equal(JSON.stringify(fresh), JSON.stringify(sized.report));
  // (Deterministic: the same trace again.)
  assert.equal(JSON.stringify((await robotSizeOfDoc(doc, await bodiesOf(doc), evaluate, duty)).sized.trace), JSON.stringify(sized.trace));
});

test('a brief no sizing fixes stops typed: a pose past a limit, a move into the base — BRIEF_INFEASIBLE, never done; a round cap NOT_CONVERGED', async () => {
  const { doc, duty } = undersized();
  const past = (await robotSizeOfDoc(doc, await bodiesOf(doc), evaluate, { ...duty, moves: [{ ...duty.moves[0], to: { ...P1, 'base~l1': 2.7 } }] })).sized;
  // (The range failure is not the worst margin at first — the actuators and ratings are fixed first — but it is never fixed: the sizer stops on it.)
  assert.equal(past.ok, false); assert.equal(past.stopped?.code, 'BRIEF_INFEASIBLE'); assert.match(past.stopped!.why, /^joint range base~l1 fails in move 0/);
  const hit = (await robotSizeOfDoc(doc, await bodiesOf(doc), evaluate, { ...duty, moves: [{ ...duty.moves[0], to: { 'l1~l2': 1.2, 'l2~l3': 1.5 } }] })).sized;
  assert.equal(hit.stopped?.code, 'BRIEF_INFEASIBLE'); assert.match(hit.stopped!.why, /^sweep fails in move 0 \(contact base–payload/);
  const capped = (await robotSizeOfDoc(doc, await bodiesOf(doc), evaluate, duty, { maxRounds: 1 })).sized;
  assert.deepEqual([capped.ok, capped.stopped?.code, capped.rounds], [false, 'NOT_CONVERGED', 1]);
});

test('cad-cli robot-size writes the sized design and its duty; cad-cli robot-check on them exits 0 (both spawned)', async () => {
  const { doc, duty } = undersized(), tmp = mkdtempSync(join(tmpdir(), 'rd10-'));
  const run = (args: string[]) => new Promise<{ code: number; out: string; err: string }>(ok => {
    const child = spawn(process.execPath, [join(process.cwd(), 'scripts/cad-cli.mjs'), ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', e = ''; child.stdout.on('data', c => { o += c; }); child.stderr.on('data', c => { e += c; }); child.on('close', code => ok({ code: code ?? -1, out: o, err: e }));
  });
  try {
    writeFileSync(join(tmp, 'start.bcad'), JSON.stringify(doc)); writeFileSync(join(tmp, 'brief.json'), JSON.stringify(duty));
    const s = await run(['robot-size', join(tmp, 'start.bcad'), join(tmp, 'brief.json'), '-o', join(tmp, 'sized.bcad')]);
    assert.equal(s.code, 0, s.err + s.out); assert.equal(JSON.parse(s.out).ok, true);
    const c = await run(['robot-check', join(tmp, 'sized.bcad'), join(tmp, 'sized.duty.json')]);
    assert.equal(c.code, 0, c.out.slice(0, 400)); assert.equal(JSON.parse(c.out).ok, true);
    assert.ok('doc' in await readStudioFile(new Uint8Array(readFileSync(join(tmp, 'sized.bcad')))));
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
