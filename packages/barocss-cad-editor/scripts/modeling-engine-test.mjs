// Pure worker routing/authority test with provider stubs. No native geometry is evaluated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-modeling-engine');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const packet = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/convex-display.packet.json'), 'utf8'));
const legacyDocument = JSON.parse(readFileSync(resolve(root, 'apps/cad-editor/src/fixtures/affine-prism.authored.json'), 'utf8'));
const document = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { height: 8 },
  nodes: [{ kind: 'sketch' }, { kind: 'extrude' }], outputs: { part: { node: 1, side: 'solid' }, other: { node: 1, side: 'solid' } } };
let modelCalls = 0, legacyCalls = 0, lastLegacy, lastPacket, sampleCalls = 0, intersectCalls = 0, splitCalls = 0;
function sampleBuilder() {
  sampleCalls++; const parameters = {}, nodes = [];
  const shape = index => ({ intersect(other) { intersectCalls++; const node = nodes.push({ kind: 'intersect', left: index, right: other.index }) - 1; return shape(node); },
    split(options) { splitCalls++; const node = nodes.push({ kind: 'split', parent: index, ...options }) - 1; return { negative: { index: node, side: 'negative' }, positive: { index: node, side: 'positive' } }; },
    edges(query) { return { one() { return { owner: index, query }; } }; },
    chamfer(selection, distance) { assert.equal(selection.owner, index); return shape(nodes.push({ kind: 'chamfer', parent: index, query: selection.query, distance }) - 1); },
    index, cut() { const side = { edges() { return { one() { return {}; } }; }, chamfer() { return shape(nodes.push({ kind: 'chamfer' }) - 1); }, index: nodes.push({ kind: 'cut' }) - 1 }; return { positive: side, negative: side }; } });
  const sketch = profile => { const index = nodes.push({ kind: 'sketch', profile }) - 1; return { extrude(height) { return shape(nodes.push({ kind: 'extrude', sketch: index, height }) - 1); } }; };
  return { dimension: { add(left, right) { return { op: 'add', left, right }; }, scale(value, factor) { return { op: 'scale', value, factor }; } }, parameter(name, value) { parameters[name] = value; return { parameter: name }; }, sketch: { polygon: sketch, rectangle: sketch },
    build(outputs) { return snapshot({ ...document, parameters, nodes, outputs: Object.fromEntries(Object.entries(outputs).map(([name, body]) => [name, { node: body.index, side: body.side ?? 'solid' }])) }); } };
}
const snapshots = [], snapshotEdits = [], loads = [];
let tessellations = 0, rejectTessellation = false;
function snapshot(data) {
  const body = { report: { solidId: 'current_solid' }, certificate: { volumeMM3: { numerator: '1', denominator: '1' } }, graph: { vertices: [], edges: [], faces: [], vertexLinks: [] } };
  const result = { parameters: data.parameters,
    recomputation: Object.freeze({ reusedFeatures: Object.freeze([]), evaluatedFeatures: Object.freeze(data.nodes.map((_node, index) => index)) }),
    features: data.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: [] })), bodies: Object.fromEntries(Object.keys(data.outputs).map(name => [name, body])),
    save: () => JSON.stringify({ ...data, outputs: Object.fromEntries(Object.entries(data.outputs).sort(([a], [b]) => a.localeCompare(b))) }), withParameters(values) { snapshotEdits.push({ snapshot: result, values: structuredClone(values) }); modelCalls++; if (Object.values(values).some(v => v < 0)) throw new Error('native candidate refused'); return snapshot({ ...data, parameters: { ...data.parameters, ...values } }); } };
  snapshots.push(result); return result;
}
globalThis.__modelingCad = { cad: { model: sampleBuilder, load(text) { modelCalls++; const data = JSON.parse(text); if (data.invalid) throw new Error('codec refused'); const result = snapshot(data); loads.push({ text, snapshot: result }); return result; } },
  tessellateConvexPlanarSolid() { tessellations++; if (rejectTessellation) throw new Error('tessellation refused'); const { mesh, boundaries, internalDiagonals, report } = structuredClone(packet.components[0]); report.solidId = 'current_solid'; return { mesh, boundaries, internalDiagonals, report }; } };
