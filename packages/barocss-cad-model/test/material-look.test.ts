import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { readStudioDoc } from '../src/engine/migrate';
import type { Report, Requirement } from '../src/engine/schema/spec';
import { APPEARANCES, defaultRender } from '../src/engine/render';
import { lookKey, lookOf, materialIdOf, withLook } from '../src/app/bodies';
import { massBoundOf, massProperties, materialFact } from '../src/analysis/analysis';
import { factsOf } from '../src/chat/observe';
import { linkInertia } from '../src/robot/inertia';
import { printability } from '../src/print/rules';
import { bomView } from '../src/team/assembly';
import { dispatchTool, runTool } from '../src/chat/tools';

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

const LEGACY_MATERIAL = '  retired-Alloy  ';
const CAP: Requirement = {
  id: 'MASS', source: 'The mass must be at most 5 g', hard: true,
  check: { op: '<=', query: { fn: 'mass' }, value: 5, unit: 'g' },
};
const steelBrief: StudioDoc['brief'] = {
  version: 1, material: { value: 'steel', basis: 'stated', source: 'steel' },
};

function open(doc: StudioDoc): StudioDoc {
  const read = readStudioDoc(JSON.stringify(doc));
  assert.ok('doc' in read, JSON.stringify(read));
  return read.doc;
}

async function check(doc: StudioDoc) {
  const built = await evaluate(doc);
  assert.ok(built.ok, JSON.stringify(built));
  const result = await runTool({ doc, bodies: built.bodies }, 'requirements', { action: 'check' }, evaluate);
  assert.equal(result.isError, false, result.content);
  assert.equal(result.changed, false);
  assert.equal(result.state.doc, doc);
  return { bodies: built.bodies, report: JSON.parse(result.content) as Report, policy: result.state.policy };
}

test('D580: schema 3 preserves unresolved body material IDs, including placed and pending definitions', () => {
  for (const material of [LEGACY_MATERIAL, '   ', ' al6061 ', 'STEEL']) {
    const part = { ...rectanglePart(10, 10, 10), bodies: { b1: { material } } };
    const assembly: StudioDoc = { ...emptyDoc(),
      instances: [{ id: 'p1', name: 'Part', doc: part, position: [0, 0, 0], rotation: [0, 0, 0] }],
      pendingParts: { p1: { name: 'Part', rev: 'B', doc: part } },
    };
    assert.equal(open(part).bodies?.b1.material, material);
    const opened = open(assembly);
    assert.equal(opened.instances?.[0].doc.bodies?.b1.material, material);
    assert.equal(opened.pendingParts?.p1.doc.bodies?.b1.material, material);
  }
});

test('D580: Open rejects malformed body material values and still rejects unknown occurrence overrides', () => {
  for (const material of [null, false, 42, {}, []]) {
    const part = { ...rectanglePart(10, 10, 10), bodies: { b1: { material } } };
    const assembly = emptyDoc();
    const occurrence = { id: 'p1', name: 'Part', doc: part, position: [0, 0, 0], rotation: [0, 0, 0] };
    const placed = { ...assembly, instances: [occurrence] };
    const nested = { ...assembly, instances: [{ ...occurrence, id: 'sub', doc: placed }] };
    const pending = { ...assembly, pendingParts: { p1: { name: 'Part', rev: 'B', doc: part } } };
    for (const doc of [part, nested, pending]) {
      const read = readStudioDoc(JSON.stringify(doc));
      assert.ok('error' in read, `material ${JSON.stringify(material)}`);
      assert.match(read.error, /material/i);
      assert.match(read.error, /b1/);
    }
  }
  const doc = { ...emptyDoc(), instances: [{
    id: 'p1', name: 'Part', doc: rectanglePart(10, 10, 10), position: [0, 0, 0], rotation: [0, 0, 0],
    looks: { b1: { material: LEGACY_MATERIAL } },
  }] };
  const read = readStudioDoc(JSON.stringify(doc));
  assert.ok('error' in read);
  assert.match(read.error, /instances\[0\].*material of b1.*not a material of the library/);
});

