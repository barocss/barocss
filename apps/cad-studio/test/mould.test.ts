import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS_DATA, checkMaterials, materialData, processProfile, type MaterialsData } from '../src/library/materials';
import { printability } from '../src/print/rules';
import { evaluateDoc, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { withLook } from '../src/app/bodies';
import { dispatchTool } from '../src/chat/tools';

// IM1 (O77): injection moulding's process rule in the manufacturability report — the values sourced page by page
// (Protolabs, read 2026-10-21), the pull and finish on the document, walls against the process and the material's
// moulding range, the largest part; the process judged by named, none assumed.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const rules = async (doc: StudioDoc, o: { direction?: [number, number, number]; finish?: string } = {}) => { const r = await printability(doc, bodiesOf(doc), evaluate, o); return { r, by: Object.fromEntries(r.rules.map(x => [x.id, x])) }; };
const shelled = (w: number, d: number, h: number, t: number): StudioDoc => withNode(withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] }), { kind: 'extrude', sketch: 0, height: h }), { kind: 'shell', parent: { node: 1, side: 'solid' }, thickness: t, open: ['n1.top'] });
const moulded = (doc: StudioDoc, material: string | null = 'abs', mould: StudioDoc['mould'] = { version: 1, pull: [0, 0, 1], finish: 'pm-t1' }): StudioDoc => {
  const d: StudioDoc = { ...doc, process: 'injection', ...(mould ? { mould } : {}) };
  return material ? withLook(d, bodiesOf(d)[0], { material }) : d;
};

test('IM1 data: every web value names its page (https URL, the date read, the page\'s label); the injection profile\'s finishes and limits; ABS, acetal, PC, PP, nylon wall ranges as Protolabs prints them', () => {
  assert.deepEqual(checkMaterials(MATERIALS_DATA), []);
  const inj = processProfile('injection')!;
  assert.deepEqual(inj.finishes!.map(f => [f.id, f.draftMinDeg, f.draftRecDeg ?? null]), [['smooth', 0.5, 1], ['pm-t1', 3, null], ['pm-t2', 5, null]]);
  assert.deepEqual(['maxPartLongMM', 'maxPartWideMM', 'maxPartDepthMM', 'tolMM', 'tolResinMMPerMM'].map(k => inj.thresholds[k].value), [751, 480, 203, 0.08, 0.002]);
  for (const f of inj.finishes!) assert.ok(f.page && f.page.url.startsWith('https://www.protolabs.com/') && f.page.read === '2026-10-21', f.id);
  assert.deepEqual(['abs', 'pom', 'pc', 'pp', 'pa12'].map(id => materialData(id)!.wallMM!.injection), [[1.143, 3.556], [0.762, 3.048], [1.016, 3.81], [0.635, 3.81], [0.762, 2.921]]);
  assert.match(materialData('pom')!.pages!['wallMM.injection'].label, /Acetal/);
  assert.deepEqual(['abs', 'pc', 'pp'].map(id => materialData(id)!.mouldShrink ?? null), [0.002, 0.002, null]);
  // (The checker catches a web value without its page.)
  const broken = JSON.parse(JSON.stringify(MATERIALS_DATA)) as MaterialsData & { profiles: { thresholds: Record<string, { page?: unknown }> }[] };
  delete broken.profiles.find(p => (p as unknown as { id: string }).id === 'injection')!.thresholds.tolMM.page;
  assert.deepEqual(checkMaterials(broken), ['injection.tolMM: a web value needs its page (url, read, label)']);
});

test('IM1 a shelled ABS box 60 × 40 × 25, walls 1.8, pulled along +Z with a PM-T1 finish: judged as moulding; every IM1 rule passes; at least 3° of draft; ABS\'s shrink; draft and undercuts said to come with IM2 and IM3', async () => {
  const { r, by } = await rules(moulded(shelled(60, 40, 25, 1.8)));
  assert.equal(r.process, 'injection'); assert.deepEqual(r.direction, [0, 0, 1]);
  for (const id of ['pull', 'finish', 'wall', 'wall-material', 'size']) assert.equal(by[id].status, 'pass', `${id}: ${JSON.stringify(by[id])}`);
  assert.equal(by.finish.value, 3); assert.equal(by.finish.source, 'W-WEB');
  assert.equal(by['wall-material'].limit, 3.556); assert.ok(Math.abs(by['wall-material'].value! - 1.8) <= 1e-3, String(by['wall-material'].value));
  assert.equal(by.size.value, Math.max(60 / 751, 40 / 480, 25 / 203));
  assert.deepEqual(r.mould, { finish: 'pm-t1', minDraftDeg: 3, recDraftDeg: 3, bodies: [{ body: r.mould!.bodies[0].body, material: 'abs', wallMM: [1.143, 3.556], shrink: 0.002 }] });
  assert.match(by.draft.why!, /IM2/); assert.match(by.undercut.why!, /IM3/);
});

