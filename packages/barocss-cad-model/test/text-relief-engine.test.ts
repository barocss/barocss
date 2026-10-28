import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BarocssError, checkOutput, evaluateCadPart, massPropertiesOf, outputOf } from '@barocss/cad';
import { part } from '../src/api';
import { blobRefs, blobsAsBase64, blobsFromBase64, dropBlobs, evictBlobs, fontRefs, getBlob, hasBlob } from '../src/engine/blobs';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';
import { featureLabel, leafBodies, parentsOf, prefixDoc, textDocumentProblem, textNodeProblem, textReliefNodeProblem, usesOf, withNode, type ModelNode, type NodeExtras, type StudioDoc, type TextReliefNode } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { flattenAssembly } from '../src/engine/flatten';
import { fontFromBytes, readFontSource, type FontSource } from '../src/engine/font/source';
import { featureId, fromFeature, nodeIndexOf, nodesOfName } from '../src/engine/ids';
import { readStudioDoc } from '../src/engine/migrate';
import { toPartDocument } from '../src/engine/part';
import { captureSignatures, referencesOf } from '../src/engine/references';
import type { Op, Proposal } from '../src/engine/schema/proposals';

const fonts = resolve(import.meta.dirname, '../../../apps/cad-studio/test/fixtures/fonts');
async function realFont(file = 'abeezee/ABeeZee-Regular.ttf'): Promise<FontSource> {
  return fontFromBytes(new Uint8Array(readFileSync(resolve(fonts, file))), { filename: file.split('/').at(-1)!, source: 'Provided font n1.top', license: 'Provided fixture OFL-1.1' });
}
function base(): StudioDoc { return part('text relief target').box({ w: 40, d: 30, h: 10 }).doc; }
function recipe(doc: StudioDoc, font: FontSource, mode: TextReliefNode['mode'] = 'emboss', text = 'A'): TextReliefNode {
  const node = doc.nodes.length - 1;
  return { kind: 'text-relief', parent: { node, side: 'solid' }, faces: [`${featureId(doc.nodes, node)}.top`], text, font, size: 10, at: [5, 5], depth: 2, mode, tolerance: 0.002 };
}
function captured(doc: StudioDoc, node: TextReliefNode & NodeExtras): StudioDoc {
  const evaluated = evaluateDoc(doc, 1);
  assert.ok(evaluated.ok, evaluated.ok ? '' : evaluated.error.detail);
  const out = captureSignatures(withNode(doc, node), evaluated.bodies);
  const written = out.nodes.at(-1)!;
  assert.equal(written.kind, 'text-relief');
  if (written.kind === 'text-relief') assert.ok(written.sigs?.[written.faces[0]], 'the selected cap has an individual stored signature');
  return out;
}
function native(doc: StudioDoc) {
  const nativeDoc = toPartDocument(doc), snapshot = evaluateCadPart(nativeDoc), output = outputOf(snapshot, doc.nodes.at(-1)!.id!);
  assert.equal(checkOutput(output).valid, true);
  return { nativeDoc, output, volume: massPropertiesOf(output).volume };
}
function typed(action: () => unknown, code?: string): void {
  assert.throws(action, error => error instanceof BarocssError && (code === undefined || error.code === code));
}
function proposalDoc(seed: StudioDoc, ops: Op[], status: Proposal['status'] = 'open'): StudioDoc {
  return { ...seed, proposals: [{ id: 'P-relief', title: 'Prepared text relief', status, by: { agent: 'test' }, at: '2026-10-28', base: 'test', ops,
    risk: { level: 'low', features_touched: 1, references_broken: 0, hard_requirements_changed: [], approval: [] }, summary: '' }] };
}
function prepared(font: FontSource): Op {
  return { tool: 'run_command', args: { command: 'text-relief', values: { text: 'A', font: JSON.stringify(font), size: 10, depth: 2, tolerance: 0.002 } } };
}

