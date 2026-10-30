import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart, placeBody, type BodyResult } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { rotationMatrix } from '../src/engine/placement';
import { solveDoc } from '../src/assembly/edit';
import { readStudioDoc } from '../src/engine/migrate';
import { dispatchTool } from '../src/chat/tools';
import { treeOfDoc } from '../src/chat/robot';
import { convexHull } from '@barocss/cad';
import { checkMaxSamples, sweepLinks, sweepPath } from '../src/robot/sweep';
import { sweepTimed } from '../src/robot/ccd';
import { checkMotion, robotViewOf, sweepOf, treeOf } from '../src/robot/verbs';
import { checkDesign } from '../src/robot/native/harness';
import { captivity } from '../src/rb9/captive';

// #2229: a sweep that runs out of its sample budget is neither a contact nor clear. A 2R arm (rm/chain-2r) swings link b about
// joint base~a past a grounded post whose face lies a known gap g beyond b's farthest point from the axis R (every point of b
// is within R of it, so the true least clearance is exactly g and nothing ever touches). The budget runs out first when g is
// tiny (the step is (g − tol)/rate) or maxSamples is small.

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function robot(doc: StudioDoc) {
  const r = await evaluate(doc); assert.ok(r.ok);
  const tree = await treeOfDoc(doc, r.bodies, evaluate), solved = solveDoc(doc).doc, world = new Map<string, BodyResult[]>([['base', r.bodies]]);
  for (const i of solved.instances ?? []) {
    const e = await evaluate(i.doc); assert.ok(e.ok);
    world.set(i.id, e.bodies.map(b => placeBody({ ...b, mesh: { ...b.mesh, positions: b.mesh.positions.slice(), normals: b.mesh.normals.slice(), edgeLines: b.mesh.edgeLines.slice() } }, rotationMatrix(i.rotation), i.position)));
  }
  return { tree, links: sweepLinks(tree, p => world.get(p), pts => convexHull(pts).positions), doc, bodies: r.bodies };
}
const base = (): StudioDoc => JSON.parse(readFileSync(join(CASES, 'chain-2r', 'case.json'), 'utf8')).input.document;
const withPost = (pos: [number, number, number], w: number, d: number): StudioDoc => { const x = base(); return { ...x, instances: [...x.instances!, { id: 'post', name: 'post', doc: rectanglePart(w, d, 30), position: pos, rotation: [0, 0, 0], grounded: true }] }; };
type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const JX = 20, JY = 20, LIMITS = { default: { v: 1, a: 2, j: 20 } };
/** R: link b's farthest point from joint a's axis at home, from the raw positions (independent of the sweep). */
async function radius() {
  const { links } = await robot(withPost([200, 200, 0], 10, 10)), b = links.find(l => l.link === 'b')!;
  let R = 0; for (let i = 0; i < b.positions.length; i += 3) R = Math.max(R, Math.hypot(b.positions[i] - JX, b.positions[i + 1] - JY));
  return R;
}
/** A post whose face is g beyond the arc's reach: the true least clearance of the swing is g. */
const grazing = async (g: number, R: number) => robot(withPost([JX + R + g, JY - 30, 0], 10, 60));
const a = { 'base~a': -0.4 }, b = { 'base~a': 0.4 };

// What the unfixed code returned for the contact case, recorded by running this file against it (the pre-fix run).
const BEFORE = { s: 0.0390231616736922, toi: 0.17668778270387953, links: ['post', 'b'] as string[], samples: 80 };

test('a gap of 1e-5 mm, default budget: never a contact or a TOI (the swing never touches); the least clearance met is the gap', async () => {
  const R = await radius(), { tree, links } = await grazing(1e-5, R);
  const sp = sweepPath(tree, links, a, b);
  assert.equal(sp.contact, undefined); assert.ok(sp.minClearance && sp.minClearance.mm >= 1e-5 - 1e-9, `${sp.minClearance?.mm}`);
  assert.ok(sp.exhausted, 'the default 20000-sample budget cannot certify a 1e-5 mm gap: exhausted');
  { assert.equal(sp.clear, false); assert.ok(sp.exhausted.s >= 0 && sp.exhausted.s < 1); assert.equal(sp.exhausted.samples, sp.samples); }
  const st = sweepTimed(tree, links, { waypoints: [a, b], profile: 'trapezoid', limits: LIMITS });
  assert.equal(st.toi, undefined); assert.equal(st.links, undefined); assert.ok(st.exhausted); assert.equal(st.clear, false); assert.equal(st.exhausted.segment, 0); assert.ok(st.exhausted.t > 0);
});

