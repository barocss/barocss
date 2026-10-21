import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { withLook } from '@barocss/cad-model/app/bodies';
import { printability } from '@barocss/cad-model/print/rules';
import { dispatchTool, type ChatState } from '@barocss/cad-model/chat/tools';
import { checkMaterials, MATERIALS_DATA, materialData, processProfile } from '@barocss/cad-model/library/materials';

// IM8a (O106): casting's presets, against closed forms — die casting's least wall and draft per alloy family read off
// eFunda's table, its achievable draft and tolerance off Dynacast's guide (the tolerance the looser end, inches × 25.4),
// aluminium's typical wall off Dynacast's FAQ; sand casting's least walls off Engineers Edge (inches × 25.4) and its
// 1° least and 2° standard draft. A block drafted θ on each side of every draft limit, a shelled box of wall t on each
// side of every wall limit; a family with no value read is unknown, a wrought alloy is not a casting alloy.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies; };
const cast = (doc: StudioDoc, process: string, material: string | null, pull: [number, number, number] | null = [0, 0, 1]): StudioDoc => {
  const d: StudioDoc = { ...doc, process, ...(pull ? { mould: { version: 1, pull } } : {}) };
  return material ? withLook(d, bodiesOf(d)[0], { material }) : d;
};
/** A 40 × 30 × 20 block, its sides drafted θ. */
const block = (draft: number) => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 30] }), { kind: 'extrude', sketch: 0, height: 20, ...(draft ? { draft } : {}) } as never);
/** A 60 × 40 × 25 box shelled to t, open at the top. */
async function shelled(t: number): Promise<StudioDoc> {
  let s = { doc: emptyDoc(), bodies: [], turnBase: emptyDoc() } as never as ChatState;
  for (const [command, values, sel] of [['box', { w: 60, d: 40, h: 25, x: 0, y: 0, z: 0 }, {}], ['shell', { t }, { faces: ['n1.top'] }]] as const) {
    const r = await dispatchTool(s, 'run_command', { command, values, ...sel }, evaluate); assert.ok(!r.isError, r.content); s = r.state;
  }
  return s.doc;
}
const report = async (d: StudioDoc) => printability(d, bodiesOf(d), evaluate);
const rule = async (d: StudioDoc, id: string) => (await report(d)).rules.find(r => r.id === id)!;
const value = (process: string, key: string) => processProfile(process)!.thresholds[key];