test('text relief adds or removes the independent straight-outline area from one physical box', async () => {
  const font = await realFont();
  for (const [mode, expected] of [['emboss', 12029.7594], ['engrave', 11970.2406]] as const) {
    const source = base(), original = structuredClone(source), node = recipe(source, font, mode), input = structuredClone(node), doc = captured(source, node), before = structuredClone(doc), result = native(doc);
    // Independent fontTools 4.67.0 oracle: ABeeZee A consists of straight edges, area 148797 at unitsPerEm 1000.
    // Volume is the fixed 40*30*10 base plus/minus 148797*(10/1000)^2*2. No generated profile is the oracle.
    assert.ok(Math.abs(result.volume - expected) < 1e-8, `${mode}: ${result.volume} vs ${expected}`);
    assert.equal(result.output.brep.bodies.length, 1);
    const target = evaluateDoc(source, 1); assert.ok(target.ok);
    assert.deepEqual(target.bodies[0].mesh.bounds.min, [0, 0, 0]);
    assert.deepEqual(target.bodies[0].mesh.bounds.max, [40, 30, 10]);
    const last = result.nativeDoc.features.at(-1)!;
    assert.equal(last.kind, 'profile-relief'); assert.equal(last.id, doc.nodes.at(-1)!.id);
    if (last.kind === 'profile-relief') {
      assert.deepEqual(last.faces, node.faces); assert.equal(last.clearance, node.tolerance); assert.equal(last.depth, 2);
      assert.equal(last.sketches.length, 1); assert.ok(last.expect?.[node.faces[0]]);
    }
    assert.deepEqual(source, original); assert.deepEqual(node, input); assert.deepEqual(doc, before);
    assert.deepEqual(parentsOf(doc.nodes.at(-1)!), [source.nodes.length - 1]);
    assert.deepEqual(usesOf(doc.nodes.at(-1)!), [source.nodes.length - 1]);
    assert.deepEqual(leafBodies(doc.nodes), [{ node: doc.nodes.length - 1, side: 'solid' }]);
    assert.equal(Object.keys(prefixDoc(doc, doc.nodes.length).outputs).length, 1);
    assert.equal(featureLabel(doc.nodes.at(-1)!, doc.nodes.length - 1, doc.nodes), mode === 'emboss' ? 'Text emboss · A' : 'Text engrave · A');
  }
});

test('text relief preserves bound dimensions and current-schema recipe through native Save/Open', async () => {
  const font = await realFont(), seed = base();
  seed.parameters = { em: 10, x: 5, y: 5, depth: 2, tracking: 0 };
  const node = { ...recipe(seed, font), size: { parameter: 'em' }, at: [{ parameter: 'x' }, { parameter: 'y' }], depth: { parameter: 'depth' }, tracking: { parameter: 'tracking' } } as TextReliefNode;
  const doc = captured(seed, node), before = structuredClone(doc), initial = native(doc), encoded = encodeStudioFile(doc), blob = getBlob(font.blob)!;
  const original = new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength).slice();
  dropBlobs([font.blob]);
  const opened = await readStudioFile(encoded); assert.ok('doc' in opened, JSON.stringify(opened));
  assert.deepEqual(opened.doc, before); assert.equal(opened.doc.schema, seed.schema);
  const restored = getBlob(font.blob)!; assert.deepEqual(new Uint8Array(restored.buffer, restored.byteOffset, restored.byteLength), original);
  assert.ok(Math.abs(native(opened.doc).volume - initial.volume) < 1e-8);
  const larger = { ...opened.doc, parameters: { ...opened.doc.parameters, em: 20 } };
  assert.ok(Math.abs(native(larger).volume - (12000 + 4 * 29.7594)) < 1e-8);
  const moved = { ...opened.doc, parameters: { ...opened.doc.parameters, x: 10 } };
  assert.ok(Math.abs(native(moved).volume - initial.volume) < 1e-8);
  assert.deepEqual(doc, before);
});

