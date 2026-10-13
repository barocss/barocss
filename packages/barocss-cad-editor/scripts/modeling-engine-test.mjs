// Pure worker routing/authority test with provider stubs. No native geometry is evaluated.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..'), output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-modeling-engine');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const circleTransfer = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/modeling-circle/baseline-native.json'), 'utf8'));
const holeTransfer = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/modeling-hole/baseline-native.json'), 'utf8'));
const packet = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/convex-display.packet.json'), 'utf8'));
const legacyDocument = JSON.parse(readFileSync(resolve(root, 'apps/cad-editor/src/fixtures/affine-prism.authored.json'), 'utf8'));
const document = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { height: 8 },
  nodes: [{ kind: 'sketch' }, { kind: 'extrude' }], outputs: { part: { node: 1, side: 'solid' }, other: { node: 1, side: 'solid' } } };
let modelCalls = 0, legacyCalls = 0, lastLegacy, lastPacket, sampleCalls = 0, intersectCalls = 0, splitCalls = 0;
function sampleBuilder() {
  sampleCalls++; const parameters = {}, nodes = [];
  const shape = index => ({ hole(options) { return shape(nodes.push({kind:'hole',parent:{node:index,side:'solid'},...options})-1); }, intersect(other) { intersectCalls++; const node = nodes.push({ kind: 'intersect', left: index, right: other.index }) - 1; return shape(node); },
    split(options) { splitCalls++; const node = nodes.push({ kind: 'split', parent: index, ...options }) - 1; return { negative: { index: node, side: 'negative' }, positive: { index: node, side: 'positive' } }; },
    edges(query) { return { one() { return { owner: index, query }; } }; },
    chamfer(selection, distance, options) { assert.equal(selection.owner, index); return shape(nodes.push({ kind: 'chamfer', parent: index, query: selection.query, distance, ...(options ? {name: options.name, suppressed:false} : {}) }) - 1); },
    index, cut() { const side = { edges() { return { one() { return {}; } }; }, chamfer() { return shape(nodes.push({ kind: 'chamfer' }) - 1); }, index: nodes.push({ kind: 'cut' }) - 1 }; return { positive: side, negative: side }; } });
  const sketch = profile => { const index = nodes.push({ kind: 'sketch', profile }) - 1; return { extrude(height) { return shape(nodes.push({ kind: 'extrude', sketch: index, height }) - 1); } }; };
  return { dimension: { add(left, right) { return { op: 'add', left, right }; }, scale(value, factor) { return { op: 'scale', value, factor }; } }, parameter(name, value) { parameters[name] = value; return { parameter: name }; }, sketch: { polygon: sketch, rectangle: sketch, circle(options) { const index = nodes.push({kind:"sketch",profile:"circle",...options}) - 1; return {extrude(height) {return shape(nodes.push({kind:"extrude",sketch:index,height}) - 1);}};} },
    build(outputs) { return snapshot({ ...document, parameters, nodes, outputs: Object.fromEntries(Object.entries(outputs).map(([name, body]) => [name, { node: body.index, side: body.side ?? 'solid' }])) }); } };
}
const snapshots = [], snapshotEdits = [], suppressionEdits = [], loads = [];
let nextLoadedSnapshot = null;
let tessellations = 0, rejectTessellation = false, unsupportedNativeReads = 0, holeTessellations = 0, rejectHoleTessellation = false, circleTessellations = 0, rejectCircleTessellation = false;
function snapshot(data) {
  const native = { report: { solidId: 'current_solid' }, certificate: { volumeMM3: { numerator: '1', denominator: '1' } }, graph: { vertices: [], edges: [], faces: [], vertexLinks: [] } };
  const body = { family: 'convex-planar', native };
  const unsupported = data.union ? {family:'orthogonal-cell',native:{report:{schema:'barocss-axis-box-solid-boolean'},a:{},panels:Array.from({length:65},()=>({}))}} : { family: data.unknownFamily ? 'unknown-family' : 'stored-rational-plate-hole', get native() { unsupportedNativeReads++; throw new Error('Unsupported native payload must not be inspected'); } };
  const result = { parameters: data.parameters, suppression:Object.fromEntries(data.nodes.filter(n=>n.name).map(n=>[n.name,n.suppressed])),
    withSuppression(values) { suppressionEdits.push({snapshot:result,values:structuredClone(values)}); if(data.parameters.backY===1) throw new Error('METRIC candidate refused'); return snapshot({...data,nodes:data.nodes.map(n=>n.name&&Object.hasOwn(values,n.name)?{...n,suppressed:values[n.name]}:n)}); },
    recomputation: Object.freeze({ reusedFeatures: Object.freeze([]), evaluatedFeatures: Object.freeze(data.nodes.map((_node, index) => index)) }),
    features: data.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: [], ...(node.name ? {name:node.name,suppressed:node.suppressed} : {}) })), bodies: Object.fromEntries(Object.keys(data.outputs).map(name => [name, (data.hole || data.unknownFamily || data.union) && name === 'part' ? unsupported : data.nodes[data.nodes[data.outputs[name].node]?.sketch]?.profile === 'circle' ? structuredClone(circleTransfer.bodies.post) : data.nodes.some(n=>n.kind==='hole') ? structuredClone(holeTransfer.bodies[data.nodes[data.outputs[name].node].kind==='hole'?'plate':'blank']) : body])),
    save: () => JSON.stringify({ ...data, outputs: Object.fromEntries(Object.entries(data.outputs).sort(([a], [b]) => a.localeCompare(b))) }), withParameters(values) { snapshotEdits.push({ snapshot: result, values: structuredClone(values) }); modelCalls++; if (Object.values(values).some(v => v < 0)) throw new Error('native candidate refused'); return snapshot({ ...data, parameters: { ...data.parameters, ...values } }); } };
  snapshots.push(result); return result;
}
globalThis.__modelingCad = { cad: { model: sampleBuilder, load(text) { modelCalls++; const data = JSON.parse(text); if (data.invalid) throw new Error('codec refused'); const result = nextLoadedSnapshot ?? snapshot(data); nextLoadedSnapshot = null; loads.push({ text, snapshot: result }); return result; } },
  tessellateXYCirclePrismShell(bundle, options) { circleTessellations++; if(rejectCircleTessellation) throw new Error('circle preview sampling refused'); assert.deepEqual(bundle,circleTransfer.bodies.post.native.parent.bundle); assert.equal(options.segmentsPerQuarter,4); const result=structuredClone(circleTransfer.preview); result.packet.surfaceId=options.meshId;result.packet.revision=options.revision;result.report.meshId=options.meshId;result.report.revision=options.revision;return result; },
  tessellateOwnPlateCircularHole(bundle, options) { holeTessellations++; if(rejectHoleTessellation) throw new Error('hole tessellation refused'); assert.deepEqual(bundle,holeTransfer.bodies.plate.native.bundle); assert.equal(options.segmentsPerQuarter,4); const result=structuredClone(holeTransfer.holeMesh); result.mesh.context=structuredClone(options.context); return result; },
  tessellateConvexPlanarSolid(body) { tessellations++; if (rejectTessellation) throw new Error('tessellation refused'); if(body.report.solidId===holeTransfer.bodies.blank.native.report.solidId) return structuredClone(holeTransfer.blankMesh); const { mesh, boundaries, internalDiagonals, report } = structuredClone(packet.components[0]); report.solidId = 'current_solid'; return { mesh, boundaries, internalDiagonals, report }; } };
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
      ? 'export const {cad,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__modelingCad;export function tessellateSurface(){throw Error("No panel execution in this guard test");}'
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
// Missing hole task context and unknown families are refused before reading payloads or tessellating.
const familyEngine = create();
const familyBaseline = familyEngine({ id: ++id, kind: 'open', text: JSON.stringify(document) });
assert.equal(familyBaseline.ok, true);
const acceptedFamilySnapshot = snapshots.at(-1), familyText = familyBaseline.text, familyDisplay = JSON.stringify(familyBaseline.display), beforeHoleTessellations = tessellations;
const refusedHole = familyEngine({ id: ++id, kind: 'open', text: JSON.stringify({ ...document, nodes:[...document.nodes,{kind:'hole'}], outputs:{part:{node:2,side:'solid'}}, hole: true }) });
assert.equal(refusedHole.ok, false); assert.match(refusedHole.message, /current display task token/);
assert.equal(unsupportedNativeReads, 0); assert.equal(tessellations, beforeHoleTessellations);
assert.equal(familyBaseline.text, familyText); assert.equal(JSON.stringify(familyBaseline.display), familyDisplay); checks++;
const familyRecovery = familyEngine({ id: ++id, kind: 'apply', expectedRevision: 0, parameters: { height: 6 } });
assert.equal(familyRecovery.ok, true); assert.equal(snapshotEdits.at(-1).snapshot, acceptedFamilySnapshot);
assert.equal(familyRecovery.summary.revision, 1); checks++;
// The same real recorded geometry is replayed through the actual worker serializer; providers remain stubbed.
const holeEngine = create(), holeBase = holeEngine({id:++id,kind:'example',example:'mounting-plate',taskToken:'hole_baseline'});
assert.equal(holeBase.ok,true,holeBase.message); assert.equal(holeBase.display.profile,'model-body-faces');
assert.deepEqual(holeBase.summary.parameters,holeTransfer.parameters);
assert.deepEqual(holeBase.summary.outputs.map(o=>[o.name,o.family,o.volumeMM3]),[['blank','convex-planar',{numerator:'25600',denominator:'1'}],['plate','stored-rational-plate-hole',null]]); checks++;
const serializedHole=holeBase.display.components[1];
assert.deepEqual(serializedHole.preview.mesh.chunks,holeTransfer.holeMesh.mesh.chunks);
assert.deepEqual(serializedHole.preview.provenance,holeTransfer.holeMesh.provenance);
assert.deepEqual(serializedHole.preview.report,holeTransfer.holeMesh.report);
assert.deepEqual(serializedHole.preview.mesh.context,{documentId:'cad_model',bodyId:'m2_body',documentRevision:'0',kernelResultRevision:'0',topologyRevision:'0',taskToken:'hole_baseline'});
assert.equal(serializedHole.qualification.solid,true);assert.equal(serializedHole.preview.report.solid,false);checks++;
for(const taskToken of [null,'',1,{},'x'.repeat(49),'contains space']) {
 const before=modelCalls+sampleCalls; assert.equal(holeEngine({id:++id,kind:'example',example:'mounting-plate',taskToken}).ok,false);assert.equal(modelCalls+sampleCalls,before);checks++;
}
const beforeUnknown=tessellations+holeTessellations;
assert.equal(holeEngine({id:++id,kind:'open',text:JSON.stringify({...document,unknownFamily:true}),taskToken:'unknown_family'}).ok,false);
assert.equal(unsupportedNativeReads,0);assert.equal(tessellations+holeTessellations,beforeUnknown);checks++;
const acceptedHole=snapshots.at(-2); // Failed unknown-family snapshot is the latest temporary candidate.
rejectHoleTessellation=true;
const holeRefused=holeEngine({id:++id,kind:'apply',expectedRevision:0,parameters:{radius:2.5},taskToken:'refused_mesh'});
assert.equal(holeRefused.ok,false);assert.equal(snapshotEdits.at(-1).snapshot,acceptedHole);
rejectHoleTessellation=false;
const holeRecovered=holeEngine({id:++id,kind:'apply',expectedRevision:0,parameters:{radius:2.5},taskToken:'recovered_mesh'});
assert.equal(holeRecovered.ok,true,holeRecovered.message);assert.equal(snapshotEdits.at(-1).snapshot,acceptedHole);
assert.equal(holeRecovered.summary.revision,1);assert.equal(holeRecovered.display.components[1].preview.mesh.context.taskToken,'recovered_mesh');checks++;
const holeReopened=create()({id:++id,kind:'open',text:holeRecovered.text,revision:1,taskToken:'reopened_mesh'});
assert.equal(holeReopened.ok,true);assert.deepEqual(holeReopened.summary,holeRecovered.summary);checks++;
// Oversized union display refuses all output tessellation before replacing accepted authority.
for(const kind of ['convex','hole']) {
 const guarded=create(),baseline=kind==='hole'?guarded({id:++id,kind:'example',example:'mounting-plate',taskToken:'union_guard_hole'}):guarded({id:++id,kind:'open',text:JSON.stringify(document)});
 assert.equal(baseline.ok,true);const accepted=snapshots.at(-1),text=baseline.text,display=JSON.stringify(baseline.display),before=tessellations+holeTessellations;
 const refused=guarded({id:++id,kind:'open',text:JSON.stringify({...document,nodes:[...document.nodes,{kind:'union'}],outputs:{other:{node:1,side:'solid'},part:{node:2,side:'solid'}},union:true}),taskToken:'union_refusal'});
 assert.equal(refused.ok,false);assert.match(refused.message,/complete preview requires 1..64 panels/);
 assert.equal(unsupportedNativeReads,0);assert.equal(tessellations+holeTessellations,before);
 assert.equal(baseline.text,text);assert.equal(JSON.stringify(baseline.display),display);checks++;
 const recovered=guarded({id:++id,kind:'apply',expectedRevision:0,parameters:kind==='hole'?{radius:2.5}:{height:6},taskToken:'union_recovery'});
 assert.equal(recovered.ok,true,recovered.message);assert.equal(snapshotEdits.at(-1).snapshot,accepted);assert.equal(recovered.summary.revision,1);checks++;
}
// A malformed difference family is rejected before every native getter, including an earlier union.
// The loaded snapshot's canonical graph is authoritative even when the incoming text has no difference.
let differenceSummaryReads = 0;
for (const acceptedKind of ['convex', 'hole']) for (const firstKind of ['extrude', 'hole', 'union']) {
  const guarded = create(), baseline = acceptedKind === 'hole'
    ? guarded({ id: ++id, kind: 'example', example: 'mounting-plate', taskToken: 'difference_guard_hole' })
    : guarded({ id: ++id, kind: 'open', text: JSON.stringify(document) });
  assert.equal(baseline.ok, true, baseline.message);
  const accepted = snapshots.at(-1), savedBaseline = JSON.stringify(baseline), before = tessellations + holeTessellations;
  const differenceGraph = { ...document, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] }, { kind: 'extrude', sketch: 0, height: { parameter: 'height' } },
    { kind: 'sketch', profile: 'rectangle', min: [8, 0], max: [16, 8] }, { kind: 'extrude', sketch: 2, height: 8 },
    firstKind === 'hole' ? { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [16, 12], radius: 2 }
      : { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } },
    { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } },
  ], outputs: { aSupported: { node: firstKind === 'extrude' ? 1 : 4, side: 'solid' }, zDifference: { node: 5, side: 'solid' } } };
  const candidate = snapshot(differenceGraph);
  candidate.bodies = Object.fromEntries(Object.keys(differenceGraph.outputs).map(name => [name, {
    family: name === 'zDifference' ? 'convex-planar' : firstKind === 'union' ? 'orthogonal-cell' : firstKind === 'hole' ? 'stored-rational-plate-hole' : 'convex-planar',
    get native() { unsupportedNativeReads++; throw new Error('Difference refusal must precede every native payload getter'); },
  }]));
  for (const property of ['parameters', 'suppression', 'features']) Object.defineProperty(candidate, property, {
    get() { differenceSummaryReads++; throw new Error('Difference refusal must precede snapshot summary reads'); },
  });
  nextLoadedSnapshot = candidate;
  const refused = guarded({ id: ++id, kind: 'open', text: JSON.stringify({ ...document, operation: 'union' }), taskToken: 'difference_refusal' });
  assert.equal(refused.ok, false); assert.match(refused.message, /Authored output kind differs/);
  assert.equal(unsupportedNativeReads, 0); assert.equal(differenceSummaryReads, 0); assert.equal(tessellations + holeTessellations, before);
  assert.equal(JSON.stringify(baseline), savedBaseline); checks++;
  const recovered = guarded({ id: ++id, kind: 'apply', expectedRevision: 0,
    parameters: acceptedKind === 'hole' ? { radius: 2.5 } : { height: 6 }, taskToken: 'difference_recovery' });
  assert.equal(recovered.ok, true, recovered.message); assert.equal(snapshotEdits.at(-1).snapshot, accepted);
  assert.equal(recovered.summary.revision, 1); checks++;
}
// Neither a caller operation label nor an unreferenced difference node changes a convex output.
const unusedDifference = { ...document, operation: 'difference', nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] }, { kind: 'extrude', sketch: 0, height: { parameter: 'height' } },
  { kind: 'sketch', profile: 'rectangle', min: [8, 0], max: [16, 8] }, { kind: 'extrude', sketch: 2, height: 8 },
  { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } },
] };
const convexWithUnusedDifference = create()({ id: ++id, kind: 'open', text: JSON.stringify(unusedDifference) });
assert.equal(convexWithUnusedDifference.ok, true, convexWithUnusedDifference.message);
assert.equal(convexWithUnusedDifference.display.profile, 'model-outputs'); checks++;
// A forged family label refuses before any payload or summary access; genuine circle transport follows below.
let circleSummaryReads = 0;
for (const acceptedKind of ['convex', 'hole']) for (const family of ['convex-planar', 'stored-rational-plate-hole', 'orthogonal-cell']) {
  const guarded = create(), baseline = acceptedKind === 'hole'
    ? guarded({ id: ++id, kind: 'example', example: 'mounting-plate', taskToken: 'circle_guard_hole' })
    : guarded({ id: ++id, kind: 'open', text: JSON.stringify(document) });
  assert.equal(baseline.ok, true, baseline.message);
  const accepted = snapshots.at(-1), original = JSON.stringify(baseline), before = tessellations + holeTessellations;
  const circleGraph = { ...document, nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [8,8] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'sketch', profile: 'circle', center: [2,-3], radius: 4 }, { kind: 'extrude', sketch: 2, height: 6 },
  ], outputs: { aSupported: { node: 1, side: 'solid' }, zPost: { node: 3, side: 'solid' } } };
  const candidate = snapshot(circleGraph);
  candidate.bodies = Object.fromEntries(Object.keys(circleGraph.outputs).map(name => [name, {
    family: name === 'zPost' ? family : 'convex-planar',
    get native() { unsupportedNativeReads++; throw new Error('Circle refusal must precede every native payload getter'); },
  }]));
  for (const property of ['parameters','suppression','features']) Object.defineProperty(candidate, property, {
    get() { circleSummaryReads++; throw new Error('Circle refusal must precede summary access'); },
  });
  nextLoadedSnapshot = candidate;
  // Saved trusted candidate ancestry, not an arbitrary field in the incoming text, is used.
  const refused = guarded({ id: ++id, kind: 'open', text: JSON.stringify({ ...document, profile: 'rectangle' }), taskToken: 'circle_refusal' });
  assert.equal(refused.ok, false); assert.match(refused.message, /Authored output kind differs/);
  assert.equal(unsupportedNativeReads, 0); assert.equal(circleSummaryReads, 0); assert.equal(tessellations + holeTessellations, before);
  assert.equal(JSON.stringify(baseline), original); checks++;
  const recovered = guarded({ id: ++id, kind: 'apply', expectedRevision: 0, parameters: acceptedKind === 'hole' ? { radius: 2.5 } : { height: 6 }, taskToken: 'circle_recovery' });
  assert.equal(recovered.ok, true, recovered.message); assert.equal(snapshotEdits.at(-1).snapshot, accepted); checks++;
}
// A complete union-slot graph refuses before every native payload and summary,
// even when its composed output is hidden or laundered under an existing family.
let compositionSummaryReads = 0;
const compositionNodes = [
  { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [32,8] }, { kind: 'extrude', sketch: 0, height: 8 },
  { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [8,24] }, { kind: 'extrude', sketch: 2, height: 8 },
  { kind: 'union', left: {node:1,side:'solid'}, right: {node:3,side:'solid'} },
  { kind: 'sketch', profile: 'rectangle', min: [16,2], max: [24,6] }, { kind: 'extrude', sketch: 5, height: 8 },
  { kind: 'difference', parent: {node:4,side:'solid'}, tool: {node:6,side:'solid'} },
];
for (const acceptedKind of ['convex','hole','circle']) for (const family of ['convex-planar','orthogonal-cell']) for (const hidden of [false,true]) {
  const guarded=create(),baseline=acceptedKind==='convex'
    ? guarded({id:++id,kind:'open',text:JSON.stringify(document)})
    : guarded({id:++id,kind:'example',example:acceptedKind==='hole'?'mounting-plate':'round-post',taskToken:'composition_base'});
  assert.equal(baseline.ok,true,baseline.message);
  const accepted=snapshots.at(-1),saved=JSON.stringify(baseline),before=tessellations+holeTessellations+circleTessellations;
  const graph={...document,nodes:structuredClone(compositionNodes),outputs:hidden?{base:{node:1,side:'solid'}}:{base:{node:1,side:'solid'},slot:{node:7,side:'solid'}}};
  const candidate=snapshot(graph);
  candidate.bodies=Object.fromEntries(Object.keys(graph.outputs).map(name=>[name,{family,
    get native(){unsupportedNativeReads++;throw Error('Composition must refuse before native access');}}]));
  for(const property of ['parameters','suppression','features'])Object.defineProperty(candidate,property,{get(){compositionSummaryReads++;throw Error('Composition must refuse before summary access');}});
  nextLoadedSnapshot=candidate;
  const refused=guarded({id:++id,kind:'open',text:JSON.stringify({...document,operation:'union'}),taskToken:'composition_refused'});
  assert.equal(refused.ok,false);assert.match(refused.message,/Composed union-slot preview is not available/);
  assert.equal(unsupportedNativeReads,0);assert.equal(compositionSummaryReads,0);
  assert.equal(tessellations+holeTessellations+circleTessellations,before);assert.equal(JSON.stringify(baseline),saved);checks++;
  const recovered=guarded({id:++id,kind:'apply',expectedRevision:0,parameters:acceptedKind==='hole'?{radius:2.5}:{height:9},taskToken:'composition_recovery'});
  assert.equal(recovered.ok,true,recovered.message);assert.equal(snapshotEdits.at(-1).snapshot,accepted);assert.equal(recovered.summary.revision,1);checks++;
}
// Native schema remains a second boundary if a forged provider omits ancestry.
const forgedSchemaGraph={...document,nodes:[...compositionNodes.slice(0,4),{kind:'difference',parent:{node:1,side:'solid'},tool:{node:3,side:'solid'}}],outputs:{part:{node:4,side:'solid'}}};
const forgedSchema=snapshot(forgedSchemaGraph);let composedPayloadReads=0;
forgedSchema.bodies={part:{family:'orthogonal-cell',native:{report:{schema:'barocss-orthogonal-solid-boolean'},
  get panels(){composedPayloadReads++;throw Error('Composed panels must not enter the two-box receiver');}}}};