globalThis.__modelingLegacy = () => {
  let accepted;
  return command => {
    legacyCalls++; lastLegacy = command;
    if (command.kind === 'open') {
      const parsed = JSON.parse(command.text); if (parsed.invalid) return { id: command.id, ok: false, message: 'legacy codec refused' };
      accepted = structuredClone(legacyDocument); accepted.version = parsed.version;
    } else {
      if (command.expectedRevision !== accepted.revision) return { id: command.id, ok: false, message: 'legacy stale' };
      accepted.revision++; for (const e of command.edits) accepted.parameters.find(p => p.id === e.parameterId).valueMM = e.valueMM;
    }
    const fraction = { numerator: '1', denominator: '1' };
    lastPacket = { ...structuredClone(packet), documentId: accepted.id, revision: accepted.revision };
    return { id: command.id, ok: true, text: JSON.stringify(accepted), display: lastPacket,
      summary: { document: structuredClone(accepted), dependencies: accepted.nodes.map(n => ({ nodeId: n.id, dependsOn: [] })),
        components: packet.outcomes, volumes: { first: fraction, second: fraction }, selectedWalls: [] } };
  };
};
const bundle = await require('esbuild').build({ entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/modeling-engine.ts')], bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'explicit-provider-stubs', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'stub' }));
    build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: args.path === 'cad'
      ? 'export const {cad,tessellateConvexPlanarSolid}=globalThis.__modelingCad;'
      : 'export const createPrismFeatureEngine=globalThis.__modelingLegacy;' }));
  } }] });