test('precomposed Korean components and local holes all seat into one physical base', async () => {
  for (const file of ['nanum-gothic/NanumGothic-Regular.ttf', 'nanum-myeongjo/NanumMyeongjo-Regular.ttf']) for (const mode of ['emboss', 'engrave'] as const) {
    const font = await realFont(file), seed = base(), doc = captured(seed, { ...recipe(seed, font, mode, '가한'), tolerance: 0.01 }), result = native(doc);
    const generated = result.nativeDoc.features.slice(toPartDocument(seed).features.length), sketches = generated.filter(feature => feature.kind === 'sketch');
    // Independent fontTools containment observations: 가 has 2 components; 한 has 5 components and one hole.
    assert.equal(sketches.length, 7); assert.equal(generated.length, 8);
    let holes = 0;
    for (const sketch of sketches) if ('holes' in sketch && sketch.holes) holes += sketch.holes.length;
    assert.equal(holes, 1);
    assert.equal(result.output.brep.bodies.length, 1); assert.ok(mode === 'emboss' ? result.volume > 12000 : result.volume < 12000);
    assert.equal(doc.nodes.at(-1)!.kind, 'text-relief');
  }
});

test('a tighter Korean pocket explicitly refuses the unchanged work budget without rewriting its tolerance', async () => {
  const font = await realFont('nanum-myeongjo/NanumMyeongjo-Regular.ttf'), seed = base();
  const doc = captured(seed, recipe(seed, font, 'engrave', '가한')), before = structuredClone(doc);
  assert.throws(() => native(doc), error => error instanceof BarocssError && error.code === 'INPUT' && error.message.includes('boundary/Boolean work budget'));
  assert.deepEqual(doc, before); assert.equal((doc.nodes.at(-1) as TextReliefNode).tolerance, 0.002);
});

