import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// ZERO-NATIVE admission/routing controls for #1967. Every construction, solver,
// compiler and mass binding is replaced before importing the actual facade.
// Deliberately inert bodies/reports below prove no geometry or native lineage.
// Use CAD_MODEL_SCALE_ENTRY=.../src/modeling.ts or .../dist/modeling.js.
// A prebundled index has erased the provider boundary and is never admitted.
const entry = resolve(process.env.CAD_MODEL_SCALE_ENTRY ?? fileURLToPath(new URL('../dist/modeling.js', import.meta.url)));
assert.match(basename(entry), /^modeling\.(?:ts|js)$/, 'Use the actual source or emitted modeling entry');
const mode = extname(entry) === '.ts' ? 'source' : 'emitted';
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? fileURLToPath(new URL('../../..', import.meta.url)), 'package.json'));
const { build } = require('esbuild');
const trapKey = Symbol.for('barocss.modeling-scale.admission-trap');
assert.equal(globalThis[trapKey], undefined, 'Never replace another active trap');
const providers = new Map([
  ['xy-arc', 'buildXYArc'], ['xy-circle-prism-shell', 'buildXYCirclePrismShell'], ['stored-circle-prism-solid', 'qualifyStoredCirclePrismSolid'],
  ['xy-affine-sketch', 'buildXYAffineSketch'], ['xy-affine-sketch-prism', 'buildXYAffineSketchPrism'],
  ['convex-planar-slab-subtraction', 'subtractConvexPlanarSlab'], ['convex-planar-solid-intersection', 'intersectConvexPlanarSolids'],
  ['convex-planar-solid-split', 'splitConvexPlanarSolid'], ['model-compiler', 'compileCadModel'],
  ['convex-planar-solid-chamfer', 'chamferConvexPlanarSolid'], ['axis-box-boolean', 'buildAxisBoxSolidBoolean'],
  ['orthogonal-solid-boolean', 'buildOrthogonalSolidBoolean'], ['modeling-box-internal', 'buildModelingBox'],
  ['modeling-translation-internal', 'buildModelingTranslation'], ['modeling-rotation-internal', 'buildModelingRotation'], ['modeling-mirror-internal', 'buildModelingMirror'], ['modeling-scale-internal', 'buildModelingScale'], ['modeling-stl-internal', 'buildModelingStl'],
  ['own-plate-circular-hole', 'buildOwnPlateCircularHole'], ['stored-plate-hole-solid', 'qualifyStoredPlateHoleSolid'],
  ['convex-planar-solid-mass', 'measureConvexPlanarSolidMass'], ['axis-box-solid-mass', 'measureAxisBoxSolidBooleanMass'],
]);
const pureModules = new Set(['modeling', 'cad-document', 'data-copy', 'xy-affine-prism-feature-document-internal',
  'modeling-regeneration-internal', 'modeling-dimension-internal']);