test('D580: unresolved IDs retain estimated mass and make hard and soft mass checks unknown', async () => {
  const doc = open({
    ...rectanglePart(10, 10, 10), bodies: { b1: { material: LEGACY_MATERIAL } },
    requirements: [CAP, { ...CAP, id: 'PREFERENCE', hard: false }],
  });
  const { bodies, report, policy } = await check(doc);
  const expected = { material: 'Aluminium 6061', assumed: true, unresolved_material: LEGACY_MATERIAL };
  assert.deepEqual(materialFact(doc, bodies[0]), expected);
  const facts = factsOf(doc, bodies);
  assert.deepEqual([facts.mass, facts.mass_assumed, facts.materials], [2.7, true, [{ body: 'b1', ...expected }]]);
  const [mass] = massProperties(doc, bodies);
  assert.deepEqual([mass.body, mass.mass, mass.material, mass.assumed, mass.unresolved_material], ['b1', 2.7, expected.material, true, LEGACY_MATERIAL]);
  assert.deepEqual(report.summary, { pass: 0, fail: 0, unknown: 2, hard_failing: 0 });
  assert.deepEqual(report.unknowns.map(x => x.req_id), ['MASS', 'PREFERENCE']);
  for (const { why } of report.unknowns) {
    assert.ok(why.includes('b1'), why);
    assert.ok(why.includes(LEGACY_MATERIAL), why);
  }
  assert.deepEqual(policy?.passedHard, []);
  assert.equal(policy?.best?.hardFulfilled, false);

  for (const [material, grams, pass, fail, unknown] of [
    ['al6061', 2.7, 2, 0, 0], ['steel', 7.85, 0, 2, 0], [undefined, 2.7, 0, 0, 2],
  ] as const) {
    const repaired = open(withLook(doc, bodies[0], { material }));
    const result = await check(repaired);
    const repairedFacts = factsOf(repaired, result.bodies);
    assert.equal(repairedFacts.mass, grams);
    assert.equal(repairedFacts.mass_assumed, material === undefined);
    assert.ok(!Object.hasOwn(repairedFacts.materials[0], 'unresolved_material'));
    assert.deepEqual(result.report.summary, { pass, fail, unknown, hard_failing: fail ? 1 : 0 });
  }
});

test('D580: only a missing or empty body material inherits the brief, and volume and known mass scopes still pass', async () => {
  const base = rectanglePart(10, 10, 10);
  const two = withNode(withNode(base, { kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [30, 10] }), { kind: 'extrude', sketch: 2, height: 10 });
  const doc = open({
    ...two, brief: steelBrief, bodies: { b1: { material: ' al6061 ' }, b3: { material: '' } },
    requirements: [
      { ...CAP, id: 'TOTAL' },
      { ...CAP, id: 'INHERITED', check: { op: '==', query: { fn: 'mass', body: 'b3' }, value: 7.85, tol: 1e-8, unit: 'g' } },
      { ...CAP, id: 'VOLUME', check: { op: '==', query: { fn: 'volume' }, value: 2000, tol: 1e-8, unit: 'mm^3' } },
    ],
  });
  const { bodies, report, policy } = await check(doc);
  assert.deepEqual(factsOf(doc, bodies).materials, [
    { body: 'b1', material: 'Aluminium 6061', assumed: true, unresolved_material: ' al6061 ' },
    { body: 'b3', material: 'Steel (mild)', assumed: false },
  ]);
  assert.deepEqual(report.summary, { pass: 2, fail: 0, unknown: 1, hard_failing: 0 });
  assert.deepEqual(report.unknowns.map(x => x.req_id), ['TOTAL']);
  assert.deepEqual(policy?.passedHard, ['INHERITED', 'VOLUME']);
  const removed = withLook(doc, bodies[0], { material: undefined });
  const inherited = await check(removed);
  assert.deepEqual(inherited.report.summary, { pass: 2, fail: 1, unknown: 0, hard_failing: 1 });
  assert.equal(factsOf(removed, inherited.bodies).mass, 15.7);

  for (const material of ['   ', 'STEEL', null, 42]) {
    const direct: StudioDoc = { ...base, brief: steelBrief, requirements: [CAP], bodies: { b1: { material: material as string } } };
    const result = await check(direct);
    const fact = materialFact(direct, result.bodies[0]);
    assert.equal(fact.assumed, true);
    assert.equal(massProperties(direct, result.bodies)[0].mass, 2.7);
    assert.deepEqual(result.report.summary, { pass: 0, fail: 0, unknown: 1, hard_failing: 0 });
    if (typeof material === 'string') assert.equal(fact.unresolved_material, material);
    else assert.ok(!Object.hasOwn(fact, 'unresolved_material'));
  }
});

test('D580: an empty authored ID and a stated brief use one density across mass and BOM', async () => {
  const part = open({ ...rectanglePart(10, 10, 10), brief: steelBrief, bodies: { b1: { material: '' } } });
  const result = await evaluate(part);
  assert.ok(result.ok);
  const [body] = result.bodies;
  assert.equal(materialIdOf(part, body), 'steel');
  assert.equal(massProperties(part, result.bodies)[0].mass, 7.85);
  assert.equal(massBoundOf(part, [{ ...body, volumeBasis: { method: 'tessellated', bound: 125 } }]), 125 * 7.85 / 1000);
  const assembly: StudioDoc = { ...part, instances: [{ id: 'p1', name: 'Part', doc: part,
    position: [20, 0, 0], rotation: [0, 0, 0] }] };
  const view = await bomView(assembly, evaluate);
  assert.equal(view.base?.mass, 7.85);
  assert.equal(view.base?.others[0]?.mass, 7.85);
  assert.deepEqual([view.parts[0]?.material, view.parts[0]?.mass], ['steel', 7.85]);
});
