import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { faceTableOf, tablesFor } from '../src/assembly/faces';
import type { Mate } from '../src/assembly/mates';
import { solveDoc } from '../src/assembly/edit';
import { dispatchTool, runTool, type ChatState } from '../src/chat/tools';
import { treeOfDoc } from '../src/chat/robot';
import { jointTreeOf, motionOf, readRobot, type JointTree } from '../src/robot/joints';

// RM1 (O14): the mate graph as a joint tree. Each case is an assembly built here, its mates solved, the tree read;
// the cases are also conformance/rm/<case>/case.json (the document and the expected joints; UPDATE_RM_FIXTURES=1).

const CASES = resolve(resolve(import.meta.dirname, '..'), '../../packages/barocss-cad/conformance/rm');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const bodiesOf = async (doc: StudioDoc) => { const r = await evaluate(doc); assert.ok(r.ok); return r.bodies; };
const plateWithHoles = (w: number, d: number, h: number, holes: [number, number][], r = 5) => holes.reduce((doc, c) => withNode(doc, { kind: 'hole', parent: { node: doc.nodes.length - 1, side: 'solid' }, center: c, radius: r } as never), rectanglePart(w, d, h));
const inst = (id: string, doc: StudioDoc, position: [number, number, number] = [0, 0, 30], extra: Partial<PartInstance> = {}): PartInstance => ({ id, name: id, doc, position, rotation: [0, 0, 0], ...extra });
const mate = (id: string, kind: Mate['kind'], a: [string, string], b: [string, string], extra: Partial<Mate> = {}): Mate => ({ id, kind, a: { part: a[0], face: a[1] }, b: { part: b[0], face: b[1] }, ...extra });
const assembly = (base: StudioDoc, instances: PartInstance[], mates: Mate[], robot?: StudioDoc['robot']): StudioDoc => ({ ...base, instances, mates, ...(robot ? { robot } : {}) });
function treeOf(doc: StudioDoc): JointTree { const s = solveDoc(doc); return jointTreeOf(s.doc, { instances: s.doc.instances ?? [], problems: s.problems }, tablesFor(s.doc)); }
const r6 = (v: readonly number[]) => v.map(x => Math.round(x * 1e6) / 1e6 + 0);
/** The tree as the fixtures keep it: links, joints (key, type, parent, child, axis, origin to 1e-6, mimic), loops, codes. */
const shape = (t: JointTree) => ({
  base: t.base, links: t.links.map(l => l.id), joints: t.joints.map(j => ({ key: j.key, type: j.type, parent: j.parent, child: j.child, axis: r6(j.axis), origin: r6(j.origin), ...(j.mimic ? { mimic: { joint: j.mimic.joint, multiplier: Math.round(j.mimic.multiplier * 1e9) / 1e9 } } : {}) })),
  loops: t.loops.map(l => ({ parts: l.parts, mates: l.mates })), problems: t.problems.map(p => p.code), couplings: t.couplings.length,
});

// The parts: a base plate with holes, an arm with holes at both ends, a slider block.
const BASE = plateWithHoles(100, 40, 10, [[20, 20], [80, 20]]);
const ARM = plateWithHoles(60, 20, 5, [[10, 10], [50, 10]]);
const BLOCK = rectanglePart(20, 20, 5);
const revoluteMates = (id: string, baseHole: string, child: string, childHole = 'n2.side0', on: [string, string] = ['base', 'n1.top']): Mate[] => [mate(`${id}c`, 'concentric', [on[0], baseHole], [child, childHole]), mate(`${id}f`, 'coincident', on, [child, 'n1.bottom'])];

