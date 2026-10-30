import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BarocssError, checkOutput, evaluateCadPart, massPropertiesOf, outputOf } from '@barocss/cad';
import { blobRefs, blobsAsBase64, blobsFromBase64, dropBlobs, evictBlobs, fontRefs, getBlob, hasBlob, loadRecoveryBlobs, putKnownBlob, saveRecoveryBlobs, setBlobStore, type BlobArray, type BlobStore, type BlobType } from '../src/engine/blobs';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { emptyDoc, leafBodies, parentsOf, prefixDoc, textNodeProblem, usesOf, withNode, type ModelNode, type StudioDoc, type TextNode } from '../src/engine/doc';
import { fontFromBytes, type FontSource } from '../src/engine/font/source';
import { flattenAssembly } from '../src/engine/flatten';
import { fromFeature, nodeIndexOf, nodesOfName } from '../src/engine/ids';
import { readStudioDoc } from '../src/engine/migrate';
import { toPartDocument } from '../src/engine/part';
import { checkNode, duplicateBody, moveFeature, renumber } from '../src/chat/features';
import { WireReceiver, WireSender } from '../src/engine/wireDoc';
import type { Op, Proposal } from '../src/engine/schema/proposals';

const fonts = resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts');
async function realFont(file = 'abeezee/ABeeZee-Regular.ttf'): Promise<FontSource> {
  return fontFromBytes(new Uint8Array(readFileSync(resolve(fonts, file))), { filename: file.split('/').at(-1)!, source: 'font fixture n5', license: 'Provided fixture OFL-1.1' });
}
function recipe(font: FontSource, text = 'A'): TextNode { return { kind: 'text', text, font, size: 20, height: 2, tolerance: 0.002 }; }
function document(node: TextNode): StudioDoc { return withNode(emptyDoc(), node); }
function native(doc: StudioDoc) {
  const part = toPartDocument(doc), snapshot = evaluateCadPart(part), output = outputOf(snapshot, doc.nodes.at(-1)!.id!);
  assert.equal(checkOutput(output).valid, true);
  return { part, output, volume: massPropertiesOf(output).volume };
}
function typed(action: () => unknown, code?: string): void { assert.throws(action, error => error instanceof BarocssError && (code === undefined || error.code === code)); }
function preparedText(font: FontSource): Op { return { tool: 'run_command', args: { command: 'text', values: { text: 'A', font: JSON.stringify(font), size: 20, height: 2, tolerance: 0.002 } } }; }
function proposalDocument(ops: Op[], status: Proposal['status'] = 'open'): StudioDoc {
  return { ...emptyDoc(), proposals: [{ id: 'P-font', title: 'Prepared text', status, by: { agent: 'test' }, at: '2026-10-28', base: 'test', ops,
    risk: { level: 'low', features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] }, summary: '' }] };
}
class FontRecoveryStore implements BlobStore {
  readonly entries = new Map<string, { type: BlobType; data: BlobArray }>();
  async keys(): Promise<Set<string>> { return new Set(this.entries.keys()); }
  async get(hashes: readonly string[]): Promise<Map<string, { type: BlobType; data: BlobArray }>> {
    const out = new Map<string, { type: BlobType; data: BlobArray }>();
    for (const hash of hashes) { const entry = this.entries.get(hash); if (entry) out.set(hash, structuredClone(entry)); }
    return out;
  }
  async put(entries: readonly { hash: string; type: BlobType; data: BlobArray }[]): Promise<boolean> {
    for (const entry of entries) this.entries.set(entry.hash, { type: entry.type, data: structuredClone(entry.data) });
    return true;
  }
  async delete(hashes: readonly string[]): Promise<void> { for (const hash of hashes) this.entries.delete(hash); }
}

