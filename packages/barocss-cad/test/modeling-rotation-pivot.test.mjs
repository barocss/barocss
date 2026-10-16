import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls for #2015. Every construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Deliberately inert bodies/reports below prove no geometry or native lineage.
// Use CAD_MODEL_ROTATION_PIVOT_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index has erased the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_ROTATION_PIVOT_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-rotation-pivot.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'], ['modeling-profile-internal', 'runModelingProfile'],
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
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], rotationError: undefined, translationError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_ROTATION_PIVOT_CONTROL_NOT_GEOMETRY';
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
  if (binding === 'buildModelingRotation' || binding === 'buildModelingTranslation') {
    const error = binding === 'buildModelingRotation' ? state.rotationError : state.translationError;
    if (error !== undefined) throw error;
    const field = binding === 'buildModelingRotation' ? 'spec' : 'offsetMM';
    return call.result = { controlOnly: marker, request: { parent: clone(args[0]), [field]: clone(args[1]), prefix: args[2], ...(binding === 'buildModelingRotation' && args.length === 4 ? { pivotMM: clone(args[3]) } : {}) },
      solid: { controlOnly: marker, solidId: args[2] + '_inert_solid', source: clone(args[0]), [field]: clone(args[1]) },
      report: { controlOnly: marker, nested: { sentinel: 'complete-inert-transform-report' } },
      lineage: { controlOnly: marker, sentinel: ['not-a-geometric-correspondence'] } };
  }
  if (binding === 'buildXYArc') return call.result = { controlOnly: marker, curve: { id: args[0].id }, report: { centerMM: args[0].center, radiusMM: args[0].radius } };
  if (binding === 'buildXYCirclePrismShell' || binding === 'qualifyStoredCirclePrismSolid') return call.result = { controlOnly: marker };
  state.unexpected.push(binding); throw new Error('UNUSED_MOCK_PROVIDER: ' + binding);
}
globalThis[trapKey] = { dispatch };
const virtualEntry = `export * from ${JSON.stringify(entry)};
export { modelingGraphKey, modelingNodeParameters, modelingReusablePrefix } from './modeling-regeneration-internal.js';
export { signedJson } from './xy-affine-prism-feature-document-internal.js';`;
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'rotation-pivot-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-rotation-pivot-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'circular-pattern-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'circular-pattern-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-rotation-pivot.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('circular-pattern-trap:') && !path.endsWith('rotation-pivot-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-rotation-pivot-admission-' + mode);
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
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 2015,
    scope: 'Actual modeling facade and unchanged pure helpers; isolated inert providers; admission and routing only, no geometric acceptance',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertProviderCalls: counts,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function mockNative(action, error) {
  assert.equal(state.phase, 'closed'); state.phase = 'mock-native'; state.translationError = error;
  try { return action(); } finally { state.phase = 'closed'; state.translationError = undefined; }
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

const options = (pivot, axis='x', angleDegrees=90) => ({axis,angleDegrees,...(pivot===undefined?{}:{pivot})});
function part(){const model=createCadModel();return {model,original:rectangle(model).extrude(8)};}
function recipe({pivot=[16,12,4],finishing=0,placement=false}={}){
 const model=createCadModel(), py=model.parameter('pivotY',12), dx=model.parameter('offsetX',40), width=model.parameter('width',32);
 let original=model.sketch.rectangle({width,height:24}).extrude(8);
 if(finishing)original=original.chamfer(original.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
 if(finishing===2)original=original.chamfer(original.edges({parallelTo:'x',at:{y:24,z:'max'}}).one(),2);
 const middle=original.rotate(options(pivot==='parameter'?[16,py,4]:pivot));const placed=placement?middle.translate([dx,16,-0]):undefined;
 const snapshot=(finishing?mockFinishing:mockNative)(()=>model.build({original,middle,...(placed?{placed}:{})}));
 return {model,original,middle,placed,snapshot};
}
test('all25 inert bindings retain absent pivot three-argument request and authored explicit zero four-argument request',()=>{
 for(const pivot of [undefined,[0,-0,0]]){const {model,original}=part(),output=original.rotate(options(pivot)),start=state.calls.length;
 const snapshot=mockNative(()=>model.build({original,output}));const call=state.calls.slice(start).find(c=>c.binding==='buildModelingRotation');
 assert.equal(call.args.length,pivot===undefined?3:4);assert.deepEqual(Object.keys(call.result.request),pivot===undefined?['parent','spec','prefix']:['parent','spec','prefix','pivotMM']);
 const node=JSON.parse(snapshot.save()).nodes[2];assert.equal(Object.hasOwn(node,'pivot'),pivot!==undefined);if(pivot){assert.deepEqual(call.args[3],pivot);assert.match(snapshot.save(),/-0/);}frozen(snapshot);}
 assert.equal(replaced.size, 25);
});
test('all axes and six authored angles preserve pivot and canonical two-field private spec',()=>{
 for(const axis of ['x','y','z'])for(const angle of [90,180,270,-90,-180,-270]){const {model,original}=part(),pivot=[16,-0,4],output=original.rotate(options(pivot,axis,angle));
 const snap=mockNative(()=>model.build({output})),request=snap.evidence[2].native.request;
 assert.deepEqual(request.spec,{axis,degrees:angle<0?angle+360:angle});assert.deepEqual(request.pivotMM,pivot);
 assert.equal(JSON.parse(snap.save()).nodes[2].angleDegrees,angle);}
});
test('caller arrays and option objects are captured before later mutation',()=>{
 const {model,original}=part(),pivot=[16,12,4],input=options(pivot),output=original.rotate(input);pivot[1]=99;input.axis='z';
 const snap=mockNative(()=>model.build({output}));assert.deepEqual(snap.evidence[2].native.request.pivotMM,[16,12,4]);assert.equal(snap.evidence[2].native.request.spec.axis,'x');
});
test('descriptor snapshots do not read live proxy properties or invoke accessors',()=>{
 const {model,original}=part();let reads=0;const pivot=new Proxy([16,12,4],{get(){reads++;throw Error('live read');}});
 const input=new Proxy(options(pivot),{get(){reads++;throw Error('live option read');}});const output=original.rotate(input);
 const snap=mockNative(()=>model.build({output}));assert.deepEqual(snap.evidence[2].native.request.pivotMM,[16,12,4]);assert.equal(reads,0);
 const getter=[16,12,4];Object.defineProperty(getter,'1',{enumerable:true,get(){reads++;return 12;}});
 refuses(()=>part().original.rotate(options(getter)),'INPUT');assert.equal(reads,0);
});
test('malformed pivot shape, symbols, hidden fields, reflection and bounds refuse without append',()=>{
 const hidden=[16,12,4];Object.defineProperty(hidden,'hidden',{value:1});const symbol=[16,12,4];symbol[Symbol()]=1;
 const revoked=Proxy.revocable([16,12,4],{});revoked.revoke();const reflection=new Proxy([16,12,4],{ownKeys(){throw Error('reflection');}});
 for(const pivot of [null,[],[1,2],[1,2,3,4],[,2,3],[NaN,0,0],[Infinity,0,0],[10001,0,0],['1',0,0],hidden,symbol,revoked.proxy,reflection]){
 const {model,original}=part();refuses(()=>original.rotate(options(pivot)));const output=original.rotate(options([0,0,0]));assert.equal(mockNative(()=>model.build({output})).features.length,3);}
});
test('receiver and exact arity guards precede pivot reflection',()=>{
 const {model,original}=part(),method=original.rotate;let reads=0;const input=new Proxy(options([0,0,0]),{ownKeys(){reads++;throw Error('read');}});
 for(const receiver of [undefined,{}, {...original},part().original])refuses(()=>method.call(receiver,input),'OWNERSHIP');assert.equal(reads,0);
 refuses(()=>original.rotate(options([0,0,0]),true),'INPUT');const output=original.rotate(options([0,0,0]));assert.equal(mockNative(()=>model.build({output})).features.length,3);
});
test('own dimensions and expressions resolve pivot while foreign and copied dimensions refuse',()=>{
 const {model,original}=part(),py=model.parameter('py',12),expr=model.dimension.add(model.dimension.scale(py,1),0);
 const other=part().model.parameter('foreign',12);for(const value of [other,{...py},{...expr}])refuses(()=>original.rotate(options([16,value,4])),'OWNERSHIP');
 const output=original.rotate(options([16,expr,4])),snap=mockNative(()=>model.build({output}));assert.deepEqual(snap.evidence[2].native.request.pivotMM,[16,12,4]);
 const next=mockNative(()=>snap.withParameters({py:20}));assert.deepEqual(next.evidence[2].native.request.pivotMM,[16,20,4]);
});
test('callback ownership fence precedes argument reflection and leaves model usable',()=>{
 const {model,original}=part();let reads=0;const input=new Proxy(options([0,0,0]),{ownKeys(){reads++;throw Error('read');}});
 refuses(()=>model.sketch.constrainedPolygon(builder=>{original.rotate(input);return fixedPolygon(builder);}),'OWNERSHIP');assert.equal(reads,0);
 const output=original.rotate(options([0,0,0]));assert.equal(mockNative(()=>model.build({output})).features.length,3);
});
test('full two-chamfer pivot placement has exact six-node dependencies and Native parent routing',()=>{
 const {snapshot}=recipe({finishing:2,placement:true});assert.deepEqual(snapshot.features.map(f=>f.kind),['sketch','extrude','chamfer','chamfer','rotate','translate']);
 assert.deepEqual(snapshot.features[4].dependencies,[3]);assert.deepEqual(snapshot.features[5].dependencies,[4]);
 assert.deepEqual(snapshot.evidence[5].native.request.parent,snapshot.evidence[4].native.solid);assert.deepEqual(snapshot.evidence[4].native.request.pivotMM,[16,12,4]);frozen(snapshot);
});
test('pivot-only edits reuse source, offset-only edits reuse rotation, and no-op spends no provider',()=>{
 const {snapshot}=recipe({pivot:'parameter',placement:true}),held=retained(snapshot);let start=state.calls.length;
 const next=mockNative(()=>snapshot.withParameters({pivotY:20}));assert.deepEqual(state.calls.slice(start).map(c=>c.binding),['buildModelingRotation','buildModelingTranslation']);
 assert.deepEqual(next.recomputation,{reusedFeatures:[0,1],evaluatedFeatures:[2,3]});start=state.calls.length;
 const moved=mockNative(()=>next.withParameters({offsetX:56}));assert.deepEqual(state.calls.slice(start).map(c=>c.binding),['buildModelingTranslation']);assert.equal(moved.bodies.middle,next.bodies.middle);
 start=state.calls.length;const noop=moved.withParameters({pivotY:20});assert.equal(state.calls.length,start);assert.deepEqual(noop.recomputation.evaluatedFeatures,[]);unchanged(snapshot,held);
});
test('source edit invalidates rotation and placement with accepted state retained',()=>{
 const {snapshot}=recipe({pivot:'parameter',placement:true}),held=retained(snapshot),start=state.calls.length;
 const next=mockNative(()=>snapshot.withParameters({width:40}));assert.deepEqual(state.calls.slice(start).map(c=>c.binding),['buildXYAffineSketch','buildXYAffineSketchPrism','buildModelingRotation','buildModelingTranslation']);assert.notEqual(next.bodies.original,snapshot.bodies.original);unchanged(snapshot,held);
});
test('strict cold load preserves explicit pivot save, complete reports and signed zero',()=>{
 for(const pivot of [[16,12,4],[0,-0,0],undefined]){const {snapshot}=recipe({pivot}),cold=mockNative(()=>loadCadModel(snapshot.save()));assert.equal(cold.save(),snapshot.save());assert.deepEqual(cold.bodies,snapshot.bodies);assert.deepEqual(cold.evidence,snapshot.evidence);frozen(cold);}
});
test('codec malformed pivots, unknown fields and invalid pair ancestry refuse before providers',()=>{
 const {snapshot}=recipe({placement:true});for(const edit of [d=>d.nodes[2].pivot=[0,0],d=>d.nodes[2].pivot=[0,0,0,0],d=>d.nodes[2].pivot=[10001,0,0],d=>d.nodes[2].extra=true,d=>d.nodes[3].parent.node=1,d=>d.nodes[2].parent.node=0]){
 const d=JSON.parse(snapshot.save());edit(d);refuses(()=>loadCadModel(signedJson(d)));}
});
test('Native rotation cause survives failed pivot edit without changing accepted state',()=>{
 const {snapshot}=recipe({pivot:'parameter'}),held=retained(snapshot),cause=Object.assign(new Error('INERT exact refusal'),{code:'REPRESENTABILITY',report:{controlOnly:marker}});
 state.rotationError=cause;let error;try{error=mockNative(()=>refuses(()=>snapshot.withParameters({pivotY:.1}),'NATIVE','rotate',false));}finally{state.rotationError=undefined;}
 assert.equal(error.cause,cause);assert.equal(error.cause.report,cause.report);unchanged(snapshot,held);const recovery=mockNative(()=>snapshot.withParameters({pivotY:20}));assert.deepEqual(recovery.evidence[2].native.request.pivotMM,[16,20,4]);
});
test('all source profiles and from preserve admitted pivot prefix and terminal boundary',()=>{
 for(const kind of ['rectangle','polygon','constrained']){const model=createCadModel(),sketch=kind==='rectangle'?rectangle(model):kind==='polygon'?model.sketch.polygon([[0,0],[32,0],[32,24],[0,24]]):model.sketch.constrainedPolygon(fixedPolygon);
 const original=sketch.extrude(8,{from:3}),middle=original.rotate(options([16,12,4]));refuses(()=>middle.rotate(options([0,0,0])),'CAPABILITY');refuses(()=>original.translate([1,0,0]),'CAPABILITY');
 const output=middle.translate([40,16,0]);assert.equal(mockNative(()=>model.build({output})).features.length,4);}
});
