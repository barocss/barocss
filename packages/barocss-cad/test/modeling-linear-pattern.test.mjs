import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls for #1973. Every construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Deliberately inert bodies/reports below prove no geometry or native lineage.
// Use CAD_MODEL_LINEAR_PATTERN_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index has erased the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_LINEAR_PATTERN_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-linear-pattern.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'],
  ['xy-affine-sketch', 'buildXYAffineSketch'], ['xy-affine-sketch-prism', 'buildXYAffineSketchPrism'],
  ['convex-planar-slab-subtraction', 'subtractConvexPlanarSlab'], ['convex-planar-solid-intersection', 'intersectConvexPlanarSolids'],
  ['convex-planar-solid-split', 'splitConvexPlanarSolid'], ['model-compiler', 'compileCadModel'],
  ['convex-planar-solid-chamfer', 'chamferConvexPlanarSolid'], ['axis-box-boolean', 'buildAxisBoxSolidBoolean'],
  ['orthogonal-solid-boolean', 'buildOrthogonalSolidBoolean'], ['modeling-box-internal', 'buildModelingBox'],
  ['modeling-translation-internal', 'buildModelingTranslation'], ['modeling-rotation-internal', 'buildModelingRotation'], ['modeling-mirror-internal', 'buildModelingMirror'], ['modeling-scale-internal', 'buildModelingScale'], ['modeling-linear-pattern-internal', 'buildModelingLinearPattern'], ['modeling-circular-pattern-internal', 'buildModelingCircularPattern'], ['modeling-stl-internal', 'buildModelingStl'],
  ['own-plate-circular-hole', 'buildOwnPlateCircularHole'], ['stored-plate-hole-solid', 'qualifyStoredPlateHoleSolid'],
  ['convex-planar-solid-mass', 'measureConvexPlanarSolidMass'], ['axis-box-solid-mass', 'measureAxisBoxSolidBooleanMass'],
]);
const pureModules = new Set(['modeling', 'cad-document', 'data-copy', 'xy-affine-prism-feature-document-internal',
  'modeling-regeneration-internal', 'modeling-dimension-internal']);
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], patternError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_LINEAR_PATTERN_CONTROL_NOT_GEOMETRY';
// Selector-routing data only. These four vertices/two edges are deliberately
// not a closed Solid and never establish native finishing/copy correctness.
function inertFinishedSolid(solidId) {
  const vertices = [[0, 0, 8], [32, 0, 8], [0, 24, 8], [32, 24, 8]].map((pointMM, i) => ({ id: 'v' + i, pointMM }));
  const edges = [[0, 1], [2, 3]].map((pair, i) => ({ id: 'e' + i, vertexIds: pair.map(j => 'v' + j),
    uses: [0, 1].map(j => ({ sourceId: solidId + '_src' + j, faceId: 'face' + j, surfaceId: 'surface' + j,
      loopId: 'loop' + j, use: { id: 'use' + i + j, curveId: 'curve' + i + j, pcurveId: 'uv' + i + j } })) }));
  return { controlOnly: marker, request: { options: { solidId } }, graph: { vertices, edges } };
}
function dispatch(binding, args) {
  if (state.phase !== 'mock-native') {
    state.unexpected.push(binding); throw new Error('UNEXPECTED_PROVIDER_ATTEMPT: ' + binding);
  }
  const call = { binding, args }; state.calls.push(call);
  if (binding === 'buildXYAffineSketch') return call.result = { controlOnly: marker, document: clone(args[0]),
    solution: { points: clone(args[0].points) }, report: { controlOnly: marker, fullyConstrained: true, degreesOfFreedom: 0 } };
  if (binding === 'buildXYAffineSketchPrism') return call.result = { controlOnly: marker,
    request: { sketch: clone(args[0]), options: clone(args[1]) },
    solid: state.finished ? inertFinishedSolid(args[1].solidId)
      : { controlOnly: marker, sourceId: args[1].sourceId, solidId: args[1].solidId, authoredOptions: clone(args[1]) },
    report: { controlOnly: marker }, lineage: { controlOnly: marker } };
  if (binding === 'chamferConvexPlanarSolid' && state.finished) {
    if (state.chamferError) throw state.chamferError;
    return call.result = { controlOnly: marker, request: { parent: args[0] },
      split: { negative: { kind: 'solid', solid: inertFinishedSolid(args[3].retainedSolidId) } } };
  }
  if (binding === 'buildModelingLinearPattern') {
    if (state.patternError !== undefined) throw state.patternError;
    const copies = [1, 2].map(instance => ({ controlOnly: marker,
      request: { parent: clone(args[0]), offsetMM: args[1].map(value => value * instance), prefix: args[2] + '_i' + instance },
      solid: { controlOnly: marker, solidId: args[2] + '_i' + instance + '_inert_solid', source: clone(args[0]),
        offsetMM: args[1].map(value => value * instance) },
      report: { controlOnly: marker, instance, nested: { sentinel: 'complete-inert-child-report' } },
      lineage: { controlOnly: marker, sentinel: ['not-a-geometric-correspondence'] } }));
    return call.result = { controlOnly: marker, request: { parent: clone(args[0]), stepMM: clone(args[1]), prefix: args[2] }, copies,
      report: { controlOnly: marker, childReports: copies.map(copy => copy.report), nested: { sentinel: 'complete-inert-pattern-report' } } };
  }
  // Legacy route stubs establish facade/file compatibility only.
  if (['buildModelingTranslation', 'buildModelingRotation', 'buildModelingMirror', 'buildModelingScale'].includes(binding))
    return call.result = { controlOnly: marker, solid: { controlOnly: marker, solidId: args[2] + '_legacy_inert_solid' },
      report: { controlOnly: marker }, lineage: { controlOnly: marker } };
  if (binding === 'buildXYArc') return call.result = { controlOnly: marker, curve: { id: args[0].id }, report: { centerMM: args[0].center, radiusMM: args[0].radius } };
  if (binding === 'buildXYCirclePrismShell' || binding === 'qualifyStoredCirclePrismSolid') return call.result = { controlOnly: marker };
  state.unexpected.push(binding); throw new Error('UNUSED_MOCK_PROVIDER: ' + binding);
}
globalThis[trapKey] = { dispatch };
const virtualEntry = `export * from ${JSON.stringify(entry)};
export { modelingGraphKey, modelingNodeParameters, modelingReusablePrefix } from './modeling-regeneration-internal.js';
export { signedJson } from './xy-affine-prism-feature-document-internal.js';`;
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'linear-pattern-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-linear-pattern-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'linear-pattern-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'linear-pattern-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-linear-pattern.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('linear-pattern-trap:') && !path.endsWith('linear-pattern-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-linear-pattern-admission-' + mode);
  mkdirSync(dirname(directory), { recursive: true }); mkdirSync(directory);
  const save = (name, bytes) => { writeFileSync(resolve(directory, name), bytes, { flag: 'wx' }); return { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; };
  provenance = { directory, entry, mode, testSHA256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    virtualEntry: save('entry.mjs', virtualEntry), bundle: save('bundle.mjs', bundle.outputFiles[0].text),
    metafile: save('bundle.metafile.json', JSON.stringify(bundle.metafile, null, 2) + '\n'),
    inputs: save('input-hashes.json', JSON.stringify(Object.fromEntries(inputPaths.map(path => [path, sha256(readFileSync(resolve(path)))])), null, 2) + '\n'),
    replacedProviderBindings: [...providers.values()].sort() };
}
after(() => {
  const counts = Object.fromEntries([...new Set(state.calls.map(call => call.binding))].sort().map(binding => [binding, state.calls.filter(call => call.binding === binding).length]));
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 1973,
    scope: 'Actual modeling facade and unchanged pure helpers; isolated inert providers; admission and routing only, no geometric acceptance',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertProviderCalls: counts,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function mockNative(action, error) {
  assert.equal(state.phase, 'closed'); state.phase = 'mock-native'; state.patternError = error;
  try { return action(); } finally { state.phase = 'closed'; state.patternError = undefined; }
}
function mockFinishing(action, chamferError) {
  assert.equal(state.finished, undefined); state.finished = true; state.chamferError = chamferError;
  try { return mockNative(action); } finally { delete state.finished; delete state.chamferError; }
}
function refuses(action, code, operation, noProvider = true) {
  const before = state.calls.length; let caught;
  assert.throws(action, error => {
    caught = error; assert.ok(error instanceof CadModelError, String(error));
    if (code) assert.ok((Array.isArray(code) ? code : [code]).includes(error.code), `Expected ${code}, received ${error.code}: ${error.message}`);
    else assert.notEqual(error.code, 'NATIVE');
    if (operation) assert.equal(error.operation, operation); return true;
  });
  if (noProvider) assert.equal(state.calls.length, before, 'Admission refusal must precede every provider');
  assert.deepEqual(state.unexpected, []); return caught;
}
function frozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value); assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child, seen);
}
function retained(snapshot) {
  return { save: snapshot.save(), json: JSON.stringify(snapshot), identities: Object.fromEntries(
    ['bodies', 'parameters', 'suppression', 'features', 'evidence', 'recomputation'].map(key => [key, snapshot[key]])) };
}
function unchanged(snapshot, before) {
  assert.equal(snapshot.save(), before.save); assert.equal(JSON.stringify(snapshot), before.json);
  for (const [key, value] of Object.entries(before.identities)) assert.equal(snapshot[key], value);
  frozen(snapshot);
}
const rectangle = model => model.sketch.rectangle({ width: 32, height: 24 });
function fixedPolygon(builder) {
  return [[0, 0], [32, 0], [32, 24], [0, 24]].map(value => { const point = builder.point(value); builder.fixed(point); return point; });
}


