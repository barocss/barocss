import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { emptyDoc, withNode, type StudioDoc, type PartInstance } from '../src/engine/doc';
import { exportStudioStep } from '../src/engine/evaluate';
const options = { name: 'exchange', timestamp: '2026-11-01T00:00:00' };
const box = (): StudioDoc => ({ ...emptyDoc(), nodes: [{ id: 'n0', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'n1', kind: 'extrude', sketch: 0, height: 10 }], nextId: 2 });
const occurrence = (id: string, doc: StudioDoc): PartInstance => ({ id, name: `Named ${id}`, doc, position: [0, 0, 0], rotation: [0, 0, 0], part: { id: 'shared', rev: '1' } });
test('actual native parameters, nested visible sharing, names and appearance are reported without changing geometry bytes', () => {
  const plain = box(), decorated = { ...plain, parameters: { width: 10 }, bodies: { b1: { name: 'Red prism', color: '#ff0000', material: 'steel' } } };
  const nested = { ...emptyDoc(), instances: [occurrence('a', decorated), occurrence('b', decorated)] }, doc = { ...emptyDoc(), instances: [occurrence('sub', nested)] };
  const before = JSON.stringify(doc), result = exportStudioStep(doc, options), loss = result.omitted!.join(' ');
  assert.match(loss, /feature history/); assert.match(loss, /parameters/); assert.match(loss, /flattened at their placements/); assert.match(loss, /hierarchy and shared definitions/); assert.match(loss, /User body and occurrence labels/); assert.match(loss, /colours and materials/);
  assert.equal(JSON.stringify(doc), before); assert.equal((result.text.match(/=MANIFOLD_SOLID_BREP\(/g) ?? []).length, 2);
  const native = exportStudioStep(plain, options), named = exportStudioStep({ ...plain, bodies: decorated.bodies }, options);
  assert.equal(native.text.split('DATA;')[1], named.text.split('DATA;')[1], 'appearance metadata does not change exported geometry; source revision in the header still identifies each input');
});
test('plain STEP re-export and hidden occurrences do not invent native history, parameters or appearance losses', () => {
  const plain = exportStudioStep(box(), options), imported: StudioDoc = { ...emptyDoc(), nodes: [{ id: 'n0', kind: 'import', name: 'in.step', step: plain.text }], nextId: 1 };
  const result = exportStudioStep({ ...imported, instances: [{ ...occurrence('hidden', { ...box(), bodies: { b1: { color: '#f00' } } }), hidden: true }] }, options);
  assert.equal(result.omitted, undefined); assert.equal((result.text.match(/=MANIFOLD_SOLID_BREP\(/g) ?? []).length, 1);
});
test('drawing semantic PMI and named reference datums are conditional losses, including visible definitions', () => {
  const part = box();
  const drawing: NonNullable<StudioDoc['drawing']> = { sheet: 'A4', projection: 'third', hidden: true, dimensions: [], datums: [{ id: 'd', letter: 'A', view: 'front', place: [0, 0], face: { face: 'n1.side0', near: [0, 0, 0] } }], datumTargets: [{ id: 'dt', letter: 'A', number: 1, view: 'front', place: [0, 0], kind: 'line', line: { from: [0, 0], to: [1, 0] } }], frames: [{ id: 'fcf', view: 'front', place: [0, 0], characteristic: 'flatness', value: 0.1, datums: [] }] };
  for (const key of ['datums', 'datumTargets', 'frames'] as const) {
    const only = { ...drawing, datums: [], datumTargets: [], frames: [], [key]: drawing[key] };
    assert.match(exportStudioStep({ ...part, drawing: only }, options).omitted!.join(' '), /Drawing sheets, dimensions, annotations and semantic PMI are not included/);
  }
  assert.match(exportStudioStep({ ...part, drawing: { sheet: 'A4', projection: 'third', hidden: true, dimensions: [] } }, options).omitted!.join(' '), /Drawing sheets, dimensions/);
  const referenced: StudioDoc = { ...part, references: { version: 1, references: [], keepouts: [], datums: [{ id: 'datum1', name: 'Inspection origin', kind: 'plane', origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] }] } };
  const nested = exportStudioStep({ ...emptyDoc(), instances: [occurrence('datumPart', referenced)] }, options);
  assert.match(nested.omitted!.join(' '), /Named reference datums and their coordinate systems/);
  const absent = exportStudioStep(part, options).omitted!.join(' '); assert.doesNotMatch(absent, /semantic PMI|Named reference datums/);
});


/** Same actual plain-import fixture and timestamp used by the pre-fix D421 export baseline. */
function nameFixture(): StudioDoc {
  const source = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [4, 3] }), { kind: 'extrude', sketch: 0, height: 2 });
  const step = exportStudioStep(source, { name: 'seed', timestamp: '2026-11-01T00:00:00Z' }).text;
  return withNode(emptyDoc(), { kind: 'import', name: 'seed.step', step });
}
const nameLoss = 'Non-ASCII and control characters in the STEP header file name and product name are replaced with underscores.';
const nameTimestamp = '2026-11-01T00:00:00Z';

