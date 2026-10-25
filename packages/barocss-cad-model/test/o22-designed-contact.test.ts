// O22: designed contact in the collision sweep — meshing gears' teeth and a planar loop pin's shared face are no
// contact, and a crash between those very links still is. The oracles: the closed form of the arm's edge reaching the
// other gear's tip circle; the bare samples clear both ways; and the loop refused where a motion cannot close it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import type { StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import { dispatchTool } from '../src/chat/tools';
import { robotViewOf, sweepOf, treeOf } from '../src/robot/verbs';
import { spurGearDimensions } from '@barocss/cad';

const DIR = resolve(resolve(import.meta.dirname, '..'), 'samples/robots');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const open = (id: string) => { const r = readStudioDoc(readFileSync(join(DIR, `${id}.bcad`), 'utf8')); assert.ok('doc' in r, id); return r.doc; };
/** A part of the assembly with a box added in its own coordinates (a sketch rectangle extruded from its plane). */
const withBox = (doc: StudioDoc, part: string, min: number[], max: number[], h: number): StudioDoc => ({ ...doc, instances: doc.instances!.map(i => i.id !== part ? i : { ...i, doc: { ...i.doc, nodes: [...i.doc.nodes, { kind: 'sketch', profile: 'rectangle', min, max }, { kind: 'extrude', sketch: i.doc.nodes.length, height: h }] as never } }) });
async function sweep(doc: StudioDoc, to: Record<string, number>) {
  const r = await evaluate(doc); assert.ok(r.ok);
  const v = await robotViewOf(doc, r.bodies, evaluate);
  return sweepOf(v, {}, to, treeOf(v)).reply;
}
const pairOf = (list: { links: [string, string]; why: string }[], a: string, b: string) => list.find(p => p.links.includes(a) && p.links.includes(b));

test('O22 gears: two bare meshing gears are no contact (left out, said so); an arm on one finger swung into the other gear is', async () => {
  const g = open('gripper');
  for (const q of [Math.PI / 2, -Math.PI / 2]) {
    const bare = await sweep(g, { 'base~left': q });
    assert.equal(bare.clear, true, JSON.stringify(bare));
    assert.match(pairOf(bare.skipped, 'left', 'right')!.why, /^meshing gears \(base~left drives base~right\).*nothing else on either$/);
  }
  // (The arm: 4 mm wide along the finger's +Y, from 23 to 45 mm out — past its tip circle, 22 mm.)
  const armed = withBox(g, 'left', [-2, 23], [2, 45], 8);
  const away = await sweep(armed, { 'base~left': Math.PI / 2 });
  assert.equal(away.clear, true, JSON.stringify(away)); assert.match(pairOf(away.designed, 'left', 'right')!.why, /^meshing gears/);
  const into = await sweep(armed, { 'base~left': -Math.PI / 2 });
  assert.equal(into.clear, false); assert.deepEqual([...into.contact!.links].sort(), ['left', 'right']);
  // (Closed form: the arm's edge, 2 mm off its centre line, reaches the right gear's tip circle (centre 40 mm off) when
  // 40 sin φ − 2 = ra, φ the arm's angle off the line between the centres: a turn of 90° − φ. A tooth there or a gap
  // decides the last fraction, so the contact is no sooner than that and within a tooth's pitch angle.)
  const ra = spurGearDimensions({ module: 2, teeth: 20, faceWidth: 8 }).ra, turn = Math.PI / 2 - Math.asin((ra + 2) / 40), at = -into.contact!.values['base~left'];
  assert.ok(at >= turn - 1e-6 && at <= turn + (2 * Math.PI) / 20, `${at} vs ${turn}`);
});

test('O22 loop pin: the four-bar\'s stacked coupler and rocker are no contact (left out, said so); a post on the rocker the coupler swings into is', async () => {
  const f = open('four-bar');
  for (const q of [1, -1]) {
    const bare = await sweep(f, { 'base~crank': q });
    assert.equal(bare.clear, true, JSON.stringify(bare));
    assert.match(pairOf(bare.skipped, 'coupler', 'rocker')!.why, /^a planar loop's pin \(Cc\).*stacked.*cannot meet$/);
  }
  // (A 4 × 4 mm post 12 mm tall on the rocker, 7 mm into the coupler's slab.)
  const posted = withBox(f, 'rocker', [30, 0], [34, 4], 12);
  const away = await sweep(posted, { 'base~crank': 1 });
  assert.equal(away.clear, true, JSON.stringify(away)); assert.ok(away.minClearance!.value > 1, 'it passes the post');
  assert.match(pairOf(away.designed, 'coupler', 'rocker')!.why, /only what both fill along it checked$/);
  const into = await sweep(posted, { 'base~crank': -1 });
  assert.equal(into.clear, false); assert.deepEqual([...into.contact!.links].sort(), ['coupler', 'rocker']); assert.ok(into.contact!.s > 0, 'not at the start');
  // (A post where the coupler already lies is a contact at once.)
  const through = await sweep(withBox(f, 'rocker', [46, 0], [50, 4], 12), { 'base~crank': 1 });
  assert.equal(through.clear, false); assert.equal(through.contact!.s, 0);
});

test('O22 → RS6: check_path and play_motion close a robot\'s loop along its motion (the four-bar; LOOP_OPEN retired)', async () => {
  const doc = open('four-bar'), r = await evaluate(doc); assert.ok(r.ok);
  const check = JSON.parse((await dispatchTool({ doc, bodies: r.bodies }, 'check_path', { motion: 'crank' }, evaluate)).content);
  assert.equal(check.clear, true, JSON.stringify(check).slice(0, 300)); assert.ok(check.loops.chords >= 240 && check.loops.chordResidual < 1e-2, JSON.stringify(check.loops));
  const play = JSON.parse((await dispatchTool({ doc, bodies: r.bodies }, 'play_motion', { motion: 'crank', samples: 5 }, evaluate)).content);
  assert.ok(play.samples.some((f: { values: Record<string, number> }) => Math.abs(f.values['base~rocker']) > 1), 'the rocker follows the crank');
});
