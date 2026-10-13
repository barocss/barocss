// CPU/controller admission only. Recorded mesh + graph-shaped test DTOs, never new native geometry.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-modeling-controller'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const bundle = await require('esbuild').build({ stdin: { contents: `export * from '${resolve(root, 'packages/barocss-cad-editor/src/modeling-controller.ts')}'; export * from '${resolve(root, 'packages/barocss-cad-editor/src/prism-feature-scene.ts')}';`, resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src/index.ts') } });
writeFileSync(resolve(output, 'controller.mjs'), bundle.outputFiles[0].text);
const { createCadEditorModelingController: create, preparePrismFeatureScene: prepare, pickPrismFeatureScene: pick } = await import(pathToFileURL(resolve(output, 'controller.mjs')));
const base = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/convex-display.packet.json'), 'utf8')).components[0];
const signedJSON = value => JSON.stringify(value, (_key, v) => Object.is(v, -0) ? '__negative_zero__' : v).replaceAll('"__negative_zero__"', '-0');
// A deliberately synthesized graph DTO exercises copied-data consistency, not native authenticity.
function graphFor(component) {
  const { mesh, boundaries } = component, vertices = [], edges = [];
  for (const [i, v] of mesh.vertices.entries()) {
    let vertex = vertices.find(p => p.id === v.solidVertexId);
    if (!vertex) { vertex = { id: v.solidVertexId, pointMM: mesh.positionsMM.slice(i * 3, i * 3 + 3), members: [] }; vertices.push(vertex); }
    vertex.members.push({ sourceId: v.sourceId, faceId: v.faceId, vertexId: v.nativeVertexId });
  }
  for (const boundary of boundaries) {
    let edge = edges.find(e => e.id === boundary.solidEdgeId);
    if (!edge) { edge = { id: boundary.solidEdgeId, vertexIds: boundary.solidVertexIds, uses: [] }; edges.push(edge); }
    edge.uses.push({ sourceId: boundary.sourceId, faceId: boundary.faceId, surfaceId: mesh.faces[boundary.faceIndex].surfaceId, loopId: boundary.loopId,
      use: { id: boundary.useId, edgeId: boundary.edgeId, curveId: boundary.curveId, pcurveId: boundary.pcurveId, sense: boundary.sense, interval: boundary.interval, vertexIds: boundary.nativeVertexIds } });
  }
  const faces = mesh.faces.map((face, i) => ({ sourceId: face.sourceId, faceId: face.faceId, surfaceId: face.surfaceId, loopId: face.loopId,
    vertexIds: mesh.vertices.slice(face.vertexOffset, face.vertexOffset + face.vertexCount).map(v => v.solidVertexId), edgeIds: boundaries.filter(b => b.faceIndex === i).map(b => b.solidEdgeId) }));
  return { vertices, edges, faces };
}
const graph = graphFor(base), nativeId = base.report.solidId;
const authored = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { height: 8, signed: -0 },
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 16] }, { kind: 'extrude', sketch: 0, height: { parameter: 'height' } }],
  outputs: { part: { node: 1, side: 'solid' } } };
const overlap = { ...structuredClone(authored), parameters: { rearX: 16, leftX: 8, rightX: 40, lowY: -8, highY: 24, height: 4 },
  nodes: [{ kind: 'sketch' }, { kind: 'extrude' }, { kind: 'sketch' }, { kind: 'extrude' }, { kind: 'intersect' }],
  outputs: { overlap: { node: 4, side: 'solid' } } };
const difference = { ...structuredClone(authored), nodes: [
  ...structuredClone(authored.nodes),
  { kind: 'sketch', profile: 'rectangle', min: [8, 0], max: [16, 8] }, { kind: 'extrude', sketch: 2, height: 8 },
  { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } },
], outputs: { blank: { node: 1, side: 'solid' }, part: { node: 4, side: 'solid' } } };
const split = { ...structuredClone(authored), parameters: { height: 8, splitHeight: 2 },
  nodes: [{ kind: 'sketch' }, { kind: 'extrude' }, { kind: 'split', parent: 1, axis: 'z', at: { parameter: 'splitHeight' } }],
  outputs: { lower: { node: 2, side: 'negative' }, upper: { node: 2, side: 'positive' } } };
const cardinal = axis => ({ ...structuredClone(split), parameters: { splitAt: 16, rearX: 16, height: 8 },
  nodes: split.nodes.map((node, index) => index === 2 ? { ...node, axis, at: { parameter: 'splitAt' } } : node),
  outputs: { negative: { node: 2, side: 'negative' }, positive: { node: 2, side: 'positive' } } });
const chamferChain = { ...structuredClone(authored), parameters: { frontDistance: 1, backDistance: 2, backY: 24 },
  nodes: [{ kind: 'sketch' }, { kind: 'extrude', sketch: 0 },
    { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: { parameter: 'frontDistance' } },
    { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edge: { parallelTo: 'x', at: { y: { parameter: 'backY' }, z: 'max' } }, distance: { parameter: 'backDistance' } }],
  outputs: { part: { node: 3, side: 'solid' } } };
const chamferSplit = axis => ({ ...structuredClone(chamferChain), parameters: { frontDistance: 1, backDistance: 2, splitAt: axis === 'z' ? 4 : 16 },
  nodes: [...structuredClone(chamferChain.nodes).map((node, index) => index === 3 ? { ...node, edge: { parallelTo: 'x', at: { y: 24, z: 'max' } } } : node),
    { kind: 'split', parent: { node: 3, side: 'solid' }, axis, at: { parameter: 'splitAt' } }],
  outputs: { negative: { node: 4, side: 'negative' }, positive: { node: 4, side: 'positive' } } });
const derivedSplit = () => {
  const document = chamferSplit('x'); document.parameters = { width: 32, offset: 0, frontDistance: 1, backDistance: 2 };
  document.nodes[0] = { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'width' }, 24] };
  document.nodes[4].at = { op: 'add', left: { op: 'scale', value: { parameter: 'width' }, factor: 0.5 }, right: { parameter: 'offset' } };
  return document;
};
const miterSplit = () => ({ ...structuredClone(authored), parameters: { cutPosition: 24 },
  nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [32, 24] }, { kind: 'extrude', sketch: 0, height: 8 },
    { kind: 'split', parent: { node: 1, side: 'solid' }, plane: 'x+y', at: { parameter: 'cutPosition' } }],
  outputs: { negative: { node: 2, side: 'negative' }, positive: { node: 2, side: 'positive' } } });
