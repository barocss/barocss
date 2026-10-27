import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { brepsFor, evaluateDoc, forgetSnapshots, exportStudioStep } from '../src/engine/evaluate';
import { rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { bomView, deriveBom } from '../src/team/assembly';
import { assemblyPlacedBodies, clearanceMap } from '../src/team/clearanceMap';
import { tablesFor } from '../src/assembly/faces';
import { solveAssembly, type Mate } from '../src/assembly/mates';
import { checkVariability, variantNamed, variantOf } from '../src/assembly/variability';
import type { Input } from '../src/engine/schema/variability';
import { armMaster, clearanceMaster, frameMaster, plateAndPin, plateMaster } from './o11-fixtures';

// O11: a variant is regenerated from the one master. Its oracle (as test/r4-caches'): each fixture's variants evaluated
// through the kept snapshots in the order A → B → A equal a fresh evaluation from nothing — the second A both the first
// and a fresh one, byte for byte: bodies, STEP, B-reps, the BOM and an assembly's clearance map. Every value at its default
// gives the master itself. Fixtures are built here from existing files (no new .bcad).

const repo = resolve(import.meta.dirname, '../../..');
const json = (v: unknown) => JSON.stringify(v, (_k, x: unknown) => ArrayBuffer.isView(x) ? Array.from(x as unknown as ArrayLike<number>) : x);
let revision = 1;
const evaluate = async (d: StudioDoc) => evaluateDoc(d, revision++);
async function record(doc: StudioDoc): Promise<string> {
  const e = evaluateDoc(doc, revision++); assert.ok(e.ok, e.ok ? '' : e.error.title);
  const s = exportStudioStep(doc, { name: 'p' });
  return json({ bodies: e.bodies, step: s.text.replace(/FILE_NAME\([^;]*;/, '').replace(/FILE_DESCRIPTION\([^;]*;/, ''), breps: brepsFor(doc), bom: deriveBom(await bomView(doc, evaluate)).lines,
    ...(doc.instances?.length ? { clearance: json({ ...clearanceMap(await assemblyPlacedBodies(doc, evaluate)), timing: undefined }) } : {}) });
}
const fresh = async (doc: StudioDoc) => { forgetSnapshots(); return record(doc); };
const docOf = (r: ReturnType<typeof variantOf>): StudioDoc => r.doc;
async function oracle(master: StudioDoc, a: string, b: string) {
  assert.deepEqual(checkVariability(master), []);
  assert.equal(docOf(variantOf(master, {})), master, 'every value at its default: the master itself');
  const A = docOf(variantNamed(master, a)), B = docOf(variantNamed(master, b));
  assert.notEqual(json(A.nodes) + json(A.instances) + json(A.parameters), json(master.nodes) + json(master.instances) + json(master.parameters), `${a} changes the part`);
  forgetSnapshots();
  const a1 = await record(A), b1 = await record(B), a2 = await record(A);
  assert.equal(a1, await fresh(A), `${a} through the kept snapshots = from nothing`);
  assert.equal(b1, await fresh(B), `${b} after ${a} = from nothing`);
  assert.equal(a2, a1, `${a} again after ${b}`);
  assert.equal(json(docOf(variantNamed(master, a))), json(A), 'regenerated again: the same document');
}

test('O11: the clearance fixture — a boolean drops the fourth pair, a choice swaps a copy for a shipped end cap; BOM and clearance per variant', async () => {
  const master = await clearanceMaster(repo);
  await oracle(master, 'three pairs', 'end cap');
  const lines = async (n: string) => deriveBom(await bomView(docOf(variantNamed(master, n)), evaluate)).lines.map(l => l.item).join('|');
  assert.notEqual(await lines('end cap'), await lines('three pairs'), 'the BOM names the swapped part');
  const pairs = async (n: string) => clearanceMap(await assemblyPlacedBodies(docOf(variantNamed(master, n)), evaluate)).pairs.length;
  assert.ok(await pairs('three pairs') < clearanceMap(await assemblyPlacedBodies(master, evaluate)).pairs.length, 'the fourth pair left out of the clearance map');
});

test('O11: the 6R arm — "reach" lengthens two links (their length and far bore bound to it); the mates solve the chain again', async () => {
  const master = await armMaster(repo);
  await oracle(master, 'long', 'short');
  const z = (n: string, id: string) => docOf(variantNamed(master, n)).instances!.find(i => i.id === id)!.position[2];
  assert.ok(Math.abs(z('long', 'l6') - z('short', 'l6') - 2 * 30) < 1e-6, `two links 30 mm longer each: the tip 60 mm further (${z('long', 'l6')} vs ${z('short', 'l6')})`);
});

test('O11: a frame on a skeleton bound to W — "span" sets W; the members follow', async () => {
  await oracle(await frameMaster(), '800', '1000');
});

test('O11: a mate value — "offset" drives the pin\'s distance above the plate; the pin moves, solved', async () => {
  const master = plateMaster();
  await oracle(master, 'high', 'low');
  const z = (n: string) => docOf(variantNamed(master, n)).instances![0].position[2];
  assert.ok(Math.abs(z('high') - z('low') - 24) < 1e-9, `${z('high')} vs ${z('low')}`);
});

test('O11: no cycle by construction; a mate loop reached through a mate input is the solver\'s own problem, passed through', () => {
  const a: PartInstance = { id: 'a', name: 'a', doc: rectanglePart(20, 20, 4), position: [0, 0, 30], rotation: [0, 0, 0] }, b: PartInstance = { id: 'b', name: 'b', doc: rectanglePart(10, 10, 4), position: [0, 0, 60], rotation: [0, 0, 0] };
  const mates: Mate[] = [
    { id: 'm1', kind: 'distance', distance: 2, a: { part: 'a', face: 'n1.top' }, b: { part: 'b', face: 'n1.bottom' } },
    { id: 'm2', kind: 'coincident', a: { part: 'b', face: 'n1.top' }, b: { part: 'a', face: 'n1.bottom' } },
  ];
  const doc: StudioDoc = { ...rectanglePart(64, 32, 8), instances: [a, b], mates, variability: { version: 1, inputs: [{ name: 'gap', type: 'number', default: 2, bindings: [{ to: 'mate', mate: 'm1', field: 'distance' }] }] } };
  const r = variantOf(doc, { gap: 7 });
  const solver = solveAssembly([a, b], r.doc.mates!, tablesFor(r.doc), [a, b]).problems;
  assert.deepEqual(r.problems, solver);
  assert.ok(r.problems.length && r.problems.every(p => /closes a loop/.test(p.reason)), JSON.stringify(r.problems));
});

test('O11: each refusal typed, naming what it refers to', () => {
  const doc: StudioDoc = { ...plateAndPin(5), parameters: { t: 8 } };
  const withInputs = (inputs: Input[], extra: Partial<NonNullable<StudioDoc['variability']>> = {}): StudioDoc => ({ ...doc, variability: { version: 1, inputs, ...extra } });
  const n = (b: Input['bindings'][number], over: Partial<Input> = {}): Input => ({ name: 'x', type: 'number', default: 8, bindings: [b], ...over });
  const cases: [StudioDoc, RegExp][] = [
    [withInputs([n({ to: 'parameter', part: 'base', parameter: 'nope' })]), /^\[INPUT_TARGET\] x: base has no parameter nope/],
    [withInputs([n({ to: 'parameter', part: 'ghost', parameter: 't' })]), /^\[INPUT_TARGET\] x: no part ghost/],
    [withInputs([n({ to: 'mate', mate: 'm9', field: 'distance' })]), /^\[INPUT_TARGET\] x: no mate m9/],
    [withInputs([n({ to: 'suppress', part: 'base', feature: 'n7', when: true }, { type: 'boolean', default: false })]), /^\[INPUT_TARGET\] x: base has no feature n7/],
    [withInputs([n({ to: 'parameter', part: 'base', parameter: 't' }, { type: 'boolean', default: true })]), /^\[INPUT_TYPE\] x \(boolean\) cannot drive a parameter/],
    [withInputs([n({ to: 'parameter', part: 'base', parameter: 't' }, { default: 9 })]), /^\[INPUT_DEFAULT\] parameter t of base is 8, but x's default gives 9/],
    [withInputs([n({ to: 'parameter', part: 'base', parameter: 't' }, { min: 10 })]), /^\[INPUT_RANGE\] x's default = 8: a number from 10/],
    [withInputs([n({ to: 'parameter', part: 'base', parameter: 't' }), n({ to: 'parameter', part: 'base', parameter: 't' }, { name: 'y' })]), /^\[INPUT_CONFLICT\] parameter t of base is driven by x and y/],
    [withInputs([n({ to: 'parameter', part: 'base', parameter: 't' }), n({ to: 'mate', mate: 'm1', field: 'distance' }, { default: 5 })]), /^\[INPUT_NAME\] two inputs named x/],
    [withInputs([{ name: 'c', type: 'choice', choices: [{ value: 'a' }, { value: 'b' }], default: 'a', bindings: [{ to: 'component', instance: 'pin', options: { a: { like: 'pin' }, b: { library: 'tslot-20', part: 'no-such-part' } } }] }]), /^\[INPUT_CHOICE\] c = "b": tslot-20\/no-such-part is not a shipped library part/],
    [withInputs([{ name: 'c', type: 'choice', choices: [{ value: 'a' }, { value: 'b' }], default: 'a', bindings: [{ to: 'component', instance: 'pin', options: { a: { like: 'pin' }, b: { like: 'ghost' } } }] }]), /^\[INPUT_CHOICE\] c = "b": no placed part ghost/],
    [withInputs([n({ to: 'parameter', part: 'base', parameter: 't' })], { variants: [{ name: 'v', values: { x: 99 } }], active: 'w' }), /^\[VARIANT_UNKNOWN\] no variant w/],
  ];
  for (const [d, want] of cases) assert.match(checkVariability(d)[0]?.message ?? 'null', want);
  // (A shipped part that does not build where it is placed — here its hole wider than the cap; a part needing the
  // person's rows that are not loaded comes back the same way — is refused when chosen, typed, with the reason.)
  const cap = withInputs([{ name: 'c', type: 'choice', choices: [{ value: 'a' }, { value: 'b' }], default: 'a', bindings: [{ to: 'component', instance: 'pin', options: { a: { like: 'pin' }, b: { library: 'tslot-20', part: 'end-cap', params: { hole: 40 } } } }] }]);
  assert.deepEqual(checkVariability(cap), []);
  assert.throws(() => variantOf(cap, { c: 'b' }), { message: /^\[INPUT_CHOICE\] c = "b": tslot-20\/end-cap (does not build here|:)/ });
  const good = withInputs([n({ to: 'parameter', part: 'base', parameter: 't' }, { min: 4, max: 12, unit: 'mm' })]);
  assert.throws(() => variantOf(good, { x: 20 }), { message: /^\[INPUT_RANGE\] x = 20: a number from 4 to 12 mm/ });
  assert.throws(() => variantOf(good, { y: 5 }), { message: /^\[INPUT_NAME\] no input y/ });
  assert.throws(() => variantNamed(good, 'none'), { message: /^\[VARIANT_UNKNOWN\] no variant none/ });
});