const replaced = new Set(), state = { phase: 'closed', calls: [], unexpected: [], scaleError: undefined };
const clone = value => structuredClone(value);
const marker = 'INERT_SCALE_CONTROL_NOT_GEOMETRY';
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
  if (binding === 'buildModelingScale') {
    if (state.scaleError !== undefined) throw state.scaleError;
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
const bundle = await build({ stdin: { contents: virtualEntry, resolveDir: dirname(entry), sourcefile: 'scale-test-entry.mjs', loader: 'js' },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', write: false, metafile: true,
  plugins: [{ name: 'modeling-scale-zero-native-provider-trap', setup(build) {
    build.onResolve({ filter: /\.(?:ts|js)$/ }, args => {
      const key = basename(args.path, extname(args.path));
      if (providers.has(key)) { replaced.add(key); return { path: key, namespace: 'scale-trap' }; }
      assert.ok(pureModules.has(key), 'Unreviewed implementation cannot enter zero-native bundle: ' + args.path);
    });
    build.onLoad({ filter: /.*/, namespace: 'scale-trap' }, args => ({ loader: 'js', contents: `
      // INERT TEST BINDING: no original implementation is imported or called.
      export function ${providers.get(args.path)}(...args) {
        return globalThis[Symbol.for('barocss.modeling-scale.admission-trap')].dispatch(${JSON.stringify(providers.get(args.path))}, args);
      }` }));
  } }] });
assert.deepEqual([...replaced].sort(), [...providers.keys()].sort(), 'Every native provider binding is replaced');
const inputPaths = Object.keys(bundle.metafile.inputs).filter(path => !path.startsWith('scale-trap:') && !path.endsWith('scale-test-entry.mjs')).sort();
assert.equal(inputPaths.length, pureModules.size);
for (const path of inputPaths) assert.ok(pureModules.has(basename(path, extname(path))), 'No native implementation in bundle: ' + path);
const { createCadModel, loadCadModel, CadModelError, CadModelLimits, signedJson }
  = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let provenance;
if (process.env.EVIDENCE_DIR) {
  const directory = resolve(process.env.EVIDENCE_DIR, 'modeling-scale-admission-' + mode);
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
  if (provenance) writeFileSync(resolve(provenance.directory, 'receipt.json'), JSON.stringify({ issue: 1967,
    scope: 'Actual modeling facade and unchanged pure helpers; isolated inert providers; admission and routing only, no geometric acceptance',
    realNativeGeometryCalls: 0, unexpectedProviderAttempts: state.unexpected, inertProviderCalls: counts,
    fullTransitiveNativeCoverage: 'NOT_MEASURED', provenance }, null, 2) + '\n', { flag: 'wx' });
  delete globalThis[trapKey]; assert.deepEqual(state.unexpected, []); assert.equal(state.phase, 'closed');
});
function mockNative(action, error) {
  assert.equal(state.phase, 'closed'); state.phase = 'mock-native'; state.scaleError = error;
  try { return action(); } finally { state.phase = 'closed'; state.scaleError = undefined; }
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


const options = (factor=0.5) => ({factor});
const doc = (factor=0.5) => ({format:'barocss-cad-model',schema:1,units:'mm',parameters:{},nodes:[
  {kind:'sketch',profile:'rectangle',min:[-0,0],max:[32,24]},{kind:'extrude',sketch:0,height:8},
  {kind:'scale',parent:{node:1,side:'solid'},factor}],outputs:{original:{node:1,side:'solid'},scaled:{node:2,side:'solid'}}});
const part = () => {const model=createCadModel();return {model,original:rectangle(model).extrude(8)};};
function pair(factor=0.5) {const {model,original}=part(),scaled=original.scale(options(factor));return mockNative(()=>model.build({original,scaled}));}

test('all twenty-two facade providers are replaced with direct provenance excluding native implementations',()=>{
  assert.equal(replaced.size,22);assert.equal(inputPaths.length,pureModules.size);
  const start=state.calls.length,snapshot=pair(),calls=state.calls.slice(start);
  assert.deepEqual(calls.map(c=>c.binding),['buildXYAffineSketch','buildXYAffineSketchPrism','buildModelingScale']);
  assert.equal(calls[2].args[0],snapshot.bodies.original.native);assert.deepEqual(calls[2].args[1],{factor:0.5});assert.equal(calls[2].args[2],'m2');
  assert.equal(snapshot.bodies.scaled.native,calls[2].result.solid);assert.equal(snapshot.bodies.scaled.family,'convex-planar');assert.equal(snapshot.evidence[2].native,calls[2].result);
  assert.deepEqual(snapshot.features.map(f=>[f.kind,f.dependencies]),[['sketch',[]],['extrude',[0]],['scale',[1]]]);assert.equal(CadModelLimits.nodes,6);frozen(snapshot);
});
test('both authored factors retain strict saved values and route unchanged native specs',()=>{
  for(const factor of [0.5,2]){
    const snapshot=pair(factor),saved=JSON.parse(snapshot.save());
    assert.deepEqual(saved.nodes[2],{kind:'scale',parent:{node:1,side:'solid'},factor});assert.deepEqual(snapshot.evidence[2].native.request.spec,{factor});
    const cold=mockNative(()=>loadCadModel(snapshot.save()));assert.equal(cold.save(),snapshot.save());
    assert.deepEqual(Object.keys(snapshot.bodies).sort(),['original','scaled']);
    assert.deepEqual(Object.keys(cold.bodies).sort(),['original','scaled']);
    assert.deepEqual(cold.bodies,snapshot.bodies);assert.deepEqual(cold.evidence,snapshot.evidence);
  }
});
test('one exact own-data factor record refuses malformed data without consuming a node',()=>{
  const {model,original}=part();let reads=0;
  const getter={};Object.defineProperty(getter,'factor',{enumerable:true,get(){reads++;return 0.5;}});
  const hidden=options();Object.defineProperty(hidden,'hidden',{value:1});const symbol=options();symbol[Symbol('x')]=1;
  const hostile=Object.create({factor:0.5});const revoked=Proxy.revocable(options(),{});revoked.revoke();
  const args=[[],[undefined],[null],[options(),undefined],[[]],[getter],[hidden],[symbol],[hostile],[revoked.proxy],[{}],
    [{...options(),axis:'x'}],[{...options(),pivot:[0,0,0]}],[{...options(),offset:1}]];
  for(const factor of [null,1,0.25,4,'2',0,-0,-0.5,-2,90,NaN,Infinity,{parameter:'factor'},[2,1,1]])args.push([options(factor)]);
  args.push([{factor:undefined}]);
  for(const value of args)refuses(()=>original.scale(...value));
  assert.equal(reads,0);
  const snapshot=mockNative(()=>model.build({scaled:original.scale(options())}));assert.deepEqual(JSON.parse(snapshot.save()).nodes.map(n=>n.kind),['sketch','extrude','scale']);
});
test('one descriptor snapshot prevents Proxy get traps from changing authored factor',()=>{
  for(const replacement of [2,'throw']){
    const {model,original}=part();let reads=0;
    const value=new Proxy(options(0.5),{get(){reads++;if(replacement==='throw')throw Error('hostile-get');return replacement;}});
    const scaled=original.scale(value),snapshot=mockNative(()=>model.build({scaled}));assert.equal(reads,0);assert.equal(JSON.parse(snapshot.save()).nodes[2].factor,0.5);assert.deepEqual(snapshot.evidence[2].native.request.spec,{factor:0.5});
  }
  const {original}=part();let reads=0;const invalid=new Proxy(options(1),{get(){reads++;return 0.5;}});refuses(()=>original.scale(invalid));assert.equal(reads,0);assert.ok(original.scale(options()));
});
test('borrowed receivers, dimensions and non-plain prototypes refuse before routing',()=>{
  const {model,original}=part();const f=original.scale;refuses(()=>f(options()));refuses(()=>f.call({},options()));refuses(()=>f.call(part().original,options()));
  refuses(()=>original.scale({factor:model.parameter('factor',1)}));refuses(()=>original.scale(Object.assign(new Date(),options())));
  const data=Object.assign(Object.create(null),options());assert.ok(original.scale(data));
});
test('world-origin uniform copy is terminal for transforms and later features through retained handles',()=>{
  const {model,original}=part(),scaled=original.scale(options());
  for(const shape of [original,scaled]){refuses(()=>shape.scale(options()));refuses(()=>shape.rotate({axis:'x',angleDegrees:90}));refuses(()=>shape.mirror({plane:'xz'}));refuses(()=>shape.translate([1,0,0]));refuses(()=>shape.hole({center:[1,1],radius:1}));refuses(()=>shape.split({axis:'z',at:4}));}
  refuses(()=>scaled.edges({parallelTo:'x'}));
  refuses(()=>model.sketch.rectangle({width:2,height:2}));refuses(()=>model.sketch.polygon([[0,0],[2,0],[0,2]]));
  for(const transform of ['translate','rotate','mirror']){const {original}=part();const copy=transform==='translate'?original.translate([1,0,0]):transform==='rotate'?original.rotate({axis:'x',angleDegrees:90}):original.mirror({plane:'xz'});refuses(()=>copy.scale(options()));refuses(()=>original.scale(options()));}
});
test('direct affine provenance includes placed extrusion and complete one/two-chamfer prefix',()=>{
  for(const profile of ['rectangle','polygon','constrained']){
    const model=createCadModel(),sketch=profile==='rectangle'?rectangle(model):profile==='polygon'?model.sketch.polygon([[0,0],[32,0],[32,24],[0,24]]):model.sketch.constrainedPolygon(fixedPolygon);
    const original=sketch.extrude(8,{from:3}),scaled=original.scale(options(2));const snapshot=mockNative(()=>model.build({original,scaled}));assert.equal(JSON.parse(snapshot.save()).nodes[1].from,3);
  }
  for(const count of [1,2]){
    const {model,original}=part(),front=original.chamfer(original.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
    const finished=count===1?front:front.chamfer(front.edges({parallelTo:'x',at:{y:24,z:'max'}}).one(),2);
    const scaled=finished.scale(options());const snapshot=mockFinishing(()=>model.build({original:finished,scaled}));assert.deepEqual(snapshot.features.map(f=>f.kind),['sketch','extrude',...Array(count).fill('chamfer'),'scale']);
  }
  const {model,original}=part(),other=rectangle(model).extrude(4),scaled=original.scale(options(0.5));const snapshot=mockNative(()=>model.build({original,other,scaled}));assert.equal(snapshot.features.length,5);
});
test('unsupported families, operation ancestry and incomplete finishing prefixes refuse',()=>{
  {const model=createCadModel(),circle=model.sketch.circle({center:[0,0],radius:4}).extrude(8);refuses(()=>circle.scale(options()));}
  {const {original}=part();refuses(()=>original.hole({center:[8,8],radius:2}).scale(options()));}
  {const {original}=part();refuses(()=>original.split({axis:'z',at:4}).negative.scale(options()));}
  for(const operation of ['union','intersect','cut']){const {model,original}=part(),tool=rectangle(model).extrude(4);refuses(()=>original[operation](tool).scale(options()));}
  {const {original}=part();const front=original.chamfer(original.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);refuses(()=>original.chamfer(original.edges({parallelTo:'x',at:{y:24,z:'max'}}).one(),2));refuses(()=>original.scale(options()));assert.ok(front);}
  {const {model,original}=part();const other=rectangle(model).extrude(4);other.chamfer(other.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);refuses(()=>original.scale(options()));}
});
test('same-model callback fences held handles before options reflection and preserves failed admission',()=>{
  const {model,original}=part();let reflections=0;
  const value=new Proxy(options(),{ownKeys(){reflections++;throw Error('must-not-reflect');}});
  model.sketch.constrainedPolygon(s=>{refuses(()=>original.scale(value),'OWNERSHIP');assert.equal(reflections,0);return fixedPolygon(s);});assert.ok(original.scale(options()));
  const other=part();let crossModel;createCadModel().sketch.constrainedPolygon(s=>{crossModel=other.original.scale(options());return fixedPolygon(s);});assert.ok(crossModel);
});
test('strict codec rejects wrong fields, factors, parent references, mixed transforms and later nodes',()=>{
  const mutations=[d=>delete d.nodes[2].factor,d=>d.nodes[2].offset=1,d=>d.nodes[2].axis='x',d=>d.nodes[2].factor=1,d=>d.nodes[2].factor={parameter:'x'},
    d=>d.nodes[2].parent.side='negative',d=>d.nodes[2].parent.node=0,d=>d.nodes.push({kind:'extrude',sketch:0,height:4}),d=>d.nodes.push({...d.nodes[2],parent:{node:2,side:'solid'}}),d=>d.nodes[2].kind='resize',
    d=>d.nodes.push({kind:'translate',parent:{node:2,side:'solid'},offset:[1,0,0]}),d=>d.nodes.push({kind:'rotate',parent:{node:2,side:'solid'},axis:'x',angleDegrees:90}),d=>d.nodes.push({kind:'mirror',parent:{node:2,side:'solid'},plane:'xz'})];
  for(const edit of mutations){const d=doc();edit(d);refuses(()=>loadCadModel(signedJson(d)));}
  const duplicate=signedJson(doc()).replace('"factor":0.5','"factor":0.5,"factor":0.5');refuses(()=>loadCadModel(duplicate));
  const old=doc();old.nodes.pop();old.outputs={original:{node:1,side:'solid'}};const snapshot=mockNative(()=>loadCadModel(signedJson(old)));assert.equal(Object.hasOwn(JSON.parse(snapshot.save()).nodes[1],'from'),false);
});
test('native refusal keeps original complete cause and accepted snapshot data',()=>{
  const snapshot=pair(),held=retained(snapshot),cause=new Error('native Gram refusal');cause.report={completed:'parent-validation',retries:0};const error=refuses(()=>mockNative(()=>loadCadModel(snapshot.save()),cause),'NATIVE','scale',false);assert.equal(error.cause,cause);assert.equal(error.cause.report,cause.report);unchanged(snapshot,held);
});

// Actual pure helpers retain their original exact rational dependency. All
// geometry/provider imports remain replaced by throwing traps.
const mapEntry=resolve(dirname(entry),'modeling-scale-internal'+extname(entry));
const mapBindings={ 'own-convex-planar-face':['buildConvexPlanarFace'], 'convex-planar-solid':['qualifyConvexPlanarSolid','validateConvexPlanarSolid'],
  'convex-planar-solid-proof-internal':['check','id','same','SolidSnapshotLedger','ConvexPlanarSolidError'] };
const mapPureModules=new Set(['modeling-scale-internal','section-rational-internal']);
let mapAttempts=0;const mapKey=Symbol.for('barocss.modeling-scale.coefficient-trap');globalThis[mapKey]=()=>{mapAttempts++;throw Error('UNEXPECTED_MAP_NATIVE');};
const mapBundle=await build({stdin:{contents:`export { scalePointExactly, scaleCurveExactly, scaleSurfaceExactly } from ${JSON.stringify(mapEntry)};`,resolveDir:dirname(entry),sourcefile:'scale-map-entry.mjs',loader:'js'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true,
 plugins:[{name:'scale-map-native-trap',setup(b){b.onResolve({filter:/\.(?:ts|js)$/},args=>{const key=basename(args.path,extname(args.path));if(mapBindings[key])return{path:key,namespace:'map-trap'};assert.ok(mapPureModules.has(key),'Only checked pure scale/rational modules may enter the map bundle: '+key);});b.onLoad({filter:/.*/,namespace:'map-trap'},args=>({loader:'js',contents:mapBindings[args.path].map(name=>`export const ${name}=function(){return globalThis[Symbol.for('barocss.modeling-scale.coefficient-trap')]();};`).join('\n')}));}}]});
const mapInputs=Object.keys(mapBundle.metafile.inputs).filter(path=>!path.startsWith('map-trap:')&&!path.endsWith('scale-map-entry.mjs')).sort();
assert.deepEqual(mapInputs.map(path=>basename(path,extname(path))).sort(),[...mapPureModules].sort(),'The actual exact rational module is retained, never stubbed');
const {scalePointExactly:scale,scaleCurveExactly,scaleSurfaceExactly}=await import('data:text/javascript;base64,'+Buffer.from(mapBundle.outputFiles[0].text).toString('base64'));
if(provenance){const dir=provenance.directory;writeFileSync(resolve(dir,'map-bundle.mjs'),mapBundle.outputFiles[0].text,{flag:'wx'});writeFileSync(resolve(dir,'map-metafile.json'),JSON.stringify(mapBundle.metafile,null,2)+'\n',{flag:'wx'});provenance.map={entry:mapEntry,bundleSHA256:sha256(mapBundle.outputFiles[0].text),actualPureInputHashes:Object.fromEntries(mapInputs.map(path=>[path,sha256(readFileSync(resolve(path)))])),nativeBindingsReplaced:mapBindings};}
after(()=>{delete globalThis[mapKey];assert.equal(mapAttempts,0);});

// Independent represented-binary64 oracle. It uses no production arithmetic.
const rational=value=>{const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value,false);const bits=view.getBigUint64(0,false),sign=bits>>63n?-1n:1n,exp=Number((bits>>52n)&2047n),fraction=bits&((1n<<52n)-1n);assert.notEqual(exp,2047);const significand=exp?fraction+(1n<<52n):fraction,shift=exp?exp-1075:-1074;return shift>=0?{n:sign*significand*(1n<<BigInt(shift)),d:1n}:{n:sign*significand,d:1n<<BigInt(-shift)};};
const product=(a,b)=>({n:a.n*b.n,d:a.d*b.d});
const equalRational=(a,b)=>assert.equal(a.n*b.d,b.n*a.d);
test('two exact factors preserve all signed-zero combinations and independent rational coefficient products',()=>{
 const points=[[2,3,5],[0.125,-2.5,-0],[2*Number.MIN_VALUE,-4*Number.MIN_VALUE,0],[5000,-5000,0]];
 for(let mask=0;mask<8;mask++)points.push([0,1,2].map(i=>mask&(1<<i)?-0:0));
 for(const factor of [0.5,2])for(const point of points){const actual=scale(point,{factor});actual.forEach((v,i)=>{equalRational(rational(v),product(rational(point[i]),rational(factor)));assert.ok(Object.is(v,point[i]*factor));});
  const restored=scale(actual,{factor:factor===0.5?2:0.5});restored.forEach((v,i)=>assert.ok(Object.is(v,point[i])));
 }
});
test('odd subnormal halving, underflow and coordinate overflow refuse without a rounded result',()=>{
 for(const value of [Number.MIN_VALUE,-Number.MIN_VALUE,3*Number.MIN_VALUE,-3*Number.MIN_VALUE]){
  assert.throws(()=>scale([value,0,-0],{factor:0.5}),RangeError);
  const rounded=value*0.5,expected=product(rational(value),rational(0.5));assert.notEqual(rational(rounded).n*expected.d,expected.n*rational(rounded).d);
 }
 for(const value of [2*Number.MIN_VALUE,-2*Number.MIN_VALUE,4*Number.MIN_VALUE]){
  const actual=scale([value,0,-0],{factor:0.5})[0];equalRational(rational(actual),product(rational(value),rational(0.5)));
 }
 for(const value of [5000.000000000001,-5000.000000000001,10000,-10000])assert.throws(()=>scale([value,0,0],{factor:2}),RangeError);
 assert.deepEqual(scale([5000,-5000,-0],{factor:2}),[10000,-10000,-0]);
 assert.deepEqual(scale([10000,-10000,-0],{factor:0.5}),[5000,-5000,-0]);
});
test('Curve and Surface helpers preserve pole order, copied basis, weights and increasing native domains',()=>{
 const c={kind:'curve',id:'c',degree:1,knots:[-0,0,1,1],weights:[1,1],controlPoints:[[-0,2,3],[4,-0,6]]};
 const s={kind:'surface',id:'s',degreeU:1,degreeV:1,knotsU:[-0,0,1,1],knotsV:[0,0,1,1],weights:[[1,1],[1,1]],controlPoints:[[c.controlPoints[0],c.controlPoints[1]],[[7,8,-0],[10,11,12]]]};
 for(const factor of [0.5,2]){const spec={factor},a=scaleCurveExactly(c,spec),b=scaleSurfaceExactly(s,spec);
  assert.deepEqual(a.controlPoints,c.controlPoints.map(point=>point.map(v=>v*factor)));assert.deepEqual(b.controlPoints,s.controlPoints.map(row=>row.map(point=>point.map(v=>v*factor))));
  for(const field of ['degree','knots','weights'])assert.deepEqual(a[field],c[field]);for(const field of ['degreeU','degreeV','knotsU','knotsV','weights'])assert.deepEqual(b[field],s[field]);
  assert.ok(a.knots[a.degree]<a.knots[a.knots.length-a.degree-1]);assert.notEqual(a.knots,c.knots);assert.notEqual(a.weights,c.weights);assert.notEqual(b.weights[0],s.weights[0]);a.controlPoints[0][0]=999;assert.ok(Object.is(c.controlPoints[0][0],-0));
 }
 const odd={...c,controlPoints:[[Number.MIN_VALUE,0,0],[0,1,0]]};assert.throws(()=>scaleCurveExactly(odd,{factor:0.5}),RangeError);
});
test('positive uniform scale preserves orientation while normal, Gram and volume factors have exact powers',()=>{
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 const du=[1,2,3],dv=[4,5,6],origin=[7,8,9],normal=cross(du,dv),gram=[dot(du,du),dot(du,dv),dot(dv,dv)],det=gram[0]*gram[2]-gram[1]**2;
 for(const factor of [0.5,2]){
  const scaledDu=scale(du,{factor}),scaledDv=scale(dv,{factor}),scaledNormal=cross(scaledDu,scaledDv);
  assert.deepEqual(scaledNormal,normal.map(v=>v*factor**2));
  const scaledGram=[dot(scaledDu,scaledDu),dot(scaledDu,scaledDv),dot(scaledDv,scaledDv)];assert.deepEqual(scaledGram,gram.map(v=>v*factor**2));assert.equal(scaledGram[0]*scaledGram[2]-scaledGram[1]**2,det*factor**4);
  assert.equal(dot(scaledNormal,scale(origin,{factor})),dot(normal,origin)*factor**3);assert.ok(factor**3>0);
 }
});
test('pure helper admission snapshots descriptors and rejects hostile or malformed values before native bindings',()=>{
 for(const factor of [0,-0,1,-0.5,-2,0.25,4,'2',NaN,Infinity,undefined])assert.throws(()=>scale([1,2,3],{factor}),RangeError);
 for(const point of [[NaN,2,3],[Infinity,2,3],[10001,2,3],[1,2]])assert.throws(()=>scale(point,{factor:2}),RangeError);
 let reads=0;const point=new Proxy([1,2,3],{get(){reads++;throw Error('get');}}),spec=new Proxy({factor:2},{get(){reads++;return 0.5;}});assert.deepEqual(scale(point,spec),[2,4,6]);assert.equal(reads,0);
 const getter=[1,2,3];Object.defineProperty(getter,'0',{enumerable:true,get(){reads++;return 1;}});assert.throws(()=>scale(getter,{factor:2}),RangeError);assert.equal(reads,0);
 const getterSpec={};Object.defineProperty(getterSpec,'factor',{enumerable:true,get(){reads++;return 2;}});assert.throws(()=>scale([1,2,3],getterSpec),RangeError);assert.equal(reads,0);
 const revoked=Proxy.revocable([1,2,3],{});revoked.revoke();assert.throws(()=>scale(revoked.proxy,{factor:2}),RangeError);
 const sparse=[1,,3];assert.throws(()=>scale(sparse,{factor:2}),RangeError);const extra=[1,2,3];extra.hidden=0;assert.throws(()=>scale(extra,{factor:2}),RangeError);
 const c={kind:'curve',id:'c',degree:1,knots:[0,0,1,1],weights:[1,1],controlPoints:[[0,0,0],[1,1,1]]};const proxy=new Proxy(c,{get(){reads++;throw Error('curve-get');}});assert.deepEqual(scaleCurveExactly(proxy,{factor:2}).controlPoints,[[0,0,0],[2,2,2]]);assert.equal(reads,0);
});