test('structural relief validation shares Text source rules and rejects malformed modifier fields without rewriting', async () => {
  const font = await realFont(), seed = base(), good = recipe(seed, font), before = structuredClone(good);
  assert.equal(textReliefNodeProblem(good, seed.parameters), null, 'a missing signature is structurally permitted');
  assert.equal(textNodeProblem({ kind: 'text', text: good.text, font, size: good.size, height: good.depth, tolerance: good.tolerance }, {}), null);
  for (const change of [
    { parent: null }, { parent: { node: -1, side: 'solid' } }, { parent: { node: 1, side: 'unknown' } },
    { faces: [] }, { faces: [good.faces[0], good.faces[0]] }, { faces: [`${good.faces[0]}+n0.top`] },
    { at: [5] }, { at: [NaN, 5] }, { at: [{ parameter: 'missing' }, 5] }, { depth: 0 }, { mode: 'cut' },
    { tolerance: 0 }, { tolerance: 2 }, { text: ' ' }, { text: '\ud800' }, { plane: { origin: [0, 0, 0] } },
    { font: { ...font, guessedCoverage: 'all' } }, { sigs: { [good.faces[0]]: { k: 'plane', p: [0, 0, 10], d: [0, 0, 1], s: 1200, n: 2 } } },
    { sigs: { [good.faces[0]]: { k: 'plane', p: [0, 0, 10], d: [0, 0, 1], s: 1200, invented: true } } },
  ]) assert.equal(typeof textReliefNodeProblem({ ...good, ...change }, seed.parameters), 'string', JSON.stringify(change));
  assert.deepEqual(good, before);
  const raw = withNode(seed, good); typed(() => toPartDocument(raw), 'BAD_REFERENCE');
  const read = readStudioDoc(JSON.stringify(raw)); assert.ok('doc' in read, JSON.stringify(read));
  const wrongParent = { ...raw, nodes: raw.nodes.map((node, i) => i === raw.nodes.length - 1 ? { ...node, parent: { node: i, side: 'solid' } } : node) };
  assert.equal(typeof textDocumentProblem(wrongParent), 'string');
  const nested = { ...seed, instances: [{ id: 'nested', name: 'Nested', doc: { ...raw, nodes: raw.nodes.map(node => node.kind === 'text-relief' ? { ...node, at: [NaN, 5] } : node) }, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  assert.equal(typeof textDocumentProblem(nested), 'string');
});

test('native admission refuses unsupported faces, floating or overlapping strokes and excess depth atomically', async () => {
  const font = await realFont(), seed = base(), advance = readFontSource(font).glyph(65).advance * 0.01;
  for (const change of [{ at: [-100, -100] }, { depth: 10, mode: 'engrave' }, { text: 'AA', tracking: -advance }]) {
    const doc = captured(seed, { ...recipe(seed, font), ...change } as TextReliefNode), before = structuredClone(doc);
    typed(() => native(doc)); assert.deepEqual(doc, before);
  }
  const source = captured(seed, recipe(seed, font)), at = source.nodes.length - 1;
  const side = { ...source, nodes: source.nodes.map((node, i) => i === at && node.kind === 'text-relief' ? { ...node, faces: [`${featureId(seed.nodes, seed.nodes.length - 1)}.side0`] } as ModelNode : node) };
  const evaluated = evaluateDoc(seed, 1); assert.ok(evaluated.ok);
  const selected = captureSignatures(side, evaluated.bodies);
  typed(() => native(selected)); assert.deepEqual(seed, base());
});

test('suppressed relief passes the parent, while an active orphan reaches native source admission', async () => {
  const font = await realFont(), seed = base(), doc = captured(seed, recipe(seed, font)), last = doc.nodes.length - 1;
  const suppressed = { ...doc, nodes: doc.nodes.map((node, i) => i === last ? { ...node, suppressed: true as const } : node) };
  const result = native(suppressed); assert.equal(result.volume, 12000);
  assert.equal(result.nativeDoc.features.at(-1)!.kind, 'translate');
  const orphan = { ...doc, nodes: doc.nodes.map((node, i) => i === seed.nodes.length - 1 ? { ...node, suppressed: true as const } : node) };
  const expanded = toPartDocument(orphan);
  assert.equal(expanded.features.at(-1)!.kind, 'profile-relief');
  typed(() => evaluateCadPart(expanded));
});

test('relief signatures are captured, forwarded and renamed without mutating original source metadata', async () => {
  const font = await realFont(), seed = base(), doc = captured(seed, recipe(seed, font)), before = structuredClone(doc), reference = referencesOf(doc);
  assert.equal(reference.refs.length, 1); assert.equal(reference.refs[0].edge, false);
  assert.equal(reference.refs[0].name, (doc.nodes.at(-1) as TextReliefNode).faces[0]);
  reference.refs[0].rename('replacement.top', true);
  const changed = reference.doc.nodes.at(-1)!; assert.equal(changed.kind, 'text-relief');
  if (changed.kind === 'text-relief') { assert.deepEqual(changed.faces, ['replacement.top']); assert.ok(changed.sigs?.['replacement.top']); assert.equal(changed.font.source, 'Provided font n1.top'); }
  assert.deepEqual(doc, before);
});

test('generated relief sketch IDs retain authored priority and reject non-generated roles', async () => {
  const font = await realFont(), seed = base(), doc = captured(seed, recipe(seed, font)), at = doc.nodes.length - 1, id = featureId(doc.nodes, at), internal = `${id}_g0_c0_sketch`;
  assert.equal(nodeIndexOf(doc.nodes, internal), at); assert.equal(fromFeature(`${internal}.side0`, id, doc.nodes), true);
  assert.deepEqual(nodesOfName(doc.nodes, `${internal}.side0`), [at]);
  assert.equal(nodeIndexOf(doc.nodes, `${id}_g0_c0_extrude`), -1); assert.equal(nodeIndexOf(doc.nodes, `${id}_g0_c0_union`), -1);
  assert.equal(nodeIndexOf(doc.nodes, `${id}_g00_c0_sketch`), -1); assert.equal(nodeIndexOf(doc.nodes, `${id}_g0_c0_sketch_extra`), -1);
  const authored = { kind: 'sketch', id: internal, profile: 'rectangle', min: [0, 0], max: [1, 1] } as ModelNode;
  const nodes = [...doc.nodes, authored];
  assert.equal(nodeIndexOf(nodes, internal), nodes.length - 1); assert.equal(fromFeature(`${internal}.side0`, id, nodes), false);
  typed(() => toPartDocument({ ...doc, nodes }), 'BAD_REFERENCE');
});

test('relief feature budget and placed-coordinate preflight refuse before native evaluation', async () => {
  const font = await realFont(), seed = base(), doc = captured(seed, recipe(seed, font));
  const inserted: ModelNode[] = [];
  for (let i = 0; i < 510; i++) inserted.push({ kind: 'sketch', id: `padding${i}`, profile: 'rectangle', min: [0, 0], max: [1, 1] });
  const tooMany = { ...doc, nodes: [...seed.nodes, ...inserted, doc.nodes.at(-1)!] };
  typed(() => toPartDocument(tooMany), 'LIMIT');
  typed(() => toPartDocument(captured(seed, recipe(seed, font, 'emboss', 'A'.repeat(65)))), 'LIMIT');
  const outside = { ...doc, nodes: doc.nodes.map(node => node.kind === 'text-relief' ? { ...node, at: [10000, 10000] } as ModelNode : node) };
  typed(() => toPartDocument(outside), 'LIMIT');
});

test('font collectors retain relief nodes and nested prepared commands, but skip closed or malformed proposals', async () => {
  const font = await realFont(), seed = base(), doc = captured(seed, recipe(seed, font));
  assert.deepEqual([...fontRefs(doc)], [font.blob]); assert.deepEqual([...blobRefs(doc)], [font.blob]);
  const nested: Op = { tool: 'apply_ops', args: { ops: [{ tool: 'propose', args: { ops: [prepared(font)] } }] } } as Op;
  const onlyPrepared = proposalDoc({ ...seed, nodes: [], outputs: {} }, [nested]);
  assert.deepEqual([...fontRefs(onlyPrepared)], [font.blob]);
  evictBlobs([onlyPrepared]); evictBlobs([onlyPrepared]); assert.ok(hasBlob(font.blob));
  const encoded = blobsAsBase64(onlyPrepared); dropBlobs([font.blob]); await blobsFromBase64(encoded); assert.ok(hasBlob(font.blob));
  assert.deepEqual([...fontRefs(proposalDoc(seed, [prepared(font)], 'accepted'))], []);
  assert.deepEqual([...fontRefs(proposalDoc(seed, [{ tool: 'run_command', args: { command: 'text-relief', values: { font: '{broken' } } }]))], []);
});

test('assembly flatten keeps source text opaque, shifts its parent/face signatures and resolves Dim placement', async () => {
  const font = await realFont(), seed = base(); seed.parameters = { x: 5, y: 5 };
  const child = captured(seed, { ...recipe(seed, font, 'emboss', 'A'), at: [{ parameter: 'x' }, { parameter: 'y' }] });
  const own = base(), before = structuredClone(child), assembly: StudioDoc = { ...own, instances: [{ id: 'child', name: 'Child', doc: child, position: [0, 0, 0], rotation: [0, 0, 0] }] };
  const flat = flattenAssembly(assembly), relief = flat.nodes.find(node => node.kind === 'text-relief');
  assert.ok(relief && relief.kind === 'text-relief');
  assert.equal(relief.parent.node, seed.nodes.length - 1 + own.nodes.length);
  assert.equal(relief.faces[0], `n${seed.nodes.length - 1 + own.nodes.length}.top`);
  assert.ok(relief.sigs?.[relief.faces[0]]); assert.deepEqual(relief.at, [5, 5]);
  assert.deepEqual(relief.font, font); assert.equal(relief.text, 'A'); assert.equal(relief.font.source, 'Provided font n1.top');
  assert.deepEqual(child, before); assert.equal(toPartDocument(flat).features.some(feature => feature.kind === 'profile-relief'), true);
});