test('a gap of 1e-2 mm over 30 turns of a continuous joint, default budget: not a contact', async () => {
  // (Every point of b stays within R of the axis, so the post's face at R + 1e-2 is never touched however many turns it makes.)
  const R = await radius(), { tree, links } = await grazing(1e-2, R), turns = 30 * 2 * Math.PI;
  const st = sweepTimed(tree, links, { waypoints: [{ 'base~a': 0 }, { 'base~a': turns }], profile: 'trapezoid', limits: LIMITS });
  assert.equal(st.toi, undefined); assert.equal(st.links, undefined); assert.ok(st.clear || st.exhausted);
  if (st.exhausted) assert.equal(st.clear, false);
  const sp = sweepPath(tree, links, { 'base~a': 0 }, { 'base~a': turns });
  assert.equal(sp.contact, undefined); assert.ok(sp.clear || sp.exhausted);
  assert.ok(sp.minClearance && sp.minClearance.mm >= 1e-2 - 1e-6, `${sp.minClearance?.mm}`);
});

test('a 5 mm gap with maxSamples 1, 2, 3, 5, 10: exhausted, never a contact, no TOI', async () => {
  const R = await radius(), { tree, links } = await grazing(5, R);
  for (const m of [1, 2, 3, 5, 10]) {
    const sp = sweepPath(tree, links, a, b, { maxSamples: m });
    assert.equal(sp.contact, undefined, `maxSamples ${m}`); assert.equal(sp.clear, false, `maxSamples ${m}`);
    assert.ok(sp.exhausted, `maxSamples ${m}`); assert.equal(sp.exhausted.samples, m); assert.equal(sp.samples, m);
    assert.ok(sp.minClearance && sp.minClearance.mm >= 5 - 1e-9, `least clearance is the gap, ${sp.minClearance?.mm}`);
    const st = sweepTimed(tree, links, { waypoints: [a, b], profile: 'trapezoid', limits: LIMITS }, { maxSamples: m });
    assert.equal(st.toi, undefined, `maxSamples ${m}`); assert.equal(st.clear, false); assert.ok(st.exhausted);
  }
  // (A budget that suffices still certifies it clear.)
  const ok = sweepPath(tree, links, a, b, { maxSamples: 20000 }); assert.equal(ok.clear, true); assert.equal(ok.exhausted, undefined);
});

test('a first segment completed, the second out of budget: the exhausted segment index and time are on the second; no TOI', async () => {
  const R = await radius(), { tree, links } = await grazing(5, R);
  const st = sweepTimed(tree, links, { waypoints: [{ 'base~a': -0.4 }, { 'base~a': -0.35 }, { 'base~a': 0.4 }], profile: 'trapezoid', limits: LIMITS }, { maxSamples: 6 });
  assert.equal(st.toi, undefined); assert.ok(st.exhausted);
  assert.equal(st.exhausted.segment, 1);
  const first = st.segments[0];
  assert.ok(st.exhausted.t >= first.t0 + first.duration, `${st.exhausted.t}`);
});

test('a real collision still gives the same contact (s, links, TOI) as before the fix', async () => {
  const R = await radius(), { tree, links } = await robot(withPost([JX + R - 3, JY - 30, 0], 10, 60));
  const sp = sweepPath(tree, links, a, b), st = sweepTimed(tree, links, { waypoints: [a, b], profile: 'trapezoid', limits: LIMITS });
  assert.ok(sp.contact && !sp.clear && sp.exhausted === undefined);
  assert.deepEqual([sp.contact.s, [...sp.contact.links], sp.samples], [BEFORE.s, BEFORE.links, BEFORE.samples]);
  assert.ok(st.toi !== undefined && st.exhausted === undefined); assert.equal(st.toi, BEFORE.toi);
});