test('IM8a the data: every casting limit names its page (a derived one its rule); the values as read — zinc 0.6 mm and 0.25°/0.5°, aluminium 0.9 mm (2 typical) and 0.5°/1°, brass 1.25 mm and 0.7°; ±0.002 in and ±0.004 in as 0.0508 and 0.1016 mm; sand 0.10 and 0.13 in as 2.54 and 3.302 mm, draft 1° least, 2° standard', () => {
  assert.deepEqual(checkMaterials(MATERIALS_DATA), []);
  for (const p of ['die-casting', 'sand-casting']) for (const [k, t] of Object.entries(processProfile(p)!.thresholds)) {
    assert.ok(t.page && /^https:\/\//.test(t.page.url) && t.page.read === '2026-10-21', `${p}.${k}`);
    assert.ok(t.source === 'W-WEB' || (t.source === 'W-DERIVED' && /× 25\.4 mm\/in/.test(t.page.note ?? '')), `${p}.${k}: ${t.source}`);
  }
  const die = (k: string) => value('die-casting', k).value, sand = (k: string) => value('sand-casting', k).value;
  assert.deepEqual([die('zincWallMinMM'), die('zincDraftMinDeg'), die('zincDraftRecDeg'), die('aluminiumWallMinMM'), die('aluminiumWallRecMM'), die('aluminiumDraftMinDeg'), die('aluminiumDraftRecDeg'), die('copperWallMinMM'), die('copperDraftMinDeg')], [0.6, 0.25, 0.5, 0.9, 2, 0.5, 1, 1.25, 0.7]);
  assert.ok(Math.abs(die('zincTolMM') - 0.002 * 25.4) <= 1e-12 && Math.abs(die('aluminiumTolMM') - 0.004 * 25.4) <= 1e-12);
  assert.ok(Math.abs(sand('aluminiumWallMinMM') - 0.10 * 25.4) <= 1e-12 && Math.abs(sand('magnesiumWallMinMM') - 0.13 * 25.4) <= 1e-12 && Math.abs(sand('steelWallMinMM') - 0.13 * 25.4) <= 1e-12);
  assert.deepEqual([sand('draftMinDeg'), sand('draftRecDeg')], [1, 2]);
  assert.deepEqual(['zamak3', 'a380', 'az91d', 'a356', 'brass', 'steel', 'al6061'].map(id => materialData(id)!.castFamily ?? null), ['zinc', 'aluminium', 'magnesium', 'aluminium', 'copper', 'steel', null]);
});

test('IM8a die-casting draft: a block drafted θ — zinc passes 0.75° and 0.5°, warns 0.4° (under 0.5° achievable), fails 0.2° (under 0.25° least); aluminium passes 1.5°, warns 0.75°, fails 0.4°; the four sides named', async () => {
  for (const [material, draft, status] of [['zamak3', 0.75, 'pass'], ['zamak3', 0.5, 'pass'], ['zamak3', 0.4, 'warn'], ['zamak3', 0.2, 'fail'], ['a380', 1.5, 'pass'], ['a380', 0.75, 'warn'], ['a380', 0.4, 'fail']] as const) {
    const r = await rule(cast(block(draft), 'die-casting', material), 'draft');
    assert.equal(r.status, status, `${material} ${draft}°: ${r.message}`);
    assert.ok(Math.abs(r.value! - draft) <= 1e-6, `${r.value}`);
    if (status !== 'pass') assert.deepEqual([...r.entities!].sort(), ['n1.side0', 'n1.side1', 'n1.side2', 'n1.side3']);
  }
});

test('IM8a sand-casting draft: aluminium (A356) fails 0.75° (under 1° least), warns 1.5° (under 2° standard), passes 2.5°', async () => {
  for (const [draft, status] of [[0.75, 'fail'], [1.5, 'warn'], [2.5, 'pass']] as const) assert.equal((await rule(cast(block(draft), 'sand-casting', 'a356'), 'draft')).status, status, `${draft}°`);
});

test('IM8a walls: a box shelled to t — die-cast zinc passes 0.8; aluminium fails 0.8 (under 0.9), warns 1.5 (under 2 typical), passes 2.5; sand-cast aluminium fails 2, passes 3; sand-cast steel fails 3, passes 3.5', async () => {
  for (const [t, process, material, status] of [[0.8, 'die-casting', 'zamak3', 'pass'], [0.8, 'die-casting', 'a380', 'fail'], [1.5, 'die-casting', 'a380', 'warn'], [2.5, 'die-casting', 'a380', 'pass'], [2, 'sand-casting', 'a356', 'fail'], [3, 'sand-casting', 'a356', 'pass'], [3, 'sand-casting', 'steel', 'fail'], [3.5, 'sand-casting', 'steel', 'pass']] as const) {
    const r = await rule(cast(await shelled(t), process, material), 'wall');
    assert.equal(r.status, status, `${process} ${material} t ${t}: ${r.message}`);
    assert.ok(Math.abs(r.value! - t) <= 1e-3, `${r.value}`);
  }
});

test('IM8a the unknowns, said: no material; a wrought alloy (6061) is not a casting alloy (fails); magnesium in die casting has no value read; brass has no tolerance; sand casting none; no pull, no draft', async () => {
  const none = await report(cast(block(1), 'die-casting', null));
  assert.deepEqual(['material', 'wall', 'draft', 'tolerance'].map(id => none.rules.find(r => r.id === id)!.status), ['unknown', 'unknown', 'unknown', 'unknown']);
  const wrought = await report(cast(block(1), 'die-casting', 'al6061'));
  assert.equal(wrought.rules.find(r => r.id === 'material')!.status, 'fail'); assert.match(wrought.rules.find(r => r.id === 'wall')!.why!, /not a casting alloy/);
  const mg = await report(cast(block(1), 'die-casting', 'az91d'));
  assert.deepEqual(['material', 'wall', 'draft', 'tolerance'].map(id => mg.rules.find(r => r.id === id)!.status), ['unknown', 'unknown', 'unknown', 'unknown']);
  assert.match(mg.rules.find(r => r.id === 'wall')!.why!, /no least wall for a magnesium alloy in die casting was read/);
  const brass = await report(cast(block(1), 'die-casting', 'brass'));
  assert.deepEqual([brass.rules.find(r => r.id === 'draft')!.status, brass.rules.find(r => r.id === 'tolerance')!.status], ['pass', 'unknown']);
  assert.equal((await rule(cast(block(3), 'sand-casting', 'a356'), 'tolerance')).status, 'unknown');
  const noPull = await report(cast(block(1), 'die-casting', 'zamak3', null));
  assert.deepEqual([noPull.rules.find(r => r.id === 'pull')!.status, noPull.rules.find(r => r.id === 'draft')!.status], ['unknown', 'unknown']);
});

test('IM8a the report through the tool: die-cast zinc — its process, family and ±0.0508 mm with its page; every rule named; the v2 action reads the same', async () => {
  const doc = cast(block(1), 'die-casting', 'zamak3'), s = { doc, bodies: bodiesOf(doc) } as never as ChatState;
  const r = await dispatchTool(s, 'check_printability', {}, evaluate), j = JSON.parse(r.content);
  assert.ok(!r.isError, r.content);
  assert.deepEqual([j.process, j.casting.family, j.casting.tolerance.mm, j.casting.tolerance.page], ['die-casting', 'zinc', 0.0508, 'https://www.dynacast.com/resources/article/a-beginners-guide-to-die-cast-design']);
  // (IM8b's two rules between: die casting has no shrinkage read, and no face is marked machined.)
  assert.deepEqual(j.rules.map((x: { id: string; status: string }) => [x.id, x.status]), [['material', 'pass'], ['pull', 'pass'], ['wall', 'pass'], ['draft', 'pass'], ['shrink', 'unknown'], ['machining-allowance', 'n/a'], ['tolerance', 'pass']]);
  assert.equal((await dispatchTool(s, 'query', { action: 'manufacturability' }, evaluate)).content, r.content);
});