const options = (axis='x',spacing=40) => ({axis,spacing,count:3});
const part = () => {const model=createCadModel();return {model,original:rectangle(model).extrude(8)};};
function patterned({axis='x',expressions=false,placed=false}={}) {
  const model=createCadModel(),width=model.parameter('width',32),spacing=model.parameter('spacing',40);
  const sketch=model.sketch.rectangle({width,height:24}),original=placed?sketch.extrude(8,{from:3}):sketch.extrude(8);
  const step=expressions?model.dimension.add(model.dimension.scale(spacing,1),0):spacing;
  const tuple=original.linearPattern(options(axis,step));
  const snapshot=mockNative(()=>model.build({original:tuple[0],instance1:tuple[1],instance2:tuple[2]}));
  return {model,sketch,original,spacing,tuple,snapshot};
}
function authoredDocument(axis='x',spacing=40) {
  return {format:'barocss-cad-model',schema:1,units:'mm',parameters:{},nodes:[
    {kind:'sketch',profile:'rectangle',min:[0,0],max:[32,24]}, {kind:'extrude',sketch:0,height:8},
    {kind:'linear-pattern',parent:{node:1,side:'solid'},axis,spacing,count:3}],
    outputs:{original:{node:1,side:'solid'},instance1:{node:2,side:'instance1'},instance2:{node:2,side:'instance2'}}};
}
function checkDocument(edit) {const doc=authoredDocument();edit(doc);return refuses(()=>loadCadModel(signedJson(doc)));}