test('callers: sweep_path, check_path (open and closed), RM6 duty and the captive rung say "not certified" for an exhausted sweep; contact and clear are unchanged', async () => {
  const R = await radius();
  // sweepOf / sweep_path
  const hit = await robot(withPost([JX + R - 3, JY - 30, 0], 10, 60)), far = await grazing(5, R);
  const view = async (x: { doc: StudioDoc; bodies: BodyResult[] }) => robotViewOf(x.doc, x.bodies, evaluate);
  const vf = await view(far), tf = treeOf(vf), kf = tf.joints.find(j => j.key === 'base~a')!.key;
  const none = sweepOf(vf, { [kf]: -0.4 }, { [kf]: 0.4 }, tf, { maxSamples: 3 });
  assert.equal(none.reply.clear, false); assert.equal(none.reply.contact, undefined); assert.ok(none.reply.exhausted); assert.match(none.summary, /^not certified: the sweep ran out of its sample budget at s = /); assert.match(none.summary, /least clearance 5/);
  const okc = sweepOf(vf, { [kf]: -0.4 }, { [kf]: 0.4 }, tf); assert.equal(okc.reply.clear, true); assert.equal('exhausted' in okc.reply, false); assert.match(okc.summary, /^clear \(/);
  const vh = await view(hit), th = treeOf(vh), hc = sweepOf(vh, { [kf]: -0.4 }, { [kf]: 0.4 }, th);
  assert.equal(hc.reply.clear, false); assert.ok(hc.reply.contact); assert.equal('exhausted' in hc.reply, false); assert.match(hc.summary, /^contact /);
  // the agent tool
  const tool = async (x: { doc: StudioDoc; bodies: BodyResult[] }, name: string, args: Record<string, unknown>) => dispatchTool({ doc: x.doc, bodies: x.bodies }, name, args, evaluate);
  const sw = JSON.parse((await tool(far, 'sweep_path', { from: { [kf]: -0.4 * 180 / Math.PI }, to: { [kf]: 0.4 * 180 / Math.PI } })).content);
  assert.equal(sw.clear, true);
  // check_path: a stored motion; open chain (sweepTimed), then a four-bar (sweepClosed)
  const withMotion = (x: { doc: StudioDoc }): StudioDoc => ({ ...x.doc, robot: { version: 1, motions: [{ name: 'swing', path: { waypoints: [{ [kf]: -0.4 * 180 / Math.PI }, { [kf]: 0.4 * 180 / Math.PI }], profile: 'trapezoid', limits: { default: { velocity: 90, acceleration: 180 } } } }] } });
  const dfar = withMotion(far), vfm = await robotViewOf(dfar, far.bodies, evaluate), tfm = treeOf(vfm);
  const cp = checkMotion(vfm, 'swing', tfm, { maxSamples: 2 }) as unknown as Rec;
  assert.equal(cp.clear, false); assert.equal(cp.contact, undefined); assert.ok(cp.exhausted); assert.equal(cp.exhausted.reason, 'sample budget');
  const cc = checkMotion(vfm, 'swing', tfm) as unknown as Rec; assert.equal(cc.clear, true); assert.equal('exhausted' in cc, false);
  const sum = await dispatchTool({ doc: dfar, bodies: far.bodies }, 'check_path', { motion: 'swing' }, evaluate); assert.match(sum.summary ?? '', /^swing: clear/);
  const dhit = withMotion(hit), vhm = await robotViewOf(dhit, hit.bodies, evaluate), ch = checkMotion(vhm, 'swing', treeOf(vhm)) as unknown as Rec;
  assert.equal(ch.clear, false); assert.ok(ch.contact); assert.equal('exhausted' in ch, false);
  // closed loop (four-bar): a one-sample budget per chord
  const fb = readStudioDoc(readFileSync(join(resolve(import.meta.dirname, '..'), 'samples/robots/four-bar.bcad'), 'utf8')); assert.ok('doc' in fb);
  const rb = await evaluate(fb.doc); assert.ok(rb.ok);
  const vfb = await robotViewOf(fb.doc, rb.bodies, evaluate), tfb = treeOf(vfb);
  const closedCut = checkMotion(vfb, 'crank', tfb, { maxSamples: 1 }) as unknown as Rec;
  assert.equal(closedCut.clear, false); assert.equal(closedCut.contact, undefined); assert.ok(closedCut.exhausted, JSON.stringify(closedCut).slice(0, 300)); assert.ok(closedCut.loops.chords >= 1);
  const closedOk = checkMotion(vfb, 'crank', tfb) as unknown as Rec; assert.equal(closedOk.clear, true); assert.equal('exhausted' in closedOk, false);
  // the chat summary for an exhausted check_path
  const sumEx = await dispatchTool({ doc: fb.doc, bodies: rb.bodies }, 'check_path', { motion: 'crank' }, evaluate); assert.match(sumEx.summary ?? '', /^crank: clear/);
  // RM6 duty (checkDesign): an exhausted sweep is a failing margin with its own detail, never "contact"
  const hd = await grazing(1e-5, R);
  const duty = { moves: [{ from: { 'base~a': -0.4 }, to: { 'base~a': 0.4 }, profile: 'trapezoid' as const, limits: { velocity: 1, acceleration: 2 } }], clearance_mm: 0, g: [0, 0, 0] as [number, number, number] };
  const rep = checkDesign(hd.tree, new Map(), hd.links, duty as never, {});
  const m = rep.margins.find(x => x.check === 'sweep')!;
  assert.equal(m.ok, false); assert.match(m.detail ?? '', /^not certified: the sweep ran out of its sample budget/); assert.doesNotMatch(m.detail ?? '', /contact/i); assert.equal(rep.ok, false);
  // captive rung: a part sliding past another's face at a 1e-5 mm gap never touches, so its +x / -x slide runs out of budget
  const box = async (x: number, y: number) => { const e = await evaluate({ ...rectanglePart(10, 10, 10), nodes: rectanglePart(10, 10, 10).nodes }); assert.ok(e.ok); return e.bodies.map(bd => placeBody({ ...bd, mesh: { ...bd.mesh, positions: bd.mesh.positions.slice(), normals: bd.mesh.normals.slice(), edgeLines: bd.mesh.edgeLines.slice() } }, rotationMatrix([0, 0, 0]), [x, y, 0])); };
  const esc = captivity(await box(0, 0), await box(0, 10 + 1e-5));
  const px = esc.find(e => e.direction === '+x')!;
  assert.ok(px.exhausted, JSON.stringify(px)); assert.equal(px.captive, false);
  assert.ok(esc.some(e => e.exhausted), JSON.stringify(esc));
  assert.equal(esc.find(e => e.direction === '-y')!.captive, true, 'a slide into the other part is still a contact');
});

test('maxSamples policy: a whole number from 1 to 10,000,000, undefined is 20000; anything else is a typed VALUE refusal at every entry', async () => {
  const R = await radius(), { tree, links } = await grazing(5, R);
  const bad = [0, -1, 2.5, Number.NaN, Infinity, 1e300, 10_000_001, '5' as unknown as number, null as unknown as number];
  const refused = { code: 'VALUE', message: /maxSamples must be a whole number from 1 to 10000000/ };
  const path = { waypoints: [a, b], profile: 'trapezoid' as const, limits: LIMITS };
  const hit = await robot(withPost([JX + R - 3, JY - 30, 0], 10, 60)), vf = await robotViewOf(hit.doc, hit.bodies, evaluate), tf = treeOf(vf);
  const withMotion = { ...hit.doc, robot: { version: 1, motions: [{ name: 'swing', path: { waypoints: [{ 'base~a': -0.4 * 180 / Math.PI }, { 'base~a': 0.4 * 180 / Math.PI }], profile: 'trapezoid' as const, limits: { default: { velocity: 90, acceleration: 180 } } } }] } } as StudioDoc;
  const vm = await robotViewOf(withMotion, hit.bodies, evaluate);
  for (const m of bad) {
    assert.throws(() => sweepPath(tree, links, a, b, { maxSamples: m }), refused, `sweepPath ${String(m)}`);
    assert.throws(() => sweepTimed(tree, links, path, { maxSamples: m }), refused, `sweepTimed ${String(m)}`);
    assert.throws(() => sweepOf(vf, a, b, tf, { maxSamples: m }), refused, `sweepOf ${String(m)}`);
    assert.throws(() => checkMotion(vm, 'swing', treeOf(vm), { maxSamples: m }), refused, `checkMotion ${String(m)}`);
  }
  for (const m of [1, 10_000_000]) assert.doesNotThrow(() => checkMaxSamples(m));
  assert.equal(checkMaxSamples(undefined), 20000);
  assert.equal(sweepPath(tree, links, a, b, { maxSamples: undefined }).clear, true, 'undefined is the default budget');
  assert.equal(sweepPath(tree, links, a, b, { maxSamples: 1 }).samples, 1);
});

test('the agent tools through the real dispatch: a 1e-5 mm graze exhausts the default budget, "not certified", never "contact" or "clear"', async () => {
  const R = await radius(), g = await grazing(1e-5, R), kf = 'base~a';
  const tool = (d: StudioDoc, name: string, args: Record<string, unknown>) => dispatchTool({ doc: d, bodies: g.bodies }, name, args, evaluate);
  const sw = await tool(g.doc, 'sweep_path', { from: { [kf]: -0.4 * 180 / Math.PI }, to: { [kf]: 0.4 * 180 / Math.PI } });
  assert.ok(!sw.isError, sw.content); assert.match(sw.summary ?? '', /^not certified/); assert.doesNotMatch(sw.summary ?? '', /contact|\bclear\b/i);
  const swc = JSON.parse(sw.content); assert.equal(swc.clear, false); assert.ok(swc.exhausted); assert.equal(swc.contact, undefined);
  const doc = { ...g.doc, robot: { version: 1, motions: [{ name: 'swing', path: { waypoints: [{ [kf]: -0.4 * 180 / Math.PI }, { [kf]: 0.4 * 180 / Math.PI }], profile: 'trapezoid', limits: { default: { velocity: 90, acceleration: 180 } } } }] } } as StudioDoc;
  const cp = await tool(doc, 'check_path', { motion: 'swing' });
  assert.ok(!cp.isError, cp.content); assert.match(cp.summary ?? '', /^swing: not certified/); assert.doesNotMatch(cp.summary ?? '', /contact|\bclear\b/i);
  const cpc = JSON.parse(cp.content); assert.equal(cpc.clear, false); assert.ok(cpc.exhausted); assert.equal(cpc.contact, undefined);
});