const configurableFinishes = () => {
  const doc=chamferSplit('x');doc.parameters={frontDistance:1,backDistance:2,backY:24};doc.nodes[4].at=16;
  doc.nodes[3].edge.at.y={parameter:'backY'};
  doc.nodes[2].name='frontFinish';doc.nodes[2].suppressed=false;doc.nodes[3].name='backFinish';doc.nodes[3].suppressed=false;
  return doc;
};
function reply(document = authored, revision = 0) {
  const names = Object.keys(document.outputs);
  return { id: 1, ok: true, text: signedJSON(document), summary: { documentId: 'cad_model', revision, source: 'model', parameters: document.parameters,
    ...(document.nodes.some(n=>n.name)?{suppression:Object.fromEntries(document.nodes.filter(n=>n.name).map(n=>[n.name,n.suppressed]))}:{}),
    features: document.nodes.map((node, index) => ({ kind: node.kind, index, ...(node.name?{name:node.name,suppressed:node.suppressed}:{}), dependencies: node.kind === 'chamfer' || (node.kind === 'split' && typeof node.parent === 'object') ? [node.parent.node] : index === 4 ? [1, 3] : index % 2 ? [index - 1] : [] })),
    outputs: names.map(name => ({ name, solidId: nativeId, volumeMM3: { numerator: '1', denominator: '1' } })) },
  display: { profile: 'model-outputs', documentId: 'cad_model', revision,
    components: names.map(name => ({ ...structuredClone(base), role: name, lineage: { kind: 'model-output', name, solidId: nativeId, graph: structuredClone(graph) } })),
    outcomes: names.map(role => ({ role, solidId: nativeId, status: 'solid' })) } };
}
const instances = [], timers = new Set(), originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
globalThis.setTimeout = callback => { const timer = { callback }; timers.add(timer); return timer; };
globalThis.clearTimeout = timer => timers.delete(timer);
class Worker {
  callbacks = new Map(); requests = []; terminated = false;
  constructor() { instances.push(this); }
  addEventListener(name, callback) { this.callbacks.set(name, callback); }
  postMessage(command) { this.requests.push(command); }
  terminate() { this.terminated = true; }
  send(result, id = this.requests.at(-1).id) { this.callbacks.get('message')({ data: { ...structuredClone(result), id } }); }
  accept(command = this.requests.at(-1)) {
    const document = command.kind === 'example' ? structuredClone(command.example === 'intersection' ? overlap : command.example === 'horizontal-split' ? (command.splitAxis === 'x' || command.splitAxis === 'y' ? cardinal(command.splitAxis) : split) : command.example === 'two-chamfer' ? chamferChain : command.example === 'chamfer-split' ? chamferSplit(command.splitAxis ?? 'x') : command.example === 'derived-split' ? derivedSplit() : command.example === 'miter-split' ? miterSplit() : command.example === 'configurable-finishes' ? configurableFinishes() : authored) : command.kind === 'open' ? JSON.parse(command.text) : structuredClone(this.document);
    if (command.kind === 'apply') Object.assign(document.parameters, command.parameters);
    if (command.kind === 'suppression') for(const n of document.nodes) if(n.name&&Object.hasOwn(command.suppression,n.name)) n.suppressed=command.suppression[n.name];
    this.document = document;
    const result = reply(document, command.kind === 'apply' || command.kind === 'suppression' ? command.expectedRevision + 1 : command.revision ?? 0); this.send(result, command.id); return result;
  }
}
globalThis.Worker = Worker;
const tick = () => Promise.resolve();
const stable = s => { const x = s.getSnapshot(); return { accepted: x.accepted, authoredText: x.authoredText, display: x.display, faceSelection: x.faceSelection, selection: x.selection, generation: x.generation, history: x.history, drafts: x.drafts }; };
let checks = 0, legacyChecks = 0;
try {
  // Existing all-convex scenes retain their exact shape and have no output-only chooser.
  const convexOnly=create();const convexPending=convexOnly.example(),convexWorker=instances.at(-1);convexWorker.accept();await convexPending;
  const convexAccepted=stable(convexOnly);assert.equal(Object.hasOwn(convexAccepted.display,'selectedOutput'),false);
  await assert.rejects(convexOnly.viewOutput('part',convexAccepted.generation),/current named output/);assert.deepEqual(stable(convexOnly),convexAccepted);
  assert.match(convexWorker.requests[0].taskToken,/^[A-Za-z0-9_-]{36}$/);convexOnly.dispose();checks+=2;
  // Difference cannot be laundered as an untagged convex, tagged convex, union or legacy reply.
  for (const mode of ['untagged-convex', 'tagged-convex', 'tagged-union', 'legacy-v0', 'legacy-v2']) {
    let commits = 0;
    const guarded = create({ prepare: async () => ({ commit() { commits++; }, dispose() {} }) });
    let pending = guarded.example(), worker = instances.at(-1); worker.accept(); await pending;
    guarded.stage('height', '6'); pending = guarded.apply(); worker.accept(); await pending;
    guarded.stage('height', '7'); guarded.select(1, guarded.getSnapshot().generation);
    const before = stable(guarded), commitCount = commits, candidate = reply(difference);
    if (mode.startsWith('legacy')) {
      const legacy = { format: 'barocss-xy-affine-prism-feature-document', version: mode === 'legacy-v0' ? 0 : 2,
        id: candidate.summary.documentId, revision: 0,
        parameters: Object.entries(difference.parameters).map(([id, valueMM]) => ({ id, valueMM })), nodes: structuredClone(difference.nodes) };
      candidate.text = signedJSON(legacy); candidate.summary.source = 'legacy';
      candidate.compatibility = { document: legacy, components: candidate.display.outcomes };
    }
    pending = guarded.open(candidate.text);
    if (mode.startsWith('tagged')) {
      candidate.display.profile = 'model-body-faces'; candidate.display.taskToken = worker.requests.at(-1).taskToken;
      candidate.display.components = candidate.display.components.map(component => ({ family: 'convex-planar', component }));
      for (const output of candidate.summary.outputs) output.family = 'convex-planar';
      for (const outcome of candidate.display.outcomes) outcome.family = 'convex-planar';
      if (mode === 'tagged-union') {
        candidate.summary.outputs[1].family = candidate.display.outcomes[1].family = 'orthogonal-cell';
        candidate.display.components[1] = { family: 'orthogonal-cell', role: 'part', solidId: nativeId,
          qualification: { operation: 'union', volumeMM3: 1 } };
      }
    }
    worker.send(candidate); await pending;
    assert.match(guarded.getSnapshot().error, mode.startsWith('legacy') ? /Legacy files cannot author.*difference/ : /tagged body-face transport|output family|authored operation/);
    assert.deepEqual(stable(guarded), before); assert.equal(commits, commitCount); assert.equal(worker.terminated, true); checks++;
    // Recovery must reconstruct the previous accepted source, retaining the pending dimension edit.
    pending = guarded.apply(); worker = instances.at(-1);
    assert.equal(worker.requests[0].kind, 'open'); assert.equal(worker.requests[0].text, before.authoredText);
    assert.equal(worker.requests[0].revision, before.accepted.revision); worker.accept(); await tick();
    assert.equal(worker.requests[1].kind, 'apply'); assert.deepEqual(worker.requests[1].parameters, { height: 7 });
    worker.accept(); await pending;
    assert.equal(guarded.getSnapshot().accepted.parameters.height, 7);
    assert.equal(guarded.getSnapshot().history.count, before.history.count + 1); assert.equal(commits, commitCount + 1);
    assert.deepEqual(guarded.getSnapshot().drafts, {}); assert.equal(guarded.getSnapshot().error, null); guarded.dispose(); checks++;
  }
  // The new eight-node chain cannot masquerade as existing transports or hide
  // behind an earlier output. Every refusal preserves history/selection/recovery.
  for(const mode of ['untagged-convex','tagged-convex','old-orthogonal','legacy-v0','legacy-v2','hidden-chain','display-getter']) {
    let commits=0,displayReads=0;
    const guarded=create({prepare:async()=>({commit(){commits++;},dispose(){}})});
    let pending=guarded.example(),worker=instances.at(-1);worker.accept();await pending;
    guarded.stage('height','6');pending=guarded.apply();worker.accept();await pending;
    guarded.stage('height','7');guarded.select(1,guarded.getSnapshot().generation);
    const before=stable(guarded),commitCount=commits;
    const graph={...structuredClone(authored),nodes:[
      ...structuredClone(authored.nodes),
      {kind:'sketch',profile:'rectangle',min:[0,0],max:[8,24]},{kind:'extrude',sketch:2,height:8},
      {kind:'union',left:{node:1,side:'solid'},right:{node:3,side:'solid'}},
      {kind:'sketch',profile:'rectangle',min:[16,2],max:[24,6]},{kind:'extrude',sketch:5,height:8},
      {kind:'difference',parent:{node:4,side:'solid'},tool:{node:6,side:'solid'}},
    ],outputs:mode==='hidden-chain'?{base:{node:1,side:'solid'}}:{part:{node:7,side:'solid'}}};
    graph.nodes[7].tool.node=3; // This malformed ancestry remains unavailable even if its output is hidden.
    const candidate=reply(graph);
    if(mode.startsWith('legacy')) {
      const legacy={format:'barocss-xy-affine-prism-feature-document',version:mode==='legacy-v0'?0:2,
        id:candidate.summary.documentId,revision:0,parameters:Object.entries(graph.parameters).map(([id,valueMM])=>({id,valueMM})),nodes:graph.nodes};
      candidate.text=signedJSON(legacy);candidate.summary.source='legacy';candidate.compatibility={document:legacy,components:candidate.display.outcomes};
    }
    pending=guarded.open(candidate.text);
    if(mode==='tagged-convex'||mode==='old-orthogonal') {
      const family=mode==='old-orthogonal'?'orthogonal-cell':'convex-planar';
      candidate.display.profile='model-body-faces';candidate.display.taskToken=worker.requests.at(-1).taskToken;
      candidate.summary.outputs[0].family=candidate.display.outcomes[0].family=family;
      candidate.display.components=family==='convex-planar'?[{family,component:candidate.display.components[0]}]
        :[{family,role:'part',solidId:nativeId,qualification:{operation:'difference',volumeMM3:1}}];
    }
    if(mode==='display-getter') {
      Object.defineProperty(candidate,'display',{get(){displayReads++;throw Error('Unsupported chain must refuse before display');}});
      candidate.id=worker.requests.at(-1).id;worker.callbacks.get('message')({data:candidate});
    } else worker.send(candidate);
    await pending;assert.match(guarded.getSnapshot().error,/Composed preview requires the supported eight-node/);
    assert.equal(displayReads,0);assert.deepEqual(stable(guarded),before);assert.equal(commits,commitCount);assert.equal(worker.terminated,true);checks++;
    pending=guarded.apply();worker=instances.at(-1);assert.equal(worker.requests[0].text,before.authoredText);worker.accept();await tick();
    assert.deepEqual(worker.requests[1].parameters,{height:7});worker.accept();await pending;
    assert.equal(guarded.getSnapshot().error,null);assert.equal(guarded.getSnapshot().accepted.parameters.height,7);
    assert.equal(guarded.getSnapshot().history.count,before.history.count+1);assert.equal(commits,commitCount+1);guarded.dispose();checks++;
  }
  // A circle extrusion cannot masquerade as any existing transport or a legacy file.
  for (const mode of ['untagged-convex','tagged-convex','tagged-circle','legacy-v0','legacy-v2']) {
    let commits = 0;
    const guarded = create({ prepare: async () => ({ commit() { commits++; }, dispose() {} }) });
    let pending = guarded.example(), worker = instances.at(-1); worker.accept(); await pending;
    guarded.stage('height','7'); const before = stable(guarded), commitCount = commits;
    const circle = { ...structuredClone(authored), nodes: [
      { kind: 'sketch', profile: 'circle', center: [2,-3], radius: 4 }, { kind: 'extrude', sketch: 0, height: { parameter: 'height' } },
    ] };
    const candidate = reply(circle);
    if (mode.startsWith('legacy')) {
      const legacy = { format: 'barocss-xy-affine-prism-feature-document', version: mode === 'legacy-v0' ? 0 : 2,
        id: candidate.summary.documentId, revision: 0, parameters: Object.entries(circle.parameters).map(([id,valueMM]) => ({id,valueMM})), nodes: structuredClone(circle.nodes) };
      candidate.text = signedJSON(legacy); candidate.summary.source = 'legacy'; candidate.compatibility = { document: legacy, components: candidate.display.outcomes };
    }
    pending = guarded.open(candidate.text);
    if (mode.startsWith('tagged')) {
      const family = mode === 'tagged-circle' ? 'stored-rational-circle-prism' : 'convex-planar';
      candidate.display.profile = 'model-body-faces'; candidate.display.taskToken = worker.requests.at(-1).taskToken;
      candidate.display.components = candidate.display.components.map(component => ({ family, component }));
      for (const output of candidate.summary.outputs) output.family = family;
      for (const output of candidate.display.outcomes) output.family = family;
    }
    worker.send(candidate); await pending;
    assert.match(guarded.getSnapshot().error, mode.startsWith('legacy') ? /Legacy files cannot author primary circle/ : mode === 'tagged-circle' ? /Circle outputs have no certified volume/ : /Authored circle outputs/);
    assert.deepEqual(stable(guarded),before); assert.equal(commits,commitCount); assert.equal(worker.terminated,true); checks++;
    pending = guarded.apply(); worker = instances.at(-1); worker.accept(); await tick(); worker.accept(); await pending;
    assert.equal(guarded.getSnapshot().accepted.parameters.height,7); assert.equal(commits,commitCount+1); guarded.dispose(); checks++;
  }
  const unusedCircle = { ...structuredClone(authored), nodes: [...structuredClone(authored.nodes),
    {kind:'sketch',profile:'circle',center:[2,-3],radius:4},{kind:'extrude',sketch:2,height:6}] };
  const circleUnused = create(), circleUnusedPending = circleUnused.open(signedJSON(unusedCircle));
  instances.at(-1).send(reply(unusedCircle)); await circleUnusedPending;
  assert.equal(circleUnused.getSnapshot().error,null); circleUnused.dispose(); checks++;
  const unusedDifference = { ...structuredClone(difference), outputs: { blank: { node: 1, side: 'solid' } } };
  const convexWithUnusedDifference = create();
  const unusedPending = convexWithUnusedDifference.open(signedJSON(unusedDifference));
  instances.at(-1).send(reply(unusedDifference)); await unusedPending;
  assert.equal(convexWithUnusedDifference.getSnapshot().error, null);
  assert.deepEqual(convexWithUnusedDifference.getSnapshot().accepted.outputs.map(output => output.name), ['blank']);
  convexWithUnusedDifference.dispose(); checks++;
  // Configuration, dimensions and history share one atomic channel per accepted action.
  const f=create();let fp=f.example('configurable-finishes'),fw=instances.at(-1);fw.accept();await fp;
  assert.deepEqual(f.getSnapshot().accepted.suppression,{frontFinish:false,backFinish:false});checks++;
  const finishBase=stable(f), requestCount=fw.requests.length;
  await f.configureFinishes({frontFinish:false,backFinish:false});assert.deepEqual(stable(f),finishBase);assert.equal(fw.requests.length,requestCount);checks++;
  f.stage('frontDistance','2');const pendingDimension=stable(f);
  await assert.rejects(f.configureFinishes({frontFinish:true}),/Apply or discard/);assert.deepEqual(stable(f),pendingDimension);checks++;
  fp=f.apply();fw.accept();await fp;const dimOne=stable(f);
  fp=f.configureFinishes({frontFinish:true,backFinish:false});assert.equal(fw.requests.at(-1).kind,'suppression');fw.accept();await fp;const configOne=stable(f);
  f.stage('backDistance','3');fp=f.apply();fw.accept();await fp;const dimTwo=stable(f);checks++;
  for(const [direction,expected,channel] of [['undo',configOne,'apply'],['undo',dimOne,'suppression'],['undo',finishBase,'apply'],['redo',dimOne,'apply'],['redo',configOne,'suppression'],['redo',dimTwo,'apply']]) {
    fp=f[direction]();assert.equal(fw.requests.at(-1).kind,channel);fw.accept();await fp;
    assert.deepEqual(f.getSnapshot().accepted.parameters,expected.accepted.parameters);assert.deepEqual(f.getSnapshot().accepted.suppression,expected.accepted.suppression);assert.equal(f.getSnapshot().authoredText,expected.authoredText);checks++;
  }
  let getterCalls=0;
  for(const bad of [null,[],Object.create(null),{missing:true},{frontFinish:0},{frontFinish:'true'},Object.create({frontFinish:true}),Object.defineProperty({},'frontFinish',{enumerable:true,get(){getterCalls++;return true;}}),Object.defineProperty({},'frontFinish',{value:true}),{[Symbol('x')]:true}]) {
    const before=stable(f),count=fw.requests.length;await assert.rejects(f.configureFinishes(bad));assert.deepEqual(stable(f),before);assert.equal(fw.requests.length,count);checks++;
  }
  assert.equal(getterCalls,0);checks++;
  for(const flags of [{frontFinish:false,backFinish:true},{frontFinish:true,backFinish:false},{frontFinish:true,backFinish:true},{frontFinish:false,backFinish:false}]) {
    fp=f.configureFinishes(flags);fw.accept();await fp;assert.deepEqual(f.getSnapshot().accepted.suppression,flags);checks++;
  }
  const beforeRefusal=stable(f);fp=f.configureFinishes({frontFinish:true});fw.send({ok:false,message:'METRIC candidate refused'});await fp;assert.deepEqual(stable(f),beforeRefusal);checks++;
  fp=f.configureFinishes({frontFinish:true});const lateFinish=fw.requests.at(-1);f.cancel();fw.accept(lateFinish);await fp;assert.deepEqual(stable(f),beforeRefusal);checks++;
  fp=f.configureFinishes({backFinish:true});fw=instances.at(-1);assert.equal(fw.requests.at(-1).kind,'open');assert.equal(fw.requests.at(-1).text,beforeRefusal.authoredText);fw.accept();await tick();assert.equal(fw.requests.at(-1).kind,'suppression');fw.accept();await fp;assert.deepEqual(f.getSnapshot().accepted.suppression,{frontFinish:false,backFinish:true});checks++;
  fp=f.open(f.getSnapshot().authoredText);fw.accept();await fp;assert.equal(f.getSnapshot().history.count,1);assert.deepEqual(f.getSnapshot().accepted.suppression,{frontFinish:false,backFinish:true});f.dispose();checks++;
  const stale=create();fp=stale.example('configurable-finishes');fw=instances.at(-1);fw.accept();await fp;
  fp=stale.configureFinishes({frontFinish:true});const beforeStale=stable(stale),oldID=fw.requests.at(-1).id;
  fw.send({ok:false,message:'stale'},oldID-1);assert.equal(stale.getSnapshot().busy,true);assert.deepEqual(stable(stale),beforeStale);fw.accept();await fp;checks++;
  stale.cancel();const beforeReconstruction=stable(stale);fp=stale.configureFinishes({backFinish:true});fw=instances.at(-1);
  const wrongSeed=JSON.parse(fw.requests[0].text);wrongSeed.nodes[2].suppressed=false;fw.send(reply(wrongSeed,stale.getSnapshot().accepted.revision));await fp;
  assert.deepEqual(stable(stale),beforeReconstruction);assert.match(stale.getSnapshot().error,/Reconstruction/);assert.equal(fw.requests.length,1);stale.dispose();checks++;
  // Omitted metadata remains genuinely omitted; extra empty/undefined flags are refused.
  for(const extra of [{suppression:{}},{suppression:undefined}]) {
    const s=create();fp=s.example();const r=reply();Object.assign(r.summary,extra);instances.at(-1).send(r);await fp;assert.equal(s.getSnapshot().accepted,null);assert.ok(s.getSnapshot().error);s.dispose();checks++;
  }
  // Configuration mismatch, graph mutation and staging/race failures cannot replace accepted state.
  for(const mode of ['display-refusal','cancel-staging','worker-failure-staging','wrong-flags','wrong-parameters','changed-name','changed-owner','changed-output','changed-distance','missing-flags','feature-metadata','named-sketch','duplicate-name']) {
    let commits=0,release;const port={prepare:async()=>({commit(){commits++;},dispose(){}})};
    const s=create(port);fp=s.example('configurable-finishes');const w=instances.at(-1);w.accept();await fp;const before=stable(s);
    if(mode==='display-refusal')port.prepare=async()=>({commit(){throw new Error('display refused');},dispose(){}});
    if(mode==='cancel-staging'||mode==='worker-failure-staging')port.prepare=()=>new Promise(resolve=>{release=()=>resolve({commit(){commits++;},dispose(){}});});
    fp=s.configureFinishes({frontFinish:true});const doc=configurableFinishes();doc.nodes[2].suppressed=true;
    if(mode==='wrong-flags')doc.nodes[3].suppressed=true;
    if(mode==='wrong-parameters')doc.parameters.frontDistance=2;
    if(mode==='changed-name')doc.nodes[2].name='renamed';
    if(mode==='changed-owner')doc.nodes[3].parent.node=1;
    if(mode==='changed-output')doc.outputs.negative.side='positive';
    if(mode==='changed-distance')doc.nodes[2].distance=2;
    if(mode==='named-sketch'){doc.nodes[0].name='bad';doc.nodes[0].suppressed=true;}
    if(mode==='duplicate-name')doc.nodes[3].name='frontFinish';
    const r=reply(doc,1);if(mode==='missing-flags')delete r.summary.suppression;if(mode==='feature-metadata')r.summary.features[2].suppressed=false;
    w.send(r);await tick();await tick();
    if(mode==='cancel-staging'){assert.equal(typeof release,'function');s.cancel();release();}
    if(mode==='worker-failure-staging'){assert.equal(typeof release,'function');w.callbacks.get('error')();release();}
    await fp;assert.deepEqual(stable(s),before);assert.equal(commits,1);s.dispose();checks++;
  }
  const session = create(); let p = session.example(), worker = instances.at(-1); worker.accept(); await p;
  assert.ok(session.getSnapshot().accepted); assert.ok(Object.is(session.getSnapshot().accepted.parameters.signed, -0)); checks++;
  const noOpBefore = stable(session), requestsBeforeNoOp = worker.requests.length;
  session.stage('height', '8'); await session.apply();
  assert.equal(worker.requests.length, requestsBeforeNoOp); assert.deepEqual(stable(session), noOpBefore); checks++;
  session.stage('signed', '0'); p = session.apply(); assert.ok(Object.is(worker.requests.at(-1).parameters.signed, 0));
  worker.accept(); await p; assert.ok(Object.is(session.getSnapshot().accepted.parameters.signed, 0)); checks++;
  session.stage('signed', '-0'); p = session.apply(); assert.ok(Object.is(worker.requests.at(-1).parameters.signed, -0));
  worker.accept(); await p; assert.ok(Object.is(session.getSnapshot().accepted.parameters.signed, -0)); checks++;
  // Reset history after the dedicated signed-zero checks, retaining the original baseline flow.
  p = session.open(signedJSON(authored)); worker.accept(); await p;
  for (const bad of ['', '0x10', 'Infinity', '10001', '1e-9999']) { session.stage('height', bad); await assert.rejects(session.apply()); } session.discard(); checks++;
  session.stage('height', '6'); p = session.apply(); await assert.rejects(session.apply(), /in progress/);
  worker.send({ ok: false, message: 'old reply' }, worker.requests.at(-1).id - 1); assert.equal(session.getSnapshot().busy, true);
  worker.accept(); await p; assert.equal(session.getSnapshot().accepted.parameters.height, 6); assert.equal(session.getSnapshot().history.count, 2); checks++;
  const generation = session.getSnapshot().generation; session.select(1, generation); assert.throws(() => session.select(1, generation - 1), /stale/);
  p = session.undo(); worker.accept(); await p; assert.equal(session.getSnapshot().accepted.parameters.height, 8);
  p = session.redo(); worker.accept(); await p; assert.equal(session.getSnapshot().accepted.parameters.height, 6); checks++;
  session.stage('height', '7'); const prior = stable(session); p = session.apply(); const late = worker.requests.at(-1); session.cancel(); worker.accept(late); await p;
  assert.deepEqual(stable(session), prior); assert.equal(worker.terminated, true); checks++;
  p = session.apply(); worker = instances.at(-1); assert.equal(worker.requests[0].kind, 'open'); assert.equal(worker.requests[0].revision, prior.accepted.revision);
  assert.equal(worker.requests[0].text, prior.authoredText); assert.equal(worker.requests.length, 1); checks++;
  worker.accept(); await tick(); assert.equal(worker.requests[1].kind, 'apply'); assert.deepEqual(worker.requests[1].parameters, { height: 7 });
  worker.accept(); await p; assert.equal(session.getSnapshot().accepted.parameters.height, 7); checks++;
  session.stage('height', '5'); const accepted = stable(session); p = session.apply(); worker.send({ ok: false, message: 'native refusal' }); await p;
  assert.deepEqual(stable(session), accepted); session.discard(); checks++;
  const previous = session.getSnapshot(); p = session.open(previous.authoredText); worker.accept(); await p;
  assert.equal(session.getSnapshot().accepted.revision, 0); assert.ok(session.getSnapshot().generation > previous.generation);
  assert.throws(() => session.pick(100, 100, 50, 50, previous.generation), /stale/); checks++;
  for (const mutate of [r => r.summary.parameters.height = 77, r => r.summary.outputs[0].solidId = 'wrong', r => r.display.revision++, r => r.summary.features[1].dependencies = [1], r => r.text = '{}']) {
    const s = create(); p = s.example(); const result = reply(); mutate(result); instances.at(-1).send(result); await p;
    assert.equal(s.getSnapshot().accepted, null); assert.ok(s.getSnapshot().error); s.dispose(); checks++;
  }
  for (const mode of ['display-refusal', 'cancel-staging', 'worker-failure-staging', 'wrong-revision', 'wrong-parameters', 'wrong-document', 'changed-literal', 'changed-dependency', 'changed-output']) {
    let commits = 0, disposals = 0, release;
    const port = { prepare: async () => ({ commit() { commits++; }, dispose() { disposals++; } }) };
    const s = create(port); p = s.example(); instances.at(-1).accept(); await p; s.stage('height', '6'); const before = stable(s);
    if (mode === 'display-refusal') port.prepare = async () => ({ commit() { throw new Error('display refused'); }, dispose() { disposals++; } });
    if (mode === 'cancel-staging' || mode === 'worker-failure-staging') port.prepare = () => new Promise(resolve => { release = () => resolve({ commit() { commits++; }, dispose() { disposals++; } }); });
    p = s.apply(); const value = structuredClone(authored); value.parameters.height = mode === 'wrong-parameters' ? 7 : 6; const r = reply(value, mode === 'wrong-revision' ? 9 : 1);
    if (mode === 'wrong-document') { r.summary.documentId = 'other'; r.display.documentId = 'other'; }
    if (mode === 'changed-literal') { value.nodes[0].max[0] = 31; r.text = signedJSON(value); }
    if (mode === 'changed-dependency') { value.nodes[1].sketch = 1; r.text = signedJSON(value); }
    if (mode === 'changed-output') { value.outputs.part.node = 0; r.text = signedJSON(value); }
    instances.at(-1).send(r); await tick(); await tick();
    if (mode === 'cancel-staging') { assert.equal(typeof release, 'function'); s.cancel(); release(); }
    if (mode === 'worker-failure-staging') { assert.equal(typeof release, 'function'); instances.at(-1).callbacks.get('error')(); release(); }
    await p; assert.deepEqual(stable(s), before); assert.equal(commits, 1); assert.equal(s.getSnapshot().busy, false);
    if (mode === 'display-refusal' || mode === 'cancel-staging' || mode === 'worker-failure-staging') assert.ok(disposals >= 2); s.dispose(); checks++;
  }
  // Every additive sample uses the same atomic replacement path, including drafts/history.
  for (const [example, document, kind, outputs, axis] of [['intersection', overlap, 'intersect', ['overlap']], ['horizontal-split', split, 'split', ['lower', 'upper']], ['horizontal-split', cardinal('x'), 'split', ['negative', 'positive'], 'x'], ['horizontal-split', cardinal('y'), 'split', ['negative', 'positive'], 'y'], ['two-chamfer', chamferChain, 'chamfer', ['part']], ['chamfer-split', chamferSplit('x'), 'split', ['negative', 'positive'], 'x'], ['chamfer-split', chamferSplit('z'), 'split', ['negative', 'positive'], 'z'], ['derived-split', derivedSplit(), 'split', ['negative', 'positive']], ['miter-split', miterSplit(), 'split', ['negative', 'positive']], ['configurable-finishes', configurableFinishes(), 'split', ['negative', 'positive']]]) {
    const samples = create(); p = samples.example(); let sampleWorker = instances.at(-1); sampleWorker.accept(); await p;
    samples.stage('height', '6'); p = samples.apply(); sampleWorker.accept(); await p;
    samples.stage('height', '7'); const beforeSample = stable(samples);
    p = samples.example(example, axis); assert.equal(sampleWorker.requests.at(-1).example, example); assert.equal(sampleWorker.requests.at(-1).splitAxis, axis);
    sampleWorker.send({ ok: false, message: `${example} sample refused` }); await p;
    assert.deepEqual(stable(samples), beforeSample); checks++;
    p = samples.example(example, axis); const cancelledSample = sampleWorker.requests.at(-1); samples.cancel(); sampleWorker.accept(cancelledSample); await p;
    assert.deepEqual(stable(samples), beforeSample); checks++;
    p = samples.example(example, axis); sampleWorker = instances.at(-1); sampleWorker.accept(); await p;
    assert.deepEqual(samples.getSnapshot().accepted.outputs.map(output => output.name), outputs);
    assert.equal(samples.getSnapshot().accepted.features.at(-1).kind, kind);
    assert.equal(samples.getSnapshot().history.count, 1); assert.deepEqual(samples.getSnapshot().drafts, {}); checks++;
    const editName = example === 'miter-split' ? 'cutPosition' : (example === 'two-chamfer' || example === 'chamfer-split' || example === 'derived-split' || example === 'configurable-finishes') ? 'backDistance' : 'height';
    const editValue = example === 'miter-split' ? 32 : (example === 'two-chamfer' || example === 'chamfer-split' || example === 'derived-split' || example === 'configurable-finishes') ? 3 : 2;
    samples.stage(editName, String(editValue)); const beforeOutputChange = stable(samples); p = samples.apply();
    const changed = structuredClone(document); changed.parameters[editName] = editValue;
    if (axis || example === 'derived-split' || example === 'miter-split' || example === 'configurable-finishes') changed.outputs.negative.side = 'positive';
    else if (example === 'horizontal-split') changed.outputs.lower.side = 'positive';
    else if (example === 'two-chamfer') changed.outputs.part.node = 2;
    else changed.outputs.overlap.node = 1;
    sampleWorker.send(reply(changed, 1)); await p; assert.deepEqual(stable(samples), beforeOutputChange); checks++;
    if (axis) {
      // A rejected forged result terminates that worker; use a fresh accepted session for the independent axis guard.
      const axisSession = create(); p = axisSession.example(example, axis); const axisWorker = instances.at(-1); axisWorker.accept(); await p;
      axisSession.stage(editName, String(editValue)); const beforeAxisChange = stable(axisSession); p = axisSession.apply();
      const forged = structuredClone(document); forged.parameters[editName] = editValue; forged.nodes.at(-1).axis = axis === 'x' ? 'y' : 'x';
      axisWorker.send(reply(forged, 1)); await p; assert.deepEqual(stable(axisSession), beforeAxisChange); axisSession.dispose(); checks++;
    }
    samples.dispose();
  }
  const invalid = create(); const beforeInvalid = stable(invalid), beforeWorkers = instances.length;
  for (const [example, axis] of [['miter-split', 'x'], ['miter-split', 'y'], ['miter-split', 'z'], ['miter-split', null], ['miter-split', {}], ['derived-split', 'x'], ['derived-split', 'z'], ['derived-split', null], ['chamfer-split', 'y'], ['chamfer-split', 'q'], ['chamfer-split', null], ['chamfer-split', 1], ['chamfer-split', {}], ['horizontal-split', 'q'], ['horizontal-split', null], ['horizontal-split', 1], ['horizontal-split', {}], ['intersection', 'x'], ['cut-chamfer', 'z'], ['two-chamfer', 'x'], [undefined, 'y'], ['unknown', undefined]]) {
    await assert.rejects(invalid.example(example, axis), /Choose/);
    assert.equal(instances.length, beforeWorkers); assert.deepEqual(stable(invalid), beforeInvalid); checks++;
  }
  invalid.dispose();
  // The codec owns supported kinds. The transport validates their shape without a whitelist.
  for (const kind of ['intersect', 'split', 'future-native-operation']) {
    const data = structuredClone(authored); data.nodes[1].kind = kind;
    const s = create(); p = s.open(signedJSON(data)); instances.at(-1).send(reply(data)); await p;
    assert.equal(s.getSnapshot().accepted.features[1].kind, kind); s.dispose(); checks++;
  }
  for (const kind of ['', '   ', 'x'.repeat(65), 12, null, [], {}]) {
    const data = structuredClone(authored); data.nodes[1].kind = kind;
    const s = create(); p = s.open(signedJSON(data)); instances.at(-1).send(reply(data)); await p;
    assert.equal(s.getSnapshot().accepted, null); assert.match(s.getSnapshot().error, /feature dependencies/); s.dispose(); checks++;
  }
  // Both distances remain ordinary independent draft dimensions on the same chain.
  for (const axis of ['x', 'z']) {
    const railSession = create(); p = railSession.example('chamfer-split', axis); const w = instances.at(-1); w.accept(); await p;
    railSession.stage('splitAt', axis === 'x' ? '8' : '3'); p = railSession.apply(); w.accept(); await p;
    const saved = railSession.getSnapshot().authoredText;
    for (const [name, value] of [['frontDistance', 2], ['backDistance', 3]]) {
      railSession.stage(name, String(value)); p = railSession.apply(); assert.deepEqual(w.requests.at(-1).parameters, { [name]: value });
      w.accept(); await p; assert.equal(railSession.getSnapshot().accepted.parameters[name], value);
      p = railSession.undo(); w.accept(); await p; assert.equal(railSession.getSnapshot().authoredText, saved); checks++;
    }
    railSession.stage('frontDistance', '2'); railSession.stage('backDistance', '3'); p = railSession.apply();
    assert.deepEqual(w.requests.at(-1).parameters, { frontDistance: 2, backDistance: 3 }); w.accept(); await p;
    p = railSession.undo(); w.accept(); await p; assert.equal(railSession.getSnapshot().authoredText, saved);
    p = railSession.redo(); w.accept(); await p; assert.equal(railSession.getSnapshot().accepted.parameters.backDistance, 3); checks++;
    railSession.dispose();
    for (const mutate of [d => d.nodes[4].parent.node = 1, d => d.nodes[4].axis = 'y', d => d.nodes[3].parent.node = 1,
      d => d.nodes[3].edge.at.y = 0, d => d.outputs.negative.node = 3, d => d.outputs.positive.side = 'negative']) {
      const guarded = create(); p = guarded.example('chamfer-split', axis); const worker = instances.at(-1); worker.accept(); await p;
      guarded.stage('backDistance', '3'); const before = stable(guarded); p = guarded.apply();
      const changed = chamferSplit(axis); changed.parameters.backDistance = 3; mutate(changed); worker.send(reply(changed, 1)); await p;
      assert.ok(guarded.getSnapshot().error); assert.deepEqual(stable(guarded), before); guarded.dispose(); checks++;
    }
  }
  const miterSession = create(); p = miterSession.example('miter-split'); const miterWorker = instances.at(-1); miterWorker.accept(); await p;
  miterSession.stage('cutPosition', '32'); p = miterSession.apply(); assert.deepEqual(miterWorker.requests.at(-1).parameters, { cutPosition: 32 }); miterWorker.accept(); await p;
  const miterSaved = miterSession.getSnapshot().authoredText;
  miterSession.stage('cutPosition', '60'); const beforeMiterRefusal = stable(miterSession); p = miterSession.apply(); miterWorker.send({ ok: false, message: 'CAD model split: positive side outside, section dimension -1' }); await p;
  assert.deepEqual(stable(miterSession), beforeMiterRefusal); checks++;
  miterSession.stage('cutPosition', '28'); p = miterSession.apply(); miterWorker.accept(); await p;
  assert.equal(miterSession.getSnapshot().accepted.parameters.cutPosition, 28); checks++;
  p = miterSession.undo(); miterWorker.accept(); await p; assert.equal(miterSession.getSnapshot().authoredText, miterSaved);
  p = miterSession.redo(); miterWorker.accept(); await p; assert.equal(miterSession.getSnapshot().accepted.parameters.cutPosition, 28); checks++;
  assert.throws(() => miterSession.stage('splitAt', '16'), /named dimension/); miterSession.dispose(); checks++;
  for (const mutate of [d => d.nodes[2].plane = 'x-y', d => d.nodes[2].axis = 'x',
    d => { delete d.nodes[2].plane; d.nodes[2].axis = 'x'; }, d => d.nodes[2].at = 32, d => d.outputs.negative.side = 'positive']) {
    const guarded = create(); p = guarded.example('miter-split'); const worker = instances.at(-1); worker.accept(); await p;
    guarded.stage('cutPosition', '32'); const before = stable(guarded); p = guarded.apply();
    const changed = miterSplit(); changed.parameters.cutPosition = 32; mutate(changed); worker.send(reply(changed, 1)); await p;
    assert.ok(guarded.getSnapshot().error); assert.deepEqual(stable(guarded), before); guarded.dispose(); checks++;
  }
  const derivedSession = create(); p = derivedSession.example('derived-split'); const derivedWorker = instances.at(-1); derivedWorker.accept(); await p;
  const initialFormula = JSON.parse(derivedSession.getSnapshot().authoredText).nodes[4].at;
  for (const [name, value] of [['offset', 4], ['width', 40], ['frontDistance', 2], ['backDistance', 3]]) {
    derivedSession.stage(name, String(value)); p = derivedSession.apply(); assert.deepEqual(derivedWorker.requests.at(-1).parameters, { [name]: value });
    derivedWorker.accept(); await p; assert.equal(derivedSession.getSnapshot().accepted.parameters[name], value);
    assert.deepEqual(JSON.parse(derivedSession.getSnapshot().authoredText).nodes[4].at, initialFormula); checks++;
  }
  derivedSession.stage('offset', '-0'); p = derivedSession.apply(); derivedWorker.accept(); await p;
  assert.ok(Object.is(derivedSession.getSnapshot().accepted.parameters.offset, -0));
  const derivedSaved = derivedSession.getSnapshot().authoredText;
  p = derivedSession.undo(); derivedWorker.accept(); await p; assert.equal(derivedSession.getSnapshot().accepted.parameters.offset, 4);
  p = derivedSession.redo(); derivedWorker.accept(); await p; assert.equal(derivedSession.getSnapshot().authoredText, derivedSaved); checks++;
  assert.throws(() => derivedSession.stage('splitAt', '16'), /named dimension/); derivedSession.dispose(); checks++;
  for (const mutate of [d => d.nodes[4].at.op = 'scale', d => d.nodes[4].at.left.factor = 0.25,
    d => d.nodes[4].at.left.value.parameter = 'offset', d => d.nodes[4].at.right = 4,
    d => d.nodes[4].at.extra = 0, d => d.outputs.positive.side = 'negative']) {
    const guarded = create(); p = guarded.example('derived-split'); const worker = instances.at(-1); worker.accept(); await p;
    guarded.stage('width', '40'); const before = stable(guarded); p = guarded.apply();
    const changed = derivedSplit(); changed.parameters.width = 40; mutate(changed); worker.send(reply(changed, 1)); await p;
    assert.ok(guarded.getSnapshot().error); assert.deepEqual(stable(guarded), before); guarded.dispose(); checks++;
  }
  const chainSession = create(); p = chainSession.example('two-chamfer'); const chainWorker = instances.at(-1); chainWorker.accept(); await p;
  chainSession.stage('backDistance', '3'); p = chainSession.apply(); chainWorker.accept(); await p;
  assert.deepEqual(chainSession.getSnapshot().accepted.parameters, { frontDistance: 1, backDistance: 3, backY: 24 }); checks++;
  p = chainSession.undo(); chainWorker.accept(); await p; assert.equal(chainSession.getSnapshot().accepted.parameters.backDistance, 2);
  chainSession.stage('frontDistance', '2'); chainSession.stage('backDistance', '3'); p = chainSession.apply();
  assert.deepEqual(chainWorker.requests.at(-1).parameters, { frontDistance: 2, backDistance: 3 }); chainWorker.accept(); await p;
  assert.equal(chainSession.getSnapshot().history.count, 2); checks++;
  p = chainSession.undo(); chainWorker.accept(); await p; assert.equal(chainSession.getSnapshot().accepted.parameters.frontDistance, 1);
  p = chainSession.redo(); chainWorker.accept(); await p; assert.equal(chainSession.getSnapshot().accepted.parameters.frontDistance, 2); checks++;
  chainSession.stage('backY', '0'); const beforeChainRefusal = stable(chainSession); p = chainSession.apply(); chainWorker.send({ ok: false, message: 'CAD model chamfer: Expected exactly one edge; matched 0' }); await p;
  assert.deepEqual(stable(chainSession), beforeChainRefusal); chainSession.dispose(); checks++;
  for (const mutate of [d => d.nodes[3].parent.node = 1, d => d.nodes[3].edge.at.y = 0]) {
    const guarded = create(); p = guarded.example('two-chamfer'); const w = instances.at(-1); w.accept(); await p;
    guarded.stage('backDistance', '3'); const before = stable(guarded); p = guarded.apply();
    const forged = structuredClone(chamferChain); forged.parameters.backDistance = 3; mutate(forged); w.send(reply(forged, 1)); await p;
    assert.deepEqual(stable(guarded), before); guarded.dispose(); checks++;
  }
  const changes = [p => p.components[0].lineage.name = 'wrong', p => p.components[0].lineage.solidId = 'wrong',
    p => p.components[0].lineage.graph.faces[0].faceId = 'wrong', p => p.components[0].lineage.graph.edges[0].uses[0].use.curveId = 'wrong',
    p => p.components[0].lineage.graph.vertices[0].pointMM[0] += 1, p => p.components[0].boundaries[0].solidEdgeId = 'wrong',
    p => p.components[0].lineage.graph.faces[0].vertexIds[0] = 'wrong', p => p.outcomes[0].role = 'wrong', p => p.components.push(structuredClone(p.components[0])),
    p => p.components[0].lineage.graph.vertices[0].pointMM = [], p => p.components[0].lineage.graph.edges[0].uses[0].use.interval = [],
    p => p.components[0].lineage.graph.edges[0].uses[0].use.vertexIds = [], p => p.components[0].lineage.graph.edges[0].vertexIds = [],
    p => p.components[0].lineage.graph.edges[0].uses.pop(), p => p.components[0].lineage.graph.vertices[0].members.pop(),
    p => p.components[0].lineage.graph.vertices[1].id = p.components[0].lineage.graph.vertices[0].id,
    p => p.components[0].lineage.graph.vertexLinks = []];
  for (const change of changes) { const packet = reply().display; change(packet); assert.throws(() => prepare(packet, 'result')); checks++; }
  const aliases = structuredClone(authored); aliases.outputs.sameBody = { ...aliases.outputs.part };
  const scene = prepare(reply(aliases).display, 'result');
  assert.equal(scene.scene.geometries.length, 2); assert.notEqual(scene.scene.nodes[0].id, scene.scene.nodes[1].id);
  assert.equal(scene.packet.components[0].report.solidId, scene.packet.components[1].report.solidId); checks++;
  let hit = null; for (let y = 4; y < 160 && !hit; y += 8) for (let x = 4; x < 160 && !hit; x += 8) hit = pick(scene, 160, 160, x, y);
  assert.ok(hit && ['part', 'sameBody'].includes(hit.role)); assert.equal(hit.solidId, nativeId); checks++;
  if (process.env.SERIAL_REPLIES) {
    const real = JSON.parse(readFileSync(process.env.SERIAL_REPLIES, 'utf8'))[0];
    const wrap = input => {
      const r = structuredClone(input), d = r.summary.document;
      return { id: r.id, ok: true, text: r.text, display: r.display, compatibility: r.summary,
        summary: { documentId: d.id, revision: d.revision, source: 'legacy', parameters: Object.fromEntries(d.parameters.map(p => [p.id, p.valueMM])),
          features: d.nodes.map((n, index) => ({ kind: n.kind, index, dependencies: (r.summary.dependencies.find(dep => dep.nodeId === n.id)?.dependsOn ?? []).map(id => d.nodes.findIndex(node => node.id === id)) })),
          outputs: r.summary.components.filter(c => c.status === 'solid').map(c => ({ name: c.role, solidId: c.solidId, volumeMM3: c.role === 'second' ? r.summary.serial.volumes.negative : r.summary.volumes[c.role] })) } };
    };
    const s = create(); p = s.open(real.text); instances.at(-1).send(wrap(real)); await p; assert.ok(s.getSnapshot().accepted); s.dispose(); legacyChecks++;
    for (const mutate of [r => { r.compatibility.document.nodes[5].kind = 'hole'; r.summary.features[5].kind = 'hole'; },
      r => { r.compatibility.document.nodes[5].kind = 'union'; r.summary.features[5].kind = 'union'; },
      r => { r.compatibility.document.nodes[5].kind = 'difference'; r.summary.features[5].kind = 'difference'; },
      r => r.compatibility.document.nodes[5].reference.a.faceId = 'forged',
      r => r.compatibility.document.nodes[5].options.retainedSolidId = 'forged', r => r.compatibility.selectedWalls[0].segmentId = 'forged',
      r => r.compatibility.serial.resolution.originalPrismNodeId = 'forged']) {
      const r = wrap(real); mutate(r); r.text = signedJSON(r.compatibility.document);
      const s = create(); p = s.open(r.text); instances.at(-1).send(r); await p; assert.equal(s.getSnapshot().accepted, null); assert.ok(s.getSnapshot().error); s.dispose(); legacyChecks++;
    }
  }
  session.stage('height', '8'); p = session.apply(); [...timers][0].callback(); await p; assert.match(session.getSnapshot().error, /timed out/); checks++;
  session.dispose(); assert.equal(timers.size, 0);
} finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
// The new ID crosses the real controller request gate; dedicated top-pocket tests
// exercise accepted geometry, while this routing control deliberately cancels.
const topPocketRouting = create();
const topPocketPending = topPocketRouting.example('top-entry-pocket');
const topPocketWorker = instances.at(-1);
assert.equal(topPocketWorker.requests.at(-1).example, 'top-entry-pocket');
topPocketRouting.cancel(); await topPocketPending; checks++;
const topPocketRequests = topPocketWorker.requests.length;
await assert.rejects(topPocketRouting.example('top-entry-pocket-unknown'), /example/);
assert.equal(topPocketWorker.requests.length, topPocketRequests); topPocketRouting.dispose(); checks++;
const result = { ok: true, checks, legacyChecks, evidence: 'CPU controller, saved mesh and synthesized graph-shaped DTO; optional saved real legacy replies; no native geometry, browser, GPU or OS files' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