writeFileSync(resolve(output, 'engine.mjs'), bundle.outputFiles[0].text);
const { createModelingEngine: create, modelingSourceKind: kind } = await import(pathToFileURL(resolve(output, 'engine.mjs')));
let checks = 0, id = 0;
assert.equal(kind(JSON.stringify(document)), 'model'); assert.equal(kind(JSON.stringify(legacyDocument)), 0);
assert.equal(kind(JSON.stringify({ ...legacyDocument, version: 2 })), 2); checks++;
for (const text of ['[]', 'null', '3', '{broken', '{}', JSON.stringify({ ...document, schema: 2 }), JSON.stringify({ ...legacyDocument, version: 1 }), JSON.stringify({ ...legacyDocument, version: '2' }), ' '.repeat(262145)]) assert.throws(() => kind(text));
assert.equal(modelCalls + legacyCalls, 0); checks++;
const engine = create();
const first = engine({ id: ++id, kind: 'open', text: JSON.stringify(document) }); assert.equal(first.ok, true); assert.equal(first.summary.source, 'model'); checks++;
assert.deepEqual(first.summary.outputs.map(o => o.name), Object.keys(JSON.parse(first.text).outputs));
assert.deepEqual(first.display.components.map(c => c.role), ['other', 'part']); checks++;
const edited = engine({ id: ++id, kind: 'apply', expectedRevision: 0, parameters: { height: 6 } }); assert.equal(edited.ok, true); assert.equal(edited.summary.parameters.height, 6); checks++;
assert.equal(engine({ id: ++id, kind: 'apply', expectedRevision: 0, parameters: { height: 5 } }).ok, false);
assert.equal(engine({ id: ++id, kind: 'apply', expectedRevision: 1, parameters: { height: -1 } }).ok, false);
assert.equal(engine({ id: ++id, kind: 'open', text: JSON.stringify({ ...legacyDocument, invalid: true }) }).ok, false);
const retained = engine({ id: ++id, kind: 'apply', expectedRevision: 1, parameters: { height: 7 } }); assert.equal(retained.ok, true); assert.equal(retained.summary.revision, 2); checks++;
const reopened = create()({ id: ++id, kind: 'open', text: retained.text, revision: 2 }); assert.equal(reopened.ok, true); assert.deepEqual(reopened.summary, retained.summary); checks++;
for (const version of [0, 2]) {
  const text = JSON.stringify({ ...legacyDocument, version });
  const legacy = engine({ id: ++id, kind: 'open', text }); assert.equal(legacy.ok, true); assert.equal(lastLegacy.version, version); assert.equal(lastLegacy.text, text);
  assert.equal(legacy.display, lastPacket); assert.equal(legacy.summary.source, 'legacy'); assert.equal(JSON.parse(legacy.text).version, version); checks++;
  assert.equal(engine({ id: ++id, kind: 'open', text: JSON.stringify({ ...document, invalid: true }) }).ok, false);
  const editedLegacy = engine({ id: ++id, kind: 'apply', expectedRevision: legacy.summary.revision, parameters: { upperX: 24 } });
  assert.equal(editedLegacy.ok, true); assert.equal(editedLegacy.display, lastPacket); assert.deepEqual(lastLegacy.edits, [{ parameterId: 'upperX', valueMM: 24 }]); checks++;
}
const sampleEngine = create();
const defaultSample = sampleEngine({ id: ++id, kind: 'example' });
assert.equal(defaultSample.ok, true); assert.deepEqual(defaultSample.summary.outputs.map(o => o.name), ['other', 'part']); checks++;
const overlapSample = sampleEngine({ id: ++id, kind: 'example', example: 'intersection' });
assert.equal(overlapSample.ok, true); assert.deepEqual(overlapSample.summary.outputs.map(o => o.name), ['overlap']);
assert.deepEqual(overlapSample.summary.parameters, { rearX: 16, leftX: 8, rightX: 40, lowY: -8, highY: 24, height: 4 });
assert.equal(overlapSample.summary.features.at(-1).kind, 'intersect'); assert.equal(intersectCalls, 1); checks++;
const splitSample = sampleEngine({ id: ++id, kind: 'example', example: 'horizontal-split' });
assert.equal(splitSample.ok, true); assert.deepEqual(splitSample.summary.outputs.map(o => o.name), ['lower', 'upper']);
assert.deepEqual(splitSample.summary.parameters, { height: 8, splitHeight: 2 });
assert.equal(splitSample.summary.features.at(-1).kind, 'split'); assert.equal(splitCalls, 1);
assert.deepEqual(JSON.parse(splitSample.text).outputs, { lower: { node: 2, side: 'negative' }, upper: { node: 2, side: 'positive' } }); checks++;
for (const splitAxis of ['x', 'y', 'z']) {
  const sample = sampleEngine({ id: ++id, kind: 'example', example: 'horizontal-split', splitAxis });
  assert.equal(sample.ok, true); const document = JSON.parse(sample.text);
  assert.equal(document.nodes.at(-1).axis, splitAxis);
  assert.deepEqual(sample.summary.outputs.map(o => o.name), splitAxis === 'z' ? ['lower', 'upper'] : ['negative', 'positive']);
  assert.deepEqual(sample.summary.parameters, splitAxis === 'z' ? { height: 8, splitHeight: 2 } : { splitAt: 16, rearX: 16, height: 8 }); checks++;
}
const chainSample = sampleEngine({ id: ++id, kind: 'example', example: 'two-chamfer' });
assert.equal(chainSample.ok, true);
assert.deepEqual(chainSample.summary.parameters, { frontDistance: 1, backDistance: 2, backY: 24 });
assert.deepEqual(chainSample.summary.outputs.map(o => o.name), ['part']);
const chainDocument = JSON.parse(chainSample.text);
assert.deepEqual(chainDocument.nodes.map(node => node.kind), ['sketch', 'extrude', 'chamfer', 'chamfer']);
assert.equal(chainDocument.nodes[2].parent, 1); assert.equal(chainDocument.nodes[3].parent, 2); checks++;
for (const splitAxis of [undefined, 'x', 'z']) {
  const sample = sampleEngine({ id: ++id, kind: 'example', example: 'chamfer-split', splitAxis });
  assert.equal(sample.ok, true); const doc = JSON.parse(sample.text);
  assert.deepEqual(sample.summary.parameters, { frontDistance: 1, backDistance: 2, splitAt: splitAxis === 'z' ? 4 : 16 });
  assert.deepEqual(doc.nodes.map(node => node.kind), ['sketch', 'extrude', 'chamfer', 'chamfer', 'split']);
  assert.equal(doc.nodes[3].parent, 2); assert.equal(doc.nodes[4].parent, 3);
  assert.equal(doc.nodes[4].axis, splitAxis ?? 'x');
  assert.deepEqual(doc.outputs, { negative: { node: 4, side: 'negative' }, positive: { node: 4, side: 'positive' } }); checks++;
}
const miterSample = sampleEngine({ id: ++id, kind: 'example', example: 'miter-split' });
assert.equal(miterSample.ok, true); const miterGraph = JSON.parse(miterSample.text);
assert.deepEqual(miterSample.summary.parameters, { cutPosition: 24 });
assert.deepEqual(miterGraph.nodes.map(node => node.kind), ['sketch', 'extrude', 'split']);
assert.deepEqual(miterGraph.nodes[2], { kind: 'split', parent: 1, plane: 'x+y', at: { parameter: 'cutPosition' } });
assert.deepEqual(miterGraph.outputs, { negative: { node: 2, side: 'negative' }, positive: { node: 2, side: 'positive' } }); checks++;
const derivedSample = sampleEngine({ id: ++id, kind: 'example', example: 'derived-split' });
assert.equal(derivedSample.ok, true); const derivedGraph = JSON.parse(derivedSample.text);
assert.deepEqual(derivedSample.summary.parameters, { width: 32, offset: 0, frontDistance: 1, backDistance: 2 });
assert.deepEqual(derivedGraph.nodes[4].at, { op: 'add', left: { op: 'scale', value: { parameter: 'width' }, factor: 0.5 }, right: { parameter: 'offset' } });
assert.deepEqual(derivedGraph.nodes[0].profile, { width: { parameter: 'width' }, height: 24 });
assert.equal(derivedGraph.nodes[4].axis, 'x'); assert.equal(derivedGraph.nodes[4].parent, 3);
assert.equal(Object.hasOwn(derivedSample.summary.parameters, 'splitAt'), false); checks++;
for (const [example, splitAxis] of [['miter-split', 'x'], ['miter-split', 'y'], ['miter-split', 'z'], ['miter-split', null], ['miter-split', {}], ['derived-split', 'x'], ['derived-split', 'z'], ['derived-split', null], ['chamfer-split', 'y'], ['chamfer-split', 'q'], ['chamfer-split', null], ['chamfer-split', 1], ['chamfer-split', {}], ['horizontal-split', 'q'], ['horizontal-split', null], ['horizontal-split', 1], ['horizontal-split', {}], ['intersection', 'x'], ['cut-chamfer', 'z'], ['two-chamfer', 'x'], [undefined, 'y']]) {
  const calls = sampleCalls;
  assert.equal(sampleEngine({ id: ++id, kind: 'example', example, splitAxis }).ok, false);
  assert.equal(sampleCalls, calls); checks++;
}
const beforeSamples = sampleCalls;
assert.equal(sampleEngine({ id: ++id, kind: 'example', example: 'not-a-sample' }).ok, false);
assert.equal(sampleCalls, beforeSamples); checks++;
const afterBadSample = sampleEngine({ id: ++id, kind: 'apply', expectedRevision: 0, parameters: { backDistance: 3 } });
assert.equal(afterBadSample.ok, true); assert.equal(afterBadSample.summary.parameters.backDistance, 3); checks++;
// Accepted snapshot identity is observed directly in provider stubs, not inferred from counters.
const reuseEngine = create();
const coldReply = reuseEngine({ id: ++id, kind: 'open', text: JSON.stringify(document) });
assert.equal(coldReply.ok, true); const coldSnapshot = loads.at(-1).snapshot;
assert.equal(Object.hasOwn(coldReply.summary, 'recomputation'), false);
assert.equal(Object.hasOwn(JSON.parse(coldReply.text), 'recomputation'), false); checks++;
let reuseReply = reuseEngine({ id: ++id, kind: 'apply', expectedRevision: 0, parameters: { height: 6 } });
assert.equal(reuseReply.ok, true); assert.equal(snapshotEdits.at(-1).snapshot, coldSnapshot);
const firstAccepted = snapshots.at(-1); assert.notEqual(firstAccepted, coldSnapshot); checks++;
reuseReply = reuseEngine({ id: ++id, kind: 'apply', expectedRevision: 1, parameters: { height: 5 } });
assert.equal(reuseReply.ok, true); assert.equal(snapshotEdits.at(-1).snapshot, firstAccepted);
const secondAccepted = snapshots.at(-1); checks++;
const refusedEdit = reuseEngine({ id: ++id, kind: 'apply', expectedRevision: 2, parameters: { height: -1 } });
assert.equal(refusedEdit.ok, false); assert.equal(snapshotEdits.at(-1).snapshot, secondAccepted);
reuseReply = reuseEngine({ id: ++id, kind: 'apply', expectedRevision: 2, parameters: { height: 4 } });
assert.equal(reuseReply.ok, true); assert.equal(snapshotEdits.at(-1).snapshot, secondAccepted);
const beforeDisplayFailure = snapshots.at(-1); checks++;
rejectTessellation = true;
const refusedDisplay = reuseEngine({ id: ++id, kind: 'apply', expectedRevision: 3, parameters: { height: 3 } });
assert.equal(refusedDisplay.ok, false); assert.equal(snapshotEdits.at(-1).snapshot, beforeDisplayFailure);
const discardedCandidate = snapshots.at(-1); assert.notEqual(discardedCandidate, beforeDisplayFailure);
rejectTessellation = false; const tessellationsBefore = tessellations;
reuseReply = reuseEngine({ id: ++id, kind: 'apply', expectedRevision: 3, parameters: { height: 2 } });
assert.equal(reuseReply.ok, true); assert.equal(snapshotEdits.at(-1).snapshot, beforeDisplayFailure);
assert.equal(tessellations - tessellationsBefore, Object.keys(document.outputs).length, 'Accepted outputs still tessellate'); checks++;
const beforeExplicitOpen = snapshots.at(-1), editsBeforeOpen = snapshotEdits.length, loadsBeforeOpen = loads.length;
const explicitlyOpened = reuseEngine({ id: ++id, kind: 'open', text: reuseReply.text });
assert.equal(explicitlyOpened.ok, true); assert.equal(loads.length, loadsBeforeOpen + 1);
assert.equal(loads.at(-1).text, reuseReply.text); assert.notEqual(loads.at(-1).snapshot, beforeExplicitOpen);
assert.equal(snapshotEdits.length, editsBeforeOpen); checks++;
const freshEngine = create(), fresh = freshEngine({ id: ++id, kind: 'open', text: reuseReply.text, revision: 4 });
assert.equal(fresh.ok, true); assert.equal(fresh.summary.revision, 4); assert.equal(loads.length, loadsBeforeOpen + 2);
const reconstructed = loads.at(-1).snapshot; assert.notEqual(reconstructed, beforeExplicitOpen);
const afterReconstruction = freshEngine({ id: ++id, kind: 'apply', expectedRevision: 4, parameters: { height: 7 } });
assert.equal(afterReconstruction.ok, true); assert.equal(snapshotEdits.at(-1).snapshot, reconstructed);
assert.equal(Object.hasOwn(afterReconstruction.summary, 'recomputation'), false); checks++;
const before = modelCalls + legacyCalls;
assert.equal(engine({ id: ++id, kind: 'open', text: JSON.stringify({ ...legacyDocument, version: 1 }) }).ok, false);
assert.equal(modelCalls + legacyCalls, before); checks++;
const result = { ok: true, checks, modelCalls, legacyCalls, retainedSnapshotIdentityChecks: 7, coldLoadCallsObserved: loads.length, acceptedOutputsStillTessellate: true, recomputationNotTransported: true, evidence: 'stubbed providers; pure worker routing and authority only; no native geometry' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