const CASE_DOCS: Record<string, () => StudioDoc | Promise<StudioDoc>> = {
  'revolute': () => assembly(BASE, [inst('arm', ARM)], revoluteMates('m1', 'n2.side0', 'arm')),
  'revolute-limited': () => assembly(BASE, [inst('arm', ARM)], revoluteMates('m1', 'n2.side0', 'arm'), { version: 1, joints: { 'base~arm': { lower: -1.5 * 180 / Math.PI, upper: 1.5 * 180 / Math.PI, effort: 2000, velocity: 3 * 180 / Math.PI } } }),
  'prismatic': () => assembly(BASE, [inst('slider', BLOCK)], [mate('m1', 'coincident', ['base', 'n1.top'], ['slider', 'n1.bottom']), mate('m2', 'coincident', ['base', 'n1.side0'], ['slider', 'n1.side0'], { flip: true })], { version: 1, joints: { 'base~slider': { lower: 0, upper: 80, effort: 10, velocity: 50 } } }),
  'cylindrical': () => assembly(BASE, [inst('arm', ARM)], [mate('m1', 'concentric', ['base', 'n2.side0'], ['arm', 'n2.side0'])]),
  'planar': () => assembly(BASE, [inst('slider', BLOCK)], [mate('m1', 'coincident', ['base', 'n1.top'], ['slider', 'n1.bottom'])]),
  'fixed-by-mates': () => assembly(BASE, [inst('arm', ARM)], [...revoluteMates('m1', 'n2.side0', 'arm'), mate('m3', 'angle', ['base', 'n1.side0'], ['arm', 'n1.side0'], { angle: 0, flip: true })]),
  'chain-2r': () => assembly(BASE, [inst('a', ARM), inst('b', ARM, [0, 0, 60])], [...revoluteMates('m1', 'n2.side0', 'a'), ...revoluteMates('m2', 'n3.side0', 'b', 'n2.side0', ['a', 'n1.top'])]),
  'chain-2r-from-b': () => assembly(BASE, [inst('a', ARM), inst('b', ARM, [0, 0, 60])], [...revoluteMates('m1', 'n2.side0', 'a'), ...revoluteMates('m2', 'n3.side0', 'b', 'n2.side0', ['a', 'n1.top'])], { version: 1, base: 'b' }),
  'loop': () => assembly(BASE, [inst('a', ARM), inst('b', ARM, [0, 0, 60])], [...revoluteMates('m1', 'n2.side0', 'a'), ...revoluteMates('m2', 'n3.side0', 'b', 'n2.side0', ['a', 'n1.top']), mate('m3', 'distance', ['base', 'n1.top'], ['b', 'n1.bottom'], { distance: 5 })]),
  'unconnected-and-grounded': () => assembly(BASE, [inst('arm', ARM), inst('loose', BLOCK, [200, 0, 0]), inst('fixed', BLOCK, [-50, 0, 0], { grounded: true })], revoluteMates('m1', 'n2.side0', 'arm')),
  'gears': async () => {
    const gear = async (teeth: number) => (await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'run_command', { command: 'gear', values: { m: 2, teeth, b: 8, bore: 8, x: 0, y: 0, z: 0 } }, evaluate)).state.doc;
    const g1 = await gear(20), g2 = await gear(30), a = 2 * (20 + 30) / 2;
    const carrier = plateWithHoles(120, 60, 10, [[30, 30], [30 + a, 30]], 4);
    const bore = (doc: StudioDoc) => Object.entries(faceTableOf(doc)).find(([, f]) => f.kind === 'cylinder' && Math.abs(f.radius - 4) < 1e-9)![0];
    const bottom = (doc: StudioDoc) => Object.entries(faceTableOf(doc)).find(([k, f]) => f.kind === 'plane' && f.normal[2] < -0.999 && !k.startsWith('origin'))![0];
    return assembly(carrier, [inst('g1', g1), inst('g2', g2, [100, 0, 30])], [
      mate('m1', 'concentric', ['base', 'n2.side0'], ['g1', bore(g1)]), mate('m2', 'coincident', ['base', 'n1.top'], ['g1', bottom(g1)]),
      mate('m3', 'concentric', ['base', 'n3.side0'], ['g2', bore(g2)]), mate('m4', 'coincident', ['base', 'n1.top'], ['g2', bottom(g2)]),
    ]);
  },
};

test('the cases (conformance/rm): every assembly\'s joint tree as frozen', async () => {
  mkdirSync(CASES, { recursive: true });
  for (const [name, make] of Object.entries(CASE_DOCS)) {
    const doc = await make(), dir = join(CASES, name), file = join(dir, 'case.json');
    const t = name === 'gears' ? await treeOfDoc(doc, await bodiesOf(doc), evaluate) : treeOf(doc);
    if (process.env.UPDATE_RM_FIXTURES) { mkdirSync(dir, { recursive: true }); writeFileSync(file, JSON.stringify({ case: name, step: 'RM1', input: { document: doc }, expect: shape(t) }, null, 1) + '\n'); }
    const c = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(shape(t), c.expect, name);
    // (The frozen document gives the same tree.)
    const again = name === 'gears' ? await treeOfDoc(c.input.document, await bodiesOf(c.input.document), evaluate) : treeOf(c.input.document);
    assert.deepEqual(shape(again), c.expect, `${name} from its file`);
  }
  assert.deepEqual(readdirSync(CASES).filter(n => JSON.parse(readFileSync(join(CASES, n, 'case.json'), 'utf8')).step === 'RM1').sort(), Object.keys(CASE_DOCS).sort());
});

