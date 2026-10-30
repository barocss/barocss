import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkBrep } from '@barocss/cad';
import { BarocssError, FaceQuery, fontFromBytes, part, param, type BodyQuery, type FontSource, type StudioPart, type StudioTextReliefOptions } from '../src/api';
import { dropBlobs, getBlob } from '../src/engine/blobs';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';

// Independent fontTools 4.67.0 Green integral: ABeeZee A has area 148797 in an em of 1000.
// At em10/depth2 it adds/removes 29.7594 from the independent 40*30*10 slab volume.
const A_AREA = 148797, EM = 1000, SLAB = 40 * 30 * 10;
const fixture = resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts/abeezee/ABeeZee-Regular.ttf');
const top = (body: BodyQuery) => body.faces().facing('+z');
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} vs ${expected}`);
const amount = (size = 10, depth = 2) => A_AREA * (size / EM) ** 2 * depth;
const seed = () => part('relief').box({ w: 40, d: 30, h: 10 });
async function font(): Promise<FontSource> { return fontFromBytes(new Uint8Array(readFileSync(fixture)), { filename: 'ABeeZee-Regular.ttf', source: 'provided n5 source', license: 'provided OFL-1.1' }); }
function options(mode: 'emboss' | 'engrave' = 'emboss'): StudioTextReliefOptions { return { size: 10, depth: 2, at: [5, 5], mode }; }
function typed(run: () => unknown, code: string): void { assert.throws(run, error => error instanceof BarocssError && error.code === code); }
function validOneSolid(made: StudioPart): void {
  const result = evaluateDoc(made.doc, 1); assert.ok(result.ok, result.ok ? '' : result.error.detail); assert.equal(result.bodies.length, 1);
  const native = partBreps(made.doc); assert.equal(native.length, 1); assert.equal(native[0].brep.bodies.length, 1);
  const checked = checkBrep(native[0].brep); assert.equal(checked.valid, true, checked.issues.join('\n'));
}
function namedQuery(base: StudioPart, name: string): FaceQuery {
  const face = top(base.select()).list()[0]; return new FaceQuery([{ ...face, name }], []);
}

test('public text relief: exact selected face, independent add/remove area, one modified solid and captured source', async () => {
  const source = await font();
  for (const mode of ['emboss', 'engrave'] as const) {
    const base = seed(), before = base.doc, name = top(base.select()).names()[0];
    const made = base.textRelief(top, source, 'A', options(mode)), doc = made.doc, node = doc.nodes.at(-1);
    assert.ok(node && node.kind === 'text-relief'); assert.equal(doc.nodes.length, before.nodes.length + 1);
    assert.deepEqual(node.parent, { node: before.nodes.length - 1, side: 'solid' }); assert.deepEqual(node.faces, [name]);
    assert.equal(node.text, 'A'); assert.deepEqual(node.font, source); assert.deepEqual(node.at, [5, 5]); assert.equal(node.tolerance, 0.01);
    assert.ok(node.sigs?.[name]); assert.ok((node.sigs[name].n ?? 1) <= 1, 'one individual reference is captured');
    assert.deepEqual(made.bodies(), ['b2']); close(made.mass({ density: 1 }).volume, SLAB + (mode === 'emboss' ? 1 : -1) * amount()); validOneSolid(made);
    assert.deepEqual(base.doc, before); assert.deepEqual(doc.nodes.slice(0, -1), before.nodes);
  }
});

test('public text relief: source, raw text and named size/depth/baseline/tracking are independent copies', async () => {
  const source = { ...await font() }, originalSource = structuredClone(source);
  const given = { size: param('Size'), depth: param('Depth'), at: [param('X'), param('Y')] as [ReturnType<typeof param>, ReturnType<typeof param>], mode: 'emboss' as const, tolerance: 0.002, tracking: param('Tracking') } satisfies StudioTextReliefOptions;
  const beforeOptions = structuredClone(given), base = seed().parameter('Size', 10).parameter('Depth', 2).parameter('X', 5).parameter('Y', 5).parameter('Tracking', 0), before = base.doc;
  const made = base.textRelief(top, source, ' A ', given), accepted = made.doc, node = accepted.nodes.at(-1);
  assert.ok(node && node.kind === 'text-relief'); assert.equal(node.text, ' A '); assert.deepEqual(node.font, originalSource);
  assert.deepEqual([node.size, node.depth, node.at, node.tracking], [given.size, given.depth, given.at, given.tracking]);
  assert.deepEqual(source, originalSource); assert.deepEqual(given, beforeOptions); assert.deepEqual(base.doc, before);
  source.filename = 'changed.ttf'; source.source = 'changed'; source.license = 'changed'; given.size = param('Other'); given.depth = param('Other'); given.at[0] = param('Other'); given.tracking = param('Other');
  assert.deepEqual(made.doc, accepted); close(made.mass({ density: 1 }).volume, SLAB + amount());
  close(made.withParameters({ Size: 12, Depth: 1, X: 6, Y: 6 }).mass({ density: 1 }).volume, SLAB + amount(12, 1));
});

test('public text relief: raw TTF codec round trip restores bytes before editable recipe reuse', async () => {
  const bytes = new Uint8Array(readFileSync(fixture)), original = bytes.slice();
  const source = await fontFromBytes(bytes, { filename: ' original n5.ttf ', source: 'provided URL/n5', license: 'provided license' });
  const made = seed().parameter('Size', 10).textRelief(top, source, 'A', { ...options('engrave'), size: param('Size') }), before = made.doc;
  const encoded = encodeStudioFile(before); assert.equal(new TextDecoder().decode(encoded.subarray(0, 8)), 'BCADPACK');
  bytes.fill(0); dropBlobs([source.blob]);
  const opened = await readStudioFile(encoded); assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, before);
  const restored = getBlob(source.blob); assert.ok(restored); assert.deepEqual(new Uint8Array(restored.buffer, restored.byteOffset, restored.byteLength), original);
  const reopened = part('reopened relief', opened.doc); close(reopened.mass({ density: 1 }).volume, SLAB - amount());
  close(reopened.withParameters({ Size: 12 }).mass({ density: 1 }).volume, SLAB - amount(12)); assert.deepEqual(made.doc, before);
});

test('public text relief: modifies only the selected body and focuses its replacement', async () => {
  const base = seed().box({ w: 5, d: 5, h: 5, x: 60 }), before = base.doc, keys = base.bodies(); assert.equal(keys.length, 2);
  const made = base.body(keys[0]).textRelief(top, await font(), 'A', options());
  assert.equal(made.bodies().length, 2); assert.ok(made.bodies().includes(keys[1])); assert.ok(!made.bodies().includes(keys[0]));
  close(made.mass({ density: 1 }).volume, SLAB + amount()); close(made.body(keys[1]).mass({ density: 1 }).volume, 125); assert.deepEqual(base.doc, before);
});

test('public text relief: exact face and options refusals are typed and leave caller values unchanged', async () => {
  const source = await font(), base = seed(), before = base.doc;
  const invalid: unknown[] = [undefined, null, {}, { size: 10, depth: 2, mode: 'emboss' }, { ...options(), plane: {} }, { ...options(), height: 2 }, { ...options(), [Symbol('extra')]: 1 }, { ...options(), size: 0 }, { ...options(), depth: 0 }, { ...options(), at: [5] }, { ...options(), at: null }, { ...options(), at: [Infinity, 5] }, { ...options(), mode: 'wrap' }, { ...options(), tolerance: null }, { ...options(), tolerance: 0 }, { ...options(), tracking: Infinity }, { ...options(), size: param('Missing') }];
  for (const given of invalid) {
    const saved = given && typeof given === 'object' ? Reflect.ownKeys(given).map(key => [key, structuredClone(Reflect.get(given, key))]) : given;
    typed(() => Reflect.apply(base.textRelief, base, [top, source, 'A', given]), 'VALUE');
    if (given && typeof given === 'object') assert.deepEqual(Reflect.ownKeys(given).map(key => [key, Reflect.get(given, key)]), saved);
  }
  typed(() => base.textRelief(b => b.faces(), source, 'A', options()), 'VALUE');
  typed(() => base.textRelief(b => b.faces().facing('+z').where(() => false), source, 'A', options()), 'SELECTION_EMPTY');
  typed(() => base.textRelief(() => namedQuery(base, 'n1.top+n1.bottom'), source, 'A', options()), 'VALUE');
  typed(() => base.textRelief(() => namedQuery(base, 'n999.top'), source, 'A', options()), 'SELECTION_UNKNOWN');
  typed(() => base.textRelief(() => null as never, source, 'A', options()), 'VALUE');
  typed(() => part('empty').textRelief(top, source, 'A', options()), 'NO_BODY');
  typed(() => base.textRelief(top, source, '\ud800', options()), 'VALUE');
  assert.deepEqual(base.doc, before);
});

test('public text relief: height tracking follows the current top, while a reversed stored face direction refuses', async () => {
  const source = await font(), base = seed(), before = base.doc;
  typed(() => base.textRelief(top, { ...source, blob: 'f'.repeat(64) }, 'A', options()), 'FONT_SOURCE_MISSING');
  typed(() => base.textRelief(top, source, '가', options()), 'TTF_MISSING_GLYPH');
  typed(() => base.textRelief(top, source, 'À', options()), 'TTF_UNSUPPORTED');
  const made = part('bound target').parameter('SlabHeight', 10).box({ w: 40, d: 30, h: param('SlabHeight') }).textRelief(top, source, 'A', options());
  const original = made.doc, taller = made.withParameters({ SlabHeight: 11 });
  close(taller.mass({ density: 1 }).volume, 40 * 30 * 11 + amount());
  const evaluated = evaluateDoc(taller.doc, 1); assert.ok(evaluated.ok, evaluated.ok ? '' : evaluated.error.detail);
  assert.equal(evaluated.bodies.length, 1); close(evaluated.bodies[0].mesh.bounds.max[2], 13); validOneSolid(taller);
  const changed = made.doc, node = changed.nodes.at(-1); assert.ok(node && node.kind === 'text-relief');
  const signature = node.sigs?.[node.faces[0]]; assert.ok(signature?.d);
  signature.d = [-signature.d[0], -signature.d[1], -signature.d[2]];
  typed(() => part('reversed stored face', changed).mass({ density: 1 }), 'REFERENCE_MOVED');
  assert.deepEqual(made.doc, original); assert.deepEqual(base.doc, before); close(made.mass({ density: 1 }).volume, SLAB + amount());
});