// These tests execute the real facade with inert native bindings. They make no
// geometry, lineage, native preflight, or kernel qualification claim.
test('all twenty-four provider bindings are isolated and one terminal node returns the exact original handle plus two copies',()=>{
  const begin=state.calls.length,{original,tuple,snapshot}=patterned(),calls=state.calls.slice(begin),native=calls.at(-1).result;
  assert.equal(replaced.size,24);assert.equal(inputPaths.length,pureModules.size);
  assert.deepEqual(calls.map(call=>call.binding),['buildXYAffineSketch','buildXYAffineSketchPrism','buildModelingLinearPattern']);
  assert.ok(Object.isFrozen(tuple));assert.equal(tuple.length,3);assert.equal(tuple[0],original);assert.notEqual(tuple[1],original);assert.notEqual(tuple[2],original);assert.notEqual(tuple[1],tuple[2]);
  assert.equal(calls.at(-1).args[0],snapshot.bodies.original.native);assert.deepEqual(calls.at(-1).args[1],[40,0,0]);assert.equal(calls.at(-1).args[2],'m2');
  assert.equal(snapshot.bodies.instance1.native,native.copies[0].solid);assert.equal(snapshot.bodies.instance2.native,native.copies[1].solid);
  assert.equal(snapshot.evidence[2].native,native);assert.equal(native.report.childReports[0].nested.sentinel,'complete-inert-child-report');
  assert.equal(native.report.nested.sentinel,'complete-inert-pattern-report');assert.equal(snapshot.evidence[2].kind,'linear-pattern');
  assert.deepEqual(snapshot.features,[{kind:'sketch',index:0,dependencies:[]},{kind:'extrude',index:1,dependencies:[0]},{kind:'linear-pattern',index:2,dependencies:[1]}]);
  assert.deepEqual(snapshot.recomputation,{reusedFeatures:[],evaluatedFeatures:[0,1,2]});assert.equal(CadModelLimits.nodes,6);frozen(snapshot);
});
test('each cardinal axis routes one positive step and selects independent copy results from the same parent',()=>{
  for(const [axis,index]of [['x',0],['y',1],['z',2]]){
    const {snapshot}=patterned({axis}),native=snapshot.evidence[2].native,step=[0,0,0];step[index]=40;
    assert.deepEqual(native.request.stepMM,step);assert.deepEqual(native.copies.map(copy=>copy.request.offsetMM),[step,step.map(v=>v*2)]);
    for(const copy of native.copies)assert.deepEqual(copy.request.parent,snapshot.bodies.original.native);
    assert.deepEqual(Object.keys(snapshot.bodies).sort(),['instance1','instance2','original']);
    for(const body of Object.values(snapshot.bodies))assert.equal(body.family,'convex-planar');
    const saved=JSON.parse(snapshot.save());assert.deepEqual(saved.nodes[2],{kind:'linear-pattern',parent:{node:1,side:'solid'},axis,spacing:{parameter:'spacing'},count:3});
    assert.deepEqual(saved.outputs,{original:{node:1,side:'solid'},instance1:{node:2,side:'instance1'},instance2:{node:2,side:'instance2'}});
    const cold=mockNative(()=>loadCadModel(snapshot.save()));assert.equal(cold.save(),snapshot.save());assert.deepEqual(cold.bodies,snapshot.bodies);assert.deepEqual(cold.evidence,snapshot.evidence);
    assert.deepEqual(Object.keys(cold.bodies).sort(),['instance1','instance2','original']);
  }
});
test('exact one-record options refuse malformed keys, accessors and extra arguments without consuming a node',()=>{
  const {model,original}=part();let reads=0;
  const getter=options();Object.defineProperty(getter,'spacing',{enumerable:true,get(){reads++;return 40;}});
  const hidden=options();Object.defineProperty(hidden,'hidden',{value:1});const hiddenRequired=options();Object.defineProperty(hiddenRequired,'count',{enumerable:false});
  const symbol=options();symbol[Symbol('extra')]=1;const revoked=Proxy.revocable(options(),{});revoked.revoke();
  const args=[[],[undefined],[null],[[]],[options(),undefined],[options(),true],[{}],[getter],[hidden],[hiddenRequired],[symbol],[revoked.proxy],[Object.create(options())],
    [{axis:'x',spacing:40}],[{axis:'x',count:3}],[{spacing:40,count:3}],[{...options(),offset:40}],[{...options(),pivot:[0,0,0]}],[{...options(),normal:[1,0,0]}]];
  for(const value of args)refuses(()=>original.linearPattern(...value),'INPUT','linearPattern');assert.equal(reads,0);
  const tuple=original.linearPattern(options());const snapshot=mockNative(()=>model.build({original:tuple[0],instance1:tuple[1],instance2:tuple[2]}));
  assert.equal(snapshot.features.length,3);assert.equal(snapshot.features[2].kind,'linear-pattern');
});
test('only count three and cardinal axes are admitted; positive exactly doubled spacing stays in the existing bound',()=>{
  const {original}=part();
  for(const count of [0,1,5,6,-3,3.1,'3',undefined,NaN,Infinity,{parameter:'count'}])refuses(()=>original.linearPattern({...options(),count}),'CAPABILITY','linearPattern');
  for(const axis of ['', 'w','X','xy',[1,0,0],0,null])refuses(()=>original.linearPattern({...options(),axis}),'CAPABILITY','linearPattern');
  for(const spacing of [0,-0,-1,-Number.MIN_VALUE,5000.000000000001,10000])refuses(()=>original.linearPattern(options('x',spacing)),'PARAMETER','linearPattern');
  for(const spacing of [Infinity,NaN,10001])refuses(()=>original.linearPattern(options('x',spacing)),'PARAMETER','dimension');
  for(const spacing of ['40',{parameter:'spacing'},[40]])refuses(()=>original.linearPattern(options('x',spacing)),'OWNERSHIP');
  assert.ok(original.linearPattern(options('x',5000)));
  const tiny=part().original;assert.ok(tiny.linearPattern(options('y',Number.MIN_VALUE)),'facade spacing admission only; actual geometry can still refuse');
});
test('one descriptor snapshot stores actual option values without invoking Proxy get traps',()=>{
  for(const replacement of ['throw',1]){
    const {model,original}=part();let reads=0;
    const proxy=new Proxy(options('y',32),{get(){reads++;if(replacement==='throw')throw Error('hostile-get');return replacement;}});
    const tuple=original.linearPattern(proxy),snapshot=mockNative(()=>model.build({original:tuple[0],instance1:tuple[1],instance2:tuple[2]}));
    assert.equal(reads,0);assert.deepEqual(JSON.parse(snapshot.save()).nodes[2],{kind:'linear-pattern',parent:{node:1,side:'solid'},axis:'y',spacing:32,count:3});
  }
  const {original}=part();let reads=0;const invalid=new Proxy({...options(),count:5},{get(){reads++;return 3;}});refuses(()=>original.linearPattern(invalid),'CAPABILITY');assert.equal(reads,0);assert.ok(original.linearPattern(options()));
});
test('the exact receiver and same-model literal, parameter or expression spacing are required',()=>{
  const {model,original}=part(),method=original.linearPattern,other=part();
  for(const receiver of [null,{}, {...original},other.original])refuses(()=>method.call(receiver,options()),'OWNERSHIP','linearPattern');
  refuses(()=>method(options()),'OWNERSHIP','linearPattern');
  const foreign=other.model.parameter('spacing',40);refuses(()=>original.linearPattern(options('x',foreign)),'OWNERSHIP');
  const spacing=model.parameter('spacing',40);refuses(()=>original.linearPattern(options('x',{...spacing})),'OWNERSHIP');
  assert.ok(original.linearPattern(Object.assign(Object.create(null),options('x',model.dimension.add(model.dimension.scale(spacing,1),0)))));
});
test('same-model callback mutation fence runs before receiver and options reflection',()=>{
  const {model,original}=part();let reflections=0;const proxy=new Proxy(options(),{ownKeys(){reflections++;throw Error('must-not-reflect');}});
  model.sketch.constrainedPolygon(builder=>{
    refuses(()=>original.linearPattern(proxy),'OWNERSHIP','linearPattern');refuses(()=>original.linearPattern.call({},proxy),'OWNERSHIP','linearPattern');assert.equal(reflections,0);return fixedPolygon(builder);
  });assert.ok(original.linearPattern(options()));
  const other=part();let tuple;createCadModel().sketch.constrainedPolygon(builder=>{tuple=other.original.linearPattern(options());return fixedPolygon(builder);});assert.equal(tuple[0],other.original);
});
test('pattern and copies are terminal for selection, transforms and later appended features',()=>{
  const {model,original}=part(),edge=original.edges({parallelTo:'x',at:{y:0,z:'max'}}).one();
  const tuple=original.linearPattern(options());
  for(const shape of tuple){
    refuses(()=>shape.linearPattern(options()),'CAPABILITY');refuses(()=>shape.translate([1,0,0]),'CAPABILITY');
    refuses(()=>shape.rotate({axis:'x',angleDegrees:90}),'CAPABILITY');refuses(()=>shape.mirror({plane:'xz'}),'CAPABILITY');refuses(()=>shape.scale({factor:2}),'CAPABILITY');
    refuses(()=>shape.split({axis:'z',at:4}),'CAPABILITY');refuses(()=>shape.hole({center:[8,8],radius:2}),'CAPABILITY');refuses(()=>shape.chamfer(edge,1),'CAPABILITY');
  }
  for(const copy of tuple.slice(1))refuses(()=>copy.edges({parallelTo:'x'}),'CAPABILITY','selection');
  refuses(()=>model.sketch.rectangle({width:2,height:2}),'CAPABILITY');refuses(()=>model.sketch.polygon([[0,0],[2,0],[0,2]]),'CAPABILITY');
  const snapshot=mockNative(()=>model.build({original:tuple[0],instance1:tuple[1],instance2:tuple[2]}));frozen(snapshot);
});
test('unsupported shape families, transform ancestry, Boolean mixes and unrelated finishes refuse before providers',()=>{
  {const model=createCadModel(),circle=model.sketch.circle({center:[0,0],radius:4}).extrude(8);refuses(()=>circle.linearPattern(options()),'CAPABILITY');}
  {const {original}=part();refuses(()=>original.hole({center:[8,8],radius:2}).linearPattern(options()),'CAPABILITY');}
  {const {original}=part();refuses(()=>original.split({axis:'z',at:4}).negative.linearPattern(options()),'CAPABILITY');}
  for(const operation of ['union','intersect','cut']){const {model,original}=part(),tool=rectangle(model).extrude(4);refuses(()=>original[operation](tool).linearPattern(options()),'CAPABILITY');}
  for(const operation of ['translate','rotate','mirror','scale']){
    const {original}=part();const copy=operation==='translate'?original.translate([1,0,0]):operation==='rotate'?original.rotate({axis:'x',angleDegrees:90}):operation==='mirror'?original.mirror({plane:'xz'}):original.scale({factor:2});
    refuses(()=>copy.linearPattern(options()),'CAPABILITY');refuses(()=>original.linearPattern(options()),'CAPABILITY');
  }
  {const {model,original}=part();const other=rectangle(model).extrude(4);other.chamfer(other.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);refuses(()=>original.linearPattern(options()),'CAPABILITY');}
  {const {original}=part();original.chamfer(original.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);refuses(()=>original.linearPattern(options()),'CAPABILITY');}
});
test('direct affine rectangle, polygon and constrained-polygon parents include placement without enlarging the graph envelope',()=>{
  for(const profile of ['rectangle','polygon','constrained']){
    const model=createCadModel(),sketch=profile==='rectangle'?rectangle(model):profile==='polygon'?model.sketch.polygon([[0,0],[32,0],[32,24],[0,24]]):model.sketch.constrainedPolygon(fixedPolygon);
    const original=sketch.extrude(8,{from:3}),tuple=original.linearPattern(options('z',16));
    const snapshot=mockNative(()=>model.build({original:tuple[0],instance1:tuple[1],instance2:tuple[2]}));assert.equal(JSON.parse(snapshot.save()).nodes[1].from,3);assert.deepEqual(snapshot.evidence[2].native.request.stepMM,[0,0,16]);
  }
  const {model,original}=part(),other=rectangle(model).extrude(4),tuple=original.linearPattern(options());
  const snapshot=mockNative(()=>model.build({original:tuple[0],other,instance1:tuple[1],instance2:tuple[2]}));assert.equal(snapshot.features.length,5);assert.equal(CadModelLimits.nodes,6);
});
function finishedRail() {
  const model=createCadModel(),frontDistance=model.parameter('frontDistance',1),backDistance=model.parameter('backDistance',2),spacing=model.parameter('spacing',40);
  const blank=rectangle(model).extrude(8),front=blank.chamfer(blank.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),frontDistance);
  const finished=front.chamfer(front.edges({parallelTo:'x',at:{y:24,z:'max'}}).one(),backDistance);
  const tuple=finished.linearPattern(options('x',spacing));const snapshot=mockFinishing(()=>model.build({original:tuple[0],instance1:tuple[1],instance2:tuple[2]}));
  return {model,blank,front,finished,tuple,snapshot};
}
test('a complete one/two-chamfer prefix routes only the finished original and keeps one pattern feature',()=>{
  for(const count of [1,2]){
    const {model,original}=part(),front=original.chamfer(original.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
    const finished=count===1?front:front.chamfer(front.edges({parallelTo:'x',at:{y:24,z:'max'}}).one(),2),tuple=finished.linearPattern(options());
    assert.equal(tuple[0],finished);const begin=state.calls.length,snapshot=mockFinishing(()=>model.build({original:tuple[0],instance1:tuple[1],instance2:tuple[2]})),call=state.calls.at(-1);
    assert.equal(call.binding,'buildModelingLinearPattern');assert.equal(call.args[0],snapshot.bodies.original.native);
    assert.deepEqual(snapshot.features.map(feature=>feature.kind),['sketch','extrude',...Array(count).fill('chamfer'),'linear-pattern']);
    assert.equal(state.calls.slice(begin).filter(call=>call.binding==='buildModelingLinearPattern').length,1);
    const cold=mockFinishing(()=>loadCadModel(snapshot.save()));assert.equal(cold.save(),snapshot.save());assert.deepEqual(cold.bodies,snapshot.bodies);
  }
});
test('codec requires strict two-field instance references and rejects unsupported or forged sides before providers',()=>{
  const changes=[
    d=>d.outputs.instance1.side='solid',d=>d.outputs.instance1.side='negative',d=>d.outputs.instance1.side='positive',d=>d.outputs.instance1.side='instance0',d=>d.outputs.instance1.side='instance3',
    d=>d.outputs.instance1.instance=1,d=>d.outputs.instance2.instance=2,d=>d.outputs.original.side='instance1',d=>d.nodes[2].parent.side='instance1',d=>d.nodes[2].parent.node=0,
    d=>delete d.outputs.instance1.side,d=>d.outputs.instance2.node=99,d=>d.outputs.instance1={node:2,side:'solid',instance:1},
  ];for(const edit of changes)checkDocument(edit);
  const doc=authoredDocument();doc.outputs={instance1:{node:2,side:'instance1'},instance2:{node:2,side:'instance2'}};
  const snapshot=mockNative(()=>loadCadModel(signedJson(doc)));assert.deepEqual(Object.keys(snapshot.bodies).sort(),['instance1','instance2']);
});
test('strict authored pattern fields, positive spacing and terminal ancestry reject before any provider',()=>{
  const changes=[d=>delete d.nodes[2].axis,d=>delete d.nodes[2].spacing,d=>delete d.nodes[2].count,d=>d.nodes[2].count=5,d=>d.nodes[2].count='3',d=>d.nodes[2].axis='xy',
    d=>d.nodes[2].spacing=0,d=>d.nodes[2].spacing=-0,d=>d.nodes[2].spacing=-1,d=>d.nodes[2].spacing=5001,d=>d.nodes[2].spacing={parameter:'missing'},
    d=>d.nodes[2].native={},d=>d.nodes[2].copies=[],d=>d.nodes[2].report={},d=>d.nodes[2].instance=1,d=>d.nodes[2].kind='pattern',
    d=>d.nodes.push({kind:'extrude',sketch:0,height:4}),d=>d.nodes.push({...d.nodes[2],parent:{node:2,side:'instance1'}}),
    d=>d.nodes.push({kind:'translate',parent:{node:2,side:'instance1'},offset:[1,0,0]}),d=>d.nodes.push({kind:'rotate',parent:{node:2,side:'instance2'},axis:'x',angleDegrees:90}),
    d=>d.nodes.push({kind:'mirror',parent:{node:2,side:'instance1'},plane:'xz'}),d=>d.nodes.push({kind:'scale',parent:{node:2,side:'instance2'},factor:2}),
  ];for(const edit of changes)checkDocument(edit);
  const duplicate=signedJson(authoredDocument()).replace('"count":3','"count":3,"count":3');refuses(()=>loadCadModel(duplicate),'FORMAT','load');
  const {snapshot}=finishedRail();for(const parentNode of [1,2]){const doc=JSON.parse(snapshot.save());doc.nodes[4].parent.node=parentNode;refuses(()=>loadCadModel(signedJson(doc)),'CAPABILITY');}
});
test('spacing parameter and expression edits reuse the entire source prefix and rebuild both copy outputs',()=>{
  for(const expressions of [false,true]){
    const {snapshot}=patterned({expressions}),before=retained(snapshot),begin=state.calls.length;
    const next=mockNative(()=>snapshot.withParameters({spacing:48}));assert.deepEqual(state.calls.slice(begin).map(call=>call.binding),['buildModelingLinearPattern']);
    assert.deepEqual(next.recomputation,{reusedFeatures:[0,1],evaluatedFeatures:[2]});assert.equal(next.bodies.original,snapshot.bodies.original);
    for(const name of ['instance1','instance2']){assert.notEqual(next.bodies[name],snapshot.bodies[name]);assert.notEqual(next.bodies[name].native,snapshot.bodies[name].native);}
    assert.equal(next.evidence[0],snapshot.evidence[0]);assert.equal(next.evidence[1],snapshot.evidence[1]);assert.notEqual(next.evidence[2],snapshot.evidence[2]);
    assert.deepEqual(next.evidence[2].native.copies.map(copy=>copy.request.offsetMM),[[48,0,0],[96,0,0]]);unchanged(snapshot,before);
    const calls=state.calls.length,noop=next.withParameters({spacing:48});assert.equal(state.calls.length,calls);assert.deepEqual(noop.recomputation,{reusedFeatures:[0,1,2],evaluatedFeatures:[]});
    for(const name of ['original','instance1','instance2'])assert.equal(noop.bodies[name],next.bodies[name]);
  }
});
test('source dimension edits rebuild source and pattern instead of preserving stale copy data',()=>{
  const {snapshot}=patterned(),before=retained(snapshot),begin=state.calls.length,next=mockNative(()=>snapshot.withParameters({width:40}));
  assert.deepEqual(state.calls.slice(begin).map(call=>call.binding),['buildXYAffineSketch','buildXYAffineSketchPrism','buildModelingLinearPattern']);
  assert.deepEqual(next.recomputation,{reusedFeatures:[],evaluatedFeatures:[0,1,2]});
  for(const name of ['original','instance1','instance2'])assert.notEqual(next.bodies[name],snapshot.bodies[name]);
  assert.equal(next.evidence[2].native.copies[0].request.parent.authoredOptions.solidId,next.bodies.original.native.authoredOptions.solidId);
  assert.deepEqual(next.evidence[2].native.request.parent,next.bodies.original.native);assert.notDeepEqual(next.evidence[0].native.document,snapshot.evidence[0].native.document);unchanged(snapshot,before);
});
test('finished source edits retain the accepted first prefix and rebuild second finish plus both copies',()=>{
  const {snapshot}=finishedRail(),before=retained(snapshot),begin=state.calls.length,next=mockFinishing(()=>snapshot.withParameters({backDistance:3}));
  assert.deepEqual(state.calls.slice(begin).map(call=>call.binding),['chamferConvexPlanarSolid','buildModelingLinearPattern']);
  assert.deepEqual(next.recomputation,{reusedFeatures:[0,1,2],evaluatedFeatures:[3,4]});
  for(const index of [0,1,2])assert.equal(next.evidence[index],snapshot.evidence[index]);
  assert.notEqual(next.bodies.original,snapshot.bodies.original);assert.notEqual(next.bodies.instance1,snapshot.bodies.instance1);assert.notEqual(next.bodies.instance2,snapshot.bodies.instance2);unchanged(snapshot,before);
});
test('invalid spacing edits spend no provider work and retain every accepted save/body/evidence identity',()=>{
  const {snapshot}=patterned(),before=retained(snapshot),begin=state.calls.length;
  for(const spacing of [0,-0,-1,5001])refuses(()=>snapshot.withParameters({spacing}),'PARAMETER','linearPattern');
  assert.equal(state.calls.length,begin);unchanged(snapshot,before);
  const recovered=mockNative(()=>snapshot.withParameters({spacing:48}));assert.deepEqual(recovered.recomputation,{reusedFeatures:[0,1],evaluatedFeatures:[2]});unchanged(snapshot,before);
});
test('native routing refusal preserves its original full cause and spent-child report without exposing a partial pattern',()=>{
  const {snapshot}=patterned(),before=retained(snapshot),begin=state.calls.length;
  const cause=Object.assign(new Error('INERT second-child refusal; not geometry'),{name:'ModelingLinearPatternError',code:'BINDING',stage:'copy2',entity:'m2_i2',
    report:{parentValidation:{controlOnly:marker},directCalls:{parentValidationCount:1,translationCount:2,retries:0},completedChildReports:[{controlOnly:marker,instance:1}]},cause:new Error('original child provider cause')});
  const error=mockNative(()=>refuses(()=>snapshot.withParameters({spacing:48}),'NATIVE','linearPattern',false),cause);
  assert.equal(error.cause,cause);assert.equal(error.cause.report,cause.report);assert.equal(error.cause.cause,cause.cause);
  assert.deepEqual(state.calls.slice(begin).map(call=>call.binding),['buildModelingLinearPattern']);
  for(const field of ['copies','bodies','evidence','solid'])assert.equal(Object.hasOwn(error,field),false);unchanged(snapshot,before);
  const recovered=mockNative(()=>snapshot.withParameters({spacing:48}));assert.equal(recovered.bodies.original,snapshot.bodies.original);unchanged(snapshot,before);
});
test('old omitted-placement and adopted translate/rotate/mirror/scale documents retain strict file compatibility',()=>{
  const base=authoredDocument();base.nodes.pop();base.outputs={original:{node:1,side:'solid'}};
  const old=mockNative(()=>loadCadModel(signedJson(base)));assert.equal(Object.hasOwn(JSON.parse(old.save()).nodes[1],'from'),false);assert.deepEqual(old.features.map(feature=>feature.kind),['sketch','extrude']);
  const transforms=[{kind:'translate',parent:{node:1,side:'solid'},offset:[40,-0,0]},
    {kind:'rotate',parent:{node:1,side:'solid'},axis:'x',angleDegrees:-90},{kind:'mirror',parent:{node:1,side:'solid'},plane:'xz'},{kind:'scale',parent:{node:1,side:'solid'},factor:0.5}];
  for(const transform of transforms){const doc=structuredClone(base);doc.nodes.push(transform);doc.outputs={original:{node:1,side:'solid'},copy:{node:2,side:'solid'}};
    const snapshot=mockNative(()=>loadCadModel(signedJson(doc)));assert.deepEqual(JSON.parse(snapshot.save()).nodes[2],transform);assert.equal(snapshot.evidence[2].kind,transform.kind);frozen(snapshot);
  }
});