test('revolute and prismatic: the axis, a point on it at the child, continuous without limits, the limits kept', () => {
  const r = treeOf(CASE_DOCS.revolute() as StudioDoc);
  assert.deepEqual([r.links.map(l => l.id), r.joints.length, r.problems], [['base', 'arm'], 1, []]);
  const j = r.joints[0];
  assert.deepEqual([j.key, j.type, j.parent, j.child, r6(j.axis), r6(j.origin), j.mates], ['base~arm', 'continuous', 'base', 'arm', [0, 0, 1], [20, 20, 10], ['m1c', 'm1f']]);
  assert.ok(r.notes.some(n => n.code === 'LIMITS_MISSING'), 'no ratings yet: noted for export');
  const l = treeOf(CASE_DOCS['revolute-limited']() as StudioDoc).joints[0];
  assert.deepEqual([l.type, l.limit], ['revolute', { lower: -1.5, upper: 1.5, effort: 2, velocity: 3 }]);
  const p = treeOf(CASE_DOCS.prismatic() as StudioDoc);
  assert.deepEqual([p.joints[0].type, r6(p.joints[0].axis), p.notes], ['prismatic', [1, 0, 0], []]);
});

test('chains through dummy links: cylindrical (a slide and a turn on one axis), planar (two slides and a turn)', () => {
  const c = treeOf(CASE_DOCS.cylindrical() as StudioDoc);
  assert.deepEqual(c.joints.map(j => [j.key, j.type, j.parent, j.child, r6(j.axis)]), [['base~arm#0', 'prismatic', 'base', 'arm__1', [0, 0, 1]], ['base~arm#1', 'continuous', 'arm__1', 'arm', [0, 0, 1]]]);
  assert.deepEqual(c.links.map(l => [l.id, l.part]), [['base', 'base'], ['arm', 'arm'], ['arm__1', null]]);
  const p = treeOf(CASE_DOCS.planar() as StudioDoc);
  assert.deepEqual(p.joints.map(j => j.type), ['prismatic', 'prismatic', 'continuous']);
  assert.ok(p.joints.slice(0, 2).every(j => Math.abs(j.axis[2]) < 1e-12) && Math.abs(p.joints[2].axis[2] - 1) < 1e-12, 'slides in the face, the turn about its normal');
});

test('fixed: mates leaving nothing free, a lock, a grounded part; a loose part is not in the robot', () => {
  assert.deepEqual(treeOf(CASE_DOCS['fixed-by-mates']() as StudioDoc).joints.map(j => j.type), ['fixed']);
  const doc = assembly(BASE, [inst('arm', ARM)], [mate('m1', 'lock', ['base', ''], ['arm', ''], { rel: { position: [5, 5, 10], rotation: [0, 0, 0] } })]);
  assert.deepEqual(treeOf(doc).joints.map(j => [j.type, j.mates]), [['fixed', ['m1']]]);
  const u = treeOf(CASE_DOCS['unconnected-and-grounded']() as StudioDoc);
  // (Joints in the order the tree grows: parents first, the least free first — the grounded part's fixed joint.)
  assert.deepEqual(u.joints.map(j => [j.key, j.type]), [['base~fixed', 'fixed'], ['base~arm', 'continuous']]);
  assert.deepEqual(u.problems.map(p => [p.code, p.parts]), [['NOT_CONNECTED', ['loose']]]);
});

test('a 2R chain from either end; a loop kept and reported, never dropped', () => {
  const t = treeOf(CASE_DOCS['chain-2r']() as StudioDoc);
  assert.deepEqual(t.joints.map(j => [j.key, j.type]), [['base~a', 'continuous'], ['a~b', 'continuous']]);
  assert.deepEqual(r6(t.joints[1].origin).slice(0, 2), r6(t.joints[0].origin).slice(0, 2).map((v, i) => v + [40, 0][i]), 'b turns at a\'s far hole, 40 mm along');
  const f = treeOf(CASE_DOCS['chain-2r-from-b']() as StudioDoc);
  assert.deepEqual([f.base, f.joints.map(j => [j.key, j.parent, j.child])], ['b', [['a~b', 'b', 'a'], ['base~a', 'a', 'base']]], 'the keys stay; parents and children swap');
  const l = treeOf(CASE_DOCS.loop() as StudioDoc);
  assert.equal(l.joints.length, 2);
  assert.deepEqual(l.loops.map(x => [x.parts, x.mates]), [[['base', 'b'], ['m3']]]);
  // An unknown base link: said so, the base part used.
  const bad = treeOf({ ...(CASE_DOCS.revolute() as StudioDoc), robot: { version: 1, base: 'nope' } });
  assert.deepEqual([bad.base, bad.problems.map(p => p.code)], ['base', ['BASE_UNKNOWN']]);
});

