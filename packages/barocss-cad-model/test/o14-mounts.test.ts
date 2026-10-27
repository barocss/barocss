import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { cylinderPart, rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, runTool, type ChatState } from '../src/chat/tools';
import { loadPersonRows } from '../src/chat/rows';
import { receivePersonRowFiles } from '../src/engine/rowFiles';
import { validRowSupplies } from '../src/engine/rowSources';
import { mountCommand } from '../src/app/mounts';
import type { Ctx } from '../src/app/commands';
import { editMountRows, checkMountRow, MOUNT_LIMITS, type StudioMountRow } from '../src/engine/mountRows';

// O14: mounts from the person's datasheet rows. The sample rows check; the validator's limits refuse, typed; rows load
// only from a person's file (rows rule b), with receipts; a NEMA 17, a servo (a test row: no datasheet sample), a pillow
// block and a flange unit each cut where their row says — holes' axes and diameters from the exact B-rep faces, the
// volume taken away exactly — and report their axis; a mate on the pilot makes a revolute joint on it; a placed part
// inherits the rows; the refusals; the gates.

const SAMPLE = JSON.parse(readFileSync(resolve(import.meta.dirname, '../samples/rows/mounts.json'), 'utf8')) as { rows: StudioMountRow[] };
const row = (id: string) => SAMPLE.rows.find(r => r.id === id)!;
const SERVO: StudioMountRow = { id: 'servo-test', type: 'servo', holes: { pattern: 'rect', spacing: [48, 10], diameter: 4.2 }, shaft: 6, shaftOffset: [10, 0], shaftHeight: 0, body: [40, 20], clearance: 0.5, estimate: true };
let revision = 1;
const evaluate = async (d: StudioDoc) => evaluateDoc(d, revision++);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok, r.ok ? '' : r.error.title); return { doc, bodies: r.bodies, turnBase: doc }; }
const plate = (rows: StudioMountRow[] = SAMPLE.rows, t = 10): StudioDoc => ({ ...rectanglePart(160, 100, t), mounts: { version: 1, rows } });
const parse = (s: string) => JSON.parse(s) as Record<string, any>;
const cylinders = (b: BodyResult) => b.mesh.faces.flatMap(f => f.exact?.kind === 'cylinder' ? [{ name: f.name, r: +f.exact.r.toFixed(9), c: f.exact.c.map(v => +v.toFixed(6)), a: f.exact.a.map(v => Math.abs(+v.toFixed(9))) }] : []);
async function mounted(doc: StudioDoc, values: Record<string, unknown>) {
  const s = await stateOf(doc), r = await dispatchTool(s, 'run_command', { command: 'mount', faces: ['n1.top'], values }, evaluate);
  return { s, r, out: parse(r.content) };
}
const at = <T>(level: number, f: () => Promise<T>) => { const was = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = String(level); return f().finally(() => { if (was === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = was; }); };

test('O14: the sample rows check; the validator refuses what is outside its limits, typed and named', () => {
  for (const r of [...SAMPLE.rows, SERVO]) assert.deepEqual(checkMountRow(r), [], r.id);
  assert.deepEqual(SAMPLE.rows.map(r => r.id), ['nema17', 'nema23', 'ucp204', 'ucfl204']);
  // (A row with a source cites its maker's page; an estimate lists every field unchecked, and says where each number is from.)
  for (const r of SAMPLE.rows) assert.ok(r.source ? /https:\/\/.*read 2026-10-24/.test(r.source) : r.estimate && r.unchecked!.length === 6 && Object.keys(r.fieldSources!).length >= 4, r.id);
  const n17 = row('nema17'), bad: [Record<string, unknown>, RegExp][] = [
    [{ ...n17, holes: { ...n17.holes, diameter: 0.5 } }, /holes\.diameter is 1–30 mm/],
    [{ ...n17, holes: { pattern: 'square', spacing: 3, diameter: 3.4 } }, /closer than their diameter/],
    [{ ...n17, clearance: MOUNT_LIMITS.clearance[1] + 1 }, /clearance is 0–5 mm/],
    [{ ...n17, pilot: 40 }, /the pilot cut .* runs into the holes/],
    [{ ...n17, pilot: 4 }, /must be wider than the shaft/],
    [{ ...SERVO, body: [50, 20] }, /body's cut-out .* runs into the holes/],
    [{ ...SERVO, body: undefined }, /a servo row gives its body/],
    [{ ...n17, estimate: undefined }, /cite its source or say estimate: true/],
    [{ ...n17, torque: 1 }, /unknown field torque/],
    [{ ...n17, holes: { pattern: 'circle', pcd: 40, count: 20, diameter: 3 } }, /count \(2–12\)/],
  ];
  for (const [r, want] of bad) { const p = checkMountRow(r)[0]?.message; assert.ok(p?.startsWith('[MOUNT_RANGE] mount row nema17') || p?.startsWith('[MOUNT_RANGE] mount row servo-test'), String(p)); assert.match(p!, want); }
});

test('O14: rows load only from a person\'s file, with receipts; a row a mount uses stays', async () => {
  const none = loadPersonRows(rectanglePart(10, 10, 2), 'mounts', 'f1');
  assert.ok('error' in none && /ROWS_NOT_FROM_PERSON/.test(none.error));
  const context = receivePersonRowFiles('0123456789abcdef01234567', [{ name: 'mounts.json', text: JSON.stringify(SAMPLE), turn: 1 }], 1);
  const r = loadPersonRows(rectanglePart(10, 10, 2), 'mounts', context.files[0].id, undefined, context);
  assert.ok('doc' in r, JSON.stringify(r)); assert.equal(r.doc.mounts!.rows.length, 4);
  assert.deepEqual(validRowSupplies(r.doc).filter(x => x.kind === 'mounts').map(x => x.id), ['nema17', 'nema23', 'ucp204', 'ucfl204']);
  const { r: m } = await mounted(plate(), { row: 'nema17', x: 80, y: 50 });
  const held = editMountRows(m.state.doc, [], ['nema17']);
  assert.ok('error' in held && /mount row nema17 is used by a mount/.test(held.error));
});

test('O14: a NEMA 17 on a plate — four Ø3.4 holes 31 apart and the Ø23 pilot through, on their axes; the volume taken exactly; its axis reported', async () => {
  const { s, r, out } = await mounted(plate(), { row: 'nema17', x: 80, y: 50 });
  assert.ok(!r.isError, r.content);
  assert.deepEqual(out.mount.axis, { position: [80, 50, 10], direction: [0, 0, 1] });
  assert.equal(out.mount.estimate, true); assert.equal(out.mount.unchecked.length, 6);
  const e = await evaluate(r.state.doc); assert.ok(e.ok);
  const cyl = cylinders(e.bodies[0]), at = (rr: number) => cyl.filter(c => c.r === rr).map(c => c.c.slice(0, 2).join(',')).sort();
  assert.deepEqual(at(1.7), ['64.5,34.5', '64.5,65.5', '95.5,34.5', '95.5,65.5']);
  assert.deepEqual(at(11.5), ['80,50']);
  assert.ok(cyl.every(c => c.a[2] === 1));
  const want = s.bodies[0].volume! - 10 * Math.PI * (4 * 1.7 ** 2 + 11.5 ** 2);
  assert.ok(Math.abs(e.bodies[0].volume! - want) < 1e-6 * want, `${e.bodies[0].volume} vs ${want}`);
  // (The last hole remembers the command: the row it came from.)
  const last = r.state.doc.nodes[r.state.doc.nodes.length - 1] as { made?: { command: string; values: Record<string, unknown>; nodes?: number } };
  assert.deepEqual([last.made?.command, last.made?.values.row, last.made?.nodes], ['mount', 'nema17', 5]);
  // (A recess its depth instead, the shaft's hole through it; turned a quarter, the pattern is the same square.)
  const rec = await mounted(plate(), { row: 'nema17', x: 80, y: 50, pilot: 'recess', turn: '90' }), e2 = await evaluate(rec.r.state.doc); assert.ok(e2.ok);
  const v2 = s.bodies[0].volume! - 10 * Math.PI * 4 * 1.7 ** 2 - 2 * Math.PI * 11.5 ** 2 - 8 * Math.PI * 3 ** 2;
  assert.ok(Math.abs(e2.bodies[0].volume! - v2) < 1e-6 * v2, `${e2.bodies[0].volume} vs ${v2}`);
});

test('O14: a servo\'s body cut through, its shaft off-centre; a pillow block\'s two bolts and its axis along the face at its height; a flange unit\'s shaft through', async () => {
  const sv = await mounted(plate([SERVO]), { row: 'servo-test', x: 90, y: 50 }); assert.ok(!sv.r.isError, sv.r.content);
  const e = await evaluate(sv.r.state.doc); assert.ok(e.ok);
  const v = sv.s.bodies[0].volume! - 10 * (41 * 21 + 4 * Math.PI * 2.1 ** 2);
  assert.ok(Math.abs(e.bodies[0].volume! - v) < 1e-6 * v, `${e.bodies[0].volume} vs ${v}`);
  assert.deepEqual(cylinders(e.bodies[0]).map(c => c.c.slice(0, 2).join(',')).sort(), ['104,45', '104,55', '56,45', '56,55'], 'the tabs\' holes about the body, the body 10 mm behind the shaft');
  const pb = await mounted(plate(), { row: 'ucp204', x: 80, y: 50 }); assert.ok(!pb.r.isError, pb.r.content);
  assert.deepEqual(pb.out.mount.axis, { position: [80, 50, 43.3], direction: [0, 1, 0] });
  const e2 = await evaluate(pb.r.state.doc); assert.ok(e2.ok);
  assert.deepEqual(cylinders(e2.bodies[0]).map(c => `${c.r}@${c.c.slice(0, 2).join(',')}`).sort(), ['6.5@127.5,50', '6.5@32.5,50']);
  const turned = await mounted({ ...rectanglePart(200, 200, 10), mounts: { version: 1, rows: SAMPLE.rows } }, { row: 'ucp204', x: 100, y: 100, turn: '90' });
  assert.deepEqual(turned.out.mount.axis.direction, [-1, 0, 0]);
  const fl = await mounted(plate(), { row: 'ucfl204', x: 80, y: 50 }), e3 = await evaluate(fl.r.state.doc); assert.ok(e3.ok);
  assert.deepEqual(cylinders(e3.bodies[0]).map(c => c.r).sort((a, b) => a - b), [6, 6, 11]);
});

test('O14: refusals — no rows, no such row, off the face, a recess as deep as the plate, a bearing not loaded or of another bore, a face that is not flat', async () => {
  const cases: [StudioDoc, Record<string, unknown>, RegExp][] = [
    [rectanglePart(160, 100, 10), { row: 'nema17', x: 80, y: 50 }, /^\[MOUNT_ROW\] no mount rows loaded/],
    [plate(), { row: 'nema34', x: 80, y: 50 }, /^\[MOUNT_ROW\] no mount row nema34 \(rows: nema17, nema23, ucp204, ucfl204\)/],
    [plate(), { row: 'nema17', x: 5, y: 50 }, /^\[MOUNT_RANGE\] nema17's bolt 1 .* is off the face/],
    [plate(SAMPLE.rows, 2), { row: 'nema17', x: 80, y: 50, pilot: 'recess' }, /^\[MOUNT_RANGE\] nema17's pilot recess \(2 deep\) is as deep as the face's 2 mm/],
    [plate([{ ...row('ucp204'), bearing: 'UC204' }]), { row: 'ucp204', x: 80, y: 50 }, /^\[MOUNT_ROW\] mount row ucp204 names bearing row UC204, not loaded/],
    [{ ...plate([{ ...row('ucp204'), bearing: '6205' }]), bearings: { version: 1, rows: [{ id: '6205', bore: 25, outside: 52, width: 15, estimate: true }] } }, { row: 'ucp204', x: 80, y: 50 }, /^\[MOUNT_RANGE\] mount row ucp204: its bearing 6205's bore Ø25 is not its shaft Ø20/],
  ];
  for (const [doc, values, want] of cases) {
    const { s, r, out } = await mounted(doc, values);
    // (As every command's refusal: after its label when its values are checked, "Mount: [MOUNT_ROW] …".)
    assert.ok(r.isError, JSON.stringify(values)); assert.match(out.error.replace(/^Mount: /, ''), want); assert.equal(r.state, s);
  }
  const cyl = { ...cylinderPart(20, 30), mounts: { version: 1 as const, rows: SAMPLE.rows } }, s = await stateOf(cyl);
  const side = s.bodies[0].mesh.faces.find(f => f.kind === 'curved')!.name;
  const r = await dispatchTool(s, 'run_command', { command: 'mount', faces: [side], values: { row: 'nema17' } }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /\[MOUNT_FACE\] a mount goes on a flat face/);
});

test('O14: a placed part inherits the rows; a concentric mate on the pilot puts a revolute joint on the motor\'s axis', async () => {
  const motorPlate: PartInstance = { id: 'p1', name: 'motor plate', doc: rectanglePart(160, 100, 10), position: [0, 0, 50], rotation: [0, 0, 0], grounded: true };
  const asm: StudioDoc = { ...rectanglePart(20, 20, 4), mounts: { version: 1, rows: SAMPLE.rows }, instances: [motorPlate] };
  const s = await stateOf(asm), r = await dispatchTool(s, 'run_command', { command: 'mount', part: 'p1', faces: ['n1.top'], values: { row: 'nema17', x: 80, y: 50 } }, evaluate);
  assert.ok(!r.isError, r.content); assert.equal(r.state.doc.instances![0].doc.mounts, undefined, 'the part keeps none of its own');
  const pilot = cylinders((await evaluate(r.state.doc.instances![0].doc) as { bodies: BodyResult[] }).bodies[0]).find(c => c.r === 11.5)!.name;
  let st: ChatState = { ...r.state, bodies: s.bodies };
  st = (await dispatchTool(st, 'add_part', { name: 'shaft' }, evaluate)).state;
  st = (await dispatchTool(st, 'run_command', { part: 'p2', command: 'cylinder', values: { r: 11.5, h: 40, x: 0, y: 0, z: 0 } }, evaluate)).state;
  const shaftSide = cylinders((await evaluate(st.doc.instances![1].doc) as { bodies: BodyResult[] }).bodies[0])[0].name;
  const mate = await dispatchTool(st, 'add_mate', { kind: 'concentric', a: { part: 'p1', face: pilot }, b: { part: 'p2', face: shaftSide } }, evaluate);
  assert.ok(!mate.isError, mate.content);
  const j = parse((await dispatchTool(mate.state, 'get_joints', {}, evaluate)).content).joints.find((x: { child: string }) => x.child === 'p2');
  assert.ok(j && (j.type === 'continuous' || j.type === 'revolute' || j.type === 'fixed' || j.type === 'prismatic'), JSON.stringify(j));
  assert.deepEqual(j.axis.map((v: number) => Math.abs(+v.toFixed(9))), [0, 0, 1]);
  assert.deepEqual(j.origin.slice(0, 2).map((v: number) => +v.toFixed(6)), [80, 50]);
});

test('O14: the gates — a mount adds features: proposed at L1 and L2, applied at L3', async () => {
  const s = await stateOf(plate()), call = { command: 'mount', faces: ['n1.top'], values: { row: 'nema17', x: 80, y: 50 } };
  for (const level of [1, 2]) { const r = await at(level, () => runTool(s, 'run_command', call, evaluate)); assert.ok(r.isError, `L${level}`); assert.equal(r.state, s); }
  const r3 = await at(3, () => runTool(s, 'run_command', call, evaluate)); assert.ok(!r3.isError, r3.content);
});

test('O14: the Mount command\'s steps show the output axis the run reports (a flange\'s out of the face, a pillow block\'s along it)', async () => {
  const doc = plate(), e = await evaluate(doc); assert.ok(e.ok); const bodies = e.bodies, top = bodies[0].mesh.faces.findIndex(f => f.name === 'n1.top');
  const ctx: Ctx = { doc, bodies, selection: { faces: [{ body: 0, face: top }], edges: [], bodies: [] } };
  const axis = (v: Record<string, string | number>) => mountCommand.steps!(ctx, v).find(s => s.label === 'Axis')?.text;
  assert.equal(axis({ row: 'nema17', x: 80, y: 50, turn: '0' }), 'at (80, 50, 10) mm, along +Z');
  assert.equal(axis({ row: 'ucp204', x: 80, y: 50, turn: '0' }), 'at (80, 50, 43.3) mm, along +Y');
  assert.equal(axis({ row: 'nema17', x: Number.NaN, y: 50 }), undefined, 'no axis until it is placed');
});

test('R7 mount rows: canonical fields keep provenance and reject former field names', () => {
  const n17 = row('nema17');
  assert.deepEqual(n17.unchecked, ['holes', 'pilot', 'pilotDepth', 'shaft', 'shaftHeight', 'clearance']);
  assert.deepEqual([n17.pilot, n17.pilotDepth, n17.shaft, n17.shaftHeight, n17.clearance, n17.estimate], [22, 2, 5, 0, 0.5, true]);
  assert.ok(n17.fieldSources?.pilot?.startsWith('an estimate:'));
  for (const old of ['pilotMM', 'pilotDepthMM', 'shaftOffsetMM', 'shaftHeightMM', 'bodyMM']) {
    const p = checkMountRow({ ...n17, [old]: 1 })[0];
    assert.equal(p.code, 'MOUNT_RANGE'); assert.ok(p.message.includes(`unknown field ${old}`));
  }
  assert.equal(checkMountRow({ ...row('ucp204'), holes: { pattern: 'circle', pcdMM: 95, count: 2, diameter: 13 } })[0].code, 'MOUNT_RANGE');
  assert.equal(checkMountRow({ ...n17, unchecked: ['pilotMM'] })[0].code, 'MOUNT_RANGE');
  assert.equal(checkMountRow({ ...n17, fieldSources: { pilotMM: 'unchanged source' } })[0].code, 'MOUNT_RANGE');
});
