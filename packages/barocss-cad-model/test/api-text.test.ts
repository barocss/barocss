import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkBrep } from '@barocss/cad';
import { BarocssError, fontFromBytes, part, param, type FontSource, type FontSourceMetadata, type StudioPart, type StudioTextOptions } from '../src/api';
import { dropBlobs, getBlob } from '../src/engine/blobs';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';

// Independent fontTools 4.67.0 Green-integral oracle for the unmodified ABeeZee A:
// 148797 square design units, unitsPerEm=1000. This glyph has straight segments only.
const A_AREA = 148797, EM = 1000;
const fixture = resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts/abeezee/ABeeZee-Regular.ttf');
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} vs ${expected}`);
const volume = (size = 20, height = 2) => A_AREA * (size / EM) ** 2 * height;
async function font(): Promise<FontSource> {
  return fontFromBytes(new Uint8Array(readFileSync(fixture)), { filename: 'ABeeZee-Regular.ttf', source: 'original fixture n5', license: 'OFL-1.1' });
}
function shape(p: StudioPart, physicalBodies: number): void {
  const result = evaluateDoc(p.doc, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail);
  assert.equal(result.bodies.length, 1);
  const native = partBreps(p.doc); assert.equal(native.length, 1);
  assert.equal(native[0].brep.bodies.length, physicalBodies);
  const checked = checkBrep(native[0].brep); assert.equal(checked.valid, true, checked.issues.join('\n'));
}
function typed(run: () => unknown, code: string): void { assert.throws(run, error => error instanceof BarocssError && error.code === code); }
function optionSnapshot(options: object): PropertyDescriptorMap {
  const out = Object.getOwnPropertyDescriptors(options);
  for (const key of Reflect.ownKeys(out)) {
    const descriptor = Reflect.get(out, key) as PropertyDescriptor;
    if (Object.hasOwn(descriptor, 'value')) descriptor.value = structuredClone(descriptor.value);
  }
  return out;
}

test('public text: original bytes create one authored node with the independent A volume and default tolerance', async () => {
  const source = await font(), base = part('A'), before = base.doc;
  const made = base.text(source, 'A', { size: 20, h: 2 }), doc = made.doc, node = doc.nodes[0];
  assert.ok(node && node.kind === 'text'); assert.equal(doc.nodes.length, 1);
  assert.deepEqual(node, { kind: 'text', text: 'A', font: source, size: 20, height: 2, tolerance: 0.01, id: 'n0' });
  assert.deepEqual(made.bodies(), ['b0']); close(made.mass({ density: 1 }).volume, volume()); shape(made, 1);
  assert.deepEqual(base.doc, before);
});

test('public text: AA is one authored output with two separate physical solids', async () => {
  const made = part('AA').text(await font(), 'AA', { size: 20, h: 2, tolerance: 0.002, tracking: 5 });
  assert.equal(made.doc.nodes.length, 1); assert.deepEqual(made.bodies(), ['b0']);
  close(made.mass({ density: 1 }).volume, 2 * volume()); shape(made, 2);
});

test('public text: original scalar text, source metadata, Dim options and plane are independent snapshots', async () => {
  const imported = await font(), source = { ...imported }, sourceBefore = structuredClone(source);
  const options = { size: param('size'), h: param('height'), tolerance: 0.002, tracking: param('tracking'),
    plane: { origin: [10, 20, 30] as [number, number, number], normal: [0, -1, 0] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number] } } satisfies StudioTextOptions;
  const beforeOptions = structuredClone(options), base = part('bound text').parameter('size', 20).parameter('height', 2).parameter('tracking', 1), before = base.doc;
  const original = ' A ', made = base.text(source, original, options), accepted = made.doc, node = accepted.nodes[0];
  assert.ok(node.kind === 'text'); assert.equal(node.text, original); assert.deepEqual(node.font, sourceBefore);
  assert.deepEqual([node.size, node.height, node.tracking, node.plane], [beforeOptions.size, beforeOptions.h, beforeOptions.tracking, beforeOptions.plane]);
  assert.deepEqual(source, sourceBefore); assert.deepEqual(options, beforeOptions); assert.deepEqual(base.doc, before);
  source.filename = 'changed.ttf'; source.source = 'changed'; source.license = 'changed';
  options.size = param('changed'); options.h = param('changed'); options.tracking = param('changed'); options.plane.origin[0] = 999;
  assert.deepEqual(made.doc, accepted); close(made.mass({ density: 1 }).volume, volume());
  close(made.withParameters({ size: 30 }).mass({ density: 1 }).volume, volume(30));
  close(made.withParameters({ height: 4 }).mass({ density: 1 }).volume, volume(20, 4));
  const copy = made.doc; copy.nodes.length = 0; copy.parameters.size = 1;
  assert.deepEqual(made.doc, accepted);
});

test('public text: codec carries the original TTF and editable named dimensions through public reopen', async () => {
  const bytes = new Uint8Array(readFileSync(fixture)), metadata: FontSourceMetadata = { filename: ' ABeeZee original.ttf ', source: 'provided n5 source', license: 'provided OFL-1.1' };
  const source = await fontFromBytes(bytes, metadata), original = bytes.slice(), metadataBefore = structuredClone(metadata);
  const made = part('saved text').parameter('size', 20).parameter('height', 2).text(source, 'A', { size: param('size'), h: param('height') });
  const before = made.doc, encoded = encodeStudioFile(before);
  assert.deepEqual(metadata, metadataBefore); assert.deepEqual(bytes, original);
  bytes.fill(0); dropBlobs([source.blob]);
  const opened = await readStudioFile(encoded); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, before);
  const restored = getBlob(source.blob); assert.ok(restored);
  assert.deepEqual(new Uint8Array(restored.buffer, restored.byteOffset, restored.byteLength), original);
  const reopened = part('reopened text', opened.doc);
  close(reopened.mass({ density: 1 }).volume, volume());
  close(reopened.withParameters({ size: 30, height: 4 }).mass({ density: 1 }).volume, volume(30, 4));
  assert.deepEqual(reopened.doc, before); assert.deepEqual(made.doc, before);
});

test('public text: a new output stays independent of an existing selected body and receives focus', async () => {
  const base = part('two authored bodies').box({ w: 40, d: 30, h: 10 }), before = base.doc, baseKey = base.bodies()[0];
  const made = base.body(baseKey).text(await font(), 'A', { size: 20, h: 2, plane: { origin: [5, 5, 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } });
  assert.deepEqual(made.bodies(), [baseKey, 'b2']); assert.equal(made.doc.nodes.length, before.nodes.length + 1);
  close(made.mass({ density: 1 }).volume, volume()); close(made.body(baseKey).mass({ density: 1 }).volume, 12000);
  assert.deepEqual(made.doc.nodes.slice(0, -1), before.nodes); assert.deepEqual(base.doc, before);
  assert.equal(partBreps(made.doc).length, 2, 'independent authored bodies are retained even when their volumes overlap');
});

test('public text: required and unknown options and invalid recipes give typed refusals without changing input', async () => {
  const source = await font(), base = part('unchanged'), before = base.doc;
  const invalid: unknown[] = [
    undefined, null, {}, { size: 20 }, { h: 2 }, { size: 20, h: 2, height: 2 }, { size: 20, h: 2, font: source },
    { size: 20, h: 2, [Symbol('extra')]: true }, { size: 0, h: 2 }, { size: 20, h: 0 }, { size: 20, h: -1 },
    { size: 20, h: 2, tolerance: null }, { size: 20, h: 2, tolerance: 0 }, { size: 20, h: 2, tolerance: 10 },
    { size: 20, h: 2, tracking: Infinity }, { size: param('missing'), h: 2 },
    { size: 20, h: 2, plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [0, 0, 1] } },
  ];
  for (const options of invalid) {
    const saved = typeof options === 'object' && options !== null ? optionSnapshot(options) : options;
    typed(() => Reflect.apply(base.text, base, [source, 'A', options]), 'VALUE');
    if (typeof options === 'object' && options !== null) assert.deepEqual(Object.getOwnPropertyDescriptors(options), saved);
    assert.deepEqual(base.doc, before);
  }
  for (const literal of ['', '   ', 'A\nB', '\ud800']) typed(() => base.text(source, literal, { size: 20, h: 2 }), 'VALUE');
  typed(() => Reflect.apply(base.text, base, ['Arial', 'A', { size: 20, h: 2 }]), 'VALUE');
  assert.deepEqual(base.doc, before);
});

test('public text: missing source, missing glyph and unsupported composite are typed with no fallback', async () => {
  const source = await font(), base = part('no fallback'), before = base.doc;
  typed(() => base.text({ ...source, blob: 'f'.repeat(64) }, 'A', { size: 20, h: 2 }), 'FONT_SOURCE_MISSING');
  typed(() => base.text(source, '가', { size: 20, h: 2 }), 'TTF_MISSING_GLYPH');
  typed(() => base.text(source, 'À', { size: 20, h: 2 }), 'TTF_UNSUPPORTED');
  const unsupported = new Uint8Array(readFileSync(fixture)); unsupported.set([0x77, 0x4f, 0x46, 0x46], 0);
  await assert.rejects(() => fontFromBytes(unsupported, { filename: 'unsupported.woff' }), error => error instanceof BarocssError && error.code === 'TTF_UNSUPPORTED');
  assert.deepEqual(base.doc, before);
});