test('STEP header/product replacement is an applicable loss without changing the intended export basename', () => {
  const doc = nameFixture(), before = JSON.stringify(doc);
  for (const [name, encoded] of [['München', 'M_nchen'], ['부품', '__'], ['A\nB', 'A_B'], ['A\u007fB', 'A_B'], ['Part😀', 'Part__']]) {
    const result = exportStudioStep(doc, { name, timestamp: nameTimestamp });
    assert.deepEqual(result.omitted, [nameLoss]);
    assert.ok(result.text.includes(`PRODUCT('${encoded}','${encoded}'`));
    assert.ok(result.text.includes(`FILE_NAME('${encoded}.step'`));
    assert.equal(JSON.stringify(doc), before);
  }
});

test('printable ASCII names and lossless quote/backslash escapes add no destructive name-loss report', () => {
  const doc = nameFixture();
  for (const name of ['part', 'plate A_1', "bolt'\\test"]) {
    const result = exportStudioStep(doc, { name, timestamp: nameTimestamp });
    assert.equal(result.omitted, undefined);
  }
  const escaped = exportStudioStep(doc, { name: "bolt'\\test", timestamp: nameTimestamp });
  assert.ok(escaped.text.includes("PRODUCT('bolt''\\\\test','bolt''\\\\test'"));
});

test('D421 loss reporting retains all six pre-fix fixed-timestamp STEP bytes and source keys', () => {
  const doc = nameFixture();
  // Recorded by actual exportStudioStep before the loss-report change, not generated by the predicate under test.
  const baselines = [
    ['part', '56b8a72f1fc851380967abfd745427764ba12812711fc1ec4bdae15b63401b3c'],
    ['plate A_1', '892d46a0f694d1694b3d93744d975c4c28fdb25031de27af8885cf86160ab0cd'],
    ['München', '12e1007d16909ba56dd4b472faf154763e6039d4f4720b42bca25a611ff5af5d'],
    ['부품', '519ff6a7c9d95b6159fdca513ca99606643bbb7a12506b5d4c14ca65bfbf95a5'],
    ['A\nB', 'd8a094a82c9cec5e62a2c33b3f72469fd6de678a487e6f5ed7c3399419040c78'],
    ["bolt'\\test", '0ecc011cbad168efe4960e62dec6c2a790748ecba26112b9021f89cb8f6c0da9'],
  ];
  for (const [name, hash] of baselines) {
    const result = exportStudioStep(doc, { name, timestamp: nameTimestamp });
    assert.equal(createHash('sha256').update(result.text).digest('hex'), hash, name);
    assert.equal(result.source, 'b46faf1dcfd84471');
  }
});