test('motion classes from free twists: a ball is three turns about one point; a screw and two turns on different axes are refused', () => {
  const p: [number, number, number] = [1, 2, 3], cr = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] as [number, number, number];
  const ball = motionOf([[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(w => ({ w: w as [number, number, number], v: cr(p, w) })));
  assert.ok('steps' in ball && ball.steps.length === 3 && ball.steps.every(s => s.type === 'revolute' && r6(s.point!).join() === '1,2,3'));
  const screw = motionOf([{ w: [0, 0, 1], v: [0, 0, 0.5] }]);
  assert.ok('unsupported' in screw && /screw/.test(screw.unsupported));
  const two = motionOf([{ w: [1, 0, 0], v: [0, 0, 0] }, { w: [0, 1, 0], v: [0, 0, 10] }]);
  assert.ok('unsupported' in two);
  assert.deepEqual('steps' in motionOf([]) && motionOf([]), { steps: [] }, 'nothing free: fixed');
  // A part with a round face tangent to the base's top alone moves too freely for one chain: typed, not guessed.
  const pin = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 } as never), { kind: 'extrude', sketch: 0, height: 20 } as never);
  const tangent = treeOf(assembly(BASE, [inst('pin', pin, [50, 20, 30], { rotation: [90, 0, 0] })], [mate('m1', 'tangent', ['base', 'n1.top'], ['pin', 'n1.side0'])]));
  assert.deepEqual(tangent.problems.map(x => x.code), ['MOTION_UNSUPPORTED']);
});

test('two meshing spur gears on one carrier: the second follows the first, −z1/z2, from the kernel\'s pair check', async () => {
  const doc = await CASE_DOCS.gears();
  const r = await evaluate(doc); assert.ok(r.ok);
  const t = await treeOfDoc(doc, r.bodies, evaluate);
  assert.deepEqual(t.joints.map(j => [j.key, j.type]), [['base~g1', 'continuous'], ['base~g2', 'continuous']]);
  assert.equal(t.couplings.length, 1);
  const c = t.couplings[0];
  assert.deepEqual([c.leader, c.follower, Math.round(c.multiplier * 1e12) / 1e12], ['base~g1', 'base~g2', Math.round(-20 / 30 * 1e12) / 1e12]);
  assert.ok(Math.abs(c.centerDistance - 50) < 1e-9 && Math.abs(c.nominalCenterDistance - 50) < 1e-9, JSON.stringify(c));
  assert.deepEqual(t.joints[1].mimic, { joint: 'base~g1', multiplier: c.multiplier, offset: 0 });
});

test('the settings: read leniently, versioned; the tools — get_joints reads, set_joints is proposed (the assembly\'s)', async () => {
  assert.deepEqual(readRobot({ base: 'a', joints: { 'base~a': { lower: -1, upper: 'x', effort: 2 }, bad: 3 } }), { version: 1, base: 'a', joints: { 'base~a': { lower: -1, effort: 2 } } });
  assert.deepEqual(readRobot(undefined), { version: 1 });
  const doc = CASE_DOCS.revolute() as StudioDoc, r = await evaluate(doc); assert.ok(r.ok);
  const s: ChatState = { doc, bodies: r.bodies, turnBase: doc };
  const read = await dispatchTool(s, 'get_joints', {}, evaluate);
  assert.ok(!read.isError && !read.changed, read.content);
  assert.deepEqual(JSON.parse(read.content).joints.map((j: { key: string }) => j.key), ['base~arm']);
  // Directly: refused at the session gate (the assembly's); through dispatch: set, validated.
  const direct = await runTool(s, 'set_joints', { joints: { 'base~arm': { lower: -1, upper: 1 } } }, evaluate);
  assert.equal(JSON.parse(direct.content).code, 'needs_approval', direct.content);
  const set = await dispatchTool(s, 'set_joints', { base: 'arm', joints: { 'base~arm': { lower: -1, upper: 1, effort: 2, velocity: 3 } } }, evaluate);
  assert.ok(!set.isError && set.changed, set.content);
  assert.deepEqual(set.state.doc.robot, { version: 1, base: 'arm', joints: { 'base~arm': { lower: -1, upper: 1, effort: 2, velocity: 3 } } });
  for (const bad of [{ base: 'nope' }, { joints: { 'base~arm': { lower: 2, upper: 1 } } }, { joints: { 'base~arm': { torque: 1 } } }, { joints: { 'nope~x': { lower: 0 } } }, { joints: { 'base~arm': { effort: 0 } } }]) {
    const out = await dispatchTool(s, 'set_joints', bad, evaluate);
    assert.ok(out.isError && out.state === s, JSON.stringify(bad));
  }
  // A proposal holding it, accepted by the user, applies it; null clears a joint, and an empty robot leaves no field.
  const cleared = await dispatchTool({ ...s, doc: set.state.doc }, 'set_joints', { base: 'base', joints: { 'base~arm': null } }, evaluate);
  assert.equal(cleared.state.doc.robot, undefined);
  const p = await runTool(s, 'propose', { title: 'arm limits', ops: [{ tool: 'set_joints', args: { joints: { 'base~arm': { lower: -1, upper: 1 } } } }] }, evaluate);
  assert.ok(!p.isError, p.content); assert.deepEqual(JSON.parse(p.content).risk.approval, ['robot']);
});