nextLoadedSnapshot=forgedSchema;
const schemaRefusal=create()({id:++id,kind:'open',text:JSON.stringify(document),taskToken:'composition_schema'});
assert.equal(schemaRefusal.ok,false);assert.match(schemaRefusal.message,/separate native-schema receiver/);assert.equal(composedPayloadReads,0);checks++;
// Genuine measured baseline is serialized through the real adapter with fresh display-only context.
const roundEngine=create(),roundFirst=roundEngine({id:++id,kind:'example',example:'round-post',taskToken:'round_initial'});
assert.equal(roundFirst.ok,true,roundFirst.message);assert.equal(roundFirst.summary.outputs[0].family,'stored-rational-circle-prism');assert.equal(roundFirst.summary.outputs[0].volumeMM3,null);assert.equal(roundFirst.display.components[0].preview.packet.positions.length/3,98);checks++;
const beforeRound=JSON.stringify(roundFirst),roundCount=circleTessellations;
rejectCircleTessellation=true;const roundRefusal=roundEngine({id:++id,kind:'apply',expectedRevision:0,parameters:{height:9},taskToken:'round_refused'});rejectCircleTessellation=false;
assert.equal(roundRefusal.ok,false);assert.match(roundRefusal.message,/circle preview sampling refused/);assert.equal(JSON.stringify(roundFirst),beforeRound);assert.equal(circleTessellations,roundCount+1);checks++;
const roundRecovered=roundEngine({id:++id,kind:'apply',expectedRevision:0,parameters:{height:9},taskToken:'round_recovered'});assert.equal(roundRecovered.ok,true,roundRecovered.message);assert.equal(roundRecovered.summary.revision,1);assert.equal(roundRecovered.display.components[0].mesh.context.taskToken,'round_recovered');checks++;
assert.equal(create()({id:++id,kind:'example',example:'round-post'}).ok,false);checks++;
const unusedCircle = { ...document, nodes: [
  { kind: 'sketch', profile: 'rectangle', min: [0,0], max: [8,8] }, { kind: 'extrude', sketch: 0, height: 8 },
  { kind: 'sketch', profile: 'circle', center: [2,-3], radius: 4 }, { kind: 'extrude', sketch: 2, height: 6 },
] };
const unusedCircleReply = create()({ id: ++id, kind: 'open', text: JSON.stringify(unusedCircle) });
assert.equal(unusedCircleReply.ok, true, unusedCircleReply.message); assert.equal(unusedCircleReply.display.profile, 'model-outputs'); checks++;
// Configuration commands retain the actual accepted snapshot and use only withSuppression.
const finishEngine=create();
const finishBase=finishEngine({id:++id,kind:'example',example:'configurable-finishes'});
assert.equal(finishBase.ok,true);assert.deepEqual(finishBase.summary.suppression,{frontFinish:false,backFinish:false});
assert.deepEqual(finishBase.summary.features.filter(f=>f.name).map(f=>[f.name,f.suppressed]),[['frontFinish',false],['backFinish',false]]);checks++;
let finishSnapshot=snapshots.at(-1), finishRevision=0;
for(const flags of [{frontFinish:false,backFinish:true},{frontFinish:true,backFinish:false},{frontFinish:true,backFinish:true},{frontFinish:false,backFinish:false}]) {
  const edits=snapshotEdits.length, changed=finishEngine({id:++id,kind:'suppression',expectedRevision:finishRevision,suppression:flags});
  assert.equal(changed.ok,true);assert.deepEqual(changed.summary.suppression,flags);assert.equal(suppressionEdits.at(-1).snapshot,finishSnapshot);
  assert.equal(snapshotEdits.length,edits);finishSnapshot=snapshots.at(-1);finishRevision++;checks++;
}
let getterCalls=0;
for(const bad of [null,[],Object.create(null),{unknown:true},{frontFinish:1},{frontFinish:'true'},Object.create({frontFinish:true}),Object.defineProperty({},'frontFinish',{get(){getterCalls++;return true;},enumerable:true}),Object.defineProperty({},'frontFinish',{value:true}),{[Symbol('x')]:true}]) {
  const edits=suppressionEdits.length;
  assert.equal(finishEngine({id:++id,kind:'suppression',expectedRevision:finishRevision,suppression:bad}).ok,false);assert.equal(suppressionEdits.length,edits);checks++;
}
assert.equal(getterCalls,0);checks++;
assert.equal(finishEngine({id:++id,kind:'suppression',expectedRevision:finishRevision-1,suppression:{frontFinish:true}}).ok,false);checks++;
rejectTessellation=true;
assert.equal(finishEngine({id:++id,kind:'suppression',expectedRevision:finishRevision,suppression:{frontFinish:true}}).ok,false);
rejectTessellation=false;
const afterFailure=finishEngine({id:++id,kind:'suppression',expectedRevision:finishRevision,suppression:{backFinish:true}});
assert.equal(afterFailure.ok,true);assert.equal(suppressionEdits.at(-1).snapshot,finishSnapshot);checks++;
const reopenFinish=create()({id:++id,kind:'open',text:afterFailure.text,revision:afterFailure.summary.revision});
assert.equal(reopenFinish.ok,true);assert.deepEqual(reopenFinish.summary,afterFailure.summary);checks++;
assert.equal(Object.hasOwn(first.summary,'suppression'),false);assert.ok(first.summary.features.every(f=>!Object.hasOwn(f,'name')&&!Object.hasOwn(f,'suppressed')));checks++;
const result = { ok: true, checks, modelCalls, legacyCalls, holeTessellations, holeGeometryReplay:true, retainedSnapshotIdentityChecks: 7, coldLoadCallsObserved: loads.length, acceptedOutputsStillTessellate: true, recomputationNotTransported: true, evidence: 'stubbed providers; pure worker routing and authority only; no native geometry' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
