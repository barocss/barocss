import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls for #1962. Every construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Deliberately inert bodies/reports below prove no geometry or native lineage.
// Use CAD_MODEL_MIRROR_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index has erased the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_MIRROR_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-mirror.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'],
  ['xy-affine-sketch', 'buildXYAffineSketch'], ['xy-affine-sketch-prism', 'buildXYAffineSketchPrism'],
  ['convex-planar-slab-subtraction', 'subtractConvexPlanarSlab'], ['convex-planar-solid-intersection', 'intersectConvexPlanarSolids'],
  ['convex-planar-solid-split', 'splitConvexPlanarSolid'], ['model-compiler', 'compileCadModel'],
  ['convex-planar-solid-chamfer', 'chamferConvexPlanarSolid'], ['axis-box-boolean', 'buildAxisBoxSolidBoolean'],
  ['orthogonal-solid-boolean', 'buildOrthogonalSolidBoolean'], ['modeling-box-internal', 'buildModelingBox'],
  ['modeling-translation-internal', 'buildModelingTranslation'], ['modeling-rotation-internal', 'buildModelingRotation'], ['modeling-mirror-internal', 'buildModelingMirror'], ['modeling-scale-internal', 'buildModelingScale'], ['modeling-linear-pattern-internal', 'buildModelingLinearPattern'], ['modeling-stl-internal', 'buildModelingStl'],
  ['own-plate-circular-hole', 'buildOwnPlateCircularHole'], ['stored-plate-hole-solid', 'qualifyStoredPlateHoleSolid'],
  ['convex-planar-solid-mass', 'measureConvexPlanarSolidMass'], ['axis-box-solid-mass', 'measureAxisBoxSolidBooleanMass'],
]);
const pureModules = new Set(['modeling', 'cad-document', 'data-copy', 'xy-affine-prism-feature-document-internal',
  'modeling-regeneration-internal', 'modeling-dimension-internal']);
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], mirrorError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_MIRROR_CONTROL_NOT_GEOMETRY';
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
  if (binding === 'buildModelingMirror') {
    if (state.mirrorError !== undefined) throw state.mirrorError;
    return call.result = { controlOnly: marker, request: { parent: clone(args[0]), spec: clone(args[1]), prefix: args[2] },
      solid: { controlOnly: marker, solidId: args[2] + '_inert_solid' },
      report: { controlOnly: marker, nested: { sentinel: 'complete-inert-report' } },
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
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'mirror-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-mirror-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'mirror-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'mirror-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-mirror.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('mirror-trap:') && !path.endsWith('mirror-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-mirror-admission-' + mode);
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
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 1962,
    scope: 'Actual modeling facade and unchanged pure helpers; isolated inert providers; admission and routing only, no geometric acceptance',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertProviderCalls: counts,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function mockNative(action, error) {
  assert.equal(state.phase, 'closed'); state.phase = 'mock-native'; state.mirrorError = error;
  try { return action(); } finally { state.phase = 'closed'; state.mirrorError = undefined; }
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


const options = (plane='xz') => ({plane});
const doc = (plane='xz') => ({format:'barocss-cad-model',schema:1,units:'mm',parameters:{},nodes:[
  {kind:'sketch',profile:'rectangle',min:[-0,0],max:[32,24]},{kind:'extrude',sketch:0,height:8},
  {kind:'mirror',parent:{node:1,side:'solid'},plane}],outputs:{original:{node:1,side:'solid'},mirrored:{node:2,side:'solid'}}});
const part = () => {const model=createCadModel();return {model,original:rectangle(model).extrude(8)};};
function pair(plane='xz') {const {model,original}=part(),mirrored=original.mirror(options(plane));return mockNative(()=>model.build({original,mirrored}));}

test('all twenty-three facade providers are replaced with direct provenance excluding native implementations',()=>{
  assert.equal(replaced.size,23);assert.equal(inputPaths.length,pureModules.size);
  const start=state.calls.length,snapshot=pair(),calls=state.calls.slice(start);
  assert.deepEqual(calls.map(c=>c.binding),['buildXYAffineSketch','buildXYAffineSketchPrism','buildModelingMirror']);
  assert.equal(calls[2].args[0],snapshot.bodies.original.native);assert.deepEqual(calls[2].args[1],{plane:'xz'});assert.equal(calls[2].args[2],'m2');
  assert.equal(snapshot.bodies.mirrored.native,calls[2].result.solid);assert.equal(snapshot.bodies.mirrored.family,'convex-planar');assert.equal(snapshot.evidence[2].native,calls[2].result);
  assert.deepEqual(snapshot.features.map(f=>[f.kind,f.dependencies]),[['sketch',[]],['extrude',[0]],['mirror',[1]]]);assert.equal(CadModelLimits.nodes,6);frozen(snapshot);
});
test('all three authored planes retain strict saved values and route unchanged native specs',()=>{
  for(const plane of ['xy','xz','yz']){
    const snapshot=pair(plane),saved=JSON.parse(snapshot.save());
    assert.deepEqual(saved.nodes[2],{kind:'mirror',parent:{node:1,side:'solid'},plane});assert.deepEqual(snapshot.evidence[2].native.request.spec,{plane});
    const cold=mockNative(()=>loadCadModel(snapshot.save()));assert.equal(cold.save(),snapshot.save());
    assert.deepEqual(Object.keys(snapshot.bodies).sort(),['mirrored','original']);
    assert.deepEqual(Object.keys(cold.bodies).sort(),['mirrored','original']);
    assert.deepEqual(cold.bodies,snapshot.bodies);assert.deepEqual(cold.evidence,snapshot.evidence);
  }
});
test('one exact own-data plane record refuses malformed data without consuming a node',()=>{
  const {model,original}=part();let reads=0;
  const getter={};Object.defineProperty(getter,'plane',{enumerable:true,get(){reads++;return 'xz';}});
  const hidden=options();Object.defineProperty(hidden,'hidden',{value:1});const symbol=options();symbol[Symbol('x')]=1;
  const hostile=Object.create({plane:'xz'});const revoked=Proxy.revocable(options(),{});revoked.revoke();
  const args=[[],[undefined],[null],[options(),undefined],[[]],[getter],[hidden],[symbol],[hostile],[revoked.proxy],[{}],
    [{...options(),normal:[0,1,0]}],[{...options(),pivot:[0,0,0]}],[{...options(),offset:1}]];
  for(const plane of [null,'zx','yx','zy','XY','x',0,-0,90,NaN,Infinity,{parameter:'plane'},[0,1,0]])args.push([options(plane)]);
  args.push([{plane:undefined}]);
  for(const value of args)refuses(()=>original.mirror(...value));
  assert.equal(reads,0);
  const snapshot=mockNative(()=>model.build({mirrored:original.mirror(options())}));assert.deepEqual(JSON.parse(snapshot.save()).nodes.map(n=>n.kind),['sketch','extrude','mirror']);
});
test('one descriptor snapshot prevents Proxy get traps from changing authored plane',()=>{
  for(const replacement of ['xy','throw']){
    const {model,original}=part();let reads=0;
    const value=new Proxy(options('xz'),{get(){reads++;if(replacement==='throw')throw Error('hostile-get');return replacement;}});
    const mirrored=original.mirror(value),snapshot=mockNative(()=>model.build({mirrored}));assert.equal(reads,0);assert.equal(JSON.parse(snapshot.save()).nodes[2].plane,'xz');assert.deepEqual(snapshot.evidence[2].native.request.spec,{plane:'xz'});
  }
  const {original}=part();let reads=0;const invalid=new Proxy(options('zx'),{get(){reads++;return 'xz';}});refuses(()=>original.mirror(invalid));assert.equal(reads,0);assert.ok(original.mirror(options()));
});
test('borrowed receivers, dimensions and non-plain prototypes refuse before routing',()=>{
  const {model,original}=part();const f=original.mirror;refuses(()=>f(options()));refuses(()=>f.call({},options()));refuses(()=>f.call(part().original,options()));
  refuses(()=>original.mirror({plane:model.parameter('plane',1)}));refuses(()=>original.mirror(Object.assign(new Date(),options())));
  const data=Object.assign(Object.create(null),options());assert.ok(original.mirror(data));
});
test('world-origin plane copy is terminal for transforms and later features through retained handles',()=>{
  const {model,original}=part(),mirrored=original.mirror(options());
  for(const shape of [original,mirrored]){refuses(()=>shape.mirror(options()));refuses(()=>shape.rotate({axis:'x',angleDegrees:90}));refuses(()=>shape.translate([1,0,0]));refuses(()=>shape.hole({center:[1,1],radius:1}));refuses(()=>shape.split({axis:'z',at:4}));}
  refuses(()=>mirrored.edges({parallelTo:'x'}));
  refuses(()=>model.sketch.rectangle({width:2,height:2}));refuses(()=>model.sketch.polygon([[0,0],[2,0],[0,2]]));
  for(const transform of ['translate','rotate']){const {original}=part();const copy=transform==='translate'?original.translate([1,0,0]):original.rotate({axis:'x',angleDegrees:90});refuses(()=>copy.mirror(options()));refuses(()=>original.mirror(options()));}
});
test('direct affine provenance includes placed extrusion and complete one/two-chamfer prefix',()=>{
  for(const profile of ['rectangle','polygon','constrained']){
    const model=createCadModel(),sketch=profile==='rectangle'?rectangle(model):profile==='polygon'?model.sketch.polygon([[0,0],[32,0],[32,24],[0,24]]):model.sketch.constrainedPolygon(fixedPolygon);
    const original=sketch.extrude(8,{from:3}),mirrored=original.mirror(options('xy'));const snapshot=mockNative(()=>model.build({original,mirrored}));assert.equal(JSON.parse(snapshot.save()).nodes[1].from,3);
  }
  for(const count of [1,2]){
    const {model,original}=part(),front=original.chamfer(original.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
    const finished=count===1?front:front.chamfer(front.edges({parallelTo:'x',at:{y:24,z:'max'}}).one(),2);
    const mirrored=finished.mirror(options());const snapshot=mockFinishing(()=>model.build({original:finished,mirrored}));assert.deepEqual(snapshot.features.map(f=>f.kind),['sketch','extrude',...Array(count).fill('chamfer'),'mirror']);
  }
  const {model,original}=part(),other=rectangle(model).extrude(4),mirrored=original.mirror(options('yz'));const snapshot=mockNative(()=>model.build({original,other,mirrored}));assert.equal(snapshot.features.length,5);
});
test('unsupported families, operation ancestry and incomplete finishing prefixes refuse',()=>{
  {const model=createCadModel(),circle=model.sketch.circle({center:[0,0],radius:4}).extrude(8);refuses(()=>circle.mirror(options()));}
  {const {original}=part();refuses(()=>original.hole({center:[8,8],radius:2}).mirror(options()));}
  {const {original}=part();refuses(()=>original.split({axis:'z',at:4}).negative.mirror(options()));}
  for(const operation of ['union','intersect','cut']){const {model,original}=part(),tool=rectangle(model).extrude(4);refuses(()=>original[operation](tool).mirror(options()));}
  {const {original}=part();const front=original.chamfer(original.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);refuses(()=>original.chamfer(original.edges({parallelTo:'x',at:{y:24,z:'max'}}).one(),2));refuses(()=>original.mirror(options()));assert.ok(front);}
  {const {model,original}=part();const other=rectangle(model).extrude(4);other.chamfer(other.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);refuses(()=>original.mirror(options()));}
});
test('same-model callback fences held handles before options reflection and preserves failed admission',()=>{
  const {model,original}=part();let reflections=0;
  const value=new Proxy(options(),{ownKeys(){reflections++;throw Error('must-not-reflect');}});
  model.sketch.constrainedPolygon(s=>{refuses(()=>original.mirror(value),'OWNERSHIP');assert.equal(reflections,0);return fixedPolygon(s);});assert.ok(original.mirror(options()));
  const other=part();let crossModel;createCadModel().sketch.constrainedPolygon(s=>{crossModel=other.original.mirror(options());return fixedPolygon(s);});assert.ok(crossModel);
});
test('strict codec rejects wrong fields, planes, parent references, mixed transforms and later nodes',()=>{
  const mutations=[d=>delete d.nodes[2].plane,d=>d.nodes[2].offset=1,d=>d.nodes[2].normal=[0,1,0],d=>d.nodes[2].plane='zx',d=>d.nodes[2].plane={parameter:'x'},
    d=>d.nodes[2].parent.side='negative',d=>d.nodes[2].parent.node=0,d=>d.nodes.push({kind:'extrude',sketch:0,height:4}),d=>d.nodes.push({...d.nodes[2],parent:{node:2,side:'solid'}}),d=>d.nodes[2].kind='reflect',
    d=>d.nodes.push({kind:'translate',parent:{node:2,side:'solid'},offset:[1,0,0]}),d=>d.nodes.push({kind:'rotate',parent:{node:2,side:'solid'},axis:'x',angleDegrees:90})];
  for(const edit of mutations){const d=doc();edit(d);refuses(()=>loadCadModel(signedJson(d)));}
  const duplicate=signedJson(doc()).replace('"plane":"xz"','"plane":"xz","plane":"xz"');refuses(()=>loadCadModel(duplicate));
  const old=doc();old.nodes.pop();old.outputs={original:{node:1,side:'solid'}};const snapshot=mockNative(()=>loadCadModel(signedJson(old)));assert.equal(Object.hasOwn(JSON.parse(snapshot.save()).nodes[1],'from'),false);
});
test('native refusal keeps original complete cause and accepted snapshot data',()=>{
  const snapshot=pair(),held=retained(snapshot),cause=new Error('native Gram refusal');cause.report={completed:'parent-validation',retries:0};const error=refuses(()=>mockNative(()=>loadCadModel(snapshot.save()),cause),'NATIVE','mirror',false);assert.equal(error.cause,cause);assert.equal(error.cause.report,cause.report);unchanged(snapshot,held);
});

// Actual pure mapping exports. All native imports are replaced by throwing traps.
const mapEntry=resolve(dirname(entry),'modeling-mirror-internal'+extname(entry));
const mapBindings={ 'own-convex-planar-face':['buildConvexPlanarFace'], 'convex-planar-solid':['qualifyConvexPlanarSolid','validateConvexPlanarSolid'],
  'convex-planar-solid-proof-internal':['check','id','same','SolidSnapshotLedger','ConvexPlanarSolidError'], 'section-rational-internal':['SectionRationalContext'] };
let mapAttempts=0;const mapKey=Symbol.for('barocss.modeling-mirror.coefficient-trap');globalThis[mapKey]=()=>{mapAttempts++;throw Error('UNEXPECTED_MAP_NATIVE');};
const mapBundle=await build({stdin:{contents:`export { mirrorCardinalPoint, mirrorCardinalCurve, mirrorCardinalSurface } from ${JSON.stringify(mapEntry)};`,resolveDir:dirname(entry),sourcefile:'mirror-map-entry.mjs',loader:'js'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true,
 plugins:[{name:'mirror-map-native-trap',setup(b){b.onResolve({filter:/\.(?:ts|js)$/},args=>{const key=basename(args.path,extname(args.path));if(mapBindings[key])return{path:key,namespace:'map-trap'};assert.equal(key,'modeling-mirror-internal');});b.onLoad({filter:/.*/,namespace:'map-trap'},args=>({loader:'js',contents:mapBindings[args.path].map(name=>`export const ${name}=function(){return globalThis[Symbol.for('barocss.modeling-mirror.coefficient-trap')]();};`).join('\n')}));}}]});
const {mirrorCardinalPoint:mirror,mirrorCardinalCurve,mirrorCardinalSurface}=await import('data:text/javascript;base64,'+Buffer.from(mapBundle.outputFiles[0].text).toString('base64'));
if(provenance){const dir=provenance.directory;writeFileSync(resolve(dir,'map-bundle.mjs'),mapBundle.outputFiles[0].text,{flag:'wx'});writeFileSync(resolve(dir,'map-metafile.json'),JSON.stringify(mapBundle.metafile,null,2)+'\n',{flag:'wx'});provenance.map={entry:mapEntry,sourceSHA256:sha256(readFileSync(mapEntry)),bundleSHA256:sha256(mapBundle.outputFiles[0].text),nativeBindingsReplaced:mapBindings};}
after(()=>{delete globalThis[mapKey];assert.equal(mapAttempts,0);});
const MAPS={xy:[1,2,-3],xz:[1,-2,3],yz:[-1,2,3]};
const oracle=(point,plane)=>MAPS[plane].map(c=>c>0?point[c-1]:-point[-c-1]);
test('three determinant-minus-one maps copy all signed-zero combinations and restore bits after two reflections',()=>{
 const points=[[2,3,5],[Number.MIN_VALUE,-Number.MIN_VALUE,-0],[10000,-10000,0]];
 for(let mask=0;mask<8;mask++)points.push([0,1,2].map(i=>mask&(1<<i)?-0:0));
 for(const plane of ['xy','xz','yz']){assert.equal(MAPS[plane].reduce((v,c)=>v*Math.sign(c),1),-1);
  for(const point of points){const actual=mirror(point,{plane}),expected=oracle(point,plane);actual.forEach((v,i)=>assert.ok(Object.is(v,expected[i])));mirror(actual,{plane}).forEach((v,i)=>assert.ok(Object.is(v,point[i])));}
 }
});
test('curve and Surface coefficients keep authored pole order, weights, knots and increasing domains',()=>{
 const c={kind:'curve',id:'c',degree:1,knots:[-0,0,1,1],weights:[1,1],controlPoints:[[-0,2,3],[4,-0,6]]};
 const s={kind:'surface',id:'s',degreeU:1,degreeV:1,knotsU:[-0,0,1,1],knotsV:[0,0,1,1],weights:[[1,1],[1,1]],controlPoints:[[c.controlPoints[0],c.controlPoints[1]],[[7,8,-0],[10,11,12]]]};
 for(const plane of ['xy','xz','yz']){const spec={plane},a=mirrorCardinalCurve(c,spec),b=mirrorCardinalSurface(s,spec);
  assert.deepEqual(a.controlPoints,c.controlPoints.map(p=>oracle(p,plane)));assert.deepEqual(b.controlPoints,s.controlPoints.map(row=>row.map(p=>oracle(p,plane))));
  for(const field of ['degree','knots','weights'])assert.deepEqual(a[field],c[field]);for(const field of ['degreeU','degreeV','knotsU','knotsV','weights'])assert.deepEqual(b[field],s[field]);
  assert.ok(a.knots[a.degree]<a.knots[a.knots.length-a.degree-1]);assert.notEqual(a.knots,c.knots);assert.notEqual(a.weights,c.weights);assert.notEqual(b.weights[0],s.weights[0]);a.controlPoints[0][0]=999;assert.ok(Object.is(c.controlPoints[0][0],-0));
 }
});
test('reflection parity requires exactly one Face-sense change and one directed-cycle reversal',()=>{
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const du=[1,2,3],dv=[4,5,6],flip=sense=>sense==='forward'?'reverse':'forward';
 const cycle=['a','b','c','d'],anchored=values=>[values[0],...values.slice(1).reverse()];
 for(const plane of ['xy','xz','yz']){const expected=oracle(cross(du,dv),plane).map(v=>-v);assert.deepEqual(cross(oracle(du,plane),oracle(dv,plane)),expected);for(const sense of ['forward','reverse'])assert.equal(flip(flip(sense)),sense);}
 assert.deepEqual(anchored(cycle),['a','d','c','b']);assert.deepEqual(anchored(anchored(cycle)),cycle);
 const domain=[-0,1],use={sense:'forward',interval:[-0,1],vertexIds:['v0','v1']};
 const reversed={sense:flip(use.sense),interval:[...use.interval].reverse(),vertexIds:[...use.vertexIds].reverse()};
 assert.deepEqual(reversed,{sense:'reverse',interval:[1,-0],vertexIds:['v1','v0']});assert.deepEqual(domain,[-0,1]);assert.ok(domain[0]<domain[1]);
});
test('pure maps refuse unsupported data without executing property getters or native bindings',()=>{
 for(const plane of ['zx','yx','zy','XY',0,null])assert.throws(()=>mirror([1,2,3],{plane}),RangeError);
 for(const point of [[NaN,2,3],[Infinity,2,3],[10001,2,3],[1,2]])assert.throws(()=>mirror(point,{plane:'xz'}),RangeError);
 let reads=0;const point=new Proxy([1,2,3],{get(){reads++;throw Error('get');}}),spec=new Proxy({plane:'xz'},{get(){reads++;throw Error('get');}});assert.deepEqual(mirror(point,spec),[1,-2,3]);assert.equal(reads,0);
 const getter=[1,2,3];Object.defineProperty(getter,'0',{enumerable:true,get(){reads++;return 1;}});assert.throws(()=>mirror(getter,{plane:'xz'}),RangeError);assert.equal(reads,0);
 const revoked=Proxy.revocable([1,2,3],{});revoked.revoke();assert.throws(()=>mirror(revoked.proxy,{plane:'xz'}),RangeError);
});