test('text solid retains authoritative source data and matches an independent exact straight-outline area', async () => {
  const font = await realFont(), doc = document(recipe(font)), before = structuredClone(doc), result = native(doc);
  // Independent fontTools 4.67.0 oracle: ABeeZee A has only line segments and area 148797 design units squared.
  // No chord approximation error is needed for this selected glyph; no kernel or profile-helper area is the oracle.
  const expected = 148797 * (20 / 1000) ** 2 * 2;
  assert.ok(Math.abs(result.volume - expected) < 1e-8, `${result.volume} vs ${expected}`);
  assert.equal(result.output.brep.bodies.length, 1);
  assert.deepEqual(result.part.features.map(feature => feature.kind), ['sketch', 'extrude', 'translate']);
  assert.equal(result.part.features.at(-1)!.id, doc.nodes[0].id);
  assert.deepEqual(doc, before); assert.deepEqual(parentsOf(doc.nodes[0]), []); assert.deepEqual(usesOf(doc.nodes[0]), []);
  assert.deepEqual(leafBodies(doc.nodes), [{ node: 0, side: 'solid' }]);
  assert.deepEqual(Object.keys(prefixDoc(doc, 1).outputs), ['b0']);
});
test('separated glyphs remain several physical bodies in one authored Part output', async () => {
  const doc = document({ ...recipe(await realFont(), 'AA'), tracking: 5 }), result = native(doc);
  assert.equal(result.output.brep.bodies.length, 2);
  assert.ok(Math.abs(result.volume - 2 * 148797 * 0.02 ** 2 * 2) < 1e-8);
  assert.deepEqual(result.part.features.map(feature => feature.id), ['n0_g0_c0_sketch', 'n0_g0_c0_extrude', 'n0_g1_c0_sketch', 'n0_g1_c0_extrude', 'n0']);
  assert.equal(result.part.features.at(-1)!.kind, 'union'); assert.equal(Object.keys(doc.outputs).length, 1);
  for (const face of result.output.brep.faces) {
    assert.ok(face.name);
    assert.equal(nodesOfName(doc.nodes, face.name).includes(0), true, face.name);
  }
});
test('Korean glyph components stay separate without losing the original scalar string', async () => {
  const doc = document({ ...recipe(await realFont('nanum-gothic/NanumGothic-Regular.ttf'), '가한'), tracking: 5 }), result = native(doc);
  // Independent fontTools containment oracle: 가 has two components; 한 has five components and one hole.
  assert.equal(result.output.brep.bodies.length, 7); assert.ok(result.volume > 0);
  assert.equal(doc.nodes[0].kind, 'text'); assert.equal((doc.nodes[0] as TextNode).text, '가한');
});
test('native model Save/Open carries the original font bytes and editable recipe', async () => {
  const font = await realFont(), doc = document({ ...recipe(font), size: { parameter: 'size' }, height: { parameter: 'height' }, tracking: { parameter: 'tracking' }, plane: { origin: [10, 20, 30], normal: [0, -5, 0], xAxis: [3, 0, 0] } });
  doc.parameters = { size: 20, height: 2, tracking: 1 };
  const before = structuredClone(doc), encoded = encodeStudioFile(doc), initial = native(doc);
  const bytes = getBlob(font.blob)!, original = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice();
  dropBlobs([font.blob]);
  const opened = await readStudioFile(encoded); assert.ok('doc' in opened, JSON.stringify(opened));
  assert.deepEqual(opened.doc, before);
  const restored = getBlob(font.blob)!; assert.deepEqual(new Uint8Array(restored.buffer, restored.byteOffset, restored.byteLength), original);
  assert.ok(Math.abs(native(opened.doc).volume - initial.volume) < 1e-8);
  const larger = { ...opened.doc, parameters: { ...opened.doc.parameters, size: 30 } };
  assert.ok(Math.abs(native(larger).volume - initial.volume * 2.25) < 1e-8);
});
test('font source is read as bytes even when the existing same-byte blob uses another dtype', async () => {
  const font = await realFont(), stored = getBlob(font.blob)!, original = new Uint8Array(stored.buffer, stored.byteOffset, stored.byteLength).slice();
  dropBlobs([font.blob]); putKnownBlob(font.blob, new Uint32Array(original.buffer));
  const part = toPartDocument(document(recipe(font)));
  assert.equal(part.features.length, 3); assert.ok(getBlob(font.blob) instanceof Uint32Array);
});
test('font references survive node trees, open proposal ops, undo roots and structured clone wire', async () => {
  const font = await realFont(), doc = document(recipe(font)), node = doc.nodes[0];
  const holders: StudioDoc = { ...emptyDoc(), instances: [{ id: 'i', name: 'I', doc, position: [0, 0, 0], rotation: [0, 0, 0] }], pendingParts: { p: { doc, name: 'P', rev: 'A' } },
    proposals: [{ id: 'P1', title: 'Text', status: 'open', by: { agent: 'test' }, at: '2026-10-28', base: 'test', ops: [{ tool: 'add_features', args: { features: [node] } }], risk: { level: 'low', features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] }, summary: '' }] };
  assert.deepEqual([...blobRefs(holders)], [font.blob]);
  const malformed = { ...emptyDoc(), proposals: [{ status: 'open', ops: [{ args: { features: [{ kind: 'text', font: null }] } }] }] } as unknown as StudioDoc;
  assert.deepEqual([...blobRefs(malformed)], [], 'collection is not admission and does not crash on an unadmitted proposal');
  evictBlobs([emptyDoc(), doc]); evictBlobs([emptyDoc(), doc]); assert.ok(getBlob(font.blob), 'an undo document keeps its source');
  const first = new WireSender().pack(doc); assert.equal(first.blobs?.[0][0], font.blob);
  const wire = structuredClone(first); dropBlobs([font.blob]);
  assert.deepEqual(new WireReceiver().unpack(wire).nodes, doc.nodes); assert.ok(getBlob(font.blob));
});
test('a proposal-only prepared text command retains font bytes through eviction, base64, recovery and native save', async () => {
  const font = await realFont(), doc = proposalDocument([preparedText(font)]), recovery = new FontRecoveryStore();
  assert.equal(doc.nodes.length, 0, 'the prepared command is the only holder');
  assert.deepEqual([...fontRefs(doc)], [font.blob]); assert.deepEqual([...blobRefs(doc)], [font.blob]);
  evictBlobs([doc]); evictBlobs([doc]); assert.ok(hasBlob(font.blob), 'the source survives beyond the grace generation');
  const array = getBlob(font.blob)!, original = new Uint8Array(array.buffer, array.byteOffset, array.byteLength).slice();
  const wire = blobsAsBase64(doc), encoded = encodeStudioFile(doc);
  assert.ok(wire[font.blob]);
  try {
    setBlobStore(recovery); assert.equal(await saveRecoveryBlobs(doc), true); assert.ok(recovery.entries.has(font.blob));
    dropBlobs([font.blob]); assert.deepEqual(await blobsFromBase64(wire), []); assert.ok(hasBlob(font.blob));
    dropBlobs([font.blob]); assert.deepEqual(await loadRecoveryBlobs(doc), []); assert.ok(hasBlob(font.blob));
    dropBlobs([font.blob]); const opened = await readStudioFile(encoded); assert.ok('doc' in opened, JSON.stringify(opened));
    assert.deepEqual(opened.doc.proposals, doc.proposals);
    const restored = getBlob(font.blob)!; assert.deepEqual(new Uint8Array(restored.buffer, restored.byteOffset, restored.byteLength), original);
  } finally { setBlobStore(null); }
});
test('font-only roots share nested command parsing and document-tree traversal with blob roots', async () => {
  const font = await realFont(), command = preparedText(font), nested = proposalDocument([{ tool: 'apply_ops', args: { ops: [{ tool: 'propose', args: { ops: [command] } }] } }]);
  assert.equal(nested.nodes.length, 0); assert.deepEqual([...fontRefs(nested)], [font.blob]);
  evictBlobs([nested]); evictBlobs([nested]); assert.ok(hasBlob(font.blob), 'only a nested prepared command keeps the source');
  const direct = document(recipe(font));
  const instance = { ...emptyDoc(), instances: [{ id: 'i', name: 'I', doc: nested, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }] };
  const pending = { ...emptyDoc(), pendingParts: { p: { doc: nested, name: 'P', rev: 'A' } } };
  for (const holder of [direct, instance, pending]) assert.deepEqual([...fontRefs(holder)], [font.blob]);
  const mixed = { ...nested, nodes: [{ kind: 'mesh', name: 'transport', unit: 'mm', blob: { positions: 'a'.repeat(64), indices: 'b'.repeat(64) } } as ModelNode] };
  assert.deepEqual([...fontRefs(mixed)], [font.blob]); assert.equal(blobRefs(mixed).size, 3);
  const out = new Set(['already-kept']); assert.equal(fontRefs(nested, out), out); assert.equal(out.has(font.blob), true);
});
test('prepared font JSON collection is bounded and conservative without admitting a command or arbitrary strings', async () => {
  const font = await realFont(), json = JSON.stringify(font), values = { text: 'A', font: json, size: 20, height: 2, tolerance: 0.002 };
  const partial = proposalDocument([{ tool: 'run_command', args: { command: 'text', values: { ...values, font: JSON.stringify({ blob: font.blob }) } } }]);
  assert.deepEqual([...fontRefs(partial)], [font.blob], 'a usable key remains a root while descriptor admission is still pending');
  const limit = 512 * 1024, exact = json + ' '.repeat(limit - json.length);
  assert.deepEqual([...fontRefs(proposalDocument([{ tool: 'run_command', args: { command: 'text', values: { ...values, font: exact } } }]))], [font.blob]);
  const oversizedUnicode = JSON.stringify({ blob: font.blob, padding: '가'.repeat(175000) });
  for (const malformed of ['{', 'null', '[]', '{"blob":3}', JSON.stringify({ blob: font.blob.toUpperCase() }), exact + ' ', oversizedUnicode]) {
    const doc = proposalDocument([{ tool: 'run_command', args: { command: 'text', values: { ...values, font: malformed } } }]);
    assert.deepEqual([...fontRefs(doc)], []); assert.deepEqual([...blobRefs(doc)], []);
  }
  for (const operation of [
    { tool: 'other', args: { command: 'text', values } },
    { tool: 'run_command', args: { command: 'fillet', values } },
    { tool: 'run_command', args: { command: 'text', values: { ...values, font } } },
    { tool: 'apply_ops', args: { command: 'text', values } },
  ]) assert.deepEqual([...fontRefs(proposalDocument([operation]))], [], 'only the exact prepared text operation parses a font string');
});
test('accepted and rejected proposal commands no longer retain otherwise unreferenced font bytes', async () => {
  const font = await realFont(), command = preparedText(font);
  for (const status of ['accepted', 'rejected'] as const) {
    const closed = proposalDocument([command], status);
    assert.deepEqual([...fontRefs(closed)], []); assert.deepEqual([...blobRefs(closed)], []);
  }
  const closed = proposalDocument([command], 'accepted'); evictBlobs([closed]); evictBlobs([closed]);
  assert.equal(hasBlob(font.blob), false, 'a closed prepared command does not act as a hidden root');
});
test('text recipe copy, renumber, movement and assembly flatten preserve source metadata', async () => {
  const font = await realFont(), doc = document(recipe(font, 'A n5'));
  assert.deepEqual(renumber(doc.nodes[0], value => value + 10), doc.nodes[0]);
  const duplicate = duplicateBody(doc, { node: 0, side: 'solid' }, [40, 0, 0]);
  assert.deepEqual((duplicate.doc.nodes[1] as TextNode).font, font); assert.equal((duplicate.doc.nodes[1] as TextNode).text, 'A n5');
  const moved = moveFeature(withNode(doc, recipe(font, 'A')), 1, -1); assert.ok('doc' in moved);
  assert.equal((moved.doc.nodes[0] as TextNode).text, 'A');
  const asm: StudioDoc = { ...emptyDoc(), instances: [{ id: 'i1', name: 'I', doc, position: [30, 0, 0], rotation: [0, 0, 0] }] }, flat = flattenAssembly(asm);
  const text = flat.nodes.find(node => node.kind === 'text') as TextNode;
  assert.deepEqual(text.font, font); assert.equal(text.text, 'A n5'); assert.deepEqual([...blobRefs(flat)], [font.blob]);
});
test('generated text ids resolve only their explicit suffix grammar and preserve existing exact/pattern ids', async () => {
  const doc = document(recipe(await realFont()));
  for (const suffix of ['_g0_c0_sketch', '_g15_c2_extrude', '_g1_c0_union']) {
    assert.equal(nodeIndexOf(doc.nodes, 'n0' + suffix), 0); assert.equal(fromFeature('n0' + suffix + '.top', 'n0', doc.nodes), true);
    assert.equal(fromFeature('n0' + suffix + '.top', 'n0'), false, 'without node context the existing generic id meaning is retained');
  }
  for (const suffix of ['_g00_c0_sketch', '_g0_c00_extrude', '_g-1_c0_union', '_g0_c0_other', '_g0_c0_extrude_more', '_g0_c0']) assert.equal(nodeIndexOf(doc.nodes, 'n0' + suffix), -1);
  assert.equal(nodeIndexOf(doc.nodes, 'n0_p2'), 0);
  const exact = [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 1, id: 'n0_g0_c0_extrude' }] as ModelNode[];
  assert.equal(nodeIndexOf(exact, 'n0_g0_c0_extrude'), 0);
  assert.equal(nodeIndexOf([{ ...exact[0], id: 'n0' }], 'n0_g0_c0_extrude'), -1);
  const collision = [...doc.nodes, ...exact];
  assert.equal(nodeIndexOf(collision, 'n0_g0_c0_extrude'), 1);
  assert.equal(fromFeature('n0_g0_c0_extrude.top', 'n0', collision), false);
});
test('current-format text validation rejects malformed or non-printing recipes without normalization', async () => {
  const font = await realFont(), valid = recipe(font);
  assert.equal(checkNode(valid, [], {}), null);
  for (const change of [{ text: '' }, { text: '   ' }, { text: '\ud800' }, { text: 'A\nB' }, { height: 0 }, { height: -1 }, { size: Infinity }, { tolerance: 0 }, { tolerance: 10 }, { tracking: 10001 }, { font: { ...font, blob: 'bad' } }, { parent: { node: 0, side: 'solid' } }]) {
    const bad = { ...valid, ...change };
    assert.ok(textNodeProblem(bad, {})); assert.ok(checkNode(bad, [], {}));
    assert.ok('error' in readStudioDoc(JSON.stringify({ ...emptyDoc(), nodes: [bad] })));
    typed(() => toPartDocument({ ...emptyDoc(), nodes: [bad as ModelNode] }), 'BAD_VALUE');
  }
  typed(() => toPartDocument(document({ ...valid, font: { ...font, blob: 'f'.repeat(64) } })));
  assert.deepEqual(toPartDocument(document({ ...valid, suppressed: true } as TextNode)).features, []);
});
test('expanded features and placed coordinates are refused before native evaluation exceeds its limits', async () => {
  const font = await realFont(), exact = document(recipe(font, 'A'.repeat(171)));
  assert.equal(toPartDocument(exact).features.length, 512);
  typed(() => toPartDocument(document(recipe(font, 'A'.repeat(172)))), 'LIMIT');
  typed(() => toPartDocument(withNode(exact, { kind: 'translate', parent: { node: 0, side: 'solid' }, offset: [1, 0, 0] })), 'LIMIT');
  typed(() => toPartDocument(document({ ...recipe(font), plane: { origin: [9999, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] } })), 'LIMIT');
  typed(() => toPartDocument(document({ ...recipe(font), height: 10000, plane: { origin: [0, 0, 1], normal: [0, 0, 1], xAxis: [1, 0, 0] } })), 'LIMIT');
  const collision = withNode(document(recipe(font)), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 1, id: 'n0_g0_c0_extrude' });
  typed(() => toPartDocument(collision), 'BAD_REFERENCE');
  typed(() => toPartDocument({ ...document(recipe(font)), parameters: { unused: 10001 } }), 'BAD_VALUE');
});