test('IM1 walls: 0.9 mm in ABS is under its range (warned); a solid 20 mm block\'s section over it (warned); 0.5 mm under what fills (fails); acetal\'s 0.762 lets 0.9 pass', async () => {
  let by = (await rules(moulded(shelled(60, 40, 25, 0.9)))).by;
  assert.equal(by['wall-material'].status, 'warn'); assert.equal(by.wall.status, 'pass');
  by = (await rules(moulded(shelled(60, 40, 25, 0.9), 'pom'))).by;
  assert.equal(by['wall-material'].status, 'pass', JSON.stringify(by['wall-material']));
  by = (await rules(moulded(rectanglePart(60, 40, 20)))).by;
  assert.equal(by['wall-material'].status, 'warn'); assert.ok(by['wall-material'].value! > 3.556, String(by['wall-material'].value));
  by = (await rules(moulded(shelled(60, 40, 25, 0.5)))).by;
  assert.equal(by.wall.status, 'fail'); assert.equal(by.wall.limit, 0.6);
});

test('IM1 nothing assumed: no pull — unknown, the size by the sorted sides; too long for any press — fails along a pull, unknown without one; no finish or an unknown one; no material; no process at all', async () => {
  let { r, by } = await rules(moulded(shelled(60, 40, 25, 1.8), 'abs', { version: 1, finish: 'smooth' }));
  assert.equal(by.pull.status, 'unknown'); assert.equal(r.direction, null); assert.equal(by.size.status, 'pass'); assert.match(by.size.why!, /whichever way/);
  ({ by } = await rules(moulded(rectanglePart(800, 40, 2))));
  assert.equal(by.size.status, 'fail'); assert.ok(Math.abs(by.size.value! - 800 / 751) < 1e-9, String(by.size.value));
  ({ by } = await rules(moulded(rectanglePart(800, 40, 2), 'abs', null)));
  assert.equal(by.size.status, 'unknown');
  ({ by } = await rules(moulded(shelled(60, 40, 25, 1.8), 'abs', null), { direction: [0, 0, 1], finish: 'mirror' }));
  assert.equal(by.finish.status, 'unknown'); assert.match(by.finish.why!, /"mirror" is not a finish here: smooth, pm-t1, pm-t2/);
  ({ by } = await rules(moulded(shelled(60, 40, 25, 1.8), null)));
  assert.equal(by['wall-material'].status, 'unknown'); assert.match(by['wall-material'].why!, /its material is not set/);
  ({ r } = await rules(rectanglePart(60, 40, 2)));
  assert.equal(r.process, null); assert.ok(r.rules.every(x => x.status === 'unknown' && /no process is chosen.*none is assumed/.test(x.why!)));
});

test('IM1 through the agent\'s tools: the brief states injection and ABS; check_printability (v1) and query.manufacturability (v2) give the same report, the pull and finish as arguments', async () => {
  let s = { doc: shelled(60, 40, 25, 1.8), bodies: bodiesOf(shelled(60, 40, 25, 1.8)), turns: ['an ABS box, injection moulded'] } as never as Parameters<typeof dispatchTool>[0];
  const r = await dispatchTool(s, 'set_brief', { fields: { purpose: { value: 'a box', basis: 'stated', source: 'box' }, process: { value: 'injection', basis: 'stated', source: 'injection moulded' }, material: { value: 'abs', basis: 'stated', source: 'ABS' } } }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  const v1 = JSON.parse((await dispatchTool(s, 'check_printability', { direction: [0, 0, 1], finish: 'smooth' }, evaluate)).content);
  const v2 = JSON.parse((await dispatchTool(s, 'query', { action: 'manufacturability', direction: [0, 0, 1], finish: 'smooth' }, evaluate)).content);
  assert.deepEqual(v2, v1); assert.equal(v1.process, 'injection');
  assert.deepEqual(v1.rules.filter((x: { status: string }) => x.status === 'pass').map((x: { id: string }) => x.id), ['pull', 'finish', 'wall', 'wall-material', 'size']);
  assert.equal(v1.mould.minDraftDeg, 0.5); assert.equal(v1.mould.recDraftDeg, 1); assert.equal(v1.mould.bodies[0].material, 'abs');
});
