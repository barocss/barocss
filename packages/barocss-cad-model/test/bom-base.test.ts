import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { bomPanelData } from '../src/bom/bom';
import { part } from '../src/api/index';
import { withLook } from '../src/app/bodies';
import { bomView, checkBom, deriveBom } from '../src/team/assembly';
import { personFile } from './person-file';

// O169 (A9's F10): an assembly's base part makes things too. A welded table frame as the base with one placed plate: the
// frame's members are made BOM lines a cut-list row (section, length, material), each Σ volume · density by its material,
// and the total mass is the parts' and the base part's; the BOM checks out. A part with no placed parts stays its one line.
const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const A = 40 ** 2 - 34 ** 2, STEEL = 7.85e-3, AL = 2.7e-3;
async function frame(withPart: boolean): Promise<StudioDoc> {
  const sections = personFile('sections.json', [{ id: 'R40', section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, estimate: true }]);
  let s: ChatState = { doc: emptyDoc(), bodies: [], rowFiles: sections.rowFiles };
  const call = async (tool: string, args: Record<string, unknown>) => { const r = await dispatchTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); s = r.state; };
  await call('features', { action: 'frame_sections', file: sections.file });
  await call('features', { action: 'command', command: 'frame', values: { skeleton: 'table', W: 400, D: 300, H: 300, x: 0, y: 0, z: 0, section: 'library', row: 'R40', corners: 'butt' } });
  await call('features', { action: 'material', material: 'steel' });
  return withPart ? { ...s.doc, instances: [{ id: 'p1', name: 'Plate', doc: rectanglePart(100, 80, 10), position: [0, 0, 320], rotation: [0, 0, 0] }] } : s.doc;
}

test('O169: a frame as the base with a placed plate — its members a made line a cut-list row, steel by volume; the total the parts\' and the base\'s; checkBom clean', async () => {
  const doc = await frame(true), view = await bomView(doc, evaluate), bom = deriveBom(view);
  const members = bom.lines.filter(l => l.member).map(l => [l.item, l.qty, l.material, +l.mass.toFixed(3), l.parts.every(p => p.startsWith('base:'))]);
  assert.deepEqual(members, [[320, 4], [360, 2], [260, 2]].map(([L, n]) => [`rect-tube 40 × 40 × 3 × ${L}`, n, 'steel', +(n * A * L * STEEL).toFixed(3), true]));
  assert.deepEqual(checkBom(view, bom), []);
  const plate = bom.lines.find(l => l.item === 'Plate')!;
  assert.ok(Math.abs(bom.totalMass - (plate.mass + view.base!.mass)) < 1e-6 && Math.abs(view.base!.mass - A * 2520 * STEEL) < 1e-2, `${bom.totalMass} = ${plate.mass} + ${view.base!.mass}`);
  assert.equal(bom.totalQty, 1, 'the placed parts');
});

test('O169: a single frame part (no placed parts) stays its own one line, weighed by its material (steel), not by the default\'s density', async () => {
  const data = await bomPanelData(await frame(false), evaluate);
  assert.deepEqual([data.single, data.bom.lines.map(l => [l.item, l.qty, l.material]), data.bom.lines.some(l => l.member)], [true, [['this part', 1, 'steel']], false]);
  assert.ok(Math.abs(data.bom.totalMass - A * 2520 * STEEL) < 1e-2 && Math.abs(data.bom.totalMass - A * 2520 * AL) > 1, String(data.bom.totalMass));
});

test('the standalone BOM lists one known material only when every body uses it', async () => {
  const doc = part().box({ w: 20, d: 10, h: 10 }).box({ w: 20, d: 10, h: 10, x: 40 }).doc;
  const result = evaluateDoc(doc, 1);
  assert.ok(result.ok);
  assert.equal(result.bodies.length, 2);
  const [first, second] = result.bodies;
  const aluminium: StudioDoc = { ...doc, brief: { version: 1, material: { basis: 'stated', value: 'al6061', source: 'Use 6061 aluminium.' } } };
  const cases = [
    { name: 'empty', doc: emptyDoc(), material: null, mass: 0 },
    { name: 'unset', doc, material: null, mass: 10.8 },
    { name: 'shared brief', doc: aluminium, material: 'al6061', mass: 10.8 },
    { name: 'one steel override', doc: withLook(aluminium, first, { material: 'steel' }), material: null, mass: 21.1 },
    { name: 'both steel overrides', doc: withLook(withLook(aluminium, first, { material: 'steel' }), second, { material: 'steel' }), material: 'steel', mass: 31.4 },
    { name: 'same unavailable ID', doc: withLook(withLook(doc, first, { material: 'missing-alloy' }), second, { material: 'missing-alloy' }), material: null, mass: 10.8 },
  ];
  for (const sample of cases) {
    const { bom } = await bomPanelData(sample.doc, evaluate);
    assert.deepEqual(bom.lines.map(line => [line.parts, line.qty, line.material, line.mass]),
      [[['base'], 1, sample.material, sample.mass]], sample.name);
    assert.equal(bom.totalMass, sample.mass, sample.name);
  }
});