type XY = [number, number];
function square(lo: number, hi: number, clockwise: boolean): XY[] { return clockwise ? [[lo, lo], [lo, hi], [hi, hi], [hi, lo]] : [[lo, lo], [hi, lo], [hi, hi], [lo, hi]]; }
/** Authored sfnt fixture: one all-on-curve A glyph, not third-party outline data. */
function authoredFont(contours: XY[][]): Uint8Array {
  let points = 0; for (const contour of contours) points += contour.length;
  const glyph = new Uint8Array(12 + 2 * contours.length + 5 * points), gv = new DataView(glyph.buffer);
  gv.setInt16(0, contours.length); gv.setInt16(6, 1000); gv.setInt16(8, 1000);
  let end = -1;
  for (let i = 0; i < contours.length; i++) { end += contours[i].length; gv.setUint16(10 + 2 * i, end); }
  const flags = 12 + 2 * contours.length; glyph.fill(1, flags, flags + points);
  let at = flags + points, previous = 0;
  for (const contour of contours) for (const point of contour) { gv.setInt16(at, point[0] - previous); at += 2; previous = point[0]; }
  previous = 0;
  for (const contour of contours) for (const point of contour) { gv.setInt16(at, point[1] - previous); at += 2; previous = point[1]; }
  const head = new Uint8Array(54), hv = new DataView(head.buffer); hv.setUint32(0, 0x10000); hv.setUint32(12, 0x5f0f3cf5); hv.setUint16(18, 1000); hv.setInt16(50, 1);
  const maxp = new Uint8Array(32), mv = new DataView(maxp.buffer); mv.setUint32(0, 0x10000); mv.setUint16(4, 2);
  const hhea = new Uint8Array(36), hh = new DataView(hhea.buffer); hh.setUint32(0, 0x10000); hh.setInt16(4, 1000); hh.setUint16(34, 2);
  const hmtx = new Uint8Array(8); new DataView(hmtx.buffer).setUint16(4, 1000);
  const loca = new Uint8Array(12); new DataView(loca.buffer).setUint32(8, glyph.length);
  const cmap = new Uint8Array(40), cv = new DataView(cmap.buffer); cv.setUint16(2, 1); cv.setUint16(4, 3); cv.setUint16(6, 10); cv.setUint32(8, 12); cv.setUint16(12, 12); cv.setUint32(16, 28); cv.setUint32(24, 1); cv.setUint32(28, 65); cv.setUint32(32, 65); cv.setUint32(36, 1);
  const tables: [string, Uint8Array][] = [['head', head], ['maxp', maxp], ['hhea', hhea], ['hmtx', hmtx], ['loca', loca], ['glyf', glyph], ['cmap', cmap]];
  let length = 124; for (const [, data] of tables) length += Math.ceil(data.length / 4) * 4;
  const bytes = new Uint8Array(length), view = new DataView(bytes.buffer); view.setUint32(0, 0x10000); view.setUint16(4, 7); view.setUint16(6, 64); view.setUint16(8, 2); view.setUint16(10, 48);
  at = 124;
  for (let i = 0; i < tables.length; i++) { const [name, data] = tables[i], record = 12 + i * 16; for (let c = 0; c < 4; c++) bytes[record + c] = name.charCodeAt(c); view.setUint32(record + 8, at); view.setUint32(record + 12, data.length); bytes.set(data, at); at += Math.ceil(data.length / 4) * 4; }
  return bytes;
}
test('an authored hole-inside-island font keeps both material components through native union', async () => {
  const font = await fontFromBytes(authoredFont([square(200, 800, false), square(400, 600, true), square(0, 1000, true)]), { filename: 'authored-island.ttf' });
  const result = native(document({ ...recipe(font), size: 10 }));
  assert.equal(result.output.brep.bodies.length, 2); assert.ok(Math.abs(result.volume - 68 * 2) < 1e-8);
  const sketches = result.part.features.filter(feature => feature.kind === 'sketch') as { holes?: unknown[] }[];
  assert.equal(sketches.length, 2); assert.equal(sketches.reduce((sum, sketch) => sum + (sketch.holes?.length ?? 0), 0), 1);
});
test('a component with 65 authored holes is refused by native-loop preflight', async () => {
  const contours = [square(0, 1000, true)];
  for (let i = 0; i < 65; i++) { const x = 50 + i % 9 * 90, y = 50 + Math.floor(i / 9) * 90; contours.push([[x, y], [x + 20, y], [x + 20, y + 20], [x, y + 20]]); }
  const font = await fontFromBytes(authoredFont(contours), { filename: 'authored-65-holes.ttf' });
  typed(() => toPartDocument(document(recipe(font))), 'LIMIT');
});
