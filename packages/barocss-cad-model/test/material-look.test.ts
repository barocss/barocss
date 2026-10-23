import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { APPEARANCES, defaultRender } from '../src/engine/render';
import { lookKey, lookOf, materialIdOf, withLook } from '../src/app/bodies';
import { massProperties } from '../src/chat/analysis';
import { linkInertia } from '../src/robot/inertia';
import { printability } from '../src/print/rules';
import { bomView } from '../src/team/assembly';
import { dispatchTool } from '../src/chat/tools';

// #2177 (O39): an engineering material (its density, its sources) is never inferred from a display look. A body named
// "Steel bracket", coloured as the Steel appearance, with the Steel PBR preset on it and a brief whose finish says steel,
// has no material: mass and inertia say assumed, the BOM none, printability's warp rule unknown. Setting a material
// leaves the looks as they were.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const STEEL = APPEARANCES.find(a => a.id === 'look-steel')!.appearance;
const IDENTITY = { origin: [0, 0, 0] as [number, number, number], R: [1, 0, 0, 0, 1, 0, 0, 0, 1] as [number, number, number, number, number, number, number, number, number] };

async function steelLooking(): Promise<{ doc: StudioDoc; key: string }> {
  const base: StudioDoc = { ...rectanglePart(40, 20, 5), process: 'fdm' }, e = await evaluate(base); assert.ok(e.ok);
  const b = e.bodies[0];
  let doc = withLook(base, b, { name: 'Steel bracket', color: STEEL.color, faces: { 'n1.top': STEEL.color } });
  doc = { ...doc, render: { ...defaultRender(), appearances: { [b.key]: STEEL } } };
  doc = { ...doc, brief: { version: 1, finish: { value: 'brushed steel look', basis: 'stated', source: 'brushed steel look' } } as StudioDoc['brief'] };
  return { doc, key: lookKey(doc.nodes, b) };
}

test('a body that looks like steel by every display field has no material: no consumer infers one from a colour, an appearance or a name', async () => {
  const { doc, key } = await steelLooking(), e = await evaluate(doc); assert.ok(e.ok);
  const b = e.bodies[0];
  assert.equal(lookOf(doc, b).name, 'Steel bracket'); assert.equal(doc.bodies![key].color, STEEL.color);
  assert.equal(materialIdOf(doc, b), undefined);
  const [mp] = massProperties(doc, e.bodies) as { material: string; assumed: boolean }[];
  assert.deepEqual([mp.material, mp.assumed], ['Aluminium 6061', true], 'the default, said as assumed — never steel');
  const li = linkInertia('l', null, doc, e.bodies, IDENTITY);
  assert.ok(li.bodies.every(x => x.assumed), JSON.stringify(li.bodies)); assert.ok(li.issues.some(i => i.code === 'MATERIAL_ASSUMED'));
  const warp = (await printability(doc, e.bodies, evaluate, { direction: [0, 0, 1] })).rules.find(r => r.id === 'warp');
  assert.equal(warp?.status, 'unknown', JSON.stringify(warp)); assert.match(warp!.why ?? warp!.message, /material is not set/);
  // (In an assembly, its BOM line has no material.)
  const asm = (await dispatchTool({ doc: rectanglePart(1, 1, 1), bodies: [] }, 'add_part', { name: 'Steel bracket' }, evaluate)).state.doc;
  const placed: StudioDoc = { ...asm, instances: asm.instances!.map(i => ({ ...i, doc })) };
  assert.equal((await bomView(placed, evaluate)).parts[0].material, null);
});

test('a material set on the body is the only thing that makes it steel; the looks are untouched by it', async () => {
  const { doc } = await steelLooking(), e = await evaluate(doc); assert.ok(e.ok);
  const set = withLook(doc, e.bodies[0], { material: 'steel' });
  assert.equal(materialIdOf(set, e.bodies[0]), 'steel');
  const [mp] = massProperties(set, e.bodies) as { material: string; assumed: boolean }[];
  assert.equal(mp.assumed, false);
  assert.deepEqual(set.render, doc.render); assert.equal(lookOf(set, e.bodies[0]).color, STEEL.color); assert.deepEqual(lookOf(set, e.bodies[0]).faces, lookOf(doc, e.bodies[0]).faces);
  // (And a material changes no look: a different one leaves the colour and the appearance.)
  const pla = withLook(set, e.bodies[0], { material: 'pla' });
  assert.equal(lookOf(pla, e.bodies[0]).color, STEEL.color); assert.deepEqual(pla.render, doc.render);
});

test('O75: the appearance presets and the materials never share an id — every look id is prefixed look-, none is a material id', async () => {
  const { MATERIALS_DATA } = await import('../src/library/materials'), { MATERIALS } = await import('../src/library/materials');
  const looks = APPEARANCES.map(a => a.id), materials = new Set([...MATERIALS_DATA.materials.map(m => m.id), ...MATERIALS.map(m => m.id)]);
  assert.ok(looks.every(id => id.startsWith('look-')), looks.join(', '));
  assert.deepEqual(looks.filter(id => materials.has(id)), []);
  assert.ok(![...materials].some(id => id.startsWith('look-')), 'no material id takes the look prefix');
  assert.equal(new Set(looks).size, looks.length);
});
